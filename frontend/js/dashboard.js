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
  const chartVisao = new ApexCharts(document.querySelector("#chart-movimentacoes"), {
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
  chartVisao.render();

  renderTabVendas(products);
  setupSalesFilters(products);
  renderTabProdutos(products);
  bindTabs();
  bindOrderModalEvents();
}

// Armazenamento de instâncias dos gráficos da aba Vendas para destruição limpa ao trocar filtros
let vendasCharts = {};

function formatDateTime(isoStr) {
  if (!isoStr) return "-";
  const d = new Date(isoStr);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderTabVendas(products) {
  const orders = RezFireData.loadOrders();
  const money = RezFireData.formatMoney;

  const selectPeriodo = document.getElementById("filtro-vendas-periodo");
  const selectCanal = document.getElementById("filtro-vendas-canal");

  const filterDays = selectPeriodo ? Number(selectPeriodo.value) : 30;
  const filterChannel = selectCanal ? selectCanal.value : "todos";

  const metrics = RezFireData.computeSalesMetrics(orders, filterDays, filterChannel);

  // 1. Renderiza KPIs Estratégicos de Vendas
  const deltaClass = metrics.deltaFaturamento >= 0 ? "kpi-delta up" : "kpi-delta down";
  const deltaSignal = metrics.deltaFaturamento >= 0 ? "+" : "";

  document.getElementById("kpis-tab-vendas").innerHTML = [
    kpiCard(
      "FATURAMENTO TOTAL",
      money(metrics.faturamentoTotal),
      `<span class="${deltaClass}">${deltaSignal}${metrics.deltaFaturamento}%</span> vs período anterior`
    ),
    kpiCard(
      "PEDIDOS CONCLUÍDOS",
      metrics.pedidosConcluidos.toLocaleString("pt-BR"),
      `${metrics.taxaConclusao}% de aprovação (${metrics.totalPedidos} totais)`
    ),
    kpiCard(
      "TICKET MÉDIO",
      money(metrics.ticketMedio),
      "faturamento ÷ pedidos válidos"
    ),
    kpiCard(
      "ITENS / EXTINTORES VENDIDOS",
      `${metrics.totalUnidades.toLocaleString("pt-BR")} un.`,
      "volume físico comercializado"
    ),
    kpiCard(
      "MARGEM BRUTA ESTIMADA",
      `${metrics.margemBrutaPercentual}%`,
      `Lucro bruto: ${money(metrics.lucroBruto)}`
    ),
    kpiCard(
      "VENDAS MERCADO LIVRE",
      money(metrics.faturamentoML),
      `${metrics.shareML}% do faturamento do negócio`
    ),
  ].join("");

  // Destruir gráficos anteriores antes de recriar com novos filtros
  Object.keys(vendasCharts).forEach((key) => {
    if (vendasCharts[key]) {
      try {
        vendasCharts[key].destroy();
      } catch (e) {
        // Ignora se já destruído
      }
    }
  });
  vendasCharts = {};

  // Gráfico 1: Evolução Temporal de Vendas (Faturamento e Pedidos)
  const elTimeline = document.querySelector("#chart-vendas-timeline");
  if (elTimeline) {
    vendasCharts.timeline = new ApexCharts(elTimeline, {
      chart: {
        height: 280,
        type: "line",
        toolbar: { show: false },
        fontFamily: "Inter, sans-serif",
      },
      series: [
        {
          name: "Faturamento (R$)",
          type: "area",
          data: metrics.timeline.faturamento,
        },
        {
          name: "Pedidos Realizados",
          type: "column",
          data: metrics.timeline.pedidos,
        },
      ],
      colors: ["#e85c2a", "#1a1412"],
      fill: {
        type: ["gradient", "solid"],
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [0, 95, 100],
        },
      },
      stroke: {
        width: [3, 0],
        curve: "smooth",
      },
      plotOptions: {
        bar: {
          columnWidth: "40%",
          borderRadius: 3,
        },
      },
      xaxis: {
        categories: metrics.timeline.categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: [
        {
          title: { text: "Faturamento", style: { fontSize: "11px", color: "#6b6560" } },
          labels: { formatter: (val) => money(val) },
        },
        {
          opposite: true,
          title: { text: "Pedidos", style: { fontSize: "11px", color: "#6b6560" } },
          labels: { formatter: (val) => `${Math.round(val || 0)} ped.` },
        },
      ],
      tooltip: {
        shared: true,
        y: [
          { formatter: (val) => money(val) },
          { formatter: (val) => `${val} pedidos` },
        ],
      },
      legend: { position: "bottom" },
    });
    vendasCharts.timeline.render();
  }

  // Gráfico 2: Vendas por Canal (Donut)
  const elCanal = document.querySelector("#chart-vendas-canal");
  if (elCanal) {
    const faturamentoML = metrics.faturamentoML;
    const faturamentoDireto = metrics.faturamentoDireto;
    const totalCanal = faturamentoML + faturamentoDireto;

    vendasCharts.canal = new ApexCharts(elCanal, {
      chart: {
        type: "donut",
        height: 280,
        fontFamily: "Inter, sans-serif",
      },
      series: totalCanal > 0 ? [faturamentoML, faturamentoDireto] : [1, 0],
      labels: ["Mercado Livre", "Venda Direta / B2B"],
      colors: ["#e85c2a", "#1a1412"],
      legend: { position: "bottom" },
      dataLabels: {
        enabled: true,
        formatter: (val) => `${Math.round(val)}%`,
      },
      tooltip: {
        y: { formatter: (val) => money(val) },
      },
      stroke: { show: false },
    });
    vendasCharts.canal.render();
  }

  // Gráfico 3: Top 5 Produtos Mais Vendidos (Barras Horizontais)
  const elTopProd = document.querySelector("#chart-top-produtos-vendas");
  if (elTopProd) {
    const top5 = metrics.topProdutos.slice(0, 5);
    vendasCharts.topProdutos = new ApexCharts(elTopProd, {
      chart: {
        type: "bar",
        height: 280,
        toolbar: { show: false },
        fontFamily: "Inter, sans-serif",
      },
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 3,
          barHeight: "55%",
        },
      },
      series: [
        {
          name: "Faturamento",
          data: top5.map((p) => p.faturamento),
        },
      ],
      xaxis: {
        categories: top5.map((p) => p.sku),
        labels: { formatter: (val) => money(val) },
      },
      colors: ["#e85c2a"],
      dataLabels: { enabled: false },
      tooltip: {
        y: {
          formatter: (val, opts) => {
            const item = top5[opts.dataPointIndex];
            return `${money(val)} (${item ? item.quantidade : 0} un.)`;
          },
        },
      },
    });
    vendasCharts.topProdutos.render();
  }

  // Gráfico 4: Faturamento por Categoria (Donut/Pie)
  const elCat = document.querySelector("#chart-vendas-categoria");
  if (elCat) {
    vendasCharts.categorias = new ApexCharts(elCat, {
      chart: {
        type: "donut",
        height: 280,
        fontFamily: "Inter, sans-serif",
      },
      series: metrics.categorias.map((c) => c.faturamento),
      labels: metrics.categorias.map((c) => `${c.categoria} (${c.quantidade} un)`),
      colors: ["#e85c2a", "#1a1412", "#6b6560", "#f5e6c8"],
      legend: { position: "bottom" },
      dataLabels: { enabled: false },
      tooltip: {
        y: { formatter: (val) => money(val) },
      },
      stroke: { show: false },
    });
    vendasCharts.categorias.render();
  }

  // Gráfico 5: Status dos Pedidos
  const elStatus = document.querySelector("#chart-vendas-status");
  if (elStatus) {
    vendasCharts.status = new ApexCharts(elStatus, {
      chart: {
        type: "bar",
        height: 280,
        toolbar: { show: false },
        fontFamily: "Inter, sans-serif",
      },
      plotOptions: {
        bar: {
          distributed: true,
          columnWidth: "48%",
          borderRadius: 4,
        },
      },
      series: [
        {
          name: "Pedidos",
          data: [
            metrics.statusCount["Entregue"] || 0,
            metrics.statusCount["Em trânsito"] || 0,
            metrics.statusCount["Aprovado"] || 0,
            metrics.statusCount["Cancelado"] || 0,
          ],
        },
      ],
      xaxis: {
        categories: ["Entregues", "Em Trânsito", "Aprovados", "Cancelados"],
      },
      colors: ["#1f9d5c", "#1d68bd", "#f59e0b", "#d13c3c"],
      legend: { show: false },
      dataLabels: { enabled: true, style: { fontSize: "11px", fontWeight: "bold" } },
      tooltip: {
        y: { formatter: (val) => `${val} pedidos` },
      },
    });
    vendasCharts.status.render();
  }

  // Gráfico 6: Geografia de Vendas (Top Estados)
  const elGeo = document.querySelector("#chart-vendas-geografia");
  if (elGeo) {
    const topUfs = metrics.ufs.slice(0, 6);
    vendasCharts.geografia = new ApexCharts(elGeo, {
      chart: {
        type: "bar",
        height: 280,
        toolbar: { show: false },
        fontFamily: "Inter, sans-serif",
      },
      plotOptions: {
        bar: {
          columnWidth: "50%",
          borderRadius: 3,
        },
      },
      series: [
        {
          name: "Faturamento",
          data: topUfs.map((u) => u.faturamento),
        },
      ],
      xaxis: {
        categories: topUfs.map((u) => u.uf),
      },
      colors: ["#1a1412"],
      dataLabels: { enabled: false },
      yaxis: {
        labels: { formatter: (val) => money(val) },
      },
      tooltip: {
        y: {
          formatter: (val, opts) => {
            const u = topUfs[opts.dataPointIndex];
            return `${money(val)} (${u ? u.pedidos : 0} pedidos)`;
          },
        },
      },
    });
    vendasCharts.geografia.render();
  }

  // 2. Renderiza a Tabela de Pedidos Recentes
  const labelTabela = document.getElementById("label-total-pedidos-tabela");
  if (labelTabela) {
    labelTabela.textContent = `${metrics.recentOrders.length} pedidos encontrados`;
  }

  const tbody = document.getElementById("lista-pedidos-vendas");
  if (tbody) {
    if (metrics.recentOrders.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="7">Nenhum pedido encontrado para o período e canal selecionados.</td>
        </tr>
      `;
    } else {
      tbody.innerHTML = metrics.recentOrders
        .slice(0, 15) // Exibe os 15 mais recentes
        .map((p) => {
          const isML = p.canal === "Mercado Livre";
          const canalBadge = isML
            ? `<span class="badge-channel ml">Mercado Livre</span>`
            : `<span class="badge-channel direto">Venda Direta</span>`;

          let statusClass = "entregue";
          if (p.status === "Em trânsito") statusClass = "transito";
          else if (p.status === "Aprovado") statusClass = "aprovado";
          else if (p.status === "Cancelado") statusClass = "cancelado";

          const statusBadge = `<span class="badge-order-status ${statusClass}">${p.status}</span>`;

          const itensResumo = (p.itens || [])
            .map((i) => `<strong>${i.quantidade}x</strong> ${i.sku}`)
            .join(", ");

          return `
            <tr>
              <td>
                <button type="button" class="btn-ver-pedido text-left bg-transparent border-0 p-0 cursor-pointer group" data-codigo="${p.codigo_pedido}">
                  <span class="sku-main group-hover:text-amber-600 underline decoration-stone-300 underline-offset-2">${p.codigo_pedido}</span>
                  <span class="sku-sub">${p.tipo_envio || "Envio Padrão"}</span>
                </button>
              </td>
              <td>
                <span class="text-xs text-stone-700 font-medium">${formatDateTime(p.data_pedido)}</span>
              </td>
              <td>${canalBadge}</td>
              <td>
                <div class="prod-name text-xs">${p.cliente}</div>
                <div class="text-xs text-stone-400 font-medium">${p.uf}</div>
              </td>
              <td class="text-xs text-stone-600">${itensResumo}</td>
              <td>
                <span class="font-bold text-stone-800">${money(p.valor_total)}</span>
              </td>
              <td>${statusBadge}</td>
              <td style="text-align: right;">
                <a href="movimentacoes.html?busca=${encodeURIComponent(p.codigo_pedido)}" class="btn-ghost" style="padding: 4px 10px; font-size: 0.75rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" title="Ver movimentações de estoque deste pedido">
                  <span>Estoque</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </a>
              </td>
            </tr>
          `;
        })
        .join("");

      // Vincula botões de detalhes do pedido
      tbody.querySelectorAll(".btn-ver-pedido").forEach((btn) => {
        btn.addEventListener("click", () => {
          const cod = btn.dataset.codigo;
          const order = orders.find((o) => o.codigo_pedido === cod);
          if (order) openOrderDetailsModal(order);
        });
      });
    }
  }
}

function openOrderDetailsModal(order) {
  const modal = document.getElementById("modal-detalhes-pedido");
  const titulo = document.getElementById("modal-pedido-titulo");
  const conteudo = document.getElementById("modal-pedido-conteudo");
  const money = RezFireData.formatMoney;

  if (!modal || !conteudo) return;

  titulo.textContent = `Pedido: ${order.codigo_pedido}`;

  const isML = order.canal === "Mercado Livre";
  const canalBadge = isML
    ? `<span class="badge-channel ml">Mercado Livre (${order.tipo_envio || "Full"})</span>`
    : `<span class="badge-channel direto">Venda Direta / B2B</span>`;

  let statusClass = "entregue";
  if (order.status === "Em trânsito") statusClass = "transito";
  else if (order.status === "Aprovado") statusClass = "aprovado";
  else if (order.status === "Cancelado") statusClass = "cancelado";

  conteudo.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div style="background:#faf7f3; border:1px solid #ebe4db; border-radius:12px; padding:14px 16px; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
        <div>
          <span style="font-size:0.7rem; font-weight:700; color:#6b6560; text-transform:uppercase;">Canal de Venda</span>
          <div style="margin-top:4px;">${canalBadge}</div>
        </div>
        <div>
          <span style="font-size:0.7rem; font-weight:700; color:#6b6560; text-transform:uppercase;">Cliente / Destino</span>
          <div style="font-size:0.85rem; font-weight:700; color:#1a1412; margin-top:2px;">${order.cliente}</div>
          <div style="font-size:0.75rem; color:#6b6560;">Estado: ${order.uf}</div>
        </div>
        <div>
          <span style="font-size:0.7rem; font-weight:700; color:#6b6560; text-transform:uppercase;">Data da Venda</span>
          <div style="font-size:0.85rem; font-weight:600; color:#1a1412; margin-top:2px;">${formatDateTime(order.data_pedido)}</div>
        </div>
        <div>
          <span style="font-size:0.7rem; font-weight:700; color:#6b6560; text-transform:uppercase;">Status</span>
          <div style="margin-top:4px;"><span class="badge-order-status ${statusClass}">${order.status}</span></div>
        </div>
      </div>

      <div>
        <h4 style="margin:0 0 8px; font-size:0.85rem; font-weight:700; color:#1a1412;">Itens e Extintores deste Pedido</h4>
        <div class="table-wrap" style="border:1px solid #ebe4db; border-radius:10px;">
          <table class="products-table" style="font-size:0.82rem;">
            <thead>
              <tr style="background:#fcfbf9;">
                <th>ITEM / PRODUTO</th>
                <th>CATEGORIA</th>
                <th>QTD</th>
                <th>VALOR UNIT.</th>
                <th>SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${(order.itens || []).map((it) => `
                <tr>
                  <td>
                    <strong>${it.sku}</strong>
                    <div style="font-size:0.75rem; color:#6b6560;">${it.nome}</div>
                  </td>
                  <td><span class="text-xs text-stone-500">${it.categoria || "Geral"}</span></td>
                  <td><strong>${it.quantidade} un.</strong></td>
                  <td>${money(it.preco_unitario)}</td>
                  <td><strong>${money(it.subtotal)}</strong></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; border-top:1px solid #ebe4db; padding-top:14px; flex-wrap:wrap; gap:12px;">
        <div style="font-size:0.85rem;">
          <span style="color:#6b6560;">Total Faturado:</span> <strong style="font-size:1.15rem; color:#1a1412;">${money(order.valor_total)}</strong>
          ${order.lucro_bruto ? `<span style="font-size:0.75rem; color:#1f9d5c; margin-left:8px;">(Lucro estimado: ${money(order.lucro_bruto)})</span>` : ""}
        </div>
        <div style="display:flex; gap:8px;">
          <a href="movimentacoes.html?busca=${encodeURIComponent(order.codigo_pedido)}" class="btn-primary" style="text-decoration:none; font-size:0.82rem; padding:8px 14px; display:inline-flex; align-items:center; gap:6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3v18"/><path d="m21 7-4-4-4 4"/><path d="M7 21V3"/><path d="m3 17 4 4 4-4"/></svg>
            Ver Baixa de Estoque
          </a>
        </div>
      </div>
    </div>
  `;

  modal.classList.add("is-open");
}

function bindOrderModalEvents() {
  const modal = document.getElementById("modal-detalhes-pedido");
  const btnFechar = document.getElementById("btn-fechar-modal-pedido");
  if (btnFechar && modal) {
    btnFechar.addEventListener("click", () => modal.classList.remove("is-open"));
    modal.addEventListener("click", (e) => {
      if (e.target.id === "modal-detalhes-pedido") modal.classList.remove("is-open");
    });
  }

  // Sincronização em tempo real entre abas do navegador
  window.addEventListener("storage", (e) => {
    if (e.key === "rezfire.pedidos" || e.key === "rezfire.movimentacoes" || e.key === "rezfire.produtos") {
      const products = RezFireData.loadProducts();
      renderTabVendas(products);
    }
  });
}

function setupSalesFilters(products) {
  const selectPeriodo = document.getElementById("filtro-vendas-periodo");
  const selectCanal = document.getElementById("filtro-vendas-canal");

  if (selectPeriodo && !selectPeriodo.dataset.bound) {
    selectPeriodo.dataset.bound = "true";
    selectPeriodo.addEventListener("change", () => renderTabVendas(products));
  }

  if (selectCanal && !selectCanal.dataset.bound) {
    selectCanal.dataset.bound = "true";
    selectCanal.addEventListener("change", () => renderTabVendas(products));
  }
}

function bindTabs() {
  document.querySelectorAll(".dash-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".dash-tab").forEach((b) => b.classList.remove("is-active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("is-active"));

      btn.classList.add("is-active");
      const targetContent = document.getElementById(`tab-${btn.dataset.tab}`);
      if (targetContent) {
        targetContent.classList.add("is-active");
      }

      // Redimensiona ApexCharts após transição de abas para manter layout responsivo e nítido
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 50);
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
