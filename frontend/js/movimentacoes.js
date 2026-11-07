/**
 * movimentacoes.js
 * Lógica da página de Movimentações de Estoque & Vendas — RezFire Manager.
 *
 * Separado entre:
 * 1. Entrada de Mercadoria por Nota Fiscal (múltiplos itens, cadastro de lote de extintor);
 * 2. Saída Avulsa não-comercial (Perdas, Avarias, Vencidos, Amostras);
 * 3. Extrato completo integrado com vendas e histórico.
 */

let movements = [];
let products = [];
let allLotes = [];
let allInspecoes = [];
let query = "";
let filterCanal = "todos";
let filterPeriodo = "30";

function formatDate(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function isExtintorProduct(product) {
  if (!product) return false;
  return (
    product.categoria === "Extintores" ||
    (product.sku && product.sku.startsWith("EXT")) ||
    Boolean(product.detalhes_extintor)
  );
}

function getPeriodLabel(period) {
  if (period === "7") return "últimos 7 dias";
  if (period === "30") return "últimos 30 dias";
  if (period === "90") return "últimos 90 dias";
  return "todo o histórico";
}

function getMovementsForPeriod(period) {
  if (period === "todos") return [...movements];
  const days = Number(period);
  const refTime = Date.now() + 60000;
  const dayMs = 86400000;
  const startTime = refTime - days * dayMs;
  return movements.filter((m) => {
    const t = new Date(m.data).getTime();
    return t >= startTime && t <= refTime + dayMs;
  });
}

function renderKPIs() {
  const container = document.getElementById("kpis-movimentacoes-topo");
  if (!container) return;

  const periodMovements = getMovementsForPeriod(filterPeriodo);
  const metrics = RezFireData.computeMovementsMetrics(periodMovements);
  const money = RezFireData.formatMoney;
  const periodLabel = getPeriodLabel(filterPeriodo);

  container.innerHTML = `
    <article class="card kpi-card">
      <p class="kpi-label">SAÍDAS · MERCADO LIVRE</p>
      <p class="kpi-value">${metrics.qtdSaidasML.toLocaleString("pt-BR")} <span style="font-size:0.95rem;font-weight:600;color:#6b6560;">unidades</span></p>
      <p class="kpi-hint">Faturamento: <strong style="color:#1a1412;">${money(metrics.valorSaidasML)}</strong> (${periodLabel})</p>
    </article>
    <article class="card kpi-card">
      <p class="kpi-label">SAÍDAS · VENDA DIRETA</p>
      <p class="kpi-value">${metrics.qtdSaidasDiretas.toLocaleString("pt-BR")} <span style="font-size:0.95rem;font-weight:600;color:#6b6560;">unidades</span></p>
      <p class="kpi-hint">Faturamento: <strong style="color:#1a1412;">${money(metrics.valorSaidasDiretas)}</strong> (${periodLabel})</p>
    </article>
    <article class="card kpi-card">
      <p class="kpi-label">ENTRADAS DE REPOSIÇÃO</p>
      <p class="kpi-value">${metrics.qtdEntradas.toLocaleString("pt-BR")} <span style="font-size:0.95rem;font-weight:600;color:#1f9d5c;">unidades</span></p>
      <p class="kpi-hint">Abastecimento por NF (${periodLabel})</p>
    </article>
    <article class="card kpi-card">
      <p class="kpi-label">TOTAL DE OPERAÇÕES</p>
      <p class="kpi-value">${periodMovements.length} <span style="font-size:0.95rem;font-weight:600;color:#6b6560;">registros</span></p>
      <p class="kpi-hint">Movimentações (${periodLabel})</p>
    </article>
  `;
}

function renderTable() {
  const body = document.getElementById("movimentacoes-body");
  const countEl = document.getElementById("movimentacoes-count");
  const money = RezFireData.formatMoney;
  if (!body) return;

  // 1. Filtro por Período
  let filtered = getMovementsForPeriod(filterPeriodo);

  // 2. Filtro por Canal / Tipo
  if (filterCanal === "Mercado Livre") {
    filtered = filtered.filter((m) => m.canal === "Mercado Livre" || m.motivo.includes("Mercado Livre"));
  } else if (filterCanal === "Venda Direta") {
    filtered = filtered.filter((m) => m.canal === "Venda Direta" || m.motivo.includes("Venda Direta"));
  } else if (filterCanal === "Entrada") {
    filtered = filtered.filter((m) => m.tipo === "Entrada");
  } else if (filterCanal === "Perda") {
    filtered = filtered.filter((m) => m.tipo === "Saída" && !m.canal && !m.motivo.includes("Venda"));
  } else if (filterCanal === "Ajuste") {
    filtered = filtered.filter((m) => m.motivo.includes("Ajuste") || m.motivo.includes("Balanço"));
  }

  // 3. Busca Textual
  if (query) {
    const term = query.toLowerCase();
    filtered = filtered.filter((m) => {
      const prod = products.find((p) => p.id_produto === m.id_produto);
      const prodStr = prod ? `${prod.sku} ${prod.nome}`.toLowerCase() : (m.sku ? `${m.sku} ${m.nome_produto}`.toLowerCase() : "");
      const codPedido = (m.codigo_pedido || "").toLowerCase();
      const clienteStr = (m.cliente || "").toLowerCase();
      const motivoStr = (m.motivo || "").toLowerCase();
      const r = m.detalhes_remessa;
      const remessaStr = r ? `${r.lote || ""} ${r.lacre || ""} ${r.inmetro || ""}`.toLowerCase() : "";

      return (
        prodStr.includes(term) ||
        codPedido.includes(term) ||
        clienteStr.includes(term) ||
        motivoStr.includes(term) ||
        remessaStr.includes(term)
      );
    });
  }

  // Ordena por data decrescente
  filtered.sort((a, b) => new Date(b.data) - new Date(a.data));

  if (countEl) {
    countEl.textContent = `${filtered.length} movimentações no período selecionado`;
  }

  if (!filtered.length) {
    body.innerHTML = `
      <tr class="empty-row">
        <td colspan="7" style="text-align:center;padding:36px;color:var(--muted)">Nenhuma movimentação encontrada para os filtros selecionados.</td>
      </tr>
    `;
    return;
  }

  body.innerHTML = filtered
    .map((m) => {
      const prod = products.find((p) => p.id_produto === m.id_produto);
      const sku = prod ? prod.sku : (m.sku || "PROD");
      const nome = prod ? prod.nome : (m.nome_produto || "Produto");
      const isEntrada = m.tipo === "Entrada";
      const isML = m.canal === "Mercado Livre" || m.motivo.includes("Mercado Livre");
      const isDireto = m.canal === "Venda Direta" || m.motivo.includes("Venda Direta");

      // Badges de Canal/Tipo
      let canalBadge = `<span class="badge-channel" style="background:#e8f8ee;color:#1f9d5c;border:1px solid #bbf7d0;">Entrada / NF</span>`;
      if (isML) {
        canalBadge = `<span class="badge-channel ml">Venda Mercado Livre</span>`;
      } else if (isDireto) {
        canalBadge = `<span class="badge-channel direto">Venda Direta / B2B</span>`;
      } else if (!isEntrada) {
        canalBadge = `<span class="badge-channel" style="background:#fee2e2;color:#991b1b;border:1px solid #fecaca;">${m.motivo}</span>`;
      }

      // Detalhes de Remessa / Lote de Extintores
      const r = m.detalhes_remessa;
      const temRemessa = r && (r.lote || r.validade || r.lacre || r.inmetro);

      // Verificação de Inspeção de Qualidade vinculada (SCRUM-11 / #6)
      const inspVinculada = allInspecoes.find((i) =>
        (m.id_movimentacao && i.id_movimentacao === m.id_movimentacao) ||
        (i.id_produto === m.id_produto && r && r.lote && (i.numero_lote === r.lote || i.id_lote === r.lote)) ||
        (m.inspecao && i.id_inspecao === m.inspecao.id_inspecao)
      );

      const valorUnit = m.preco_unitario ? money(m.preco_unitario) : "-";
      const valorTotal = m.valor_total ? money(m.valor_total) : (m.preco_unitario ? money(m.preco_unitario * m.quantidade) : "-");

      return `
        <tr>
          <td>
            <span class="text-xs text-stone-700 font-semibold whitespace-nowrap">${formatDate(m.data)}</span>
          </td>
          <td>
            <div class="flex flex-col">
              <span class="sku-main">${sku}</span>
              <span class="sku-sub">${nome}</span>
              ${temRemessa ? `
                <div style="margin-top:3px;font-size:0.72rem;color:#78716c;font-family:monospace">
                  ${r.lote ? `Lote: <strong>${r.lote}</strong> ` : ""}
                  ${r.lacre ? `· Lacre: ${r.lacre} ` : ""}
                  ${r.validade ? `· Val: ${formatDateOnly(r.validade)}` : ""}
                </div>
              ` : ""}
            </div>
          </td>
          <td>
            <div class="flex flex-col gap-1 items-start">
              <span class="status-pill ${isEntrada ? 'on' : ''}" style="${isEntrada ? 'background:#dcfce7;color:#166534;' : 'background:#fee2e2;color:#991b1b;'}">
                ${m.tipo}
              </span>
              <span class="text-xs text-stone-600 font-medium">${m.motivo}</span>
              ${inspVinculada ? `
                <button type="button" class="btn-ver-laudo-insp" data-insp-id="${inspVinculada.id_inspecao}" style="margin-top:3px;font-size:0.7rem;padding:2px 8px;border-radius:12px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;${inspVinculada.resultado === 'Aprovado' ? 'background:#ecfdf5;color:#047857;border:1px solid #a7f3d0' : (inspVinculada.resultado === 'Reprovado' ? 'background:#fef2f2;color:#b91c1c;border:1px solid #fecaca' : 'background:#fffbeb;color:#b45309;border:1px solid #fde68a')}">
                  🛡️ Laudo: ${inspVinculada.resultado} (${inspVinculada.quantidade_aprovada}/${inspVinculada.quantidade_total} un.)
                </button>
              ` : ""}
            </div>
          </td>
          <td>
            <div class="flex flex-col">
              ${m.codigo_pedido ? `<strong style="font-family:monospace;font-size:0.85rem">${m.codigo_pedido}</strong>` : `<span style="color:var(--muted)">${m.fornecedor || "—"}</span>`}
              ${m.cliente ? `<span class="text-xs text-stone-600">${m.cliente} (${m.uf || "SP"})</span>` : ""}
            </div>
          </td>
          <td style="text-align:center">
            <strong style="font-size:1rem;color:${isEntrada ? '#166534' : '#991b1b'}">
              ${isEntrada ? '+' : '-'}${m.quantidade}
            </strong>
          </td>
          <td>
            <div class="flex flex-col">
              <strong>${valorTotal}</strong>
              <span class="text-xs text-stone-500">Un: ${valorUnit}</span>
            </div>
          </td>
          <td>
            <span class="text-xs text-stone-600">${m.responsavel || "Gestor RezFire"}</span>
          </td>
        </tr>
      `;
    })
    .join("");

  body.querySelectorAll(".btn-ver-laudo-insp").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const inspId = Number(btn.getAttribute("data-insp-id"));
      abrirLaudoInspecao(inspId);
    });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. MODAL DE ENTRADA POR NOTA FISCAL (COMPRA / REABASTECIMENTO)
