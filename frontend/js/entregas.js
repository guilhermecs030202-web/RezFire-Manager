/**
 * entregas.js
 * Lógica da página de Entregas — RezFire Manager.
 *
 * Depende de:
 *   - layout.js    (sidebar, renderSidebar)
 *   - mock-data.js (RezFireData)
 *   - mock-entregas.js (RezFireEntregas)
 *
 * SIMULAÇÃO: sem backend. Estado mantido em memória e localStorage.
 */

// ─── Estado da página ─────────────────────────────────────────────────────────
let state = {
  entregas: [],              // Lista completa carregada do storage
  filtroStatus: "todos",     // Filtro de status logístico/interno
  filtroCanal: "todos",
  filtroPeriodo: "todos",    // "7" | "30" | "90" | "todos"
  filtroApenasAtrasados: false,
  filtroDespacho: "todos",   // "hoje" | "amanha" | "atrasado" | "todos"
  busca: "",
  pagina: 1,
  porPagina: 10,
  detalheId: null,           // id_entrega aberta no painel lateral
};

// Aliases convenientes — lidos do namespace exportado por mock-entregas.js
// Não declarar como const para evitar conflito com variáveis de escopo de arquivo
// dos scripts carregados antes no mesmo contexto HTML.
// formatMoney já está disponível no escopo global através de mock-data.js (ou RezFireData.formatMoney)

// Atalhos inline para legibilidade — usamos window. explicitamente nas funções
// para deixar claro a origem dos valores.
function SI() { return window.RezFireEntregas.STATUS_INTERNO; }
function SL() { return window.RezFireEntregas.STATUS_LOGISTICO; }
function REF() { return window.RezFireEntregas.ENTREGAS_REF_DATE; }


// ─── Utilitários de data ──────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateOnly(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function diffDays(iso1, iso2) {
  const a = new Date(iso1).getTime();
  const b = new Date(iso2).getTime();
  return Math.round((b - a) / 86400000);
}

// ─── Helpers de badge ─────────────────────────────────────────────────────────
function badgeLogistico(entrega) {
  const { isAtrasadoDespacho, isAtrasadoEntrega } = window.RezFireEntregas;
  const sl = entrega.status_logistico;

  if (isAtrasadoDespacho(entrega))
    return `<span class="entrega-badge badge-atraso">⚠ Despacho Atrasado</span>`;
  if (isAtrasadoEntrega(entrega))
    return `<span class="entrega-badge badge-atraso">⚠ Entrega Atrasada</span>`;

  const map = {
    [SL().AGUARDANDO_ENVIO]: `<span class="entrega-badge badge-aguardando">Aguardando Envio</span>`,
    [SL().ENVIADO]:          `<span class="entrega-badge badge-enviado">Enviado</span>`,
    [SL().EM_TRANSITO]:      `<span class="entrega-badge badge-transito">Em Trânsito</span>`,
    [SL().SAIU_ENTREGA]:     `<span class="entrega-badge badge-saiu">Saiu p/ Entrega</span>`,
    [SL().ENTREGUE]:         `<span class="entrega-badge badge-entregue">Entregue</span>`,
    [SL().OCORRENCIA]:       `<span class="entrega-badge badge-ocorrencia">Com Ocorrência</span>`,
    [SL().CANCELADO]:        `<span class="entrega-badge badge-cancelado">Cancelado</span>`,
    [SL().ATRASADO]:         `<span class="entrega-badge badge-atraso">Com Atraso</span>`,
  };
  return map[sl] || `<span class="entrega-badge">${sl}</span>`;
}

function badgeInterno(entrega) {
  const si = entrega.status_interno;
  const map = {
    [SI().A_SEPARAR]:           `<span class="entrega-badge-int badge-int-aseparar">A Separar</span>`,
    [SI().EM_SEPARACAO]:        `<span class="entrega-badge-int badge-int-separando">Em Separação</span>`,
    [SI().PRONTO_DESPACHO]:     `<span class="entrega-badge-int badge-int-pronto">Pronto para Despacho</span>`,
    [SI().DESPACHO_REGISTRADO]: `<span class="entrega-badge-int badge-int-despachado">Despachado</span>`,
    [SI().CANCELADO]:           `<span class="entrega-badge-int badge-int-cancelado">Cancelado</span>`,
  };
  return map[si] || `<span class="entrega-badge-int">${si}</span>`;
}

function canalBadge(canal) {
  if (canal === "Mercado Livre")
    return `<span class="badge-channel ml">ML</span>`;
  return `<span class="badge-channel direto">Direto</span>`;
}

// ─── Filtragem e pesquisa ─────────────────────────────────────────────────────
function filteredEntregas() {
  const {
    isAtrasadoDespacho, isAtrasadoEntrega, temProblema,
  } = window.RezFireEntregas;

  const refTime = REF().getTime();
  const dayMs = 86400000;

  return state.entregas.filter((e) => {
    // Busca textual
    if (state.busca) {
      const q = state.busca.toLowerCase();
      const codigos = [
        e.codigo_pedido_ml || "",
        e.codigo_pedido_direto || "",
        e.id_entrega,
      ].join(" ").toLowerCase();
      const prods = (e.itens || []).map((i) => `${i.nome} ${i.sku}`).join(" ").toLowerCase();
      if (!codigos.includes(q) && !prods.includes(q)) return false;
    }

    // Filtro de status (agrupa logístico + interno + especiais)
    if (state.filtroStatus !== "todos") {
      const fs = state.filtroStatus;
      if (fs === "a_separar" && e.status_interno !== SI().A_SEPARAR) return false;
      if (fs === "em_separacao" && e.status_interno !== SI().EM_SEPARACAO) return false;
      if (fs === "pronto_despacho" && e.status_interno !== SI().PRONTO_DESPACHO) return false;
      if (fs === "em_transito" && ![SL().EM_TRANSITO, SL().SAIU_ENTREGA, SL().ENVIADO].includes(e.status_logistico)) return false;
      if (fs === "entregue" && e.status_logistico !== SL().ENTREGUE) return false;
      if (fs === "problema" && !temProblema(e)) return false;
      if (fs === "cancelado" && e.status_interno !== SI().CANCELADO) return false;
    }

    // Filtro de canal
    if (state.filtroCanal !== "todos") {
      if (state.filtroCanal === "ml" && e.canal !== "Mercado Livre") return false;
      if (state.filtroCanal === "direto" && e.canal !== "Venda Direta") return false;
    }

    // Filtro de período
    if (state.filtroPeriodo !== "todos") {
      const days = Number(state.filtroPeriodo);
      const start = refTime - days * dayMs;
      if (new Date(e.data_venda).getTime() < start) return false;
    }

    // Filtro de prazo de despacho
    if (state.filtroDespacho !== "todos") {
      const prazo = e.prazo_despacho ? new Date(e.prazo_despacho) : null;
      const hoje = new Date(REF());
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(hoje.getDate() + 1);
      const dds = prazo ? Math.floor((prazo - hoje) / dayMs) : null;
      if (state.filtroDespacho === "hoje" && dds !== 0) return false;
      if (state.filtroDespacho === "amanha" && dds !== 1) return false;
      if (state.filtroDespacho === "atrasado" && !isAtrasadoDespacho(e)) return false;
    }

    // Filtro "apenas atrasados"
    if (state.filtroApenasAtrasados) {
      if (!isAtrasadoDespacho(e) && !isAtrasadoEntrega(e)) return false;
    }

    return true;
  });
}

