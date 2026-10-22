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
  renderTabEstoque(products);
  setupStockFilters(products);
  renderTabFinanceiro(products);
  setupFinancialFilters(products);
  renderTabProdutos(products);
  bindTabs();
  bindOrderModalEvents();
  bindStockModalEvents();
  bindFinancialRatesModalEvents();
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
      renderTabEstoque(products);
      renderTabFinanceiro(products);
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Armazenamento de instâncias dos gráficos da aba Estoque para destruição limpa
let estoqueCharts = {};

function filtrarRiscoEstoque(risco) {
  const selectRisco = document.getElementById("filtro-estoque-risco");
  if (selectRisco) {
    selectRisco.value = risco;
    const products = RezFireData.loadProducts();
    renderTabEstoque(products);
  }
}
window.filtrarRiscoEstoque = filtrarRiscoEstoque;

function renderTabEstoque(products) {
  const money = RezFireData.formatMoney;

  const selectCategoria = document.getElementById("filtro-estoque-categoria");
  const selectRisco = document.getElementById("filtro-estoque-risco");
  const inputBusca = document.getElementById("busca-estoque-tabela");

  const catFilter = selectCategoria ? selectCategoria.value : "todos";
  const riscoFilter = selectRisco ? selectRisco.value : "todos";
  const queryBusca = inputBusca ? inputBusca.value.trim().toLowerCase() : "";

  const metrics = RezFireData.computeStockDashboardMetrics(products, catFilter, riscoFilter);

  // 1. Renderiza Banner de Alertas Críticos Operacionais
  const bannerEl = document.getElementById("alerta-estoque-banner");
  if (bannerEl) {
    if (metrics.skusRuptura.length > 0) {
      bannerEl.className = "stock-alert-banner";
      const primeiroZerado = metrics.skusRuptura[0];
      bannerEl.innerHTML = `
        <div class="flex items-start justify-between flex-wrap gap-3">
          <div class="flex items-start gap-3">
            <span style="font-size: 1.5rem; line-height: 1;">🚨</span>
            <div>
              <h3 style="margin: 0; font-size: 0.96rem; font-weight: 800; color: #991b1b; letter-spacing: -0.01em;">
                ALERTA OPERACIONAL: ${metrics.skusRuptura.length} SKU(s) EM RUPTURA TOTAL DE ESTOQUE
              </h3>
              <p style="margin: 4px 0 0; font-size: 0.83rem; color: #7f1d1d; line-height: 1.4;">
                O produto <strong>${primeiroZerado.sku} - ${primeiroZerado.nome}</strong> está com saldo ZERO, causando pausa imediata de vendas no Mercado Livre. 
                Além disso, existem <strong>${metrics.skusCriticos.length} produto(s)</strong> abaixo do estoque mínimo de segurança.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button class="replenish-btn" type="button" onclick="filtrarRiscoEstoque('ruptura')">
              Filtrar Zerado (${metrics.skusRuptura.length})
            </button>
            <button class="replenish-btn" type="button" onclick="filtrarRiscoEstoque('critico')">
              Filtrar Críticos (${metrics.skusCriticos.length})
            </button>
            <button class="btn-ghost" type="button" style="padding: 4px 10px; font-size: 0.75rem;" onclick="filtrarRiscoEstoque('todos')">
              Ver Todos
            </button>
          </div>
        </div>
      `;
    } else if (metrics.skusCriticos.length > 0) {
      bannerEl.className = "stock-alert-banner warning-only";
      bannerEl.innerHTML = `
        <div class="flex items-start justify-between flex-wrap gap-3">
          <div class="flex items-start gap-3">
            <span style="font-size: 1.5rem; line-height: 1;">⚠️</span>
            <div>
              <h3 style="margin: 0; font-size: 0.96rem; font-weight: 800; color: #9a3412;">
                PONTO DE REPOSIÇÃO: ${metrics.skusCriticos.length} PRODUTOS ABAIXO DO MÍNIMO
              </h3>
              <p style="margin: 4px 0 0; font-size: 0.83rem; color: #7c2d12; line-height: 1.4;">
                Produtos com saldo inferior à margem de segurança recomendada. Ação necessária para evitar esgotamento nos próximos 7 a 15 dias.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button class="replenish-btn" type="button" onclick="filtrarRiscoEstoque('critico')">
              Ver Produtos Críticos (${metrics.skusCriticos.length})
            </button>
            <button class="btn-ghost" type="button" style="padding: 4px 10px; font-size: 0.75rem;" onclick="filtrarRiscoEstoque('todos')">
              Ver Todos
            </button>
          </div>
        </div>
      `;
    } else {
      bannerEl.className = "stock-alert-banner all-ok";
      bannerEl.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-3">
            <span style="font-size: 1.4rem; line-height: 1;">✅</span>
            <div>
              <h3 style="margin: 0; font-size: 0.94rem; font-weight: 700; color: #166534;">
                ESTOQUE EM NÍVEL OPERACIONAL SAUDÁVEL
              </h3>
              <p style="margin: 2px 0 0; font-size: 0.82rem; color: #14532d;">
                Nenhum produto em ruptura. Todos os extintores atendem à cobertura de segurança para os canais de venda.
              </p>
            </div>
          </div>
          <button class="btn-ghost" type="button" style="padding: 4px 10px; font-size: 0.75rem;" onclick="filtrarRiscoEstoque('todos')">
            Atualizar
          </button>
        </div>
      `;
    }
  }

  // 2. Renderiza Grade de KPIs de Estoque
  const kpiEl = document.getElementById("kpis-tab-estoque");
  if (kpiEl) {
    const rupturaClass = Number(metrics.taxaRuptura) > 0 ? "kpi-delta down" : "kpi-delta up";
    const abaixoClass = metrics.totalAbaixoMinimo > 0 ? "kpi-delta down" : "kpi-delta up";

    kpiEl.innerHTML = [
      kpiCard(
        "SALDO FÍSICO TOTAL",
        metrics.quantidadeTotal.toLocaleString("pt-BR") + " un.",
        "em produtos ativos e monitorados"
      ),
      kpiCard(
        "VALOR EM CUSTO (IMOBILIZADO)",
        money(metrics.valorTotalCusto),
        "capital de giro alocado no armazém"
      ),
      kpiCard(
        "POTENCIAL DE VENDA",
        money(metrics.valorTotalVenda),
        `Margem projetada: ${metrics.margemProjetada}%`
      ),
      kpiCard(
        "TAXA DE RUPTURA (STOCKOUT)",
        metrics.taxaRuptura + "%",
        `<span class="${rupturaClass}">${metrics.skusRuptura.length} SKU zerado</span> no catálogo`
      ),
      kpiCard(
        "ABAIXO DO PONTO DE PEDIDO",
        metrics.totalAbaixoMinimo + " SKUs",
        `<span class="${abaixoClass}">${metrics.skusCriticos.length} críticos</span> + ${metrics.skusRuptura.length} zerado`
      ),
      kpiCard(
        "COBERTURA MÉDIA GLOBAL",
        `${metrics.coberturaMedia} dias`,
        "autonomia estimada de vendas"
      ),
      kpiCard(
        "GIRO DE ESTOQUE",
        metrics.giroEstoque,
        "ao ano (velocidade de rotação)"
      ),
      kpiCard(
        "ACURÁCIA DE INVENTÁRIO",
        metrics.acuraciaInventario,
        `<span class="kpi-delta up">▲ 0.4%</span> conformidade física`
      ),
    ].join("");
  }

  // 3. Destruir instâncias antigas dos gráficos de estoque
  Object.keys(estoqueCharts).forEach((k) => {
    if (estoqueCharts[k]) {
      try {
        estoqueCharts[k].destroy();
      } catch (e) {}
    }
  });
  estoqueCharts = {};

  // Ordena itens para gráficos: primeiro os de maior risco (ruptura e críticos) para visibilidade imediata
  const sortedItems = [...metrics.allItems].sort((a, b) => {
    const score = { ruptura: 0, critico: 1, atencao: 2, normal: 3, excesso: 4 };
    const diff = (score[a.risco] ?? 3) - (score[b.risco] ?? 3);
    if (diff !== 0) return diff;
    return a.quantidade_atual - b.quantidade_atual;
  });

  // Gráfico 1: Saldo Físico vs Estoque Mínimo por Produto (Barra Agrupada)
  const elSaldoMin = document.querySelector("#chart-estoque-saldo-minimo");
  if (elSaldoMin) {
    const topItems = sortedItems.slice(0, 10);
    estoqueCharts.saldoMin = new ApexCharts(elSaldoMin, {
      chart: {
        type: "bar",
        height: 290,
        toolbar: { show: false },
        fontFamily: "Inter, sans-serif",
      },
      series: [
        {
          name: "Saldo Físico Atual",
          data: topItems.map((p) => p.quantidade_atual),
        },
        {
          name: "Estoque Mínimo (Segurança)",
          data: topItems.map((p) => p.estoque_minimo),
        },
      ],
      colors: ["#e85c2a", "#1a1412"],
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: "48%",
          borderRadius: 3,
        },
      },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ["transparent"] },
      xaxis: {
        categories: topItems.map((p) => p.sku),
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        title: { text: "Unidades", style: { fontSize: "11px", color: "#6b6560" } },
        labels: { formatter: (val) => Math.round(val).toLocaleString("pt-BR") },
      },
      tooltip: {
        y: { formatter: (val) => `${val.toLocaleString("pt-BR")} un.` },
      },
      legend: { position: "bottom" },
    });
    estoqueCharts.saldoMin.render();
  }

  // Gráfico 2: Diagnóstico da Saúde do Catálogo (Donut)
  const elSaude = document.querySelector("#chart-estoque-saude");
  if (elSaude) {
    const d = metrics.distribuicaoSaude;
    const seriesValues = [d.ruptura, d.critico, d.atencao, d.normal, d.excesso];
    const seriesLabels = [
      `Ruptura / Zerado (${d.ruptura})`,
      `Abaixo do Mínimo (${d.critico})`,
      `Ponto de Atenção (${d.atencao})`,
      `Estoque Seguro (${d.normal})`,
      `Excesso / Sem Giro (${d.excesso})`,
    ];

    estoqueCharts.saude = new ApexCharts(elSaude, {
      chart: {
        type: "donut",
        height: 290,
        fontFamily: "Inter, sans-serif",
      },
      series: seriesValues,
      labels: seriesLabels,
      colors: ["#e24b4b", "#ea580c", "#f59e0b", "#1f9d5c", "#0284c7"],
      dataLabels: {
        enabled: true,
        formatter: (val) => (val > 0 ? `${Math.round(val)}%` : ""),
      },
      legend: { position: "bottom" },
      stroke: { show: false },
      tooltip: {
        y: { formatter: (val) => `${val} SKU(s)` },
      },
    });
    estoqueCharts.saude.render();
  }

  // Gráfico 3: Cobertura / Autonomia Estimada em Dias (Barra Horizontal)
  const elCobertura = document.querySelector("#chart-estoque-cobertura");
  if (elCobertura) {
    const topCobertura = [...metrics.allItems]
      .filter((p) => p.ativo)
      .sort((a, b) => a.dias_cobertura - b.dias_cobertura)
      .slice(0, 8);

    estoqueCharts.cobertura = new ApexCharts(elCobertura, {
      chart: {
        type: "bar",
        height: 290,
        toolbar: { show: false },
        fontFamily: "Inter, sans-serif",
      },
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: "52%",
          borderRadius: 3,
          distributed: true,
        },
      },
      colors: topCobertura.map((p) =>
        p.dias_cobertura <= 0 ? "#e24b4b" : p.dias_cobertura <= 15 ? "#ea580c" : p.dias_cobertura <= 30 ? "#f59e0b" : "#1f9d5c"
      ),
      series: [
        {
          name: "Autonomia Estimada",
          data: topCobertura.map((p) => Math.min(p.dias_cobertura, 120)),
        },
      ],
      xaxis: {
        categories: topCobertura.map((p) => p.sku),
        labels: { formatter: (val) => `${val} dias` },
      },
      annotations: {
        xaxis: [
          {
            x: 15,
            borderColor: "#e24b4b",
            strokeDashArray: 4,
            label: {
              borderColor: "#e24b4b",
              style: { color: "#fff", background: "#e24b4b", fontSize: "10px", fontWeight: 700 },
              text: "Mínimo Seguro (15 d)",
            },
          },
        ],
      },
      dataLabels: {
        enabled: true,
        formatter: (val, opt) => {
          const item = topCobertura[opt.dataPointIndex];
          return item.dias_cobertura <= 0 ? "0 d (Ruptura)" : `${item.dias_cobertura} dias`;
        },
        style: { fontSize: "11px", fontWeight: "700" },
      },
      legend: { show: false },
      tooltip: {
        y: { formatter: (val, opt) => `${topCobertura[opt.dataPointIndex].dias_cobertura} dias de vendas restantes` },
      },
    });
    estoqueCharts.cobertura.render();
  }

  // Gráfico 4: Capital Imobilizado por Categoria
  const elCategoria = document.querySelector("#chart-estoque-categoria");
  if (elCategoria) {
    const catData = metrics.capitalPorCategoria;
    estoqueCharts.categoria = new ApexCharts(elCategoria, {
      chart: {
        type: "donut",
        height: 290,
        fontFamily: "Inter, sans-serif",
      },
      series: catData.map((c) => c.valorCusto),
      labels: catData.map((c) => `${c.nome} (${money(c.valorCusto)})`),
      colors: ["#e85c2a", "#1a1412", "#6b6560", "#d97706"],
      legend: { position: "bottom" },
      stroke: { show: false },
      dataLabels: {
        enabled: true,
        formatter: (val) => `${Math.round(val)}%`,
      },
      tooltip: {
        y: { formatter: (val) => money(val) },
      },
    });
    estoqueCharts.categoria.render();
  }

  // 4. Renderiza Tabela Detalhada de Estoque
  let tableRows = metrics.items;
  if (queryBusca) {
    tableRows = tableRows.filter(
      (p) =>
        p.sku.toLowerCase().includes(queryBusca) ||
        p.nome.toLowerCase().includes(queryBusca) ||
        p.categoria_detalhada.toLowerCase().includes(queryBusca)
    );
  }

  const labelCount = document.getElementById("label-total-estoque-tabela");
  if (labelCount) {
    labelCount.textContent = `${tableRows.length} de ${metrics.allItems.length} produtos`;
  }

  const tbody = document.getElementById("lista-estoque-detalhada");
  if (tbody) {
    if (tableRows.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="9">Nenhum produto encontrado com os filtros selecionados.</td></tr>`;
      return;
    }

    tbody.innerHTML = tableRows
      .map((p) => {
        let coberturaPill = `<span class="coverage-pill safe">${p.dias_cobertura} d</span>`;
        if (p.dias_cobertura <= 0) {
          coberturaPill = `<span class="coverage-pill danger">0 dias (Ruptura)</span>`;
        } else if (p.dias_cobertura <= 15) {
          coberturaPill = `<span class="coverage-pill danger">${p.dias_cobertura} dias</span>`;
        } else if (p.dias_cobertura <= 30) {
          coberturaPill = `<span class="coverage-pill warning">${p.dias_cobertura} dias</span>`;
        }

        const sugestaoHtml =
          p.sugestao_qtd > 0
            ? `<div style="font-size:0.82rem; font-weight:700; color:#ea580c;">+${p.sugestao_qtd} un. <span style="font-size:0.72rem; color:#6b6560; font-weight:500;">(${money(p.custo_reposicao)})</span></div>`
            : `<span style="font-size:0.78rem; color:#166534; font-weight:600;">✓ Estoque Seguro</span>`;

        return `
          <tr>
            <td>
              <span class="sku-main">${escapeHtml(p.sku)}</span>
              <div style="font-size:0.75rem; color:#6b6560; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.nome)}</div>
            </td>
            <td>
              <span class="text-xs text-stone-500 font-medium">${p.categoria_detalhada}</span>
            </td>
            <td>
              <span class="saldo-chip ${p.chip_class}">${p.quantidade_atual} un.</span>
            </td>
            <td>
              <strong style="color:#1a1412;">${p.estoque_minimo} un.</strong>
            </td>
            <td>
              <span class="badge-stock ${p.risco}">${p.risco_label}</span>
            </td>
            <td>
              <div style="font-size:0.82rem; font-weight:600; color:#1a1412;">~${p.media_mensal} un./mês</div>
              <div style="font-size:0.72rem; color:#6b6560;">(${p.media_diaria.toFixed(1)}/dia)</div>
            </td>
            <td>${coberturaPill}</td>
            <td>${sugestaoHtml}</td>
            <td style="text-align: right;">
              <button class="replenish-btn" type="button" data-ajuste-id="${p.id_produto}" title="Ajustar saldo ou estoque mínimo">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                Ajustar
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }
}

function setupStockFilters(products) {
  const selectCategoria = document.getElementById("filtro-estoque-categoria");
  const selectRisco = document.getElementById("filtro-estoque-risco");
  const inputBusca = document.getElementById("busca-estoque-tabela");

  if (selectCategoria && !selectCategoria.dataset.bound) {
    selectCategoria.dataset.bound = "true";
    selectCategoria.addEventListener("change", () => {
      const currentProducts = RezFireData.loadProducts();
      renderTabEstoque(currentProducts);
    });
  }

  if (selectRisco && !selectRisco.dataset.bound) {
    selectRisco.dataset.bound = "true";
    selectRisco.addEventListener("change", () => {
      const currentProducts = RezFireData.loadProducts();
      renderTabEstoque(currentProducts);
    });
  }

  if (inputBusca && !inputBusca.dataset.bound) {
    inputBusca.dataset.bound = "true";
    inputBusca.addEventListener("input", () => {
      const currentProducts = RezFireData.loadProducts();
      renderTabEstoque(currentProducts);
    });
  }
}

function bindStockModalEvents() {
  const modal = document.getElementById("modal-ajuste-estoque");
  const btnFechar = document.getElementById("btn-fechar-modal-ajuste");
  const btnCancelar = document.getElementById("btn-cancelar-ajuste");
  const formAjuste = document.getElementById("form-ajuste-estoque");

  function fechar() {
    if (modal) modal.classList.remove("is-open");
  }

  if (btnFechar) btnFechar.addEventListener("click", fechar);
  if (btnCancelar) btnCancelar.addEventListener("click", fechar);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target.id === "modal-ajuste-estoque") fechar();
    });
  }

  // Delegar clique no botão Ajustar da tabela
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ajuste-id]");
    if (btn) {
      const id = Number(btn.getAttribute("data-ajuste-id"));
      const products = RezFireData.loadProducts();
      const product = products.find((p) => p.id_produto === id);
      if (product && modal) {
        document.getElementById("ajuste_id_produto").value = product.id_produto;
        document.getElementById("ajuste_quantidade_atual").value = product.quantidade_atual;
        document.getElementById("ajuste_estoque_minimo").value = product.estoque_minimo;
        document.getElementById("modal-ajuste-subtitulo").textContent = `${product.sku} - ${product.nome}`;
        document.getElementById("ajuste-form-error").textContent = "";
        modal.classList.add("is-open");
        document.getElementById("ajuste_quantidade_atual").focus();
      }
    }
  });

  if (formAjuste && !formAjuste.dataset.bound) {
    formAjuste.dataset.bound = "true";
    formAjuste.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = Number(document.getElementById("ajuste_id_produto").value);
      const qtdAtual = Number(document.getElementById("ajuste_quantidade_atual").value);
      const estqMin = Number(document.getElementById("ajuste_estoque_minimo").value);

      if (!Number.isInteger(qtdAtual) || qtdAtual < 0) {
        document.getElementById("ajuste-form-error").textContent = "Quantidade atual deve ser um inteiro maior ou igual a zero.";
        return;
      }
      if (!Number.isInteger(estqMin) || estqMin < 0) {
        document.getElementById("ajuste-form-error").textContent = "Estoque mínimo deve ser um inteiro maior ou igual a zero.";
        return;
      }

      let products = RezFireData.loadProducts();
      products = products.map((p) =>
        p.id_produto === id ? { ...p, quantidade_atual: qtdAtual, estoque_minimo: estqMin } : p
      );
      RezFireData.saveProducts(products);
      fechar();

      // Atualiza os dashboards imediatamente
      renderTabEstoque(products);
      renderTabVendas(products);
    });
  }
}

function bindTabs() {
  function activateTab(tabName) {
    const btn = document.querySelector(`.dash-tab[data-tab="${tabName}"]`);
    const targetContent = document.getElementById(`tab-${tabName}`);
    if (btn && targetContent) {
      document.querySelectorAll(".dash-tab").forEach((b) => b.classList.remove("is-active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
      targetContent.classList.add("is-active");

      // Redimensiona ApexCharts após transição de abas para manter layout responsivo e nítido
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 50);
    }
  }

  document.querySelectorAll(".dash-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activateTab(btn.dataset.tab);
    });
  });

  // Suporte a parâmetro na URL: ex: dashboard.html?tab=estoque ou ?tab=financeiro
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab");
  if (initialTab) {
    activateTab(initialTab);
  }
}

// Armazenamento de instâncias dos gráficos da aba Financeiro para destruição limpa
let financeiroCharts = {};

function filtrarMargemFinanceiro(risco) {
  const selectMargem = document.getElementById("filtro-financeiro-margem");
  if (selectMargem) {
    selectMargem.value = risco;
    const products = RezFireData.loadProducts();
    renderTabFinanceiro(products);
  }
}
window.filtrarMargemFinanceiro = filtrarMargemFinanceiro;

function renderTabFinanceiro(products) {
  const money = RezFireData.formatMoney;
  const orders = RezFireData.loadOrders();

  const selectPeriodo = document.getElementById("filtro-financeiro-periodo");
  const selectCanal = document.getElementById("filtro-financeiro-canal");
  const selectMargem = document.getElementById("filtro-financeiro-margem");
  const inputBusca = document.getElementById("busca-financeiro-tabela");

  const filterDays = selectPeriodo ? Number(selectPeriodo.value) : 30;
  const filterChannel = selectCanal ? selectCanal.value : "todos";
  const filterMarginRisk = selectMargem ? selectMargem.value : "todos";
  const queryBusca = inputBusca ? inputBusca.value.trim().toLowerCase() : "";

  const metrics = RezFireData.computeFinancialDashboardMetrics(
    products,
    orders,
    filterDays,
    filterChannel,
    filterMarginRisk
  );

  // 1. Renderiza Banner de Alertas e Riscos Financeiros
  const bannerEl = document.getElementById("alerta-financeiro-banner");
  if (bannerEl) {
    if (metrics.skusRiscoMargem.length > 0) {
      bannerEl.className = "financial-alert-banner";
      bannerEl.innerHTML = `
        <div class="flex items-start justify-between flex-wrap gap-3">
          <div class="flex items-start gap-3">
            <span style="font-size: 1.5rem; line-height: 1;">⚠️</span>
            <div>
              <h3 style="margin: 0; font-size: 0.96rem; font-weight: 800; color: #9a3412;">
                AVISO DE RISCO FINANCEIRO: COMPRESSÃO DE MARGEM & CUSTO DE CARREGAMENTO
              </h3>
              <p style="margin: 4px 0 0; font-size: 0.83rem; color: #7c2d12; line-height: 1.4;">
                Identificados <strong>${metrics.skusRiscoMargem.length} produtos com margem bruta em risco (&lt; 40%)</strong>, onde taxas do Mercado Livre (~16%) e fretes podem gerar margem líquida inferior a 15%.
                O capital imobilizado de <strong>${money(metrics.valorEstoqueAtivo)}</strong> acarreta um <strong>Custo de Carregamento estimado em ${money(metrics.custoCarregamentoMes)}/mês</strong> (${money(metrics.custoCarregamentoAno)}/ano a 25% a.a.).
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button class="replenish-btn" type="button" onclick="filtrarMargemFinanceiro('low')">
              Filtrar ${metrics.skusRiscoMargem.length} em Risco
            </button>
            <button class="replenish-btn" type="button" onclick="filtrarMargemFinanceiro('high')">
              Ver Alta Margem
            </button>
            <button class="btn-ghost" type="button" style="padding: 4px 10px; font-size: 0.75rem;" onclick="filtrarMargemFinanceiro('todos')">
              Ver Todos
            </button>
          </div>
        </div>
      `;
    } else {
      bannerEl.className = "financial-alert-banner safe";
      bannerEl.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-3">
            <span style="font-size: 1.4rem; line-height: 1;">✅</span>
            <div>
              <h3 style="margin: 0; font-size: 0.94rem; font-weight: 700; color: #166534;">
                EQUILÍBRIO FINANCEIRO & MARGENS ESTÁVEIS
              </h3>
              <p style="margin: 2px 0 0; font-size: 0.82rem; color: #14532d;">
                Todos os produtos ativos operam com margens brutas seguras acima de 40%, cobrindo com folga custos operacionais e comissões.
              </p>
            </div>
          </div>
          <button class="btn-ghost" type="button" style="padding: 4px 10px; font-size: 0.75rem;" onclick="filtrarMargemFinanceiro('todos')">
            Atualizar
          </button>
        </div>
      `;
    }
  }

  // 2. Renderiza Grade de KPIs Financeiros
  const kpiEl = document.getElementById("kpis-tab-financeiro");
  if (kpiEl) {
    const deltaClass = metrics.deltaFaturamento >= 0 ? "kpi-delta up" : "kpi-delta down";
    const deltaSign = metrics.deltaFaturamento >= 0 ? "+" : "";

    kpiEl.innerHTML = [
      kpiCard(
        "FATURAMENTO BRUTO",
        money(metrics.faturamentoTotal),
        `<span class="${deltaClass}">${deltaSign}${metrics.deltaFaturamento}%</span> vs período anterior`
      ),
      kpiCard(
        "CMV (CUSTO DAS MERCADORIAS)",
        money(metrics.cmvTotal),
        "custo de aquisição dos extintores vendidos"
      ),
      kpiCard(
        "LUCRO BRUTO OPERACIONAL",
        money(metrics.lucroBruto),
        "receita bruta total - CMV total"
      ),
      kpiCard(
        "MARGEM BRUTA MÉDIA",
        `${metrics.margemBrutaPercentual}%`,
        "rentabilidade bruta média da RezFire"
      ),
      kpiCard(
        "COMISSÕES DE CANAIS",
        money(metrics.taxasCanaisTotal),
        `ML: ${metrics.taxaMlPercent}% | Direto: ${metrics.taxaDiretoPercent}%`
      ),
      kpiCard(
        "LUCRO LÍQUIDO CONTRIBUIÇÃO",
        money(metrics.lucroLiquidoContribuicao),
        `Margem líquida real: ${metrics.margemLiquidaContribuicao}%`
      ),
      kpiCard(
        "CUSTO DE CARREGAMENTO (25% a.a.)",
        money(metrics.custoCarregamentoAno),
        `~${money(metrics.custoCarregamentoMes)}/mês sobre estoque ativo`
      ),
      kpiCard(
        "GMROI (RETORNO S/ INVENTÁRIO)",
        `${metrics.gmroi}%`,
        "retorno de lucro por R$ imobilizado"
      ),
    ].join("");
  }

  // 3. Destruir gráficos anteriores da aba Financeiro
  Object.keys(financeiroCharts).forEach((k) => {
    if (financeiroCharts[k]) {
      try {
        financeiroCharts[k].destroy();
      } catch (e) {}
    }
  });
  financeiroCharts = {};

  // Gráfico 1: Evolução Mensal (Receita x CMV x Lucro Bruto)
  const elTimeline = document.querySelector("#chart-financeiro-timeline");
  if (elTimeline) {
    const timeline = metrics.timeline;
    financeiroCharts.timeline = new ApexCharts(elTimeline, {
      chart: {
        height: 290,
        type: "line",
        toolbar: { show: false },
        fontFamily: "Inter, sans-serif",
      },
      series: [
        {
          name: "Receita Bruta (R$)",
          type: "area",
          data: timeline.map((t) => t.receita),
        },
        {
          name: "Custo CMV (R$)",
          type: "line",
          data: timeline.map((t) => t.cmv),
        },
        {
          name: "Lucro Bruto (R$)",
          type: "line",
          data: timeline.map((t) => t.lucro),
        },
      ],
      colors: ["#e85c2a", "#1a1412", "#1f9d5c"],
      fill: {
        type: ["gradient", "solid", "solid"],
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.35,
          opacityTo: 0.05,
          stops: [0, 95, 100],
        },
      },
      stroke: {
        width: [3, 2.5, 2.5],
        curve: "smooth",
      },
      xaxis: {
        categories: timeline.map((t) => t.mes),
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: { formatter: (val) => money(val) },
      },
      tooltip: {
        shared: true,
        y: [{ formatter: (val) => money(val) }, { formatter: (val) => money(val) }, { formatter: (val) => money(val) }],
      },
      legend: { position: "bottom" },
    });
    financeiroCharts.timeline.render();
  }

  // Gráfico 2: Decomposição da Receita Bruta (DRE Simplificado)
  const elDRE = document.querySelector("#chart-financeiro-dre");
  if (elDRE) {
    const total = metrics.faturamentoTotal;
    const seriesValues = total > 0 ? [metrics.cmvTotal, metrics.taxasCanaisTotal, Math.max(0, metrics.lucroLiquidoContribuicao)] : [1, 0, 0];
    const seriesLabels = ["Custo das Mercadorias (CMV)", "Comissões & Taxas ML", "Margem Líquida Real"];

    financeiroCharts.dre = new ApexCharts(elDRE, {
      chart: {
        type: "donut",
        height: 290,
        fontFamily: "Inter, sans-serif",
      },
      series: seriesValues,
      labels: seriesLabels,
      colors: ["#1a1412", "#e85c2a", "#1f9d5c"],
      dataLabels: {
        enabled: true,
        formatter: (val) => `${Math.round(val)}%`,
      },
      legend: { position: "bottom" },
      stroke: { show: false },
      tooltip: {
        y: { formatter: (val) => money(val) },
      },
    });
    financeiroCharts.dre.render();
  }

  // Gráfico 3: Margem Bruta por Extintor / Equipamento (%)
  const elMargens = document.querySelector("#chart-financeiro-margens-produto");
  if (elMargens) {
    const sortedProds = [...metrics.allItems].sort((a, b) => b.margem_unit_pct - a.margem_unit_pct);
    financeiroCharts.margens = new ApexCharts(elMargens, {
      chart: {
        type: "bar",
        height: 290,
        toolbar: { show: false },
        fontFamily: "Inter, sans-serif",
      },
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: "55%",
          borderRadius: 3,
          distributed: true,
        },
      },
      colors: sortedProds.map((p) => (p.margem_unit_pct >= 50 ? "#16a34a" : p.margem_unit_pct >= 40 ? "#e85c2a" : "#dc2626")),
      series: [
        {
          name: "Margem Bruta (%)",
          data: sortedProds.map((p) => p.margem_unit_pct),
        },
      ],
      xaxis: {
        categories: sortedProds.map((p) => p.sku),
        labels: { formatter: (val) => `${val}%` },
      },
      annotations: {
        xaxis: [
          {
            x: 40,
            borderColor: "#ea580c",
            strokeDashArray: 4,
            label: {
              borderColor: "#ea580c",
              style: { color: "#fff", background: "#ea580c", fontSize: "10px", fontWeight: 700 },
              text: "Margem Segura (40%)",
            },
          },
        ],
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => `${val.toFixed(1)}%`,
        style: { fontSize: "11px", fontWeight: "700" },
      },
      legend: { show: false },
      tooltip: {
        y: { formatter: (val, opt) => `${val.toFixed(1)}% (Preço: ${money(sortedProds[opt.dataPointIndex].preco_unitario)} | Custo: ${money(sortedProds[opt.dataPointIndex].custo_unitario)})` },
      },
    });
    financeiroCharts.margens.render();
  }

  // Gráfico 4: Curva ABC Financeira (Faturamento e Concentração)
  const elABC = document.querySelector("#chart-financeiro-curva-abc");
  if (elABC) {
    const c = metrics.curvaABC;
    const totalABC = c.fatA + c.fatB + c.fatC;
    const seriesValues = totalABC > 0 ? [c.fatA, c.fatB, c.fatC] : [70, 20, 10];

    financeiroCharts.abc = new ApexCharts(elABC, {
      chart: {
        type: "donut",
        height: 290,
        fontFamily: "Inter, sans-serif",
      },
      series: seriesValues,
      labels: [
        `Classe A (${c.countA} SKUs - 70% Fat.)`,
        `Classe B (${c.countB} SKUs - 20% Fat.)`,
        `Classe C (${c.countC} SKUs - 10% Fat.)`,
      ],
      colors: ["#e85c2a", "#d97706", "#1a1412"],
      dataLabels: {
        enabled: true,
        formatter: (val) => `${Math.round(val)}%`,
      },
      legend: { position: "bottom" },
      stroke: { show: false },
      tooltip: {
        y: { formatter: (val) => money(val) },
      },
    });
    financeiroCharts.abc.render();
  }

  // Gráfico 5: Rentabilidade por Canal (Mercado Livre vs Venda Direta)
  const elCanais = document.querySelector("#chart-financeiro-canais");
  if (elCanais) {
    financeiroCharts.canais = new ApexCharts(elCanais, {
      chart: {
        type: "bar",
        height: 260,
        toolbar: { show: false },
        fontFamily: "Inter, sans-serif",
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: "42%",
          borderRadius: 3,
        },
      },
      series: [
        {
          name: "Faturamento Bruto",
          data: [metrics.faturamentoML, metrics.faturamentoDireto],
        },
        {
          name: "Comissões & Taxas",
          data: [metrics.taxasML, metrics.taxasDireto],
        },
        {
          name: "Lucro Líquido Real",
          data: [metrics.lucroLiquidoML, metrics.lucroLiquidoDireto],
        },
      ],
      colors: ["#e85c2a", "#dc2626", "#1f9d5c"],
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ["transparent"] },
      xaxis: {
        categories: ["Mercado Livre (Full & Flex)", "Venda Direta / B2B"],
      },
      yaxis: {
        labels: { formatter: (val) => money(val) },
      },
      tooltip: {
        y: { formatter: (val) => money(val) },
      },
      legend: { position: "bottom" },
    });
    financeiroCharts.canais.render();
  }

  // 4. Renderiza Tabela de Diagnóstico Financeiro
  let tableRows = metrics.items;
  if (queryBusca) {
    tableRows = tableRows.filter(
      (p) =>
        p.sku.toLowerCase().includes(queryBusca) ||
        p.nome.toLowerCase().includes(queryBusca)
    );
  }

  const labelCount = document.getElementById("label-total-financeiro-tabela");
  if (labelCount) {
    labelCount.textContent = `${tableRows.length} de ${metrics.allItems.length} produtos`;
  }

  const tbody = document.getElementById("lista-financeiro-produtos");
  if (tbody) {
    if (tableRows.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="9">Nenhum produto encontrado com os filtros selecionados.</td></tr>`;
      return;
    }

    tbody.innerHTML = tableRows
      .map((p) => {
        const miniBarWidth = Math.min(100, Math.round(p.margem_unit_pct));
        return `
          <tr>
            <td>
              <span class="sku-main">${escapeHtml(p.sku)}</span>
              <div style="font-size:0.75rem; color:#6b6560; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.nome)}</div>
            </td>
            <td><strong>${money(p.preco_unitario)}</strong></td>
            <td><span class="text-stone-600">${money(p.custo_unitario)}</span></td>
            <td><strong style="color:#1f9d5c;">+${money(p.margem_unit_rs)}</strong></td>
            <td>
              <div class="mini-margin-bar-container">
                <div class="mini-margin-bar ${p.risco_badge_class}" style="width: ${miniBarWidth}%;"></div>
              </div>
              <strong style="font-size:0.85rem;">${p.margem_unit_pct.toFixed(1)}%</strong>
            </td>
            <td>
              <div>${money(p.faturamento_periodo)}</div>
              <div style="font-size:0.72rem; color:#6b6560;">${p.share_receita}% do faturamento</div>
            </td>
            <td>
              <strong style="color:#1a1412;">${money(p.lucro_periodo)}</strong>
            </td>
            <td>
              <span class="badge-margin ${p.risco_badge_class}">${p.risco_margem_label}</span>
            </td>
            <td style="text-align: right;">
              <span style="font-size: 0.78rem; font-weight: 600; color: #4b5563;">${p.diagnostico}</span>
            </td>
          </tr>
        `;
      })
      .join("");
  }
}

function setupFinancialFilters(products) {
  const selectPeriodo = document.getElementById("filtro-financeiro-periodo");
  const selectCanal = document.getElementById("filtro-financeiro-canal");
  const selectMargem = document.getElementById("filtro-financeiro-margem");
  const inputBusca = document.getElementById("busca-financeiro-tabela");

  if (selectPeriodo && !selectPeriodo.dataset.bound) {
    selectPeriodo.dataset.bound = "true";
    selectPeriodo.addEventListener("change", () => {
      const currentProducts = RezFireData.loadProducts();
      renderTabFinanceiro(currentProducts);
    });
  }

  if (selectCanal && !selectCanal.dataset.bound) {
    selectCanal.dataset.bound = "true";
    selectCanal.addEventListener("change", () => {
      const currentProducts = RezFireData.loadProducts();
      renderTabFinanceiro(currentProducts);
    });
  }

  if (selectMargem && !selectMargem.dataset.bound) {
    selectMargem.dataset.bound = "true";
    selectMargem.addEventListener("change", () => {
      const currentProducts = RezFireData.loadProducts();
      renderTabFinanceiro(currentProducts);
    });
  }

  if (inputBusca && !inputBusca.dataset.bound) {
    inputBusca.dataset.bound = "true";
    inputBusca.addEventListener("input", () => {
      const currentProducts = RezFireData.loadProducts();
      renderTabFinanceiro(currentProducts);
    });
  }
}

function bindFinancialRatesModalEvents() {
  const modal = document.getElementById("modal-config-taxas");
  const btnAbrir = document.getElementById("btn-abrir-config-taxas");
  const btnFechar = document.getElementById("btn-fechar-modal-taxas");
  const btnCancelar = document.getElementById("btn-cancelar-taxas");
  const formTaxas = document.getElementById("form-config-taxas");

  function fechar() {
    if (modal) modal.classList.remove("is-open");
  }

  function abrir() {
    if (!modal) return;
    const settings = RezFireData.loadFinancialSettings();
    document.getElementById("config_taxa_ml").value = settings.taxa_ml_percent;
    document.getElementById("config_taxa_direto").value = settings.taxa_direto_percent;
    document.getElementById("taxas-form-error").textContent = "";
    modal.classList.add("is-open");
    document.getElementById("config_taxa_ml").focus();
  }

  if (btnAbrir) btnAbrir.addEventListener("click", abrir);
  if (btnFechar) btnFechar.addEventListener("click", fechar);
  if (btnCancelar) btnCancelar.addEventListener("click", fechar);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target.id === "modal-config-taxas") fechar();
    });
  }

  if (formTaxas && !formTaxas.dataset.bound) {
    formTaxas.dataset.bound = "true";
    formTaxas.addEventListener("submit", (e) => {
      e.preventDefault();
      const taxaMl = parseFloat(document.getElementById("config_taxa_ml").value);
      const taxaDireto = parseFloat(document.getElementById("config_taxa_direto").value);

      if (isNaN(taxaMl) || taxaMl < 0 || taxaMl > 100) {
        document.getElementById("taxas-form-error").textContent = "A taxa do Mercado Livre deve ser um número entre 0% e 100%.";
        return;
      }
      if (isNaN(taxaDireto) || taxaDireto < 0 || taxaDireto > 100) {
        document.getElementById("taxas-form-error").textContent = "A taxa das vendas diretas deve ser um número entre 0% e 100%.";
        return;
      }

      RezFireData.saveFinancialSettings({
        taxa_ml_percent: taxaMl,
        taxa_direto_percent: taxaDireto,
      });

      fechar();

      // Recalcula o dashboard financeiro imediatamente com as novas taxas
      const products = RezFireData.loadProducts();
      renderTabFinanceiro(products);
    });
  }
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