// ═════════════════════════════════════════════════════════════════════════════
let nfItems = [];

function createNfItemRow(itemIndex) {
  const prodsOptions = products
    .filter((p) => p.tipo !== "Combo") // Apenas itens físicos podem entrar por NF
    .map((p) => `<option value="${p.id_produto}">${p.sku} - ${p.nome}</option>`)
    .join("");

  return `
    <div class="nf-item-row" data-item-idx="${itemIndex}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong style="font-size:0.82rem;color:var(--ink)">Item #${itemIndex + 1}</strong>
        ${itemIndex > 0 ? `<button type="button" class="btn-ghost btn-remove-nf-item" data-remove-idx="${itemIndex}" style="color:var(--down);font-size:0.75rem;padding:2px 6px">✕ Remover</button>` : ""}
      </div>
      <div class="form-grid">
        <div class="form-field span-2">
          <label>Produto Catalogado *</label>
          <select class="search-input nf-item-prod" data-item-idx="${itemIndex}" style="width:100%" required>
            <option value="">— Selecione o produto —</option>
            ${prodsOptions}
          </select>
        </div>
        <div class="form-field">
          <label>Quantidade Recebida *</label>
          <input type="number" min="1" step="1" value="10" class="search-input nf-item-qtd" data-item-idx="${itemIndex}" required />
        </div>
        <div class="form-field">
          <label>Custo Unitário (R$)</label>
          <input type="number" step="0.01" min="0" placeholder="0.00" class="search-input nf-item-custo" data-item-idx="${itemIndex}" />
        </div>
      </div>

      <!-- Campos de Lote para Extintores -->
      <div class="nf-extintor-lote-wrap" id="nf-lote-wrap-${itemIndex}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px dashed #d1d5db">
        <div style="font-size:0.75rem;font-weight:700;color:var(--accent);margin-bottom:6px">
          🧯 Dados da Remessa do Extintor (Lote &amp; Validade)
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Código do Lote *</label>
            <input placeholder="Ex: LT-2026/05" class="search-input nf-item-lote" data-item-idx="${itemIndex}" />
          </div>
          <div class="form-field">
            <label>Lacre / Selo INMETRO</label>
            <input placeholder="Ex: INM-849201" class="search-input nf-item-lacre" data-item-idx="${itemIndex}" />
          </div>
          <div class="form-field">
            <label>Data de Validade / Carga *</label>
            <input type="date" class="search-input nf-item-validade" data-item-idx="${itemIndex}" />
          </div>
        </div>
      </div>

      <!-- Checklist de Inspeção de Qualidade na Entrada (SCRUM-11 / #6) -->
      <div class="nf-inspecao-wrap" id="nf-inspecao-wrap-${itemIndex}" style="display:none;margin-top:12px;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:0.78rem;font-weight:700;color:#166534;display:flex;align-items:center;gap:6px">
            <span>🛡️ Checklist de Inspeção Física na Entrada (Conformidade INMETRO)</span>
          </div>
          <span class="badge-inspecao-status" id="badge-inspecao-${itemIndex}" style="font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:12px;background:#dcfce7;color:#166534;border:1px solid #86efac">
            100% Conforme
          </span>
        </div>
        <p style="font-size:0.74rem;color:#15803d;margin-bottom:10px">
          Conferência física obrigatória de extintores. Unidades reprovadas no checklist NÃO entram no estoque disponível para venda.
        </p>

        <!-- 5 itens do checklist -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;font-size:0.78rem">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:#fff;padding:6px 10px;border-radius:4px;border:1px solid #e2e8f0">
            <input type="checkbox" checked class="chk-insp-item chk-insp-casco" data-item-idx="${itemIndex}" style="width:16px;height:16px;accent-color:#16a34a" />
            <span><strong>Casco:</strong> Sem amassados/avarias</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:#fff;padding:6px 10px;border-radius:4px;border:1px solid #e2e8f0">
            <input type="checkbox" checked class="chk-insp-item chk-insp-corrosao" data-item-idx="${itemIndex}" style="width:16px;height:16px;accent-color:#16a34a" />
            <span><strong>Pintura:</strong> Sem corrosão/ferrugem</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:#fff;padding:6px 10px;border-radius:4px;border:1px solid #e2e8f0">
            <input type="checkbox" checked class="chk-insp-item chk-insp-rotulo" data-item-idx="${itemIndex}" style="width:16px;height:16px;accent-color:#16a34a" />
            <span><strong>Rótulo:</strong> Legível com classe</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:#fff;padding:6px 10px;border-radius:4px;border:1px solid #e2e8f0">
            <input type="checkbox" checked class="chk-insp-item chk-insp-manometro" data-item-idx="${itemIndex}" style="width:16px;height:16px;accent-color:#16a34a" />
            <span><strong>Manômetro:</strong> Faixa verde</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:#fff;padding:6px 10px;border-radius:4px;border:1px solid #e2e8f0">
            <input type="checkbox" checked class="chk-insp-item chk-insp-lacre" data-item-idx="${itemIndex}" style="width:16px;height:16px;accent-color:#16a34a" />
            <span><strong>Lacre:</strong> INMETRO íntegro</span>
          </label>
        </div>

        <!-- Painel de Reprovação (exibido caso algum item seja desmarcado) -->
        <div class="painel-reprovacao" id="painel-reprovacao-${itemIndex}" style="display:none;margin-top:10px;padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px">
          <div style="font-size:0.75rem;font-weight:700;color:#991b1b;margin-bottom:6px">
            ⚠️ Registro de Não-Conformidade / Reprovação Física
          </div>
          <div class="form-grid">
            <div class="form-field">
              <label style="color:#991b1b">Qtd. de Unidades Reprovadas *</label>
              <input type="number" min="1" step="1" value="1" class="search-input nf-item-qtd-reprovada" data-item-idx="${itemIndex}" style="border-color:#fca5a5" />
            </div>
            <div class="form-field">
              <label style="color:#991b1b">Destino dos Itens Reprovados *</label>
              <select class="search-input nf-item-destino-reprovados" data-item-idx="${itemIndex}" style="border-color:#fca5a5">
                <option value="Devolucao Fornecedor">Devolução ao Fornecedor</option>
                <option value="Descarte">Descarte / Sucata</option>
                <option value="Quarentena">Quarentena / Análise Técnica</option>
              </select>
            </div>
            <div class="form-field span-2">
              <label style="color:#991b1b">Motivo / Descrição da Não-Conformidade *</label>
              <input placeholder="Ex: Manômetro com perda de pressão / sem gás propelente" class="search-input nf-item-motivo-reprovacao" data-item-idx="${itemIndex}" style="border-color:#fca5a5" />
            </div>
          </div>
          <p style="font-size:0.72rem;color:#b91c1c;margin-top:6px;margin-bottom:0">
            ℹ️ As unidades reprovadas serão bloqueadas e NÃO entrarão no estoque vendível. Apenas as unidades conformes serão liberadas para venda.
          </p>
        </div>
      </div>
    </div>
  `;
}