// ─── Renderização dos KPIs ────────────────────────────────────────────────────
function renderKPIs() {
  const kpis = window.RezFireEntregas.computeEntregasKPIs(state.entregas);
  const el = document.getElementById("entregas-kpis");
  if (!el) return;

  el.innerHTML = `
    <article class="card kpi-card entrega-kpi" data-filter="a_separar" tabindex="0" role="button" aria-label="Filtrar pedidos a separar">
      <p class="kpi-label">A SEPARAR</p>
      <p class="kpi-value" style="color:#d97706">${kpis.aSeparar}</p>
      <p class="kpi-hint">Pedidos aguardando separação</p>
    </article>
    <article class="card kpi-card entrega-kpi" data-filter="pronto_despacho" tabindex="0" role="button" aria-label="Filtrar prontos para despacho">
      <p class="kpi-label">PRONTOS P/ DESPACHO</p>
      <p class="kpi-value" style="color:#2563eb">${kpis.prontoDespacho}</p>
      <p class="kpi-hint">Conferência concluída</p>
    </article>
    <article class="card kpi-card entrega-kpi" data-filter="em_transito" tabindex="0" role="button" aria-label="Filtrar pedidos em trânsito">
      <p class="kpi-label">EM TRÂNSITO</p>
      <p class="kpi-value" style="color:#0891b2">${kpis.emTransito}</p>
      <p class="kpi-hint">Despachados, aguardando entrega</p>
    </article>
    <article class="card kpi-card entrega-kpi" data-filter="entregue" tabindex="0" role="button" aria-label="Filtrar pedidos entregues">
      <p class="kpi-label">ENTREGUES</p>
      <p class="kpi-value" style="color:var(--up)">${kpis.entregues}</p>
      <p class="kpi-hint">Entregas concluídas</p>
    </article>
    <article class="card kpi-card entrega-kpi${kpis.comProblemas > 0 ? " entrega-kpi-problema" : ""}" data-filter="problema" tabindex="0" role="button" aria-label="Filtrar pedidos com problemas">
      <p class="kpi-label">COM PROBLEMAS</p>
      <p class="kpi-value" style="color:var(--down)">${kpis.comProblemas}</p>
      <p class="kpi-hint">Atrasos ou ocorrências</p>
    </article>
  `;

  // Click nos KPI cards filtra a tabela
  el.querySelectorAll(".entrega-kpi").forEach((card) => {
    const handler = () => {
      const f = card.dataset.filter;
      state.filtroStatus = state.filtroStatus === f ? "todos" : f;
      state.pagina = 1;
      syncFilterUI();
      renderTable();
      renderKPIHighlight();
    };
    card.addEventListener("click", handler);
    card.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") handler(); });
  });

  renderKPIHighlight();
}

function renderKPIHighlight() {
  document.querySelectorAll(".entrega-kpi").forEach((card) => {
    card.classList.toggle("entrega-kpi-active", card.dataset.filter === state.filtroStatus);
  });
}

