function kpiCard(label, value, hint) {
  return `
    <article class="card kpi-card">
      <p class="kpi-label">${label}</p>
      <p class="kpi-value">${value}</p>
      ${hint ? `<p class="kpi-hint">${hint}</p>` : ""}
    </article>
  `;
}
window.kpiCard = kpiCard;

async function renderDashboard() {
  RezFireLayout.renderSidebar("dashboard");

  let products = RezFireData.loadProducts();

  renderTabVendas(products);
  setupSalesFilters(products);
  renderTabEstoque(products);
  setupStockFilters(products);
  renderTabML();
  setupMLFilters();
  renderTabFinanceiro(products);
  setupFinancialFilters(products);
  renderTabProdutos(products);
  if (typeof renderTabEntregas === "function") {
    renderTabEntregas();
    setupDeliveryFilters();
  }
  setupCustomerFilters();
  setupPurchaseFilters();
  setupReturnFilters();
  bindTabs();
  bindOrderModalEvents();
  bindStockModalEvents();
  bindFinancialRatesModalEvents();
  bindLancamentosFinanceirosModalEvents();
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
            metrics.statusCount["Confirmado"] || 0,
            metrics.statusCount["Concluido"] || 0,
            metrics.statusCount["Cancelado"] || 0,
          ],
        },
      ],
      xaxis: {
        categories: ["Confirmados", "Concluídos", "Cancelados"],
      },
      colors: ["#1d68bd", "#1f9d5c", "#d13c3c"],
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

          let statusClass = "concluido";
          if (p.status === "Confirmado") statusClass = "confirmado";
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

  let statusClass = "concluido";
  if (order.status === "Confirmado") statusClass = "confirmado";
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

      if (tabName === "ml") {
        renderTabML();
      } else if (tabName === "clientes") {
        renderTabClientes();
      } else if (tabName === "compras") {
        renderTabCompras();
      } else if (tabName === "devolucoes") {
        renderTabDevolucoes();
      } else if (tabName === "fiscal") {
        renderTabFiscal();
      }

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
  if (initialTab && initialTab !== "visao-geral") {
    activateTab(initialTab);
  }
}

// ─── ABA 4: MERCADO LIVRE & QUEDAS DE ANÚNCIOS (#17 / SCRUM-25) ──────────────
let mlCharts = {};

function setupMLFilters() {
  const selectPeriodo = document.getElementById("filtro-ml-periodo");
  const btnRecarregar = document.getElementById("btn-recarregar-impacto-quedas");

  selectPeriodo?.addEventListener("change", () => renderTabML());
  btnRecarregar?.addEventListener("click", () => renderTabML());
}

async function renderTabML(dias = 30) {
  const money = RezFireData.formatMoney;
  const selectPeriodo = document.getElementById("filtro-ml-periodo");
  const kpisContainer = document.getElementById("kpis-tab-ml");
  const chartCruzadoEl = document.querySelector("#chart-faturamento-quedas-ml");
  const chartMotivosEl = document.querySelector("#chart-motivos-quedas-ml");
  const tbodyRanking = document.getElementById("tbody-ranking-anuncios-quedas");
  const resumoTextoEl = document.getElementById("resumo-impacto-texto");

  const filterDays = selectPeriodo ? Number(selectPeriodo.value) : dias;

  let dados = null;
  if (window.RezFireAPI?.dashboard?.obterImpactoQuedas) {
    try {
      const res = await window.RezFireAPI.dashboard.obterImpactoQuedas(filterDays);
      if (res && res.sucesso) {
        dados = res;
      }
    } catch (e) {
      console.warn("[Dashboard ML] Falha ao carregar impacto de quedas via API:", e);
    }
  }

  // Fallback analítico se API não estiver acessível
  if (!dados) {
    dados = gerarFallbackImpactoQuedas(filterDays);
  }

  const { kpis, timeline_cruzada, ranking_anuncios, distribuicao_motivos } = dados;

  // 1. Resumo no Banner
  if (resumoTextoEl) {
    resumoTextoEl.innerHTML = `
      <span>Impacto na Receita: <strong style="color:var(--down);font-size:1.05rem">${kpis.impacto_percentual_receita}%</strong></span>
      <div style="font-size:0.75rem;font-weight:500;color:#92400e;margin-top:2px">
        Perda estimada: <strong>${money(kpis.faturamento_perdido_total)}</strong> em ${kpis.total_eventos_quedas} queda(s)
      </div>
    `;
  }

  // 2. KPIs de Impacto Financeiro
  if (kpisContainer) {
    kpisContainer.innerHTML = [
      kpiCard("FATURAMENTO REALIZADO", money(kpis.faturamento_realizado_total), `Vendas confirmadas nos últimos ${filterDays} dias`),
      kpiCard("FATURAMENTO CESSANTE", money(kpis.faturamento_perdido_total), `Perda estimada por pausas e rebaixamentos`),
      kpiCard("FATURAMENTO POTENCIAL", money(kpis.faturamento_potencial_total), `Receita sem interrupções operacionais`),
      kpiCard("IMPACTO PERCENTUAL", `${kpis.impacto_percentual_receita}%`, `Proporção de receita perdida`),
      kpiCard("ANÚNCIOS ATIVOS / PAUSADOS", `${kpis.anuncios_ativos_atualmente} / ${kpis.anuncios_pausados_atualmente}`, `${kpis.total_dias_anuncio_indisponivel} dias inativos acumulados`),
    ].join("");
  }

  // 3. Gráfico Misto: Faturamento Real x Perda por Quedas de Anúncio
  if (chartCruzadoEl) {
    if (mlCharts.faturamentoQuedas) {
      mlCharts.faturamentoQuedas.destroy();
    }

    const categories = (timeline_cruzada || []).map((t) => t.dia_formatado);
    const seriesFaturamentoReal = (timeline_cruzada || []).map((t) => t.faturamento_real);
    const seriesPotencial = (timeline_cruzada || []).map((t) => t.faturamento_potencial);
    const seriesPausados = (timeline_cruzada || []).map((t) => t.anuncios_pausados_count);

    const optionsCruzado = {
      chart: {
        height: 340,
        type: "line",
        stacked: false,
        fontFamily: "Inter, sans-serif",
        toolbar: { show: false },
      },
      stroke: {
        width: [3, 2, 0],
        curve: "smooth",
        dashArray: [0, 5, 0],
      },
      plotOptions: {
        bar: {
          columnWidth: "40%",
          borderRadius: 4,
        },
      },
      colors: ["#10b981", "#3b82f6", "#ef4444"],
      series: [
        {
          name: "Faturamento Real (R$)",
          type: "area",
          data: seriesFaturamentoReal,
        },
        {
          name: "Potencial sem Quedas (R$)",
          type: "line",
          data: seriesPotencial,
        },
        {
          name: "Anúncios Pausados no Dia (Qtd)",
          type: "column",
          data: seriesPausados,
        },
      ],
      fill: {
        opacity: [0.15, 1, 0.75],
        gradient: {
          inverseColors: false,
          shade: "light",
          type: "vertical",
          opacityFrom: 0.35,
          opacityTo: 0.05,
          stops: [0, 100],
        },
      },
      labels: categories,
      xaxis: {
        type: "category",
        labels: {
          style: { colors: "#6b6560", fontSize: "11px" },
          rotate: -45,
        },
      },
      yaxis: [
        {
          seriesName: "Faturamento Real (R$)",
          title: {
            text: "Receita (R$)",
            style: { color: "#10b981", fontWeight: 700 },
          },
          labels: {
            formatter: (v) => money(v),
            style: { colors: "#6b6560", fontSize: "11px" },
          },
        },
        {
          seriesName: "Potencial sem Quedas (R$)",
          show: false,
        },
        {
          opposite: true,
          seriesName: "Anúncios Pausados no Dia (Qtd)",
          title: {
            text: "Quedas Ativas",
            style: { color: "#ef4444", fontWeight: 700 },
          },
          labels: {
            formatter: (v) => `${Math.round(v)} un`,
            style: { colors: "#ef4444", fontSize: "11px" },
          },
          min: 0,
        },
      ],
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: function (y, { seriesIndex }) {
            if (seriesIndex === 2) {
              return `${y} anúncio(s) inativo(s)`;
            }
            return money(y);
          },
        },
      },
      legend: {
        position: "top",
        horizontalAlign: "right",
      },
    };

    mlCharts.faturamentoQuedas = new ApexCharts(chartCruzadoEl, optionsCruzado);
    mlCharts.faturamentoQuedas.render();
  }

  // 4. Ranking de Anúncios com Maior Perda Estimada
  if (tbodyRanking) {
    if (!ranking_anuncios || ranking_anuncios.length === 0) {
      tbodyRanking.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">
            Nenhuma queda ou pausa de anúncio registrada no período analisado.
          </td>
        </tr>
      `;
    } else {
      tbodyRanking.innerHTML = ranking_anuncios.map((r) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 6px;">
            <strong style="color:var(--ink);display:block;font-size:0.84rem">${r.titulo}</strong>
            <span style="font-family:monospace;font-size:0.72rem;color:var(--muted)">${r.ml_item_id} · ${r.motivo_predominante}</span>
          </td>
          <td style="padding: 10px 6px; text-align: center; font-weight: 700; color: #b45309;">
            ${r.dias_pausado} d
          </td>
          <td style="padding: 10px 6px; text-align: right; font-weight: 800; color: var(--down);">
            - ${money(r.perda_estimada)}
          </td>
          <td style="padding: 10px 6px; font-size: 0.75rem; color: var(--ink);">
            <span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#fef2f2;color:#991b1b;font-weight:600">
              ${r.sugestao_acao}
            </span>
          </td>
        </tr>
      `).join("");
    }
  }

  // 5. Gráfico de Rosca / Donut: Causas Raiz das Quedas
  if (chartMotivosEl) {
    if (mlCharts.motivosQuedas) {
      mlCharts.motivosQuedas.destroy();
    }

    const labelsMotivos = (distribuicao_motivos && distribuicao_motivos.length > 0)
      ? distribuicao_motivos.map((m) => m.motivo)
      : ["Falta de Estoque FEFO", "Moderação ML", "Pausa Manual"];
    const seriesMotivos = (distribuicao_motivos && distribuicao_motivos.length > 0)
      ? distribuicao_motivos.map((m) => m.total_ocorrencias)
      : [4, 2, 1];

    const optionsMotivos = {
      chart: {
        type: "donut",
        height: 310,
        fontFamily: "Inter, sans-serif",
      },
      series: seriesMotivos,
      labels: labelsMotivos,
      colors: ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#6b7280"],
      dataLabels: { enabled: true, formatter: (val) => `${Number(val).toFixed(0)}%` },
      legend: { position: "bottom" },
      stroke: { show: false },
      tooltip: {
        y: {
          formatter: (val) => `${val} ocorrência(s)`,
        },
      },
    };

    mlCharts.motivosQuedas = new ApexCharts(chartMotivosEl, optionsMotivos);
    mlCharts.motivosQuedas.render();
  }
}

function gerarFallbackImpactoQuedas(filterDays = 30) {
  const orders = RezFireData.loadOrders();
  const cutoff = Date.now() - filterDays * 24 * 60 * 60 * 1000;
  const recentOrders = orders.filter((o) => new Date(o.data_pedido).getTime() >= cutoff && o.status !== "Cancelado");

  const timeline = [];
  let totalFat = 0;
  let totalPerda = 0;

  for (let i = filterDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];
    const diaFormatado = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

    const fatDia = recentOrders
      .filter((o) => o.data_pedido && o.data_pedido.startsWith(dateStr))
      .reduce((sum, o) => sum + Number(o.valor_total || 0), 0);

    // Simula impacto de pausa ocorrida há 12 a 15 dias atrás
    const estavaEmQueda = (i >= 12 && i <= 16);
    const countPausados = estavaEmQueda ? 2 : (i === 5 ? 1 : 0);
    const perdaDia = estavaEmQueda ? 380.00 : (i === 5 ? 190.00 : 0.00);

    totalFat += fatDia;
    totalPerda += perdaDia;

    timeline.push({
      data: dateStr,
      dia_formatado: diaFormatado,
      faturamento_real: fatDia,
      perda_estimada_quedas: perdaDia,
      faturamento_potencial: fatDia + perdaDia,
      anuncios_pausados_count: countPausados,
      quedas_ativas: estavaEmQueda ? ["Extintor ABC 4kg (Estoque FEFO)", "Extintor CO2 6kg (Moderação ML)"] : [],
    });
  }

  const potencialTotal = totalFat + totalPerda;
  const impactoPercentual = potencialTotal > 0 ? Number(((totalPerda / potencialTotal) * 100).toFixed(1)) : 0;

  return {
    sucesso: true,
    periodo_dias: filterDays,
    kpis: {
      faturamento_realizado_total: totalFat,
      faturamento_perdido_total: totalPerda,
      faturamento_potencial_total: potencialTotal,
      impacto_percentual_receita: impactoPercentual,
      total_eventos_quedas: 3,
      total_dias_anuncio_indisponivel: 6,
      anuncios_ativos_atualmente: 8,
      anuncios_pausados_atualmente: 1,
    },
    timeline_cruzada: timeline,
    ranking_anuncios: [
      {
        id_anuncio: 1,
        titulo: "Kit Extintor ABC 4kg + Suporte + Placa",
        ml_item_id: "MLB-1940281923",
        dias_pausado: 4,
        perda_estimada: 1240.00,
        motivo_predominante: "Pausa por Estoque FEFO",
        sugestao_acao: "Reabastecer lote FEFO de extintores e reativar anúncio imediatamente",
      },
      {
        id_anuncio: 2,
        titulo: "Extintor CO2 6kg Alta Pressão",
        ml_item_id: "MLB-2049182901",
        dias_pausado: 2,
        perda_estimada: 660.00,
        motivo_predominante: "Moderação ML (Certificação)",
        sugestao_acao: "Revisar atributos técnicos / certificação INMETRO perante o ML",
      },
    ],
    distribuicao_motivos: [
      { motivo: "Pausa por Estoque FEFO", total_ocorrencias: 2, percentual: 66.7 },
      { motivo: "Moderação do Mercado Livre", total_ocorrencias: 1, percentual: 33.3 },
    ],
  };
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

  // 5. Renderiza Segregação Patrimonial (SCRUM-29 · #25)
  renderSegregacaoPatrimonial();
}