function atualizarStatusInspecao(idx) {
  const container = document.getElementById("nf-itens-container");
  if (!container) return;
  const row = container.querySelector(`.nf-item-row[data-item-idx="${idx}"]`);
  if (!row) return;

  const cCasco = row.querySelector(`.chk-insp-casco`)?.checked ?? true;
  const cCorrosao = row.querySelector(`.chk-insp-corrosao`)?.checked ?? true;
  const cRotulo = row.querySelector(`.chk-insp-rotulo`)?.checked ?? true;
  const cManometro = row.querySelector(`.chk-insp-manometro`)?.checked ?? true;
  const cLacre = row.querySelector(`.chk-insp-lacre`)?.checked ?? true;

  const todos = cCasco && cCorrosao && cRotulo && cManometro && cLacre;
  const badge = row.querySelector(`#badge-inspecao-${idx}`);
  const painel = row.querySelector(`#painel-reprovacao-${idx}`);
  const motivoInput = row.querySelector(`.nf-item-motivo-reprovacao`);
  const qtdReprovadaInput = row.querySelector(`.nf-item-qtd-reprovada`);

  if (todos) {
    if (badge) {
      badge.textContent = "100% Conforme";
      badge.style.background = "#dcfce7";
      badge.style.color = "#166534";
      badge.style.borderColor = "#86efac";
    }
    if (painel) painel.style.display = "none";
  } else {
    if (badge) {
      badge.textContent = "⚠️ Não Conforme";
      badge.style.background = "#fef2f2";
      badge.style.color = "#991b1b";
      badge.style.borderColor = "#fca5a5";
    }
    if (painel) {
      painel.style.display = "block";
      if (motivoInput && !motivoInput.value) {
        const falhas = [];
        if (!cCasco) falhas.push("amassado/avaria no casco");
        if (!cCorrosao) falhas.push("corrosão/ferrugem");
        if (!cRotulo) falhas.push("rótulo ilegível");
        if (!cManometro) falhas.push("manômetro com perda de pressão");
        if (!cLacre) falhas.push("lacre/selo Inmetro rompido ou ausente");
        motivoInput.value = `Reprovado no checklist: ${falhas.join(", ")}`;
      }
      if (qtdReprovadaInput && (!qtdReprovadaInput.value || Number(qtdReprovadaInput.value) <= 0)) {
        qtdReprovadaInput.value = "1";
      }
    }
  }
}

