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
  filtroMotivo: "todos",    // "todos" ou motivo padronizado (SCRUM-22)
  filtroCanal: "todos",
  filtroPeriodo: "todos",   // "7" | "30" | "90" | "todos"
  filtroStatusFiscal: "todos",
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
  const str = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [yyyy, mm, dd] = str.split("-");
    return `${dd}/${mm}/${yyyy}`;
  }
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

function isGestorUsuario() {
  try {
    const raw = localStorage.getItem("rezfire_user");
    if (!raw) return true;
    const u = JSON.parse(raw);
    return !u.perfil || String(u.perfil).toUpperCase() === "GESTOR";
  } catch {
    return true;
  }
}

function formatarDocFiscal(doc) {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return doc || "—";
}

function formatarCepFiscal(cep) {
  const d = String(cep || "").replace(/\D/g, "").slice(0, 8);
  if (!d) return "";
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function aplicarMascaraDocFiscal(val) {
  const d = String(val || "").replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// ─── Normalização de Dados da Entidade Pedido (API & MySQL) ───────────────────
function normalizarPedido(p) {
  if (!p) return null;
  const statusMapeado = (p.status === "Concluido" || p.status === "Concluído") ? "Concluído" : p.status;
  const itensMapeados = Array.isArray(p.itens)
    ? p.itens.map((it) => ({
        id_item: it.id_item,
        id_produto: it.id_produto || it.produto?.id_produto,
        sku: it.produto?.sku || it.sku || `PROD-${it.id_produto}`,
        nome: it.produto?.nome || it.nome || "Produto",
        quantidade: Number(it.quantidade || 1),
        preco_unitario: Number(it.preco_unitario || it.produto?.preco || 0),
        subtotal: Number(it.subtotal || (Number(it.quantidade || 1) * Number(it.preco_unitario || it.produto?.preco || 0))),
      }))
    : [];

  return {
    ...p,
    id_pedido: Number(p.id_pedido),
    codigo_pedido: p.codigo_pedido || `#PED-${p.id_pedido}`,
    cliente: p.cliente_nome || p.cliente || "Cliente",
    cliente_nome: p.cliente_nome || p.cliente || "Cliente",
    canal: p.origem || p.canal || "Venda Direta",
    origem: p.origem || p.canal || "Venda Direta",
    uf: p.uf || "SP",
    status: statusMapeado,
    status_entrega: p.status_entrega || "A separar",
    tipo_envio: p.tipo_envio || (p.origem === "Mercado Livre" ? "Mercado Envios" : "Transportadora Própria"),
    data_pedido: p.data_pedido,
    valor_total: Number(p.valor_total || 0),
    itens: itensMapeados,
    observacoes: p.observacoes || "",
    motivo_cancelamento: p.motivo_cancelamento || p.motivo_devolucao || "",
    motivo_devolucao: p.motivo_devolucao || "",
    tipo_ocorrencia: p.tipo_ocorrencia || (statusMapeado === "Cancelado" ? "Cancelamento" : ""),
    detalhe_devolucao: p.detalhe_devolucao || "",
    protocolo_mediacao: p.protocolo_mediacao || "",
    data_devolucao: p.data_devolucao || null,
    // Módulo Financeiro: Lucro Real (#18abc)
    tipo_anuncio: p.tipo_anuncio || (p.origem === "Mercado Livre" ? "Classico" : "Direta"),
    custo_produtos: Number(p.custo_produtos || 0),
    aliquota_imposto_percentual: Number(p.aliquota_imposto_percentual || 6.00),
    custo_impostos: Number(p.custo_impostos || 0),
    custo_embalagem: Number(p.custo_embalagem !== undefined ? p.custo_embalagem : 5.00),
    tarifa_ml_percentual: Number(p.tarifa_ml_percentual !== undefined ? p.tarifa_ml_percentual : 12.00),
    tarifa_ml_comissao: Number(p.tarifa_ml_comissao || 0),
    tarifa_ml_fixa: Number(p.tarifa_ml_fixa || 0),
    custo_frete: Number(p.custo_frete || 0),
    custo_ads: Number(p.custo_ads || 0),
    total_custos_fixos: Number(p.total_custos_fixos || 0),
    total_tarifas_plataforma: Number(p.total_tarifas_plataforma || 0),
    lucro_liquido: Number(p.lucro_liquido || 0),
    margem_liquida_percentual: Number(p.margem_liquida_percentual || 0),
    // Modalidade de Envio (#24 / SCRUM-27)
    modalidade_envio: p.modalidade_envio || (p.origem === "Mercado Livre" ? "Coleta" : "Logística Própria"),
    prazo_dias_estimado: Number(p.prazo_dias_estimado !== undefined ? p.prazo_dias_estimado : 3),
    data_entrega_efetiva: p.data_entrega_efetiva || null,
    // Destinatário Fiscal e NF-e (Story 33c)
    destinatario_documento: p.destinatario_documento || "",
    destinatario_ie: p.destinatario_ie || "",
    destinatario_cep: p.destinatario_cep || "",
    destinatario_logradouro: p.destinatario_logradouro || "",
    destinatario_numero: p.destinatario_numero || "",
    destinatario_complemento: p.destinatario_complemento || "",
    destinatario_bairro: p.destinatario_bairro || "",
    destinatario_municipio: p.destinatario_municipio || "",
    destinatario_codigo_municipio_ibge: p.destinatario_codigo_municipio_ibge || "",
    destinatario_uf: p.destinatario_uf || p.uf || "",
    destinatario_email: p.destinatario_email || "",
    valor_desconto: Number(p.valor_desconto ?? p.desconto ?? 0),
    desconto: Number(p.valor_desconto ?? p.desconto ?? 0),
    status_fiscal: p.status_fiscal || (p.nota_fiscal_resumo ? p.nota_fiscal_resumo.status : "sem_nota"),
    nota_fiscal_resumo: p.nota_fiscal_resumo || null,
  };
}

// ─── Badge de Status Fiscal (Stories 33c / 33d) ───────────────────────────────
function getBadgeStatusFiscal(pedido) {
  const nf = pedido?.nota_fiscal_resumo || null;
  const st = pedido?.status_fiscal || (nf ? nf.status : "sem_nota") || "sem_nota";
  const estilos = {
    sem_nota:         { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1", label: "Sem NF-e" },
    rascunho:         { bg: "#fefce8", color: "#854d0e", border: "#fde047", label: "NF-e Rascunho" },
    assinada:         { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", label: "NF-e Assinada" },
    em_processamento: { bg: "#fff7ed", color: "#c2410c", border: "#fdba74", label: "Processando SEFAZ" },
    autorizada:       { bg: "#ecfdf5", color: "#065f46", border: "#86efac", label: "NF-e Autorizada" },
    rejeitada:        { bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5", label: "NF-e Rejeitada" },
    denegada:         { bg: "#450a0a", color: "#fef2f2", border: "#991b1b", label: "NF-e Denegada" },
    cancelada:        { bg: "#f3f4f6", color: "#6b7280", border: "#d1d5db", label: "NF-e Cancelada" },
  };
  const cfg = estilos[st] || estilos.sem_nota;
  const sufixoNum = nf && nf.numero ? ` #${nf.numero}` : "";
  const extraCod = nf && nf.ultimo_codigo_sefaz && (st === "rejeitada" || st === "denegada")
    ? ` (${nf.ultimo_codigo_sefaz})`
    : "";
  const titleParts = [];
  if (nf?.chave_acesso) titleParts.push(`Chave: ${nf.chave_acesso}`);
  if (nf?.protocolo_autorizacao) titleParts.push(`Protocolo: ${nf.protocolo_autorizacao}`);
  if (nf?.ultima_mensagem_amigavel) titleParts.push(nf.ultima_mensagem_amigavel);

  return `<span style="display:inline-block;margin-top:4px;padding:2px 7px;border-radius:6px;font-size:0.68rem;font-weight:700;background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.border};" title="${escapeHtml(titleParts.join(' | '))}">🧾 ${escapeHtml(cfg.label + sufixoNum + extraCod)}</span>`;
}

// ─── Badges de Modalidade de Envio (#24) ──────────────────────────────────────
function getBadgeModalidadeEnvio(mod) {
  const map = {
    "Full": { bg: "#fef3c7", color: "#92400e", label: "⚡ Full" },
    "Coleta": { bg: "#e0f2fe", color: "#0369a1", label: "📦 Coleta" },
    "Tradicional": { bg: "#f1f5f9", color: "#334155", label: "📮 Tradicional" },
    "Logística Própria": { bg: "#ecfdf5", color: "#065f46", label: "🚛 Própria" },
  };
  const cfg = map[mod] || { bg: "#f3f4f6", color: "#374151", label: mod || "Padrão" };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.71rem;font-weight:700;background:${cfg.bg};color:${cfg.color};margin-top:2px">${cfg.label}</span>`;
}

// ─── Badges de Status Comercial ───────────────────────────────────────────────
function getBadgeStatusComercial(status) {
  const map = {
    "Confirmado": { cls: "badge-confirmado", label: "Confirmado" },
    "Concluído":  { cls: "badge-concluido", label: "Concluído" },
    "Concluido":  { cls: "badge-concluido", label: "Concluído" },
    "Cancelado":  { cls: "badge-cancelado", label: "Cancelado" },
  };
  const cfg = map[status] || { cls: "badge-confirmado", label: status };
  return `<span class="status-comercial ${cfg.cls}"><span class="status-dot"></span>${cfg.label}</span>`;
}

// ─── Badge de Status Logístico Vinculado ──────────────────────────────────────
function getLogisticsBadgeForPedido(pedido) {
  if (!window.RezFireEntregas || typeof window.RezFireEntregas.loadEntregas !== "function") return "";
  const entregas = window.RezFireEntregas.loadEntregas();
  const ent = entregas.find(
    (e) => e.id_pedido_interno === pedido.id_pedido ||
           e.codigo_pedido_ml === pedido.codigo_pedido ||
           e.codigo_pedido_direto === pedido.codigo_pedido
  );
  if (!ent) return "";

  const { isAtrasadoDespacho, isAtrasadoEntrega, STATUS_LOGISTICO } = window.RezFireEntregas;
  const sl = ent.status_logistico;

  if (isAtrasadoDespacho && isAtrasadoDespacho(ent)) {
    return `<span class="entrega-badge badge-atraso" style="font-size:0.68rem;padding:2px 7px;border-radius:6px;display:inline-flex;align-items:center;margin-top:4px">⚠ Despacho Atrasado</span>`;
  }
  if (isAtrasadoEntrega && isAtrasadoEntrega(ent)) {
    return `<span class="entrega-badge badge-atraso" style="font-size:0.68rem;padding:2px 7px;border-radius:6px;display:inline-flex;align-items:center;margin-top:4px">⚠ Entrega Atrasada</span>`;
  }

  const map = {
    [STATUS_LOGISTICO.AGUARDANDO_ENVIO]: `<span class="entrega-badge badge-aguardando" style="font-size:0.68rem;padding:2px 7px;border-radius:6px;display:inline-flex;align-items:center;margin-top:4px">Aguardando Envio</span>`,
    [STATUS_LOGISTICO.ENVIADO]:          `<span class="entrega-badge badge-enviado" style="font-size:0.68rem;padding:2px 7px;border-radius:6px;display:inline-flex;align-items:center;margin-top:4px">Enviado</span>`,
    [STATUS_LOGISTICO.EM_TRANSITO]:      `<span class="entrega-badge badge-transito" style="font-size:0.68rem;padding:2px 7px;border-radius:6px;display:inline-flex;align-items:center;margin-top:4px">Em Trânsito</span>`,
    [STATUS_LOGISTICO.SAIU_ENTREGA]:     `<span class="entrega-badge badge-saiu" style="font-size:0.68rem;padding:2px 7px;border-radius:6px;display:inline-flex;align-items:center;margin-top:4px">Saiu p/ Entrega</span>`,
    [STATUS_LOGISTICO.ENTREGUE]:         `<span class="entrega-badge badge-entregue" style="font-size:0.68rem;padding:2px 7px;border-radius:6px;display:inline-flex;align-items:center;margin-top:4px">Entregue</span>`,
    [STATUS_LOGISTICO.CANCELADO]:        `<span class="entrega-badge badge-cancelado" style="font-size:0.68rem;padding:2px 7px;border-radius:6px;display:inline-flex;align-items:center;margin-top:4px">Cancelado</span>`,
  };
  return map[sl] || "";
}

// ─── Cálculo dos Indicadores do Topo ──────────────────────────────────────────
function computePedidosKPIs(pedidos) {
  const total = pedidos.length;
  const confirmados = pedidos.filter((p) => p.status === "Confirmado").length;
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
    confirmados,
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
    <div class="card kpi-card" style="cursor:pointer" data-kpi-filter="Confirmado" title="Clique para filtrar confirmados (em expedição)">
      <p class="kpi-label">CONFIRMADOS</p>
      <p class="kpi-value" style="color:#2563eb">${kpis.confirmados}</p>
      <p class="kpi-hint">pagos / aguardando entrega</p>
    </div>
    <div class="card kpi-card" style="cursor:pointer" data-kpi-filter="Concluído" title="Clique para filtrar concluídos">
      <p class="kpi-label">CONCLUÍDOS</p>
      <p class="kpi-value" style="color:var(--up)">${kpis.concluidos}</p>
      <p class="kpi-hint">vendas entregues com sucesso</p>
    </div>
    <div class="card kpi-card" style="cursor:pointer" data-kpi-filter="Cancelado" title="Clique para filtrar cancelados">
      <p class="kpi-label">CANCELADOS</p>
      <p class="kpi-value" style="color:var(--down)">${kpis.cancelados}</p>
      <p class="kpi-hint">estornados do estoque</p>
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
  const refTime = Date.now() + 60000;
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
      const f = state.filtroStatus.toLowerCase();
      const s = (p.status || "").toLowerCase();
      if (f.includes("conclu")) {
        if (!s.includes("conclu")) return false;
      } else if (f === "confirmado") {
        if (s !== "confirmado") return false;
      } else if (f === "cancelado") {
        if (s !== "cancelado") return false;
      } else if (s !== f) {
        return false;
      }
    }

    // 2.1 Filtro de Motivo de Devolução / Cancelamento (SCRUM-22)
    if (state.filtroMotivo && state.filtroMotivo !== "todos") {
      const motFiltro = state.filtroMotivo.toLowerCase();
      const motPed = (p.motivo_devolucao || p.motivo_cancelamento || "").toLowerCase();
      if (!motPed.includes(motFiltro)) return false;
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

    // 5. Filtro de Status Fiscal (Story 33d)
    if (state.filtroStatusFiscal && state.filtroStatusFiscal !== "todos") {
      const sf = p.status_fiscal || (p.nota_fiscal_resumo ? p.nota_fiscal_resumo.status : "sem_nota");
      if (sf !== state.filtroStatusFiscal) return false;
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
  const temFiltroAtivo = state.busca || state.filtroStatus !== "todos" || state.filtroCanal !== "todos" || state.filtroPeriodo !== "todos" || state.filtroStatusFiscal !== "todos";
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
          <div>${getBadgeModalidadeEnvio(p.modalidade_envio)}</div>
        </td>
        <td style="text-align:center">
          <strong style="color:var(--ink)">${qtdTotalUnidades}</strong>
          <span style="display:block;font-size:0.72rem;color:var(--muted)">${qtdProdutosDistintos} item(ns)</span>
        </td>
        <td style="text-align:right">
          <strong style="font-size:0.95rem;color:${p.status === "Cancelado" ? "var(--muted)" : "var(--ink)"}">
            ${money(p.valor_total)}
          </strong>
          ${p.lucro_liquido !== undefined && p.status !== "Cancelado" ? `
            <span style="display:block;font-size:0.71rem;font-weight:700;color:${p.lucro_liquido >= 0 ? '#15803d' : 'var(--down)'}" title="Lucro Líquido Real (#18abc)">
              Lucro: ${money(p.lucro_liquido)} (${Number(p.margem_liquida_percentual || 0).toFixed(1)}%)
            </span>
          ` : ""}
          ${p.desconto > 0 ? `<span style="display:block;font-size:0.7rem;color:var(--down)">desc. -${money(p.desconto)}</span>` : ""}
        </td>
        <td>
          ${getBadgeStatusComercial(p.status)}
          ${(p.motivo_devolucao || (p.status === "Cancelado" && p.motivo_cancelamento)) ? `
            <span style="font-size:0.68rem;color:var(--down);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;font-weight:600;margin-top:2px" title="Motivo: ${escapeHtml(p.motivo_devolucao || p.motivo_cancelamento)}${p.protocolo_mediacao ? ' | ML: ' + escapeHtml(p.protocolo_mediacao) : ''}">
              ⚠ ${escapeHtml(p.motivo_devolucao || p.motivo_cancelamento)}
            </span>
          ` : ""}
          <div>${getLogisticsBadgeForPedido(p)}</div>
          <div>${getBadgeStatusFiscal(p)}</div>
        </td>
        <td class="actions-cell" style="text-align:right">
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
            ${getLogisticsBadgeForPedido(pedido)}
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
          <div class="detalhe-field span-2" style="background:#f8fafc;padding:10px;border-radius:8px;border:1px solid #e2e8f0;margin-top:6px">
            <span class="detalhe-label" style="display:flex;align-items:center;gap:4px">
              <span>🚚</span> Modalidade de Envio (#24)
            </span>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap">
              <select id="select-detalhe-modalidade" style="padding:4px 8px;border-radius:6px;border:1px solid var(--line);font-size:0.82rem;font-weight:700">
                <option value="Coleta" ${pedido.modalidade_envio === 'Coleta' ? 'selected' : ''}>Mercado Envios Coleta</option>
                <option value="Tradicional" ${pedido.modalidade_envio === 'Tradicional' ? 'selected' : ''}>Tradicional (Correios / Agência)</option>
                <option value="Full" ${pedido.modalidade_envio === 'Full' ? 'selected' : ''}>Mercado Envios Full</option>
                <option value="Logística Própria" ${pedido.modalidade_envio === 'Logística Própria' ? 'selected' : ''}>Logística Própria</option>
              </select>
              <button class="btn-ghost" id="btn-salvar-modalidade-detalhe" style="padding:4px 10px;font-size:0.8rem;background:#fff;border-color:#0d9488;color:#0f766e" title="Atualizar modalidade de envio e recalcular DRE">
                Atualizar Modalidade
              </button>
              <span style="font-size:0.75rem;color:var(--muted)">Prazo est.: <strong>${pedido.prazo_dias_estimado || 3} dias</strong></span>
            </div>
          </div>
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

      <!-- Apuração do Lucro Real por Venda (SCRUM-23 / #18abc) -->
      <section class="detalhe-section" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:1rem">💰</span>
            <h3 style="margin:0;font-size:0.92rem;font-weight:800;color:#166534">Lucro Real da Venda (#18abc)</h3>
          </div>
          <span class="entrega-badge" style="background:#dcfce7;color:#15803d;border:1px solid #86efac;font-size:0.75rem;font-weight:700">
            ${escapeHtml(pedido.tipo_anuncio || (pedido.origem === 'Mercado Livre' ? 'Clássico' : 'Venda Direta'))}
          </span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.82rem;margin-bottom:12px">
          <div style="background:#fff;border:1px solid #dcfce7;border-radius:6px;padding:8px">
            <div style="font-size:0.72rem;color:var(--muted);font-weight:700;text-transform:uppercase">Custos Fixos (#18a)</div>
            <div style="font-weight:700;color:var(--down);font-size:0.95rem;margin:2px 0">- ${money(pedido.total_custos_fixos || 0)}</div>
            <div style="font-size:0.72rem;color:var(--muted)">CMV: ${money(pedido.custo_produtos || 0)} · Impostos (${pedido.aliquota_imposto_percentual || 6}%): ${money(pedido.custo_impostos || 0)} · Embalagem: ${money(pedido.custo_embalagem || 5)}</div>
          </div>

          <div style="background:#fff;border:1px solid #dcfce7;border-radius:6px;padding:8px">
            <div style="font-size:0.72rem;color:var(--muted);font-weight:700;text-transform:uppercase">Tarifas ML & Frete (#18b)</div>
            <div style="font-weight:700;color:var(--down);font-size:0.95rem;margin:2px 0">- ${money(pedido.total_tarifas_plataforma || 0)}</div>
            <div style="font-size:0.72rem;color:var(--muted)">Comissão (${pedido.tarifa_ml_percentual || 12}%): ${money(pedido.tarifa_ml_comissao || 0)} · Frete: ${money(pedido.custo_frete || 0)}</div>
          </div>
        </div>

        <div style="background:#fff;border:1px solid #86efac;border-radius:6px;padding:10px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:0.72rem;color:var(--muted);font-weight:700;text-transform:uppercase">Lucro Líquido Real (#18c)</div>
            <div style="font-size:1.15rem;font-weight:800;color:${(pedido.lucro_liquido || 0) >= 0 ? '#15803d' : 'var(--down)'}">
              ${money(pedido.lucro_liquido || 0)}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.72rem;color:var(--muted);font-weight:700;text-transform:uppercase">Margem Líquida</div>
            <div style="font-size:1.05rem;font-weight:800;color:${(pedido.lucro_liquido || 0) >= 0 ? '#15803d' : 'var(--down)'}">
              ${Number(pedido.margem_liquida_percentual || 0).toFixed(1)}%
            </div>
          </div>
        </div>

        <!-- Botão e Formulário de Ajuste Personalizado -->
        <div style="margin-top:10px;text-align:right">
          <button type="button" id="btn-toggle-ajuste-lucro" style="background:transparent;border:none;color:#15803d;font-size:0.78rem;font-weight:700;cursor:pointer;text-decoration:underline">
            ⚙️ Personalizar Parâmetros de Custo / Recalcular
          </button>
        </div>

        <div id="form-ajuste-lucro" style="display:none;margin-top:10px;background:#fff;border:1px dashed #86efac;border-radius:6px;padding:10px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.78rem">
            <div>
              <label style="display:block;font-weight:600;margin-bottom:2px">Tipo de Anúncio:</label>
              <select id="ajuste-tipo-anuncio" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:0.78rem">
                <option value="Classico" ${pedido.tipo_anuncio === 'Classico' ? 'selected' : ''}>Clássico (12% comissão)</option>
                <option value="Premium" ${pedido.tipo_anuncio === 'Premium' ? 'selected' : ''}>Premium (17% comissão)</option>
                <option value="Direta" ${pedido.tipo_anuncio === 'Direta' ? 'selected' : ''}>Venda Direta (0% comissão)</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-weight:600;margin-bottom:2px">Alíquota Imposto (%):</label>
              <input type="number" id="ajuste-imposto" step="0.1" value="${pedido.aliquota_imposto_percentual || 6}" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:0.78rem" />
            </div>
            <div>
              <label style="display:block;font-weight:600;margin-bottom:2px">Custo Embalagem (R$):</label>
              <input type="number" id="ajuste-embalagem" step="0.5" value="${pedido.custo_embalagem ?? 5}" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:0.78rem" />
            </div>
            <div>
              <label style="display:block;font-weight:600;margin-bottom:2px">Custo Frete Vendedor (R$):</label>
              <input type="number" id="ajuste-frete" step="1" value="${pedido.custo_frete || 0}" style="width:100%;padding:4px;border:1px solid var(--line);border-radius:4px;font-size:0.78rem" />
            </div>
          </div>
          <div style="margin-top:8px;display:flex;justify-content:flex-end;gap:6px">
            <button type="button" id="btn-salvar-ajuste-lucro" style="background:#15803d;color:#fff;border:none;padding:5px 12px;border-radius:4px;font-size:0.78rem;font-weight:700;cursor:pointer">
              Salvar e Recalcular
            </button>
          </div>
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

      <!-- Destinatário & NF-e (Stories 33c / 33d / 33e) -->
      <section class="detalhe-section" style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <h3 class="detalhe-section-title" style="margin:0">Destinatário &amp; NF-e</h3>
            ${getBadgeStatusFiscal(pedido)}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${pedido.status !== "Cancelado" ? `
              <button type="button" class="btn-ghost" id="btn-drawer-destinatario" style="padding:5px 10px;font-size:0.78rem">
                Editar Destinatário
              </button>
            ` : ""}
            ${(pedido.nota_fiscal_resumo && (pedido.nota_fiscal_resumo.status === "autorizada" || pedido.nota_fiscal_resumo.status === "cancelada")) ? `
              <button type="button" class="btn-primary" id="btn-drawer-danfe" style="padding:5px 12px;font-size:0.78rem;background:#0f766e">
                🖨️ Imprimir DANFE
              </button>
              ${isGestorUsuario() ? `
                <button type="button" class="btn-ghost" id="btn-drawer-xml" style="padding:5px 10px;font-size:0.78rem">
                  ⬇ Baixar XML
                </button>
              ` : ""}
            ` : ""}
            ${(isGestorUsuario() && (pedido.status !== "Cancelado" || pedido.nota_fiscal_resumo)) ? `
              <button type="button" class="${(pedido.nota_fiscal_resumo && (pedido.nota_fiscal_resumo.status === 'autorizada' || pedido.nota_fiscal_resumo.status === 'cancelada')) ? 'btn-ghost' : 'btn-primary'}" id="btn-drawer-preparar-nfe" style="padding:5px 12px;font-size:0.78rem">
                🧾 ${pedido.nota_fiscal_resumo ? "Gerenciar / Ver NF-e" : "Preparar NF-e"}
              </button>
            ` : ""}
          </div>
        </div>
        <div style="font-size:0.82rem;color:var(--ink);line-height:1.45;">
          <div><strong>CPF/CNPJ:</strong> <span class="font-mono">${formatarDocFiscal(pedido.destinatario_documento)}</span> ${pedido.destinatario_ie ? `· IE: ${escapeHtml(pedido.destinatario_ie)}` : ""}</div>
          <div style="color:var(--muted);margin-top:2px">
            ${pedido.destinatario_logradouro
              ? `${escapeHtml(pedido.destinatario_logradouro)}, ${escapeHtml(pedido.destinatario_numero || "S/N")} — ${escapeHtml(pedido.destinatario_bairro || "")}, ${escapeHtml(pedido.destinatario_municipio || "")}/${escapeHtml(pedido.destinatario_uf || "")} · CEP ${escapeHtml(formatarCepFiscal(pedido.destinatario_cep) || "—")}`
              : "Endereço completo do destinatário ainda não informado para emissão fiscal."}
          </div>
        </div>
        ${pedido.nota_fiscal_resumo ? `
          <div style="margin-top:10px;padding:10px 12px;border-radius:8px;background:#f8fafc;border:1px solid #cbd5e1;font-size:0.78rem;color:var(--ink)">
            <div><strong>NF-e Série ${pedido.nota_fiscal_resumo.serie} Nº ${pedido.nota_fiscal_resumo.numero}</strong> · Ambiente: <strong>${escapeHtml(pedido.nota_fiscal_resumo.ambiente).toUpperCase()}</strong> · Situação: <strong>${escapeHtml(pedido.nota_fiscal_resumo.status)}</strong></div>
            ${pedido.nota_fiscal_resumo.protocolo_autorizacao ? `<div style="margin-top:3px;color:#065f46"><strong>Protocolo SEFAZ:</strong> <span class="font-mono">${escapeHtml(pedido.nota_fiscal_resumo.protocolo_autorizacao)}</span></div>` : ""}
            ${pedido.nota_fiscal_resumo.guarda_legal_ate ? `<div style="margin-top:2px;color:#334155"><strong>Arquivo Fiscal:</strong> XML arquivado com guarda legal até ${formatDateOnly(pedido.nota_fiscal_resumo.guarda_legal_ate)}</div>` : ""}
            ${pedido.nota_fiscal_resumo.ultimo_codigo_sefaz ? `<div style="margin-top:3px;color:${pedido.nota_fiscal_resumo.status === 'rejeitada' || pedido.nota_fiscal_resumo.status === 'denegada' ? '#b91c1c' : 'var(--muted)'}"><strong>Último retorno (${escapeHtml(pedido.nota_fiscal_resumo.ultimo_codigo_sefaz)}):</strong> ${escapeHtml(pedido.nota_fiscal_resumo.ultima_mensagem_amigavel || pedido.nota_fiscal_resumo.ultimo_motivo_sefaz || "")}</div>` : ""}
            <div style="font-family:monospace;font-size:0.72rem;margin-top:3px;word-break:break-all;color:var(--muted)">Chave: ${escapeHtml(pedido.nota_fiscal_resumo.chave_acesso || "")}</div>
          </div>
        ` : ""}
      </section>

      <!-- Auditoria de Devolução / Mediação (SCRUM-22) -->
      ${(pedido.status === "Cancelado" || pedido.motivo_devolucao) ? `
        <section class="detalhe-section" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:0.75rem;font-weight:700;color:var(--down);text-transform:uppercase;letter-spacing:0.04em">
              Auditoria de ${escapeHtml(pedido.tipo_ocorrencia || "Cancelamento / Devolução")}
            </span>
            ${pedido.protocolo_mediacao ? `
              <span class="entrega-badge badge-cancelado" style="font-size:0.72rem;background:#fee2e2;color:#991b1b;border-color:#fca5a5">
                Protocolo: ${escapeHtml(pedido.protocolo_mediacao)}
              </span>
            ` : ""}
          </div>
          <div style="font-size:0.9rem;font-weight:700;color:var(--ink);margin-bottom:4px">
            Motivo Padronizado: <span style="color:var(--down)">${escapeHtml(pedido.motivo_devolucao || pedido.motivo_cancelamento || "Não informado")}</span>
          </div>
          ${pedido.detalhe_devolucao ? `
            <div style="font-size:0.8rem;color:var(--muted);line-height:1.4;margin-top:6px;background:#fff;padding:8px;border-radius:4px;border:1px dashed #fca5a5">
              <strong>Observação técnica:</strong> ${escapeHtml(pedido.detalhe_devolucao)}
            </div>
          ` : ""}
          <div style="font-size:0.75rem;color:#7f1d1d;margin-top:8px">
            ✓ Estoque físico estornado automaticamente e registrado no histórico de movimentações.
          </div>
        </section>
      ` : ""}

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
  document.getElementById("btn-drawer-destinatario")?.addEventListener("click", () => {
    abrirModalDestinatarioNFe(pedido, false);
  });
  document.getElementById("btn-drawer-preparar-nfe")?.addEventListener("click", () => {
    abrirModalPrepararNFe(pedido);
  });
  document.getElementById("btn-drawer-danfe")?.addEventListener("click", async () => {
    const idNota = pedido.nota_fiscal_resumo?.id_nota_fiscal;
    if (!idNota) return;
    try {
      await window.RezFireAPI.fiscal.abrirDanfeNotaNovaAba(idNota);
    } catch (err) {
      showToast(err.message || "Erro ao gerar visualização do DANFE.", "erro");
    }
  });
  document.getElementById("btn-drawer-xml")?.addEventListener("click", async () => {
    const nfRes = pedido.nota_fiscal_resumo;
    if (!nfRes?.id_nota_fiscal) return;
    try {
      await window.RezFireAPI.fiscal.baixarXmlNotaArquivo(
        nfRes.id_nota_fiscal,
        `NFe-${nfRes.chave_acesso || nfRes.numero}-procNFe.xml`
      );
      showToast("XML autorizado baixado com sucesso!", "sucesso");
    } catch (err) {
      showToast(err.message || "Erro ao baixar XML autorizado.", "erro");
    }
  });

  // Eventos de Apuração de Lucro Real (#18abc)
  const btnToggleAjuste = document.getElementById("btn-toggle-ajuste-lucro");
  const formAjuste = document.getElementById("form-ajuste-lucro");
  btnToggleAjuste?.addEventListener("click", () => {
    if (formAjuste) {
      formAjuste.style.display = formAjuste.style.display === "none" ? "block" : "none";
    }
  });

  document.getElementById("btn-salvar-ajuste-lucro")?.addEventListener("click", async () => {
    const tipoAnuncio = document.getElementById("ajuste-tipo-anuncio")?.value || "Classico";
    const imposto = Number(document.getElementById("ajuste-imposto")?.value || 6);
    const embalagem = Number(document.getElementById("ajuste-embalagem")?.value || 5);
    const frete = Number(document.getElementById("ajuste-frete")?.value || 0);

    try {
      if (window.RezFireAPI?.pedidos?.calcularLucro) {
        const res = await window.RezFireAPI.pedidos.calcularLucro(pedido.id_pedido, {
          tipo_anuncio: tipoAnuncio,
          aliquota_imposto_percentual: imposto,
          custo_embalagem: embalagem,
          custo_frete: frete,
        });

        if (res && res.sucesso) {
          // Atualiza estado local
          const idx = state.pedidos.findIndex((x) => x.id_pedido === pedido.id_pedido);
          if (idx !== -1) {
            state.pedidos[idx].tipo_anuncio = tipoAnuncio;
            state.pedidos[idx].aliquota_imposto_percentual = imposto;
            state.pedidos[idx].custo_embalagem = embalagem;
            state.pedidos[idx].custo_frete = frete;
            state.pedidos[idx].total_custos_fixos = res.custos_fixos?.total_custos_fixos;
            state.pedidos[idx].total_tarifas_plataforma = res.tarifas_plataforma?.total_tarifas_plataforma;
            state.pedidos[idx].lucro_liquido = res.resultado?.lucro_liquido;
            state.pedidos[idx].margem_liquida_percentual = res.resultado?.margem_liquida_percentual;
            openDetalhePanel(pedido.id_pedido);
          }
          renderTable();
          showToast("Lucro real recalculado e parâmetros salvos!", "sucesso");
        }
      }
    } catch (err) {
      console.error("Erro ao salvar ajuste de custos:", err);
      showToast("Erro ao recalcular custos: " + (err.message || err), "erro");
    }
  });

  // Listener para atualização inline de Modalidade de Envio (#24)
  document.getElementById("btn-salvar-modalidade-detalhe")?.addEventListener("click", async () => {
    const novaModalidade = document.getElementById("select-detalhe-modalidade")?.value;
    if (!novaModalidade) return;

    try {
      if (window.RezFireAPI?.pedidos?.atualizarModalidade) {
        const res = await window.RezFireAPI.pedidos.atualizarModalidade(pedido.id_pedido, {
          modalidade_envio: novaModalidade,
        });

        if (res && res.sucesso && res.pedido) {
          const idx = state.pedidos.findIndex((x) => x.id_pedido === pedido.id_pedido);
          if (idx !== -1) {
            state.pedidos[idx] = normalizarPedido(res.pedido);
            openDetalhePanel(pedido.id_pedido);
          }
          renderTable();
          showToast(`Modalidade de envio atualizada para "${novaModalidade}" e DRE recalculado!`, "sucesso");
        }
      }
    } catch (err) {
      console.error("Erro ao atualizar modalidade de envio:", err);
      showToast("Erro ao atualizar modalidade: " + (err.message || err), "erro");
    }
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
    document.getElementById("pedido-modalidade").value = pedidoParaEditar.modalidade_envio || "Coleta";
    document.getElementById("pedido-desconto").value = Number(pedidoParaEditar.desconto || 0).toFixed(2);
    document.getElementById("pedido-frete").value = Number(pedidoParaEditar.frete || 0).toFixed(2);
    document.getElementById("pedido-observacoes").value = pedidoParaEditar.observacoes || "";
    document.getElementById("pedido-codigo-externo").value = pedidoParaEditar.codigo_externo_ml || "";
    document.getElementById("pedido-dest-documento").value = aplicarMascaraDocFiscal(pedidoParaEditar.destinatario_documento || "");
    document.getElementById("pedido-dest-ie").value = pedidoParaEditar.destinatario_ie || "";
    document.getElementById("pedido-dest-cep").value = formatarCepFiscal(pedidoParaEditar.destinatario_cep || "");
    document.getElementById("pedido-dest-email").value = pedidoParaEditar.destinatario_email || "";
    document.getElementById("pedido-dest-logradouro").value = pedidoParaEditar.destinatario_logradouro || "";
    document.getElementById("pedido-dest-numero").value = pedidoParaEditar.destinatario_numero || "";
    document.getElementById("pedido-dest-complemento").value = pedidoParaEditar.destinatario_complemento || "";
    document.getElementById("pedido-dest-bairro").value = pedidoParaEditar.destinatario_bairro || "";
    document.getElementById("pedido-dest-municipio").value = pedidoParaEditar.destinatario_municipio || "";
    document.getElementById("pedido-dest-ibge").value = pedidoParaEditar.destinatario_codigo_municipio_ibge || "";

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
    document.getElementById("pedido-modalidade").value = "Coleta";
    document.getElementById("pedido-desconto").value = "0.00";
    document.getElementById("pedido-frete").value = "0.00";
    document.getElementById("pedido-observacoes").value = "";
    document.getElementById("pedido-codigo-externo").value = "";
    document.getElementById("pedido-dest-documento").value = "";
    document.getElementById("pedido-dest-ie").value = "";
    document.getElementById("pedido-dest-cep").value = "";
    document.getElementById("pedido-dest-email").value = "";
    document.getElementById("pedido-dest-logradouro").value = "";
    document.getElementById("pedido-dest-numero").value = "";
    document.getElementById("pedido-dest-complemento").value = "";
    document.getElementById("pedido-dest-bairro").value = "";
    document.getElementById("pedido-dest-municipio").value = "";
    document.getElementById("pedido-dest-ibge").value = "";

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

  const prods = (Array.isArray(state.produtos) && state.produtos.length > 0)
    ? state.produtos
    : (window.RezFireData ? window.RezFireData.loadProducts() : []);

  const options = prods
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

// ─── Modal de Cancelamento / Devolução / Mediação (SCRUM-22 / #11) ───────────
function openModalCancelamento(pedido) {
  if (!pedido) return;
  pedidoParaCancelar = pedido;

  const modal = document.getElementById("modal-cancelar-pedido");
  const codEl = document.getElementById("cancel-pedido-codigo");
  const tipoEl = document.getElementById("cancel-tipo-ocorrencia");
  const motivoEl = document.getElementById("cancel-motivo-padronizado");
  const protocoloEl = document.getElementById("cancel-protocolo-mediacao");
  const obsEl = document.getElementById("cancel-detalhe-obs");

  if (codEl) codEl.textContent = pedido.codigo_pedido;
  if (tipoEl) {
    tipoEl.value = (pedido.canal === "Mercado Livre" || pedido.origem === "Mercado Livre")
      ? "Mediacao"
      : "Cancelamento";
  }
  if (motivoEl) motivoEl.value = "";
  if (protocoloEl) protocoloEl.value = pedido.codigo_externo_ml || "";
  if (obsEl) obsEl.value = "";
  if (modal) modal.classList.add("is-open");
}

function closeModalCancelamento() {
  const modal = document.getElementById("modal-cancelar-pedido");
  if (modal) modal.classList.remove("is-open");
  pedidoParaCancelar = null;
}

async function executarCancelamento() {
  if (!pedidoParaCancelar) return;

  const tipo = document.getElementById("cancel-tipo-ocorrencia")?.value || "Cancelamento";
  const motivo = document.getElementById("cancel-motivo-padronizado")?.value?.trim();
  const protocolo = document.getElementById("cancel-protocolo-mediacao")?.value?.trim() || null;
  const detalhe = document.getElementById("cancel-detalhe-obs")?.value?.trim() || null;

  if (!motivo) {
    alert("Por favor, selecione um motivo padronizado da lista (Taxonomia SCRUM-22).");
    return;
  }
  if (motivo === "Outro" && (!detalhe || detalhe.length < 5)) {
    alert("Para o motivo 'Outro', detalhe e informe as observações técnicas.");
    return;
  }

  const p = pedidoParaCancelar;
  const btn = document.getElementById("btn-confirmar-cancelamento");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Gravando e Estornando Estoque...";
  }

  const dataCanc = new Date().toISOString();
  const payloadDevolucao = {
    motivo_devolucao: motivo,
    tipo_ocorrencia: tipo,
    detalhe_devolucao: detalhe,
    protocolo_mediacao: protocolo,
  };

  try {
    // 1. Aciona o backend MySQL para estorno transacional automático de estoque e gravação auditável
    if (window.RezFireAPI && p.id_pedido) {
      const res = await window.RezFireAPI.pedidos.atualizarStatus(
        p.id_pedido,
        "Cancelado",
        undefined,
        payloadDevolucao
      );
      if (res && res.sucesso && res.pedido) {
        const pedIdx = state.pedidos.findIndex((x) => x.id_pedido === p.id_pedido);
        if (pedIdx >= 0) {
          state.pedidos[pedIdx] = normalizarPedido(res.pedido);
        }
      }
    }

    // 2. Atualiza estado em memória e sincroniza dados locais / fallback
    p.status = "Cancelado";
    p.motivo_devolucao = motivo;
    p.tipo_ocorrencia = tipo;
    p.detalhe_devolucao = detalhe;
    p.protocolo_mediacao = protocolo;
    p.motivo_cancelamento = `${tipo}: ${motivo}`;
    p.data_devolucao = dataCanc;
    p.historico = p.historico || [];
    p.historico.push({
      data: dataCanc,
      evento: `Registro de ${tipo} (${motivo})`,
      descricao: `Ocorrência: ${motivo}.${protocolo ? ' Protocolo ML: ' + protocolo + '.' : ''}${detalhe ? ' Obs: ' + detalhe + '.' : ''} Estoque físico estornado.`,
      usuario: "Gestor RezFire",
    });

    // 3. Sincroniza estoque localmente caso o backend não esteja ativo (modo offline/fallback)
    if (window.RezFireData) {
      if (typeof window.RezFireData.loadProducts === "function" && typeof window.RezFireData.saveProducts === "function") {
        let prods = window.RezFireData.loadProducts();
        (p.itens || []).forEach((item) => {
          prods = prods.map((prod) => {
            if (prod.id_produto === item.id_produto || prod.sku === item.sku) {
              return {
                ...prod,
                quantidade_atual: Number(prod.quantidade_atual || 0) + Number(item.quantidade || 0),
              };
            }
            return prod;
          });
        });
        window.RezFireData.saveProducts(prods);
      }

      if (typeof window.RezFireData.loadMovements === "function" && typeof window.RezFireData.saveMovements === "function") {
        const movs = window.RezFireData.loadMovements();
        const nextId = movs.length > 0 ? Math.max(...movs.map((m) => m.id_movimentacao || 0)) + 1 : 1;
        (p.itens || []).forEach((item, itemIdx) => {
          movs.unshift({
            id_movimentacao: nextId + itemIdx,
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
            motivo: `Estorno (${tipo}: ${motivo}) - Pedido #${p.codigo_pedido}`,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            valor_total: item.subtotal,
            data: dataCanc,
            responsavel: "Gestor RezFire (Estorno Operacional)",
          });
        });
        window.RezFireData.saveMovements(movs);
      }

      window.RezFireData.saveOrders(state.pedidos);
    }

    // 4. Sincroniza também no módulo de Entregas, se existir remessa correspondente
    if (window.RezFireEntregas && typeof window.RezFireEntregas.loadEntregas === "function") {
      let entregas = window.RezFireEntregas.loadEntregas();
      let entregaUpdated = false;
      entregas = entregas.map((ent) => {
        if (
          ent.id_pedido_interno === p.id_pedido ||
          ent.codigo_pedido_ml === p.codigo_pedido ||
          ent.codigo_pedido_direto === p.codigo_pedido
        ) {
          entregaUpdated = true;
          return {
            ...ent,
            status_interno: window.RezFireEntregas.STATUS_INTERNO.CANCELADO,
            status_logistico: window.RezFireEntregas.STATUS_LOGISTICO.CANCELADO,
            motivo_devolucao: motivo,
            tipo_ocorrencia: tipo,
            protocolo_mediacao: protocolo,
            historico: [
              ...(ent.historico || []),
              {
                data: dataCanc,
                evento: `Pedido ${tipo} no Módulo Comercial`,
                descricao: `Motivo: ${motivo}.${protocolo ? ' Protocolo ML: ' + protocolo : ''}`,
                tipo: "erro",
              },
            ],
          };
        }
        return ent;
      });
      if (entregaUpdated) {
        window.RezFireEntregas.saveEntregas(entregas);
      }
    }

    closeModalCancelamento();
    closeDetalhePanel();
    renderKPIs();
    renderTable();
    showToast(`Ocorrência (${tipo}: ${motivo}) registrada com sucesso. Estoque estornado!`, "sucesso");
  } catch (err) {
    console.error("[Pedidos] Erro ao registrar cancelamento/devolução:", err);
    alert("Erro ao registrar devolução/cancelamento: " + (err.message || err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Confirmar e Estornar Estoque";
    }
  }
}

// ─── Modal de Análise e Padrões de Devoluções (SCRUM-22 / #11) ───────────────
async function openModalPadroesDevolucoes() {
  const modal = document.getElementById("modal-padroes-devolucoes");
  if (!modal) return;

  const totalEl = document.getElementById("stat-total-ocorrencias");
  const mediacoesEl = document.getElementById("stat-total-mediacoes");
  const principalEl = document.getElementById("stat-principal-motivo");
  const rankingEl = document.getElementById("container-ranking-motivos");
  const tbodyEl = document.getElementById("tbody-ultimas-devolucoes");

  let dadosEstatisticos = null;

  // Tenta obter dados consolidados da API
  if (window.RezFireAPI && typeof window.RezFireAPI.pedidos.obterEstatisticasDevolucoes === "function") {
    try {
      const res = await window.RezFireAPI.pedidos.obterEstatisticasDevolucoes();
      if (res && res.sucesso) {
        dadosEstatisticos = res;
      }
    } catch (e) {
      console.warn("[Pedidos] Erro ao buscar estatísticas da API, calculando localmente:", e);
    }
  }

  // Fallback / cálculo local reativo
  if (!dadosEstatisticos) {
    const pedidosCancelados = state.pedidos.filter((p) => p.status === "Cancelado" || p.motivo_devolucao);
    const motivosContagem = {};
    let totalMed = 0;

    pedidosCancelados.forEach((p) => {
      const m = p.motivo_devolucao || p.motivo_cancelamento || "Outro / Não especificado";
      motivosContagem[m] = (motivosContagem[m] || 0) + 1;
      if (p.protocolo_mediacao || (p.tipo_ocorrencia && p.tipo_ocorrencia.toLowerCase().includes("media"))) {
        totalMed++;
      }
    });

    const ranking = Object.entries(motivosContagem)
      .map(([motivo, total]) => ({
        motivo,
        total,
        percentual: pedidosCancelados.length > 0 ? Number(((total / pedidosCancelados.length) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    dadosEstatisticos = {
      total_ocorrencias: pedidosCancelados.length,
      total_com_protocolo_ml: totalMed,
      ranking_motivos: ranking,
      ultimas_ocorrencias: pedidosCancelados.slice(0, 10).map((p) => ({
        id_pedido: p.id_pedido,
        codigo_pedido: p.codigo_pedido,
        cliente_nome: p.cliente || p.cliente_nome,
        tipo_ocorrencia: p.tipo_ocorrencia || "Cancelamento",
        motivo_devolucao: p.motivo_devolucao || p.motivo_cancelamento || "Não especificado",
        protocolo_mediacao: p.protocolo_mediacao,
        data_devolucao: p.data_devolucao || p.data_pedido,
      })),
    };
  }

  // Preenche KPIs
  if (totalEl) totalEl.textContent = String(dadosEstatisticos.total_ocorrencias || 0);
  if (mediacoesEl) mediacoesEl.textContent = String(dadosEstatisticos.total_com_protocolo_ml || 0);
  if (principalEl) {
    principalEl.textContent = dadosEstatisticos.ranking_motivos && dadosEstatisticos.ranking_motivos.length > 0
      ? `${dadosEstatisticos.ranking_motivos[0].motivo} (${dadosEstatisticos.ranking_motivos[0].percentual}%)`
      : "Nenhuma ocorrência";
  }

  // Preenche Ranking com Barras
  if (rankingEl) {
    if (!dadosEstatisticos.ranking_motivos || dadosEstatisticos.ranking_motivos.length === 0) {
      rankingEl.innerHTML = `
        <div style="font-size:0.85rem;color:var(--muted);text-align:center;padding:16px">
          Nenhuma devolução ou cancelamento registrado no sistema.
        </div>
      `;
    } else {
      rankingEl.innerHTML = dadosEstatisticos.ranking_motivos.map((item) => `
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:600;color:var(--ink)">
            <span>${escapeHtml(item.motivo)}</span>
            <span>${item.total} ocorrência(s) (${item.percentual}%)</span>
          </div>
          <div style="width:100%;height:8px;background:#f3f4f6;border-radius:4px;overflow:hidden">
            <div style="width:${Math.min(100, Math.max(5, item.percentual))}%;height:100%;background:var(--down);border-radius:4px"></div>
          </div>
        </div>
      `).join("");
    }
  }

  // Preenche Tabela de Últimas Ocorrências
  if (tbodyEl) {
    const lista = dadosEstatisticos.ultimas_ocorrencias || [];
    if (lista.length === 0) {
      tbodyEl.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:16px;color:var(--muted)">Nenhuma ocorrência recente.</td>
        </tr>
      `;
    } else {
      tbodyEl.innerHTML = lista.map((o) => `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 6px;font-family:monospace;font-weight:700">${escapeHtml(o.codigo_pedido)}</td>
          <td style="padding:8px 6px">
            <span class="entrega-badge badge-cancelado" style="font-size:0.7rem;padding:2px 6px">${escapeHtml(o.tipo_ocorrencia || "Cancelamento")}</span>
          </td>
          <td style="padding:8px 6px;font-weight:600;color:var(--down)">${escapeHtml(o.motivo_devolucao || "—")}</td>
          <td style="padding:8px 6px;font-family:monospace;font-size:0.75rem">${o.protocolo_mediacao ? escapeHtml(o.protocolo_mediacao) : '<span style="color:var(--muted)">—</span>'}</td>
          <td style="padding:8px 6px;color:var(--muted);font-size:0.75rem">${formatDateOnly(o.data_devolucao)}</td>
        </tr>
      `).join("");
    }
  }

  modal.classList.add("is-open");
}

function closeModalPadroesDevolucoes() {
  const modal = document.getElementById("modal-padroes-devolucoes");
  if (modal) modal.classList.remove("is-open");
}

// ─── Modal de Comparativo de Modalidades de Envio (#24 / SCRUM-27) ────────────
async function openModalComparativoModalidades() {
  const modal = document.getElementById("modal-comparativo-modalidades");
  const gridCards = document.getElementById("grid-cards-modalidades");
  const tbody = document.getElementById("tbody-comparativo-modalidades");
  if (!modal) return;

  modal.classList.add("is-open");
  if (gridCards) gridCards.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--muted)">Carregando comparativo analítico...</div>`;
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--muted)">Calculando métricas...</td></tr>`;

  try {
    let comparativo = null;
    if (window.RezFireAPI?.pedidos?.obterComparativoModalidades) {
      const res = await window.RezFireAPI.pedidos.obterComparativoModalidades();
      if (res && res.sucesso && Array.isArray(res.comparativo)) {
        comparativo = res.comparativo;
      }
    }

    if (!comparativo || comparativo.length === 0) {
      // Fallback analítico a partir do state local
      const modalidadesDisponiveis = ["Full", "Coleta", "Tradicional", "Logística Própria"];
      comparativo = modalidadesDisponiveis.map((mod) => {
        const pedMod = state.pedidos.filter((p) => p.modalidade_envio === mod);
        const qtd = pedMod.length;
        const totalFat = pedMod.reduce((s, p) => s + Number(p.valor_total || 0), 0);
        const freteMedio = qtd > 0 ? pedMod.reduce((s, p) => s + Number(p.custo_frete || p.frete || 0), 0) / qtd : 0;
        const prazoMedio = qtd > 0 ? pedMod.reduce((s, p) => s + Number(p.prazo_dias_estimado || 3), 0) / qtd : 0;
        const lucroTotal = pedMod.reduce((s, p) => s + Number(p.lucro_liquido || 0), 0);
        return {
          modalidade: mod,
          quantidade_pedidos: qtd,
          faturamento_total: totalFat,
          ticket_medio: qtd > 0 ? totalFat / qtd : 0,
          frete_medio: freteMedio,
          prazo_medio_dias: Number(prazoMedio.toFixed(1)),
          taxa_pontualidade_percentual: 95.0,
          lucro_total: lucroTotal,
          lucro_medio_por_pedido: qtd > 0 ? lucroTotal / qtd : 0,
          margem_media_percentual: totalFat > 0 ? (lucroTotal / totalFat) * 100 : 0,
        };
      });
    }

    // Renderiza Cards
    const modConfigs = {
      "Full": { cor: "#b45309", bg: "#fef3c7", icon: "⚡", desc: "Entrega em até 24h, armazenagem e expedição 100% Mercado Livre." },
      "Coleta": { cor: "#0369a1", bg: "#e0f2fe", icon: "📦", desc: "Caminhão do Mercado Livre retira no galpão RezFire em horário fixo." },
      "Tradicional": { cor: "#334155", bg: "#f1f5f9", icon: "📮", desc: "Postagem em agências parceiras / Correios pelo gestor." },
      "Logística Própria": { cor: "#065f46", bg: "#ecfdf5", icon: "🚛", desc: "Frota própria RezFire ou transportadora rodoviária contratada." },
    };

    if (gridCards) {
      gridCards.innerHTML = comparativo.map((c) => {
        const cfg = modConfigs[c.modalidade] || { cor: "var(--ink)", bg: "#f3f4f6", icon: "🚚", desc: "" };
        const qtdPed = c.total_pedidos !== undefined ? c.total_pedidos : (c.quantidade_pedidos || 0);
        const freteMed = c.custo_frete_medio !== undefined ? c.custo_frete_medio : (c.frete_medio || 0);
        return `
          <div class="card" style="padding:14px;border-top:4px solid ${cfg.cor};background:#fff">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:0.75rem;font-weight:800;color:${cfg.cor};text-transform:uppercase;letter-spacing:0.04em">
                ${cfg.icon} ${escapeHtml(c.modalidade)}
              </span>
              <span style="font-size:0.72rem;background:${cfg.bg};color:${cfg.cor};font-weight:700;padding:2px 6px;border-radius:10px">
                ${qtdPed} ped.
              </span>
            </div>
            <div style="font-size:1.15rem;font-weight:800;color:var(--ink);margin:4px 0">
              ${money(freteMed)} <span style="font-size:0.72rem;font-weight:500;color:var(--muted)">frete médio</span>
            </div>
            <div style="font-size:0.8rem;color:var(--ink);display:flex;justify-content:space-between;margin-top:6px;border-top:1px dashed #e2e8f0;padding-top:6px">
              <span style="color:var(--muted)">Prazo médio:</span>
              <strong>${c.prazo_medio_dias} dias</strong>
            </div>
            <div style="font-size:0.8rem;color:var(--ink);display:flex;justify-content:space-between;margin-top:2px">
              <span style="color:var(--muted)">Pontualidade:</span>
              <strong style="color:${c.taxa_pontualidade_percentual >= 90 ? '#15803d' : 'var(--down)'}">${Number(c.taxa_pontualidade_percentual || 0).toFixed(1)}%</strong>
            </div>
            <p style="font-size:0.72rem;color:var(--muted);margin:8px 0 0;line-height:1.3">
              ${cfg.desc}
            </p>
          </div>
        `;
      }).join("");
    }

    // Renderiza Tabela Consolidada
    if (tbody) {
      tbody.innerHTML = comparativo.map((c) => {
        const qtdPed = c.total_pedidos !== undefined ? c.total_pedidos : (c.quantidade_pedidos || 0);
        const freteMed = c.custo_frete_medio !== undefined ? c.custo_frete_medio : (c.frete_medio || 0);
        const lucroTotal = c.lucro_liquido_total !== undefined ? c.lucro_liquido_total : (c.lucro_total || 0);
        const lucroMed = qtdPed > 0 ? (lucroTotal / qtdPed) : 0;
        return `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:10px 6px;font-weight:700;color:var(--ink)">
            ${getBadgeModalidadeEnvio(c.modalidade)}
          </td>
          <td style="padding:10px 6px;text-align:center;font-weight:700">${qtdPed}</td>
          <td style="padding:10px 6px;text-align:right;font-weight:600;color:#0e7490">${money(freteMed)}</td>
          <td style="padding:10px 6px;text-align:center;font-weight:600">${c.prazo_medio_dias} d</td>
          <td style="padding:10px 6px;text-align:center">
            <span style="display:inline-block;padding:2px 6px;border-radius:10px;font-size:0.75rem;font-weight:700;background:${c.taxa_pontualidade_percentual >= 90 ? '#dcfce7' : '#fee2e2'};color:${c.taxa_pontualidade_percentual >= 90 ? '#15803d' : '#991b1b'}">
              ${Number(c.taxa_pontualidade_percentual || 0).toFixed(1)}%
            </span>
          </td>
          <td style="padding:10px 6px;text-align:right;font-weight:700;color:${lucroMed >= 0 ? '#15803d' : 'var(--down)'}">
            ${money(lucroMed)}
          </td>
          <td style="padding:10px 6px;text-align:right;font-weight:700;color:${c.margem_media_percentual >= 0 ? '#15803d' : 'var(--down)'}">
            ${Number(c.margem_media_percentual || 0).toFixed(1)}%
          </td>
        </tr>
      `}).join("");
    }
  } catch (err) {
    console.error("Erro ao carregar comparativo de modalidades:", err);
    if (gridCards) gridCards.innerHTML = `<div style="grid-column:1/-1;color:var(--down);padding:16px">Falha ao obter comparativo analítico: ${err.message || err}</div>`;
  }
}

function closeModalComparativoModalidades() {
  const modal = document.getElementById("modal-comparativo-modalidades");
  if (modal) modal.classList.remove("is-open");
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
  state.filtroMotivo = "todos";
  state.filtroCanal = "todos";
  state.filtroPeriodo = "todos";
  state.filtroStatusFiscal = "todos";
  state.pagina = 1;

  const b = document.getElementById("busca-pedidos");
  const s = document.getElementById("filtro-status");
  const m = document.getElementById("filtro-motivo");
  const c = document.getElementById("filtro-canal");
  const p = document.getElementById("filtro-periodo");
  const f = document.getElementById("filtro-status-fiscal");

  if (b) b.value = "";
  if (s) s.value = "todos";
  if (m) m.value = "todos";
  if (c) c.value = "todos";
  if (p) p.value = "todos";
  if (f) f.value = "todos";

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

  document.getElementById("filtro-motivo")?.addEventListener("change", (e) => {
    state.filtroMotivo = e.target.value;
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

  document.getElementById("filtro-status-fiscal")?.addEventListener("change", (e) => {
    state.filtroStatusFiscal = e.target.value;
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
  document.getElementById("btn-atualizar")?.addEventListener("click", async () => {
    try {
      if (window.RezFireAPI) {
        const res = await window.RezFireAPI.pedidos.listar();
        if (res && res.sucesso && Array.isArray(res.pedidos)) {
          state.pedidos = res.pedidos.map(normalizarPedido);
        } else {
          state.pedidos = window.RezFireData.loadOrders().map(normalizarPedido);
        }
      } else {
        state.pedidos = window.RezFireData.loadOrders().map(normalizarPedido);
      }
    } catch (e) {
      state.pedidos = window.RezFireData.loadOrders().map(normalizarPedido);
    }
    renderKPIs();
    renderTable();
    showToast("Dados de pedidos atualizados.", "info");
  });

  // Sincronizar Pedidos do Mercado Livre (#30)
  document.getElementById("btn-sync-pedidos-ml")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-sync-pedidos-ml");
    const icon = document.getElementById("sync-pedidos-icon");
    const label = document.getElementById("sync-pedidos-label");
    if (btn) btn.disabled = true;
    if (icon) icon.classList.add("animate-spin");
    if (label) label.textContent = "Sincronizando...";

    try {
      let resultado = null;
      if (window.RezFireAPI && window.RezFireAPI.mercadolivre) {
        resultado = await window.RezFireAPI.mercadolivre.sincronizarPedidos();
      }

      // Recarrega listagem atualizada
      if (window.RezFireAPI) {
        const res = await window.RezFireAPI.pedidos.listar();
        if (res && res.sucesso && Array.isArray(res.pedidos)) {
          state.pedidos = res.pedidos.map(normalizarPedido);
        }
      }

      renderKPIs();
      renderTable();

      const msg = resultado?.mensagem || "Pedidos sincronizados com o Mercado Livre com sucesso!";
      showSyncPedidosFeedbackBanner("sucesso", msg);
      showToast("Pedidos sincronizados com o Mercado Livre!", "sucesso");
    } catch (err) {
      console.error("[Sincronização Pedidos ML] Erro:", err);
      showSyncPedidosFeedbackBanner("erro", `Falha na sincronização de pedidos: ${err.message || err}`);
      showToast("Falha na sincronização com Mercado Livre.", "erro");
    } finally {
      if (btn) btn.disabled = false;
      if (icon) icon.classList.remove("animate-spin");
      if (label) label.textContent = "⚡ Sincronizar ML";
    }
  });

  function showSyncPedidosFeedbackBanner(tipo, msg) {
    const banner = document.getElementById("sync-pedidos-feedback-banner");
    if (!banner) return;
    const isSucesso = tipo === "sucesso";
    banner.style.display = "flex";
    banner.className = isSucesso
      ? "p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs flex justify-between items-center"
      : "p-3 bg-red-50 border border-red-300 text-red-800 rounded-lg text-xs flex justify-between items-center";
    banner.innerHTML = `
      <div>${isSucesso ? "✅" : "⚠️"} ${escapeHtml(msg)}</div>
      <button type="button" class="text-stone-500 font-bold ml-3" onclick="this.parentElement.style.display='none'">✕</button>
    `;
    setTimeout(() => {
      if (banner) banner.style.display = "none";
    }, 6000);
  }

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
  document.getElementById("form-pedido")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("form-pedido-error");
    const btnSalvar = document.getElementById("btn-salvar-pedido");
    errorEl.textContent = "";

    const editingId = Number(document.getElementById("pedido-id")?.value) || null;
    const codigo_pedido = document.getElementById("pedido-numero")?.value.trim();
    const data_pedido = document.getElementById("pedido-data")?.value;
    const canal = document.getElementById("pedido-canal")?.value;
    const cliente = document.getElementById("pedido-cliente")?.value.trim();
    const uf = document.getElementById("pedido-uf")?.value;
    const status = document.getElementById("pedido-status")?.value;
    const modalidade_envio = document.getElementById("pedido-modalidade")?.value || "Coleta";
    const observacoes = document.getElementById("pedido-observacoes")?.value.trim();
    const codigo_externo_ml = canal === "Mercado Livre" ? document.getElementById("pedido-codigo-externo")?.value.trim() : null;
    const dadosDestinatarioForm = {
      cliente_nome: cliente,
      destinatario_documento: document.getElementById("pedido-dest-documento")?.value.trim() || null,
      destinatario_ie: document.getElementById("pedido-dest-ie")?.value.trim() || null,
      destinatario_cep: document.getElementById("pedido-dest-cep")?.value.trim() || null,
      destinatario_email: document.getElementById("pedido-dest-email")?.value.trim() || null,
      destinatario_logradouro: document.getElementById("pedido-dest-logradouro")?.value.trim() || null,
      destinatario_numero: document.getElementById("pedido-dest-numero")?.value.trim() || null,
      destinatario_complemento: document.getElementById("pedido-dest-complemento")?.value.trim() || null,
      destinatario_bairro: document.getElementById("pedido-dest-bairro")?.value.trim() || null,
      destinatario_municipio: document.getElementById("pedido-dest-municipio")?.value.trim() || null,
      destinatario_codigo_municipio_ibge: document.getElementById("pedido-dest-ibge")?.value.trim() || null,
      destinatario_uf: uf || null,
    };

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

    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.textContent = "Processando no Banco...";
    }

    try {
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
        ped.valor_desconto = desconto;
        ped.frete = frete;
        ped.valor_total = total;
        Object.assign(ped, dadosDestinatarioForm);

        if (window.RezFireAPI?.pedidos?.atualizarDestinatario && editingId) {
          const destRes = await window.RezFireAPI.pedidos.atualizarDestinatario(editingId, {
            ...dadosDestinatarioForm,
            valor_desconto: desconto,
          });
          if (destRes && destRes.sucesso && destRes.pedido) {
            state.pedidos[idx] = normalizarPedido(destRes.pedido);
          }
        }

        ped.historico = ped.historico || [];
        ped.historico.push({
          data: agoraIso,
          evento: "Pedido editado",
          descricao: `Alterações salvas comercialmente. Total: ${money(total)}.`,
          usuario: "Gestor RezFire",
        });

        // Se o pedido foi concluído na edição, sincroniza com entregas
        if (status === "Concluído" && window.RezFireEntregas && typeof window.RezFireEntregas.loadEntregas === "function") {
          let entregas = window.RezFireEntregas.loadEntregas();
          let entUpdated = false;
          entregas = entregas.map((ent) => {
            if (ent.id_pedido_interno === ped.id_pedido || ent.codigo_pedido_ml === ped.codigo_pedido || ent.codigo_pedido_direto === ped.codigo_pedido) {
              ent.status_logistico = window.RezFireEntregas.STATUS_LOGISTICO.ENTREGUE;
              ent.status_interno = window.RezFireEntregas.STATUS_INTERNO.DESPACHO_REGISTRADO;
              ent.data_entrega = agoraIso;
              entUpdated = true;
            }
            return ent;
          });
          if (entUpdated) {
            window.RezFireEntregas.saveEntregas(entregas);
          }
        }
      }
      showToast(`Pedido ${codigo_pedido} atualizado com sucesso!`, "sucesso");
    } else {
      // ─── Criação de Novo Pedido (Baixa Transacional via API & MySQL) ────
      let novoPedidoCriado = null;

      if (window.RezFireAPI) {
        const payloadAPI = {
          codigo_pedido: codigo_pedido || undefined,
          cliente_nome: cliente,
          origem: canal,
          modalidade_envio: modalidade_envio,
          exibir_na_entrega: true,
          valor_desconto: desconto,
          ...dadosDestinatarioForm,
          itens: formItens.map((it) => ({
            id_produto: Number(it.id_produto),
            quantidade: Number(it.quantidade),
            preco_unitario: Number(it.preco_unitario),
          })),
        };

        try {
          const apiRes = await window.RezFireAPI.pedidos.criar(payloadAPI);
          if (apiRes && apiRes.sucesso && apiRes.pedido) {
            novoPedidoCriado = normalizarPedido(apiRes.pedido);
          }
        } catch (apiErr) {
          console.error("[Pedidos API] Erro ao criar pedido:", apiErr);
          errorEl.textContent = apiErr.message || "Erro ao gravar pedido no banco MySQL.";
          return;
        }
      }

      if (!novoPedidoCriado) {
        const novoId = window.RezFireData ? window.RezFireData.nextOrderId(state.pedidos) : Date.now();
        novoPedidoCriado = {
          id_pedido: novoId,
          codigo_pedido: codigo_pedido || `#PED-${novoId}`,
          codigo_externo_ml,
          canal,
          origem: canal,
          tipo_envio: modalidade_envio,
          modalidade_envio: modalidade_envio,
          prazo_dias_estimado: modalidade_envio === "Full" ? 1 : (modalidade_envio === "Coleta" ? 3 : (modalidade_envio === "Tradicional" ? 4 : 2)),
          data_pedido: dataPedidoIso,
          cliente,
          cliente_nome: cliente,
          uf,
          status: "Confirmado",
          status_entrega: "A separar",
          itens: [...formItens],
          subtotal_itens: subtotal,
          desconto,
          frete,
          valor_total: total,
          observacoes,
          historico: [
            { data: agoraIso, evento: "Pedido registrado", descricao: `Cadastro manual via ${canal}.`, usuario: "Gestor RezFire" },
          ],
        };
      }

      state.pedidos.unshift(novoPedidoCriado);
      showToast(`Pedido ${novoPedidoCriado.codigo_pedido} criado e baixado no estoque MySQL com sucesso!`, "sucesso");
    }

    if (window.RezFireData) {
      window.RezFireData.saveOrders(state.pedidos);
    }
    closeFormModal(true);
    renderKPIs();
    renderTable();
  } catch (err) {
    errorEl.textContent = err.message || "Erro inesperado ao salvar pedido.";
  } finally {
    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar Pedido";
    }
  }
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

    if (e.target.closest("td.actions-cell")) {
      return;
    }

    // Clique na linha
    const row = e.target.closest("tr[data-row-id]");
    if (row) {
      const id = Number(row.getAttribute("data-row-id"));
      openDetalhePanel(id);
    }
  });

  // Modal Cancelamento / Devolução / Mediação (SCRUM-22)
  document.getElementById("btn-abortar-cancelamento")?.addEventListener("click", closeModalCancelamento);
  document.getElementById("btn-confirmar-cancelamento")?.addEventListener("click", executarCancelamento);
  document.getElementById("modal-cancelar-pedido")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-cancelar-pedido") closeModalCancelamento();
  });

  // Modal de Padrões e Estatísticas de Devoluções / Mediações (SCRUM-22)
  document.getElementById("btn-ver-padroes-devolucoes")?.addEventListener("click", openModalPadroesDevolucoes);
  document.getElementById("btn-fechar-modal-padroes")?.addEventListener("click", closeModalPadroesDevolucoes);
  document.getElementById("modal-padroes-devolucoes")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-padroes-devolucoes") closeModalPadroesDevolucoes();
  });

  // Modal de Comparativo de Modalidades de Envio (#24 / SCRUM-27)
  document.getElementById("btn-abrir-comparativo-modalidades")?.addEventListener("click", openModalComparativoModalidades);
  document.getElementById("btn-fechar-modal-comparativo")?.addEventListener("click", closeModalComparativoModalidades);
  document.getElementById("modal-comparativo-modalidades")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-comparativo-modalidades") closeModalComparativoModalidades();
  });

  // Fechar overlay
  document.getElementById("detalhe-overlay")?.addEventListener("click", closeDetalhePanel);

  // Modais de Destinatário & Preparação da NF-e (Story 33c)
  bindNFeModalsEvents();
}

// ─── Modais de Destinatário Fiscal e Preparar NF-e (Story 33c) ───────────────
let retornarParaPrepararNFePedidoId = null;

function fecharModalDestinatarioNFe() {
  document.getElementById("modal-destinatario-nfe")?.classList.remove("is-open");
  retornarParaPrepararNFePedidoId = null;
}

function fecharModalPrepararNFe() {
  document.getElementById("modal-preparar-nfe")?.classList.remove("is-open");
}

function abrirModalDestinatarioNFe(pedido, aoSalvarChamarPreparar = false) {
  const modal = document.getElementById("modal-destinatario-nfe");
  if (!modal || !pedido) return;

  retornarParaPrepararNFePedidoId = aoSalvarChamarPreparar ? pedido.id_pedido : null;
  document.getElementById("form-dest-nfe-error").textContent = "";
  document.getElementById("dest-nfe-pedido-id").value = pedido.id_pedido;
  document.getElementById("dest-nfe-nome").value = pedido.cliente_nome || pedido.cliente || "";
  document.getElementById("dest-nfe-documento").value = aplicarMascaraDocFiscal(pedido.destinatario_documento || "");
  document.getElementById("dest-nfe-ie").value = pedido.destinatario_ie || "";
  document.getElementById("dest-nfe-cep").value = formatarCepFiscal(pedido.destinatario_cep || "");
  document.getElementById("dest-nfe-uf").value = pedido.destinatario_uf || pedido.uf || "SP";
  document.getElementById("dest-nfe-logradouro").value = pedido.destinatario_logradouro || "";
  document.getElementById("dest-nfe-numero").value = pedido.destinatario_numero || "";
  document.getElementById("dest-nfe-complemento").value = pedido.destinatario_complemento || "";
  document.getElementById("dest-nfe-bairro").value = pedido.destinatario_bairro || "";
  document.getElementById("dest-nfe-municipio").value = pedido.destinatario_municipio || "";
  document.getElementById("dest-nfe-ibge").value = pedido.destinatario_codigo_municipio_ibge || "";
  document.getElementById("dest-nfe-email").value = pedido.destinatario_email || "";

  modal.classList.add("is-open");
}

function renderBloqueioValidacaoNFe(pedido, erros, mensagem) {
  const body = document.getElementById("modal-nfe-body");
  const actions = document.getElementById("modal-nfe-actions");
  const sub = document.getElementById("modal-nfe-subtitulo");

  if (sub) sub.textContent = `Pedido ${pedido.codigo_pedido} · Pendências fiscais impeditivas`;

  const temErroDest = erros.some((e) => e.secao === "destinatario");
  const temErroEmitente = erros.some((e) => e.secao === "emitente" || e.secao === "certificado");
  const temErroItem = erros.some((e) => e.secao === "item");

  const labelSecao = {
    emitente: "Emitente",
    certificado: "Certificado A1",
    pedido: "Pedido",
    destinatario: "Destinatário",
    item: "Produto / Item",
  };

  body.innerHTML = `
    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:14px;color:#991b1b;margin-bottom:14px">
      <strong style="display:block;font-size:0.95rem">⛔ Emissão bloqueada antes da assinatura</strong>
      <p style="margin:4px 0 0;font-size:0.82rem">${escapeHtml(mensagem || "Corrija os campos indicados abaixo para assinar a NF-e.")}</p>
    </div>
    <div style="border:1px solid var(--line);border-radius:10px;overflow:hidden">
      <table class="products-table" style="margin:0">
        <thead>
          <tr>
            <th>SEÇÃO</th>
            <th>CAMPO</th>
            <th>MOTIVO DO BLOQUEIO</th>
          </tr>
        </thead>
        <tbody>
          ${erros.map((e) => `
            <tr>
              <td><span style="font-size:0.74rem;font-weight:700;padding:2px 8px;border-radius:999px;background:#fef3c7;color:#92400e">${escapeHtml(labelSecao[e.secao] || e.secao)}</span></td>
              <td><strong>${escapeHtml(e.label)}</strong><div style="font-family:monospace;font-size:0.72rem;color:var(--muted)">${escapeHtml(e.campo)}</div></td>
              <td style="color:#991b1b">${escapeHtml(e.motivo)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  actions.innerHTML = `
    ${temErroDest ? `<button type="button" class="btn-primary" id="btn-nfe-corrigir-dest">Preencher Destinatário Agora</button>` : ""}
    ${temErroEmitente ? `<a href="fiscal.html" class="btn-ghost" style="text-decoration:none">Configurar Emitente / Certificado A1</a>` : ""}
    ${temErroItem ? `<a href="produtos.html?fiscal=pendentes" class="btn-ghost" style="text-decoration:none">Corrigir Dados Fiscais dos Produtos</a>` : ""}
    <button type="button" class="btn-ghost" id="btn-nfe-modal-fechar" style="margin-left:auto">Fechar</button>
  `;

  document.getElementById("btn-nfe-modal-fechar")?.addEventListener("click", fecharModalPrepararNFe);
  document.getElementById("btn-nfe-corrigir-dest")?.addEventListener("click", () => {
    fecharModalPrepararNFe();
    abrirModalDestinatarioNFe(pedido, true);
  });
}

function sincronizarEstadoNotaPedido(pedido, nf) {
  if (!pedido || !nf) return;
  const idx = state.pedidos.findIndex((p) => p.id_pedido === pedido.id_pedido);
  const resumo = {
    id_nota_fiscal: nf.id_nota_fiscal,
    status: nf.status,
    ambiente: nf.ambiente,
    serie: nf.serie,
    numero: nf.numero,
    chave_acesso: nf.chave_acesso,
    protocolo_autorizacao: nf.protocolo_autorizacao || null,
    ultimo_codigo_sefaz: nf.ultimo_codigo_sefaz || null,
    ultimo_motivo_sefaz: nf.ultimo_motivo_sefaz || null,
    ultima_mensagem_amigavel: nf.ultima_mensagem_amigavel || null,
    tentativas_envio: nf.tentativas_envio || 0,
    autorizada_em: nf.autorizada_em || null,
    codigo_pedido_snapshot: nf.codigo_pedido_snapshot || pedido.codigo_pedido || null,
    xml_autorizado_path: nf.xml_autorizado_path || null,
    xml_autorizado_sha256: nf.xml_autorizado_sha256 || null,
    xml_arquivado_em: nf.xml_arquivado_em || null,
    guarda_legal_ate: nf.guarda_legal_ate || null,
    danfe_gerado_em: nf.danfe_gerado_em || null,
    assinatura_valida: nf.assinatura_valida,
  };
  if (idx !== -1) {
    state.pedidos[idx].status_fiscal = nf.status;
    state.pedidos[idx].nota_fiscal_resumo = resumo;
  }
  pedido.status_fiscal = nf.status;
  pedido.nota_fiscal_resumo = resumo;
  renderTable();
  if (state.detalheId === pedido.id_pedido) {
    openDetalhePanel(pedido.id_pedido);
  }
}

function renderBannerStatusSefaz(nf) {
  const st = nf.status || "assinada";
  if (st === "autorizada") {
    return `
      <div style="background:#ecfdf5;border:1px solid #86efac;border-radius:10px;padding:14px;color:#065f46;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <strong style="font-size:0.95rem">✓ NF-e Autorizada pela SEFAZ (cStat ${escapeHtml(nf.ultimo_codigo_sefaz || "100")})</strong>
          <div style="font-size:0.8rem;margin-top:2px">
            Série <strong>${nf.serie}</strong> · Número <strong>${nf.numero}</strong> · Ambiente: <strong>${escapeHtml(nf.ambiente).toUpperCase()}</strong>
          </div>
          <div style="font-size:0.8rem;margin-top:4px">
            <strong>Protocolo de Autorização:</strong> <span class="font-mono" style="font-weight:800">${escapeHtml(nf.protocolo_autorizacao || "—")}</span>
            ${nf.autorizada_em ? ` · em ${formatDate(nf.autorizada_em)}` : ""}
          </div>
        </div>
        <span style="font-size:0.75rem;font-weight:800;padding:4px 10px;border-radius:999px;background:#fff;border:1px solid #86efac">
          AUTORIZADA
        </span>
      </div>
    `;
  }

  if (st === "em_processamento") {
    return `
      <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:14px;color:#9a3412;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <strong style="font-size:0.95rem">⏳ NF-e em Processamento na SEFAZ (cStat ${escapeHtml(nf.ultimo_codigo_sefaz || "105")})</strong>
          <span style="font-size:0.72rem;font-weight:800;padding:3px 9px;border-radius:999px;background:#fff;border:1px solid #fdba74">EM PROCESSAMENTO</span>
        </div>
        <div style="font-size:0.8rem;margin-top:4px">
          ${nf.numero_recibo ? `<strong>Recibo Lote:</strong> <span class="font-mono">${escapeHtml(nf.numero_recibo)}</span> · ` : ""}
          ${escapeHtml(nf.ultima_mensagem_amigavel || "Consulte o protocolo na SEFAZ antes de retransmitir para evitar duplicidade.")}
        </div>
      </div>
    `;
  }

  if (st === "rejeitada") {
    return `
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:14px;color:#991b1b;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <strong style="font-size:0.95rem">✕ NF-e Rejeitada pela SEFAZ (cStat ${escapeHtml(nf.ultimo_codigo_sefaz || "—")})</strong>
          <span style="font-size:0.72rem;font-weight:800;padding:3px 9px;border-radius:999px;background:#fff;border:1px solid #fca5a5">REJEITADA</span>
        </div>
        <div style="font-size:0.82rem;margin-top:6px;font-weight:600">${escapeHtml(nf.ultima_mensagem_amigavel || "")}</div>
        ${nf.ultimo_motivo_sefaz ? `<div style="font-size:0.75rem;margin-top:4px;color:#7f1d1d"><strong>Motivo oficial SEFAZ:</strong> ${escapeHtml(nf.ultimo_motivo_sefaz)}</div>` : ""}
      </div>
    `;
  }

  if (st === "denegada") {
    return `
      <div style="background:#450a0a;border:1px solid #991b1b;border-radius:10px;padding:14px;color:#fef2f2;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <strong style="font-size:0.95rem">⛔ Uso Denegado pela SEFAZ (cStat ${escapeHtml(nf.ultimo_codigo_sefaz || "110")})</strong>
          <span style="font-size:0.72rem;font-weight:800;padding:3px 9px;border-radius:999px;background:#7f1d1d;color:#fff">DENEGADA</span>
        </div>
        <div style="font-size:0.8rem;margin-top:6px">${escapeHtml(nf.ultima_mensagem_amigavel || nf.ultimo_motivo_sefaz || "Numeração consumida por denegação fiscal.")}</div>
      </div>
    `;
  }

  return `
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px;color:#065f46;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <strong style="font-size:0.95rem">✓ NF-e Validada e Assinada Digitalmente (XMLDSig A1)</strong>
        <div style="font-size:0.8rem;margin-top:2px">
          Série <strong>${nf.serie}</strong> · Número <strong>${nf.numero}</strong> · Ambiente: <strong>${escapeHtml(nf.ambiente).toUpperCase()}</strong>
        </div>
      </div>
      <span style="font-size:0.75rem;font-weight:800;padding:4px 10px;border-radius:999px;background:#fff;border:1px solid #86efac">
        ASSINADA (PRONTA P/ ENVIO)
      </span>
    </div>
    ${nf.ultima_mensagem_amigavel ? `
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:0.78rem;color:#92400e">
        <strong>Último retorno registrado (${escapeHtml(nf.ultimo_codigo_sefaz || "—")}):</strong> ${escapeHtml(nf.ultima_mensagem_amigavel)}
      </div>
    ` : ""}
  `;
}

function renderTabelaTransmissoesSefaz(transmissoes = []) {
  if (!transmissoes || transmissoes.length === 0) {
    return `<div style="font-size:0.78rem;color:var(--muted);padding:10px 12px;border:1px dashed var(--line);border-radius:8px">Nenhuma tentativa de envio ou consulta à SEFAZ registrada até o momento.</div>`;
  }
  return `
    <div class="table-wrap" style="border:1px solid var(--line);border-radius:8px;overflow:hidden;max-height:200px;overflow-y:auto">
      <table class="products-table" style="margin:0;font-size:0.75rem">
        <thead>
          <tr>
            <th>DATA/HORA</th>
            <th>OPERAÇÃO</th>
            <th>MODO</th>
            <th>RESULTADO</th>
            <th>cStat</th>
            <th>PROTOCOLO / RECIBO</th>
            <th>MS</th>
          </tr>
        </thead>
        <tbody>
          ${transmissoes.map((t) => `
            <tr>
              <td>${formatDate(t.created_at)}</td>
              <td>${escapeHtml(t.tipo_operacao === "consulta_protocolo" ? "Consulta" : "Autorização")}</td>
              <td><span class="font-mono">${escapeHtml(t.modo_transporte)}</span></td>
              <td><strong>${escapeHtml(t.resultado)}</strong>${t.erro_rede ? `<div style="color:#b91c1c;font-size:0.68rem">${escapeHtml(t.erro_rede)}</div>` : ""}</td>
              <td class="font-mono">${escapeHtml(t.codigo_sefaz || "—")}</td>
              <td class="font-mono">${escapeHtml(t.protocolo || t.numero_recibo || "—")}</td>
              <td>${t.duracao_ms != null ? `${t.duracao_ms}ms` : "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderNotaFiscalAssinada(pedido, nf, transmissoes = []) {
  const body = document.getElementById("modal-nfe-body");
  const actions = document.getElementById("modal-nfe-actions");
  const sub = document.getElementById("modal-nfe-subtitulo");

  if (sub) {
    sub.textContent = `Pedido ${pedido.codigo_pedido} · Layout NF-e ${nf.versao_layout || "4.00"}`;
  }

  const emit = nf.emitente_snapshot || {};
  const dest = nf.destinatario_snapshot || {};
  const tot = nf.totais_snapshot || {};
  const itens = nf.itens || [];
  const xmlExibido = nf.xml_autorizado || nf.xml_assinado || "";
  const isAutorizada = nf.status === "autorizada";
  const isCancelada = nf.status === "cancelada";
  const isRejeitada = nf.status === "rejeitada";
  const isDenegada = nf.status === "denegada";
  const isEmProc = nf.status === "em_processamento";
  const podeDanfe = (isAutorizada || isCancelada) && Boolean(nf.protocolo_autorizacao);
  const sugereAvancar = isRejeitada && (nf.ultimo_codigo_sefaz === "204" || nf.ultimo_codigo_sefaz === "539");

  body.innerHTML = `
    ${renderBannerStatusSefaz(nf)}
    <div id="nfe-sefaz-feedback" style="display:none;margin-bottom:12px;padding:12px;border-radius:8px;font-size:0.82rem"></div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:0.78rem">
      <div><strong>Chave de Acesso (44 dígitos):</strong> <span style="font-family:monospace;font-weight:700;word-break:break-all">${escapeHtml(nf.chave_acesso)}</span></div>
      <div style="margin-top:3px;color:var(--muted)"><strong>DigestValue (SHA-1):</strong> <span style="font-family:monospace">${escapeHtml(nf.digest_value || "")}</span> · <strong>Certificado Serial:</strong> <span style="font-family:monospace">${escapeHtml(nf.assinada_por_certificado_serial || "")}</span> · <strong>Tentativas envio:</strong> ${nf.tentativas_envio || 0}</div>
      ${(nf.xml_autorizado_path || nf.guarda_legal_ate) ? `
        <div style="margin-top:4px;color:#065f46;font-size:0.74rem">
          <strong>Guarda Legal XML (5 anos):</strong> até ${nf.guarda_legal_ate ? escapeHtml(formatDateOnly(nf.guarda_legal_ate)) : "—"}
          ${nf.xml_autorizado_sha256 ? ` · SHA-256: <span class="font-mono">${escapeHtml(nf.xml_autorizado_sha256.slice(0, 16))}...</span>` : ""}
        </div>
      ` : ""}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      <div style="border:1px solid var(--line);border-radius:8px;padding:10px;font-size:0.8rem">
        <div style="font-size:0.7rem;font-weight:800;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Emitente</div>
        <strong>${escapeHtml(emit.razao_social)}</strong>
        <div>CNPJ: <span class="font-mono">${formatarDocFiscal(emit.cnpj)}</span> · IE: ${escapeHtml(emit.inscricao_estadual)}</div>
        <div style="color:var(--muted)">${escapeHtml(emit.municipio || "")}/${escapeHtml(emit.uf || "")}</div>
      </div>
      <div style="border:1px solid var(--line);border-radius:8px;padding:10px;font-size:0.8rem">
        <div style="font-size:0.7rem;font-weight:800;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Destinatário</div>
        <strong>${escapeHtml(dest.nome)}</strong>
        <div>${escapeHtml(dest.tipo_documento || "Doc")}: <span class="font-mono">${formatarDocFiscal(dest.documento)}</span></div>
        <div style="color:var(--muted)">${escapeHtml(dest.logradouro || "")}, ${escapeHtml(dest.numero || "")} — ${escapeHtml(dest.municipio || "")}/${escapeHtml(dest.uf || "")}</div>
      </div>
    </div>

    <div class="table-wrap" style="border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:14px">
      <table class="products-table" style="margin:0">
        <thead>
          <tr>
            <th>PRODUTO</th>
            <th>NCM</th>
            <th>CFOP</th>
            <th>CST/CSOSN</th>
            <th style="text-align:center">QTD</th>
            <th style="text-align:right">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itens.map((it) => `
            <tr>
              <td><strong>${escapeHtml(it.nome_snapshot)}</strong><div style="font-size:0.72rem;color:var(--muted)">${escapeHtml(it.sku_snapshot)} · ${escapeHtml(it.unidade_snapshot)}</div></td>
              <td class="font-mono">${escapeHtml(it.ncm_snapshot)}</td>
              <td class="font-mono">${escapeHtml(it.cfop_snapshot)}</td>
              <td class="font-mono">${escapeHtml(it.origem_snapshot)}-${escapeHtml(it.cst_csosn_snapshot)}</td>
              <td style="text-align:center">${it.quantidade}</td>
              <td style="text-align:right;font-weight:700">${money(it.valor_total)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="finance-summary-box" style="margin-top:0;margin-bottom:14px">
      <div class="finance-item"><span>Produtos (vProd)</span><strong>${money(tot.vProd)}</strong></div>
      <div class="finance-item"><span>Frete (vFrete)</span><strong>${money(tot.vFrete)}</strong></div>
      <div class="finance-item"><span>Desconto (vDesc)</span><strong>${money(tot.vDesc)}</strong></div>
      <div class="finance-item"><span>Tributos Aprox.</span><strong>${money(tot.vTotTrib)}</strong></div>
      <div class="finance-item highlight"><span>Total NF-e (vNF)</span><strong>${money(tot.vNF)}</strong></div>
    </div>

    <div style="margin-bottom:14px">
      <label style="font-size:0.75rem;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">
        ${nf.xml_autorizado ? "XML NF-e v4.00 Autorizado (&lt;nfeProc&gt; com Protocolo SEFAZ)" : "XML NF-e v4.00 Assinado (&lt;Signature&gt; XMLDSig)"}
      </label>
      <textarea id="nfe-xml-preview" readonly rows="5" style="width:100%;font-family:monospace;font-size:0.72rem;border:1px solid var(--line);border-radius:8px;padding:8px;background:#faf7f3">${escapeHtml(xmlExibido)}</textarea>
    </div>

    <div>
      <label style="font-size:0.75rem;font-weight:700;color:var(--muted);display:block;margin-bottom:6px">
        Auditoria de Transmissões e Consultas SEFAZ (${transmissoes.length})
      </label>
      <div id="nfe-transmissoes-wrap">${renderTabelaTransmissoesSefaz(transmissoes)}</div>
    </div>
  `;

  actions.innerHTML = `
    ${!isAutorizada && !isDenegada ? `
      <button type="button" class="btn-primary" id="btn-nfe-transmitir" style="background:#0f766e">
        ${isEmProc ? "⚡ Verificar e Transmitir (Anti-Duplicidade)" : isRejeitada ? "Reenviar à SEFAZ" : "🚀 Transmitir à SEFAZ"}
      </button>
    ` : ""}
    <button type="button" class="btn-ghost" id="btn-nfe-consultar">🔎 Consultar Situação SEFAZ</button>
    ${(!isAutorizada && !isEmProc && !isDenegada) ? `
      <button type="button" class="btn-ghost" id="btn-nfe-regerar" title="Regera e reassina XML com os dados atuais mantendo a mesma numeração">
        ${isRejeitada ? "Corrigir / Regerar XML" : "Regerar Assinatura"}
      </button>
    ` : ""}
    ${sugereAvancar ? `
      <button type="button" class="btn-ghost" id="btn-nfe-regerar-avancar" style="border-color:#fca5a5;color:#b91c1c" title="Avança para o próximo número NF-e em casos de duplicidade 204/539">
        Avançar Nº NF-e
      </button>
    ` : ""}
    <button type="button" class="btn-ghost" id="btn-nfe-copiar-xml">${nf.xml_autorizado ? "Copiar nfeProc" : "Copiar XML"}</button>
    ${podeDanfe ? `<button type="button" class="btn-primary" id="btn-nfe-danfe" style="background:#0f766e">🖨️ Visualizar / Imprimir DANFE</button>` : ""}
    <button type="button" class="btn-primary" id="btn-nfe-baixar-xml">${nf.xml_autorizado ? "Baixar XML Autorizado" : "Baixar XML Assinado"}</button>
    <button type="button" class="btn-ghost" id="btn-nfe-modal-fechar" style="margin-left:auto">Fechar</button>
  `;

  const setFeedbackSefaz = (tipo, msg) => {
    const fb = document.getElementById("nfe-sefaz-feedback");
    if (!fb) return;
    fb.style.display = "block";
    fb.style.background = tipo === "erro" ? "#fee2e2" : "#fffbeb";
    fb.style.border = tipo === "erro" ? "1px solid #fca5a5" : "1px solid #fcd34d";
    fb.style.color = tipo === "erro" ? "#991b1b" : "#92400e";
    fb.textContent = msg;
  };

  const executarAcaoSefaz = async (acaoFn, btnEl, textoCarregando, textoOriginal) => {
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = textoCarregando;
    }
    try {
      const res = await acaoFn();
      if (res?.nota_fiscal) {
        sincronizarEstadoNotaPedido(pedido, res.nota_fiscal);
        renderNotaFiscalAssinada(pedido, res.nota_fiscal, res.transmissoes || transmissoes);
      }
      showToast(res?.mensagem || "Retorno SEFAZ processado!", res?.autorizada ? "sucesso" : res?.nota_fiscal?.status === "rejeitada" || res?.nota_fiscal?.status === "denegada" ? "erro" : "info");
    } catch (err) {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = textoOriginal;
      }
      if (err.status === 503 && err.data) {
        if (err.data.nota_fiscal) {
          sincronizarEstadoNotaPedido(pedido, err.data.nota_fiscal);
          renderNotaFiscalAssinada(pedido, err.data.nota_fiscal, err.data.transmissoes || transmissoes);
        }
        setFeedbackSefaz(
          "aviso",
          `${err.data.mensagem || err.message} (HTTP 503). Os dados e a assinatura foram preservados para nova tentativa.`
        );
        showToast("SEFAZ temporariamente indisponível. Tente novamente em instantes.", "aviso");
      } else {
        setFeedbackSefaz("erro", err.message || "Falha ao comunicar com a SEFAZ.");
        showToast(err.message || "Erro na comunicação com a SEFAZ.", "erro");
      }
    }
  };

  document.getElementById("btn-nfe-modal-fechar")?.addEventListener("click", fecharModalPrepararNFe);
  document.getElementById("btn-nfe-transmitir")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    executarAcaoSefaz(
      () => window.RezFireAPI.fiscal.transmitirNFe(pedido.id_pedido, {}),
      btn,
      "Comunicando SEFAZ...",
      btn.textContent
    );
  });
  document.getElementById("btn-nfe-consultar")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    executarAcaoSefaz(
      () => window.RezFireAPI.fiscal.consultarNFeSefaz(pedido.id_pedido, {}),
      btn,
      "Consultando SEFAZ...",
      btn.textContent
    );
  });
  document.getElementById("btn-nfe-regerar")?.addEventListener("click", () => {
    abrirModalPrepararNFe(pedido, { regerar: true });
  });
  document.getElementById("btn-nfe-regerar-avancar")?.addEventListener("click", () => {
    abrirModalPrepararNFe(pedido, { regerar: true, avancar_numero: true });
  });
  document.getElementById("btn-nfe-danfe")?.addEventListener("click", async () => {
    try {
      await window.RezFireAPI.fiscal.abrirDanfeNotaNovaAba(nf.id_nota_fiscal);
    } catch (err) {
      showToast(err.message || "Erro ao gerar DANFE.", "erro");
    }
  });
  document.getElementById("btn-nfe-copiar-xml")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(xmlExibido);
      showToast("XML copiado para a área de transferência!", "sucesso");
    } catch {
      document.getElementById("nfe-xml-preview")?.select();
      showToast("Selecione e copie o XML exibido na caixa de texto.", "info");
    }
  });
  document.getElementById("btn-nfe-baixar-xml")?.addEventListener("click", async () => {
    try {
      await window.RezFireAPI.fiscal.baixarXmlNotaArquivo(
        nf.id_nota_fiscal,
        `NFe-${nf.chave_acesso || nf.numero}${nf.xml_autorizado ? "-procNFe" : ""}.xml`
      );
      showToast("XML baixado com sucesso!", "sucesso");
    } catch (err) {
      showToast(err.message || "Erro ao baixar XML.", "erro");
    }
  });
}

async function abrirModalPrepararNFe(pedido, opcoes = {}) {
  const modal = document.getElementById("modal-preparar-nfe");
  const body = document.getElementById("modal-nfe-body");
  const actions = document.getElementById("modal-nfe-actions");
  if (!modal || !pedido) return;

  body.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted)">Carregando dados fiscais e preparando NF-e...</div>`;
  actions.innerHTML = `<button type="button" class="btn-ghost" id="btn-nfe-modal-fechar">Fechar</button>`;
  document.getElementById("btn-nfe-modal-fechar")?.addEventListener("click", fecharModalPrepararNFe);
  modal.classList.add("is-open");

  try {
    if (!opcoes.regerar) {
      const atual = await window.RezFireAPI.fiscal.obterNFePedido(pedido.id_pedido);
      if (atual?.nota_fiscal && atual.nota_fiscal.status !== "rascunho") {
        sincronizarEstadoNotaPedido(pedido, atual.nota_fiscal);
        renderNotaFiscalAssinada(pedido, atual.nota_fiscal, atual.transmissoes || []);
        return;
      }
    }

    const res = await window.RezFireAPI.fiscal.prepararNFe(pedido.id_pedido, opcoes);
    if (res && res.nota_fiscal) {
      const hist = await window.RezFireAPI.fiscal.listarTransmissoesNFe(pedido.id_pedido).catch(() => null);
      sincronizarEstadoNotaPedido(pedido, res.nota_fiscal);
      renderNotaFiscalAssinada(pedido, res.nota_fiscal, hist?.transmissoes || []);
      showToast(res.mensagem || "NF-e assinada com sucesso!", "sucesso");
    }
  } catch (err) {
    if (err.status === 422 && err.data?.bloqueado && Array.isArray(err.data.erros_validacao)) {
      renderBloqueioValidacaoNFe(pedido, err.data.erros_validacao, err.data.mensagem);
    } else {
      body.innerHTML = `<div style="background:#fee2e2;color:#991b1b;padding:14px;border-radius:8px">${escapeHtml(err.message || "Erro ao preparar NF-e.")}</div>`;
    }
  }
}

function bindNFeModalsEvents() {
  ["dest-nfe-documento", "pedido-dest-documento"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", (e) => {
      e.target.value = aplicarMascaraDocFiscal(e.target.value);
    });
  });

  ["dest-nfe-cep", "pedido-dest-cep"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", (e) => {
      e.target.value = formatarCepFiscal(e.target.value);
    });
  });

  document.getElementById("btn-fechar-modal-nfe")?.addEventListener("click", fecharModalPrepararNFe);
  document.getElementById("modal-preparar-nfe")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-preparar-nfe") fecharModalPrepararNFe();
  });

  document.getElementById("btn-fechar-modal-dest-nfe")?.addEventListener("click", fecharModalDestinatarioNFe);
  document.getElementById("btn-cancelar-dest-nfe")?.addEventListener("click", fecharModalDestinatarioNFe);
  document.getElementById("modal-destinatario-nfe")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-destinatario-nfe") fecharModalDestinatarioNFe();
  });

  document.getElementById("form-destinatario-nfe")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("form-dest-nfe-error");
    errEl.textContent = "";
    const idPedido = Number(document.getElementById("dest-nfe-pedido-id").value);
    const reabrirPreparar = retornarParaPrepararNFePedidoId === idPedido;

    const payload = {
      cliente_nome: document.getElementById("dest-nfe-nome").value.trim(),
      destinatario_documento: document.getElementById("dest-nfe-documento").value.trim(),
      destinatario_ie: document.getElementById("dest-nfe-ie").value.trim() || null,
      destinatario_cep: document.getElementById("dest-nfe-cep").value.trim(),
      destinatario_uf: document.getElementById("dest-nfe-uf").value,
      destinatario_logradouro: document.getElementById("dest-nfe-logradouro").value.trim(),
      destinatario_numero: document.getElementById("dest-nfe-numero").value.trim(),
      destinatario_complemento: document.getElementById("dest-nfe-complemento").value.trim() || null,
      destinatario_bairro: document.getElementById("dest-nfe-bairro").value.trim(),
      destinatario_municipio: document.getElementById("dest-nfe-municipio").value.trim(),
      destinatario_codigo_municipio_ibge: document.getElementById("dest-nfe-ibge").value.trim() || null,
      destinatario_email: document.getElementById("dest-nfe-email").value.trim() || null,
    };

    try {
      const res = await window.RezFireAPI.pedidos.atualizarDestinatario(idPedido, payload);
      if (res && res.sucesso && res.pedido) {
        const norm = normalizarPedido(res.pedido);
        const idx = state.pedidos.findIndex((p) => p.id_pedido === idPedido);
        if (idx !== -1) state.pedidos[idx] = norm;
        fecharModalDestinatarioNFe();
        renderTable();
        if (state.detalheId === idPedido) {
          openDetalhePanel(idPedido);
        }
        showToast("Destinatário fiscal atualizado no pedido!", "sucesso");
        if (reabrirPreparar && idx !== -1) {
          abrirModalPrepararNFe(state.pedidos[idx]);
        }
      }
    } catch (err) {
      errEl.textContent = err.message || "Erro ao salvar destinatário.";
    }
  });
}

// ─── Inicialização da Página ──────────────────────────────────────────────────
async function init() {
  window.RezFireLayout.renderSidebar("pedidos");

  try {
    if (window.RezFireAPI) {
      const [resPedidos, resProdutos] = await Promise.all([
        window.RezFireAPI.pedidos.listar().catch(() => null),
        window.RezFireAPI.produtos.listar().catch(() => null),
      ]);

      if (resPedidos && resPedidos.sucesso && Array.isArray(resPedidos.pedidos) && resPedidos.pedidos.length > 0) {
        state.pedidos = resPedidos.pedidos.map(normalizarPedido);
      } else {
        state.pedidos = window.RezFireData.loadOrders().map(normalizarPedido);
      }

      if (resProdutos && resProdutos.sucesso && Array.isArray(resProdutos.produtos)) {
        state.produtos = resProdutos.produtos;
      } else {
        state.produtos = window.RezFireData.loadProducts();
      }
    } else {
      state.pedidos = window.RezFireData.loadOrders().map(normalizarPedido);
      state.produtos = window.RezFireData.loadProducts();
    }
  } catch (err) {
    console.warn("[Pedidos] Carregando dados locais:", err);
    state.pedidos = window.RezFireData.loadOrders().map(normalizarPedido);
    state.produtos = window.RezFireData.loadProducts();
  }

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