// ─── Renderização da tabela ───────────────────────────────────────────────────
function renderTable() {
  const lista = filteredEntregas();
  const totalPaginas = Math.max(1, Math.ceil(lista.length / state.porPagina));
  if (state.pagina > totalPaginas) state.pagina = totalPaginas;

  const inicio = (state.pagina - 1) * state.porPagina;
  const paginada = lista.slice(inicio, inicio + state.porPagina);

  // Contagem
  const countEl = document.getElementById("entregas-count");
  if (countEl) {
    countEl.textContent = lista.length === state.entregas.length
      ? `${lista.length} pedidos`
      : `${lista.length} de ${state.entregas.length} pedidos (filtrado)`;
  }

  const tbody = document.getElementById("entregas-tbody");
  if (!tbody) return;

  if (paginada.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">
          <div style="padding:40px 0;text-align:center;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c8c0b8" stroke-width="1.4" style="margin-bottom:10px;display:block;margin-inline:auto"><path d="M3 15V5h18v14H3z"/><path d="M3 9h18"/><path d="M9 21v-2"/><path d="M15 21v-2"/></svg>
            <p style="color:var(--muted);font-size:0.92rem;margin:0 0 8px">Nenhum pedido encontrado com os filtros aplicados.</p>
            <button class="btn-ghost" id="btn-limpar-empty" style="font-size:0.82rem;padding:6px 14px;">Limpar filtros</button>
          </div>
        </td>
      </tr>
    `;
    document.getElementById("btn-limpar-empty")?.addEventListener("click", limparFiltros);
  } else {
    tbody.innerHTML = paginada.map((e) => rowHTML(e)).join("");
    tbody.querySelectorAll(".btn-ver-detalhe").forEach((btn) => {
      btn.addEventListener("click", () => abrirDetalhe(btn.dataset.id));
    });
    tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
      tr.addEventListener("click", (ev) => {
        if (ev.target.closest("button")) return;
        abrirDetalhe(tr.dataset.id);
      });
    });
  }

  renderPagination(totalPaginas, lista.length);
}

function rowHTML(e) {
  const { temProblema } = window.RezFireEntregas;
  const problemaClass = temProblema(e) ? " row-problema" : "";
  const canceladoClass = e.status_interno === SI().CANCELADO ? " row-cancelado" : "";

  // Produto principal + resumo
  const itens = e.itens || [];
  const principal = itens[0];
  const prodCell = principal
    ? `<span class="prod-name">${principal.nome}</span>
       <span class="sku-sub">${principal.sku} · ${principal.quantidade} un.</span>
       ${itens.length > 1 ? `<span class="sku-sub" style="color:var(--muted)">+ ${itens.length - 1} outro(s)</span>` : ""}`
    : "—";

  // Código do pedido
  const codigo = e.codigo_pedido_ml || e.codigo_pedido_direto || e.id_entrega;

  // Prazo de despacho
  const prazo = e.prazo_despacho ? formatDateOnly(e.prazo_despacho) : "—";
  const prazoClass = window.RezFireEntregas.isAtrasadoDespacho(e) ? `style="color:var(--down);font-weight:700"` : "";

  // Rastreio
  const rastreio = e.codigo_rastreio
    ? `<span style="font-family:monospace;font-size:0.78rem">${e.codigo_rastreio}</span>`
    : `<span style="color:var(--muted);font-size:0.78rem">—</span>`;

  return `
    <tr data-id="${e.id_entrega}" class="entregas-row${problemaClass}${canceladoClass}" style="cursor:pointer" tabindex="0" aria-label="Ver detalhes do pedido ${codigo}">
      <td>
        ${canalBadge(e.canal)}
        <span class="sku-main" style="display:block;margin-top:3px">${codigo}</span>
        <span class="sku-sub">${e.cliente}</span>
      </td>
      <td style="white-space:nowrap;font-size:0.84rem">${formatDateOnly(e.data_venda)}</td>
      <td>${prodCell}</td>
      <td><span ${prazoClass}>${prazo}</span></td>
      <td>${badgeLogistico(e)}</td>
      <td>${badgeInterno(e)}</td>
      <td>${rastreio}</td>
      <td>
        <button class="btn-ver-detalhe icon-btn" data-id="${e.id_entrega}" title="Ver detalhes" aria-label="Ver detalhes do pedido ${codigo}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </td>
    </tr>
  `;
}

// ─── Paginação ────────────────────────────────────────────────────────────────
function renderPagination(totalPaginas, total) {
  const el = document.getElementById("entregas-pagination");
  if (!el) return;
  if (totalPaginas <= 1) { el.innerHTML = ""; return; }

  let html = `<div class="pagination-bar">`;
  html += `<button class="page-btn" ${state.pagina <= 1 ? "disabled" : ""} data-page="${state.pagina - 1}" aria-label="Página anterior">‹</button>`;
  for (let i = 1; i <= totalPaginas; i++) {
    html += `<button class="page-btn ${i === state.pagina ? "is-active" : ""}" data-page="${i}" aria-label="Página ${i}">${i}</button>`;
  }
  html += `<button class="page-btn" ${state.pagina >= totalPaginas ? "disabled" : ""} data-page="${state.pagina + 1}" aria-label="Próxima página">›</button>`;
  html += `<span class="page-info">Página ${state.pagina} de ${totalPaginas} · ${total} pedidos</span>`;
  html += `</div>`;
  el.innerHTML = html;

  el.querySelectorAll(".page-btn:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.pagina = Number(btn.dataset.page);
      renderTable();
    });
  });
}

// ─── Sincronizar UI dos filtros ───────────────────────────────────────────────
function syncFilterUI() {
  const statusSel = document.getElementById("filtro-status");
  if (statusSel) statusSel.value = state.filtroStatus;
  const canalSel = document.getElementById("filtro-canal");
  if (canalSel) canalSel.value = state.filtroCanal;
  const periodoSel = document.getElementById("filtro-periodo");
  if (periodoSel) periodoSel.value = state.filtroPeriodo;
  const despachoSel = document.getElementById("filtro-despacho");
  if (despachoSel) despachoSel.value = state.filtroDespacho;
  const atrasadoChk = document.getElementById("filtro-atrasados");
  if (atrasadoChk) atrasadoChk.checked = state.filtroApenasAtrasados;
  const buscaEl = document.getElementById("busca-entregas");
  if (buscaEl && state.busca === "") buscaEl.value = "";
  renderKPIHighlight();
}

function limparFiltros() {
  state.filtroStatus = "todos";
  state.filtroCanal = "todos";
  state.filtroPeriodo = "todos";
  state.filtroDespacho = "todos";
  state.filtroApenasAtrasados = false;
  state.busca = "";
  state.pagina = 1;
  syncFilterUI();
  renderTable();
  renderKPIHighlight();
}

// ─── Painel de detalhes ───────────────────────────────────────────────────────
function abrirDetalhe(id) {
  const entrega = state.entregas.find((e) => e.id_entrega === id);
  if (!entrega) return;
  state.detalheId = id;
  renderDetalhe(entrega);
  const painel = document.getElementById("detalhe-panel");
  if (painel) {
    painel.classList.add("is-open");
    painel.focus();
  }
  document.getElementById("detalhe-overlay")?.classList.add("is-open");
}

function fecharDetalhe() {
  state.detalheId = null;
  document.getElementById("detalhe-panel")?.classList.remove("is-open");
  document.getElementById("detalhe-overlay")?.classList.remove("is-open");
}

function renderDetalhe(entrega) {
  const painel = document.getElementById("detalhe-panel");
  if (!painel) return;

  const codigo = entrega.codigo_pedido_ml || entrega.codigo_pedido_direto || entrega.id_entrega;
  const { temProblema } = window.RezFireEntregas;

  painel.innerHTML = `
    <div class="detalhe-header">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${canalBadge(entrega.canal)}
          <h2 style="margin:0;font-size:1.1rem;font-weight:800">${codigo}</h2>
          ${temProblema(entrega) ? `<span class="entrega-badge badge-ocorrencia" style="font-size:0.7rem">⚠ Atenção</span>` : ""}
        </div>
        <p style="margin:4px 0 0;color:var(--muted);font-size:0.83rem">${entrega.cliente} · ${entrega.uf}</p>
      </div>
      <button class="icon-btn" id="btn-fechar-detalhe" aria-label="Fechar painel">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="detalhe-tabs" id="detalhe-tabs">
      <button class="detalhe-tab is-active" data-tab="resumo">Resumo</button>
      <button class="detalhe-tab" data-tab="separacao">Separação</button>
      <button class="detalhe-tab" data-tab="logistica">Logística</button>
      <button class="detalhe-tab" data-tab="historico">Histórico</button>
    </div>

    <div id="detalhe-content"></div>

    <div class="detalhe-acoes" id="detalhe-acoes"></div>
  `;

  document.getElementById("btn-fechar-detalhe")?.addEventListener("click", fecharDetalhe);

  // Tabs
  painel.querySelectorAll(".detalhe-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      painel.querySelectorAll(".detalhe-tab").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderDetalheTab(entrega, btn.dataset.tab);
    });
  });

  renderDetalheTab(entrega, "resumo");
  renderDetalheAcoes(entrega);
}

function renderDetalheTab(entrega, tab) {
  const el = document.getElementById("detalhe-content");
  if (!el) return;

  if (tab === "resumo") {
    const todosProdutos = (window.RezFireData && typeof window.RezFireData.loadProducts === "function")
      ? window.RezFireData.loadProducts()
      : [];

    const itensHTML = (entrega.itens || []).map((i) => {
      const prodCadastrado = todosProdutos.find((p) => p.id_produto === i.id_produto || p.sku === i.sku);
      const qtdAtual = prodCadastrado ? prodCadastrado.quantidade_atual : null;
      const minEstoque = prodCadastrado ? prodCadastrado.estoque_minimo : 0;
      const estoqueBaixo = qtdAtual !== null && qtdAtual <= minEstoque;

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <span class="prod-name" style="font-size:0.88rem">${i.nome}</span>
              <a href="estoque.html" target="_blank" title="Ver saldo no Estoque" style="color:var(--accent);font-size:0.75rem;display:inline-flex;align-items:center;text-decoration:none">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
              <span class="sku-sub" style="margin:0">${i.sku}</span>
              ${qtdAtual !== null ? `
                <span style="font-size:0.72rem;padding:1px 6px;border-radius:4px;background:${estoqueBaixo ? "#fee2e2" : "#f1f5f9"};color:${estoqueBaixo ? "#991b1b" : "#475569"};font-weight:600">
                  Estoque: ${qtdAtual} un ${estoqueBaixo ? "⚠ baixo" : ""}
                </span>
              ` : ""}
            </div>
          </td>
          <td style="text-align:center;font-weight:700">${i.quantidade}</td>
          <td style="text-align:right;color:var(--muted);font-size:0.85rem">${formatMoney(i.preco_unitario)}</td>
          <td style="text-align:right;font-weight:600">${formatMoney(i.subtotal)}</td>
        </tr>
      `;
    }).join("");

    el.innerHTML = `
      <section class="detalhe-section">
        <h3 class="detalhe-section-title">Dados do pedido</h3>
        <div class="detalhe-grid">
          <div class="detalhe-field"><span class="detalhe-label">Pedido ML</span><span>${entrega.codigo_pedido_ml || "—"}</span></div>
          <div class="detalhe-field"><span class="detalhe-label">Pedido Direto</span><span>${entrega.codigo_pedido_direto || "—"}</span></div>
          <div class="detalhe-field"><span class="detalhe-label">Data da venda</span><span>${formatDate(entrega.data_venda)}</span></div>
          <div class="detalhe-field"><span class="detalhe-label">Canal</span><span>${entrega.canal}</span></div>
          <div class="detalhe-field"><span class="detalhe-label">UF destino</span><span>${entrega.uf}</span></div>
          <div class="detalhe-field"><span class="detalhe-label">Modalidade</span><span>${entrega.modalidade_envio || "—"}</span></div>
        </div>
      </section>
      <section class="detalhe-section">
        <h3 class="detalhe-section-title">Itens do pedido</h3>
        <div class="table-wrap" style="border-radius:8px;overflow:hidden;border:1px solid var(--line)">
          <table class="products-table" style="margin:0">
            <thead><tr>
              <th>Produto</th><th style="text-align:center">Qtd.</th>
              <th style="text-align:right">Unitário</th><th style="text-align:right">Subtotal</th>
            </tr></thead>
            <tbody>${itensHTML}</tbody>
            <tfoot><tr>
              <td colspan="3" style="text-align:right;font-weight:700;padding:12px 16px;border-top:1px solid var(--line)">Total</td>
              <td style="text-align:right;font-weight:800;font-size:1rem;padding:12px 16px;border-top:1px solid var(--line)">${formatMoney(entrega.valor_total)}</td>
            </tr></tfoot>
          </table>
        </div>
      </section>
    `;
    return;
  }

  if (tab === "separacao") {
    el.innerHTML = renderSeparacaoTab(entrega);
    bindSeparacaoEvents(entrega);
    return;
  }

  if (tab === "logistica") {
    const { isAtrasadoDespacho, isAtrasadoEntrega } = window.RezFireEntregas;
    const atrasadoDespacho = isAtrasadoDespacho(entrega);
    const atrasadoEntrega = isAtrasadoEntrega(entrega);

    let alertaHTML = "";
    if (atrasadoDespacho) {
      const dias = diffDays(entrega.prazo_despacho, REF().toISOString());
      alertaHTML += `<div class="detalhe-alerta alerta-erro">⚠ Prazo de despacho vencido há ${dias} dia(s). Tome ação imediatamente.</div>`;
    }
    if (atrasadoEntrega) {
      const dias = diffDays(entrega.previsao_entrega, REF().toISOString());
      alertaHTML += `<div class="detalhe-alerta alerta-erro">⚠ Previsão de entrega ultrapassada há ${dias} dia(s). Verifique com a transportadora.</div>`;
    }
    if (entrega.ocorrencias && entrega.ocorrencias.length > 0) {
      entrega.ocorrencias.forEach((oc) => {
        alertaHTML += `<div class="detalhe-alerta alerta-aviso">⚠ ${oc.descricao}</div>`;
      });
    }

    el.innerHTML = `
      ${alertaHTML}
      <section class="detalhe-section">
        <h3 class="detalhe-section-title">Informações logísticas</h3>
        <div class="detalhe-grid">
          <div class="detalhe-field"><span class="detalhe-label">Status logístico</span><span>${badgeLogistico(entrega)}</span></div>
          <div class="detalhe-field"><span class="detalhe-label">Status interno</span><span>${badgeInterno(entrega)}</span></div>
          <div class="detalhe-field"><span class="detalhe-label">Modalidade de envio</span><span>${entrega.modalidade_envio || "—"}</span></div>
          <div class="detalhe-field"><span class="detalhe-label">Prazo de despacho</span><span style="${atrasadoDespacho ? "color:var(--down);font-weight:700" : ""}">${formatDateOnly(entrega.prazo_despacho)}</span></div>
          <div class="detalhe-field"><span class="detalhe-label">Código de rastreio</span>
            <span style="font-family:monospace;font-size:0.9rem">${entrega.codigo_rastreio || "—"}</span>
          </div>
          <div class="detalhe-field"><span class="detalhe-label">Data de despacho</span><span>${formatDateOnly(entrega.data_despacho)}</span></div>
          <div class="detalhe-field"><span class="detalhe-label">Previsão de entrega</span><span style="${atrasadoEntrega ? "color:var(--down);font-weight:700" : ""}">${formatDateOnly(entrega.previsao_entrega)}</span></div>
          <div class="detalhe-field"><span class="detalhe-label">Data de entrega</span><span>${formatDateOnly(entrega.data_entrega)}</span></div>
          <div class="detalhe-field"><span class="detalhe-label">ID de envio ML</span><span style="font-family:monospace;font-size:0.85rem">${entrega.id_envio_ml || "—"}</span></div>
        </div>
      </section>
      <div class="modal-info-box" style="margin-top:12px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        A futura integração com o Mercado Livre permitirá atualizar automaticamente o status logístico e o rastreamento a partir da API oficial.
      </div>
    `;
    return;
  }

  if (tab === "historico") {
    const eventos = [...(entrega.historico || [])].sort((a, b) => new Date(b.data) - new Date(a.data));
    const eventoHTML = eventos.map((ev) => {
      const iconMap = {
        info:    `<span class="hist-icon hist-info">●</span>`,
        sucesso: `<span class="hist-icon hist-sucesso">✓</span>`,
        alerta:  `<span class="hist-icon hist-alerta">⚠</span>`,
        erro:    `<span class="hist-icon hist-erro">✕</span>`,
      };
      return `
        <div class="hist-item">
          ${iconMap[ev.tipo] || iconMap.info}
          <div class="hist-body">
            <p class="hist-evento">${ev.evento}</p>
            <p class="hist-desc">${ev.descricao}</p>
            <p class="hist-data">${formatDate(ev.data)}</p>
          </div>
        </div>
      `;
    }).join("");

    el.innerHTML = `
      <section class="detalhe-section">
        <h3 class="detalhe-section-title">Histórico do pedido</h3>
        <div class="hist-timeline">${eventoHTML || "<p style='color:var(--muted)'>Sem eventos registrados.</p>"}</div>
      </section>
    `;
    return;
  }
}

