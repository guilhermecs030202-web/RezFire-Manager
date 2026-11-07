/**
 * estoque.js
 * Gerenciamento de Estoque Consolidado e Controle de Lotes & Validades (FEFO).
 * RezFire Manager.
 */

const pencilIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

// ─── Estado da Página ─────────────────────────────────────────────────────────
let currentTab = "produtos"; // "produtos" | "lotes"
let products = [];
let lotes = [];

let queryProdutos = "";
let queryLotes = "";
let filtroValidadeStatus = "todos"; // "todos" | "regular" | "alerta" | "bloqueado" | "vencido"
let ordemLotes = "val_asc"; // "val_asc" (FEFO) | "val_desc" | "qtd_desc" | "qtd_asc" | "lote_asc"

// ─── Helpers de Formatação e Escape ───────────────────────────────────────────
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(isoDate) {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. ABA DE PRODUTOS (SALDO CONSOLIDADO)
// ═════════════════════════════════════════════════════════════════════════════
function saldoClass(product) {
  const qty = Number(product.quantidade_atual);
  if (qty <= 0) return "zero";
  if (qty <= Number(product.estoque_minimo)) return "low";
  return "ok";
}

function filteredProducts() {
  const term = queryProdutos.trim().toLowerCase();
  if (!term) return products;
  return products.filter(
    (p) =>
      p.sku.toLowerCase().includes(term) ||
      p.nome.toLowerCase().includes(term)
  );
}

function renderProdutosTable() {
  const body = document.getElementById("estoque-body");
  const countEl = document.getElementById("estoque-count");
  const infoEl = document.getElementById("produtos-filtro-info");
  if (!body) return;

  const rows = filteredProducts();
  if (countEl) countEl.textContent = `${products.length} produtos monitorados`;
  if (infoEl) infoEl.textContent = `Exibindo ${rows.length} de ${products.length} produtos`;

  if (!rows.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">Nenhum produto encontrado.</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map((p) => {
      let isCombo = p.tipo === "Combo";
      let qtdDisplay = p.quantidade_atual;
      let comboDet = "";

      if (isCombo && p.combo_items && p.combo_items.length > 0) {
        const possiveis = p.combo_items.map((ci) => {
          const itemReal = products.find((x) => x.id_produto === ci.id_produto);
          if (!itemReal || !ci.quantidade) return 0;
          return Math.floor(Number(itemReal.quantidade_atual || 0) / Number(ci.quantidade));
        });
        qtdDisplay = Math.min(...possiveis);
        comboDet = `<span style="font-size:0.7rem;color:var(--muted);display:block">Kit dinâmico (${p.combo_items.length} componentes)</span>`;
      }

      const chip = isCombo ? (qtdDisplay > 0 ? "ok" : "zero") : saldoClass(p);
      const statusText = chip === "zero" ? "Sem Estoque" : (chip === "low" ? "Estoque Baixo" : "Normal");

      return `
        <tr>
          <td><span class="sku-main">${escapeHtml(p.sku)}</span></td>
          <td class="prod-name">
            ${escapeHtml(p.nome)}
            ${comboDet}
          </td>
          <td>
            <span class="saldo-chip ${chip}">${qtdDisplay}</span>
            ${isCombo ? `<span style="font-size:0.68rem;color:var(--accent);font-weight:700;display:block">Combo</span>` : ""}
          </td>
          <td>${p.estoque_minimo}</td>
          <td><span class="status-pill ${chip === 'ok' ? 'on' : ''}">${statusText}</span></td>
          <td style="text-align:right">
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">
              <button class="btn-quick-drop" type="button" data-quick-drop="${p.id_produto}" title="Baixa Rápida · Venda Mercado Livre" style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;font-size:0.75rem;font-weight:700;background:#fff7ed;color:#c2410c;border:1px solid #fdba74;border-radius:6px;cursor:pointer">
                ⚡ Baixa ML
              </button>
              ${!isCombo ? `
                <button class="icon-btn" type="button" data-edit-product="${p.id_produto}" title="Ajuste de Balanço / Inventário">
                  ${pencilIcon}
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function openProductModal(product) {
  const modal = document.getElementById("modal");
  document.getElementById("form-error").textContent = "";
  document.getElementById("id_produto").value = product.id_produto;
  document.getElementById("quantidade_atual").value = product.quantidade_atual;
  document.getElementById("estoque_minimo").value = product.estoque_minimo;
  modal.classList.add("is-open");
  document.getElementById("quantidade_atual").focus();
}

function closeProductModal() {
  document.getElementById("modal").classList.remove("is-open");
}

// ─── Helpers da Baixa Rápida de Estoque (SCRUM-9 / #3) ────────────────────────
function getProdutoDisponibilidade(p) {
  if (!p) return 0;
  if (p.tipo === "Combo" && p.combo_items && p.combo_items.length > 0) {
    const possiveis = p.combo_items.map((ci) => {
      const itemReal = products.find((x) => x.id_produto === ci.id_produto);
      if (!itemReal || !ci.quantidade) return 0;
      return Math.floor(Number(itemReal.quantidade_atual || 0) / Number(ci.quantidade));
    });
    return Math.min(...possiveis);
  }
  return Number(p.quantidade_atual || 0);
}

function atualizarPrevisaoBaixa() {
  const prodId = Number(document.getElementById("baixa-prod-id").value || document.getElementById("baixa-select-produto").value);
  const qtd = Number(document.getElementById("baixa-qtd").value || 1);
  const prevEl = document.getElementById("baixa-novo-saldo-previsto");
  const errEl = document.getElementById("form-baixa-error");
  const btnSubmit = document.getElementById("btn-confirmar-baixa-submit");
  if (!prevEl) return;

  const prod = products.find((p) => p.id_produto === prodId);
  if (!prod) {
    prevEl.textContent = "—";
    return;
  }

  const saldoAtual = getProdutoDisponibilidade(prod);
  const novoSaldo = saldoAtual - qtd;

  if (qtd <= 0) {
    prevEl.innerHTML = `<span style="color:#b91c1c">Quantidade inválida</span>`;
    if (errEl) errEl.textContent = "A quantidade deve ser maior que zero.";
    if (btnSubmit) btnSubmit.disabled = true;
    return;
  }

  if (novoSaldo < 0) {
    prevEl.innerHTML = `<span style="color:#b91c1c;font-weight:700">Saldo insuficiente! (${saldoAtual} disp.)</span>`;
    if (errEl) errEl.textContent = `Atenção: Saldo insuficiente em estoque! Disponível: ${saldoAtual}, Solicitado: ${qtd}.`;
    if (btnSubmit) btnSubmit.disabled = true;
  } else {
    prevEl.innerHTML = `<span>${saldoAtual} un. ➔ <strong style="color:#16a34a">${novoSaldo} un.</strong></span>`;
    if (errEl) errEl.textContent = "";
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

function openBaixaRapidaModal(product = null) {
  const modal = document.getElementById("modal-baixa-rapida");
  const errEl = document.getElementById("form-baixa-error");
  const wrapSelect = document.getElementById("wrap-baixa-select-prod");
  const selectEl = document.getElementById("baixa-select-produto");
  const cardEl = document.getElementById("baixa-prod-card");
  const qtdInput = document.getElementById("baixa-qtd");
  const codMlInput = document.getElementById("baixa-cod-ml");
  const idInput = document.getElementById("baixa-prod-id");

  if (!modal) return;
  if (errEl) errEl.textContent = "";
  if (qtdInput) qtdInput.value = "1";
  if (codMlInput) codMlInput.value = "";

  // Popula o select de produtos
  if (selectEl) {
    selectEl.innerHTML = `<option value="">— Selecione o produto vendido —</option>` +
      products.map((p) => {
        const saldo = getProdutoDisponibilidade(p);
        return `<option value="${p.id_produto}">${escapeHtml(p.sku)} - ${escapeHtml(p.nome)} (${saldo} un. disp.)</option>`;
      }).join("");
  }

  if (product) {
    // 1 clique na linha da tabela: já vem pré-selecionado
    idInput.value = product.id_produto;
    if (selectEl) selectEl.value = product.id_produto;
    if (wrapSelect) wrapSelect.style.display = "none";

    const saldo = getProdutoDisponibilidade(product);
    document.getElementById("baixa-prod-sku").textContent = product.sku;
    document.getElementById("baixa-prod-nome").textContent = product.nome;
    document.getElementById("baixa-prod-tipo").textContent = product.tipo === "Combo" ? "Kit / Combo Promocional" : "Produto Físico";
    document.getElementById("baixa-prod-saldo").textContent = `${saldo} un.`;
    if (cardEl) cardEl.style.display = "block";
  } else {
    // Clicou no botão do topo da toolbar
    idInput.value = "";
    if (wrapSelect) wrapSelect.style.display = "block";
    if (cardEl) cardEl.style.display = "none";
  }

  atualizarPrevisaoBaixa();
  modal.classList.add("is-open");
  if (qtdInput) qtdInput.focus();
}

function closeBaixaRapidaModal() {
  document.getElementById("modal-baixa-rapida")?.classList.remove("is-open");
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. ABA DE LOTES & VALIDADES (FEFO)
// ═════════════════════════════════════════════════════════════════════════════
function getFilteredAndSortedLotes() {
  const term = queryLotes.trim().toLowerCase();

  let list = lotes.map((lote) => {
    const statusInfo = window.RezFireData.computeLoteStatus(lote.validade);
    return { ...lote, ...statusInfo };
  });

  // Filtro de busca textual
  if (term) {
    list = list.filter(
      (l) =>
        l.id_lote.toLowerCase().includes(term) ||
        l.sku.toLowerCase().includes(term) ||
        (l.nome && l.nome.toLowerCase().includes(term)) ||
        (l.lacre && l.lacre.toLowerCase().includes(term))
    );
  }

  // Filtro de situação de validade
  if (filtroValidadeStatus !== "todos") {
    list = list.filter((l) => l.statusKey === filtroValidadeStatus);
  }

  // Ordenação (FEFO por padrão: val_asc)
  list.sort((a, b) => {
    if (ordemLotes === "val_asc") {
      return a.diasRestantes - b.diasRestantes;
    }
    if (ordemLotes === "val_desc") {
      return b.diasRestantes - a.diasRestantes;
    }
    if (ordemLotes === "qtd_desc") {
      return Number(b.quantidade_disponivel || 0) - Number(a.quantidade_disponivel || 0);
    }
    if (ordemLotes === "qtd_asc") {
      return Number(a.quantidade_disponivel || 0) - Number(b.quantidade_disponivel || 0);
    }
    if (ordemLotes === "lote_asc") {
      return a.id_lote.localeCompare(b.id_lote);
    }
    return 0;
  });

  return list;
}

function renderLotesKPIs() {
  const el = document.getElementById("kpis-lotes");
  if (!el) return;

  const lotesCalculados = lotes.map((l) => ({
    ...l,
    ...window.RezFireData.computeLoteStatus(l.validade),
  }));

  const total = lotesCalculados.length;
  const regulares = lotesCalculados.filter((l) => l.statusKey === "regular").length;
  const alerta = lotesCalculados.filter((l) => l.statusKey === "alerta").length;
  const bloqueados = lotesCalculados.filter((l) => l.statusKey === "bloqueado").length;
  const vencidos = lotesCalculados.filter((l) => l.statusKey === "vencido").length;

  el.innerHTML = `
    <div class="card kpi-card" style="cursor:pointer" data-kpi-val="todos" title="Ver todos os lotes">
      <p class="kpi-label">TOTAL DE LOTES</p>
      <p class="kpi-value">${total}</p>
      <p class="kpi-hint">armazenados no galpão</p>
    </div>
    <div class="card kpi-card" style="cursor:pointer" data-kpi-val="regular" title="Filtrar regulares">
      <p class="kpi-label">🟢 REGULARES (&gt; 1 ANO)</p>
      <p class="kpi-value" style="color:#166534">${regulares}</p>
      <p class="kpi-hint">condição ideal de venda</p>
    </div>
    <div class="card kpi-card" style="cursor:pointer" data-kpi-val="alerta" title="Filtrar em alerta FEFO">
      <p class="kpi-label">🟡 EM ALERTA (&le; 1 ANO)</p>
      <p class="kpi-value" style="color:#854d0e">${alerta}</p>
      <p class="kpi-hint">prioridade máxima FEFO</p>
    </div>
    <div class="card kpi-card" style="cursor:pointer" data-kpi-val="bloqueado" title="Filtrar bloqueados">
      <p class="kpi-label">🔴 BLOQUEADOS (&le; 6 MESES)</p>
      <p class="kpi-value" style="color:#991b1b">${bloqueados}</p>
      <p class="kpi-hint">inaptos p/ envio ao cliente</p>
    </div>
    <div class="card kpi-card" style="cursor:pointer" data-kpi-val="vencido" title="Filtrar vencidos">
      <p class="kpi-label">⛔ VENCIDOS</p>
      <p class="kpi-value" style="color:#4b5563">${vencidos}</p>
      <p class="kpi-hint">exigem recarga / descarte</p>
    </div>
  `;

  // Clique rápido nos KPIs para filtrar
  el.querySelectorAll("[data-kpi-val]").forEach((card) => {
    card.addEventListener("click", () => {
      const v = card.getAttribute("data-kpi-val");
      const sel = document.getElementById("filtro-val-status");
      if (sel) {
        sel.value = v;
        filtroValidadeStatus = v;
        renderLotesTable();
      }
    });
  });
}

function renderLotesTable() {
  const body = document.getElementById("lotes-body");
  const countEl = document.getElementById("lotes-contador");
  const btnLimpar = document.getElementById("btn-limpar-lotes-filtros");
  if (!body) return;

  const rows = getFilteredAndSortedLotes();
  if (countEl) countEl.textContent = `${rows.length} de ${lotes.length} lotes`;

  const temFiltroAtivo = queryLotes || filtroValidadeStatus !== "todos" || ordemLotes !== "val_asc";
  if (btnLimpar) btnLimpar.style.display = temFiltroAtivo ? "inline-block" : "none";

  if (!rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:40px;color:var(--muted)">
          <div style="font-weight:700;color:var(--ink);margin-bottom:4px">Nenhum lote encontrado</div>
          <p style="margin:0;font-size:0.85rem">Tente ajustar a busca ou o filtro de validade.</p>
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = rows
    .map((l) => {
      let badgeClass = "badge-val-regular";
      if (l.statusKey === "alerta") badgeClass = "badge-val-alerta";
      if (l.statusKey === "bloqueado") badgeClass = "badge-val-bloqueado";
      if (l.statusKey === "vencido") badgeClass = "badge-val-vencido";

      return `
        <tr>
          <td>
            <strong style="font-family:monospace;color:var(--ink);font-size:0.92rem">${escapeHtml(l.id_lote)}</strong>
          </td>
          <td>
            <span class="prod-name" style="font-size:0.88rem">${escapeHtml(l.nome)}</span>
            <span class="sku-sub" style="font-size:0.75rem">${escapeHtml(l.sku)}</span>
          </td>
          <td>
            <span style="font-family:monospace;font-size:0.82rem;color:var(--muted)">${escapeHtml(l.lacre || "—")}</span>
          </td>
          <td style="text-align:center">
            <strong style="font-size:0.95rem;color:var(--ink)">${l.quantidade_disponivel}</strong> un.
          </td>
          <td>
            <span style="font-size:0.85rem;font-weight:600;color:var(--ink)">${formatDate(l.validade)}</span>
          </td>
          <td>
            <span style="font-size:0.82rem;color:${l.podeDespachar ? "var(--ink)" : "var(--down)"};font-weight:${l.statusKey === 'alerta' ? '700' : '500'}">
              ${escapeHtml(l.textoTempo)}
            </span>
          </td>
          <td>
            <span class="badge-val ${badgeClass}">
              ${l.statusKey === "regular" ? "🟢" : l.statusKey === "alerta" ? "🟡" : l.statusKey === "bloqueado" ? "🔴" : "⛔"}
              ${escapeHtml(l.label)}
            </span>
          </td>
          <td style="text-align:right">
            <button class="icon-btn" type="button" data-edit-lote="${l.id_lote}" title="Editar Lote">
              ${pencilIcon}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

// ─── Modal de Lotes (Cadastro / Edição) ────────────────────────────────────────
function populateProdutosSelect() {
  const sel = document.getElementById("lote-produto");
  if (!sel) return;
  sel.innerHTML = products
    .filter((p) => p.sku.startsWith("EXT")) // Foco em extintores
    .map((p) => `<option value="${p.id_produto}">${escapeHtml(p.nome)} (${escapeHtml(p.sku)})</option>`)
    .join("");
}

function openLoteModal(lote = null) {
  const modal = document.getElementById("modal-lote");
  const title = document.getElementById("modal-lote-title");
  const errorEl = document.getElementById("form-lote-error");
  if (!modal) return;

  errorEl.textContent = "";
  populateProdutosSelect();

  if (lote) {
    title.textContent = `Editar Lote ${lote.id_lote}`;
    document.getElementById("lote-edit-id").value = lote.id_lote;
    document.getElementById("lote-produto").value = lote.id_produto;
    document.getElementById("lote-numero").value = lote.id_lote;
    document.getElementById("lote-numero").readOnly = true;
    document.getElementById("lote-lacre").value = lote.lacre || "";
    document.getElementById("lote-fabricacao").value = lote.data_fabricacao || "";
    document.getElementById("lote-validade").value = lote.validade || "";
    document.getElementById("lote-qtd").value = lote.quantidade_disponivel;
  } else {
    title.textContent = "Cadastrar Novo Lote";
    document.getElementById("lote-edit-id").value = "";
    document.getElementById("lote-numero").value = `LT-2026/${String(lotes.length + 1).padStart(2, "0")}`;
    document.getElementById("lote-numero").readOnly = false;
    document.getElementById("lote-lacre").value = `INM-${Math.floor(100000 + Math.random() * 900000)}`;
    
    // Sugestão padrão: fabricação hoje, validade daqui a 5 anos (1825 dias)
    const hoje = new Date().toISOString().split("T")[0];
    const dVal = new Date();
    dVal.setFullYear(dVal.getFullYear() + 5);
    const valSugerida = dVal.toISOString().split("T")[0];

    document.getElementById("lote-fabricacao").value = hoje;
    document.getElementById("lote-validade").value = valSugerida;
    document.getElementById("lote-qtd").value = "20";
  }

  modal.classList.add("is-open");
}

function closeLoteModal() {
  document.getElementById("modal-lote")?.classList.remove("is-open");
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. VINCULAÇÃO DE EVENTOS E NAVEGAÇÃO
// ═════════════════════════════════════════════════════════════════════════════
function switchTab(tab) {
  currentTab = tab;
  const btnProd = document.getElementById("btn-tab-produtos");
  const btnLotes = document.getElementById("btn-tab-lotes");
  const viewProd = document.getElementById("view-produtos");
  const viewLotes = document.getElementById("view-lotes");

  if (tab === "produtos") {
    btnProd?.classList.add("is-active");
    btnLotes?.classList.remove("is-active");
    if (viewProd) viewProd.style.display = "block";
    if (viewLotes) viewLotes.style.display = "none";
    renderProdutosTable();
  } else {
    btnProd?.classList.remove("is-active");
    btnLotes?.classList.add("is-active");
    if (viewProd) viewProd.style.display = "none";
    if (viewLotes) viewLotes.style.display = "block";
    renderLotesKPIs();
    renderLotesTable();
  }
}

function bindEvents() {
  // Troca de abas
  document.getElementById("btn-tab-produtos")?.addEventListener("click", () => switchTab("produtos"));
  document.getElementById("btn-tab-lotes")?.addEventListener("click", () => switchTab("lotes"));

  // Busca na aba de produtos
  document.getElementById("busca")?.addEventListener("input", (e) => {
    queryProdutos = e.target.value;
    renderProdutosTable();
  });

  // Modal de ajuste de produto
  document.getElementById("btn-cancelar")?.addEventListener("click", closeProductModal);
  document.getElementById("modal")?.addEventListener("click", (e) => {
    if (e.target.id === "modal") closeProductModal();
  });

  document.getElementById("estoque-body")?.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit-product]");
    if (editBtn) {
      const id = Number(editBtn.getAttribute("data-edit-product"));
      const product = products.find((p) => p.id_produto === id);
      if (product) openProductModal(product);
      return;
    }

    const quickDropBtn = e.target.closest("[data-quick-drop]");
    if (quickDropBtn) {
      const id = Number(quickDropBtn.getAttribute("data-quick-drop"));
      const product = products.find((p) => p.id_produto === id);
      if (product) openBaixaRapidaModal(product);
      return;
    }
  });

  document.getElementById("form-estoque")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const editingId = Number(document.getElementById("id_produto").value);
    const qtdAtual = Number(document.getElementById("quantidade_atual").value);
    const estqMin = Number(document.getElementById("estoque_minimo").value);

    if (!Number.isInteger(qtdAtual) || qtdAtual < 0) {
      document.getElementById("form-error").textContent = "Quantidade atual deve ser um inteiro maior ou igual a zero.";
      return;
    }
    if (!Number.isInteger(estqMin) || estqMin < 0) {
      document.getElementById("form-error").textContent = "Estoque mínimo deve ser um inteiro maior ou igual a zero.";
      return;
    }

    const prodOld = products.find((p) => p.id_produto === editingId);
    const oldQty = prodOld ? Number(prodOld.quantidade_atual || 0) : 0;
    const diff = qtdAtual - oldQty;

    products = products.map((p) =>
      p.id_produto === editingId ? { ...p, quantidade_atual: qtdAtual, estoque_minimo: estqMin } : p
    );

    RezFireData.saveProducts(products);

    // Regra de Ouro: Registra movimentação de ajuste no histórico
    if (diff !== 0) {
      if (window.RezFireAPI) {
        try {
          window.RezFireAPI.movimentacoes.ajustarInventario(editingId, qtdAtual).catch(err => {
            console.warn("Falha ao registrar ajuste de inventário no backend:", err);
          });
        } catch (e) {}
      }

      if (RezFireData.loadMovements && RezFireData.saveMovements) {
        const movements = RezFireData.loadMovements();
        const nextMovId = movements.length > 0 ? Math.max(...movements.map((m) => m.id_movimentacao || 0)) + 1 : 1;
        movements.unshift({
          id_movimentacao: nextMovId,
          id_produto: editingId,
          sku: prodOld ? prodOld.sku : "PROD",
          nome_produto: prodOld ? prodOld.nome : "Produto",
          tipo: diff > 0 ? "Entrada" : "Saída",
          motivo: "Ajuste de Balanço / Inventário Físico",
          quantidade: Math.abs(diff),
          preco_unitario: prodOld ? (prodOld.custo || 0) : 0,
          valor_total: (prodOld ? (prodOld.custo || 0) : 0) * Math.abs(diff),
          data: new Date().toISOString(),
          responsavel: "Gestor RezFire (Inventário Físico)",
          fornecedor: null,
          codigo_pedido: `Balanço (${diff > 0 ? '+' : ''}${diff})`,
          detalhes_remessa: null,
        });
        RezFireData.saveMovements(movements);
      }
    }

    if (Number(prodOld?.estoque_minimo) !== estqMin && window.RezFireAPI) {
      window.RezFireAPI.produtos.atualizar(editingId, { estoque_minimo: estqMin }).catch(() => {});
    }

    closeProductModal();
    renderProdutosTable();
  });

  // ── Filtros da aba de Lotes ──
  document.getElementById("busca-lote")?.addEventListener("input", (e) => {
    queryLotes = e.target.value;
    renderLotesTable();
  });

  document.getElementById("filtro-val-status")?.addEventListener("change", (e) => {
    filtroValidadeStatus = e.target.value;
    renderLotesTable();
  });

  document.getElementById("ordem-lote")?.addEventListener("change", (e) => {
    ordemLotes = e.target.value;
    renderLotesTable();
  });

  document.getElementById("btn-limpar-lotes-filtros")?.addEventListener("click", () => {
    queryLotes = "";
    filtroValidadeStatus = "todos";
    ordemLotes = "val_asc";
    const b = document.getElementById("busca-lote");
    const f = document.getElementById("filtro-val-status");
    const o = document.getElementById("ordem-lote");
    if (b) b.value = "";
    if (f) f.value = "todos";
    if (o) o.value = "val_asc";
    renderLotesTable();
  });

  // Modal de Lotes
  document.getElementById("btn-novo-lote")?.addEventListener("click", () => openLoteModal());
  document.getElementById("btn-cancelar-lote")?.addEventListener("click", closeLoteModal);
  document.getElementById("modal-lote")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-lote") closeLoteModal();
  });

  document.getElementById("lotes-body")?.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit-lote]");
    if (editBtn) {
      const idLote = editBtn.getAttribute("data-edit-lote");
      const lote = lotes.find((l) => l.id_lote === idLote);
      if (lote) openLoteModal(lote);
    }
  });

  document.getElementById("form-lote")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const editId = document.getElementById("lote-edit-id").value;
    const prodId = Number(document.getElementById("lote-produto").value);
    const prod = products.find((p) => p.id_produto === prodId);
    const id_lote = document.getElementById("lote-numero").value.trim();
    const lacre = document.getElementById("lote-lacre").value.trim();
    const data_fabricacao = document.getElementById("lote-fabricacao").value;
    const validade = document.getElementById("lote-validade").value;
    const qtd = Number(document.getElementById("lote-qtd").value);

    if (!id_lote || !validade || isNaN(qtd) || qtd < 0) {
      document.getElementById("form-lote-error").textContent = "Preencha todos os campos obrigatórios corretamente.";
      return;
    }

    if (editId) {
      // Edição de lote existente
      const idx = lotes.findIndex((l) => l.id_lote === editId);
      if (idx >= 0) {
        lotes[idx].id_produto = prodId;
        lotes[idx].sku = prod ? prod.sku : lotes[idx].sku;
        lotes[idx].nome = prod ? prod.nome : lotes[idx].nome;
        lotes[idx].lacre = lacre;
        lotes[idx].data_fabricacao = data_fabricacao;
        lotes[idx].validade = validade;
        lotes[idx].quantidade_disponivel = qtd;
      }
    } else {
      // Criação de novo lote
      if (lotes.some((l) => l.id_lote.toUpperCase() === id_lote.toUpperCase())) {
        document.getElementById("form-lote-error").textContent = `O lote ${id_lote} já está cadastrado.`;
        return;
      }

      lotes.unshift({
        id_lote,
        id_produto: prodId,
        sku: prod ? prod.sku : "EXT-GEN",
        nome: prod ? prod.nome : "Extintor",
        lacre,
        data_fabricacao,
        validade,
        quantidade_disponivel: qtd,
        quantidade_inicial: qtd,
      });
    }

    RezFireData.saveLotes(lotes);
    closeLoteModal();
    renderLotesKPIs();
    renderLotesTable();
  });

  // ── Modal de Baixa Rápida (Venda Mercado Livre) ──
  document.getElementById("btn-abrir-baixa-rapida")?.addEventListener("click", () => openBaixaRapidaModal());
  document.getElementById("btn-fechar-baixa-rapida")?.addEventListener("click", closeBaixaRapidaModal);
  document.getElementById("btn-cancelar-baixa")?.addEventListener("click", closeBaixaRapidaModal);
  document.getElementById("modal-baixa-rapida")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-baixa-rapida") closeBaixaRapidaModal();
  });

  document.getElementById("baixa-select-produto")?.addEventListener("change", (e) => {
    const id = Number(e.target.value);
    const prod = products.find((p) => p.id_produto === id);
    if (prod) openBaixaRapidaModal(prod);
  });

  document.getElementById("baixa-qtd")?.addEventListener("input", atualizarPrevisaoBaixa);

  document.getElementById("form-baixa-rapida")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const prodId = Number(document.getElementById("baixa-prod-id").value);
    const qtd = Number(document.getElementById("baixa-qtd").value);
    const codigoMl = document.getElementById("baixa-cod-ml").value.trim();
    const errEl = document.getElementById("form-baixa-error");
    const btnSubmit = document.getElementById("btn-confirmar-baixa-submit");

    if (!prodId || isNaN(qtd) || qtd <= 0) {
      if (errEl) errEl.textContent = "Informe uma quantidade válida maior que zero.";
      return;
    }

    const prod = products.find((p) => p.id_produto === prodId);
    if (!prod) {
      if (errEl) errEl.textContent = "Produto não encontrado.";
      return;
    }

    const info = getProdutoDisponibilidade(prod);
    if (qtd > info.disponivel) {
      if (errEl) errEl.textContent = `Quantidade solicitada (${qtd}) excede o saldo disponível (${info.disponivel}).`;
      return;
    }

    if (errEl) errEl.textContent = "";
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span class="inline-block animate-spin mr-1">⌛</span> Registrando baixa...`;
    }

    try {
      let sucessoBackend = false;
      if (window.RezFireAPI && window.RezFireAPI.movimentacoes && window.RezFireAPI.movimentacoes.baixaRapida) {
        try {
          const res = await window.RezFireAPI.movimentacoes.baixaRapida(prodId, qtd, codigoMl || undefined);
          if (res && res.sucesso) {
            sucessoBackend = true;
          }
        } catch (apiErr) {
          console.warn("Falha na chamada da API de baixa rápida, usando fallback local:", apiErr);
        }
      }

      // Se backend offline ou indisponível, aplica fallback local completo
      if (!sucessoBackend) {
        if (prod.tipo === "Combo") {
          const comboItems = prod.combo_items || [];
          comboItems.forEach((ci) => {
            const compId = ci.id_componente || ci.id_produto;
            const cProd = products.find((p) => p.id_produto === compId);
            if (cProd) {
              const qtdDebitar = (ci.quantidade || 1) * qtd;
              cProd.quantidade_atual = Math.max(0, Number(cProd.quantidade_atual || 0) - qtdDebitar);
            }
          });
        } else {
          prod.quantidade_atual = Math.max(0, Number(prod.quantidade_atual || 0) - qtd);
          let restante = qtd;
          const lotesProd = lotes
            .filter((l) => l.id_produto === prodId)
            .sort((a, b) => new Date(a.validade || 0) - new Date(b.validade || 0));

          for (const l of lotesProd) {
            if (restante <= 0) break;
            const disp = Number(l.quantidade_disponivel || 0);
            if (disp > 0) {
              const debitar = Math.min(disp, restante);
              l.quantidade_disponivel -= debitar;
              restante -= debitar;
            }
          }
          RezFireData.saveLotes(lotes);
        }
        RezFireData.saveProducts(products);

        // Regra de Ouro: Registra movimentação no histórico local
        if (RezFireData.loadMovements && RezFireData.saveMovements) {
          const movs = RezFireData.loadMovements();
          const nextId = movs.length > 0 ? Math.max(...movs.map((m) => m.id_movimentacao || 0)) + 1 : 1;
          movs.unshift({
            id_movimentacao: nextId,
            id_produto: prodId,
            sku: prod.sku,
            nome_produto: prod.nome,
            tipo: "Saída",
            motivo: "Venda Mercado Livre (Baixa Rápida)",
            quantidade: qtd,
            preco_unitario: prod.custo || prod.preco || 0,
            valor_total: (prod.custo || prod.preco || 0) * qtd,
            data: new Date().toISOString(),
            responsavel: "Gestor RezFire (Baixa Rápida)",
            fornecedor: null,
            codigo_pedido: codigoMl ? `ML: ${codigoMl}` : "Venda ML Rápida",
            detalhes_remessa: null,
          });
          RezFireData.saveMovements(movs);
        }
      }

      closeBaixaRapidaModal();
      await recarregarEstoque();
      alert(`✅ Baixa de ${qtd} un. de "${prod.nome}" registrada com sucesso!`);
    } catch (err) {
      console.error("Erro ao registrar baixa rápida:", err);
      if (errEl) errEl.textContent = "Erro ao processar baixa rápida. Verifique os dados.";
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `Confirmar Baixa Imediata`;
      }
    }
  });
}

async function recarregarEstoque() {
  try {
    if (window.RezFireAPI) {
      const res = await window.RezFireAPI.estoque.listar();
      if (res && res.sucesso && Array.isArray(res.estoque) && res.estoque.length > 0) {
        products = res.estoque;
        const todosLotes = [];
        res.estoque.forEach((p) => {
          if (p.lotes && p.lotes.length > 0) {
            p.lotes.forEach((l) => {
              todosLotes.push({
                id_lote: l.numero_lote || `LT-${l.id_lote}`,
                id_lote_db: l.id_lote,
                id_produto: p.id_produto,
                sku: p.sku,
                nome: p.nome,
                lacre: l.numero_lacre_inmetro,
                data_fabricacao: l.data_fabricacao,
                validade: l.data_validade ? String(l.data_validade).split("T")[0] : "",
                quantidade_disponivel: l.quantidade_disponivel,
                fefo_status: l.fefo_status,
                dias_para_vencer: l.dias_para_vencer,
              });
            });
          }
        });
        if (todosLotes.length > 0) lotes = todosLotes;
        else lotes = RezFireData.loadLotes();
      } else {
        products = RezFireData.loadProducts();
        lotes = RezFireData.loadLotes();
      }
    } else {
      products = RezFireData.loadProducts();
      lotes = RezFireData.loadLotes();
    }
  } catch (err) {
    console.warn("Backend não conectado, carregando dados locais:", err);
    products = RezFireData.loadProducts();
    lotes = RezFireData.loadLotes();
  }

  if (currentTab === "produtos") {
    renderProdutosTable();
  } else {
    renderLotesKPIs();
    renderLotesTable();
  }
}

async function init() {
  RezFireLayout.renderSidebar("estoque");
  await recarregarEstoque();
  bindEvents();
}

init();
