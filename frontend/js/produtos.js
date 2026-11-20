const eyeIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const pencilIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const trashIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

let products = [];
let query = "";
let filtroCertificado = "todos";
let filtroFiscal = "todos";
let currentComboItems = [];

const ORIGENS_VALIDAS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8"]);
const CST_CSOSN_VALIDOS = new Set([
  "101", "102", "103", "201", "202", "203", "300", "400", "500", "900",
  "00", "10", "20", "30", "40", "41", "50", "51", "60", "70", "90",
]);

function avaliarFiscalLocal(dados) {
  const faltantes = [];
  const ncmClean = String(dados.ncm || "").replace(/[.\-\s]/g, "");
  const cfopClean = String(dados.cfop || "").replace(/[.\-\s]/g, "");
  const origem = String(dados.origem_mercadoria ?? "").trim();
  const cst = String(dados.cst_csosn || "").replace(/\D/g, "");
  const unidade = String(dados.unidade_comercial || "").trim().toUpperCase();

  if (!/^\d{8}$/.test(ncmClean)) faltantes.push("NCM (8 dígitos)");
  if (!/^[56]\d{3}$/.test(cfopClean)) faltantes.push("CFOP (4 dígitos)");
  if (!ORIGENS_VALIDAS.has(origem)) faltantes.push("Origem da mercadoria (0 a 8)");
  if (!CST_CSOSN_VALIDOS.has(cst)) faltantes.push("CST/CSOSN");
  if (!/^[A-Z0-9]{1,6}$/.test(unidade)) faltantes.push("Unidade comercial (ex: UN)");

  const apto = faltantes.length === 0;
  return {
    apto_nfe: apto,
    campos_faltantes: faltantes,
    alertas_fiscais: [],
    resumo: apto ? "Apto para emissão de NF-e" : `Pendente (${faltantes.join(", ")})`,
  };
}

function updateComboVisibility() {
  const tipo = document.getElementById("tipo").value;
  const comboSection = document.getElementById("combo-section");
  if (tipo === "Combo") {
    comboSection.style.display = "block";
    populateComboSelect();
  } else {
    comboSection.style.display = "none";
  }
}

function populateComboSelect() {
  const select = document.getElementById("combo-item-select");
  const options = products
    .filter((p) => p.tipo !== "Combo" && p.id_produto !== Number(document.getElementById("id_produto").value))
    .map((p) => `<option value="${p.id_produto}">${p.sku} - ${escapeHtml(p.nome)}</option>`)
    .join("");
  select.innerHTML = `<option value="">Selecione um produto simples...</option>` + options;
}

function renderComboItems() {
  const list = document.getElementById("combo-items-list");
  if (currentComboItems.length === 0) {
    list.innerHTML = `<li class="text-sm text-gray-500 p-2">Nenhum item adicionado.</li>`;
    return;
  }
  list.innerHTML = currentComboItems.map((item, index) => {
    const prod = products.find(p => p.id_produto === item.id_produto);
    const prodName = prod ? `${prod.sku} - ${prod.nome}` : 'Produto não encontrado';
    return `
      <li class="flex justify-between items-center text-sm p-2 bg-gray-100 rounded">
        <span>${item.quantidade}x ${escapeHtml(prodName)}</span>
        <button type="button" class="text-red-600 hover:text-red-800 font-bold" data-remove-combo="${index}">Remover</button>
      </li>
    `;
  }).join("");
}



function filteredProducts() {
  const term = query.trim().toLowerCase();
  return products.filter((p) => {
    const matchesTerm =
      !term ||
      p.sku.toLowerCase().includes(term) ||
      p.nome.toLowerCase().includes(term);

    if (!matchesTerm) return false;

    if (filtroFiscal !== "todos") {
      const fiscalStatus = p.fiscal_status || avaliarFiscalLocal(p);
      if (filtroFiscal === "aptos" && !fiscalStatus.apto_nfe) return false;
      if (filtroFiscal === "pendentes" && fiscalStatus.apto_nfe) return false;
    }

    if (filtroCertificado === "com_cert") {
      return window.RezFireCertificados ? window.RezFireCertificados.temCertificado("produto", p.id_produto) : false;
    }
    if (filtroCertificado === "sem_cert") {
      return window.RezFireCertificados ? !window.RezFireCertificados.temCertificado("produto", p.id_produto) : true;
    }
    return true;
  });
}