// ─── Aba de Separação ─────────────────────────────────────────────────────────
function renderSeparacaoTab(entrega) {
  const si = entrega.status_interno;

  if (si === SI().CANCELADO) {
    return `<div class="detalhe-alerta alerta-erro">Este pedido foi cancelado. Não é possível realizar a separação.</div>`;
  }

  if (si === SI().DESPACHO_REGISTRADO) {
    return `<div class="detalhe-alerta alerta-info" style="background:#e8f2fe;border-color:#bfdbfe;color:#1e40af">
      ✓ Separação concluída e pedido despachado. Consulte o histórico para detalhes.
    </div>`;
  }

  if (!entrega.separacao && si === SI().A_SEPARAR) {
    // Ainda não iniciada
    return `
      <section class="detalhe-section">
        <h3 class="detalhe-section-title">Separação de itens</h3>
        <p style="color:var(--muted);font-size:0.88rem;margin-bottom:16px">
          A separação ainda não foi iniciada. Revise os itens abaixo e clique em <strong>Iniciar Separação</strong>.
        </p>
        ${renderItensPendentes(entrega)}
        <div style="margin-top:16px">
          <button class="btn-primary" id="btn-iniciar-sep" style="width:100%">
            Iniciar Separação
          </button>
        </div>
      </section>
    `;
  }

  if (si === SI().EM_SEPARACAO || si === SI().PRONTO_DESPACHO) {
    return renderFormSeparacao(entrega);
  }

  return `<p style="color:var(--muted)">Estado de separação não reconhecido.</p>`;
}