function renderNfItems() {
  const container = document.getElementById("nf-itens-container");
  if (!container) return;

  container.innerHTML = nfItems.map((_, idx) => createNfItemRow(idx)).join("");

  // Vincula evento de mudança no select de produto para exibir campos de lote e inspeção se for extintor
  container.querySelectorAll(".nf-item-prod").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const idx = Number(e.target.getAttribute("data-item-idx"));
      const pId = Number(e.target.value);
      const prod = products.find((p) => p.id_produto === pId);
      const loteWrap = document.getElementById(`nf-lote-wrap-${idx}`);
      const inspWrap = document.getElementById(`nf-inspecao-wrap-${idx}`);

      if (prod && isExtintorProduct(prod)) {
        if (loteWrap) loteWrap.style.display = "block";
        if (inspWrap) inspWrap.style.display = "block";
        // Preenche sugestão de validade (5 anos à frente)
        const dVal = new Date();
        dVal.setFullYear(dVal.getFullYear() + 5);
        const valInput = container.querySelector(`.nf-item-validade[data-item-idx="${idx}"]`);
        if (valInput && !valInput.value) valInput.value = dVal.toISOString().split("T")[0];
      } else {
        if (loteWrap) loteWrap.style.display = "none";
        if (inspWrap) inspWrap.style.display = "none";
      }

      // Preenche custo do produto
      if (prod) {
        const custoInput = container.querySelector(`.nf-item-custo[data-item-idx="${idx}"]`);
        if (custoInput && !custoInput.value) custoInput.value = prod.custo || "";
      }
    });
  });

  // Vincula mudanças nos checkboxes do checklist de inspeção
  container.querySelectorAll(".chk-insp-item").forEach((chk) => {
    chk.addEventListener("change", (e) => {
      const idx = Number(e.target.getAttribute("data-item-idx"));
      atualizarStatusInspecao(idx);
    });
  });

  // Remover item
  container.querySelectorAll(".btn-remove-nf-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.target.getAttribute("data-remove-idx"));
      if (nfItems.length > 1) {
        nfItems.splice(idx, 1);
        renderNfItems();
      }
    });
  });
}

function openEntradaModal() {
  const modal = document.getElementById("modal-entrada");
  if (!modal) return;

  document.getElementById("form-entrada-error").textContent = "";
  document.getElementById("nf-numero").value = `NF-e ${Math.floor(100000 + Math.random() * 900000)}`;
  document.getElementById("nf-fornecedor").value = "Mocelin Equipamentos de Segurança";

  // Data atual pré-preenchida
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  document.getElementById("nf-data").value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  nfItems = [{}];
  renderNfItems();

  modal.classList.add("is-open");
}

