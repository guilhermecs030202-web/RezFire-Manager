function kpiCard(label, value, hint) {
  return `
    <article class="card kpi-card">
      <p class="kpi-label">${label}</p>
      <p class="kpi-value">${value}</p>
      ${hint ? `<p class="kpi-hint">${hint}</p>` : ""}
    </article>
  `;
}

function renderDashboard() {
  RezFireLayout.renderSidebar("dashboard");

  const products = RezFireData.loadProducts();
  const metrics = RezFireData.computeDashboard(products);
  const money = RezFireData.formatMoney;

  document.getElementById("kpis-estoque").innerHTML = [
    kpiCard("QUANTIDADE TOTAL", metrics.quantidadeTotal.toLocaleString("pt-BR"), "unidades em produtos ativos"),
    kpiCard("VALOR TOTAL DE ESTOQUE", money(metrics.valorTotal), "saldo × preço de venda"),
    kpiCard("PRODUTOS COM ESTOQUE BAIXO", String(metrics.abaixoMinimo), "saldo ≤ estoque mínimo"),
    kpiCard("COBERTURA DE ESTOQUE", `${metrics.coberturaDias} dias`, "com base na saída média do período"),
    kpiCard("GIRO DE ESTOQUE", `${metrics.giroAno}x`, "ao ano (ilustrativo)"),
  ].join("");

  document.getElementById("kpis-movimentacoes").innerHTML = [
    kpiCard("ENTRADAS DE PRODUTOS", metrics.entradas.toLocaleString("pt-BR"), "unidades em 6 meses"),
    kpiCard("SAÍDAS DE PRODUTOS", metrics.saidas.toLocaleString("pt-BR"), "unidades em 6 meses"),
    kpiCard("FREQUÊNCIA MÉDIA", `${metrics.frequenciaMedia} / mês`, `${RezFireData.TOTAL_MOVIMENTACOES} movimentações no período`),
  ].join("");

  document.getElementById("kpis-vendas").innerHTML = [
    kpiCard("TICKET MÉDIO DE VENDA", money(metrics.ticketMedio), "origem: pedidos de demonstração"),
  ].join("");

  const months = metrics.movimentacoesMensais.map((m) => m.mes);
  const chart = new ApexCharts(document.querySelector("#chart-movimentacoes"), {
    chart: {
      type: "bar",
      height: 280,
      toolbar: { show: false },
      fontFamily: "Inter, sans-serif",
      animations: { enabled: false },
    },
    series: [
      { name: "entradas", data: metrics.movimentacoesMensais.map((m) => m.entradas) },
      { name: "saídas", data: metrics.movimentacoesMensais.map((m) => m.saidas) },
    ],
    colors: ["#1a1412", "#e85c2a"],
    plotOptions: {
      bar: {
        columnWidth: "46%",
        borderRadius: 2,
      },
    },
    dataLabels: { enabled: false },
    grid: {
      borderColor: "#eee8e0",
      strokeDashArray: 0,
    },
    xaxis: {
      categories: months,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      labels: {
        formatter: (val) => val.toLocaleString("pt-BR"),
      },
    },
    legend: {
      position: "bottom",
      markers: { radius: 2 },
    },
    tooltip: {
      y: { formatter: (val) => `${val.toLocaleString("pt-BR")} un.` },
    },
  });
  chart.render();

  renderTabProdutos(products);
  bindTabs();
}

function bindTabs() {
  document.querySelectorAll('.dash-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('is-active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('is-active'));
      
      btn.classList.add('is-active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('is-active');
    });
  });
}