function renderItensPendentes(entrega) {
  return `
    <div class="table-wrap" style="border-radius:8px;border:1px solid var(--line)">
      <table class="products-table" style="margin:0">
        <thead><tr><th>Produto</th><th>SKU</th><th style="text-align:center">Qtd. solicitada</th></tr></thead>
        <tbody>
          ${(entrega.itens || []).map((i) => `
            <tr>
              <td><span class="prod-name">${i.nome}</span></td>
              <td><span style="font-family:monospace;font-size:0.82rem">${i.sku}</span></td>
              <td style="text-align:center;font-weight:700">${i.quantidade}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderFormSeparacao(entrega) {
  const sep = entrega.separacao;
  const concluida = entrega.status_interno === SI().PRONTO_DESPACHO;

  const itensHTML = (sep.itens || []).map((item) => {
    const lotesDisponiveis = window.RezFireEntregas.getLotesPorProduto(item.id_produto);
    const isExt = item.sku.startsWith("EXT");
    const conf = item.conferido;

    const lotesExistentes = (item.lotes || []).map((l, li) => `
      <div class="lote-row" data-sku="${item.sku}" data-lote-idx="${li}">
        <select class="search-input lote-select" data-sku="${item.sku}" data-lote-idx="${li}"
          style="flex:2;font-size:0.82rem" ${conf ? "disabled" : ""}>
          <option value="">— Selecionar lote —</option>
          ${lotesDisponiveis.map((ld) =>
            `<option value="${ld.id_lote}" ${ld.id_lote === l.id_lote ? "selected" : ""}>
              ${ld.id_lote} · Val: ${formatDateOnly(ld.validade)} · Disp: ${ld.quantidade_disponivel}
            </option>`
          ).join("")}
        </select>
        <input type="number" class="search-input lote-qty" data-sku="${item.sku}" data-lote-idx="${li}"
          min="1" value="${l.quantidade}" style="width:80px;font-size:0.82rem;text-align:center" ${conf ? "disabled" : ""} />
        ${!conf ? `<button class="icon-btn remover-lote" data-sku="${item.sku}" data-lote-idx="${li}" title="Remover lote">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>` : ""}
      </div>
    `).join("");

    const validadeAlert = (item.lotes || []).some((l) => {
      if (!l.validade) return false;
      return new Date(l.validade).getTime() < new Date("2025-01-01").getTime();
    }) ? `<div class="detalhe-alerta alerta-aviso" style="margin-top:8px;font-size:0.78rem">⚠ Produto com data de validade próxima ou vencida. Confirme antes de prosseguir.</div>` : "";

    return `
      <div class="sep-item${conf ? " sep-item-conferido" : ""}" data-sku="${item.sku}">
        <div class="sep-item-header">
          <div>
            <span class="prod-name" style="font-size:0.9rem">${item.nome}</span>
            <span class="sku-sub">${item.sku}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:0.82rem;color:var(--muted)">Solicitado: <strong style="color:var(--ink)">${item.quantidade_solicitada}</strong></span>
            <span style="font-size:0.82rem;color:var(--muted)">Separado: <strong class="sep-qty-display" style="color:${item.quantidade_separada === item.quantidade_solicitada ? "var(--up)" : item.quantidade_separada > 0 ? "#d97706" : "var(--down)"}">${item.quantidade_separada}</strong></span>
            ${conf ? `<span style="color:var(--up);font-weight:700;font-size:0.82rem">✓ Conferido</span>` : ""}
          </div>
        </div>

        ${!conf ? `
          <div class="sep-lotes-wrap" id="lotes-${item.sku}">
            ${isExt ? `
              <p style="font-size:0.78rem;color:var(--muted);margin:6px 0 4px">Lotes associados:</p>
              <div class="lotes-list">
                ${lotesExistentes}
              </div>
              ${!conf ? `<button class="btn-ghost adicionar-lote" data-sku="${item.sku}" style="font-size:0.78rem;padding:4px 10px;margin-top:6px">
                + Adicionar lote
              </button>` : ""}
            ` : `
              <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
                <label style="font-size:0.82rem;color:var(--muted)">Qtd. separada:</label>
                <input type="number" class="search-input sem-lote-qty" data-sku="${item.sku}"
                  min="0" value="${item.quantidade_separada}" style="width:80px;font-size:0.85rem;text-align:center" />
              </div>
            `}
          </div>
          ${validadeAlert}
          <div class="sep-item-foot">
            <button class="btn-primary conferir-item" data-sku="${item.sku}" style="font-size:0.8rem;padding:6px 14px">
              Conferir item
            </button>
          </div>
        ` : `${validadeAlert}`}
      </div>
    `;
  }).join("");

  const totalSolicitado = (sep.itens || []).reduce((s, i) => s + i.quantidade_solicitada, 0);
  const totalSeparado = (sep.itens || []).reduce((s, i) => s + i.quantidade_separada, 0);
  const todoConferido = (sep.itens || []).every((i) => i.conferido);

  return `
    <section class="detalhe-section">
      <h3 class="detalhe-section-title">
        Conferência de itens
        ${concluida ? `<span style="color:var(--up);font-weight:700;font-size:0.82rem;margin-left:8px">✓ Separação concluída</span>` : ""}
      </h3>
      ${!concluida ? `
        <p style="color:var(--muted);font-size:0.83rem;margin-bottom:16px">
          Selecione os lotes e confirme as quantidades de cada item. A separação só pode ser concluída quando todos os itens estiverem conferidos e as quantidades corretas.
        </p>
      ` : ""}
      <div class="sep-itens-list">${itensHTML}</div>
      ${!concluida ? `
        <div class="sep-resumo">
          <div>
            <span style="font-size:0.82rem;color:var(--muted)">Total separado: </span>
            <strong style="color:${totalSeparado === totalSolicitado ? "var(--up)" : "var(--down)"}">${totalSeparado} / ${totalSolicitado}</strong>
          </div>
          <button class="btn-primary" id="btn-concluir-sep" 
            style="font-size:0.85rem"
            ${!todoConferido ? "disabled title='Conclua a conferência de todos os itens'" : ""}>
            Concluir separação
          </button>
        </div>
      ` : ""}
    </section>
  `;
}

function bindSeparacaoEvents(entrega) {
  const content = document.getElementById("detalhe-content");
  if (!content) return;

  // Iniciar separação
  content.querySelector("#btn-iniciar-sep")?.addEventListener("click", () => {
    confirmarAcao("Deseja iniciar a separação deste pedido?", () => {
      iniciarSeparacao(entrega);
    });
  });

  // Adicionar lote
  content.querySelectorAll(".adicionar-lote").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sku = btn.dataset.sku;
      adicionarLote(entrega, sku);
    });
  });

  // Remover lote
  content.querySelectorAll(".remover-lote").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sku = btn.dataset.sku;
      const idx = Number(btn.dataset.loteIdx);
      removerLote(entrega, sku, idx);
    });
  });

  // Conferir item
  content.querySelectorAll(".conferir-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sku = btn.dataset.sku;
      conferirItem(entrega, sku);
    });
  });

  // Concluir separação
  content.querySelector("#btn-concluir-sep")?.addEventListener("click", () => {
    confirmarAcao("Confirmar conclusão da separação? Todos os itens serão marcados como conferidos.", () => {
      concluirSeparacao(entrega);
    });
  });
}