function setupFinancialFilters(products) {
  const selectPeriodo = document.getElementById("filtro-financeiro-periodo");
  const selectCanal = document.getElementById("filtro-financeiro-canal");
  const selectMargem = document.getElementById("filtro-financeiro-margem");
  const selectClassificacao = document.getElementById("filtro-financeiro-classificacao");
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

  if (selectClassificacao && !selectClassificacao.dataset.bound) {
    selectClassificacao.dataset.bound = "true";
    selectClassificacao.addEventListener("change", () => {
      renderSegregacaoPatrimonial();
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

// ============================================================================
// SEGREGAÇÃO PATRIMONIAL & FINANÇAS EMPRESA X PESSOAL (SCRUM-29 · #25)
// ============================================================================

let segregacaoCharts = {};

async function renderSegregacaoPatrimonial() {
  const money = RezFireData.formatMoney;
  const selectPeriodo = document.getElementById("filtro-financeiro-periodo");
  const selectClassificacao = document.getElementById("filtro-financeiro-classificacao");

  const dias = selectPeriodo ? Number(selectPeriodo.value) : 30;
  const filtroClassificacao = selectClassificacao ? selectClassificacao.value : "todos";

  try {
    // 1. Busca relatório consolidado e lançamentos filtrados
    const [relatorio, lancamentos] = await Promise.all([
      window.RezFireAPI && window.RezFireAPI.financeiro
        ? window.RezFireAPI.financeiro.obterRelatorioSegregacao(dias)
        : Promise.resolve(null),
      window.RezFireAPI && window.RezFireAPI.financeiro
        ? window.RezFireAPI.financeiro.listar({
            classificacao: filtroClassificacao === "todos" ? undefined : filtroClassificacao,
            dias: dias,
          })
        : Promise.resolve([]),
    ]);

    if (!relatorio) {
      console.warn("Módulo RezFireAPI.financeiro indisponível ou em modo offline.");
      return;
    }

    // 2. Renderiza Grade de KPIs de Segregação Patrimonial
    const kpiEl = document.getElementById("kpis-segregacao-patrimonial");
    if (kpiEl) {
      const saldoEmpresa = relatorio.empresa.saldo;
      const saldoPessoal = relatorio.pessoal.saldo;
      const empresaColorClass = saldoEmpresa >= 0 ? "kpi-delta up" : "kpi-delta down";
      const pessoalColorClass = saldoPessoal >= 0 ? "kpi-delta up" : "kpi-delta down";

      kpiEl.innerHTML = `
        <div class="kpi-card" style="border-left: 4px solid #1e40af;">
          <div class="flex items-center justify-between">
            <span class="kpi-label" style="color: #1e40af; font-weight: 700;">🏢 EMPRESA (PESSOA JURÍDICA)</span>
            <span class="badge-tag" style="background: #dbeafe; color: #1e40af;">Simples Nacional</span>
          </div>
          <div class="kpi-value" style="color: #1e3a8a; margin-top: 6px;">
            ${money(saldoEmpresa)}
          </div>
          <div class="kpi-subtext" style="margin-top: 4px;">
            Receitas: <strong style="color: #15803d;">${money(relatorio.empresa.receitas)}</strong> | 
            Despesas: <strong style="color: #b91c1c;">${money(relatorio.empresa.despesas)}</strong>
          </div>
          <div class="${empresaColorClass}" style="margin-top: 6px; font-size: 0.75rem;">
            ${relatorio.empresa.total_lancamentos} lançamentos PJ registrados no período
          </div>
        </div>

        <div class="kpi-card" style="border-left: 4px solid #7c3aed;">
          <div class="flex items-center justify-between">
            <span class="kpi-label" style="color: #7c3aed; font-weight: 700;">👤 PESSOAL (PESSOA FÍSICA)</span>
            <span class="badge-tag" style="background: #ede9fe; color: #7c3aed;">Patrimônio Particular</span>
          </div>
          <div class="kpi-value" style="color: #5b21b6; margin-top: 6px;">
            ${money(saldoPessoal)}
          </div>
          <div class="kpi-subtext" style="margin-top: 4px;">
            Entradas/Pró-labore: <strong style="color: #15803d;">${money(relatorio.pessoal.receitas)}</strong> | 
            Gastos: <strong style="color: #b91c1c;">${money(relatorio.pessoal.despesas)}</strong>
          </div>
          <div class="${pessoalColorClass}" style="margin-top: 6px; font-size: 0.75rem;">
            ${relatorio.pessoal.total_lancamentos} lançamentos PF segregados da empresa
          </div>
        </div>

        <div class="kpi-card" style="border-left: 4px solid ${relatorio.indicador_segregacao.risco_confusao ? "#dc2626" : "#16a34a"};">
          <div class="flex items-center justify-between">
            <span class="kpi-label" style="color: #374151; font-weight: 700;">⚖️ ÍNDICE DE SEGREGAÇÃO FISCAL</span>
            <span class="badge-tag" style="background: ${relatorio.indicador_segregacao.risco_confusao ? "#fee2e2" : "#dcfce7"}; color: ${relatorio.indicador_segregacao.risco_confusao ? "#991b1b" : "#166534"}; font-weight: 700;">
              ${relatorio.indicador_segregacao.status}
            </span>
          </div>
          <div class="kpi-value" style="font-size: 1.15rem; color: #1f2937; margin-top: 8px;">
            ${relatorio.indicador_segregacao.taxa_segregacao_pct}% Lançamentos Classificados
          </div>
          <p style="margin: 4px 0 0; font-size: 0.78rem; color: #4b5563; line-height: 1.35;">
            ${relatorio.indicador_segregacao.mensagem}
          </p>
        </div>
      `;
    }

    // 3. Renderiza Gráficos ApexCharts de Segregação
    // Gráfico A: Comparativo de Receitas, Despesas e Saldo Líquido (Empresa vs Pessoal)
    const elComp = document.querySelector("#chart-segregacao-comparativo");
    if (elComp) {
      if (segregacaoCharts.comparativo) {
        segregacaoCharts.comparativo.destroy();
      }
      segregacaoCharts.comparativo = new ApexCharts(elComp, {
        chart: {
          type: "bar",
          height: 270,
          toolbar: { show: false },
          fontFamily: "Inter, sans-serif",
        },
        plotOptions: {
          bar: {
            horizontal: false,
            columnWidth: "46%",
            borderRadius: 3,
          },
        },
        series: [
          {
            name: "Receitas",
            data: [relatorio.empresa.receitas, relatorio.pessoal.receitas],
          },
          {
            name: "Despesas / Gastos",
            data: [relatorio.empresa.despesas, relatorio.pessoal.despesas],
          },
          {
            name: "Resultado / Saldo",
            data: [relatorio.empresa.saldo, relatorio.pessoal.saldo],
          },
        ],
        colors: ["#16a34a", "#dc2626", "#2563eb"],
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ["transparent"] },
        xaxis: {
          categories: ["Empresa (PJ)", "Pessoal (PF)"],
        },
        yaxis: {
          labels: { formatter: (val) => money(val) },
        },
        tooltip: {
          y: { formatter: (val) => money(val) },
        },
        legend: { position: "bottom" },
      });
      segregacaoCharts.comparativo.render();
    }

    // Gráfico B: Distribuição de Despesas (Empresa vs Pessoal)
    const elDist = document.querySelector("#chart-segregacao-distribuicao");
    if (elDist) {
      if (segregacaoCharts.distribuicao) {
        segregacaoCharts.distribuicao.destroy();
      }
      const despPJ = relatorio.empresa.despesas;
      const despPF = relatorio.pessoal.despesas;
      const totalDesp = despPJ + despPF;

      const seriesDesp = totalDesp > 0 ? [despPJ, despPF] : [1, 1];
      segregacaoCharts.distribuicao = new ApexCharts(elDist, {
        chart: {
          type: "donut",
          height: 270,
          fontFamily: "Inter, sans-serif",
        },
        series: seriesDesp,
        labels: [
          `Despesas da Empresa (${money(despPJ)})`,
          `Gastos Pessoais (${money(despPF)})`,
        ],
        colors: ["#1e40af", "#7c3aed"],
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
      segregacaoCharts.distribuicao.render();
    }

    // 4. Renderiza Tabela de Lançamentos Financeiros
    const labelCount = document.getElementById("label-total-lancamentos-financeiros");
    if (labelCount) {
      labelCount.textContent = `${lancamentos.length} lançamentos (${filtroClassificacao === "todos" ? "PJ e PF" : filtroClassificacao})`;
    }

    const tbody = document.getElementById("lista-lancamentos-financeiros");
    if (tbody) {
      if (lancamentos.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Nenhum lançamento financeiro encontrado com o filtro [${filtroClassificacao}].</td></tr>`;
        return;
      }

      tbody.innerHTML = lancamentos
        .map((l) => {
          const isEmpresa = l.classificacao === "Empresa";
          const isReceita = l.tipo === "Receita";
          const badgeEsfera = isEmpresa
            ? `<span class="badge-tag" style="background:#dbeafe; color:#1e40af; font-weight:700;">🏢 Empresa (PJ)</span>`
            : `<span class="badge-tag" style="background:#ede9fe; color:#6d28d9; font-weight:700;">👤 Pessoal (PF)</span>`;
          const badgeTipo = isReceita
            ? `<span class="badge-tag" style="background:#dcfce7; color:#166534; font-weight:700;">+ Receita</span>`
            : `<span class="badge-tag" style="background:#fee2e2; color:#991b1b; font-weight:700;">- Despesa</span>`;
          const valorFormatado = `${isReceita ? "+" : "-"}${money(l.valor)}`;
          const valorStyle = isReceita ? "color:#16a34a; font-weight:700;" : "color:#dc2626; font-weight:700;";
          const dataFmt = l.data_competencia ? l.data_competencia.split("T")[0] : "-";

          return `
            <tr>
              <td style="font-size:0.82rem; color:#4b5563;">${dataFmt}</td>
              <td>
                <div style="font-weight:600; color:#111827;">${escapeHtml(l.descricao)}</div>
                <div style="font-size:0.75rem; color:#6b7280;">${escapeHtml(l.observacoes || "")}</div>
              </td>
              <td>${badgeEsfera}</td>
              <td>${badgeTipo}</td>
              <td>
                <span class="badge-tag" style="background:#f3f4f6; color:#374151; font-size:0.75rem;">
                  ${escapeHtml(l.categoria || "Geral")}
                </span>
              </td>
              <td style="text-align: right; ${valorStyle}">
                ${valorFormatado}
              </td>
              <td style="text-align: right;">
                <button
                  type="button"
                  class="btn-ghost"
                  style="padding: 3px 8px; font-size: 0.72rem; color: #dc2626;"
                  onclick="excluirLancamentoFinanceiro(${l.id_lancamento})"
                  title="Excluir Lançamento"
                >
                  🗑️ Excluir
                </button>
              </td>
            </tr>
          `;
        })
        .join("");
    }
  } catch (err) {
    console.error("Erro ao carregar relatório de segregação patrimonial:", err);
  }
}

function bindLancamentosFinanceirosModalEvents() {
  const modal = document.getElementById("modal-lancamento-financeiro");
  const btnAbrir = document.getElementById("btn-abrir-lancamento-financeiro");
  const btnFechar = document.getElementById("btn-fechar-modal-lancamento");
  const btnCancelar = document.getElementById("btn-cancelar-lancamento");
  const form = document.getElementById("form-lancamento-financeiro");

  function fechar() {
    if (modal) modal.classList.remove("is-open");
  }

  function abrir() {
    if (!modal) return;
    const inputData = document.getElementById("lancamento_data");
    if (inputData && !inputData.value) {
      inputData.value = new Date().toISOString().split("T")[0];
    }
    const errEl = document.getElementById("lancamento-form-error");
    if (errEl) errEl.textContent = "";
    modal.classList.add("is-open");
    const desc = document.getElementById("lancamento_descricao");
    if (desc) desc.focus();
  }

  if (btnAbrir) btnAbrir.addEventListener("click", abrir);
  if (btnFechar) btnFechar.addEventListener("click", fechar);
  if (btnCancelar) btnCancelar.addEventListener("click", fechar);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target.id === "modal-lancamento-financeiro") fechar();
    });
  }

  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("lancamento-form-error");
      if (errEl) errEl.textContent = "";

      const tipo = document.getElementById("lancamento_tipo").value;
      const classificacao = document.getElementById("lancamento_classificacao").value;
      const descricao = document.getElementById("lancamento_descricao").value.trim();
      const valor = parseFloat(document.getElementById("lancamento_valor").value);
      const categoria = document.getElementById("lancamento_categoria").value.trim();
      const data_competencia = document.getElementById("lancamento_data").value;
      const observacoes = document.getElementById("lancamento_observacoes").value.trim();

      if (!descricao) {
        if (errEl) errEl.textContent = "A descrição do lançamento é obrigatória.";
        return;
      }
      if (isNaN(valor) || valor <= 0) {
        if (errEl) errEl.textContent = "O valor deve ser um número positivo maior que zero.";
        return;
      }
      if (!data_competencia) {
        if (errEl) errEl.textContent = "A data de competência é obrigatória.";
        return;
      }

      try {
        await window.RezFireAPI.financeiro.criar({
          tipo,
          classificacao,
          descricao,
          valor,
          categoria,
          data_competencia,
          observacoes,
        });

        // Limpa formulário e fecha
        form.reset();
        fechar();

        // Recarrega relatório de segregação
        renderSegregacaoPatrimonial();
      } catch (err) {
        console.error("Erro ao salvar lançamento financeiro:", err);
        if (errEl) {
          errEl.textContent = err.message || "Erro ao registrar lançamento financeiro.";
        }
      }
    });
  }
}

async function excluirLancamentoFinanceiro(id) {
  if (!confirm("Tem certeza que deseja excluir este lançamento financeiro?")) {
    return;
  }
  try {
    await window.RezFireAPI.financeiro.excluir(id);
    renderSegregacaoPatrimonial();
  } catch (err) {
    alert("Erro ao excluir lançamento: " + (err.message || err));
  }
}
window.excluirLancamentoFinanceiro = excluirLancamentoFinanceiro;

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

// ─── ABA 8: DASHBOARD DE CLIENTES (INDICADORES & SINAIS DE ATENÇÃO) ───────────
let clientesCharts = {};

function setupCustomerFilters() {
  const selectPeriodo = document.getElementById("filtro-clientes-periodo");
  const selectOrigem = document.getElementById("filtro-clientes-origem");
  const selectInativo = document.getElementById("filtro-clientes-dias-inativo");
  const btnRecarregar = document.getElementById("btn-recarregar-dash-clientes");
  const btnTentar = document.getElementById("btn-tentar-novamente-dash-clientes");

  if (selectPeriodo && !selectPeriodo.dataset.bound) {
    selectPeriodo.dataset.bound = "true";
    selectPeriodo.addEventListener("change", () => renderTabClientes());
  }

  if (selectOrigem && !selectOrigem.dataset.bound) {
    selectOrigem.dataset.bound = "true";
    selectOrigem.addEventListener("change", () => renderTabClientes());
  }

  if (selectInativo && !selectInativo.dataset.bound) {
    selectInativo.dataset.bound = "true";
    selectInativo.addEventListener("change", () => renderTabClientes());
  }

  if (btnRecarregar && !btnRecarregar.dataset.bound) {
    btnRecarregar.dataset.bound = "true";
    btnRecarregar.addEventListener("click", () => renderTabClientes());
  }

  if (btnTentar && !btnTentar.dataset.bound) {
    btnTentar.dataset.bound = "true";
    btnTentar.addEventListener("click", () => renderTabClientes());
  }
}

async function renderTabClientes() {
  const selectPeriodo = document.getElementById("filtro-clientes-periodo");
  const selectOrigem = document.getElementById("filtro-clientes-origem");
  const selectInativo = document.getElementById("filtro-clientes-dias-inativo");
  const erroContainer = document.getElementById("erro-dash-clientes");
  const msgErroEl = document.getElementById("mensagem-erro-dash-clientes");

  const dias = selectPeriodo ? Number(selectPeriodo.value) || 30 : 30;
  const source = selectOrigem ? selectOrigem.value : "ALL";
  const diasInativo = selectInativo ? Number(selectInativo.value) || 90 : 90;

  const money = (val) => {
    return Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  try {
    if (erroContainer) erroContainer.style.display = "none";

    let dados = null;

    if (window.RezFireAPI && window.RezFireAPI.dashboard && window.RezFireAPI.dashboard.customers) {
      try {
        const res = await window.RezFireAPI.dashboard.customers({
          dias,
          source,
          diasInativo,
        });
        if (res && res.sucesso) {
          dados = res;
        }
      } catch (apiErr) {
        console.warn("[Dashboard Clientes] API indisponível, avaliando fallback local:", apiErr);
      }
    }

    if (!dados) {
      // Fallback de contingência local estruturado com dados demonstrativos
      dados = gerarMetricasClientesFallback(dias, source, diasInativo);
    }

    renderKpisClientes(dados.kpis, money);
    renderAlertasClientes(dados.alertas || []);
    renderTabelaTopClientes(dados.graficos?.topClientesReceita || [], money);
    renderGraficosClientes(dados.graficos, money);

    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 150);
  } catch (err) {
    console.error("[Dashboard Clientes] Erro ao carregar aba:", err);
    if (erroContainer) {
      erroContainer.style.display = "block";
      if (msgErroEl) msgErroEl.textContent = err.message || "Erro desconhecido ao processar dados.";
    }
  }
}

function renderKpisClientes(kpis, money) {
  const container = document.getElementById("kpis-tab-clientes");
  if (!container || !kpis) return;

  const formatDelta = (delta, deltaSentidoBom, labelComp = "vs período anterior") => {
    if (typeof delta !== "number" || isNaN(delta)) return "";
    const isUp = deltaSentidoBom;
    const deltaClass = isUp ? "kpi-delta up" : "kpi-delta down";
    const sinal = delta > 0 ? "+" : "";
    return `<span class="${deltaClass}">${sinal}${delta}%</span> ${labelComp}`;
  };

  const totalBase = kpis.totalClientesBase || {};
  const novos = kpis.novosClientes || {};
  const ativos = kpis.clientesAtivos || {};
  const recorrencia = kpis.taxaRecorrencia || {};
  const ticket = kpis.ticketMedioCliente || {};
  const receita = kpis.receitaPorOrigem || {};
  const inativos = kpis.clientesInativos || {};

  container.innerHTML = [
    kpiCard(
      "TOTAL DE CLIENTES NA BASE",
      Number(totalBase.valor || 0).toLocaleString("pt-BR"),
      formatDelta(totalBase.deltaPercentual, totalBase.deltaSentidoBom),
      totalBase.tooltip
    ),
    kpiCard(
      "NOVOS CLIENTES NO PERÍODO",
      Number(novos.valor || 0).toLocaleString("pt-BR"),
      formatDelta(novos.deltaPercentual, novos.deltaSentidoBom),
      novos.tooltip
    ),
    kpiCard(
      "CLIENTES COMPRADORES ATIVOS",
      Number(ativos.valor || 0).toLocaleString("pt-BR"),
      formatDelta(ativos.deltaPercentual, ativos.deltaSentidoBom),
      ativos.tooltip
    ),
    kpiCard(
      "TAXA DE RECORRÊNCIA",
      `${Number(recorrencia.valor || 0).toFixed(1)}%`,
      formatDelta(recorrencia.deltaPercentual, recorrencia.deltaSentidoBom, "p.p. vs período ant."),
      recorrencia.tooltip
    ),
    kpiCard(
      "TICKET MÉDIO POR CLIENTE",
      money(ticket.valor),
      formatDelta(ticket.deltaPercentual, ticket.deltaSentidoBom),
      ticket.tooltip
    ),
    kpiCard(
      "PARTICIPAÇÃO POR ORIGEM",
      `${Number(receita.sharePresencial || 0).toFixed(0)}% / ${Number(receita.shareMercadoLivre || 0).toFixed(0)}%`,
      `<span style="color:#0284c7; font-weight:700;">Balcão:</span> ${money(receita.presencial)} • <span style="color:#e85c2a; font-weight:700;">ML:</span> ${money(receita.mercadoLivre)}`,
      receita.tooltip
    ),
    kpiCard(
      "CLIENTES INATIVOS",
      `${Number(inativos.valor || 0)} (${Number(inativos.taxaPercentual || 0).toFixed(1)}%)`,
      formatDelta(inativos.deltaPercentual, inativos.deltaSentidoBom, `sem compras há ${inativos.diasConfigurados || 90}d`),
      inativos.tooltip
    ),
  ].join("");
}

function renderAlertasClientes(alertas) {
  const container = document.getElementById("container-alertas-clientes");
  if (!container) return;

  if (!alertas || alertas.length === 0) {
    container.innerHTML = `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.2rem;">✅</span>
          <div>
            <span style="font-size: 0.84rem; font-weight: 700; color: #166534;">Saúde da Base Estável:</span>
            <span style="font-size: 0.8rem; color: #14532d; margin-left: 4px;">Nenhum sinal crítico de inatividade, queda abrupta de captação ou dependência excessiva identificado.</span>
          </div>
        </div>
        <a href="clientes.html" class="btn-ghost" style="padding: 4px 10px; font-size: 0.78rem; border-color: #86efac; color: #15803d; background: #fff; text-decoration: none;">
          Ver Clientes →
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = alertas
    .map((alerta) => {
      const isCritico = alerta.severidade === "critico";
      const bg = isCritico ? "#fef2f2" : "#fffbeb";
      const border = isCritico ? "#f87171" : "#f59e0b";
      const textTitle = isCritico ? "#991b1b" : "#92400e";
      const textDesc = isCritico ? "#7f1d1d" : "#78350f";
      const btnBorder = isCritico ? "#ef4444" : "#f59e0b";
      const btnColor = isCritico ? "#b91c1c" : "#b45309";
      const icon = isCritico ? "🛑" : "⚠️";

      return `
        <div style="background: ${bg}; border-left: 4px solid ${border}; border-top: 1px solid ${border}40; border-right: 1px solid ${border}40; border-bottom: 1px solid ${border}40; border-radius: 6px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
          <div style="display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 260px;">
            <span style="font-size: 1.1rem; line-height: 1.2;">${icon}</span>
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 0.82rem; font-weight: 800; color: ${textTitle};">${escapeHtml(alerta.titulo)}</span>
                <span style="font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${isCritico ? '#fee2e2' : '#fef3c7'}; color: ${textTitle}; text-transform: uppercase;">
                  ${isCritico ? 'Crítico' : 'Atenção'}
                </span>
                <span style="font-size: 0.72rem; color: #78716c;">(Limite: ${escapeHtml(String(alerta.limiteConfigurado))})</span>
              </div>
              <p style="margin: 3px 0 0; font-size: 0.79rem; color: ${textDesc}; line-height: 1.35;">
                ${escapeHtml(alerta.mensagem)}
              </p>
            </div>
          </div>
          ${
            alerta.acaoLink
              ? `
            <a href="${alerta.acaoLink}" class="btn-ghost" style="padding: 5px 12px; font-size: 0.78rem; border-color: ${btnBorder}; color: ${btnColor}; background: #fff; text-decoration: none; white-space: nowrap; font-weight: 600;">
              ${escapeHtml(alerta.acaoTexto || 'Verificar')} →
            </a>
          `
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function renderGraficosClientes(graficos, money) {
  if (!graficos) return;

  // 1. Destrói gráficos anteriores com segurança
  Object.keys(clientesCharts).forEach((key) => {
    if (clientesCharts[key]) {
      try {
        clientesCharts[key].destroy();
      } catch (e) {}
    }
  });
  clientesCharts = {};

  if (typeof ApexCharts === "undefined") {
    console.warn("[Dashboard Clientes] Biblioteca ApexCharts indisponível.");
    ["chart-novos-clientes-timeline", "chart-clientes-origem", "chart-clientes-novos-recorrentes", "chart-clientes-geo"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="padding:40px; text-align:center; color:#78716c; font-size:0.85rem;">Gráfico indisponível (ApexCharts não carregado).</div>';
    });
    return;
  }

  // ── Gráfico 1: Timeline de Novos Clientes por Origem ───────────────────────
  try {
    const elTimeline = document.querySelector("#chart-novos-clientes-timeline");
    if (elTimeline && graficos.timeline) {
      const categories = graficos.timeline.categories?.length > 0 ? graficos.timeline.categories : [];
      const presencial = graficos.timeline.presencial?.length > 0 ? graficos.timeline.presencial : [];
      const ml = graficos.timeline.mercadoLivre?.length > 0 ? graficos.timeline.mercadoLivre : [];

      const totalCadastros = presencial.reduce((a, b) => a + (Number(b) || 0), 0) + ml.reduce((a, b) => a + (Number(b) || 0), 0);

      if (totalCadastros === 0 || categories.length === 0) {
        elTimeline.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">📅</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Nenhum novo cadastro no período</span>
            <span style="font-size:0.76rem; color:#78716c;">Nenhum cliente presencial ou Mercado Livre foi cadastrado neste intervalo de datas.</span>
          </div>
        `;
      } else {
        elTimeline.innerHTML = "";
        clientesCharts.timeline = new ApexCharts(elTimeline, {
          chart: {
            height: 280,
            type: "bar",
            stacked: true,
            toolbar: { show: false },
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          series: [
            { name: "Presencial (Balcão)", data: presencial },
            { name: "Mercado Livre", data: ml },
          ],
          colors: ["#0284c7", "#e85c2a"],
          plotOptions: {
            bar: {
              horizontal: false,
              columnWidth: "45%",
              borderRadius: 3,
            },
          },
          grid: {
            borderColor: "#eee8e0",
            strokeDashArray: 0,
          },
          dataLabels: { enabled: false },
          xaxis: {
            type: "category",
            categories,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
              style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" },
            },
          },
          yaxis: {
            min: 0,
            forceNiceScale: true,
            labels: {
              style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" },
              formatter: (val) => Math.round(Number(val) || 0),
            },
          },
          legend: {
            position: "top",
            horizontalAlign: "right",
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
          },
          tooltip: {
            shared: true,
            intersect: false,
            y: { formatter: (val) => `${val || 0} novo(s) cliente(s)` },
          },
        });
        clientesCharts.timeline.render();
      }
    }
  } catch (errTimeline) {
    console.error("[Dashboard Clientes] Erro ao renderizar gráfico Timeline:", errTimeline);
  }

  // ── Gráfico 2: Distribuição por Canal (Origem) ─────────────────────────────
  try {
    const elOrigem = document.querySelector("#chart-clientes-origem");
    if (elOrigem && graficos.distribuicaoOrigem) {
      const rawSeries = graficos.distribuicaoOrigem.clientesSeries || [0, 0];
      const sum = (Number(rawSeries[0]) || 0) + (Number(rawSeries[1]) || 0);

      if (sum === 0) {
        elOrigem.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">🛒</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Sem movimentação de canais</span>
            <span style="font-size:0.76rem; color:#78716c;">Nenhuma compra por balcão ou Mercado Livre no intervalo.</span>
          </div>
        `;
      } else {
        const series = [Number(rawSeries[0]) || 0, Number(rawSeries[1]) || 0];
        const receitaSeries = graficos.distribuicaoOrigem.receitaSeries || [0, 0];
        const labels = graficos.distribuicaoOrigem.labels || ["Presencial (Balcão)", "Mercado Livre"];

        elOrigem.innerHTML = "";
        clientesCharts.origem = new ApexCharts(elOrigem, {
          chart: {
            height: 280,
            type: "donut",
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          series,
          labels,
          colors: ["#0284c7", "#e85c2a"],
          dataLabels: {
            enabled: true,
            formatter: (val) => `${Math.round(Number(val) || 0)}%`,
          },
          legend: { position: "bottom", fontFamily: "Inter, sans-serif", fontSize: "12px" },
          stroke: { show: false },
          tooltip: {
            y: {
              formatter: (val, opts) => {
                const idx = opts?.seriesIndex ?? -1;
                const rec = idx >= 0 && receitaSeries[idx] ? receitaSeries[idx] : 0;
                return `${val || 0} clientes (${money(rec)})`;
              },
            },
          },
        });
        clientesCharts.origem.render();
      }
    }
  } catch (errOrigem) {
    console.error("[Dashboard Clientes] Erro ao renderizar gráfico Origem:", errOrigem);
  }

  // ── Gráfico 3: Clientes Novos x Recorrentes ───────────────────────────────
  try {
    const elNovosRec = document.querySelector("#chart-clientes-novos-recorrentes");
    if (elNovosRec && graficos.novosVsRecorrentes) {
      const rawSeries = graficos.novosVsRecorrentes.series || [0, 0];
      const sum = (Number(rawSeries[0]) || 0) + (Number(rawSeries[1]) || 0);

      if (sum === 0) {
        elNovosRec.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">👥</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Sem compradores no período</span>
            <span style="font-size:0.76rem; color:#78716c;">Nenhum comprador novo ou recorrente no intervalo.</span>
          </div>
        `;
      } else {
        const series = [Number(rawSeries[0]) || 0, Number(rawSeries[1]) || 0];
        const labels = graficos.novosVsRecorrentes.labels || ["Novos Clientes", "Recorrentes (Recompra)"];

        elNovosRec.innerHTML = "";
        clientesCharts.novosRec = new ApexCharts(elNovosRec, {
          chart: {
            height: 280,
            type: "donut",
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          series,
          labels,
          colors: ["#10b981", "#1a1412"],
          dataLabels: {
            enabled: true,
            formatter: (val) => `${Math.round(Number(val) || 0)}%`,
          },
          legend: { position: "bottom", fontFamily: "Inter, sans-serif", fontSize: "12px" },
          stroke: { show: false },
          tooltip: {
            y: { formatter: (val) => `${val || 0} comprador(es)` },
          },
        });
        clientesCharts.novosRec.render();
      }
    }
  } catch (errNovosRec) {
    console.error("[Dashboard Clientes] Erro ao renderizar gráfico Novos x Recorrentes:", errNovosRec);
  }

  // ── Gráfico 4: Presença Geográfica (Top Estados) ──────────────────────────
  try {
    const elGeo = document.querySelector("#chart-clientes-geo");
    if (elGeo && graficos.distribuicaoGeografica) {
      const ufs = graficos.distribuicaoGeografica.ufs || [];

      if (ufs.length === 0) {
        elGeo.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">📍</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Sem dados geográficos no período</span>
            <span style="font-size:0.76rem; color:#78716c;">Nenhum cliente com estado (UF) registrado nas compras do período.</span>
          </div>
        `;
      } else {
        const categories = ufs.map((u) => u.uf || "—");
        const dataClientes = ufs.map((u) => Number(u.totalClientes) || 0);

        elGeo.innerHTML = "";
        clientesCharts.geo = new ApexCharts(elGeo, {
          chart: {
            height: 280,
            type: "bar",
            toolbar: { show: false },
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          plotOptions: {
            bar: {
              horizontal: true,
              barHeight: "50%",
              borderRadius: 3,
            },
          },
          grid: {
            borderColor: "#eee8e0",
            strokeDashArray: 0,
          },
          series: [
            { name: "Clientes Cadastrados", data: dataClientes },
          ],
          colors: ["#e85c2a"],
          dataLabels: { enabled: true },
          xaxis: {
            categories,
            labels: { formatter: (val) => Math.round(Number(val) || 0) },
          },
          tooltip: {
            y: {
              formatter: (val, opts) => {
                const idx = opts?.dataPointIndex ?? -1;
                const item = idx >= 0 && ufs[idx] ? ufs[idx] : null;
                return `${val || 0} clientes (${money(item ? item.receita : 0)})`;
              },
            },
          },
        });
        clientesCharts.geo.render();
      }
    }
  } catch (errGeo) {
    console.error("[Dashboard Clientes] Erro ao renderizar gráfico Geográfico:", errGeo);
  }
}

function renderTabelaTopClientes(topClientes, money) {
  const tbody = document.getElementById("tbody-top-clientes");
  if (!tbody) return;

  if (!topClientes || topClientes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 24px; color: var(--muted);">
          Nenhum cliente com pedidos registrados no período selecionado.
        </td>
      </tr>
    `;
    return;
  }

  const formatDataSimples = (iso) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return "—";
    }
  };

  tbody.innerHTML = topClientes
    .map((c, index) => {
      const isML = c.origem === "MERCADO_LIVRE";
      const badgeOrigem = isML
        ? `<span class="badge-origem badge-ml"><span class="badge-origem-dot"></span>Mercado Livre</span>`
        : `<span class="badge-origem badge-presencial"><span class="badge-origem-dot"></span>Presencial</span>`;

      const nomeCliente = c.nome || "Cliente sem nome";
      const cidadeUf = `${c.cidade || "—"} / ${c.uf || "—"}`;
      const totalPed = Number(c.totalPedidos) || 0;
      const receita = Number(c.receitaTotal) || 0;

      return `
        <tr style="border-bottom: 1px solid var(--line);">
          <td style="padding: 10px 8px; font-weight: 700; color: #78716c;">
            #${index + 1}
          </td>
          <td style="padding: 10px 8px; font-weight: 700; color: var(--ink);">
            ${escapeHtml(nomeCliente)}
          </td>
          <td style="padding: 10px 8px;">
            ${badgeOrigem}
          </td>
          <td style="padding: 10px 8px; color: var(--muted); font-size: 0.8rem;">
            ${escapeHtml(cidadeUf)}
          </td>
          <td style="padding: 10px 8px; text-align: center; font-weight: 700;">
            ${totalPed}
          </td>
          <td style="padding: 10px 8px; text-align: right; font-weight: 800; color: var(--ink);">
            ${money(receita)}
          </td>
          <td style="padding: 10px 8px; text-align: right; color: var(--muted); font-size: 0.8rem;">
            ${formatDataSimples(c.ultimoPedido)}
          </td>
          <td style="padding: 10px 8px; text-align: right;">
            <a href="clientes.html?busca=${encodeURIComponent(nomeCliente)}" class="btn-ghost" style="padding: 4px 8px; font-size: 0.74rem; text-decoration: none;">
              Ver Cadastro
            </a>
          </td>
        </tr>
      `;
    })
    .join("");
}

function gerarMetricasClientesFallback(dias, source, diasInativo) {
  return {
    sucesso: true,
    periodo: { dias, source },
    kpis: {
      totalClientesBase: { valor: 9, deltaPercentual: 12.5, deltaSentidoBom: true, tooltip: "Total de clientes na base." },
      novosClientes: { valor: 4, deltaPercentual: -20.0, deltaSentidoBom: false, tooltip: "Clientes novos cadastrados no período." },
      clientesAtivos: { valor: 5, deltaPercentual: 25.0, deltaSentidoBom: true, tooltip: "Clientes com compras no período." },
      taxaRecorrencia: { valor: 28.6, deltaPercentual: 3.2, deltaSentidoBom: true, tooltip: "Taxa de recompras." },
      ticketMedioCliente: { valor: 1467.12, deltaPercentual: 8.4, deltaSentidoBom: true, tooltip: "Receita média por cliente." },
      receitaPorOrigem: { valorTotal: 7335.6, presencial: 6350.0, mercadoLivre: 985.6, sharePresencial: 86.6, shareMercadoLivre: 13.4, tooltip: "Divisão de receita." },
      clientesInativos: { valor: 3, taxaPercentual: 33.3, deltaPercentual: 0, deltaSentidoBom: false, diasConfigurados: diasInativo, tooltip: "Clientes sem compras." },
    },
    alertas: [
      {
        id: "alerta-dependencia-balcao",
        tipo: "dependencia_canal",
        severidade: "atencao",
        titulo: "Alta dependência do balcão presencial (86.6% do faturamento)",
        mensagem: "As vendas físicas locais concentram a maioria da receita. Acelere os anúncios no Mercado Livre.",
        valorAtual: "86.6%",
        limiteConfigurado: "75%",
        acaoTexto: "Ver Anúncios ML",
        acaoLink: "anuncios.html",
      },
      {
        id: "alerta-inativos",
        tipo: "alto_inativos",
        severidade: "atencao",
        titulo: "33.3% da base está inativa há mais de 90 dias",
        mensagem: "3 clientes corporativos não realizam nenhum pedido há mais de 3 meses. Recomendado contato para recarga anual.",
        valorAtual: "33.3%",
        limiteConfigurado: "30%",
        acaoTexto: "Filtrar Clientes Inativos",
        acaoLink: "clientes.html?filtro=inativos",
      },
    ],
    graficos: {
      timeline: {
        categories: ["10/11", "12/11", "15/11", "18/11"],
        presencial: [1, 1, 0, 1],
        mercadoLivre: [0, 0, 1, 1],
      },
      distribuicaoOrigem: {
        labels: ["Presencial (Balcão)", "Mercado Livre"],
        clientesSeries: [6, 3],
        receitaSeries: [6350, 985.6],
      },
      novosVsRecorrentes: {
        labels: ["Novos Clientes", "Recorrentes (Recompra)"],
        series: [4, 2],
      },
      topClientesReceita: [
        { id: 10, nome: "Indústria Metalúrgica Paranaense SA", origem: "PRESENCIAL", cidade: "São José dos Pinhais", uf: "PR", totalPedidos: 2, receitaTotal: 4200.0, ultimoPedido: "2026-11-09T00:00:00Z" },
        { id: 12, nome: "Logística & Transportes Catarinense", origem: "PRESENCIAL", cidade: "Joinville", uf: "SC", totalPedidos: 1, receitaTotal: 2150.0, ultimoPedido: "2026-11-07T00:00:00Z" },
        { id: 11, nome: "Auto Posto PetroSul LTDA", origem: "PRESENCIAL", cidade: "Maringá", uf: "PR", totalPedidos: 1, receitaTotal: 1850.0, ultimoPedido: "2026-09-09T00:00:00Z" },
        { id: 3, nome: "Marcos Vinicius Santos (COMPRADOR_ML_OFICIAL)", origem: "MERCADO_LIVRE", cidade: "São Paulo", uf: "SP", totalPedidos: 2, receitaTotal: 418.8, ultimoPedido: "2026-11-11T00:00:00Z" },
        { id: 13, nome: "Juliana Andrade (COMPRADOR_ML_SP)", origem: "MERCADO_LIVRE", cidade: "Campinas", uf: "SP", totalPedidos: 1, receitaTotal: 378.0, ultimoPedido: "2026-11-01T00:00:00Z" },
      ],
      distribuicaoGeografica: {
        ufs: [
          { uf: "PR", totalClientes: 4, receita: 6350.0 },
          { uf: "SP", totalClientes: 2, receita: 796.8 },
          { uf: "SC", totalClientes: 1, receita: 2150.0 },
          { uf: "RJ", totalClientes: 1, receita: 188.8 },
          { uf: "MG", totalClientes: 1, receita: 980.0 },
        ],
      },
    },
  };
}

// ─── ABA 9: DASHBOARD DE COMPRAS & FORNECEDORES ──────────────────────────────
let comprasCharts = {};
let scorecardDataAtual = [];
let scorecardOrdenacao = { coluna: "totalGasto", ascendente: false };

function setupPurchaseFilters() {
  const selectPeriodo = document.getElementById("filtro-compras-periodo");
  const selectFornecedor = document.getElementById("filtro-compras-fornecedor");
  const selectCategoria = document.getElementById("filtro-compras-categoria");
  const btnRecarregar = document.getElementById("btn-recarregar-dash-compras");
  const btnTentar = document.getElementById("btn-tentar-novamente-dash-compras");

  if (selectPeriodo && !selectPeriodo.dataset.bound) {
    selectPeriodo.dataset.bound = "true";
    selectPeriodo.addEventListener("change", () => renderTabCompras());
  }

  if (selectFornecedor && !selectFornecedor.dataset.bound) {
    selectFornecedor.dataset.bound = "true";
    selectFornecedor.addEventListener("change", () => renderTabCompras());
  }

  if (selectCategoria && !selectCategoria.dataset.bound) {
    selectCategoria.dataset.bound = "true";
    selectCategoria.addEventListener("change", () => renderTabCompras());
  }

  if (btnRecarregar && !btnRecarregar.dataset.bound) {
    btnRecarregar.dataset.bound = "true";
    btnRecarregar.addEventListener("click", () => renderTabCompras());
  }

  if (btnTentar && !btnTentar.dataset.bound) {
    btnTentar.dataset.bound = "true";
    btnTentar.addEventListener("click", () => renderTabCompras());
  }

  // Bind de ordenação do Scorecard
  const thHeaders = document.querySelectorAll("#tabela-scorecard-compras th[data-sort]");
  thHeaders.forEach((th) => {
    if (!th.dataset.bound) {
      th.dataset.bound = "true";
      th.addEventListener("click", () => {
        const coluna = th.getAttribute("data-sort");
        if (scorecardOrdenacao.coluna === coluna) {
          scorecardOrdenacao.ascendente = !scorecardOrdenacao.ascendente;
        } else {
          scorecardOrdenacao.coluna = coluna;
          scorecardOrdenacao.ascendente = false; // Maior primeiro por padrão
        }
        const money = (val) => Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        renderScorecardCompras(scorecardDataAtual, money);
      });
    }
  });
}

async function renderTabCompras() {
  const selectPeriodo = document.getElementById("filtro-compras-periodo");
  const selectFornecedor = document.getElementById("filtro-compras-fornecedor");
  const selectCategoria = document.getElementById("filtro-compras-categoria");
  const erroContainer = document.getElementById("erro-dash-compras");
  const msgErroEl = document.getElementById("mensagem-erro-dash-compras");

  const dias = selectPeriodo ? Number(selectPeriodo.value) || 30 : 30;
  const supplierId = selectFornecedor && selectFornecedor.value !== "ALL" ? selectFornecedor.value : "ALL";
  const categoryId = selectCategoria && selectCategoria.value !== "ALL" ? selectCategoria.value : "ALL";

  const money = (val) => Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  try {
    if (erroContainer) erroContainer.style.display = "none";

    let dados = null;

    if (window.RezFireAPI && window.RezFireAPI.dashboard && window.RezFireAPI.dashboard.purchases) {
      try {
        const res = await window.RezFireAPI.dashboard.purchases({
          dias,
          supplierId,
          categoryId,
        });
        if (res && res.sucesso) {
          dados = res;
        }
      } catch (apiErr) {
        console.warn("[Dashboard Compras] API indisponível, usando fallback demonstrativo:", apiErr);
      }
    }

    if (!dados) {
      dados = gerarMetricasComprasFallback(dias, supplierId, categoryId);
    }

    // Atualiza opções do select de fornecedores dinamicamente se ainda não preenchido
    if (selectFornecedor && Array.isArray(dados.fornecedoresFiltro) && (!selectFornecedor.options || selectFornecedor.options.length <= 1)) {
      const valorAtual = selectFornecedor.value;
      dados.fornecedoresFiltro.forEach((f) => {
        const opt = document.createElement ? document.createElement("option") : {};
        opt.value = f.id_fornecedor;
        opt.textContent = f.nome;
        if (selectFornecedor.appendChild) selectFornecedor.appendChild(opt);
      });
      selectFornecedor.value = valorAtual;
    }

    renderKpisCompras(dados.kpis, money);
    renderAlertasCompras(dados.alertas || []);
    renderScorecardCompras(dados.scorecard || [], money);
    renderGraficosCompras(dados.graficos, money);

    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 150);
  } catch (err) {
    console.error("[Dashboard Compras] Erro ao carregar aba:", err);
    if (erroContainer) {
      erroContainer.style.display = "block";
      if (msgErroEl) msgErroEl.textContent = err.message || "Erro desconhecido ao processar dados de compras.";
    }
  }
}

function renderKpisCompras(kpis, money) {
  const container = document.getElementById("kpis-tab-compras");
  if (!container || !kpis) return;

  const formatDelta = (delta, deltaSentidoBom, labelComp = "vs período anterior") => {
    if (typeof delta !== "number" || isNaN(delta)) return "";
    const isUp = deltaSentidoBom ? delta > 0 : delta < 0;
    const deltaClass = isUp ? "kpi-delta up" : "kpi-delta down";
    const sinal = delta > 0 ? "+" : "";
    return `<span class="${deltaClass}">${sinal}${delta}%</span> ${labelComp}`;
  };

  const gasto = kpis.gastoTotal || {};
  const pedidos = kpis.pedidosCompra || {};
  const ticket = kpis.ticketMedio || {};
  const prazo = kpis.prazoMedioEntrega || {};
  const pontualidade = kpis.entregasNoPrazo || {};
  const atrasados = kpis.pedidosAtrasados || {};
  const variacaoCusto = kpis.variacaoCustoCompra || {};
  const ativos = kpis.fornecedoresAtivos || {};
  const concentracao = kpis.concentracaoCompras || {};

  container.innerHTML = [
    kpiCard(
      "GASTO TOTAL EM COMPRAS",
      gasto.semDados ? "Sem dados" : (gasto.valorFormatado || money(gasto.valor)),
      formatDelta(gasto.deltaPercentual, gasto.deltaSentidoBom),
      gasto.tooltip
    ),
    kpiCard(
      "PEDIDOS DE COMPRA",
      pedidos.semDados ? "Sem dados" : String(pedidos.valor ?? 0),
      formatDelta(pedidos.deltaPercentual, pedidos.deltaSentidoBom),
      pedidos.tooltip
    ),
    kpiCard(
      "TICKET MÉDIO POR PEDIDO",
      ticket.semDados ? "Sem dados" : (ticket.valorFormatado || money(ticket.valor)),
      formatDelta(ticket.deltaPercentual, ticket.deltaSentidoBom),
      ticket.tooltip
    ),
    kpiCard(
      "PRAZO MÉDIO DE ENTREGA",
      prazo.semDados ? "Sem dados" : (prazo.valorFormatado || `${prazo.valor} dias`),
      formatDelta(prazo.deltaPercentual, prazo.deltaSentidoBom),
      prazo.tooltip
    ),
    kpiCard(
      "ENTREGAS NO PRAZO",
      pontualidade.semDados ? "Sem dados" : (pontualidade.valorFormatado || `${pontualidade.valor}%`),
      pontualidade.deltaPercentual !== null ? formatDelta(pontualidade.deltaPercentual, pontualidade.deltaSentidoBom, "p.p. vs ant.") : "",
      pontualidade.tooltip
    ),
    kpiCard(
      "PEDIDOS ATRASADOS EM ABERTO",
      atrasados.semDados ? "0 no prazo" : (atrasados.valorFormatado || `${atrasados.valor} em atraso`),
      atrasados.valor > 0 ? `<span class="kpi-delta down">⚠️ Ação urgente necessária</span>` : `<span class="kpi-delta up">✓ SLA em dia</span>`,
      atrasados.tooltip
    ),
    kpiCard(
      "VARIAÇÃO DO CUSTO DE COMPRA",
      variacaoCusto.semDados ? "Sem dados comp." : (variacaoCusto.valorFormatado || `${variacaoCusto.valor}%`),
      variacaoCusto.valor !== null ? (variacaoCusto.valor > 0 ? `<span class="kpi-delta down">+${variacaoCusto.valor}% inflação insumos</span>` : `<span class="kpi-delta up">${variacaoCusto.valor}% economia</span>`) : "",
      variacaoCusto.tooltip
    ),
    kpiCard(
      "FORNECEDORES ATIVOS",
      ativos.semDados ? "Nenhum" : (ativos.valorFormatado || `${ativos.valor} ativos`),
      `${ativos.valor || 0} parceiros com pedidos`,
      ativos.tooltip
    ),
    kpiCard(
      "CONCENTRAÇÃO DE COMPRAS",
      concentracao.semDados ? "Sem dados" : (concentracao.valorFormatado || `${concentracao.valor}%`),
      concentracao.fornecedorNome ? `<span style="font-size:0.72rem; color:#78716c;">Maior: <strong>${escapeHtml(concentracao.fornecedorNome)}</strong></span>` : "",
      concentracao.tooltip
    ),
  ].join("");
}

function renderAlertasCompras(alertas) {
  const container = document.getElementById("container-alertas-compras");
  if (!container) return;

  if (!alertas || alertas.length === 0) {
    container.innerHTML = `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.2rem;">✅</span>
          <div>
            <span style="font-size: 0.84rem; font-weight: 700; color: #166534;">Cadeia de Suprimentos Saudável:</span>
            <span style="font-size: 0.8rem; color: #14532d; margin-left: 4px;">Nenhum atraso recorrente, inflação crítica ou dependência excessiva de fornecedor detectada no período.</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = alertas
    .map((alerta) => {
      const isCritico = alerta.severidade === "critico";
      const bg = isCritico ? "#fef2f2" : "#fffbeb";
      const border = isCritico ? "#f87171" : "#f59e0b";
      const textTitle = isCritico ? "#991b1b" : "#92400e";
      const textDesc = isCritico ? "#7f1d1d" : "#78350f";
      const btnBorder = isCritico ? "#ef4444" : "#f59e0b";
      const btnColor = isCritico ? "#b91c1c" : "#b45309";
      const icon = isCritico ? "🛑" : "⚠️";

      return `
        <div style="background: ${bg}; border-left: 4px solid ${border}; border-top: 1px solid ${border}40; border-right: 1px solid ${border}40; border-bottom: 1px solid ${border}40; border-radius: 6px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
          <div style="display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 260px;">
            <span style="font-size: 1.1rem; line-height: 1.2;">${icon}</span>
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 0.82rem; font-weight: 800; color: ${textTitle};">${escapeHtml(alerta.titulo)}</span>
                <span style="font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${isCritico ? '#fee2e2' : '#fef3c7'}; color: ${textTitle}; text-transform: uppercase;">
                  ${isCritico ? 'Crítico' : 'Atenção'}
                </span>
                <span style="font-size: 0.72rem; color: #78716c;">(Limite: ${escapeHtml(String(alerta.limiteConfigurado))})</span>
              </div>
              <p style="margin: 3px 0 0; font-size: 0.79rem; color: ${textDesc}; line-height: 1.35;">
                ${escapeHtml(alerta.mensagem)}
              </p>
            </div>
          </div>
          ${
            alerta.acaoLink
              ? `
            <a href="${alerta.acaoLink}" class="btn-ghost" style="padding: 5px 12px; font-size: 0.78rem; border-color: ${btnBorder}; color: ${btnColor}; background: #fff; text-decoration: none; white-space: nowrap; font-weight: 600;">
              ${escapeHtml(alerta.acaoTexto || 'Verificar')} →
            </a>
          `
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function renderScorecardCompras(scorecard, money) {
  const tbody = document.getElementById("tbody-scorecard-compras");
  const badgeTotal = document.getElementById("badge-total-fornecedores-scorecard");
  if (!tbody) return;

  scorecardDataAtual = scorecard || [];

  if (badgeTotal) {
    badgeTotal.textContent = `${scorecardDataAtual.length} fornecedor(es)`;
  }

  if (!scorecardDataAtual || scorecardDataAtual.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding: 30px; color: var(--muted);">
          Nenhum dado de compras encontrado para os filtros selecionados.
        </td>
      </tr>
    `;
    return;
  }

  // Ordenação dinâmica
  const sorted = [...scorecardDataAtual].sort((a, b) => {
    let valA = a[scorecardOrdenacao.coluna];
    let valB = b[scorecardOrdenacao.coluna];

    if (valA === null || valA === undefined) valA = -999999;
    if (valB === null || valB === undefined) valB = -999999;

    if (typeof valA === "string") {
      return scorecardOrdenacao.ascendente
        ? valA.localeCompare(String(valB))
        : String(valB).localeCompare(valA);
    }
    return scorecardOrdenacao.ascendente ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
  });

  tbody.innerHTML = sorted
    .map((s) => {
      let badgeStatus = "";
      if (s.statusOperacional === "Excelente") {
        badgeStatus = `<span style="background:#dcfce7; color:#15803d; font-weight:700; padding:3px 8px; border-radius:4px; font-size:0.74rem;">✓ Excelente</span>`;
      } else if (s.statusOperacional === "Crítico") {
        badgeStatus = `<span style="background:#fee2e2; color:#b91c1c; font-weight:700; padding:3px 8px; border-radius:4px; font-size:0.74rem;">🛑 Crítico</span>`;
      } else if (s.statusOperacional === "Alerta") {
        badgeStatus = `<span style="background:#fef3c7; color:#b45309; font-weight:700; padding:3px 8px; border-radius:4px; font-size:0.74rem;">⚠️ Alerta</span>`;
      } else {
        badgeStatus = `<span style="background:#f3f4f6; color:#4b5563; font-weight:600; padding:3px 8px; border-radius:4px; font-size:0.74rem;">Normal</span>`;
      }

      const pontualidadeLabel = s.pontualidadePct !== null ? `${s.pontualidadePct}%` : "—";
      const pontualidadeClass = s.pontualidadePct !== null && s.pontualidadePct < 80 ? "color:#b91c1c; font-weight:800;" : "font-weight:700;";

      return `
        <tr style="border-bottom: 1px solid var(--line);">
          <td style="padding: 10px 8px;">
            <div style="font-weight: 700; color: var(--ink);">${escapeHtml(s.nome)}</div>
            <div style="font-size: 0.72rem; color: var(--muted);">${escapeHtml(s.cnpj || '—')}</div>
          </td>
          <td style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">
            ${escapeHtml(s.cidadeUf)}
          </td>
          <td style="padding: 10px 8px; text-align: center; font-weight: 700;">
            ${s.totalPedidos}
          </td>
          <td style="padding: 10px 8px; text-align: right; font-weight: 800; color: var(--ink);">
            ${money(s.totalGasto)}
          </td>
          <td style="padding: 10px 8px; text-align: center; ${pontualidadeClass}">
            ${pontualidadeLabel}
          </td>
          <td style="padding: 10px 8px; text-align: center; font-size: 0.82rem;">
            ${s.leadTimeMedioDias} dias
          </td>
          <td style="padding: 10px 8px; text-align: center;">
            ${s.pedidosAtrasados > 0 ? `<span style="color:#b91c1c; font-weight:800;">${s.pedidosAtrasados}</span>` : `<span style="color:#15803d;">0</span>`}
          </td>
          <td style="padding: 10px 8px; text-align: center; font-size: 0.8rem; color: ${s.taxaDevolucaoPct > 0 ? '#b91c1c; font-weight:700;' : 'var(--muted);'}">
            ${s.taxaDevolucaoPct}%
          </td>
          <td style="padding: 10px 8px; text-align: center;">
            ${badgeStatus}
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderGraficosCompras(graficos, money) {
  if (!graficos) return;

  // 1. Destrói instâncias anteriores com segurança
  Object.keys(comprasCharts).forEach((key) => {
    if (comprasCharts[key]) {
      try {
        comprasCharts[key].destroy();
      } catch (e) {}
    }
  });
  comprasCharts = {};

  if (typeof ApexCharts === "undefined") {
    console.warn("[Dashboard Compras] Biblioteca ApexCharts indisponível.");
    ["chart-compras-timeline", "chart-compras-top-fornecedores", "chart-compras-prazos", "chart-compras-categorias", "chart-compras-status", "chart-compras-evolucao-preco"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="padding:40px; text-align:center; color:#78716c; font-size:0.85rem;">Gráfico indisponível (ApexCharts não carregado).</div>';
    });
    return;
  }

  // ── Gráfico 1: Timeline do Gasto em Compras ──────────────────────────────
  try {
    const elTimeline = document.querySelector("#chart-compras-timeline");
    if (elTimeline && graficos.timeline) {
      const categories = graficos.timeline.categories || [];
      const gasto = graficos.timeline.gasto || [];

      if (gasto.length === 0 || categories.length === 0) {
        elTimeline.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">📦</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Nenhuma compra no período</span>
            <span style="font-size:0.76rem; color:#78716c;">Nenhum pedido de compra foi emitido no intervalo de datas selecionado.</span>
          </div>
        `;
      } else {
        elTimeline.innerHTML = "";
        comprasCharts.timeline = new ApexCharts(elTimeline, {
          chart: {
            height: 280,
            type: "area",
            toolbar: { show: false },
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          series: [
            { name: "Gasto em Compras", data: gasto },
          ],
          colors: ["#1a1412"],
          stroke: { curve: "smooth", width: 2 },
          fill: {
            type: "gradient",
            gradient: {
              shadeIntensity: 1,
              opacityFrom: 0.45,
              opacityTo: 0.05,
              stops: [0, 95, 100],
            },
          },
          grid: { borderColor: "#eee8e0", strokeDashArray: 0 },
          dataLabels: { enabled: false },
          xaxis: {
            categories,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" } },
          },
          yaxis: {
            min: 0,
            labels: {
              style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" },
              formatter: (val) => money(val),
            },
          },
          tooltip: {
            y: { formatter: (val) => money(val) },
          },
        });
        comprasCharts.timeline.render();
      }
    }
  } catch (errTimeline) {
    console.error("[Dashboard Compras] Erro no gráfico Timeline:", errTimeline);
  }

  // ── Gráfico 2: Top Fornecedores por Gasto (Barras Horizontais) ───────────
  try {
    const elTopForn = document.querySelector("#chart-compras-top-fornecedores");
    if (elTopForn && graficos.topFornecedores) {
      const top = graficos.topFornecedores || [];

      if (top.length === 0) {
        elTopForn.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">🏢</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Sem compras por fornecedor</span>
          </div>
        `;
      } else {
        const categories = top.map((t) => t.nome);
        const dataValores = top.map((t) => t.gasto);

        elTopForn.innerHTML = "";
        comprasCharts.topFornecedores = new ApexCharts(elTopForn, {
          chart: {
            height: 280,
            type: "bar",
            toolbar: { show: false },
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          plotOptions: {
            bar: {
              horizontal: true,
              barHeight: "50%",
              borderRadius: 3,
            },
          },
          colors: ["#e85c2a"],
          dataLabels: {
            enabled: true,
            formatter: (val, opt) => {
              const item = top[opt.dataPointIndex];
              return `${money(val)} (${item?.participacao || 0}%)`;
            },
            style: { fontSize: "10px", colors: ["#fff"] },
          },
          grid: { borderColor: "#eee8e0", strokeDashArray: 0 },
          xaxis: {
            categories,
            labels: { formatter: (val) => money(val) },
          },
          tooltip: {
            y: {
              formatter: (val, opt) => {
                const item = top[opt.dataPointIndex];
                return `${money(val)} (${item?.participacao || 0}% do gasto total)`;
              },
            },
          },
        });
        comprasCharts.topFornecedores.render();
      }
    }
  } catch (errTopForn) {
    console.error("[Dashboard Compras] Erro no gráfico Top Fornecedores:", errTopForn);
  }

  // ── Gráfico 3: Prazo Previsto x Realizado por Fornecedor ───────────────────
  try {
    const elPrazos = document.querySelector("#chart-compras-prazos");
    if (elPrazos && graficos.prazosPorFornecedor) {
      const labels = graficos.prazosPorFornecedor.labels || [];
      const previsto = graficos.prazosPorFornecedor.previsto || [];
      const realizado = graficos.prazosPorFornecedor.realizado || [];

      if (labels.length === 0) {
        elPrazos.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">⏱️</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Sem pedidos entregues no período</span>
          </div>
        `;
      } else {
        elPrazos.innerHTML = "";
        comprasCharts.prazos = new ApexCharts(elPrazos, {
          chart: {
            height: 280,
            type: "bar",
            toolbar: { show: false },
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          plotOptions: {
            bar: {
              horizontal: false,
              columnWidth: "45%",
              borderRadius: 3,
            },
          },
          colors: ["#0284c7", "#f59e0b"],
          series: [
            { name: "Prazo Previsto (dias)", data: previsto },
            { name: "Prazo Realizado (dias)", data: realizado },
          ],
          grid: { borderColor: "#eee8e0", strokeDashArray: 0 },
          dataLabels: { enabled: false },
          xaxis: {
            categories: labels,
            labels: { style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" } },
          },
          yaxis: {
            min: 0,
            labels: { formatter: (val) => `${Math.round(val)}d` },
          },
          legend: { position: "top", horizontalAlign: "right", fontFamily: "Inter, sans-serif" },
          tooltip: {
            shared: true,
            intersect: false,
            y: { formatter: (val) => `${val} dias` },
          },
        });
        comprasCharts.prazos.render();
      }
    }
  } catch (errPrazos) {
    console.error("[Dashboard Compras] Erro no gráfico Prazos:", errPrazos);
  }

  // ── Gráfico 4: Gasto por Categoria de Produto (Donut) ─────────────────────
  try {
    const elCat = document.querySelector("#chart-compras-categorias");
    if (elCat && graficos.categoriasChart) {
      const labels = graficos.categoriasChart.labels || [];
      const series = graficos.categoriasChart.series || [];
      const sum = series.reduce((a, b) => a + (Number(b) || 0), 0);

      if (sum === 0 || series.length === 0) {
        elCat.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">🏷️</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Sem gastos por categoria</span>
          </div>
        `;
      } else {
        elCat.innerHTML = "";
        comprasCharts.categorias = new ApexCharts(elCat, {
          chart: {
            height: 280,
            type: "donut",
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          series,
          labels,
          colors: ["#1a1412", "#e85c2a", "#0284c7", "#10b981", "#8b5cf6"],
          dataLabels: {
            enabled: true,
            formatter: (val) => `${Math.round(Number(val) || 0)}%`,
          },
          legend: { position: "bottom", fontFamily: "Inter, sans-serif", fontSize: "12px" },
          stroke: { show: false },
          tooltip: {
            y: { formatter: (val) => money(val) },
          },
        });
        comprasCharts.categorias.render();
      }
    }
  } catch (errCat) {
    console.error("[Dashboard Compras] Erro no gráfico Categorias:", errCat);
  }

  // ── Gráfico 5: Pedidos de Compra por Status (Donut) ────────────────────────
  try {
    const elStatus = document.querySelector("#chart-compras-status");
    if (elStatus && graficos.statusChart) {
      const labels = graficos.statusChart.labels || [];
      const series = graficos.statusChart.series || [];
      const sum = series.reduce((a, b) => a + (Number(b) || 0), 0);

      if (sum === 0) {
        elStatus.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">📊</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Nenhum pedido de compra</span>
          </div>
        `;
      } else {
        elStatus.innerHTML = "";
        comprasCharts.status = new ApexCharts(elStatus, {
          chart: {
            height: 280,
            type: "donut",
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          series,
          labels,
          colors: ["#10b981", "#0284c7", "#ef4444", "#f59e0b", "#9ca3af"],
          dataLabels: {
            enabled: true,
            formatter: (val, opt) => `${opt.w.globals.series[opt.seriesIndex]} un`,
          },
          legend: { position: "bottom", fontFamily: "Inter, sans-serif", fontSize: "12px" },
          stroke: { show: false },
          tooltip: {
            y: {
              formatter: (val, opt) => {
                const idx = opt?.seriesIndex ?? -1;
                const v = graficos.statusChart.valores?.[idx] || 0;
                return `${val} pedidos (${money(v)})`;
              },
            },
          },
        });
        comprasCharts.status.render();
      }
    }
  } catch (errStatus) {
    console.error("[Dashboard Compras] Erro no gráfico Status:", errStatus);
  }

  // ── Gráfico 6: Evolução do Preço dos Itens Mais Comprados ─────────────────
  try {
    const elPreco = document.querySelector("#chart-compras-evolucao-preco");
    const selectItemPreco = document.getElementById("filtro-compras-produto-preco");
    const itens = graficos.itensHistoricoPreco || [];

    if (elPreco) {
      if (itens.length === 0) {
        elPreco.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">📈</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Sem histórico de preços registrado</span>
          </div>
        `;
      } else {
        // Popula o select de produtos caso ainda não preenchido
        if (selectItemPreco && (!selectItemPreco.options || selectItemPreco.options.length <= 1)) {
          itens.forEach((it, idx) => {
            const opt = document.createElement ? document.createElement("option") : {};
            opt.value = it.idProduto;
            opt.textContent = it.nome;
            if (idx === 0) opt.selected = true;
            if (selectItemPreco.appendChild) selectItemPreco.appendChild(opt);
          });

          if (!selectItemPreco.dataset.bound) {
            selectItemPreco.dataset.bound = "true";
            selectItemPreco.addEventListener("change", () => {
              renderizarGraficoEvolucaoPrecoItem(Number(selectItemPreco.value), itens, elPreco, money);
            });
          }
        }

        const produtoIdInicial = selectItemPreco && selectItemPreco.value ? Number(selectItemPreco.value) : itens[0].idProduto;
        renderizarGraficoEvolucaoPrecoItem(produtoIdInicial, itens, elPreco, money);
      }
    }
  } catch (errPreco) {
    console.error("[Dashboard Compras] Erro no gráfico Evolução de Preços:", errPreco);
  }
}

function renderizarGraficoEvolucaoPrecoItem(idProduto, itens, containerEl, money) {
  if (comprasCharts.precoItem) {
    try {
      comprasCharts.precoItem.destroy();
    } catch (e) {}
  }

  const itemSel = itens.find((i) => i.idProduto === idProduto) || itens[0];
  if (!itemSel || !itemSel.pontos || itemSel.pontos.length === 0) {
    containerEl.innerHTML = `
      <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
        <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Sem histórico para este item</span>
      </div>
    `;
    return;
  }

  const categories = itemSel.pontos.map((p) => p.data);
  const dataPrecos = itemSel.pontos.map((p) => p.preco);

  containerEl.innerHTML = "";
  comprasCharts.precoItem = new ApexCharts(containerEl, {
    chart: {
      height: 280,
      type: "line",
      toolbar: { show: false },
      fontFamily: "Inter, sans-serif",
      animations: { enabled: false },
    },
    series: [
      { name: "Preço Unitário Pago", data: dataPrecos },
    ],
    colors: ["#e85c2a"],
    stroke: { width: 3, curve: "stepline" },
    markers: { size: 5, strokeColors: "#fff", strokeWidth: 2 },
    grid: { borderColor: "#eee8e0", strokeDashArray: 0 },
    xaxis: {
      categories,
      labels: { style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" } },
    },
    yaxis: {
      labels: {
        style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" },
        formatter: (val) => money(val),
      },
    },
    tooltip: {
      y: {
        formatter: (val, opt) => {
          const pt = itemSel.pontos[opt.dataPointIndex];
          return `${money(val)} (Fornecedor: ${pt?.fornecedor || 'N/A'})`;
        },
      },
    },
  });
  comprasCharts.precoItem.render();
}

function gerarMetricasComprasFallback(dias, supplierId, categoryId) {
  return {
    sucesso: true,
    periodo: { dias, supplierId, categoryId },
    fornecedoresFiltro: [
      { id_fornecedor: 1, nome: "Resil Extintores" },
      { id_fornecedor: 2, nome: "Bucka Fire Systems" },
      { id_fornecedor: 3, nome: "Extinpel Brasil" },
      { id_fornecedor: 4, nome: "Sinalize Placas" },
    ],
    kpis: {
      gastoTotal: { valor: 34980, valorFormatado: "R$ 34.980,00", deltaPercentual: 53.1, deltaSentidoBom: false, tooltip: "Soma total dos valores de pedidos de compra emitidos no período." },
      pedidosCompra: { valor: 6, valorFormatado: "6 pedidos", deltaPercentual: 50.0, deltaSentidoBom: true, tooltip: "Quantidade de ordens de compra geradas." },
      ticketMedio: { valor: 5830, valorFormatado: "R$ 5.830,00", deltaPercentual: 2.1, deltaSentidoBom: true, tooltip: "Valor médio por pedido de compra." },
      prazoMedioEntrega: { valor: 7.3, valorFormatado: "7.3 dias", deltaPercentual: 38.1, deltaSentidoBom: false, tooltip: "Tempo médio decorrido da emissão ao recebimento." },
      entregasNoPrazo: { valor: 75.0, valorFormatado: "75.0%", deltaPercentual: 0, deltaSentidoBom: true, tooltip: "Percentual de pedidos entregues no prazo previsto." },
      pedidosAtrasados: { valor: 1, valorFormatado: "1 em atraso", deltaPercentual: null, deltaSentidoBom: false, tooltip: "Pedidos pendentes com prazo vencido." },
      variacaoCustoCompra: { valor: 7.2, valorFormatado: "+7.2%", deltaPercentual: 7.2, deltaSentidoBom: false, tooltip: "Variação média de custo unitário de insumos." },
      fornecedoresAtivos: { valor: 4, valorFormatado: "4 ativos", deltaPercentual: null, deltaSentidoBom: true, tooltip: "Fornecedores parceiros com compras no período." },
      concentracaoCompras: { valor: 64.3, valorFormatado: "64.3%", deltaPercentual: null, deltaSentidoBom: false, fornecedorNome: "Resil Extintores", tooltip: "Percentual do gasto concentrado no maior parceiro." },
    },
    alertas: [
      {
        id: "alerta-atraso-2",
        tipo: "atraso_fornecedor",
        severidade: "critico",
        titulo: "Fornecedor Bucka Fire Systems com 100.0% de pedidos atrasados",
        mensagem: "O parceiro entregou fora da data acordada em 100.0% das remessas recentes (limite seguro: 20%). Recomendado renegociar SLA.",
        valorAtual: "100.0%",
        limiteConfigurado: "20%",
        acaoTexto: "Filtrar Fornecedor",
        acaoLink: "dashboard.html?tab=compras&supplierId=2",
      },
      {
        id: "alerta-custo-12",
        tipo: "aumento_custo",
        severidade: "atencao",
        titulo: "Aumento de custo em Extintor Pó Químico Seco ABC 4kg: +13.3%",
        mensagem: "O preço médio unitário subiu de R$ 60,00 para R$ 68,00. Esse reajuste impacta diretamente a margem de venda.",
        valorAtual: "+13.3%",
        limiteConfigurado: "+10%",
        acaoTexto: "Ver Produtos",
        acaoLink: "produtos.html",
      },
      {
        id: "alerta-concentracao",
        tipo: "alta_concentracao",
        severidade: "atencao",
        titulo: "Alta dependência de compras: Resil Extintores concentra 64.3% dos gastos",
        mensagem: "Mais da metade do capital de compras está concentrado em um único fornecedor.",
        valorAtual: "64.3%",
        limiteConfigurado: "50%",
        acaoTexto: "Ver Scorecard",
        acaoLink: "#tabela-scorecard-compras",
      },
    ],
    graficos: {
      timeline: {
        categories: ["25/10", "01/11", "05/11", "09/11", "13/11", "16/11"],
        gasto: [14280, 4560, 3400, 1560, 8200, 2980],
        pedidos: [1, 1, 1, 1, 1, 1],
      },
      topFornecedores: [
        { id: 1, nome: "Resil Extintores", gasto: 22480, participacao: 64.3 },
        { id: 2, nome: "Bucka Fire Systems", gasto: 7540, participacao: 21.6 },
        { id: 3, nome: "Extinpel Brasil", gasto: 3400, participacao: 9.7 },
        { id: 4, nome: "Sinalize Placas", gasto: 1560, participacao: 4.5 },
      ],
      prazosPorFornecedor: {
        labels: ["Resil Extintores", "Bucka Fire Systems", "Extinpel Brasil", "Sinalize Placas"],
        previsto: [5.0, 7.0, 10.0, 4.0],
        realizado: [5.0, 10.0, 10.0, 4.0],
      },
      statusChart: {
        labels: ["Recebido", "Aberto", "Atrasado", "Parcial", "Cancelado"],
        series: [4, 1, 1, 0, 0],
        valores: [23800, 2980, 8200, 0, 0],
      },
      categoriasChart: {
        labels: ["Extintores", "Acessórios", "Sinalização", "Detecção"],
        series: [25960, 4460, 1560, 3000],
      },
      itensHistoricoPreco: [
        {
          idProduto: 12,
          nome: "Extintor Pó Químico Seco ABC 4kg",
          pontos: [
            { data: "28/09/2026", preco: 60.0, fornecedor: "Resil Extintores" },
            { data: "25/10/2026", preco: 68.0, fornecedor: "Resil Extintores" },
            { data: "05/11/2026", preco: 68.0, fornecedor: "Extinpel Brasil" },
          ],
        },
        {
          idProduto: 17,
          nome: "Suporte Universal de Parede",
          pontos: [
            { data: "02/10/2026", preco: 6.0, fornecedor: "Bucka Fire Systems" },
            { data: "01/11/2026", preco: 6.5, fornecedor: "Bucka Fire Systems" },
          ],
        },
      ],
    },
    scorecard: [
      { idFornecedor: 1, nome: "Resil Extintores", cnpj: "61.123.456/0001-90", cidadeUf: "São Paulo/SP", totalPedidos: 2, totalGasto: 22480, pontualidadePct: 100, leadTimeMedioDias: 5.0, pedidosAtrasados: 1, taxaDevolucaoPct: 0, statusOperacional: "Alerta" },
      { idFornecedor: 2, nome: "Bucka Fire Systems", cnpj: "52.987.654/0001-12", cidadeUf: "Guarulhos/SP", totalPedidos: 2, totalGasto: 7540, pontualidadePct: 0, leadTimeMedioDias: 10.0, pedidosAtrasados: 0, taxaDevolucaoPct: 0, statusOperacional: "Crítico" },
      { idFornecedor: 3, nome: "Extinpel Brasil", cnpj: "14.555.777/0001-33", cidadeUf: "Curitiba/PR", totalPedidos: 1, totalGasto: 3400, pontualidadePct: 100, leadTimeMedioDias: 10.0, pedidosAtrasados: 0, taxaDevolucaoPct: 0, statusOperacional: "Excelente" },
      { idFornecedor: 4, nome: "Sinalize Placas", cnpj: "08.222.333/0001-44", cidadeUf: "Joinville/SC", totalPedidos: 1, totalGasto: 1560, pontualidadePct: 100, leadTimeMedioDias: 4.0, pedidosAtrasados: 0, taxaDevolucaoPct: 0, statusOperacional: "Excelente" },
    ],
  };
}

// ─── ABA 10: DEVOLUÇÕES & QUALIDADE ──────────────────────────────────────────
let devolucoesCharts = {};
let devolucoesPaginacao = { page: 1, limit: 10, totalPages: 1, total: 0 };

function setupReturnFilters() {
  const selectPeriodo = document.getElementById("filtro-devolucoes-periodo");
  const selectMotivo = document.getElementById("filtro-devolucoes-motivo");
  const selectCategoria = document.getElementById("filtro-devolucoes-categoria");
  const selectFornecedor = document.getElementById("filtro-devolucoes-fornecedor");
  const btnRecarregar = document.getElementById("btn-recarregar-dash-devolucoes");
  const btnTentar = document.getElementById("btn-tentar-novamente-dash-devolucoes");
  const btnPrev = document.getElementById("btn-pag-prev-devolucoes");
  const btnNext = document.getElementById("btn-pag-next-devolucoes");

  const triggers = [selectPeriodo, selectMotivo, selectCategoria, selectFornecedor, btnRecarregar, btnTentar];
  triggers.forEach((el) => {
    if (el && !el.dataset.bound) {
      el.dataset.bound = "true";
      const evt = el.tagName === "SELECT" ? "change" : "click";
      el.addEventListener(evt, () => {
        devolucoesPaginacao.page = 1;
        renderTabDevolucoes();
      });
    }
  });

  if (btnPrev && !btnPrev.dataset.bound) {
    btnPrev.dataset.bound = "true";
    btnPrev.addEventListener("click", () => {
      if (devolucoesPaginacao.page > 1) {
        renderTabelaDevolucoesRecentes(devolucoesPaginacao.page - 1);
      }
    });
  }

  if (btnNext && !btnNext.dataset.bound) {
    btnNext.dataset.bound = "true";
    btnNext.addEventListener("click", () => {
      if (devolucoesPaginacao.page < devolucoesPaginacao.totalPages) {
        renderTabelaDevolucoesRecentes(devolucoesPaginacao.page + 1);
      }
    });
  }
}

async function renderTabDevolucoes() {
  const selectPeriodo = document.getElementById("filtro-devolucoes-periodo");
  const selectMotivo = document.getElementById("filtro-devolucoes-motivo");
  const selectCategoria = document.getElementById("filtro-devolucoes-categoria");
  const selectFornecedor = document.getElementById("filtro-devolucoes-fornecedor");
  const erroContainer = document.getElementById("erro-dash-devolucoes");
  const msgErroEl = document.getElementById("mensagem-erro-dash-devolucoes");

  const dias = selectPeriodo ? Number(selectPeriodo.value) || 30 : 30;
  const motivo = selectMotivo ? selectMotivo.value : "ALL";
  const categoryId = selectCategoria ? selectCategoria.value : "ALL";
  const supplierId = selectFornecedor ? selectFornecedor.value : "ALL";

  const money = (val) => {
    return Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  try {
    if (erroContainer) erroContainer.style.display = "none";

    let dados = null;

    if (window.RezFireAPI && window.RezFireAPI.dashboard && window.RezFireAPI.dashboard.returns) {
      try {
        const res = await window.RezFireAPI.dashboard.returns({
          dias,
          motivo,
          categoryId,
          supplierId,
        });
        if (res && res.sucesso) {
          dados = res;
        }
      } catch (apiErr) {
        console.warn("[Dashboard Devoluções] API indisponível, avaliando fallback local:", apiErr);
      }
    }

    if (!dados) {
      dados = gerarMetricasDevolucoesFallback(dias, motivo, categoryId, supplierId);
    }

    renderKpisDevolucoes(dados.kpis, money);
    renderAlertasDevolucoes(dados.alertas || []);
    renderGraficosDevolucoes(dados.graficos, money);
    await renderTabelaDevolucoesRecentes(devolucoesPaginacao.page);

    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 150);
  } catch (err) {
    console.error("[Dashboard Devoluções] Erro ao carregar aba:", err);
    if (erroContainer) {
      erroContainer.style.display = "block";
      if (msgErroEl) msgErroEl.textContent = err.message || "Erro desconhecido ao processar dados.";
    }
  }
}

function renderKpisDevolucoes(kpis, money) {
  const container = document.getElementById("kpis-tab-devolucoes");
  if (!container || !kpis) return;

  const formatDelta = (delta, deltaSentidoBom, labelComp = "vs período anterior") => {
    if (typeof delta !== "number" || isNaN(delta)) return "";
    const isUp = deltaSentidoBom;
    const deltaClass = isUp ? "kpi-delta up" : "kpi-delta down";
    const sinal = delta > 0 ? "+" : "";
    return `<span class="${deltaClass}">${sinal}${delta}%</span> ${labelComp}`;
  };

  const totalDev = kpis.totalDevolucoes || {};
  const taxaDev = kpis.taxaDevolucao || {};
  const valReemb = kpis.valorReembolsado || {};
  const custoTotal = kpis.custoTotalDevolucoes || {};
  const tempoMed = kpis.tempoMedioResolucao || {};
  const abertas = kpis.devolucoesAbertas || {};
  const trocaReemb = kpis.trocaVsReembolso || {};
  const recPerd = kpis.itensRecuperadosVsPerdidos || {};

  container.innerHTML = [
    kpiCard(
      "TOTAL DE DEVOLUÇÕES",
      Number(totalDev.valor || 0).toLocaleString("pt-BR"),
      formatDelta(totalDev.deltaPercentual, totalDev.deltaSentidoBom),
      totalDev.tooltip
    ),
    kpiCard(
      "TAXA DE DEVOLUÇÃO",
      `${Number(taxaDev.valor || 0).toFixed(1)}%`,
      formatDelta(taxaDev.deltaPercentual, taxaDev.deltaSentidoBom, `em itens (${Number(taxaDev.taxaValorPercentual || 0).toFixed(1)}% em R$)`),
      taxaDev.tooltip
    ),
    kpiCard(
      "VALOR REEMBOLSADO",
      money(valReemb.valor),
      formatDelta(valReemb.deltaPercentual, valReemb.deltaSentidoBom),
      valReemb.tooltip
    ),
    kpiCard(
      "CUSTO ESTIMADO TOTAL",
      money(custoTotal.valor),
      `<span style="color:#78716c; font-size:0.75rem;">Frete: ${money(custoTotal.freteReverso)} • Descarte: ${money(custoTotal.perdaDescarte)}</span>`,
      custoTotal.tooltip
    ),
    kpiCard(
      "TEMPO MÉDIO DE RESOLUÇÃO",
      typeof tempoMed.valor === "number" ? `${tempoMed.valor} dias` : String(tempoMed.valor || "—"),
      formatDelta(tempoMed.deltaPercentual, tempoMed.deltaSentidoBom, "dias úteis"),
      tempoMed.tooltip
    ),
    kpiCard(
      "CASOS EM ABERTO",
      Number(abertas.valor || 0).toLocaleString("pt-BR"),
      Number(abertas.atrasadas || 0) > 0
        ? `<span class="kpi-delta down font-bold">${abertas.atrasadas} além do prazo!</span>`
        : `<span class="kpi-delta up font-bold">100% no prazo</span>`,
      abertas.tooltip
    ),
    kpiCard(
      "TROCA × REEMBOLSO",
      trocaReemb.valor || "—",
      `<span style="color:#0284c7; font-weight:700;">Troca:</span> ${trocaReemb.shareTroca || 0}% • <span style="color:#e85c2a; font-weight:700;">Reembolso:</span> ${trocaReemb.shareReembolso || 0}%`,
      trocaReemb.tooltip
    ),
    kpiCard(
      "RECUPERADOS × PERDIDOS",
      recPerd.valor || "0 / 0",
      `<span style="color:#10b981; font-weight:700;">Estoque:</span> ${recPerd.recuperados || 0} un • <span style="color:#ef4444; font-weight:700;">Descarte:</span> ${recPerd.descartados || 0} un`,
      recPerd.tooltip
    ),
  ].join("");
}

function renderAlertasDevolucoes(alertas) {
  const container = document.getElementById("container-alertas-devolucoes");
  if (!container) return;

  if (!alertas || alertas.length === 0) {
    container.innerHTML = `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.2rem;">✅</span>
          <div>
            <span style="font-size: 0.85rem; font-weight: 700; color: #166534;">Qualidade operacional sob controle</span>
            <p style="margin: 2px 0 0; font-size: 0.78rem; color: #15803d;">Nenhuma inconformidade crítica, estouro de SLA de devolução ou índice excessivo de defeitos no período.</p>
          </div>
        </div>
        <span style="font-size: 0.75rem; font-weight: 600; color: #16a34a; background: #dcfce7; padding: 3px 8px; border-radius: 4px;">Padrão Aprovado</span>
      </div>
    `;
    return;
  }

  container.innerHTML = alertas
    .map((alerta) => {
      const isCritico = alerta.severidade === "critico";
      const bg = isCritico ? "#fef2f2" : "#fffbeb";
      const border = isCritico ? "#f87171" : "#f59e0b";
      const textTitle = isCritico ? "#991b1b" : "#92400e";
      const textDesc = isCritico ? "#7f1d1d" : "#78350f";
      const btnBorder = isCritico ? "#ef4444" : "#f59e0b";
      const btnColor = isCritico ? "#b91c1c" : "#b45309";
      const icon = isCritico ? "🛑" : "⚠️";

      return `
        <div style="background: ${bg}; border-left: 4px solid ${border}; border-top: 1px solid ${border}40; border-right: 1px solid ${border}40; border-bottom: 1px solid ${border}40; border-radius: 6px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
          <div style="display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 260px;">
            <span style="font-size: 1.1rem; line-height: 1.2;">${icon}</span>
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 0.82rem; font-weight: 800; color: ${textTitle};">${escapeHtml(alerta.titulo)}</span>
                <span style="font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${isCritico ? '#fee2e2' : '#fef3c7'}; color: ${textTitle}; text-transform: uppercase;">
                  ${isCritico ? 'Crítico' : 'Atenção'}
                </span>
                <span style="font-size: 0.72rem; color: #78716c;">(Limite seguro: ${escapeHtml(String(alerta.limiteConfigurado))})</span>
              </div>
              <p style="margin: 3px 0 0; font-size: 0.79rem; color: ${textDesc}; line-height: 1.35;">
                ${escapeHtml(alerta.mensagem)}
              </p>
            </div>
          </div>
          ${
            alerta.acaoLink
              ? `
            <a href="${alerta.acaoLink}" class="btn-ghost" style="padding: 5px 12px; font-size: 0.78rem; border-color: ${btnBorder}; color: ${btnColor}; background: #fff; text-decoration: none; white-space: nowrap; font-weight: 600;">
              ${escapeHtml(alerta.acaoTexto || 'Verificar')} →
            </a>
          `
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function renderGraficosDevolucoes(graficos, money) {
  if (!graficos) return;

  // 1. Destrói gráficos anteriores com segurança
  Object.keys(devolucoesCharts).forEach((key) => {
    if (devolucoesCharts[key]) {
      try {
        devolucoesCharts[key].destroy();
      } catch (e) {}
    }
  });
  devolucoesCharts = {};

  if (typeof ApexCharts === "undefined") {
    console.warn("[Dashboard Devoluções] Biblioteca ApexCharts indisponível.");
    ["chart-devolucoes-timeline", "chart-devolucoes-pareto", "chart-devolucoes-top-produtos", "chart-devolucoes-categorias", "chart-devolucoes-fornecedores", "chart-devolucoes-status"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="padding:40px; text-align:center; color:#78716c; font-size:0.85rem;">Gráfico indisponível (ApexCharts não carregado).</div>';
    });
    return;
  }

  // ── Gráfico 1: Timeline de Devoluções & Itens ──────────────────────────────
  try {
    const elTimeline = document.querySelector("#chart-devolucoes-timeline");
    if (elTimeline && graficos.timeline) {
      const categories = graficos.timeline.categories?.length > 0 ? graficos.timeline.categories : [];
      const devolucoes = graficos.timeline.devolucoes?.length > 0 ? graficos.timeline.devolucoes : [];
      const itens = graficos.timeline.itens?.length > 0 ? graficos.timeline.itens : [];
      const totalCasos = devolucoes.reduce((a, b) => a + (Number(b) || 0), 0);

      if (totalCasos === 0 || categories.length === 0) {
        elTimeline.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">📦</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Nenhuma devolução no período</span>
            <span style="font-size:0.76rem; color:#78716c;">Nenhum chamado de devolução ou troca foi registrado nas datas selecionadas.</span>
          </div>
        `;
      } else {
        elTimeline.innerHTML = "";
        devolucoesCharts.timeline = new ApexCharts(elTimeline, {
          chart: {
            height: 280,
            type: "bar",
            toolbar: { show: false },
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          series: [
            { name: "Casos Abertos", data: devolucoes },
            { name: "Unidades Devolvidas", data: itens },
          ],
          colors: ["#e85c2a", "#1a1412"],
          plotOptions: {
            bar: {
              horizontal: false,
              columnWidth: "45%",
              borderRadius: 3,
            },
          },
          grid: { borderColor: "#eee8e0", strokeDashArray: 0 },
          dataLabels: { enabled: false },
          xaxis: {
            type: "category",
            categories,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" } },
          },
          yaxis: {
            min: 0,
            forceNiceScale: true,
            labels: {
              style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" },
              formatter: (val) => Math.round(Number(val) || 0),
            },
          },
          legend: { position: "top", horizontalAlign: "right", fontFamily: "Inter, sans-serif", fontSize: "12px" },
          tooltip: { shared: true, intersect: false },
        });
        devolucoesCharts.timeline.render();
      }
    }
  } catch (errTimeline) {
    console.error("[Dashboard Devoluções] Erro ao renderizar Timeline:", errTimeline);
  }

  // ── Gráfico 2: Diagrama de Pareto de Motivos ───────────────────────────────
  try {
    const elPareto = document.querySelector("#chart-devolucoes-pareto");
    if (elPareto && graficos.pareto) {
      const labels = graficos.pareto.labels || [];
      const ocorrencias = graficos.pareto.ocorrencias || [];
      const acumulado = graficos.pareto.acumuladoPct || [];

      if (labels.length === 0 || ocorrencias.length === 0) {
        elPareto.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">📊</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Sem motivos registrados</span>
            <span style="font-size:0.76rem; color:#78716c;">Nenhum chamado disponível para montagem do diagrama de Pareto.</span>
          </div>
        `;
      } else {
        elPareto.innerHTML = "";
        devolucoesCharts.pareto = new ApexCharts(elPareto, {
          chart: {
            height: 280,
            type: "line",
            toolbar: { show: false },
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          stroke: { width: [0, 3], curve: "smooth" },
          plotOptions: {
            bar: {
              columnWidth: "40%",
              borderRadius: 3,
            },
          },
          series: [
            { name: "Ocorrências", type: "column", data: ocorrencias },
            { name: "% Acumulada", type: "line", data: acumulado },
          ],
          colors: ["#0284c7", "#ef4444"],
          grid: { borderColor: "#eee8e0", strokeDashArray: 0 },
          dataLabels: { enabled: false },
          xaxis: {
            categories: labels,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
              style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" },
              rotate: -20,
              trim: true,
              maxHeight: 60,
            },
          },
          yaxis: [
            {
              title: { text: "Chamados", style: { color: "#78716c", fontSize: "11px" } },
              min: 0,
              forceNiceScale: true,
              labels: { formatter: (val) => Math.round(Number(val) || 0) },
            },
            {
              opposite: true,
              title: { text: "% Acumulado", style: { color: "#ef4444", fontSize: "11px" } },
              min: 0,
              max: 100,
              labels: { formatter: (val) => `${Math.round(Number(val) || 0)}%` },
            },
          ],
          legend: { position: "top", horizontalAlign: "right", fontFamily: "Inter, sans-serif", fontSize: "12px" },
          tooltip: {
            shared: true,
            intersect: false,
            y: {
              formatter: (val, opts) => {
                if (opts.seriesIndex === 1) return `${Number(val || 0).toFixed(1)}%`;
                return `${val || 0} caso(s)`;
              },
            },
          },
        });
        devolucoesCharts.pareto.render();
      }
    }
  } catch (errPareto) {
    console.error("[Dashboard Devoluções] Erro ao renderizar Pareto:", errPareto);
  }

  // ── Gráfico 3: Top Produtos com Mais Devoluções ────────────────────────────
  try {
    const elTopProd = document.querySelector("#chart-devolucoes-top-produtos");
    if (elTopProd && graficos.topProdutos) {
      const top = graficos.topProdutos || [];
      if (top.length === 0) {
        elTopProd.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">🧯</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Nenhum produto devolvido</span>
            <span style="font-size:0.76rem; color:#78716c;">Índice 100% perfeito de conformidade no período.</span>
          </div>
        `;
      } else {
        const categories = top.map((t) => t.nome?.substring(0, 26) + (t.nome?.length > 26 ? "..." : ""));
        const dataDev = top.map((t) => Number(t.qtdDevolvida) || 0);

        elTopProd.innerHTML = "";
        devolucoesCharts.topProd = new ApexCharts(elTopProd, {
          chart: {
            height: 280,
            type: "bar",
            toolbar: { show: false },
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          plotOptions: {
            bar: {
              horizontal: true,
              barHeight: "50%",
              borderRadius: 3,
            },
          },
          colors: ["#e85c2a"],
          grid: { borderColor: "#eee8e0", strokeDashArray: 0 },
          series: [{ name: "Qtd Devolvida", data: dataDev }],
          xaxis: {
            categories,
            labels: {
              style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" },
              formatter: (val) => Math.round(Number(val) || 0),
            },
          },
          yaxis: {
            labels: {
              style: { colors: "#44403c", fontSize: "11px", fontFamily: "Inter, sans-serif", fontWeight: 600 },
            },
          },
          tooltip: {
            y: {
              formatter: (val, opts) => {
                const idx = opts?.dataPointIndex ?? -1;
                const item = idx >= 0 && top[idx] ? top[idx] : null;
                const taxa = item ? item.taxaDevolucaoPct : 0;
                const vendidas = item ? item.qtdVendida : 0;
                return `${val || 0} devoluções (Taxa: ${taxa}% sobre ${vendidas} vendidos)`;
              },
            },
          },
        });
        devolucoesCharts.topProd.render();
      }
    }
  } catch (errTopProd) {
    console.error("[Dashboard Devoluções] Erro ao renderizar Top Produtos:", errTopProd);
  }

  // ── Gráfico 4: Taxa por Categoria ──────────────────────────────────────────
  try {
    const elCat = document.querySelector("#chart-devolucoes-categorias");
    if (elCat && graficos.categorias) {
      const labels = graficos.categorias.labels || [];
      const series = graficos.categorias.series || [];
      const total = series.reduce((a, b) => a + (Number(b) || 0), 0);

      if (total === 0 || labels.length === 0) {
        elCat.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">🏷️</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Sem devoluções por categoria</span>
            <span style="font-size:0.76rem; color:#78716c;">Nenhuma linha de produto com inconformidades no filtro.</span>
          </div>
        `;
      } else {
        elCat.innerHTML = "";
        devolucoesCharts.categorias = new ApexCharts(elCat, {
          chart: {
            height: 280,
            type: "donut",
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          series,
          labels,
          colors: ["#e85c2a", "#0284c7", "#10b981", "#f59e0b", "#64748b"],
          dataLabels: {
            enabled: true,
            formatter: (val) => `${Math.round(Number(val) || 0)}%`,
          },
          legend: { position: "bottom", fontFamily: "Inter, sans-serif", fontSize: "12px" },
          stroke: { show: false },
          tooltip: {
            y: { formatter: (val) => `${val || 0} unidade(s) devolvida(s)` },
          },
        });
        devolucoesCharts.categorias.render();
      }
    }
  } catch (errCat) {
    console.error("[Dashboard Devoluções] Erro ao renderizar Categorias:", errCat);
  }

  // ── Gráfico 5: Taxa de Problemas por Fornecedor ────────────────────────────
  try {
    const elForn = document.querySelector("#chart-devolucoes-fornecedores");
    if (elForn && graficos.fornecedores) {
      const labels = graficos.fornecedores.labels || [];
      const series = graficos.fornecedores.series || [];
      const total = series.reduce((a, b) => a + (Number(b) || 0), 0);

      if (total === 0 || labels.length === 0) {
        elForn.innerHTML = `
          <div style="height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78716c; background:#faf8f5; border-radius:8px; border:1px dashed #e7e5e4;">
            <span style="font-size:1.8rem;">🏭</span>
            <span style="font-size:0.86rem; font-weight:700; color:#44403c;">Nenhum defeito de fornecedor</span>
            <span style="font-size:0.76rem; color:#78716c;">Parceiros comerciais sem registro de avarias ou inconformidades.</span>
          </div>
        `;
      } else {
        elForn.innerHTML = "";
        devolucoesCharts.fornecedores = new ApexCharts(elForn, {
          chart: {
            height: 280,
            type: "bar",
            toolbar: { show: false },
            fontFamily: "Inter, sans-serif",
            animations: { enabled: false },
          },
          plotOptions: {
            bar: {
              columnWidth: "40%",
              borderRadius: 3,
            },
          },
          colors: ["#b91c1c"],
          grid: { borderColor: "#eee8e0", strokeDashArray: 0 },
          series: [{ name: "Itens com Defeito", data: series }],
          xaxis: {
            categories: labels,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
              style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" },
            },
          },
          yaxis: {
            min: 0,
            forceNiceScale: true,
            labels: {
              style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" },
              formatter: (val) => Math.round(Number(val) || 0),
            },
          },
          legend: { position: "top", horizontalAlign: "right", fontFamily: "Inter, sans-serif", fontSize: "12px" },
          tooltip: {
            y: { formatter: (val) => `${val || 0} item(ns) reprovado(s)` },
          },
        });
        devolucoesCharts.fornecedores.render();
      }
    }
  } catch (errForn) {
    console.error("[Dashboard Devoluções] Erro ao renderizar Fornecedores:", errForn);
  }

  // ── Gráfico 6: Devoluções por Status e SLA Médio ───────────────────────────
  try {
    const elStatus = document.querySelector("#chart-devolucoes-status");
    if (elStatus && graficos.status) {
      const labels = graficos.status.labels || ["Aberta", "Em Análise", "Concluída", "Recusada"];
      const counts = graficos.status.counts || [0, 0, 0, 0];
      const diasMedio = graficos.status.diasMedio || [0, 0, 0, 0];

      elStatus.innerHTML = "";
      devolucoesCharts.status = new ApexCharts(elStatus, {
        chart: {
          height: 280,
          type: "bar",
          toolbar: { show: false },
          fontFamily: "Inter, sans-serif",
          animations: { enabled: false },
        },
        plotOptions: {
          bar: {
            columnWidth: "45%",
            borderRadius: 3,
          },
        },
        colors: ["#0284c7", "#f59e0b"],
        grid: { borderColor: "#eee8e0", strokeDashArray: 0 },
        series: [
          { name: "Total de Casos", data: counts },
          { name: "Tempo Médio (Dias)", data: diasMedio },
        ],
        xaxis: {
          categories: labels,
          axisBorder: { show: false },
          axisTicks: { show: false },
          labels: {
            style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" },
          },
        },
        yaxis: {
          min: 0,
          forceNiceScale: true,
          labels: {
            style: { colors: "#78716c", fontSize: "11px", fontFamily: "Inter, sans-serif" },
            formatter: (val) => Math.round(Number(val) || 0),
          },
        },
        legend: { position: "top", horizontalAlign: "right", fontFamily: "Inter, sans-serif", fontSize: "12px" },
        tooltip: {
          shared: true,
          intersect: false,
          y: {
            formatter: (val, opts) => {
              if (opts.seriesIndex === 1) return `${val || 0} dia(s) em média`;
              return `${val || 0} caso(s)`;
            },
          },
        },
      });
      devolucoesCharts.status.render();
    }
  } catch (errStatus) {
    console.error("[Dashboard Devoluções] Erro ao renderizar Status:", errStatus);
  }
}

async function renderTabelaDevolucoesRecentes(page = 1) {
  const tbody = document.getElementById("tbody-devolucoes-recentes");
  const badgeTotal = document.getElementById("badge-total-devolucoes-recentes");
  const infoPaginacao = document.getElementById("info-paginacao-devolucoes");
  const numPagina = document.getElementById("num-pagina-devolucoes");
  const btnPrev = document.getElementById("btn-pag-prev-devolucoes");
  const btnNext = document.getElementById("btn-pag-next-devolucoes");

  if (!tbody) return;

  const selectPeriodo = document.getElementById("filtro-devolucoes-periodo");
  const selectMotivo = document.getElementById("filtro-devolucoes-motivo");
  const selectCategoria = document.getElementById("filtro-devolucoes-categoria");
  const selectFornecedor = document.getElementById("filtro-devolucoes-fornecedor");

  const motivo = selectMotivo ? selectMotivo.value : "ALL";
  const categoryId = selectCategoria ? selectCategoria.value : "ALL";
  const supplierId = selectFornecedor ? selectFornecedor.value : "ALL";

  tbody.innerHTML = `
    <tr>
      <td colspan="9" style="text-align: center; padding: 24px; color: var(--muted);">
        Carregando ocorrências de devolução...
      </td>
    </tr>
  `;

  let responseData = null;

  if (window.RezFireAPI && window.RezFireAPI.dashboard && window.RezFireAPI.dashboard.recentReturns) {
    try {
      const apiParams = { page, limit: 10 };
      if (motivo && motivo !== "ALL") apiParams.motivo = motivo;
      if (categoryId && categoryId !== "ALL") apiParams.categoryId = categoryId;
      if (supplierId && supplierId !== "ALL") apiParams.supplierId = supplierId;

      responseData = await window.RezFireAPI.dashboard.recentReturns(apiParams);
    } catch (e) {
      console.warn("[Dashboard Devoluções] Falha na consulta de recentes via API:", e);
    }
  }

  if (!responseData || !responseData.sucesso) {
    // Fallback local caso backend esteja offline
    responseData = {
      sucesso: true,
      paginacao: { page: 1, limit: 10, total: 5, totalPages: 1 },
      dados: [
        {
          idDevolucao: 1,
          codigoDevolucao: "DEV-2026-001",
          idPedido: 1,
          codigoPedido: "PED-2026-001",
          clienteNome: "Condomínio Edifício Solar",
          status: "CONCLUIDA",
          tipoResolucao: "REEMBOLSO",
          custoTotalCaso: 148.5,
          prazoLimiteDias: 7,
          diasDecorridos: 3,
          emAtraso: false,
          produto: {
            nome: "Extintor Pó Químico Seco ABC 4kg",
            sku: "EXT-ABC-04KG",
            quantidade: 1,
            motivo: "DEFEITO",
            destinoItem: "DESCARTADO",
            fornecedorNome: "Resil Extintores",
          },
        },
        {
          idDevolucao: 2,
          codigoDevolucao: "DEV-2026-002",
          idPedido: 2,
          codigoPedido: "PED-2026-002",
          clienteNome: "Comércio de Materiais Rezende",
          status: "CONCLUIDA",
          tipoResolucao: "TROCA",
          custoTotalCaso: 182.0,
          prazoLimiteDias: 7,
          diasDecorridos: 4,
          emAtraso: false,
          produto: {
            nome: "Extintor Dióxido de Carbono CO2 6kg",
            sku: "EXT-CO2-06KG",
            quantidade: 1,
            motivo: "AVARIA_TRANSPORTE",
            destinoItem: "DESCARTADO",
            fornecedorNome: "Bucka Fire Systems",
          },
        },
        {
          idDevolucao: 4,
          codigoDevolucao: "DEV-2026-004",
          idPedido: 4,
          codigoPedido: "PED-2026-004",
          clienteNome: "Transportadora Rápido Sul",
          status: "EM_ANALISE",
          tipoResolucao: "TROCA",
          custoTotalCaso: 30.0,
          prazoLimiteDias: 7,
          diasDecorridos: 9,
          emAtraso: true,
          produto: {
            nome: "Extintor Pó Químico Seco ABC 4kg",
            sku: "EXT-ABC-04KG",
            quantidade: 1,
            motivo: "DEFEITO",
            destinoItem: "EM_AVALIACAO",
            fornecedorNome: "Resil Extintores",
          },
        },
      ],
    };
  }

  const pag = responseData.paginacao || { page: 1, limit: 10, total: 0, totalPages: 1 };
  devolucoesPaginacao = pag;

  if (badgeTotal) {
    badgeTotal.textContent = `${pag.total} ocorrência(s)`;
  }

  if (infoPaginacao) {
    const start = pag.total === 0 ? 0 : (pag.page - 1) * pag.limit + 1;
    const end = Math.min(pag.page * pag.limit, pag.total);
    infoPaginacao.textContent = `Mostrando ${start} a ${end} de ${pag.total} ocorrência(s)`;
  }

  if (numPagina) {
    numPagina.textContent = `${pag.page} / ${pag.totalPages || 1}`;
  }

  if (btnPrev) btnPrev.disabled = pag.page <= 1;
  if (btnNext) btnNext.disabled = pag.page >= pag.totalPages;

  const itens = responseData.dados || [];

  if (itens.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 24px; color: var(--muted);">
          Nenhuma ocorrência de devolução encontrada com os filtros selecionados.
        </td>
      </tr>
    `;
    return;
  }

  const money = (val) => Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const motivoMap = {
    DEFEITO: { label: "Defeito", color: "#dc2626", bg: "#fef2f2" },
    AVARIA_TRANSPORTE: { label: "Avaria Frete", color: "#d97706", bg: "#fffbeb" },
    PRODUTO_ERRADO: { label: "Produto Errado", color: "#7c3aed", bg: "#f5f3ff" },
    DIVERGENCIA_DESCRICAO: { label: "Divergência", color: "#0284c7", bg: "#f0f9ff" },
    ARREPENDIMENTO: { label: "Arrependimento", color: "#16a34a", bg: "#f0fdf4" },
    OUTRO: { label: "Outro", color: "#64748b", bg: "#f8fafc" },
  };

  const statusMap = {
    ABERTA: { label: "Aberta", color: "#0284c7", bg: "#f0f9ff" },
    EM_ANALISE: { label: "Em Análise", color: "#d97706", bg: "#fffbeb" },
    CONCLUIDA: { label: "Concluída", color: "#16a34a", bg: "#f0fdf4" },
    RECUSADA: { label: "Recusada", color: "#dc2626", bg: "#fef2f2" },
  };

  const destinoMap = {
    RECUPERADO: { label: "Estoque", icon: "🟢" },
    DESCARTADO: { label: "Descarte", icon: "🔴" },
    EM_AVALIACAO: { label: "Avaliação", icon: "🟡" },
  };

  tbody.innerHTML = itens
    .map((item) => {
      const mot = motivoMap[item.produto.motivo] || { label: item.produto.motivo, color: "#64748b", bg: "#f8fafc" };
      const st = statusMap[item.status] || { label: item.status, color: "#64748b", bg: "#f8fafc" };
      const dest = destinoMap[item.produto.destinoItem] || { label: item.produto.destinoItem, icon: "⚪" };

      const slaBadge = item.emAtraso
        ? `<span class="badge" style="background:#fee2e2; color:#991b1b; font-weight:700;">⚠️ ${item.diasDecorridos}d (Atrasado)</span>`
        : `<span style="color:#78716c; font-size:0.8rem;">${item.diasDecorridos}d / limite ${item.prazoLimiteDias}d</span>`;

      return `
        <tr style="border-bottom: 1px solid var(--line);">
          <td style="padding: 10px 8px; font-weight: 700; color: var(--ink);">
            ${escapeHtml(item.codigoDevolucao)}
          </td>
          <td style="padding: 10px 8px;">
            <div style="font-weight: 600; color: var(--ink);">${escapeHtml(item.clienteNome)}</div>
            <div style="font-size: 0.73rem; color: #78716c;">Pedido: ${escapeHtml(item.codigoPedido || "—")}</div>
          </td>
          <td style="padding: 10px 8px;">
            <div style="font-weight: 600; color: var(--ink);">${escapeHtml(item.produto.nome)}</div>
            <div style="font-size: 0.73rem; color: #78716c;">${item.produto.quantidade}x • Fornecedor: ${escapeHtml(item.produto.fornecedorNome)}</div>
          </td>
          <td style="padding: 10px 8px; text-align: center;">
            <span style="font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; background: ${mot.bg}; color: ${mot.color};">
              ${mot.label}
            </span>
          </td>
          <td style="padding: 10px 8px; text-align: center;">
            <span style="font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; background: ${st.bg}; color: ${st.color};">
              ${st.label}
            </span>
          </td>
          <td style="padding: 10px 8px; text-align: center; font-weight: 600; font-size: 0.8rem; color: #44403c;">
            ${escapeHtml(item.tipoResolucao)}
          </td>
          <td style="padding: 10px 8px; text-align: center; font-size: 0.8rem;">
            ${dest.icon} ${dest.label}
          </td>
          <td style="padding: 10px 8px; text-align: right; font-weight: 700; color: var(--ink);">
            ${money(item.custoTotalCaso)}
          </td>
          <td style="padding: 10px 8px; text-align: center;">
            ${slaBadge}
          </td>
        </tr>
      `;
    })
    .join("");
}

function gerarMetricasDevolucoesFallback(dias, motivo, categoryId, supplierId) {
  return {
    sucesso: true,
    kpis: {
      totalDevolucoes: { valor: 5, deltaPercentual: 400, deltaSentidoBom: false, tooltip: "Quantidade total de devoluções no período." },
      taxaDevolucao: { valor: 2.1, taxaValorPercentual: 1.8, deltaPercentual: 25.0, deltaSentidoBom: false, tooltip: "Percentual de itens devolvidos em relação ao total vendido." },
      valorReembolsado: { valor: 319.8, deltaPercentual: 113.3, deltaSentidoBom: false, tooltip: "Total ressarcido diretamente aos clientes." },
      custoTotalDevolucoes: { valor: 715.1, freteReverso: 115.5, perdaDescarte: 279.8, deltaPercentual: 120.2, deltaSentidoBom: false, tooltip: "Impacto total: Reembolso + Frete reverso + Descarte." },
      tempoMedioResolucao: { valor: 3.3, deltaPercentual: -17.5, deltaSentidoBom: true, tooltip: "Média de dias de resolução." },
      devolucoesAbertas: { valor: 2, atrasadas: 1, deltaPercentual: null, deltaSentidoBom: false, tooltip: "Casos em aberto e atrasados." },
      trocaVsReembolso: { valor: "60% / 40%", shareTroca: 60, shareReembolso: 40, deltaPercentual: null, deltaSentidoBom: true, tooltip: "Troca vs Reembolso." },
      itensRecuperadosVsPerdidos: { valor: "1 / 2", recuperados: 1, descartados: 2, emAvaliacao: 2, deltaPercentual: null, deltaSentidoBom: false, tooltip: "Estoque vs Descarte." },
    },
    alertas: [
      {
        id: "alerta-sla-atrasadas",
        tipo: "sla_estourado",
        severidade: "critico",
        titulo: "1 devolução pendente além do prazo de 7 dias",
        mensagem: "Existe 1 processo de devolução/troca em aberto há mais tempo que o SLA estabelecido. Risco iminente de penalidade no Mercado Livre.",
        valorAtual: "1 caso(s)",
        limiteConfigurado: "7 dias",
        acaoTexto: "Filtrar Pendentes",
        acaoLink: "#tabela-devolucoes-recentes",
      },
      {
        id: "alerta-dominancia-motivo",
        tipo: "dominancia_motivo",
        severidade: "atencao",
        titulo: 'Alta concentração em "Defeito de Fabricação": 40.0% dos chamados',
        mensagem: "O motivo principal concentra 40.0% de todas as devoluções registradas no período. Requer plano de ação focado na causa raiz.",
        valorAtual: "40.0%",
        limiteConfigurado: "40%",
        acaoTexto: "Ver Motivos",
        acaoLink: "#chart-devolucoes-pareto",
      },
    ],
    graficos: {
      timeline: {
        categories: ["10/11", "12/11", "14/11", "16/11", "18/11"],
        devolucoes: [1, 1, 1, 1, 1],
        itens: [1, 1, 1, 1, 1],
      },
      pareto: {
        labels: ["Defeito de Fabricação", "Avaria de Transporte", "Arrependimento / Desistência", "Produto Errado (Expedição)"],
        ocorrencias: [2, 1, 1, 1],
        acumuladoPct: [40, 60, 80, 100],
      },
      topProdutos: [
        { idProduto: 12, nome: "Extintor Pó Químico Seco ABC 4kg", sku: "EXT-ABC-04KG", qtdDevolvida: 2, qtdVendida: 18, taxaDevolucaoPct: 11.1, valorDevolvido: 136.0 },
        { idProduto: 13, nome: "Extintor Dióxido de Carbono CO2 6kg", sku: "EXT-CO2-06KG", qtdDevolvida: 1, qtdVendida: 12, taxaDevolucaoPct: 8.3, valorDevolvido: 180.0 },
        { idProduto: 15, nome: "Extintor Água Pressurizada 10L", sku: "EXT-AP-10L", qtdDevolvida: 1, qtdVendida: 15, taxaDevolucaoPct: 6.7, valorDevolvido: 85.0 },
      ],
      categorias: {
        labels: ["Extintores", "Acessórios", "Sinalização"],
        series: [4, 1, 0],
      },
      fornecedores: {
        labels: ["Resil Extintores", "Bucka Fire Systems"],
        series: [2, 1],
      },
      status: {
        labels: ["Aberta", "Em Análise", "Concluída", "Recusada"],
        counts: [1, 1, 3, 0],
        diasMedio: [2.0, 9.0, 3.3, 0],
      },
    },
  };
}

// ============================================================================
// GUIA DE DASHBOARD: FISCAL & NF-E (SEFAZ)
// ============================================================================

let fiscalCharts = {};
let fiscalPaginacao = { page: 1, limit: 10, totalPages: 1, total: 0 };
let fiscalFiltroStatusTabela = "ALL";
let fiscalFiltroTipoTabela = "ALL";

function setupFiscalEventListeners() {
  const selectPeriodo = document.getElementById("filtro-fiscal-periodo");
  const selectStatus = document.getElementById("filtro-fiscal-status");
  const selectTipo = document.getElementById("filtro-fiscal-tipo");
  const inputParceiro = document.getElementById("filtro-fiscal-parceiro");
  const inputBuscaTabela = document.getElementById("filtro-fiscal-tabela-busca");
  const btnRecarregar = document.getElementById("btn-recarregar-dash-fiscal");
  const btnTentar = document.getElementById("btn-tentar-novamente-dash-fiscal");
  const btnPrev = document.getElementById("btn-pag-prev-fiscal");
  const btnNext = document.getElementById("btn-pag-next-fiscal");
  const customDatasDiv = document.getElementById("filtro-fiscal-datas-custom");
  const dataDe = document.getElementById("filtro-fiscal-data-de");
  const dataAte = document.getElementById("filtro-fiscal-data-ate");

  if (selectPeriodo && !selectPeriodo.dataset.bound) {
    selectPeriodo.dataset.bound = "true";
    selectPeriodo.addEventListener("change", () => {
      if (selectPeriodo.value === "custom") {
        if (customDatasDiv) customDatasDiv.classList.remove("hidden");
        if (customDatasDiv) customDatasDiv.classList.add("flex");
      } else {
        if (customDatasDiv) customDatasDiv.classList.add("hidden");
        if (customDatasDiv) customDatasDiv.classList.remove("flex");
        fiscalPaginacao.page = 1;
        renderTabFiscal();
      }
    });
  }

  [dataDe, dataAte].forEach((inp) => {
    if (inp && !inp.dataset.bound) {
      inp.dataset.bound = "true";
      inp.addEventListener("change", () => {
        fiscalPaginacao.page = 1;
        renderTabFiscal();
      });
    }
  });

  const triggers = [selectStatus, selectTipo, btnRecarregar, btnTentar];
  triggers.forEach((el) => {
    if (el && !el.dataset.bound) {
      el.dataset.bound = "true";
      const evt = el.tagName === "SELECT" ? "change" : "click";
      el.addEventListener(evt, () => {
        fiscalPaginacao.page = 1;
        renderTabFiscal();
      });
    }
  });

  let parceiroTimeout;
  if (inputParceiro && !inputParceiro.dataset.bound) {
    inputParceiro.dataset.bound = "true";
    inputParceiro.addEventListener("input", () => {
      clearTimeout(parceiroTimeout);
      parceiroTimeout = setTimeout(() => {
        fiscalPaginacao.page = 1;
        renderTabFiscal();
      }, 400);
    });
  }

  let buscaTimeout;
  if (inputBuscaTabela && !inputBuscaTabela.dataset.bound) {
    inputBuscaTabela.dataset.bound = "true";
    inputBuscaTabela.addEventListener("input", () => {
      clearTimeout(buscaTimeout);
      buscaTimeout = setTimeout(() => {
        fiscalPaginacao.page = 1;
        renderTabelaFiscalNotas(1);
      }, 350);
    });
  }

  if (btnPrev && !btnPrev.dataset.bound) {
    btnPrev.dataset.bound = "true";
    btnPrev.addEventListener("click", () => {
      if (fiscalPaginacao.page > 1) {
        renderTabelaFiscalNotas(fiscalPaginacao.page - 1);
      }
    });
  }

  if (btnNext && !btnNext.dataset.bound) {
    btnNext.dataset.bound = "true";
    btnNext.addEventListener("click", () => {
      if (fiscalPaginacao.page < fiscalPaginacao.totalPages) {
        renderTabelaFiscalNotas(fiscalPaginacao.page + 1);
      }
    });
  }
}

async function renderTabFiscal() {
  setupFiscalEventListeners();

  const selectPeriodo = document.getElementById("filtro-fiscal-periodo");
  const selectStatus = document.getElementById("filtro-fiscal-status");
  const selectTipo = document.getElementById("filtro-fiscal-tipo");
  const inputParceiro = document.getElementById("filtro-fiscal-parceiro");
  const dataDe = document.getElementById("filtro-fiscal-data-de");
  const dataAte = document.getElementById("filtro-fiscal-data-ate");
  const loadingEl = document.getElementById("fiscal-loading");
  const erroContainer = document.getElementById("fiscal-error");
  const msgErroEl = document.getElementById("fiscal-error-msg");

  const isCustom = selectPeriodo && selectPeriodo.value === "custom";
  const dias = !isCustom && selectPeriodo ? Number(selectPeriodo.value) || 30 : 30;
  const status = selectStatus ? selectStatus.value : "ALL";
  const tipo = selectTipo ? selectTipo.value : "ALL";
  const partnerId = inputParceiro ? inputParceiro.value : "ALL";

  fiscalFiltroStatusTabela = status;
  fiscalFiltroTipoTabela = tipo;

  const money = (val) => {
    return Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  try {
    if (erroContainer) erroContainer.classList.add("hidden");
    if (loadingEl) loadingEl.classList.remove("hidden");

    let dados = null;

    if (window.RezFireAPI && window.RezFireAPI.dashboard && window.RezFireAPI.dashboard.fiscal) {
      try {
        const params = {
          status,
          tipo,
          partnerId,
        };
        if (isCustom && dataDe && dataDe.value) params.from = dataDe.value;
        if (isCustom && dataAte && dataAte.value) params.to = dataAte.value;
        if (!isCustom) params.dias = dias;

        const res = await window.RezFireAPI.dashboard.fiscal(params);
        if (res && res.sucesso) {
          dados = res;
        }
      } catch (apiErr) {
        console.warn("[Dashboard Fiscal] API indisponível, avaliando fallback local:", apiErr);
      }
    }

    if (!dados) {
      dados = gerarMetricasFiscalFallback(dias, status, tipo, partnerId);
    }

    if (loadingEl) loadingEl.classList.add("hidden");

    renderKpisFiscal(dados.kpis, money);
    renderAlertasFiscal(dados.alertas || []);
    renderGraficosFiscal(dados.graficos, money);
    renderConciliacaoEntradas(dados.conciliacoesEntrada || [], money);
    await renderTabelaFiscalNotas(fiscalPaginacao.page);

    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 150);
  } catch (err) {
    console.error("[Dashboard Fiscal] Erro ao carregar aba:", err);
    if (loadingEl) loadingEl.classList.add("hidden");
    if (erroContainer) {
      erroContainer.classList.remove("hidden");
      if (msgErroEl) msgErroEl.textContent = err.message || "Erro desconhecido ao processar dados fiscais.";
    }
  }
}

function renderKpisFiscal(kpis, money) {
  const container = document.getElementById("kpis-tab-fiscal");
  if (!container || !kpis) return;

  const cardsConfig = [
    {
      chave: "notasEmitidas",
      titulo: "Notas Emitidas",
      icone: "📄",
      corIcone: "bg-blue-100 text-blue-800",
    },
    {
      chave: "valorFaturado",
      titulo: "Valor Faturado (NF-e)",
      icone: "💰",
      corIcone: "bg-emerald-100 text-emerald-800",
    },
    {
      chave: "inconformidades",
      titulo: "Canceladas / Rejeitadas",
      icone: "⚠️",
      corIcone: "bg-rose-100 text-rose-800",
    },
    {
      chave: "pedidosSemNfe",
      titulo: "Pendências de Emissão",
      icone: "⏳",
      corIcone: "bg-amber-100 text-amber-800",
    },
    {
      chave: "impostosPeriodo",
      titulo: "Tributos Apurados",
      icone: "🏛️",
      corIcone: "bg-purple-100 text-purple-800",
    },
    {
      chave: "tempoMedioEmissao",
      titulo: "Tempo Médio Emissão",
      icone: "⏱️",
      corIcone: "bg-teal-100 text-teal-800",
    },
  ];

  container.innerHTML = cardsConfig
    .map((cfg) => {
      const kpi = kpis[cfg.chave] || { valor: 0, valorFormatado: "0", deltaPercentual: null, tooltip: "" };
      const valStr = kpi.valorFormatado || String(kpi.valor || 0);

      let deltaHtml = "";
      if (kpi.deltaPercentual !== null && kpi.deltaPercentual !== undefined) {
        const isPositivo = kpi.deltaPercentual > 0;
        const isNeutro = kpi.deltaPercentual === 0;
        const eBom = kpi.deltaSentidoBom ? isPositivo : !isPositivo;

        const corClasse = isNeutro
          ? "text-stone-500 bg-stone-100"
          : eBom
          ? "text-emerald-700 bg-emerald-50"
          : "text-rose-700 bg-rose-50";

        const seta = isNeutro ? "—" : isPositivo ? "↑" : "↓";
        const sinal = isPositivo ? "+" : "";
        deltaHtml = `
          <span class="text-xs font-bold px-1.5 py-0.5 rounded ${corClasse}" title="Variação em relação ao período anterior">
            ${seta} ${sinal}${kpi.deltaPercentual}%
          </span>
        `;
      }

      const subtextoHtml = kpi.subtexto ? `<p class="text-2xs text-stone-400 mt-1">${kpi.subtexto}</p>` : "";

      return `
        <div class="kpi-card p-4 bg-white rounded-xl border border-stone-200 shadow-xs hover:border-amber-400 transition" title="${kpi.tooltip || ""}">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-stone-500 uppercase tracking-wider">${cfg.titulo}</span>
            <span class="text-sm p-1.5 rounded-lg ${cfg.corIcone}">${cfg.icone}</span>
          </div>
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-xl font-black text-stone-900 tracking-tight">${valStr}</span>
            ${deltaHtml}
          </div>
          ${subtextoHtml}
        </div>
      `;
    })
    .join("");
}

function renderAlertasFiscal(alertas) {
  const container = document.getElementById("container-alertas-fiscal");
  const badgeTotal = document.getElementById("badge-total-alertas-fiscal");
  if (!container) return;

  if (badgeTotal) {
    badgeTotal.textContent = `${alertas.length} alerta${alertas.length !== 1 ? "s" : ""}`;
    if (alertas.length === 0) {
      badgeTotal.className = "text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200";
    } else {
      badgeTotal.className = "text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200";
    }
  }

  if (alertas.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
        <p class="text-xs font-bold text-emerald-800">✅ Nenhum ponto de atenção fiscal ou SEFAZ no momento</p>
        <p class="text-2xs text-emerald-600 mt-0.5">Todas as notas fiscais foram autorizadas e os prazos de faturamento estão em conformidade.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = alertas
    .map((alerta) => {
      const isCritico = alerta.severidade === "critico";
      const cardBg = isCritico ? "bg-red-50/80 border-red-200" : "bg-amber-50/80 border-amber-200";
      const badgeCor = isCritico ? "bg-red-600 text-white" : "bg-amber-500 text-white";
      const rotuloSeveridade = isCritico ? "CRÍTICO" : "ATENÇÃO";
      const icon = isCritico ? "🚨" : "⚠️";

      return `
        <div class="p-3.5 rounded-xl border ${cardBg} flex flex-col justify-between shadow-xs">
          <div>
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="text-xs font-extrabold uppercase px-2 py-0.5 rounded ${badgeCor} tracking-wider flex items-center gap-1">
                <span>${icon}</span> ${rotuloSeveridade}
              </span>
              <span class="text-2xs font-semibold text-stone-500">Limite: ${alerta.limiteConfigurado}</span>
            </div>
            <h4 class="font-bold text-stone-900 text-xs mt-1 mb-1">${alerta.titulo}</h4>
            <p class="text-2xs text-stone-600 leading-relaxed mb-3">${alerta.mensagem}</p>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-stone-200/60 mt-auto">
            <span class="text-2xs font-bold text-stone-700">Atual: <strong class="text-stone-900">${alerta.valorAtual}</strong></span>
            <button type="button" class="btn-acao-alerta-fiscal px-2.5 py-1 text-2xs font-bold rounded bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 shadow-2xs transition"
              data-filtro-status="${alerta.filtroStatus || ""}"
              data-filtro-tipo="${alerta.filtroTipo || ""}"
              data-acao-link="${alerta.acaoLink || ""}">
              ${alerta.acaoTexto} &rarr;
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  // Vincula evento de clique nos botões de ação dos alertas
  container.querySelectorAll(".btn-acao-alerta-fiscal").forEach((btn) => {
    btn.addEventListener("click", () => {
      const link = btn.dataset.acaoLink;
      if (link) {
        window.location.href = link;
        return;
      }
      const st = btn.dataset.filtroStatus;
      const tp = btn.dataset.filtroTipo;
      const selectStatus = document.getElementById("filtro-fiscal-status");
      const selectTipo = document.getElementById("filtro-fiscal-tipo");

      if (st && selectStatus) {
        selectStatus.value = st;
        fiscalFiltroStatusTabela = st;
      }
      if (tp && selectTipo) {
        selectTipo.value = tp;
        fiscalFiltroTipoTabela = tp;
      }

      fiscalPaginacao.page = 1;
      renderTabelaFiscalNotas(1);

      // Scroll suave até a tabela de notas
      const tabEl = document.getElementById("tabela-fiscal-notas-body");
      if (tabEl) {
        tabEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
}

function renderGraficosFiscal(graficos, money) {
  if (!graficos || typeof ApexCharts === "undefined") return;

  // 1. Gráfico de Linha/Barras: Evolução do Faturamento & Emissões
  const elEvolucao = document.getElementById("chart-fiscal-evolucao");
  if (elEvolucao && graficos.evolucao) {
    if (fiscalCharts.evolucao) fiscalCharts.evolucao.destroy();

    const optionsEvolucao = {
      chart: {
        type: "line",
        height: 290,
        toolbar: { show: false },
        fontFamily: "inherit",
      },
      series: [
        {
          name: "Notas Autorizadas (un.)",
          type: "column",
          data: graficos.evolucao.qtdNotas || [],
        },
        {
          name: "Valor Faturado (R$)",
          type: "line",
          data: graficos.evolucao.faturamento || [],
        },
      ],
      colors: ["#f59e0b", "#10b981"],
      stroke: { width: [0, 3], curve: "smooth" },
      plotOptions: {
        bar: { columnWidth: "45%", borderRadius: 4 },
      },
      xaxis: {
        categories: graficos.evolucao.categorias || [],
        labels: { style: { fontSize: "11px" } },
      },
      yaxis: [
        {
          title: { text: "Quantidade", style: { fontSize: "10px", color: "#f59e0b" } },
          labels: { formatter: (v) => Math.round(v) },
        },
        {
          opposite: true,
          title: { text: "Faturamento (R$)", style: { fontSize: "10px", color: "#10b981" } },
          labels: { formatter: (v) => "R$ " + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v) },
        },
      ],
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: (val, opts) => {
            if (opts.seriesIndex === 1) return money(val);
            return val + " notas";
          },
        },
      },
      legend: { position: "top", fontSize: "12px" },
    };

    fiscalCharts.evolucao = new ApexCharts(elEvolucao, optionsEvolucao);
    fiscalCharts.evolucao.render();
  }

  // 2. Gráfico Donut: Distribuição por Status na SEFAZ
  const elStatus = document.getElementById("chart-fiscal-status");
  if (elStatus && graficos.distribuicaoStatus) {
    if (fiscalCharts.status) fiscalCharts.status.destroy();

    const optionsStatus = {
      chart: {
        type: "donut",
        height: 290,
        fontFamily: "inherit",
      },
      labels: graficos.distribuicaoStatus.labels || ["Autorizada", "Cancelada", "Rejeitada", "Inutilizada", "Outras"],
      series: graficos.distribuicaoStatus.series || [28, 2, 2, 1, 1],
      colors: ["#10b981", "#78716c", "#ef4444", "#a8a29e", "#3b82f6"],
      legend: { position: "bottom", fontSize: "11px" },
      dataLabels: { enabled: true, formatter: (val) => val.toFixed(1) + "%" },
      plotOptions: {
        pie: {
          donut: {
            size: "65%",
            labels: {
              show: true,
              total: {
                show: true,
                label: "Total NF-e",
                formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0),
              },
            },
          },
        },
      },
    };

    fiscalCharts.status = new ApexCharts(elStatus, optionsStatus);
    fiscalCharts.status.render();
  }

  // 3. Gráfico de Barras Empilhadas: Tributos por Tipo
  const elImpostos = document.getElementById("chart-fiscal-impostos");
  if (elImpostos && graficos.impostosEmpilhados) {
    if (fiscalCharts.impostos) fiscalCharts.impostos.destroy();

    const optionsImpostos = {
      chart: {
        type: "bar",
        height: 290,
        stacked: true,
        toolbar: { show: false },
        fontFamily: "inherit",
      },
      series: graficos.impostosEmpilhados.series || [],
      colors: ["#3b82f6", "#8b5cf6", "#ec4899", "#10b981"],
      xaxis: {
        categories: graficos.impostosEmpilhados.categorias || [],
        labels: { style: { fontSize: "11px" } },
      },
      yaxis: {
        labels: { formatter: (v) => "R$ " + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v) },
      },
      legend: { position: "top", fontSize: "11px" },
      tooltip: {
        y: { formatter: (v) => money(v) },
      },
      plotOptions: {
        bar: { borderRadius: 3, columnWidth: "50%" },
      },
    };

    fiscalCharts.impostos = new ApexCharts(elImpostos, optionsImpostos);
    fiscalCharts.impostos.render();
  }

  // 4. Ranking de Rejeições e Cancelamentos
  const elRanking = document.getElementById("container-fiscal-ranking");
  if (elRanking && graficos.rankingRejeicoes) {
    elRanking.innerHTML = graficos.rankingRejeicoes
      .map((item, idx) => {
        const isRejeicao = item.tipo === "Rejeição SEFAZ";
        const badgeCor = isRejeicao ? "bg-red-100 text-red-800 border-red-200" : "bg-stone-100 text-stone-800 border-stone-200";

        return `
          <div class="flex items-center justify-between p-2.5 rounded-lg border border-stone-100 bg-stone-50/50 hover:bg-stone-50 transition">
            <div class="flex items-start gap-2 max-w-[80%]">
              <span class="font-bold text-xs text-stone-400 mt-0.5">#${idx + 1}</span>
              <div>
                <p class="font-bold text-xs text-stone-900">${item.motivo}</p>
                <span class="inline-block mt-0.5 text-2xs px-1.5 py-0.5 rounded border ${badgeCor}">${item.tipo}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="font-black text-sm text-stone-900">${item.total}</span>
              <p class="text-2xs text-stone-400">ocorrências</p>
            </div>
          </div>
        `;
      })
      .join("");
  }
}

function renderConciliacaoEntradas(conciliacoes, money) {
  const tbody = document.getElementById("tabela-conciliacao-entradas-body");
  if (!tbody) return;

  if (conciliacoes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-stone-400 text-xs">
          Nenhuma nota fiscal de entrada registrada no período.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = conciliacoes
    .map((c) => {
      return `
        <tr class="hover:bg-stone-50 transition">
          <td class="py-2.5 px-3 font-semibold text-stone-900">${c.fornecedor}</td>
          <td class="py-2.5 px-3 font-mono text-stone-700">${c.numero_nfe}</td>
          <td class="py-2.5 px-3 text-right font-bold text-stone-900">${c.valor_nfe_formatado}</td>
          <td class="py-2.5 px-3 font-mono text-stone-600">${c.numero_po || '<span class="text-stone-400">—</span>'}</td>
          <td class="py-2.5 px-3 text-right text-stone-700">${c.valor_po_formatado}</td>
          <td class="py-2.5 px-3 text-right font-bold ${c.diferenca_valor > 0 ? 'text-amber-700' : 'text-stone-500'}">
            ${c.diferenca_formatada}
          </td>
          <td class="py-2.5 px-3 text-center">
            <span class="inline-block px-2 py-0.5 rounded-full border text-2xs font-bold ${c.badge_classe}">
              ${c.status_rotulo}
            </span>
          </td>
          <td class="py-2.5 px-3 text-right text-stone-500">${c.data_entrada}</td>
        </tr>
      `;
    })
    .join("");
}

async function renderTabelaFiscalNotas(page = 1) {
  const tbody = document.getElementById("tabela-fiscal-notas-body");
  const infoPag = document.getElementById("info-paginacao-fiscal");
  const numPag = document.getElementById("num-pagina-fiscal");
  const btnPrev = document.getElementById("btn-pag-prev-fiscal");
  const btnNext = document.getElementById("btn-pag-next-fiscal");
  const inputBusca = document.getElementById("filtro-fiscal-tabela-busca");

  fiscalPaginacao.page = page;

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-6 text-stone-400 text-xs">
          <div class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-amber-500 border-t-transparent mr-2"></div>
          Carregando notas fiscais...
        </td>
      </tr>
    `;
  }

  try {
    let res = null;
    const search = inputBusca ? inputBusca.value : "";
    const params = {
      page: fiscalPaginacao.page,
      limit: fiscalPaginacao.limit,
      status: fiscalFiltroStatusTabela,
      tipo: fiscalFiltroTipoTabela,
      search,
    };

    if (window.RezFireAPI && window.RezFireAPI.dashboard && window.RezFireAPI.dashboard.fiscalNotas) {
      res = await window.RezFireAPI.dashboard.fiscalNotas(params);
    }

    if (!res || !res.sucesso) {
      res = obterTabelaFiscalNotasFallback(fiscalPaginacao.page, fiscalPaginacao.limit, params);
    }

    fiscalPaginacao.total = res.total || 0;
    fiscalPaginacao.totalPages = res.totalPages || 1;

    if (infoPag) {
      const inicio = fiscalPaginacao.total === 0 ? 0 : (fiscalPaginacao.page - 1) * fiscalPaginacao.limit + 1;
      const fim = Math.min(fiscalPaginacao.page * fiscalPaginacao.limit, fiscalPaginacao.total);
      infoPag.textContent = `Mostrando ${inicio}–${fim} de ${fiscalPaginacao.total} notas fiscais`;
    }
    if (numPag) numPag.textContent = `${fiscalPaginacao.page} / ${fiscalPaginacao.totalPages}`;
    if (btnPrev) btnPrev.disabled = fiscalPaginacao.page <= 1;
    if (btnNext) btnNext.disabled = fiscalPaginacao.page >= fiscalPaginacao.totalPages;

    if (!res.itens || res.itens.length === 0) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" class="text-center py-6 text-stone-400 text-xs">
              Nenhuma nota fiscal encontrada com os filtros selecionados.
            </td>
          </tr>
        `;
      }
      return;
    }

    if (tbody) {
      tbody.innerHTML = res.itens
        .map((n) => {
          return `
            <tr class="hover:bg-stone-50 transition">
              <td class="py-2.5 px-3 font-mono font-bold text-stone-900">
                #${n.numero} <span class="text-2xs font-normal text-stone-400">s.${n.serie}</span>
              </td>
              <td class="py-2.5 px-3">
                <span class="inline-block px-1.5 py-0.5 rounded text-2xs font-semibold ${
                  n.tipo === 'Saída' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                  n.tipo === 'Entrada' ? 'bg-purple-50 text-purple-800 border border-purple-200' :
                  'bg-amber-50 text-amber-800 border border-amber-200'
                }">
                  ${n.tipo}
                </span>
              </td>
              <td class="py-2.5 px-3">
                <p class="font-bold text-stone-900 text-xs">${n.parceiro}</p>
                <p class="text-2xs text-stone-400 font-mono">${n.documento_parceiro}</p>
              </td>
              <td class="py-2.5 px-3 text-right font-bold text-stone-900">${n.valor_total_formatado}</td>
              <td class="py-2.5 px-3 text-right text-stone-600">${n.impostos_total_formatado}</td>
              <td class="py-2.5 px-3 text-center">
                <span class="inline-block px-2 py-0.5 rounded-full border text-2xs font-bold ${n.status_badge_classe}" title="${n.motivo_sefaz || ''}">
                  ${n.status_rotulo}
                </span>
              </td>
              <td class="py-2.5 px-3 text-stone-500">${n.emitida_em}</td>
              <td class="py-2.5 px-3 font-mono text-2xs text-stone-500">
                <div class="flex items-center gap-1.5">
                  <span title="${n.chave_acesso}">${n.chave_acesso_truncada}</span>
                  ${
                    n.chave_acesso && n.chave_acesso.length === 44
                      ? `<button type="button" class="btn-copiar-chave-nfe text-stone-400 hover:text-amber-600 transition" data-chave="${n.chave_acesso}" title="Copiar chave de acesso completa">
                          📋
                        </button>`
                      : ''
                  }
                </div>
              </td>
              <td class="py-2.5 px-3 text-center">
                <a href="fiscal.html" class="text-amber-600 hover:text-amber-800 font-bold text-2xs hover:underline" title="Ver detalhes no módulo fiscal">
                  Detalhes &rarr;
                </a>
              </td>
            </tr>
          `;
        })
        .join("");

      // Vincula ação de copiar chave de acesso
      tbody.querySelectorAll(".btn-copiar-chave-nfe").forEach((btn) => {
        btn.addEventListener("click", () => {
          copiarChaveAcesso(btn.dataset.chave, btn);
        });
      });
    }
  } catch (err) {
    console.error("[Tabela Fiscal] Erro ao renderizar:", err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-6 text-red-500 text-xs">
            Erro ao carregar notas fiscais: ${err.message}
          </td>
        </tr>
      `;
    }
  }
}

function copiarChaveAcesso(chave, btn) {
  if (!chave) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(chave).then(() => {
      const original = btn.innerHTML;
      btn.innerHTML = `<span class="text-emerald-600 font-bold text-2xs">✓</span>`;
      setTimeout(() => {
        btn.innerHTML = original;
      }, 1500);
    });
  } else {
    // Fallback manual
    const el = document.createElement("textarea");
    el.value = chave;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    const original = btn.innerHTML;
    btn.innerHTML = `<span class="text-emerald-600 font-bold text-2xs">✓</span>`;
    setTimeout(() => {
      btn.innerHTML = original;
    }, 1500);
  }
}

function gerarMetricasFiscalFallback(dias, status, tipo, partnerId) {
  return {
    sucesso: true,
    kpis: {
      notasEmitidas: { valor: 34, valorFormatado: "34 notas", deltaPercentual: 21.4, deltaSentidoBom: true, tooltip: "Notas autorizadas no período" },
      valorFaturado: { valor: 38450.0, valorFormatado: "R$ 38.450,00", deltaPercentual: 18.2, deltaSentidoBom: true, tooltip: "Valor faturado oficial" },
      inconformidades: { valor: 3, valorFormatado: "3 (8.8%)", subtexto: "8.8% do total emitido", deltaPercentual: -25.0, deltaSentidoBom: false, tooltip: "Canceladas ou rejeitadas" },
      pedidosSemNfe: { valor: 2, valorFormatado: "2 pedidos", deltaPercentual: -33.3, deltaSentidoBom: false, tooltip: "Vendas sem NF-e há > 24h" },
      impostosPeriodo: { valor: 2499.25, valorFormatado: "R$ 2.499,25", subtexto: "Carga média de 6.50%", deltaPercentual: 18.2, deltaSentidoBom: false, tooltip: "Tributos do Simples Nacional" },
      tempoMedioEmissao: { valor: 2.1, valorFormatado: "2.1h", deltaPercentual: -12.5, deltaSentidoBom: true, tooltip: "Tempo médio até emissão" },
    },
    alertas: [
      {
        id: "alerta-rejeitadas",
        tipo: "notas_rejeitadas",
        severidade: "critico",
        titulo: "2 Notas Rejeitadas na SEFAZ sem Correção",
        mensagem: "Notas com erro de validação (Duplicidade 204 e Chave 539) aguardando correção cadastral e retransmissão.",
        valorAtual: "2 rejeitadas",
        limiteConfigurado: "0 permitidas",
        acaoTexto: "Ver Rejeitadas",
        filtroStatus: "rejeitada",
      },
      {
        id: "alerta-sem-nfe",
        tipo: "pedidos_sem_nfe",
        severidade: "critico",
        titulo: "2 Pedidos Entregues há > 1 dia sem NF-e",
        mensagem: "Vendas concluídas e entregues sem faturamento fiscal correspondente. Risco de fiscalização de transporte.",
        valorAtual: "2 pendentes",
        limiteConfigurado: "0 em atraso",
        acaoTexto: "Ver Pendentes",
        filtroStatus: "rascunho",
      },
      {
        id: "alerta-taxa-cancelamento",
        tipo: "taxa_cancelamento_alta",
        severidade: "atencao",
        titulo: "Índice de Cancelamentos em 5.9% (Limite: 3.0%)",
        mensagem: "Taxa de cancelamento ultrapassou a meta de segurança operacional. Avalie os motivos informados.",
        valorAtual: "5.9%",
        limiteConfigurado: "3.0%",
        acaoTexto: "Ver Canceladas",
        filtroStatus: "cancelada",
      },
      {
        id: "alerta-descasamento-po",
        tipo: "descasamento_entrada_po",
        severidade: "atencao",
        titulo: "1 NF-e de Fornecedor com Divergência de Valor",
        mensagem: "NF-e de entrada da Extinpel Indústria acima do pedido de compra autorizado (+R$ 145,00).",
        valorAtual: "R$ 145,00 acima",
        limiteConfigurado: "R$ 0,00",
        acaoTexto: "Ver Conciliação",
        filtroTipo: "entrada",
      },
    ],
    graficos: {
      evolucao: {
        categorias: ["04/11", "08/11", "12/11", "16/11", "20/11", "24/11"],
        qtdNotas: [4, 6, 5, 8, 5, 6],
        faturamento: [4200, 6800, 5900, 9400, 5600, 6550],
      },
      distribuicaoStatus: {
        labels: ["Autorizada", "Cancelada", "Rejeitada", "Inutilizada", "Rascunho"],
        series: [29, 2, 2, 1, 1],
      },
      impostosEmpilhados: {
        categorias: ["04/11", "08/11", "12/11", "16/11", "20/11", "24/11"],
        series: [
          { name: "ICMS", data: [122.8, 198.9, 172.5, 274.9, 163.8, 191.6] },
          { name: "PIS", data: [32.7, 53.0, 46.0, 73.3, 43.7, 51.1] },
          { name: "COFINS", data: [76.4, 123.7, 107.3, 171.1, 101.9, 119.2] },
          { name: "Simples / Outros", data: [40.9, 66.3, 57.5, 91.6, 54.6, 63.8] },
        ],
      },
      rankingRejeicoes: [
        { motivo: "Rejeição 204: Duplicidade de NF-e [nNF: 1072, nRec: 3510004]", tipo: "Rejeição SEFAZ", total: 3 },
        { motivo: "Rejeição 539: Duplicidade de NF-e com diferença na Chave de Acesso", tipo: "Rejeição SEFAZ", total: 2 },
        { motivo: "Cancelamento: Desistência e devolução do comprador antes do despacho", tipo: "Cancelamento Gestor", total: 2 },
        { motivo: "Rejeição 778: Informado NCM inexistente na tabela da SEFAZ", tipo: "Rejeição SEFAZ", total: 1 },
      ],
    },
    conciliacoesEntrada: [
      {
        id: "conc-1",
        fornecedor: "Extinpel Indústria e Comércio",
        numero_nfe: "NF-e 88412",
        valor_nfe: 4320.00,
        valor_nfe_formatado: "R$ 4.320,00",
        numero_po: "PC-2026-0092",
        valor_po: 4175.00,
        valor_po_formatado: "R$ 4.175,00",
        diferenca_valor: 145.00,
        diferenca_formatada: "+R$ 145,00",
        status_conciliacao: "DIVERGENCIA_VALOR",
        status_rotulo: "Divergência (+R$ 145)",
        badge_classe: "bg-amber-100 text-amber-800 border-amber-300",
        data_entrada: "22/11/2026",
      },
      {
        id: "conc-2",
        fornecedor: "Metalúrgica Lacerda Válvulas",
        numero_nfe: "NF-e 19842",
        valor_nfe: 1850.00,
        valor_nfe_formatado: "R$ 1.850,00",
        numero_po: "PC-2026-0091",
        valor_po: 1850.00,
        valor_po_formatado: "R$ 1.850,00",
        diferenca_valor: 0,
        diferenca_formatada: "R$ 0,00",
        status_conciliacao: "CONCILIADO",
        status_rotulo: "Conciliado 100%",
        badge_classe: "bg-emerald-100 text-emerald-800 border-emerald-300",
        data_entrada: "19/11/2026",
      },
    ],
  };
}

function obterTabelaFiscalNotasFallback(page, limit, filtros) {
  const todas = [
    {
      id_nota_fiscal: 101,
      numero: 1074,
      serie: 1,
      tipo: "Saída",
      parceiro: "Condomínio Residencial Jardins",
      documento_parceiro: "24.112.980/0001-44",
      valor_total: 1450.0,
      valor_total_formatado: "R$ 1.450,00",
      impostos_total: 94.25,
      impostos_total_formatado: "R$ 94,25",
      status: "autorizada",
      status_rotulo: "Autorizada",
      status_badge_classe: "bg-emerald-100 text-emerald-800 border-emerald-300",
      emitida_em: "23/11/2026",
      chave_acesso: "35261111222333000181550010000010741998822312",
      chave_acesso_truncada: "3526...2312",
    },
    {
      id_nota_fiscal: 102,
      numero: 1073,
      serie: 1,
      tipo: "Saída",
      parceiro: "Auto Posto Rota do Sol Ltda",
      documento_parceiro: "08.455.123/0001-90",
      valor_total: 2180.0,
      valor_total_formatado: "R$ 2.180,00",
      impostos_total: 141.7,
      impostos_total_formatado: "R$ 141,70",
      status: "autorizada",
      status_rotulo: "Autorizada",
      status_badge_classe: "bg-emerald-100 text-emerald-800 border-emerald-300",
      emitida_em: "23/11/2026",
      chave_acesso: "35261111222333000181550010000010731998822315",
      chave_acesso_truncada: "3526...2315",
    },
    {
      id_nota_fiscal: 103,
      numero: 1072,
      serie: 1,
      tipo: "Saída",
      parceiro: "Mercado Central Campinas",
      documento_parceiro: "12.890.334/0001-11",
      valor_total: 890.0,
      valor_total_formatado: "R$ 890,00",
      impostos_total: 57.85,
      impostos_total_formatado: "R$ 57,85",
      status: "rejeitada",
      status_rotulo: "Rejeitada SEFAZ",
      status_badge_classe: "bg-rose-100 text-rose-800 border-rose-300",
      emitida_em: "22/11/2026",
      chave_acesso: "35261111222333000181550010000010721998822318",
      chave_acesso_truncada: "3526...2318",
      motivo_sefaz: "Rejeição 204: Duplicidade de NF-e [nNF: 1072, nRec: 3510004]",
    },
    {
      id_nota_fiscal: 104,
      numero: 1071,
      serie: 1,
      tipo: "Saída",
      parceiro: "Construtora Monte Alto",
      documento_parceiro: "44.321.789/0001-02",
      valor_total: 3450.0,
      valor_total_formatado: "R$ 3.450,00",
      impostos_total: 224.25,
      impostos_total_formatado: "R$ 224,25",
      status: "cancelada",
      status_rotulo: "Cancelada",
      status_badge_classe: "bg-stone-200 text-stone-800 border-stone-300",
      emitida_em: "21/11/2026",
      chave_acesso: "35261111222333000181550010000010711998822310",
      chave_acesso_truncada: "3526...2310",
      motivo_sefaz: "Cancelamento homologado na SEFAZ",
    },
    {
      id_nota_fiscal: 105,
      numero: 1070,
      serie: 1,
      tipo: "Entrada",
      parceiro: "Extinpel Indústria e Comércio",
      documento_parceiro: "14.555.777/0001-33",
      valor_total: 4320.0,
      valor_total_formatado: "R$ 4.320,00",
      impostos_total: 280.8,
      impostos_total_formatado: "R$ 280,80",
      status: "autorizada",
      status_rotulo: "Autorizada",
      status_badge_classe: "bg-emerald-100 text-emerald-800 border-emerald-300",
      emitida_em: "20/11/2026",
      chave_acesso: "35261114555777000133550010000458001998822399",
      chave_acesso_truncada: "3526...2399",
    },
    {
      id_nota_fiscal: 106,
      numero: 1069,
      serie: 1,
      tipo: "Saída",
      parceiro: "Escola Modelo de Ensino",
      documento_parceiro: "55.443.221/0001-55",
      valor_total: 780.0,
      valor_total_formatado: "R$ 780,00",
      impostos_total: 50.7,
      impostos_total_formatado: "R$ 50,70",
      status: "autorizada",
      status_rotulo: "Autorizada",
      status_badge_classe: "bg-emerald-100 text-emerald-800 border-emerald-300",
      emitida_em: "19/11/2026",
      chave_acesso: "35261111222333000181550010000010691998822319",
      chave_acesso_truncada: "3526...2319",
    },
  ];

  let filtrados = [...todas];
  if (filtros.status && filtros.status !== "ALL") {
    filtrados = filtrados.filter((f) => f.status === filtros.status);
  }
  if (filtros.tipo && filtros.tipo !== "ALL") {
    const tMap = { saida: "Saída", entrada: "Entrada", devolucao: "Devolução" };
    const alvo = tMap[filtros.tipo];
    if (alvo) filtrados = filtrados.filter((f) => f.tipo === alvo);
  }
  if (filtros.search && filtros.search.trim()) {
    const q = filtros.search.toLowerCase().trim();
    filtrados = filtrados.filter(
      (f) =>
        String(f.numero).includes(q) ||
        f.parceiro.toLowerCase().includes(q) ||
        f.documento_parceiro.includes(q) ||
        f.chave_acesso.toLowerCase().includes(q)
    );
  }

  const total = filtrados.length;
  const offset = (page - 1) * limit;
  const itens = filtrados.slice(offset, offset + limit);

  return {
    sucesso: true,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    itens,
  };
}

renderDashboard();
