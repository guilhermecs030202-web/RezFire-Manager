/**
 * pedidos.js
 * Lógica da página de Pedidos — RezFire Manager.
 *
 * Responsável pelo registro e gerenciamento comercial das vendas.
 * Integração reativa com:
 *   - layout.js (sidebar com RezFireLayout.renderSidebar("pedidos"))
 *   - mock-data.js (RezFireData: loadOrders, saveOrders, nextOrderId, loadProducts, loadMovements, saveMovements, formatMoney)
 *   - mock-entregas.js (RezFireEntregas: loadEntregas, saveEntregas)
 *
 * SIMULAÇÃO: Sem backend. Estado persistido no localStorage (rezfire.pedidos).
 */

// ─── Estado da página ─────────────────────────────────────────────────────────
let state = {
  pedidos: [],              // Lista completa de pedidos
  produtos: [],             // Catálogo de produtos para vinculação de itens
  filtroStatus: "todos",
  filtroCanal: "todos",
  filtroPeriodo: "todos",   // "7" | "30" | "90" | "todos"
  ordem: "data_desc",       // "data_desc" | "data_asc" | "valor_desc" | "valor_asc" | "codigo_desc"
  busca: "",
  pagina: 1,
  porPagina: 10,
  detalheId: null,          // id_pedido aberto no painel lateral
};

// Itens atualmente no formulário do modal (cadastro/edição)
let formItens = [];
let formModificado = false;
let pedidoParaCancelar = null;