// ─── Ações de Separação ───────────────────────────────────────────────────────
function getEntregaFromState(id) {
  return state.entregas.find((e) => e.id_entrega === id);
}

function iniciarSeparacao(entrega) {
  const idx = state.entregas.findIndex((e) => e.id_entrega === entrega.id_entrega);
  if (idx < 0) return;

  const e = state.entregas[idx];
  e.status_interno = SI().EM_SEPARACAO;
  e.separacao = {
    iniciada_em: REF().toISOString(),
    itens: (e.itens || []).map((item) => ({
      id_produto: item.id_produto,
      sku: item.sku,
      nome: item.nome,
      quantidade_solicitada: item.quantidade,
      lotes: [],
      quantidade_separada: 0,
      conferido: false,
    })),
  };
  e.historico.push({
    data: REF().toISOString(),
    evento: "Separação iniciada",
    descricao: "Gestor iniciou a conferência dos itens.",
    tipo: "info",
  });

  window.RezFireEntregas.saveEntregas(state.entregas);
  renderKPIs();
  renderTable();
  renderDetalhe(e);
  // Redireciona para aba de separação
  document.querySelector('.detalhe-tab[data-tab="separacao"]')?.click();
  showToast("Separação iniciada.");
}

function coletarLotesDoForm(sku) {
  const content = document.getElementById("detalhe-content");
  const lotes = [];
  content?.querySelectorAll(`.lote-row[data-sku="${sku}"]`).forEach((row) => {
    const sel = row.querySelector(`.lote-select`);
    const qty = row.querySelector(`.lote-qty`);
    if (sel && qty) lotes.push({ id_lote: sel.value, quantidade: Number(qty.value), validade: "" });
  });
  return lotes;
}

function coletarQtdSemLote(sku) {
  return Number(document.querySelector(`.sem-lote-qty[data-sku="${sku}"]`)?.value || 0);
}

function conferirItem(entrega, sku) {
  const idx = state.entregas.findIndex((e) => e.id_entrega === entrega.id_entrega);
  if (idx < 0) return;
  const e = state.entregas[idx];
  const sep = e.separacao;
  const itemIdx = sep.itens.findIndex((i) => i.sku === sku);
  if (itemIdx < 0) return;
  const item = sep.itens[itemIdx];
  const isExt = sku.startsWith("EXT");

  let qtdSeparada = 0;
  let lotesSelecionados = [];

  if (isExt) {
    lotesSelecionados = coletarLotesDoForm(sku);
    // Validar lotes
    for (const l of lotesSelecionados) {
      if (!l.id_lote) {
        showToast("Selecione o lote para cada linha.", "erro");
        return;
      }
      if (!l.quantidade || l.quantidade <= 0) {
        showToast("Informe uma quantidade válida para cada lote.", "erro");
        return;
      }
    }
    // Buscar validade dos lotes
    lotesSelecionados = lotesSelecionados.map((l) => {
      const ld = window.RezFireEntregas.LOTES_SIMULADOS.find((ls) => ls.id_lote === l.id_lote);
      return { ...l, validade: ld ? ld.validade : "" };
    });
    qtdSeparada = lotesSelecionados.reduce((s, l) => s + l.quantidade, 0);

    if (lotesSelecionados.length === 0) {
      showToast("Adicione pelo menos um lote para este extintor.", "erro");
      return;
    }
  } else {
    qtdSeparada = coletarQtdSemLote(sku);
    if (qtdSeparada <= 0) {
      showToast("Informe a quantidade separada.", "erro");
      return;
    }
  }

  if (qtdSeparada !== item.quantidade_solicitada) {
    showToast(
      `Quantidade divergente: solicitada ${item.quantidade_solicitada}, separada ${qtdSeparada}. Corrija antes de confirmar.`,
      "erro"
    );
    return;
  }

  item.lotes = lotesSelecionados;
  item.quantidade_separada = qtdSeparada;
  item.conferido = true;

  window.RezFireEntregas.saveEntregas(state.entregas);
  renderDetalhe(e);
  document.querySelector('.detalhe-tab[data-tab="separacao"]')?.click();
  showToast(`Item ${sku} conferido.`, "sucesso");
}