function renderTable() {
  const body = document.getElementById("produtos-body");
  const rows = filteredProducts();
  document.getElementById("produtos-count").textContent = `${products.length} SKUs cadastrados`;

  if (!rows.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="10">Nenhum produto encontrado.</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map((p) => {
      const d = p.detalhes_extintor;
      const temDetalhesExtintor = d && (d.registro_inmetro || d.tipo_extintor || d.capacidade_peso || d.classe_incendio);

      const certStatus = window.RezFireCertificados
        ? window.RezFireCertificados.obterStatus("produto", p.id_produto)
        : { possuiCertificado: false, quantidade: 0 };

      const certBadgeHTML = certStatus.possuiCertificado
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200" title="${certStatus.quantidade} certificado(s) anexado(s)">🛡️ ${certStatus.quantidade} doc${certStatus.quantidade > 1 ? "s" : ""}</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200" title="Nenhum certificado Inmetro anexado">⚠️ Sem anexo</span>`;

      const fiscalStatus = p.fiscal_status || avaliarFiscalLocal(p);
      const fiscalBadgeHTML = fiscalStatus.apto_nfe
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200" title="NCM ${escapeHtml(p.ncm)} · CFOP ${escapeHtml(p.cfop)} · ${escapeHtml(p.cst_csosn)}">🧾 Apto · ${escapeHtml(p.ncm)}</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-800 border border-red-200" title="Falta: ${escapeHtml((fiscalStatus.campos_faltantes || []).join(", "))}">⛔ Pendente (${(fiscalStatus.campos_faltantes || []).length})</span>`;

      return `
        <tr>
          <td>
            <span class="sku-main">${escapeHtml(p.sku)}</span>
            <span class="sku-sub">ID ${p.id_produto}</span>
          </td>
          <td class="prod-name">
            <div>${escapeHtml(p.nome)}</div>
            ${temDetalhesExtintor ? `
              <div class="flex flex-wrap gap-1 mt-1 text-xs">
                ${d.tipo_extintor ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200">${escapeHtml(d.tipo_extintor)}</span>` : ''}
                ${d.capacidade_peso ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">${escapeHtml(d.capacidade_peso)}</span>` : ''}
                ${d.classe_incendio ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold">Classe ${escapeHtml(d.classe_incendio)}</span>` : ''}
                ${d.registro_inmetro ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200" title="Registro Inmetro">Inmetro: ${escapeHtml(d.registro_inmetro)}</span>` : ''}
              </div>
            ` : ''}
          </td>
          <td>${escapeHtml(p.categoria || "Sem Categoria")}</td>
          <td>${p.tipo === "Combo" ? '<span class="status-pill on">Combo</span>' : 'Simples'}</td>
          <td>${RezFireData.formatMoney(Number(p.custo || 0))}</td>
          <td>${RezFireData.formatMoney(Number(p.preco))}</td>
          <td>${certBadgeHTML}</td>
          <td>${fiscalBadgeHTML}</td>
          <td><span class="status-pill ${p.ativo ? "on" : ""}">${p.ativo ? "Ativo" : "Inativo"}</span></td>
          <td>
            <div class="flex gap-2">
              <button class="icon-btn" type="button" data-view="${p.id_produto}" title="Visualizar Detalhes">
                ${eyeIcon}
              </button>
              <button class="icon-btn" type="button" data-edit="${p.id_produto}" title="Editar">
                ${pencilIcon}
              </button>
              <button class="icon-btn" type="button" data-delete="${p.id_produto}" title="Excluir">
                ${trashIcon}
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function switchModalTab(tabName) {
  const tabBtnGeral = document.getElementById("tab-btn-geral");
  const tabBtnDetalhes = document.getElementById("tab-btn-detalhes");
  const tabBtnCertificados = document.getElementById("tab-btn-certificados");
  const tabBtnFiscal = document.getElementById("tab-btn-fiscal");
  const paneGeral = document.getElementById("tab-pane-geral");
  const paneDetalhes = document.getElementById("tab-pane-detalhes");
  const paneCertificados = document.getElementById("tab-pane-certificados");
  const paneFiscal = document.getElementById("tab-pane-fiscal");

  [tabBtnGeral, tabBtnDetalhes, tabBtnCertificados, tabBtnFiscal].forEach((btn) => {
    if (btn) {
      btn.classList.remove("is-active");
      btn.setAttribute("aria-selected", "false");
    }
  });

  [paneGeral, paneDetalhes, paneCertificados, paneFiscal].forEach((p) => {
    if (p) p.style.display = "none";
  });

  if (tabName === "detalhes") {
    tabBtnDetalhes?.classList.add("is-active");
    tabBtnDetalhes?.setAttribute("aria-selected", "true");
    if (paneDetalhes) paneDetalhes.style.display = "block";
  } else if (tabName === "certificados") {
    tabBtnCertificados?.classList.add("is-active");
    tabBtnCertificados?.setAttribute("aria-selected", "true");
    if (paneCertificados) paneCertificados.style.display = "block";

    const prodId = document.getElementById("id_produto").value;
    const regInm = document.getElementById("registro_inmetro").value;
    renderizarCertificadosModalEdicao(prodId, regInm);
  } else if (tabName === "fiscal") {
    tabBtnFiscal?.classList.add("is-active");
    tabBtnFiscal?.setAttribute("aria-selected", "true");
    if (paneFiscal) paneFiscal.style.display = "block";
    atualizarStatusFiscalModal();
  } else {
    tabBtnGeral?.classList.add("is-active");
    tabBtnGeral?.setAttribute("aria-selected", "true");
    if (paneGeral) paneGeral.style.display = "block";
  }
}

function atualizarStatusFiscalModal() {
  const status = avaliarFiscalLocal({
    ncm: document.getElementById("ncm")?.value,
    cfop: document.getElementById("cfop")?.value,
    origem_mercadoria: document.getElementById("origem_mercadoria")?.value,
    cst_csosn: document.getElementById("cst_csosn")?.value,
    unidade_comercial: document.getElementById("unidade_comercial")?.value,
    cest: document.getElementById("cest")?.value,
  });

  const badge = document.getElementById("modal-tab-badge-fiscal");
  if (badge) {
    badge.textContent = status.apto_nfe ? "Apto" : `Falta ${status.campos_faltantes.length}`;
    badge.style.background = status.apto_nfe ? "#ecfdf5" : "#fef2f2";
    badge.style.color = status.apto_nfe ? "#065f46" : "#991b1b";
    badge.style.borderColor = status.apto_nfe ? "#a7f3d0" : "#fecaca";
  }

  const box = document.getElementById("fiscal-produto-alerta");
  if (box) {
    if (status.apto_nfe) {
      box.style.background = "#ecfdf5";
      box.style.borderColor = "#a7f3d0";
      box.style.color = "#065f46";
      box.innerHTML = `
        <span style="font-size: 1.05rem;">✅</span>
        <div><strong>Dados fiscais completos:</strong> este produto está apto para compor notas fiscais (NF-e).</div>
      `;
    } else {
      box.style.background = "#fffbeb";
      box.style.borderColor = "#fde68a";
      box.style.color = "#92400e";
      box.innerHTML = `
        <span style="font-size: 1.05rem;">⚠️</span>
        <div>
          <strong>Produto bloqueado para emissão de NF-e:</strong>
          preencha os campos pendentes: <strong>${escapeHtml(status.campos_faltantes.join(", "))}</strong>.
        </div>
      `;
    }
  }
}

function renderizarCertificadosModalEdicao(productId, registroInmetro) {
  const container = document.getElementById("modal-certificados-container");
  if (!container) return;

  if (!productId) {
    container.innerHTML = `
      <div style="padding: 24px 16px; text-align: center; background: #fafaf9; border-radius: 10px; border: 1px dashed #d6d3d1; margin-top: 10px;">
        <span style="font-size: 2.2rem; display: block; margin-bottom: 8px;">💡</span>
        <strong style="font-size: 0.95rem; color: #1c1917; display: block;">Salve o produto antes de anexar certificados</strong>
        <p style="font-size: 0.8rem; color: #78716c; max-width: 440px; margin: 6px auto 0; line-height: 1.45;">
          Para vincular documentos Inmetro a este produto, primeiro conclua e salve o cadastro básico. Em seguida, acerte os arquivos diretamente na edição ou na ficha detalhada.
        </p>
      </div>
    `;
    return;
  }

  if (window.RezFireCertificados) {
    window.RezFireCertificados.renderizarGerenciadorCertificados(container, {
      tipoEntidade: "produto",
      entidadeId: productId,
      titulo: "Certificados Inmetro deste Produto",
      subtitulo: "Anexe os certificados de homologação e selos em formato PDF ou imagem (JPG/PNG).",
      registroInmetroPadrao: registroInmetro || "",
      modo: "completo",
    });
  }
}

function openModal(product) {
  const modal = document.getElementById("modal");
  const title = document.getElementById("modal-title");
  document.getElementById("form-error").textContent = "";

  // Retorna sempre para a primeira aba por padrão
  switchModalTab("geral");

  const prodId = product ? product.id_produto : "";
  document.getElementById("id_produto").value = prodId;
  document.getElementById("sku").value = product ? product.sku : "";
  document.getElementById("nome").value = product ? product.nome : "";
  document.getElementById("descricao").value = product ? product.descricao : "";
  document.getElementById("custo").value = product ? (product.custo || 0) : "";
  document.getElementById("preco").value = product ? product.preco : "";
  document.getElementById("categoria").value = product ? (product.categoria || "") : "";
  document.getElementById("tipo").value = product ? (product.tipo || "Simples") : "Simples";
  document.getElementById("ativo").value = product && product.ativo === false ? "false" : "true";

  // Preenche ou limpa campos da aba Detalhes (Extintor)
  const d = (product && product.detalhes_extintor) || {};
  document.getElementById("registro_inmetro").value = d.registro_inmetro || "";
  document.getElementById("tipo_extintor").value = d.tipo_extintor || "";
  document.getElementById("capacidade_peso").value = d.capacidade_peso || "";
  document.getElementById("classe_incendio").value = d.classe_incendio || "";
  document.getElementById("fabricante").value = d.fabricante || "";
  document.getElementById("data_fabricacao").value = d.data_fabricacao || "";
  document.getElementById("data_validade").value = d.data_validade || "";
  document.getElementById("numero_lacre").value = d.numero_lacre || "";
  document.getElementById("selo_conformidade").value = d.selo_conformidade || "";
  document.getElementById("id_lote").value = d.id_lote || "";
  document.getElementById("peso_bruto_kg").value = d.peso_bruto_kg || "";
  document.getElementById("dimensoes").value = d.dimensoes || "";

  // Preenche ou limpa campos da aba Fiscal (NF-e · Story 33b)
  document.getElementById("ncm").value = (product && product.ncm) || "";
  document.getElementById("cfop").value = (product && product.cfop) || "";
  document.getElementById("origem_mercadoria").value = (product && product.origem_mercadoria) || "";
  document.getElementById("cst_csosn").value = (product && product.cst_csosn) || "";
  document.getElementById("unidade_comercial").value = (product && product.unidade_comercial) || "";
  document.getElementById("cest").value = (product && product.cest) || "";
  atualizarStatusFiscalModal();

  // Atualiza badge de quantidade de certificados na aba
  const badgeCerts = document.getElementById("modal-tab-badge-certs");
  if (badgeCerts) {
    if (prodId && window.RezFireCertificados) {
      const status = window.RezFireCertificados.obterStatus("produto", prodId);
      badgeCerts.textContent = status.quantidade;
    } else {
      badgeCerts.textContent = "0";
    }
  }

  title.textContent = product ? "Editar produto" : "Novo produto";
  
  currentComboItems = product && product.combo_items ? [...product.combo_items] : [];
  updateComboVisibility();
  renderComboItems();

  modal.classList.add("is-open");
  document.getElementById("sku").focus();
}

function closeModal() {
  document.getElementById("modal").classList.remove("is-open");
}

let viewingProduct = null;

function closeViewModal() {
  const modal = document.getElementById("modal-view");
  if (modal) modal.classList.remove("is-open");
  viewingProduct = null;
}

function openViewModal(product) {
  if (!product) return;
  viewingProduct = product;

  const modal = document.getElementById("modal-view");
  const title = document.getElementById("view-title");
  const skuBadge = document.getElementById("view-sku-badge");
  const content = document.getElementById("view-content");

  title.textContent = product.nome;
  skuBadge.textContent = `SKU: ${product.sku} · ID #${product.id_produto}`;

  const d = product.detalhes_extintor || {};
  const temFichaTecnica = Boolean(
    d.tipo_extintor || d.capacidade_peso || d.classe_incendio ||
    d.registro_inmetro || d.fabricante || d.numero_lacre ||
    d.data_validade || d.id_lote || d.peso_bruto_kg || d.dimensoes
  );

  // Calcula margem e markup
  const custo = Number(product.custo || 0);
  const preco = Number(product.preco || 0);
  const margemLucro = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
  const lucroUnitario = preco - custo;

  // Itens do combo (se for combo)
  let comboHTML = "";
  if (product.tipo === "Combo" && product.combo_items && product.combo_items.length > 0) {
    comboHTML = `
      <div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px">
        <h4 style="font-size:0.82rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 10px">Composição do Combo</h4>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${product.combo_items.map((ci) => {
            const itemProd = products.find((p) => p.id_produto === ci.id_produto);
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:0.85rem">
                <div>
                  <strong style="color:var(--ink)">${ci.quantidade}x</strong>
                  <span style="margin-left:6px">${itemProd ? escapeHtml(itemProd.nome) : "Produto #" + ci.id_produto}</span>
                  <span style="font-family:monospace;font-size:0.75rem;color:var(--muted);margin-left:6px">(${itemProd ? itemProd.sku : ""})</span>
                </div>
                ${itemProd ? `<span style="font-size:0.8rem;color:var(--muted)">${RezFireData.formatMoney(Number(itemProd.preco))} un</span>` : ""}
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  content.innerHTML = `
    <!-- Cartões de Resumo Rápido -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;margin-bottom:16px">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px">
        <span style="font-size:0.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;display:block">Preço Venda</span>
        <strong style="font-size:1.1rem;color:var(--ink);display:block;margin-top:2px">${RezFireData.formatMoney(preco)}</strong>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px">
        <span style="font-size:0.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;display:block">Custo Aquis.</span>
        <strong style="font-size:1.1rem;color:var(--muted);display:block;margin-top:2px">${RezFireData.formatMoney(custo)}</strong>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px">
        <span style="font-size:0.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;display:block">Margem Bruta</span>
        <strong style="font-size:1.1rem;color:${margemLucro >= 30 ? "var(--up)" : "#d97706"};display:block;margin-top:2px">
          ${margemLucro.toFixed(1)}% <span style="font-size:0.75rem;font-weight:600">(${RezFireData.formatMoney(lucroUnitario)})</span>
        </strong>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px">
        <span style="font-size:0.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;display:block">Estoque Físico</span>
        <strong style="font-size:1.1rem;color:var(--ink);display:block;margin-top:2px">
          ${product.quantidade_atual !== undefined ? product.quantidade_atual : "—"} un
        </strong>
      </div>
    </div>

    <!-- Informações Cadastrais Gerais -->
    <div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:14px">
      <h4 style="font-size:0.82rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 10px">Dados Cadastrais</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;font-size:0.88rem">
        <div>
          <span style="color:var(--muted);font-size:0.75rem;display:block">Categoria</span>
          <strong style="color:var(--ink)">${escapeHtml(product.categoria || "—")}</strong>
        </div>
        <div>
          <span style="color:var(--muted);font-size:0.75rem;display:block">Tipo de Produto</span>
          <span class="status-pill ${product.tipo === "Combo" ? "on" : ""}" style="font-size:0.75rem">${product.tipo || "Simples"}</span>
        </div>
        <div>
          <span style="color:var(--muted);font-size:0.75rem;display:block">Situação no Catálogo</span>
          <span class="status-pill ${product.ativo ? "on" : ""}" style="font-size:0.75rem">${product.ativo ? "Ativo" : "Inativo"}</span>
        </div>
        <div>
          <span style="color:var(--muted);font-size:0.75rem;display:block">Estoque Mínimo</span>
          <span style="color:var(--ink);font-weight:600">${product.estoque_minimo || 0} unidades</span>
        </div>
        ${product.descricao ? `
          <div style="grid-column: 1 / -1">
            <span style="color:var(--muted);font-size:0.75rem;display:block">Descrição Comercial</span>
            <p style="margin:2px 0 0;color:var(--ink);line-height:1.4">${escapeHtml(product.descricao)}</p>
          </div>
        ` : ""}
      </div>
      ${comboHTML}
    </div>

    <!-- Ficha Técnica e Rastreabilidade Operacional -->
    ${temFichaTecnica ? `
      <div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <h4 style="font-size:0.82rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin:0">
            Ficha Técnica, Lote & Logística
          </h4>
          ${d.registro_inmetro ? `
            <span style="font-size:0.75rem;font-weight:700;color:#1e40af;background:#dbeafe;padding:2px 8px;border-radius:999px">
              Inmetro: ${escapeHtml(d.registro_inmetro)}
            </span>
          ` : ""}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;font-size:0.88rem">
          ${d.tipo_extintor ? `
            <div>
              <span style="color:var(--muted);font-size:0.75rem;display:block">Agente Extintor</span>
              <strong style="color:var(--ink)">${escapeHtml(d.tipo_extintor)}</strong>
            </div>
          ` : ""}
          ${d.capacidade_peso ? `
            <div>
              <span style="color:var(--muted);font-size:0.75rem;display:block">Capacidade / Carga</span>
              <strong style="color:var(--ink)">${escapeHtml(d.capacidade_peso)}</strong>
            </div>
          ` : ""}
          ${d.classe_incendio ? `
            <div>
              <span style="color:var(--muted);font-size:0.75rem;display:block">Classe de Incêndio</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-bold text-xs">
                Classe ${escapeHtml(d.classe_incendio)}
              </span>
            </div>
          ` : ""}
          ${d.fabricante ? `
            <div>
              <span style="color:var(--muted);font-size:0.75rem;display:block">Fabricante</span>
              <span style="color:var(--ink)">${escapeHtml(d.fabricante)}</span>
            </div>
          ` : ""}
          ${d.id_lote ? `
            <div>
              <span style="color:var(--muted);font-size:0.75rem;display:block">Lote Padrão</span>
              <span style="font-family:monospace;font-weight:700;color:#0e7490">${escapeHtml(d.id_lote)}</span>
            </div>
          ` : ""}
          ${d.numero_lacre ? `
            <div>
              <span style="color:var(--muted);font-size:0.75rem;display:block">Número do Lacre</span>
              <span style="font-family:monospace;color:var(--ink)">${escapeHtml(d.numero_lacre)}</span>
            </div>
          ` : ""}
          ${d.selo_conformidade ? `
            <div>
              <span style="color:var(--muted);font-size:0.75rem;display:block">Selo de Conformidade</span>
              <span style="font-family:monospace;color:var(--ink)">${escapeHtml(d.selo_conformidade)}</span>
            </div>
          ` : ""}
          ${d.data_validade ? `
            <div>
              <span style="color:var(--muted);font-size:0.75rem;display:block">Validade da Carga</span>
              <strong style="color:var(--ink)">${new Date(d.data_validade).toLocaleDateString("pt-BR")}</strong>
            </div>
          ` : ""}
          ${d.data_fabricacao ? `
            <div>
              <span style="color:var(--muted);font-size:0.75rem;display:block">Data de Fabricação</span>
              <span>${new Date(d.data_fabricacao).toLocaleDateString("pt-BR")}</span>
            </div>
          ` : ""}
          ${d.peso_bruto_kg ? `
            <div>
              <span style="color:var(--muted);font-size:0.75rem;display:block">Peso Bruto p/ Envio</span>
              <strong style="color:var(--ink)">${d.peso_bruto_kg} kg</strong>
            </div>
          ` : ""}
          ${d.dimensoes ? `
            <div>
              <span style="color:var(--muted);font-size:0.75rem;display:block">Dimensões da Embalagem</span>
              <span>${escapeHtml(d.dimensoes)}</span>
            </div>
          ` : ""}
        </div>
      </div>
    ` : ""}
    ${(() => {
      const fs = product.fiscal_status || avaliarFiscalLocal(product);
      const badge = fs.apto_nfe
        ? `<span style="font-size:0.75rem;font-weight:700;color:#065f46;background:#ecfdf5;padding:2px 8px;border-radius:999px;border:1px solid #a7f3d0;">Apto p/ NF-e</span>`
        : `<span style="font-size:0.75rem;font-weight:700;color:#991b1b;background:#fef2f2;padding:2px 8px;border-radius:999px;border:1px solid #fecaca;">Pendente</span>`;
      return `
        <div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-top:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <h4 style="font-size:0.82rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin:0">
              Dados Fiscais (NF-e · Story 33b)
            </h4>
            ${badge}
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:10px;font-size:0.86rem">
            <div><span style="color:var(--muted);font-size:0.74rem;display:block">NCM</span><strong style="font-family:monospace">${escapeHtml(product.ncm || "—")}</strong></div>
            <div><span style="color:var(--muted);font-size:0.74rem;display:block">CFOP Padrão</span><strong style="font-family:monospace">${escapeHtml(product.cfop || "—")}</strong></div>
            <div><span style="color:var(--muted);font-size:0.74rem;display:block">Origem</span><strong>${escapeHtml(product.origem_mercadoria ?? "—")}</strong></div>
            <div><span style="color:var(--muted);font-size:0.74rem;display:block">CST / CSOSN</span><strong style="font-family:monospace">${escapeHtml(product.cst_csosn || "—")}</strong></div>
            <div><span style="color:var(--muted);font-size:0.74rem;display:block">Unidade</span><strong>${escapeHtml(product.unidade_comercial || "—")}</strong></div>
            <div><span style="color:var(--muted);font-size:0.74rem;display:block">CEST</span><span style="font-family:monospace">${escapeHtml(product.cest || "—")}</span></div>
          </div>
          ${!fs.apto_nfe ? `
            <p style="margin:10px 0 0;font-size:0.78rem;color:#991b1b;background:#fef2f2;padding:6px 10px;border-radius:6px;">
              <strong>Campos faltantes:</strong> ${escapeHtml((fs.campos_faltantes || []).join(", "))}
            </p>
          ` : ""}
        </div>
      `;
    })()}
    <div id="view-certificados-container" style="margin-top: 14px;"></div>
  `;

  // Renderiza a seção de Certificados Inmetro na ficha de visualização
  const certContainer = document.getElementById("view-certificados-container");
  if (certContainer && window.RezFireCertificados) {
    window.RezFireCertificados.renderizarGerenciadorCertificados(certContainer, {
      tipoEntidade: "produto",
      entidadeId: product.id_produto,
      titulo: "Documentos de Certificação & Selo Inmetro",
      subtitulo: "Central de documentação de conformidade e homologação deste produto.",
      registroInmetroPadrao: d.registro_inmetro || "",
      modo: "completo",
    });
  }

  modal.classList.add("is-open");
}

function validateForm(payload, editingId) {
  if (!payload.sku) return "Informe o SKU.";
  if (!payload.nome) return "Informe o nome.";
  if (Number.isNaN(payload.custo) || payload.custo < 0) return "Custo deve ser maior ou igual a zero.";
  if (Number.isNaN(payload.preco) || payload.preco < 0) return "Preço deve ser maior ou igual a zero.";
  if (!payload.categoria) return "Informe a categoria.";
  if (payload.tipo === "Combo" && (!payload.combo_items || payload.combo_items.length === 0)) {
    return "Um combo deve ter pelo menos um item.";
  }
  const duplicated = products.some(
    (p) => p.sku.toLowerCase() === payload.sku.toLowerCase() && p.id_produto !== editingId
  );
  if (duplicated) return "Já existe um produto com este SKU.";

  if (payload.ncm && !/^\d{8}$/.test(payload.ncm)) {
    return "NCM inválido: deve conter exatamente 8 dígitos numéricos (ex: 84241000).";
  }
  if (payload.cfop && !/^[56]\d{3}$/.test(payload.cfop)) {
    return "CFOP inválido: deve conter 4 dígitos iniciados em 5 ou 6 (ex: 5102 ou 6102).";
  }
  if (payload.unidade_comercial && !/^[A-Z0-9]{1,6}$/.test(payload.unidade_comercial)) {
    return "Unidade comercial inválida: informe de 1 a 6 caracteres alfanuméricos (ex: UN, PC, KIT).";
  }
  if (payload.cest && !/^\d{7}$/.test(payload.cest)) {
    return "CEST inválido: deve conter exatamente 7 dígitos numéricos.";
  }
  return "";
}

function readForm() {
  const detalhes_extintor = {
    registro_inmetro: document.getElementById("registro_inmetro").value.trim(),
    tipo_extintor: document.getElementById("tipo_extintor").value,
    capacidade_peso: document.getElementById("capacidade_peso").value.trim(),
    classe_incendio: document.getElementById("classe_incendio").value,
    fabricante: document.getElementById("fabricante").value.trim(),
    data_fabricacao: document.getElementById("data_fabricacao").value,
    data_validade: document.getElementById("data_validade").value,
    numero_lacre: document.getElementById("numero_lacre").value.trim(),
    selo_conformidade: document.getElementById("selo_conformidade").value.trim(),
    id_lote: document.getElementById("id_lote").value.trim(),
    peso_bruto_kg: document.getElementById("peso_bruto_kg").value ? Number(document.getElementById("peso_bruto_kg").value) : null,
    dimensoes: document.getElementById("dimensoes").value.trim(),
  };

  const ncmVal = document.getElementById("ncm").value.replace(/[.\-\s]/g, "").trim();
  const cfopVal = document.getElementById("cfop").value.replace(/[.\-\s]/g, "").trim();
  const origemVal = document.getElementById("origem_mercadoria").value.trim();
  const cstVal = document.getElementById("cst_csosn").value.trim();
  const unVal = document.getElementById("unidade_comercial").value.trim().toUpperCase();
  const cestVal = document.getElementById("cest").value.replace(/[.\-\s]/g, "").trim();

  return {
    sku: document.getElementById("sku").value.trim(),
    nome: document.getElementById("nome").value.trim(),
    descricao: document.getElementById("descricao").value.trim(),
    custo: Number(document.getElementById("custo").value),
    preco: Number(document.getElementById("preco").value),
    categoria: document.getElementById("categoria").value.trim(),
    tipo: document.getElementById("tipo").value,
    ativo: document.getElementById("ativo").value === "true",
    combo_items: [...currentComboItems],
    detalhes_extintor,
    ncm: ncmVal || null,
    cfop: cfopVal || null,
    origem_mercadoria: origemVal || null,
    cst_csosn: cstVal || null,
    unidade_comercial: unVal || null,
    cest: cestVal || null,
  };
}

function bindEvents() {
  document.getElementById("busca").addEventListener("input", (event) => {
    query = event.target.value;
    renderTable();
  });

  document.getElementById("filtro-fiscal")?.addEventListener("change", (event) => {
    filtroFiscal = event.target.value;
    renderTable();
  });

  document.getElementById("filtro-certificados")?.addEventListener("change", (event) => {
    filtroCertificado = event.target.value;
    renderTable();
  });

  document.getElementById("btn-novo").addEventListener("click", () => openModal(null));
  document.getElementById("btn-cancelar").addEventListener("click", closeModal);
  document.getElementById("modal").addEventListener("click", (event) => {
    if (event.target.id === "modal") closeModal();
  });
  document.getElementById("tipo").addEventListener("change", updateComboVisibility);

  // Eventos de troca de abas no modal
  const tabBtnGeral = document.getElementById("tab-btn-geral");
  const tabBtnDetalhes = document.getElementById("tab-btn-detalhes");
  const tabBtnCertificados = document.getElementById("tab-btn-certificados");
  const tabBtnFiscal = document.getElementById("tab-btn-fiscal");
  if (tabBtnGeral) tabBtnGeral.addEventListener("click", () => switchModalTab("geral"));
  if (tabBtnDetalhes) tabBtnDetalhes.addEventListener("click", () => switchModalTab("detalhes"));
  if (tabBtnCertificados) tabBtnCertificados.addEventListener("click", () => switchModalTab("certificados"));
  if (tabBtnFiscal) tabBtnFiscal.addEventListener("click", () => switchModalTab("fiscal"));

  ["ncm", "cfop", "origem_mercadoria", "cst_csosn", "unidade_comercial", "cest"].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener("input", atualizarStatusFiscalModal);
    el?.addEventListener("change", atualizarStatusFiscalModal);
  });

  // Listener para sincronização reativa quando certificados são adicionados/removidos
  window.addEventListener("rezfire:certificados-mudaram", () => {
    renderTable();
    const prodId = document.getElementById("id_produto")?.value;
    const badgeCerts = document.getElementById("modal-tab-badge-certs");
    if (badgeCerts) {
      if (prodId && window.RezFireCertificados) {
        const status = window.RezFireCertificados.obterStatus("produto", prodId);
        badgeCerts.textContent = status.quantidade;
      } else {
        badgeCerts.textContent = "0";
      }
    }
  });

  document.getElementById("btn-add-combo-item").addEventListener("click", () => {
    const select = document.getElementById("combo-item-select");
    const qtdInput = document.getElementById("combo-item-qtd");
    const id = Number(select.value);
    const qtd = Number(qtdInput.value);

    if (!id) return alert("Selecione um produto.");
    if (!qtd || qtd < 1) return alert("Quantidade deve ser maior que zero.");

    const existing = currentComboItems.find(i => i.id_produto === id);
    if (existing) {
      existing.quantidade += qtd;
    } else {
      currentComboItems.push({ id_produto: id, quantidade: qtd });
    }
    
    select.value = "";
    qtdInput.value = "1";
    renderComboItems();
  });

  document.getElementById("combo-items-list").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-remove-combo]");
    if (btn) {
      const index = Number(btn.getAttribute("data-remove-combo"));
      currentComboItems.splice(index, 1);
      renderComboItems();
    }
  });

  document.getElementById("produtos-body").addEventListener("click", async (event) => {
    const viewBtn = event.target.closest("[data-view]");
    if (viewBtn) {
      const id = Number(viewBtn.getAttribute("data-view"));
      const product = products.find((p) => p.id_produto === id);
      if (product) openViewModal(product);
      return;
    }

    const editBtn = event.target.closest("[data-edit]");
    if (editBtn) {
      const id = Number(editBtn.getAttribute("data-edit"));
      const product = products.find((p) => p.id_produto === id);
      if (product) openModal(product);
      return;
    }

    const deleteBtn = event.target.closest("[data-delete]");
    if (deleteBtn) {
      const id = Number(deleteBtn.getAttribute("data-delete"));
      const product = products.find((p) => p.id_produto === id);
      if (product && confirm(`Deseja realmente inativar o produto "${product.nome}" (SKU: ${product.sku})?`)) {
        if (window.RezFireAPI) {
          try {
            await window.RezFireAPI.produtos.inativar(id);
          } catch (e) {
            console.warn("Falha ao inativar na API:", e);
          }
        }
        products = products.filter((p) => p.id_produto !== id);
        RezFireData.saveProducts(products);
        renderTable();
      }
      return;
    }
  });

  // Eventos do modal de visualização
  document.getElementById("btn-close-view")?.addEventListener("click", closeViewModal);
  document.getElementById("btn-view-fechar")?.addEventListener("click", closeViewModal);
  document.getElementById("modal-view")?.addEventListener("click", (event) => {
    if (event.target.id === "modal-view") closeViewModal();
  });

  // Botão "Editar Produto" dentro do modal de visualização
  document.getElementById("btn-view-editar")?.addEventListener("click", () => {
    if (viewingProduct) {
      const p = viewingProduct;
      closeViewModal();
      openModal(p);
    }
  });

  document.getElementById("form-produto").addEventListener("submit", async (event) => {
    event.preventDefault();
    const editingId = Number(document.getElementById("id_produto").value) || null;
    const payload = readForm();
    const error = validateForm(payload, editingId);
    document.getElementById("form-error").textContent = error;
    if (error) {
      if (error.includes("NCM") || error.includes("CFOP") || error.includes("Unidade") || error.includes("CEST")) {
        switchModalTab("fiscal");
      } else if (error.includes("SKU") || error.includes("nome") || error.includes("Custo") || error.includes("Preço") || error.includes("categoria") || error.includes("combo")) {
        switchModalTab("geral");
      }
      return;
    }

    const isNetworkError = (err) => {
      const msg = String(err?.message || "");
      return err instanceof TypeError || msg.includes("Failed to fetch") || msg.includes("NetworkError");
    };

    try {
      if (editingId) {
        if (window.RezFireAPI) {
          try {
            const apiRes = await window.RezFireAPI.produtos.atualizar(editingId, payload);
            if (apiRes && apiRes.sucesso && apiRes.produto) {
              products = products.map((p) => p.id_produto === editingId ? apiRes.produto : p);
            } else {
              products = products.map((p) => p.id_produto === editingId ? { ...p, ...payload, id_produto: editingId } : p);
            }
          } catch (e) {
            if (!isNetworkError(e)) throw e;
            products = products.map((p) => p.id_produto === editingId ? { ...p, ...payload, id_produto: editingId } : p);
          }
        } else {
          products = products.map((p) => p.id_produto === editingId ? { ...p, ...payload, id_produto: editingId } : p);
        }
      } else {
        if (window.RezFireAPI) {
          try {
            const apiRes = await window.RezFireAPI.produtos.criar(payload);
            if (apiRes && apiRes.sucesso && apiRes.produto) {
              products.push(apiRes.produto);
            } else {
              products.push({ ...payload, quantidade_atual: 0, estoque_minimo: 0, id_produto: RezFireData.nextProductId(products) });
            }
          } catch (e) {
            if (!isNetworkError(e)) throw e;
            products.push({ ...payload, quantidade_atual: 0, estoque_minimo: 0, id_produto: RezFireData.nextProductId(products) });
          }
        } else {
          products.push({ ...payload, quantidade_atual: 0, estoque_minimo: 0, id_produto: RezFireData.nextProductId(products) });
        }
      }

      RezFireData.saveProducts(products);
      closeModal();
      renderTable();
    } catch (err) {
      const msg = err.message || "Erro ao salvar produto.";
      document.getElementById("form-error").textContent = msg;
      if (msg.includes("NCM") || msg.includes("CFOP") || msg.includes("Origem") || msg.includes("CST") || msg.includes("CSOSN") || msg.includes("Unidade") || msg.includes("CEST")) {
        switchModalTab("fiscal");
      }
    }
  });
}

async function init() {
  RezFireLayout.renderSidebar("produtos");
  try {
    if (window.RezFireAPI) {
      const res = await window.RezFireAPI.produtos.listar();
      if (res && res.sucesso && Array.isArray(res.produtos) && res.produtos.length > 0) {
        products = res.produtos;
      } else {
        products = RezFireData.loadProducts();
      }
    } else {
      products = RezFireData.loadProducts();
    }
  } catch (err) {
    console.warn("Backend não conectado, carregando dados locais:", err);
    products = RezFireData.loadProducts();
  }
  bindEvents();

  const urlParams = new URLSearchParams(window.location.search);
  const fiscalParam = urlParams.get("fiscal");
  if (fiscalParam && ["aptos", "pendentes", "todos"].includes(fiscalParam)) {
    filtroFiscal = fiscalParam;
    const selFiscal = document.getElementById("filtro-fiscal");
    if (selFiscal) selFiscal.value = fiscalParam;
  }

  renderTable();

  const editParam = Number(urlParams.get("edit"));
  const tabParam = urlParams.get("tab");
  if (editParam) {
    const target = products.find((p) => p.id_produto === editParam);
    if (target) {
      openModal(target);
      if (tabParam) switchModalTab(tabParam);
    }
  }
}

init();