// Atalho para formatação monetária (disponível globalmente em mock-data.js)
function money(val) {
  if (window.RezFireData && typeof window.RezFireData.formatMoney === "function") {
    return window.RezFireData.formatMoney(Number(val || 0));
  }
  return Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

function escapeHtml(val) {
  return String(val ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// ─── Badges de Status Comercial ───────────────────────────────────────────────
function getBadgeStatusComercial(status) {
  const map = {
    "Pendente de confirmação": { cls: "badge-pendente", label: "Pendente" },
    "Confirmado":              { cls: "badge-confirmado", label: "Confirmado" },
    "Em preparação":           { cls: "badge-preparacao", label: "Em preparação" },
    "Concluído":               { cls: "badge-concluido", label: "Concluído" },
    "Cancelado":               { cls: "badge-cancelado", label: "Cancelado" },
  };
  const cfg = map[status] || { cls: "badge-cancelado", label: status };
  return `<span class="status-comercial ${cfg.cls}"><span class="status-dot"></span>${cfg.label}</span>`;
}

// ─── Cálculo dos Indicadores do Topo ──────────────────────────────────────────
function computePedidosKPIs(pedidos) {
  const total = pedidos.length;
  const pendentes = pedidos.filter((p) => p.status === "Pendente de confirmação").length;
  const emAndamento = pedidos.filter((p) => ["Confirmado", "Em preparação"].includes(p.status)).length;
  const concluidos = pedidos.filter((p) => p.status === "Concluído").length;
  const cancelados = pedidos.filter((p) => p.status === "Cancelado").length;

  // Valor total de pedidos válidos (não cancelados)
  const pedidosValidos = pedidos.filter((p) => p.status !== "Cancelado");
  const valorTotalValidos = pedidosValidos.reduce((sum, p) => sum + Number(p.valor_total || 0), 0);
  
  // Valor de cancelados apresentado separadamente
  const pedidosCancelados = pedidos.filter((p) => p.status === "Cancelado");
  const valorTotalCancelados = pedidosCancelados.reduce((sum, p) => sum + Number(p.valor_total || 0), 0);

  return {
    total,
    pendentes,
    emAndamento,
    concluidos,
    cancelados,
    valorTotalValidos,
    valorTotalCancelados,
  };
}

function renderKPIs() {
  const kpis = computePedidosKPIs(state.pedidos);
  const el = document.getElementById("pedidos-kpis");
  if (!el) return;

  el.innerHTML = `
    <div class="card kpi-card" style="cursor:pointer" data-kpi-filter="todos" title="Clique para ver todos os pedidos">
      <p class="kpi-label">TOTAL DE PEDIDOS</p>
      <p class="kpi-value">${kpis.total}</p>
      <p class="kpi-hint">histórico completo cadastrado</p>
    </div>
    <div class="card kpi-card" style="cursor:pointer" data-kpi-filter="Pendente de confirmação" title="Clique para filtrar pendentes">
      <p class="kpi-label">PENDENTES DE CONFIRMAÇÃO</p>
      <p class="kpi-value" style="color:${kpis.pendentes > 0 ? "#d97706" : "var(--ink)"}">${kpis.pendentes}</p>
      <p class="kpi-hint">aguardando validação comercial</p>
    </div>
    <div class="card kpi-card" style="cursor:pointer" data-kpi-filter="Em preparação" title="Clique para filtrar em andamento">
      <p class="kpi-label">EM ANDAMENTO</p>
      <p class="kpi-value" style="color:#2563eb">${kpis.emAndamento}</p>
      <p class="kpi-hint">confirmados ou em preparação</p>
    </div>
    <div class="card kpi-card" style="cursor:pointer" data-kpi-filter="Concluído" title="Clique para filtrar concluídos">
      <p class="kpi-label">CONCLUÍDOS</p>
      <p class="kpi-value" style="color:var(--up)">${kpis.concluidos}</p>
      <p class="kpi-hint">vendas finalizadas com sucesso</p>
    </div>
    <div class="card kpi-card">
      <p class="kpi-label">VALOR TOTAL VÁLIDO</p>
      <p class="kpi-value" style="color:var(--accent);font-size:1.4rem">${money(kpis.valorTotalValidos)}</p>
      <p class="kpi-hint">
        exclui cancelados <span style="color:var(--down)">(${money(kpis.valorTotalCancelados)} em ${kpis.cancelados} canc.)</span>
      </p>
    </div>
  `;

  // Adiciona evento de clique rápido nos cards de KPI para filtrar tabela
  el.querySelectorAll("[data-kpi-filter]").forEach((card) => {
    card.addEventListener("click", () => {
      const f = card.getAttribute("data-kpi-filter");
      const sel = document.getElementById("filtro-status");
      if (sel) {
        sel.value = f;
        state.filtroStatus = f;
        state.pagina = 1;
        renderTable();
      }
    });
  });
}

// ─── Filtragem e Ordenação ────────────────────────────────────────────────────
function getFilteredAndSortedPedidos() {
  const refTime = new Date("2024-10-15T18:00:00Z").getTime();
  const dayMs = 86400000;
  const busca = state.busca.trim().toLowerCase();

  let list = state.pedidos.filter((p) => {
    // 1. Busca textual
    if (busca) {
      const matchCodigo = (p.codigo_pedido || "").toLowerCase().includes(busca);
      const matchExt = (p.codigo_externo_ml || "").toLowerCase().includes(busca);
      const matchCliente = (p.cliente || "").toLowerCase().includes(busca);
      const matchItens = (p.itens || []).some(
        (i) => (i.nome || "").toLowerCase().includes(busca) || (i.sku || "").toLowerCase().includes(busca)
      );
      if (!matchCodigo && !matchExt && !matchCliente && !matchItens) return false;
    }

    // 2. Filtro de Status
    if (state.filtroStatus !== "todos") {
      if (state.filtroStatus === "Em preparação") {
        if (!["Confirmado", "Em preparação"].includes(p.status)) return false;
      } else if (p.status !== state.filtroStatus) {
        return false;
      }
    }

    // 3. Filtro de Origem / Canal
    if (state.filtroCanal !== "todos") {
      if (p.canal !== state.filtroCanal) return false;
    }

    // 4. Filtro de Período
    if (state.filtroPeriodo !== "todos") {
      const dias = Number(state.filtroPeriodo);
      const t = new Date(p.data_pedido).getTime();
      const limite = refTime - dias * dayMs;
      if (t < limite) return false;
    }

    return true;
  });

  // Ordenação
  list.sort((a, b) => {
    if (state.ordem === "data_desc") {
      return new Date(b.data_pedido).getTime() - new Date(a.data_pedido).getTime();
    }
    if (state.ordem === "data_asc") {
      return new Date(a.data_pedido).getTime() - new Date(b.data_pedido).getTime();
    }
    if (state.ordem === "valor_desc") {
      return Number(b.valor_total || 0) - Number(a.valor_total || 0);
    }
    if (state.ordem === "valor_asc") {
      return Number(a.valor_total || 0) - Number(b.valor_total || 0);
    }
    if (state.ordem === "codigo_desc") {
      return (b.codigo_pedido || "").localeCompare(a.codigo_pedido || "");
    }
    return 0;
  });

  return list;
}

// ─── Renderização da Tabela Principal ─────────────────────────────────────────
function renderTable() {
  const body = document.getElementById("pedidos-body");
  const contador = document.getElementById("pedidos-contador");
  const pagInfo = document.getElementById("pedidos-paginacao-info");
  const pagAtual = document.getElementById("pedidos-pag-atual");
  const btnLimpar = document.getElementById("btn-limpar-filtros");
  if (!body) return;

  const filtered = getFilteredAndSortedPedidos();
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / state.porPagina) || 1;

  if (state.pagina > totalPages) state.pagina = totalPages;
  if (state.pagina < 1) state.pagina = 1;

  const start = (state.pagina - 1) * state.porPagina;
  const pageItems = filtered.slice(start, start + state.porPagina);

  if (contador) contador.textContent = `${totalItems} de ${state.pedidos.length} pedidos`;
  if (pagInfo) pagInfo.textContent = `Exibindo ${pageItems.length ? start + 1 : 0} a ${Math.min(start + state.porPagina, totalItems)} de ${totalItems} pedidos`;
  if (pagAtual) pagAtual.textContent = `${state.pagina} / ${totalPages}`;

  // Botão Limpar Filtros
  const temFiltroAtivo = state.busca || state.filtroStatus !== "todos" || state.filtroCanal !== "todos" || state.filtroPeriodo !== "todos";
  if (btnLimpar) btnLimpar.style.display = temFiltroAtivo ? "inline-block" : "none";

  if (pageItems.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:48px 20px;color:var(--muted)">
          <div style="font-size:1.1rem;font-weight:700;color:var(--ink);margin-bottom:6px">Nenhum pedido encontrado</div>
          <p style="margin:0 0 16px;font-size:0.88rem">Tente ajustar a busca ou os filtros aplicados.</p>
          <button class="btn-ghost" onclick="window.limparTodosFiltros()" style="font-size:0.82rem">Limpar todos os filtros</button>
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = pageItems.map((p) => {
    const qtdTotalUnidades = (p.itens || []).reduce((sum, i) => sum + Number(i.quantidade || 0), 0);
    const qtdProdutosDistintos = (p.itens || []).length;
    const isML = p.canal === "Mercado Livre";

    return `
      <tr style="cursor:pointer" data-row-id="${p.id_pedido}">
        <td>
          <span style="font-family:monospace;font-weight:700;color:var(--ink);display:block">${escapeHtml(p.codigo_pedido)}</span>
          ${isML && p.codigo_externo_ml ? `<span style="font-size:0.72rem;color:var(--muted);font-family:monospace">ML: ${escapeHtml(p.codigo_externo_ml)}</span>` : ""}
        </td>
        <td>
          <span style="font-size:0.85rem;color:var(--ink);display:block">${formatDateOnly(p.data_pedido)}</span>
          <span style="font-size:0.75rem;color:var(--muted)">${new Date(p.data_pedido).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
        </td>
        <td>
          <span style="font-weight:600;color:var(--ink);display:block">${escapeHtml(p.cliente || "Consumidor Final")}</span>
          <span style="font-size:0.75rem;color:var(--muted)">${p.uf || "SP"}</span>
        </td>
        <td>
          <span style="font-size:0.82rem;font-weight:600;display:inline-flex;align-items:center;gap:4px">
            ${isML 
              ? `<span style="width:8px;height:8px;border-radius:50%;background:#eab308"></span> Mercado Livre` 
              : `<span style="width:8px;height:8px;border-radius:50%;background:#3b82f6"></span> Venda Direta`}
          </span>
          <span style="display:block;font-size:0.72rem;color:var(--muted)">${escapeHtml(p.tipo_envio || "Padrão")}</span>
        </td>
        <td style="text-align:center">
          <strong style="color:var(--ink)">${qtdTotalUnidades}</strong>
          <span style="display:block;font-size:0.72rem;color:var(--muted)">${qtdProdutosDistintos} item(ns)</span>
        </td>
        <td style="text-align:right">
          <strong style="font-size:0.95rem;color:${p.status === "Cancelado" ? "var(--muted)" : "var(--ink)"}">
            ${money(p.valor_total)}
          </strong>
          ${p.desconto > 0 ? `<span style="display:block;font-size:0.7rem;color:var(--down)">desc. -${money(p.desconto)}</span>` : ""}
        </td>
        <td>
          ${getBadgeStatusComercial(p.status)}
        </td>
        <td style="text-align:right" onclick="event.stopPropagation()">
          <div style="display:inline-flex;gap:4px">
            <button class="icon-btn" data-action="view" data-id="${p.id_pedido}" title="Visualizar Detalhes">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            ${p.status !== "Cancelado" ? `
              <button class="icon-btn" data-action="edit" data-id="${p.id_pedido}" title="Editar Pedido">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button class="icon-btn" data-action="cancel" data-id="${p.id_pedido}" title="Cancelar Pedido" style="color:var(--down)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </button>
            ` : `
              <span style="font-size:0.75rem;color:var(--muted);padding:4px 6px">Cancelado</span>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ─── Painel Lateral de Detalhes (Drawer) ──────────────────────────────────────
function openDetalhePanel(pedidoId) {
  const pedido = state.pedidos.find((p) => p.id_pedido === Number(pedidoId));
  if (!pedido) return;

  state.detalheId = pedido.id_pedido;
  const panel = document.getElementById("detalhe-panel");
  const overlay = document.getElementById("detalhe-overlay");
  if (!panel || !overlay) return;

  // Verifica se existe entrega associada a este pedido no módulo de Entregas
  const entregas = (window.RezFireEntregas && typeof window.RezFireEntregas.loadEntregas === "function")
    ? window.RezFireEntregas.loadEntregas()
    : [];
  const entregaAssociada = entregas.find(
    (e) => e.id_pedido_interno === pedido.id_pedido || e.codigo_pedido_ml === pedido.codigo_pedido || e.codigo_pedido_direto === pedido.codigo_pedido
  );

  const qtdTotal = (pedido.itens || []).reduce((sum, i) => sum + Number(i.quantidade || 0), 0);
  const subtotal = Number(pedido.subtotal_itens || (pedido.itens || []).reduce((s, i) => s + (i.subtotal || (i.quantidade * i.preco_unitario)), 0));
  const desconto = Number(pedido.desconto || 0);
  const frete = Number(pedido.frete || 0);

  panel.innerHTML = `
    <!-- Header do Painel -->
    <div class="detalhe-head">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <h2 style="margin:0;font-size:1.2rem;font-weight:800;color:var(--ink)">${escapeHtml(pedido.codigo_pedido)}</h2>
            ${getBadgeStatusComercial(pedido.status)}
          </div>
          <span style="font-size:0.78rem;color:var(--muted)">Registrado em ${formatDate(pedido.data_pedido)}</span>
        </div>
        <button class="icon-btn" id="btn-fechar-detalhe" title="Fechar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>

    <!-- Corpo do Painel -->
    <div class="detalhe-body">

      ${pedido.status === "Cancelado" && pedido.motivo_cancelamento ? `
        <div class="detalhe-alerta alerta-erro" style="background:#fee2e2;border:1px solid #fca5a5;color:#991b1b;border-radius:8px;padding:12px;margin-bottom:16px">
          <strong>Motivo do Cancelamento:</strong> ${escapeHtml(pedido.motivo_cancelamento)}
        </div>
      ` : ""}

      <!-- 10. Resumo Comercial -->
      <section class="detalhe-section">
        <h3 class="detalhe-section-title">Resumo Comercial</h3>
        <div class="detalhe-grid">
          <div class="detalhe-field">
            <span class="detalhe-label">Cliente</span>
            <strong style="color:var(--ink)">${escapeHtml(pedido.cliente)}</strong>
          </div>
          <div class="detalhe-field">
            <span class="detalhe-label">Destino (UF)</span>
            <span>${pedido.uf || "SP"}</span>
          </div>
          <div class="detalhe-field">
            <span class="detalhe-label">Canal / Origem</span>
            <span>${pedido.canal}</span>
          </div>
          <div class="detalhe-field">
            <span class="detalhe-label">Tipo de Envio</span>
            <span>${pedido.tipo_envio || "Padrão"}</span>
          </div>
          ${pedido.codigo_externo_ml ? `
            <div class="detalhe-field span-2">
              <span class="detalhe-label">Identificador Mercado Livre</span>
              <span style="font-family:monospace;font-weight:700;color:#0e7490">${escapeHtml(pedido.codigo_externo_ml)}</span>
            </div>
          ` : ""}
        </div>
      </section>

      <!-- 10. Itens do Pedido -->
      <section class="detalhe-section">
        <h3 class="detalhe-section-title">Itens do Pedido (${qtdTotal} unidades)</h3>
        <div class="table-wrap" style="border:1px solid var(--line);border-radius:8px;overflow:hidden">
          <table class="products-table" style="margin:0">
            <thead>
              <tr>
                <th>Produto</th>
                <th style="width:60px;text-align:center">Qtd.</th>
                <th style="width:90px;text-align:right">Preço Un.</th>
                <th style="width:100px;text-align:right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${(pedido.itens || []).map((i) => `
                <tr>
                  <td>
                    <span class="prod-name" style="font-size:0.86rem">${escapeHtml(i.nome)}</span>
                    <span class="sku-sub" style="font-size:0.75rem">${escapeHtml(i.sku)}</span>
                  </td>
                  <td style="text-align:center;font-weight:700">${i.quantidade}</td>
                  <td style="text-align:right;color:var(--muted);font-size:0.82rem">${money(i.preco_unitario)}</td>
                  <td style="text-align:right;font-weight:600">${money(i.subtotal || (i.quantidade * i.preco_unitario))}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="text-align:right;font-size:0.82rem;color:var(--muted)">Subtotal Itens:</td>
                <td style="text-align:right;font-weight:600;font-size:0.85rem">${money(subtotal)}</td>
              </tr>
              ${desconto > 0 ? `
                <tr>
                  <td colspan="3" style="text-align:right;font-size:0.82rem;color:var(--down)">Desconto Comercial:</td>
                  <td style="text-align:right;font-weight:600;font-size:0.85rem;color:var(--down)">- ${money(desconto)}</td>
                </tr>
              ` : ""}
              ${frete > 0 ? `
                <tr>
                  <td colspan="3" style="text-align:right;font-size:0.82rem;color:var(--muted)">Frete:</td>
                  <td style="text-align:right;font-weight:600;font-size:0.85rem">+ ${money(frete)}</td>
                </tr>
              ` : ""}
              <tr>
                <td colspan="3" style="text-align:right;font-weight:800;font-size:0.95rem;border-top:1px solid var(--line)">Total do Pedido:</td>
                <td style="text-align:right;font-weight:800;font-size:1.1rem;color:var(--accent);border-top:1px solid var(--line)">${money(pedido.valor_total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <!-- Referência Logística / Entregas -->
      <section class="detalhe-section">
        <h3 class="detalhe-section-title">Situação Logística (Módulo Entregas)</h3>
        ${entregaAssociada ? `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:0.84rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-weight:700;color:var(--ink)">Remessa: ${entregaAssociada.id_entrega}</span>
              <span class="entrega-badge badge-transito">${entregaAssociada.status_logistico}</span>
            </div>
            <div style="color:var(--muted);font-size:0.78rem">
              Status interno: <strong>${entregaAssociada.status_interno}</strong>
              ${entregaAssociada.codigo_rastreio ? ` · Rastreio: <code>${entregaAssociada.codigo_rastreio}</code>` : ""}
            </div>
            <div style="margin-top:8px">
              <a href="entregas.html" target="_blank" style="color:var(--accent);font-weight:600;font-size:0.8rem;text-decoration:none;display:inline-flex;align-items:center;gap:4px">
                Ver no painel de Entregas →
              </a>
            </div>
          </div>
        ` : `
          <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:12px;font-size:0.84rem;color:var(--muted)">
            ℹ Nenhuma remessa logística em andamento para este pedido. A separação física é gerada após confirmação comercial.
          </div>
        `}
      </section>

      <!-- Observações -->
      ${pedido.observacoes ? `
        <section class="detalhe-section">
          <h3 class="detalhe-section-title">Observações Comerciais</h3>
          <p style="background:#faf7f3;border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:0;font-size:0.85rem;color:var(--ink);line-height:1.45">
            ${escapeHtml(pedido.observacoes)}
          </p>
        </section>
      ` : ""}

      <!-- 10. Histórico de Alterações -->
      <section class="detalhe-section">
        <h3 class="detalhe-section-title">Histórico e Auditoria</h3>
        <div class="timeline">
          ${(pedido.historico || [
            { data: pedido.data_pedido, evento: "Pedido registrado", descricao: `Registrado via ${pedido.canal}`, usuario: "Sistema" }
          ]).map((h) => `
            <div class="timeline-item">
              <div class="timeline-dot ${h.evento.includes('Cancelado') ? 'erro' : h.evento.includes('Concluído') ? 'sucesso' : 'info'}"></div>
              <div class="timeline-title">${escapeHtml(h.evento)}</div>
              <div class="timeline-desc">${escapeHtml(h.descricao)}</div>
              <div class="timeline-date">${formatDate(h.data)} ${h.usuario ? `· por ${escapeHtml(h.usuario)}` : ""}</div>
            </div>
          `).join("")}
        </div>
      </section>
    </div>

    <!-- Ações do Rodapé do Painel -->
    <div class="detalhe-foot">
      ${pedido.status !== "Cancelado" ? `
        <button class="btn-primary" id="btn-drawer-editar" style="font-size:0.84rem">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          Editar Pedido
        </button>
        <button class="btn-ghost" id="btn-drawer-cancelar" style="color:var(--down);border-color:#fca5a5;font-size:0.84rem">
          Cancelar Pedido
        </button>
      ` : `
        <span style="color:var(--muted);font-size:0.84rem">Pedido cancelado. Nenhuma ação comercial pendente.</span>
      `}
      <button class="btn-ghost" id="btn-drawer-fechar" style="margin-left:auto;font-size:0.84rem">Fechar</button>
    </div>
  `;

  panel.classList.add("is-open");
  overlay.classList.add("is-open");

  // Eventos do painel
  document.getElementById("btn-fechar-detalhe")?.addEventListener("click", closeDetalhePanel);
  document.getElementById("btn-drawer-fechar")?.addEventListener("click", closeDetalhePanel);
  document.getElementById("btn-drawer-editar")?.addEventListener("click", () => {
    closeDetalhePanel();
    openFormModal(pedido);
  });
  document.getElementById("btn-drawer-cancelar")?.addEventListener("click", () => {
    closeDetalhePanel();
    openModalCancelamento(pedido);
  });
}

function closeDetalhePanel() {
  const panel = document.getElementById("detalhe-panel");
  const overlay = document.getElementById("detalhe-overlay");
  if (panel) panel.classList.remove("is-open");
  if (overlay) overlay.classList.remove("is-open");
  state.detalheId = null;
}

// ─── Modal de Formulário (Cadastro e Edição) ──────────────────────────────────
function openFormModal(pedidoParaEditar = null) {
  const modal = document.getElementById("modal-pedido");
  const title = document.getElementById("modal-pedido-title");
  const errorEl = document.getElementById("form-pedido-error");
  if (!modal) return;

  errorEl.textContent = "";
  formModificado = false;

  // Carrega produtos para o select
  populateProdutosSelect();

  if (pedidoParaEditar) {
    title.textContent = `Editar pedido ${pedidoParaEditar.codigo_pedido}`;
    document.getElementById("pedido-id").value = pedidoParaEditar.id_pedido;
    document.getElementById("pedido-numero").value = pedidoParaEditar.codigo_pedido;
    
    // Formata data ISO para datetime-local
    const d = new Date(pedidoParaEditar.data_pedido);
    const pad = (n) => String(n).padStart(2, "0");
    const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    document.getElementById("pedido-data").value = localIso;

    document.getElementById("pedido-canal").value = pedidoParaEditar.canal || "Venda Direta";
    document.getElementById("pedido-cliente").value = pedidoParaEditar.cliente || "";
    document.getElementById("pedido-uf").value = pedidoParaEditar.uf || "SP";
    document.getElementById("pedido-status").value = pedidoParaEditar.status || "Confirmado";
    document.getElementById("pedido-desconto").value = Number(pedidoParaEditar.desconto || 0).toFixed(2);
    document.getElementById("pedido-frete").value = Number(pedidoParaEditar.frete || 0).toFixed(2);
    document.getElementById("pedido-observacoes").value = pedidoParaEditar.observacoes || "";
    document.getElementById("pedido-codigo-externo").value = pedidoParaEditar.codigo_externo_ml || "";

    // Copia itens
    formItens = (pedidoParaEditar.itens || []).map((i) => ({
      id_produto: i.id_produto,
      sku: i.sku,
      nome: i.nome,
      quantidade: Number(i.quantidade || 1),
      preco_unitario: Number(i.preco_unitario || 0),
      desconto: Number(i.desconto || 0),
      subtotal: Number(i.subtotal || (i.quantidade * i.preco_unitario)),
    }));
  } else {
    title.textContent = "Novo pedido";
    document.getElementById("pedido-id").value = "";
    
    // Gera código único para o pedido local
    const nextId = window.RezFireData.nextOrderId(state.pedidos);
    document.getElementById("pedido-numero").value = `PED-${String(nextId).padStart(4, "0")}`;

    // Data atual formatada para datetime-local
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    document.getElementById("pedido-data").value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

    document.getElementById("pedido-canal").value = "Venda Direta";
    document.getElementById("pedido-cliente").value = "";
    document.getElementById("pedido-uf").value = "SP";
    document.getElementById("pedido-status").value = "Confirmado";
    document.getElementById("pedido-desconto").value = "0.00";
    document.getElementById("pedido-frete").value = "0.00";
    document.getElementById("pedido-observacoes").value = "";
    document.getElementById("pedido-codigo-externo").value = "";

    formItens = [];
  }

  updateCanalVisibility();
  renderFormItensTable();
  recalcularResumoFinanceiro();

  modal.classList.add("is-open");
}

function closeFormModal(forcar = false) {
  if (!forcar && formModificado) {
    if (!confirm("Você possui alterações não salvas no pedido. Deseja realmente descartar?")) {
      return;
    }
  }
  const modal = document.getElementById("modal-pedido");
  if (modal) modal.classList.remove("is-open");
  formItens = [];
  formModificado = false;
}

function updateCanalVisibility() {
  const canal = document.getElementById("pedido-canal")?.value;
  const wrapExt = document.getElementById("wrap-codigo-externo");
  if (wrapExt) {
    wrapExt.style.display = canal === "Mercado Livre" ? "block" : "none";
  }
}

function populateProdutosSelect() {
  const select = document.getElementById("select-item-produto");
  if (!select) return;

  state.produtos = window.RezFireData.loadProducts();
  const options = state.produtos
    .filter((p) => p.ativo !== false)
    .map((p) => `<option value="${p.id_produto}" data-preco="${p.preco}" data-sku="${p.sku}">${p.sku} - ${escapeHtml(p.nome)} (${money(p.preco)})</option>`)
    .join("");

  select.innerHTML = `<option value="">— Selecione um produto —</option>` + options;
}

function renderFormItensTable() {
  const body = document.getElementById("form-itens-body");
  if (!body) return;

  if (formItens.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:20px;color:var(--muted);font-size:0.85rem">
          Nenhum produto adicionado. Selecione um produto acima e clique em <strong>+ Adicionar Item</strong>.
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = formItens.map((item, idx) => `
    <tr>
      <td>
        <span class="prod-name" style="font-size:0.86rem">${escapeHtml(item.nome)}</span>
        <span class="sku-sub" style="font-size:0.75rem">${escapeHtml(item.sku)}</span>
      </td>
      <td style="text-align:center">
        <input type="number" min="1" step="1" value="${item.quantidade}" 
          class="search-input item-qty-input" data-item-idx="${idx}"
          style="width:65px;padding:4px;text-align:center;font-size:0.85rem" />
      </td>
      <td style="text-align:right">
        <input type="number" min="0" step="0.01" value="${item.preco_unitario.toFixed(2)}" 
          class="search-input item-price-input" data-item-idx="${idx}"
          style="width:90px;padding:4px;text-align:right;font-size:0.85rem" />
      </td>
      <td style="text-align:right;font-weight:700">
        ${money(item.subtotal)}
      </td>
      <td style="text-align:center">
        <button type="button" class="icon-btn remover-item-btn" data-item-idx="${idx}" title="Remover item" style="color:var(--down)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </td>
    </tr>
  `).join("");

  // Eventos de alteração de quantidade e preço diretamente na tabela de itens
  body.querySelectorAll(".item-qty-input").forEach((inp) => {
    inp.addEventListener("change", (e) => {
      const idx = Number(e.target.getAttribute("data-item-idx"));
      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
      formItens[idx].quantidade = val;
      formItens[idx].subtotal = val * formItens[idx].preco_unitario;
      formModificado = true;
      renderFormItensTable();
      recalcularResumoFinanceiro();
    });
  });

  body.querySelectorAll(".item-price-input").forEach((inp) => {
    inp.addEventListener("change", (e) => {
      const idx = Number(e.target.getAttribute("data-item-idx"));
      const val = Math.max(0, parseFloat(e.target.value) || 0);
      formItens[idx].preco_unitario = val;
      formItens[idx].subtotal = formItens[idx].quantidade * val;
      formModificado = true;
      renderFormItensTable();
      recalcularResumoFinanceiro();
    });
  });

  body.querySelectorAll(".remover-item-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = Number(btn.getAttribute("data-item-idx"));
      formItens.splice(idx, 1);
      formModificado = true;
      renderFormItensTable();
      recalcularResumoFinanceiro();
    });
  });
}

function recalcularResumoFinanceiro() {
  const subtotal = formItens.reduce((sum, i) => sum + Number(i.subtotal || 0), 0);
  const desconto = Math.max(0, parseFloat(document.getElementById("pedido-desconto")?.value) || 0);
  const frete = Math.max(0, parseFloat(document.getElementById("pedido-frete")?.value) || 0);
  const total = Math.max(0, subtotal - desconto + frete);

  const subEl = document.getElementById("resumo-subtotal");
  const descEl = document.getElementById("resumo-desconto");
  const freteEl = document.getElementById("resumo-frete");
  const totalEl = document.getElementById("resumo-total");

  if (subEl) subEl.textContent = money(subtotal);
  if (descEl) descEl.textContent = `- ${money(desconto)}`;
  if (freteEl) freteEl.textContent = `+ ${money(frete)}`;
  if (totalEl) totalEl.textContent = money(total);

  return { subtotal, desconto, frete, total };
}

// ─── Modal de Cancelamento de Pedido com Motivo ───────────────────────────────
function openModalCancelamento(pedido) {
  if (!pedido) return;
  pedidoParaCancelar = pedido;

  const modal = document.getElementById("modal-cancelar-pedido");
  const codEl = document.getElementById("cancel-pedido-codigo");
  const motivoEl = document.getElementById("cancel-motivo");

  if (codEl) codEl.textContent = pedido.codigo_pedido;
  if (motivoEl) motivoEl.value = "";
  if (modal) modal.classList.add("is-open");
}

function closeModalCancelamento() {
  const modal = document.getElementById("modal-cancelar-pedido");
  if (modal) modal.classList.remove("is-open");
  pedidoParaCancelar = null;
}

function executarCancelamento() {
  if (!pedidoParaCancelar) return;
  const motivo = document.getElementById("cancel-motivo")?.value.trim();
  if (!motivo) {
    alert("Por favor, informe o motivo do cancelamento.");
    return;
  }

  const p = pedidoParaCancelar;
  p.status = "Cancelado";
  p.motivo_cancelamento = motivo;

  const dataCanc = new Date("2024-10-15T18:00:00Z").toISOString();
  p.historico = p.historico || [];
  p.historico.push({
    data: dataCanc,
    evento: "Cancelamento do Pedido",
    descricao: `Motivo: ${motivo}. Estoque estornado no sistema.`,
    usuario: "Gestor RezFire",
  });

  // Conforme a regra Seção 7 do AGENTS.md:
  // Cancelamento pós-aprovação estorna o estoque e gera movimentação de Entrada
  if (window.RezFireData) {
    let produtos = window.RezFireData.loadProducts();
    (p.itens || []).forEach((item) => {
      produtos = produtos.map((prod) => {
        if (prod.id_produto === item.id_produto || prod.sku === item.sku) {
          return {
            ...prod,
            quantidade_atual: Number(prod.quantidade_atual || 0) + Number(item.quantidade || 0),
          };
        }
        return prod;
      });
    });
    window.RezFireData.saveProducts(produtos);

    const movements = window.RezFireData.loadMovements();
    const nextMovId = movements.length > 0 ? Math.max(...movements.map((m) => m.id_movimentacao || 0)) + 1 : 1;
    (p.itens || []).forEach((item, idx) => {
      movements.unshift({
        id_movimentacao: nextMovId + idx,
        id_pedido: p.id_pedido,
        codigo_pedido: p.codigo_pedido,
        canal: p.canal,
        tipo_envio: p.tipo_envio,
        cliente: p.cliente,
        uf: p.uf,
        status_pedido: "Cancelado",
        id_produto: item.id_produto,
        sku: item.sku,
        nome_produto: item.nome,
        tipo: "Entrada",
        motivo: "Estorno de Cancelamento de Pedido",
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        valor_total: item.subtotal || (item.quantidade * item.preco_unitario),
        data: dataCanc,
        responsavel: "Gestor RezFire (Estorno Comercial)",
        detalhes_remessa: null,
      });
    });
    window.RezFireData.saveMovements(movements);
  }

  // Sincroniza também no módulo de Entregas, se existir remessa correspondente
  if (window.RezFireEntregas && typeof window.RezFireEntregas.loadEntregas === "function") {
    let entregas = window.RezFireEntregas.loadEntregas();
    let entregaUpdated = false;
    entregas = entregas.map((ent) => {
      if (ent.id_pedido_interno === p.id_pedido || ent.codigo_pedido_ml === p.codigo_pedido || ent.codigo_pedido_direto === p.codigo_pedido) {
        entregaUpdated = true;
        return {
          ...ent,
          status_interno: window.RezFireEntregas.STATUS_INTERNO.CANCELADO,
          status_logistico: window.RezFireEntregas.STATUS_LOGISTICO.CANCELADO,
          historico: [
            ...(ent.historico || []),
            { data: dataCanc, evento: "Pedido Cancelado no Módulo Comercial", descricao: `Motivo: ${motivo}`, tipo: "erro" }
          ]
        };
      }
      return ent;
    });
    if (entregaUpdated) {
      window.RezFireEntregas.saveEntregas(entregas);
    }
  }

  // Salva pedidos atualizados
  window.RezFireData.saveOrders(state.pedidos);
  closeModalCancelamento();
  renderKPIs();
  renderTable();
  showToast(`Pedido ${p.codigo_pedido} cancelado com sucesso. Estoque estornado.`, "sucesso");
}

// ─── Toasts de Notificação ────────────────────────────────────────────────────
function showToast(msg, tipo = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const t = document.createElement("div");
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  container.appendChild(t);

  setTimeout(() => t.classList.add("toast-show"), 10);
  setTimeout(() => {
    t.classList.remove("toast-show");
    setTimeout(() => t.remove(), 250);
  }, 3200);
}

// ─── Limpar Todos os Filtros ──────────────────────────────────────────────────
window.limparTodosFiltros = function () {
  state.busca = "";
  state.filtroStatus = "todos";
  state.filtroCanal = "todos";
  state.filtroPeriodo = "todos";
  state.pagina = 1;

  const b = document.getElementById("busca-pedidos");
  const s = document.getElementById("filtro-status");
  const c = document.getElementById("filtro-canal");
  const p = document.getElementById("filtro-periodo");

  if (b) b.value = "";
  if (s) s.value = "todos";
  if (c) c.value = "todos";
  if (p) p.value = "todos";

  renderTable();
};

// ─── Vinculação de Eventos Globais ───────────────────────────────────────────
function bindEvents() {
  // Busca
  document.getElementById("busca-pedidos")?.addEventListener("input", (e) => {
    state.busca = e.target.value;
    state.pagina = 1;
    renderTable();
  });

  // Filtros
  document.getElementById("filtro-status")?.addEventListener("change", (e) => {
    state.filtroStatus = e.target.value;
    state.pagina = 1;
    renderTable();
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

  document.getElementById("ordem-pedidos")?.addEventListener("change", (e) => {
    state.ordem = e.target.value;
    renderTable();
  });

  document.getElementById("btn-limpar-filtros")?.addEventListener("click", window.limparTodosFiltros);

  // Paginação
  document.getElementById("btn-pag-ant")?.addEventListener("click", () => {
    if (state.pagina > 1) {
      state.pagina--;
      renderTable();
    }
  });

  document.getElementById("btn-pag-prox")?.addEventListener("click", () => {
    const totalPages = Math.ceil(getFilteredAndSortedPedidos().length / state.porPagina);
    if (state.pagina < totalPages) {
      state.pagina++;
      renderTable();
    }
  });

  // Atualizar
  document.getElementById("btn-atualizar")?.addEventListener("click", () => {
    state.pedidos = window.RezFireData.loadOrders();
    renderKPIs();
    renderTable();
    showToast("Dados de pedidos atualizados.", "info");
  });

  // Abertura de Modal Novo Pedido
  document.getElementById("btn-novo-pedido")?.addEventListener("click", () => openFormModal(null));
  document.getElementById("btn-fechar-modal-pedido")?.addEventListener("click", () => closeFormModal(false));
  document.getElementById("btn-cancelar-form-pedido")?.addEventListener("click", () => closeFormModal(false));

  // Clique no backdrop do modal para fechar (com confirmação se modificado)
  document.getElementById("modal-pedido")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-pedido") closeFormModal(false);
  });

  // Troca de origem no form
  document.getElementById("pedido-canal")?.addEventListener("change", () => {
    formModificado = true;
    updateCanalVisibility();
  });

  // Seleção de produto para preencher preço padrão
  document.getElementById("select-item-produto")?.addEventListener("change", (e) => {
    const opt = e.target.selectedOptions[0];
    const preco = opt ? opt.getAttribute("data-preco") : 0;
    const precoInp = document.getElementById("input-item-preco");
    if (precoInp && preco) precoInp.value = Number(preco).toFixed(2);
  });

  // Botão Adicionar Item no Modal
  document.getElementById("btn-adicionar-item")?.addEventListener("click", () => {
    const sel = document.getElementById("select-item-produto");
    const qtdInp = document.getElementById("input-item-qtd");
    const precoInp = document.getElementById("input-item-preco");

    const id = Number(sel?.value);
    const qtd = parseInt(qtdInp?.value, 10);
    const preco = parseFloat(precoInp?.value);

    if (!id) {
      alert("Selecione um produto do catálogo.");
      return;
    }
    if (!qtd || qtd < 1) {
      alert("A quantidade deve ser um número inteiro positivo.");
      return;
    }
    if (Number.isNaN(preco) || preco < 0) {
      alert("O preço unitário não pode ser negativo.");
      return;
    }

    const prod = state.produtos.find((p) => p.id_produto === id);
    if (!prod) return;

    // Se já estiver na lista, apenas incrementa quantidade
    const existente = formItens.find((i) => i.id_produto === id);
    if (existente) {
      existente.quantidade += qtd;
      existente.preco_unitario = preco;
      existente.subtotal = existente.quantidade * preco;
    } else {
      formItens.push({
        id_produto: prod.id_produto,
        sku: prod.sku,
        nome: prod.nome,
        quantidade: qtd,
        preco_unitario: preco,
        desconto: 0,
        subtotal: qtd * preco,
      });
    }

    formModificado = true;
    sel.value = "";
    qtdInp.value = "1";
    precoInp.value = "";
    renderFormItensTable();
    recalcularResumoFinanceiro();
  });

  // Inputs de frete e desconto no formulário
  document.getElementById("pedido-desconto")?.addEventListener("input", () => {
    formModificado = true;
    recalcularResumoFinanceiro();
  });
  document.getElementById("pedido-frete")?.addEventListener("input", () => {
    formModificado = true;
    recalcularResumoFinanceiro();
  });

  // Marcar outros campos como modificados
  ["pedido-data", "pedido-cliente", "pedido-uf", "pedido-status", "pedido-observacoes", "pedido-codigo-externo"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => { formModificado = true; });
  });

  // Submissão do formulário de pedido
  document.getElementById("form-pedido")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("form-pedido-error");
    errorEl.textContent = "";

    const editingId = Number(document.getElementById("pedido-id")?.value) || null;
    const codigo_pedido = document.getElementById("pedido-numero")?.value.trim();
    const data_pedido = document.getElementById("pedido-data")?.value;
    const canal = document.getElementById("pedido-canal")?.value;
    const cliente = document.getElementById("pedido-cliente")?.value.trim();
    const uf = document.getElementById("pedido-uf")?.value;
    const status = document.getElementById("pedido-status")?.value;
    const observacoes = document.getElementById("pedido-observacoes")?.value.trim();
    const codigo_externo_ml = canal === "Mercado Livre" ? document.getElementById("pedido-codigo-externo")?.value.trim() : null;

    // 9. Validações
    if (!cliente) {
      errorEl.textContent = "Informe a identificação do cliente.";
      return;
    }
    if (!data_pedido) {
      errorEl.textContent = "Informe a data do pedido.";
      return;
    }
    if (formItens.length === 0) {
      errorEl.textContent = "O pedido deve ter pelo menos um produto selecionado.";
      return;
    }

    const { subtotal, desconto, frete, total } = recalcularResumoFinanceiro();

    const agoraIso = new Date().toISOString();
    const dataPedidoIso = new Date(data_pedido).toISOString();

    if (editingId) {
      // Edição
      const idx = state.pedidos.findIndex((p) => p.id_pedido === editingId);
      if (idx >= 0) {
        const ped = state.pedidos[idx];
        ped.cliente = cliente;
        ped.uf = uf;
        ped.canal = canal;
        ped.status = status;
        ped.data_pedido = dataPedidoIso;
        ped.codigo_externo_ml = codigo_externo_ml;
        ped.observacoes = observacoes;
        ped.itens = [...formItens];
        ped.subtotal_itens = subtotal;
        ped.desconto = desconto;
        ped.frete = frete;
        ped.valor_total = total;

        ped.historico = ped.historico || [];
        ped.historico.push({
          data: agoraIso,
          evento: "Pedido editado",
          descricao: `Alterações salvas comercialmente. Total: ${money(total)}.`,
          usuario: "Gestor RezFire",
        });
      }
      showToast(`Pedido ${codigo_pedido} atualizado com sucesso!`, "sucesso");
    } else {
      // Criação de novo pedido
      const novoId = window.RezFireData.nextOrderId(state.pedidos);
      const novoPedido = {
        id_pedido: novoId,
        codigo_pedido,
        codigo_externo_ml,
        canal,
        tipo_envio: canal === "Mercado Livre" ? "Mercado Envios Coleta" : "Transportadora Própria",
        data_pedido: dataPedidoIso,
        cliente,
        uf,
        status,
        itens: [...formItens],
        subtotal_itens: subtotal,
        desconto,
        frete,
        valor_total: total,
        custo_total: formItens.reduce((s, i) => s + (i.quantidade * (i.preco_unitario * 0.5)), 0),
        lucro_bruto: total * 0.45,
        observacoes,
        historico: [
          { data: agoraIso, evento: "Pedido registrado", descricao: `Cadastro manual via ${canal}.`, usuario: "Gestor RezFire" },
        ],
      };

      // Regra Seção 7 AGENTS.md: Débito de estoque físico na aprovação/confirmação
      if (status !== "Pendente de confirmação" && status !== "Cancelado") {
        let produtos = window.RezFireData.loadProducts();
        (novoPedido.itens || []).forEach((item) => {
          produtos = produtos.map((p) => {
            if (p.id_produto === item.id_produto || p.sku === item.sku) {
              return {
                ...p,
                quantidade_atual: Math.max(0, Number(p.quantidade_atual || 0) - Number(item.quantidade || 0)),
              };
            }
            return p;
          });
        });
        window.RezFireData.saveProducts(produtos);

        // Movimentação de Saída
        const movements = window.RezFireData.loadMovements();
        const nextMovId = movements.length > 0 ? Math.max(...movements.map((m) => m.id_movimentacao || 0)) + 1 : 1;
        (novoPedido.itens || []).forEach((item, idx) => {
          movements.unshift({
            id_movimentacao: nextMovId + idx,
            id_pedido: novoId,
            codigo_pedido,
            canal,
            tipo_envio: novoPedido.tipo_envio,
            cliente,
            uf,
            status_pedido: status,
            id_produto: item.id_produto,
            sku: item.sku,
            nome_produto: item.nome,
            tipo: "Saída",
            motivo: canal === "Mercado Livre" ? "Venda Mercado Livre" : "Venda Direta",
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            valor_total: item.subtotal,
            data: dataPedidoIso,
            responsavel: "Gestor RezFire",
            detalhes_remessa: null,
          });
        });
        window.RezFireData.saveMovements(movements);
      }

      state.pedidos.unshift(novoPedido);
      showToast(`Pedido ${codigo_pedido} registrado com sucesso!`, "sucesso");
    }

    window.RezFireData.saveOrders(state.pedidos);
    closeFormModal(true);
    renderKPIs();
    renderTable();
  });

  // Cliques na tabela (abrir detalhes ou botões de ação)
  document.getElementById("pedidos-body")?.addEventListener("click", (e) => {
    const actionBtn = e.target.closest("button[data-action]");
    if (actionBtn) {
      const action = actionBtn.getAttribute("data-action");
      const id = Number(actionBtn.getAttribute("data-id"));
      const pedido = state.pedidos.find((p) => p.id_pedido === id);
      if (!pedido) return;

      if (action === "view") openDetalhePanel(id);
      if (action === "edit") openFormModal(pedido);
      if (action === "cancel") openModalCancelamento(pedido);
      return;
    }

    // Clique na linha
    const row = e.target.closest("tr[data-row-id]");
    if (row) {
      const id = Number(row.getAttribute("data-row-id"));
      openDetalhePanel(id);
    }
  });

  // Modal Cancelamento
  document.getElementById("btn-abortar-cancelamento")?.addEventListener("click", closeModalCancelamento);
  document.getElementById("btn-confirmar-cancelamento")?.addEventListener("click", executarCancelamento);
  document.getElementById("modal-cancelar-pedido")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-cancelar-pedido") closeModalCancelamento();
  });

  // Fechar overlay
  document.getElementById("detalhe-overlay")?.addEventListener("click", closeDetalhePanel);
}

// ─── Inicialização da Página ──────────────────────────────────────────────────
function init() {
  window.RezFireLayout.renderSidebar("pedidos");
  state.pedidos = window.RezFireData.loadOrders();
  state.produtos = window.RezFireData.loadProducts();

  bindEvents();
  renderKPIs();
  renderTable();
}

// Inicializa quando o DOM estiver pronto
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