function closeEntradaModal() {
  document.getElementById("modal-entrada")?.classList.remove("is-open");
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. MODAL DE SAÍDA AVULSA (PERDA / AVARIA / DESCARTE)
// ═════════════════════════════════════════════════════════════════════════════
function openSaidaModal() {
  const modal = document.getElementById("modal-saida");
  if (!modal) return;

  document.getElementById("form-saida-error").textContent = "";
  const prodSelect = document.getElementById("saida-produto");
  prodSelect.innerHTML = `<option value="">— Selecione o produto —</option>` +
    products
      .filter((p) => p.tipo !== "Combo")
      .map((p) => `<option value="${p.id_produto}">${p.sku} - ${p.nome} (Saldo: ${p.quantidade_atual})</option>`)
      .join("");

  document.getElementById("saida-qtd").value = "1";
  document.getElementById("saida-obs").value = "";
  document.getElementById("wrap-saida-lote").style.display = "none";

  modal.classList.add("is-open");
}

function closeSaidaModal() {
  document.getElementById("modal-saida")?.classList.remove("is-open");
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. VINCULAÇÃO DE EVENTOS E SUBMISSÕES
// ═════════════════════════════════════════════════════════════════════════════
function bindEvents() {
  // Filtros de busca e período
  document.getElementById("busca")?.addEventListener("input", (e) => {
    query = e.target.value;
    renderTable();
  });

  document.getElementById("filtro-mov-canal")?.addEventListener("change", (e) => {
    filterCanal = e.target.value;
    renderTable();
  });

  document.getElementById("filtro-mov-periodo")?.addEventListener("change", (e) => {
    filterPeriodo = e.target.value;
    renderKPIs();
    renderTable();
  });

  // Botões de abertura de modal
  document.getElementById("btn-nova-entrada")?.addEventListener("click", openEntradaModal);
  document.getElementById("btn-cancelar-entrada")?.addEventListener("click", closeEntradaModal);
  document.getElementById("modal-entrada")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-entrada") closeEntradaModal();
  });

  // Botões de Inspeção de Qualidade (SCRUM-11 / #6)
  document.getElementById("btn-ver-inspecoes")?.addEventListener("click", openInspecoesModal);
  document.getElementById("btn-fechar-inspecoes-lista")?.addEventListener("click", closeInspecoesModal);
  document.getElementById("modal-inspecoes-lista")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-inspecoes-lista") closeInspecoesModal();
  });
  document.getElementById("btn-fechar-inspecao-detalhe")?.addEventListener("click", closeInspecaoDetalheModal);
  document.getElementById("modal-inspecao-detalhe")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-inspecao-detalhe") closeInspecaoDetalheModal();
  });

  document.getElementById("btn-add-nf-item")?.addEventListener("click", () => {
    nfItems.push({});
    renderNfItems();
  });

  document.getElementById("btn-nova-saida")?.addEventListener("click", openSaidaModal);
  document.getElementById("btn-cancelar-saida")?.addEventListener("click", closeSaidaModal);
  document.getElementById("modal-saida")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-saida") closeSaidaModal();
  });

  // Atualizar lotes no modal de saída se o produto for extintor
  document.getElementById("saida-produto")?.addEventListener("change", (e) => {
    const pId = Number(e.target.value);
    const prod = products.find((p) => p.id_produto === pId);
    const wrapLote = document.getElementById("wrap-saida-lote");
    const loteSelect = document.getElementById("saida-lote");

    if (prod && isExtintorProduct(prod)) {
      const lotesProd = allLotes.filter((l) => l.id_produto === pId);
      if (lotesProd.length > 0) {
        loteSelect.innerHTML = `<option value="">— Selecione o lote afetado —</option>` +
          lotesProd.map((l) => `<option value="${l.id_lote}">${l.numero_lote || l.id_lote} (Disp: ${l.quantidade_disponivel} un. · Val: ${formatDateOnly(l.data_validade || l.validade)})</option>`).join("");
      } else {
        const lotesLocal = window.RezFireData ? window.RezFireData.loadLotes().filter((l) => l.id_produto === pId) : [];
        loteSelect.innerHTML = `<option value="">— Selecione o lote afetado —</option>` +
          lotesLocal.map((l) => `<option value="${l.id_lote}">${l.id_lote} (Disp: ${l.quantidade_disponivel} un. · Val: ${l.validade})</option>`).join("");
      }
      wrapLote.style.display = "block";
    } else {
      wrapLote.style.display = "none";
    }
  });

  // Submissão do Formulário de Entrada (Nota Fiscal)
  document.getElementById("form-entrada")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("form-entrada-error");
    const submitBtn = e.target.querySelector("button[type='submit']");
    errorEl.textContent = "";

    const nfNumero = document.getElementById("nf-numero").value.trim();
    const fornecedor = document.getElementById("nf-fornecedor").value.trim();
    const dataIso = new Date(document.getElementById("nf-data").value).toISOString();

    const container = document.getElementById("nf-itens-container");
    const itemRows = container.querySelectorAll(".nf-item-row");

    const itensParaSalvar = [];
    for (const row of itemRows) {
      const prodId = Number(row.querySelector(".nf-item-prod")?.value);
      const qtd = Number(row.querySelector(".nf-item-qtd")?.value);
      const custo = Number(row.querySelector(".nf-item-custo")?.value || 0);

      if (!prodId) {
        errorEl.textContent = "Selecione o produto para todos os itens da Nota Fiscal.";
        return;
      }
      if (!qtd || qtd <= 0) {
        errorEl.textContent = "A quantidade deve ser maior que zero em todos os itens.";
        return;
      }

      const prod = products.find((p) => p.id_produto === prodId);
      const isExt = prod && isExtintorProduct(prod);

      let lote = null;
      let lacre = null;
      let validade = null;

      let inspecao = null;

      if (isExt) {
        lote = row.querySelector(".nf-item-lote")?.value.trim() || `LT-${new Date().getFullYear()}/${Math.floor(10 + Math.random() * 90)}`;
        lacre = row.querySelector(".nf-item-lacre")?.value.trim() || `INM-${Math.floor(100000 + Math.random() * 900000)}`;
        validade = row.querySelector(".nf-item-validade")?.value || new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split("T")[0];

        const cCasco = row.querySelector(".chk-insp-casco")?.checked ?? true;
        const cCorrosao = row.querySelector(".chk-insp-corrosao")?.checked ?? true;
        const cRotulo = row.querySelector(".chk-insp-rotulo")?.checked ?? true;
        const cManometro = row.querySelector(".chk-insp-manometro")?.checked ?? true;
        const cLacre = row.querySelector(".chk-insp-lacre")?.checked ?? true;
        const todosConformes = cCasco && cCorrosao && cRotulo && cManometro && cLacre;

        let qtdReprovada = 0;
        let motivoReprovacao = null;
        let destinoReprovados = null;

        if (!todosConformes) {
          qtdReprovada = Number(row.querySelector(".nf-item-qtd-reprovada")?.value || 1);
          motivoReprovacao = row.querySelector(".nf-item-motivo-reprovacao")?.value.trim() || "Não-conformidade detectada no checklist de entrada";
          destinoReprovados = row.querySelector(".nf-item-destino-reprovados")?.value || "Devolucao Fornecedor";

          if (qtdReprovada > qtd) {
            errorEl.textContent = `A quantidade reprovada (${qtdReprovada}) não pode ser maior que a recebida (${qtd}) no produto ${prod?.sku}.`;
            return;
          }
        }

        inspecao = {
          checklist: {
            avarias_casco: cCasco,
            sem_corrosao: cCorrosao,
            rotulo_legivel: cRotulo,
            manometro_pressao: cManometro,
            lacre_acessorios: cLacre,
          },
          quantidade_reprovada: qtdReprovada,
          motivo_reprovacao: motivoReprovacao,
          destino_reprovados: destinoReprovados,
          responsavel: "Gestor RezFire",
          observacoes: `Inspeção de qualidade na entrada da ${nfNumero} (${fornecedor})`,
        };
      }

      itensParaSalvar.push({
        id_produto: prodId,
        sku: prod?.sku,
        nome_produto: prod?.nome,
        quantidade: qtd,
        custo,
        isExt,
        lote,
        lacre,
        validade,
        inspecao,
      });
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Gravando no Banco...";
    }

    try {
      if (window.RezFireAPI) {
        for (const item of itensParaSalvar) {
          const payload = {
            id_produto: item.id_produto,
            tipo: "Entrada",
            quantidade: item.quantidade,
            motivo: `Entrada por Nota Fiscal - ${nfNumero} (${fornecedor})`,
            novo_lote: item.isExt && item.lote ? {
              numero_lote: item.lote,
              numero_lacre_inmetro: item.lacre || undefined,
              data_fabricacao: dataIso.split("T")[0],
              data_validade: item.validade,
            } : undefined,
            inspecao: item.inspecao,
          };

          await window.RezFireAPI.movimentacoes.registrar(payload);

          // Se informou custo de aquisição, atualiza cadastro do produto
          if (item.custo > 0) {
            window.RezFireAPI.produtos.atualizar(item.id_produto, { custo: item.custo }).catch(() => {});
          }
        }
      } else {
        // Fallback local se API offline
        for (const item of itensParaSalvar) {
          const prod = products.find((p) => p.id_produto === item.id_produto);
          const qtdReprovada = item.inspecao ? Number(item.inspecao.quantidade_reprovada || 0) : 0;
          const qtdAprovada = Math.max(0, item.quantidade - qtdReprovada);

          // Critério de Aceite 2: item reprovado impede que entre no estoque disponível
          if (prod) {
            prod.quantidade_atual = Number(prod.quantidade_atual || 0) + qtdAprovada;
          }

          if (item.isExt && window.RezFireData) {
            const inspecoesList = window.RezFireData.loadInspecoes();
            const nextId = inspecoesList.length > 0 ? Math.max(...inspecoesList.map((i) => i.id_inspecao || 0)) + 1 : 1;
            const novaInsp = {
              id_inspecao: nextId,
              id_produto: item.id_produto,
              sku: item.sku,
              nome_produto: item.nome_produto,
              id_lote: item.lote,
              numero_lote: item.lote,
              tipo_inspecao: "Entrada",
              checklist: item.inspecao.checklist,
              resultado: qtdAprovada === 0 ? "Reprovado" : (qtdReprovada > 0 ? "Aprovado Parcial" : "Aprovado"),
              quantidade_total: item.quantidade,
              quantidade_aprovada: qtdAprovada,
              quantidade_reprovada: qtdReprovada,
              motivo_reprovacao: item.inspecao.motivo_reprovacao,
              destino_reprovados: item.inspecao.destino_reprovados,
              observacoes: item.inspecao.observacoes,
              responsavel: item.inspecao.responsavel,
              data_inspecao: dataIso,
            };
            inspecoesList.unshift(novaInsp);
            window.RezFireData.saveInspecoes(inspecoesList);
            allInspecoes.unshift(novaInsp);
          }

          let nextMovId = movements.length > 0 ? Math.max(...movements.map((m) => m.id_movimentacao || 0)) + 1 : 1;
          movements.unshift({
            id_movimentacao: nextMovId,
            id_produto: item.id_produto,
            sku: item.sku,
            nome_produto: item.nome_produto,
            tipo: "Entrada",
            motivo: `Entrada por Nota Fiscal - ${nfNumero} (${fornecedor})${item.inspecao ? ` [Inspeção: ${qtdAprovada}/${item.quantidade} un. liberadas]` : ''}`,
            quantidade: qtdAprovada,
            preco_unitario: item.custo || 0,
            valor_total: (item.custo || 0) * qtdAprovada,
            data: dataIso,
            responsavel: "Gestor RezFire",
            codigo_pedido: nfNumero,
            detalhes_remessa: item.lote ? { lote: item.lote, lacre: item.lacre, validade: item.validade } : null,
          });

          if (window.RezFireData) {
            window.RezFireData.saveProducts(products);
            window.RezFireData.saveMovements(movements);
          }
        }
      }

      await recarregarDados();
      closeEntradaModal();
      alert(`Entrada de ${itensParaSalvar.length} produto(s) pela ${nfNumero} registrada com sucesso!`);
    } catch (err) {
      console.error("[Movimentações API] Erro na entrada:", err);
      errorEl.textContent = err.message || "Erro ao gravar movimentação no banco MySQL.";
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Concluir Entrada no Estoque";
      }
    }
  });

  // Submissão do Formulário de Saída Avulsa
  document.getElementById("form-saida")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("form-saida-error");
    const submitBtn = e.target.querySelector("button[type='submit']");
    errorEl.textContent = "";

    const prodId = Number(document.getElementById("saida-produto").value);
    const motivo = document.getElementById("saida-motivo").value;
    const qtd = Number(document.getElementById("saida-qtd").value);
    const idLote = document.getElementById("saida-lote")?.value;
    const obs = document.getElementById("saida-obs").value.trim();

    if (!prodId) {
      errorEl.textContent = "Selecione o produto.";
      return;
    }
    if (!qtd || qtd <= 0) {
      errorEl.textContent = "A quantidade deve ser maior que zero.";
      return;
    }

    const prod = products.find((p) => p.id_produto === prodId);
    if (prod && Number(prod.quantidade_atual || 0) < qtd) {
      errorEl.textContent = `Saldo insuficiente para baixa! Disponível: ${prod.quantidade_atual}.`;
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Registrando Baixa...";
    }

    try {
      if (window.RezFireAPI) {
        const payload = {
          id_produto: prodId,
          tipo: "Saída",
          quantidade: qtd,
          motivo: `Baixa Operacional: ${motivo}${obs ? ' - ' + obs : ''}`,
          id_lote: idLote ? Number(idLote) : undefined,
        };

        await window.RezFireAPI.movimentacoes.registrar(payload);
      } else {
        // Fallback local se API offline
        const agoraIso = new Date().toISOString();
        let nextMovId = movements.length > 0 ? Math.max(...movements.map((m) => m.id_movimentacao || 0)) + 1 : 1;
        movements.unshift({
          id_movimentacao: nextMovId,
          id_produto: prodId,
          sku: prod ? prod.sku : "PROD",
          nome_produto: prod ? prod.nome : "Produto",
          tipo: "Saída",
          motivo: `Baixa Operacional: ${motivo}`,
          quantidade: qtd,
          preco_unitario: prod ? (prod.custo || 0) : 0,
          valor_total: (prod ? (prod.custo || 0) : 0) * qtd,
          data: agoraIso,
          responsavel: "Gestor RezFire",
          codigo_pedido: obs ? `Obs: ${obs}` : "Baixa Interna",
          detalhes_remessa: idLote ? { lote: idLote } : null,
        });
        if (window.RezFireData) {
          window.RezFireData.saveMovements(movements);
        }
      }

      await recarregarDados();
      closeSaidaModal();
      alert(`Saída de ${qtd} un. do produto ${prod ? prod.sku : ''} registrada com sucesso no MySQL!`);
    } catch (err) {
      console.error("[Movimentações API] Erro na saída:", err);
      errorEl.textContent = err.message || "Erro ao registrar saída de estoque.";
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirmar Baixa de Estoque";
      }
    }
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. INSPEÇÃO DE QUALIDADE DE ENTRADA (MODAIS & LAUDOS)
// ═════════════════════════════════════════════════════════════════════════════
function openInspecoesModal() {
  const modal = document.getElementById("modal-inspecoes-lista");
  if (!modal) return;
  renderInspecoesModal();
  modal.classList.add("is-open");
}