function renderTabProdutos(products) {
  const money = RezFireData.formatMoney;
  
  const total = products.length;
  const ativos = products.filter(p => p.ativo).length;
  const inativos = total - ativos;
  
  // Criando dados mockados de vendas baseados nos IDs para serem consistentes
  const mockSales = products.map((p) => {
    let qty = (p.id_produto * 7) % 50; 
    if (p.id_produto === 12) qty = 0; // Simulando item "Sem movimentação"
    const faturamento = qty * (p.preco || 0);
    const custo_total = qty * (p.custo || 0);
    const lucro = faturamento - custo_total;
    return { ...p, vendas_qtd: qty, faturamento: faturamento, lucro: lucro };
  });

  const semMovimentacao = mockSales.filter(p => p.vendas_qtd === 0).length;
  
  const sortedByQty = [...mockSales].sort((a,b) => b.vendas_qtd - a.vendas_qtd);
  const maisVendido = sortedByQty[0];
  const menosVendido = sortedByQty.filter(p => p.vendas_qtd > 0).pop();
  
  const sortedByFaturamento = [...mockSales].sort((a,b) => b.faturamento - a.faturamento);
  const maiorFaturamento = sortedByFaturamento[0];
  
  const sortedByLucro = [...mockSales].sort((a,b) => b.lucro - a.lucro);

  document.getElementById("kpis-tab-produtos").innerHTML = [
    kpiCard("TOTAL DE PRODUTOS", total, `${ativos} ativos | ${inativos} inativos`),
    kpiCard("PRODUTO MAIS VENDIDO", maisVendido ? maisVendido.sku : "-", maisVendido ? `${maisVendido.vendas_qtd} un. vendidas` : ""),
    kpiCard("PRODUTO MENOS VENDIDO", menosVendido ? menosVendido.sku : "-", menosVendido ? `${menosVendido.vendas_qtd} un. vendidas` : ""),
    kpiCard("MAIOR FATURAMENTO", maiorFaturamento ? maiorFaturamento.sku : "-", maiorFaturamento ? money(maiorFaturamento.faturamento) : ""),
    kpiCard("SEM MOVIMENTAÇÃO", semMovimentacao, "produtos parados no período"),
  ].join("");

  // Gráfico: Faturamento Top 5
  const top5Fat = sortedByFaturamento.slice(0, 5);
  new ApexCharts(document.querySelector("#chart-faturamento-produtos"), {
    chart: { type: "bar", height: 280, toolbar: { show: false }, fontFamily: "Inter, sans-serif" },
    series: [{ name: "Faturamento", data: top5Fat.map(p => p.faturamento) }],
    xaxis: { categories: top5Fat.map(p => p.sku) },
    colors: ["#e85c2a"],
    plotOptions: { bar: { borderRadius: 2, columnWidth: "50%" } },
    dataLabels: { enabled: false },
    yaxis: { labels: { formatter: (val) => money(val) } },
    tooltip: { y: { formatter: (val) => money(val) } }
  }).render();

  // Gráfico: Lucro Top 5
  const top5Lucro = sortedByLucro.slice(0, 5);
  new ApexCharts(document.querySelector("#chart-lucro-produtos"), {
    chart: { type: "bar", height: 280, toolbar: { show: false }, fontFamily: "Inter, sans-serif" },
    series: [{ name: "Lucro", data: top5Lucro.map(p => p.lucro) }],
    xaxis: { categories: top5Lucro.map(p => p.sku) },
    colors: ["#1f9d5c"], // Verde indicando lucro
    plotOptions: { bar: { borderRadius: 2, columnWidth: "50%" } },
    dataLabels: { enabled: false },
    yaxis: { labels: { formatter: (val) => money(val) } },
    tooltip: { y: { formatter: (val) => money(val) } }
  }).render();

  // Gráfico: Vendas por Produto Top 10 (Qtd)
  const top10Qtd = sortedByQty.slice(0, 10);
  new ApexCharts(document.querySelector("#chart-vendas-produtos"), {
    chart: { type: "bar", height: 280, toolbar: { show: false }, fontFamily: "Inter, sans-serif" },
    series: [{ name: "Unidades Vendidas", data: top10Qtd.map(p => p.vendas_qtd) }],
    xaxis: { categories: top10Qtd.map(p => p.sku) },
    colors: ["#1a1412"],
    plotOptions: { bar: { borderRadius: 2, columnWidth: "50%" } },
    dataLabels: { enabled: false },
    yaxis: { labels: { formatter: (val) => `${val} un.` } },
    tooltip: { y: { formatter: (val) => `${val} un.` } }
  }).render();

  // Gráfico: Pizza Lucratividade (Top 5 e Outros)
  const lucrosPositivos = sortedByLucro.filter(p => p.lucro > 0);
  let pizzaSeries = [];
  let pizzaLabels = [];
  if (lucrosPositivos.length > 5) {
    const topPizza = lucrosPositivos.slice(0, 5);
    const others = lucrosPositivos.slice(5).reduce((sum, p) => sum + p.lucro, 0);
    pizzaSeries = [...topPizza.map(p => p.lucro), others];
    pizzaLabels = [...topPizza.map(p => p.sku), "Outros"];
  } else {
    pizzaSeries = lucrosPositivos.map(p => p.lucro);
    pizzaLabels = lucrosPositivos.map(p => p.sku);
  }

  new ApexCharts(document.querySelector("#chart-lucratividade-pizza"), {
    chart: { type: "pie", height: 280, fontFamily: "Inter, sans-serif" },
    series: pizzaSeries,
    labels: pizzaLabels,
    colors: ["#e85c2a", "#1f9d5c", "#1a1412", "#6b6560", "#d13c3c", "#f5e6c8"],
    dataLabels: { enabled: false },
    legend: { position: "right" },
    stroke: { show: false },
    tooltip: { y: { formatter: (val) => money(val) } }
  }).render();

  // Gráfico: Curva ABC (Mock)
  new ApexCharts(document.querySelector("#chart-curva-abc"), {
    chart: { type: "donut", height: 280, fontFamily: "Inter, sans-serif" },
    series: [70, 20, 10],
    labels: ["Classe A (Altíssimo Fatur.)", "Classe B (Médio Fatur.)", "Classe C (Baixo Fatur.)"],
    colors: ["#e85c2a", "#f5e6c8", "#1a1412"],
    dataLabels: { enabled: false },
    legend: { position: "bottom" },
    stroke: { show: false }
  }).render();

  // Gráfico: Status dos Produtos (Ativos x Inativos)
  new ApexCharts(document.querySelector("#chart-status-produtos"), {
    chart: { type: "pie", height: 280, fontFamily: "Inter, sans-serif" },
    series: [ativos, inativos],
    labels: ["Ativos", "Inativos"],
    colors: ["#1f9d5c", "#d13c3c"],
    dataLabels: { enabled: false },
    legend: { position: "bottom" },
    stroke: { show: false }
  }).render();
}

renderDashboard();