function adicionarLote(entrega, sku) {
  const idx = state.entregas.findIndex((e) => e.id_entrega === entrega.id_entrega);
  if (idx < 0) return;
  const e = state.entregas[idx];
  const sep = e.separacao;
  const item = sep.itens.find((i) => i.sku === sku);
  if (!item) return;

  // Coletar lotes atuais do form antes de re-renderizar
  const lotesAtuais = coletarLotesDoForm(sku);
  item.lotes = lotesAtuais.map((l) => {
    const ld = window.RezFireEntregas.LOTES_SIMULADOS.find((ls) => ls.id_lote === l.id_lote);
    return { ...l, validade: ld ? ld.validade : "" };
  });

  item.lotes.push({ id_lote: "", quantidade: 1, validade: "" });

  window.RezFireEntregas.saveEntregas(state.entregas);
  renderDetalhe(e);
  document.querySelector('.detalhe-tab[data-tab="separacao"]')?.click();
}

function removerLote(entrega, sku, idx2) {
  const idx = state.entregas.findIndex((e) => e.id_entrega === entrega.id_entrega);
  if (idx < 0) return;
  const e = state.entregas[idx];
  const sep = e.separacao;
  const item = sep.itens.find((i) => i.sku === sku);
  if (!item) return;

  // Coletar lotes atuais do form
  const lotesAtuais = coletarLotesDoForm(sku);
  item.lotes = lotesAtuais.map((l) => {
    const ld = window.RezFireEntregas.LOTES_SIMULADOS.find((ls) => ls.id_lote === l.id_lote);
    return { ...l, validade: ld ? ld.validade : "" };
  });

  item.lotes.splice(idx2, 1);
  item.quantidade_separada = item.lotes.reduce((s, l) => s + l.quantidade, 0);

  window.RezFireEntregas.saveEntregas(state.entregas);
  renderDetalhe(e);
  document.querySelector('.detalhe-tab[data-tab="separacao"]')?.click();
}

function concluirSeparacao(entrega) {
  const idx = state.entregas.findIndex((e) => e.id_entrega === entrega.id_entrega);
  if (idx < 0) return;
  const e = state.entregas[idx];

  e.status_interno = SI().PRONTO_DESPACHO;
  e.separacao.concluida_em = REF().toISOString();
  e.historico.push({
    data: REF().toISOString(),
    evento: "Separação concluída",
    descricao: "Todos os itens conferidos. Pedido pronto para despacho.",
    tipo: "sucesso",
  });

  window.RezFireEntregas.saveEntregas(state.entregas);
  renderKPIs();
  renderTable();
  renderDetalhe(e);
  document.querySelector('.detalhe-tab[data-tab="separacao"]')?.click();
  showToast("Separação concluída! Pedido pronto para despacho.", "sucesso");
}

// ─── Ações logísticas ─────────────────────────────────────────────────────────
function registrarDespacho(entrega) {
  const idx = state.entregas.findIndex((e) => e.id_entrega === entrega.id_entrega);
  if (idx < 0) return;
  const e = state.entregas[idx];

  // Rastreio fictício — deixa claro que é simulação
  const fakeRastreio = "SIM" + Math.random().toString(36).substring(2, 10).toUpperCase() + "BR";

  e.status_interno = SI().DESPACHO_REGISTRADO;
  e.status_logistico = SL().EM_TRANSITO;
  e.data_despacho = REF().toISOString();
  e.codigo_rastreio = fakeRastreio;
  e.historico.push({
    data: REF().toISOString(),
    evento: "Despacho registrado",
    descricao: `Despacho registrado manualmente (simulação). Código gerado: ${fakeRastreio}. Em uma integração real, este dado virá da confirmação do Mercado Livre ou da transportadora.`,
    tipo: "sucesso",
  });
  e.historico.push({
    data: REF().toISOString(),
    evento: "Em trânsito",
    descricao: "Pedido enviado. Aguardando atualização do rastreamento.",
    tipo: "info",
  });

  // Remove alerta de atraso de despacho, se existia
  e.ocorrencias = (e.ocorrencias || []).filter((o) => o.tipo !== "atraso_despacho");

  window.RezFireEntregas.saveEntregas(state.entregas);
  renderKPIs();
  renderTable();
  renderDetalhe(e);
  renderDetalheAcoes(e);
  showToast("Despacho registrado (simulação).", "sucesso");
}

function registrarEntrega(entrega) {
  const idx = state.entregas.findIndex((e) => e.id_entrega === entrega.id_entrega);
  if (idx < 0) return;
  const e = state.entregas[idx];

  e.status_logistico = SL().ENTREGUE;
  e.data_entrega = REF().toISOString();
  e.historico.push({
    data: REF().toISOString(),
    evento: "Entregue",
    descricao: "Entrega registrada manualmente (simulação). A confirmação real virá da integração com o Mercado Livre ou da transportadora.",
    tipo: "sucesso",
  });

  window.RezFireEntregas.saveEntregas(state.entregas);
  renderKPIs();
  renderTable();
  renderDetalhe(e);
  renderDetalheAcoes(e);
  showToast("Entrega concluída registrada (simulação).", "sucesso");
}

function cancelarPedidoComEstorno(entrega) {
  const idx = state.entregas.findIndex((e) => e.id_entrega === entrega.id_entrega);
  if (idx < 0) return;
  const e = state.entregas[idx];

  e.status_interno = SI().CANCELADO;
  e.status_logistico = SL().CANCELADO;

  // 1. Conforme a regra alinhada na Seção 7 do AGENTS.md:
  // Como o débito de estoque já havia ocorrido na aprovação da venda, o cancelamento gera estorno no estoque e registro de Entrada em movimentações!
  if (window.RezFireData) {
    if (typeof window.RezFireData.loadProducts === "function" && typeof window.RezFireData.saveProducts === "function") {
      let produtos = window.RezFireData.loadProducts();
      (e.itens || []).forEach((item) => {
        produtos = produtos.map((p) => {
          if (p.id_produto === item.id_produto || p.sku === item.sku) {
            return {
              ...p,
              quantidade_atual: Number(p.quantidade_atual || 0) + Number(item.quantidade || 0),
            };
          }
          return p;
        });
      });
      window.RezFireData.saveProducts(produtos);
    }

    if (typeof window.RezFireData.loadMovements === "function" && typeof window.RezFireData.saveMovements === "function") {
      const movements = window.RezFireData.loadMovements();
      const nextId = movements.length > 0 ? Math.max(...movements.map((m) => m.id_movimentacao || 0)) + 1 : 1;
      
      (e.itens || []).forEach((item, itemIdx) => {
        movements.unshift({
          id_movimentacao: nextId + itemIdx,
          id_pedido: e.id_pedido_interno || 999,
          codigo_pedido: e.codigo_pedido_ml || e.codigo_pedido_direto || e.id_entrega,
          canal: e.canal,
          tipo_envio: e.modalidade_envio,
          cliente: e.cliente,
          uf: e.uf,
          status_pedido: "Cancelado",
          id_produto: item.id_produto,
          sku: item.sku,
          nome_produto: item.nome,
          tipo: "Entrada",
          motivo: "Cancelamento / Estorno de Pedido",
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          valor_total: item.subtotal,
          data: REF().toISOString(),
          responsavel: "Gestor RezFire (Estorno Operacional)",
          detalhes_remessa: null,
        });
      });
      window.RezFireData.saveMovements(movements);
    }
  }

  e.historico.push({
    data: REF().toISOString(),
    evento: "Pedido Cancelado",
    descricao: "Cancelamento operacional registrado. Estoque estornado automaticamente e movimentação de Entrada gerada no sistema.",
    tipo: "erro",
  });

  window.RezFireEntregas.saveEntregas(state.entregas);
  renderKPIs();
  renderTable();
  renderDetalhe(e);
  renderDetalheAcoes(e);
  showToast("Pedido cancelado e estoque estornado com sucesso!", "sucesso");
}