function closeInspecoesModal() {
  document.getElementById("modal-inspecoes-lista")?.classList.remove("is-open");
}

function closeInspecaoDetalheModal() {
  document.getElementById("modal-inspecao-detalhe")?.classList.remove("is-open");
}

function renderInspecoesModal() {
  const modal = document.getElementById("modal-inspecoes-lista");
  const kpiWrap = document.getElementById("inspecoes-kpis-wrap");
  const tableBody = document.getElementById("inspecoes-table-body");
  if (!modal || !tableBody) return;

  const total = allInspecoes.length;
  const aprovadas = allInspecoes.filter((i) => i.resultado === "Aprovado").length;
  const parciais = allInspecoes.filter((i) => i.resultado === "Aprovado Parcial").length;
  const reprovadas = allInspecoes.filter((i) => i.resultado === "Reprovado").length;

  const totalInspecionado = allInspecoes.reduce((s, i) => s + (Number(i.quantidade_total) || 0), 0);
  const totalAprovado = allInspecoes.reduce((s, i) => s + (Number(i.quantidade_aprovada) || 0), 0);
  const totalReprovado = allInspecoes.reduce((s, i) => s + (Number(i.quantidade_reprovada) || 0), 0);
  const taxaConformidade = totalInspecionado > 0 ? ((totalAprovado / totalInspecionado) * 100).toFixed(1) : "100.0";

  if (kpiWrap) {
    kpiWrap.innerHTML = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">
        <div style="font-size:0.72rem;font-weight:700;color:#64748b;text-transform:uppercase">Total Inspecionado</div>
        <div style="font-size:1.3rem;font-weight:800;color:#1e293b">${totalInspecionado} un.</div>
        <div style="font-size:0.75rem;color:#64748b">${total} remessas avaliadas</div>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px">
        <div style="font-size:0.72rem;font-weight:700;color:#166534;text-transform:uppercase">Aprovadas p/ Venda</div>
        <div style="font-size:1.3rem;font-weight:800;color:#166534">${totalAprovado} un.</div>
        <div style="font-size:0.75rem;color:#15803d">Conformidade: ${taxaConformidade}%</div>
      </div>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px">
        <div style="font-size:0.72rem;font-weight:700;color:#991b1b;text-transform:uppercase">Reprovadas / Bloqueadas</div>
        <div style="font-size:1.3rem;font-weight:800;color:#991b1b">${totalReprovado} un.</div>
        <div style="font-size:0.75rem;color:#b91c1c">${reprovadas + parciais} ocorrência(s)</div>
      </div>
    `;
  }

  if (!allInspecoes.length) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted)">Nenhuma inspeção de qualidade registrada ainda.</td></tr>`;
    return;
  }

  tableBody.innerHTML = allInspecoes.map((insp) => {
    const prod = products.find((p) => p.id_produto === insp.id_produto) || { sku: insp.sku || "EXT", nome: insp.nome_produto || "Extintor" };
    const chk = insp.checklist || {};
    const icon = (val) => val ? `<span style="color:#16a34a;font-weight:bold" title="Conforme">✓</span>` : `<span style="color:#dc2626;font-weight:bold" title="Não Conforme">✕</span>`;

    let badgeStyle = "background:#dcfce7;color:#166534;border:1px solid #86efac";
    if (insp.resultado === "Reprovado") badgeStyle = "background:#fee2e2;color:#991b1b;border:1px solid #fca5a5";
    else if (insp.resultado === "Aprovado Parcial") badgeStyle = "background:#fef3c7;color:#92400e;border:1px solid #fcd34d";

    return `
      <tr>
        <td style="font-size:0.78rem;font-family:monospace">${formatDate(insp.data_inspecao)}</td>
        <td>
          <div style="display:flex;flex-direction:column">
            <span class="sku-main">${prod.sku}</span>
            <span class="sku-sub">${prod.nome}</span>
          </div>
        </td>
        <td style="font-family:monospace;font-size:0.8rem">
          <strong>${insp.numero_lote || insp.id_lote || "—"}</strong>
        </td>
        <td style="font-size:0.82rem;letter-spacing:1px">
          <span title="Casco">${icon(chk.avarias_casco)} Casco</span> ·
          <span title="Pintura">${icon(chk.sem_corrosao)} Pint</span> ·
          <span title="Rótulo">${icon(chk.rotulo_legivel)} Rót</span> ·
          <span title="Manômetro">${icon(chk.manometro_pressao)} Man</span> ·
          <span title="Lacre">${icon(chk.lacre_acessorios)} Lac</span>
        </td>
        <td>
          <span style="font-size:0.75rem;font-weight:700;padding:2px 8px;border-radius:12px;display:inline-block;${badgeStyle}">
            ${insp.resultado}
          </span>
        </td>
        <td style="font-size:0.82rem">
          <span style="color:#166534;font-weight:700">+${insp.quantidade_aprovada} ap</span>
          ${insp.quantidade_reprovada > 0 ? `<span style="color:#991b1b;font-weight:700;margin-left:4px">(-${insp.quantidade_reprovada} rep)</span>` : ""}
        </td>
        <td>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
            <span style="font-size:0.78rem;color:#475569">${insp.responsavel || "Gestor RezFire"}</span>
            <button type="button" class="btn-ghost btn-abrir-laudo" data-insp-id="${insp.id_inspecao}" style="font-size:0.72rem;padding:2px 6px">Laudo</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tableBody.querySelectorAll(".btn-abrir-laudo").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-insp-id"));
      abrirLaudoInspecao(id);
    });
  });
}

function abrirLaudoInspecao(id) {
  const insp = allInspecoes.find((i) => i.id_inspecao === id) || allInspecoes[0];
  if (!insp) return;

  const modal = document.getElementById("modal-inspecao-detalhe");
  const content = document.getElementById("inspecao-detalhe-conteudo");
  if (!modal || !content) return;

  const prod = products.find((p) => p.id_produto === insp.id_produto) || { sku: insp.sku || "EXT", nome: insp.nome_produto || "Extintor" };
  const chk = insp.checklist || {};
  const statusBadge = (val, okText, failText) => val
    ? `<span style="display:inline-flex;align-items:center;gap:4px;color:#16a34a;font-weight:700">✓ ${okText}</span>`
    : `<span style="display:inline-flex;align-items:center;gap:4px;color:#dc2626;font-weight:700">✕ ${failText}</span>`;

  content.innerHTML = `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <span class="sku-main" style="font-size:1rem">${prod.sku}</span>
          <div style="font-size:0.9rem;font-weight:600;color:#1e293b">${prod.nome}</div>
          <div style="font-size:0.78rem;color:#64748b;margin-top:2px">Lote: <strong>${insp.numero_lote || insp.id_lote || "—"}</strong></div>
        </div>
        <div style="text-align:right">
          <span style="display:inline-block;font-size:0.8rem;font-weight:800;padding:4px 10px;border-radius:12px;${insp.resultado === 'Aprovado' ? 'background:#dcfce7;color:#166534;border:1px solid #86efac' : 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5'}">
            ${insp.resultado}
          </span>
          <div style="font-size:0.75rem;color:#64748b;margin-top:4px">${formatDate(insp.data_inspecao)}</div>
        </div>
      </div>
    </div>

    <h3 style="font-size:0.84rem;font-weight:700;color:#334155;text-transform:uppercase;margin-bottom:8px">Conferência Física dos 5 Itens Obrigatórios:</h3>
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:14px;display:flex;flex-direction:column;gap:8px;font-size:0.84rem">
      <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid #f1f5f9">
        <span>1. Ausência de mossas, avarias ou deformações no casco:</span>
        ${statusBadge(chk.avarias_casco, "Conforme / Íntegro", "Não Conforme / Avariado")}
      </div>
      <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid #f1f5f9">
        <span>2. Ausência de corrosão, ferrugem ou danos na pintura:</span>
        ${statusBadge(chk.sem_corrosao, "Conforme / Sem corrosão", "Não Conforme / Oxidação")}
      </div>
      <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid #f1f5f9">
        <span>3. Rótulo, serigrafia e instruções legíveis com classe de fogo:</span>
        ${statusBadge(chk.rotulo_legivel, "Conforme / Legível", "Não Conforme / Danificado")}
      </div>
      <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid #f1f5f9">
        <span>4. Indicador de pressão do manômetro na faixa verde:</span>
        ${statusBadge(chk.manometro_pressao, "Conforme / Faixa Verde", "Não Conforme / Despressurizado")}
      </div>
      <div style="display:flex;justify-content:space-between">
        <span>5. Presença e integridade do lacre/selo INMETRO e acessórios:</span>
        ${statusBadge(chk.lacre_acessorios, "Conforme / Inviolado", "Não Conforme / Irregular")}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px">
        <span style="font-size:0.75rem;font-weight:700;color:#166534;display:block">Liberado para Estoque Vendível</span>
        <strong style="font-size:1.1rem;color:#166534">${insp.quantidade_aprovada} un.</strong>
      </div>
      <div style="background:${insp.quantidade_reprovada > 0 ? '#fef2f2' : '#f8fafc'};border:1px solid ${insp.quantidade_reprovada > 0 ? '#fecaca' : '#e2e8f0'};border-radius:6px;padding:10px">
        <span style="font-size:0.75rem;font-weight:700;color:${insp.quantidade_reprovada > 0 ? '#991b1b' : '#64748b'};display:block">Bloqueado / Retido</span>
        <strong style="font-size:1.1rem;color:${insp.quantidade_reprovada > 0 ? '#991b1b' : '#64748b'}">${insp.quantidade_reprovada} un.</strong>
      </div>
    </div>

    ${insp.quantidade_reprovada > 0 ? `
      <div style="background:#fff1f2;border:1px solid #ffe4e6;border-radius:6px;padding:10px;margin-bottom:12px;font-size:0.8rem;color:#9f1239">
        <div><strong>Motivo da Reprovação:</strong> ${insp.motivo_reprovacao || 'Defeito físico'}</div>
        <div><strong>Destino dos Itens:</strong> ${insp.destino_reprovados || 'Devolução ao Fornecedor'}</div>
      </div>
    ` : ''}

    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid #e2e8f0;font-size:0.78rem;color:#64748b">
      <span>Inspetor Responsável: <strong style="color:#1e293b">${insp.responsavel || "Gestor RezFire"}</strong></span>
      <span>Auditoria RezFire · Conformidade Portaria INMETRO</span>
    </div>
  `;

  modal.classList.add("is-open");
}

async function recarregarDados() {
  if (window.RezFireAPI) {
    try {
      const [resMovs, resProds, resEstoque, resInspecoes] = await Promise.all([
        window.RezFireAPI.movimentacoes.listar().catch(() => null),
        window.RezFireAPI.produtos.listar().catch(() => null),
        window.RezFireAPI.estoque.listar().catch(() => null),
        window.RezFireAPI.inspecoes?.listar().catch(() => null),
      ]);

      if (resMovs && resMovs.sucesso && Array.isArray(resMovs.movimentacoes)) {
        movements = resMovs.movimentacoes.map((m) => {
          const isNF = m.motivo?.includes("Nota Fiscal") || m.motivo?.includes("NF #") || m.motivo?.includes("Entrada por");
          const isEstorno = m.motivo?.includes("Estorno");
          const isVenda = m.motivo?.includes("Venda") || m.motivo?.includes("Pedido");
          let canal = "Interno";
          if (m.motivo?.includes("Mercado Livre") || m.motivo?.includes("ML")) canal = "Mercado Livre";
          else if (isVenda || isEstorno) canal = "Venda Direta";

          return {
            ...m,
            id_movimentacao: m.id_movimentacao,
            id_produto: m.id_produto,
            sku: m.produto?.sku || m.sku || `PROD-${m.id_produto}`,
            nome_produto: m.produto?.nome || m.nome || "Produto",
            tipo: m.tipo,
            motivo: m.motivo,
            canal: canal,
            quantidade: Number(m.quantidade || 0),
            preco_unitario: Number(m.produto?.custo || m.preco_unitario || 0),
            valor_total: Number(m.produto?.custo ? m.produto.custo * m.quantidade : (m.valor_total || 0)),
            data: m.data_movimentacao || m.data,
            responsavel: m.usuario?.nome || "Gestor RezFire",
            codigo_pedido: isNF ? (m.motivo.split(" - ")[0] || "NF-e") : (isVenda ? m.motivo.replace("Venda - ", "") : "Ajuste"),
          };
        });
      } else if (window.RezFireData) {
        movements = window.RezFireData.loadMovements();
      }

      if (resProds && resProds.sucesso && Array.isArray(resProds.produtos)) {
        products = resProds.produtos;
      } else if (window.RezFireData) {
        products = window.RezFireData.loadProducts();
      }

      if (resEstoque && resEstoque.sucesso && Array.isArray(resEstoque.estoque)) {
        allLotes = [];
        resEstoque.estoque.forEach((p) => {
          if (Array.isArray(p.lotes)) {
            p.lotes.forEach((l) => {
              allLotes.push({
                ...l,
                id_produto: p.id_produto,
                sku: p.sku,
              });
            });
          }
        });
      }

      if (resInspecoes && resInspecoes.sucesso && Array.isArray(resInspecoes.inspecoes)) {
        allInspecoes = resInspecoes.inspecoes;
      } else if (window.RezFireData) {
        allInspecoes = window.RezFireData.loadInspecoes();
      }
    } catch (e) {
      console.warn("[Movimentações] Erro ao carregar API:", e);
      if (window.RezFireData) {
        products = window.RezFireData.loadProducts();
        movements = window.RezFireData.loadMovements();
        allInspecoes = window.RezFireData.loadInspecoes();
      }
    }
  } else if (window.RezFireData) {
    products = window.RezFireData.loadProducts();
    movements = window.RezFireData.loadMovements();
    allInspecoes = window.RezFireData.loadInspecoes();
  }

  renderKPIs();
  renderTable();
}

async function init() {
  RezFireLayout.renderSidebar("movimentacoes");
  bindEvents();
  await recarregarDados();

  // Verifica se veio da tela de Estoque com atalho de entrada (?action=entrada)
  const params = new URLSearchParams(window.location.search);
  if (params.get("action") === "entrada") {
    openEntradaModal();
  }
}

init();