function renderDetalheAcoes(entrega) {
  const el = document.getElementById("detalhe-acoes");
  if (!el) return;

  const si = entrega.status_interno;
  const sl = entrega.status_logistico;
  const acoes = [];

  if (si === SI().PRONTO_DESPACHO && sl !== SL().ENTREGUE && sl !== SL().CANCELADO) {
    acoes.push(`
      <button class="btn-primary" id="btn-despachar" style="font-size:0.88rem">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        Registrar Despacho
      </button>
    `);
  }

  if (si === SI().DESPACHO_REGISTRADO && sl !== SL().ENTREGUE && sl !== SL().CANCELADO) {
    acoes.push(`
      <button class="btn-primary" id="btn-entregar" style="background:var(--up);font-size:0.88rem">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
        Confirmar Entrega
      </button>
    `);
  }

  // Ação de Cancelamento com Estorno de Estoque
  if (si !== SI().CANCELADO && sl !== SL().ENTREGUE) {
    acoes.push(`
      <button class="btn-ghost" id="btn-cancelar-pedido" style="color:var(--down);border-color:#fca5a5;font-size:0.88rem" title="Cancelar pedido e estornar estoque">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        Cancelar Pedido (Estornar)
      </button>
    `);
  }

  if (acoes.length > 0) {
    el.innerHTML = `
      <div class="modal-info-box" style="margin-bottom:10px;font-size:0.78rem">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        Ações operacionais conectadas ao Estoque e Movimentações do RezFire Manager.
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${acoes.join("")}</div>
    `;

    document.getElementById("btn-despachar")?.addEventListener("click", () => {
      confirmarAcao("Registrar despacho deste pedido? Um código de rastreio fictício será gerado (simulação).", () => {
        registrarDespacho(entrega);
      });
    });

    document.getElementById("btn-entregar")?.addEventListener("click", () => {
      confirmarAcao("Confirmar entrega deste pedido? Esta ação é irreversível nos dados de demonstração.", () => {
        registrarEntrega(entrega);
      });
    });

    document.getElementById("btn-cancelar-pedido")?.addEventListener("click", () => {
      confirmarAcao("Tem certeza que deseja cancelar este pedido? Conforme a regra de negócio, as quantidades serão devolvidas ao estoque físico e uma movimentação de estorno será registrada.", () => {
        cancelarPedidoComEstorno(entrega);
      });
    });
  } else {
    el.innerHTML = "";
  }
}

// ─── Modal de confirmação ─────────────────────────────────────────────────────
function confirmarAcao(mensagem, callback) {
  const modal = document.getElementById("modal-confirmacao");
  const txt = document.getElementById("confirm-msg");
  if (!modal || !txt) { callback(); return; }

  txt.textContent = mensagem;
  modal.classList.add("is-open");

  const btnSim = document.getElementById("btn-confirm-sim");
  const btnNao = document.getElementById("btn-confirm-nao");

  function fechar() {
    modal.classList.remove("is-open");
    btnSim.replaceWith(btnSim.cloneNode(true));
    btnNao.replaceWith(btnNao.cloneNode(true));
  }

  document.getElementById("btn-confirm-sim").addEventListener("click", () => { fechar(); callback(); }, { once: true });
  document.getElementById("btn-confirm-nao").addEventListener("click", fechar, { once: true });
}

// ─── Toast de feedback ────────────────────────────────────────────────────────
function showToast(msg, tipo = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  toast.textContent = msg;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-show"));
  setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3500);
}

// ─── Atualizar dados ──────────────────────────────────────────────────────────
function atualizarDados() {
  const btn = document.getElementById("btn-atualizar");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Atualizando...";
  }
  setTimeout(() => {
    state.entregas = window.RezFireEntregas.loadEntregas();
    renderKPIs();
    renderTable();
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Atualizar";
    }
    showToast("Dados de demonstração atualizados.", "sucesso");
  }, 600);
}

// ─── Inicialização ────────────────────────────────────────────────────────────
function init() {
  window.RezFireLayout.renderSidebar("entregas");

  state.entregas = window.RezFireEntregas.loadEntregas();

  renderKPIs();

  // Bind filtros
  document.getElementById("busca-entregas")?.addEventListener("input", (e) => {
    state.busca = e.target.value.trim();
    state.pagina = 1;
    renderTable();
  });

  document.getElementById("filtro-status")?.addEventListener("change", (e) => {
    state.filtroStatus = e.target.value;
    state.pagina = 1;
    renderTable();
    renderKPIHighlight();
  });

  document.getElementById("filtro-canal")?.addEventListener("change", (e) => {
    state.filtroCanal = e.target.value;
    state.pagina = 1;
    renderTable();
  });

  document.getElementById("filtro-periodo")?.addEventListener("change", (e) => {
    state.filtroPeriodo = e.target.value;
    state.pagina = 1;
    renderTable();
  });

  document.getElementById("filtro-despacho")?.addEventListener("change", (e) => {
    state.filtroDespacho = e.target.value;
    state.pagina = 1;
    renderTable();
  });

  document.getElementById("filtro-atrasados")?.addEventListener("change", (e) => {
    state.filtroApenasAtrasados = e.target.checked;
    state.pagina = 1;
    renderTable();
  });

  document.getElementById("btn-limpar")?.addEventListener("click", limparFiltros);
  document.getElementById("btn-atualizar")?.addEventListener("click", atualizarDados);

  // Fechar painel lateral com Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.detalheId) fecharDetalhe();
  });

  document.getElementById("detalhe-overlay")?.addEventListener("click", fecharDetalhe);

  renderTable();
}

document.addEventListener("DOMContentLoaded", init);
