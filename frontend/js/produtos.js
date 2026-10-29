const eyeIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const pencilIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const trashIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

let products = [];
let query = "";
let currentComboItems = [];

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
  if (!term) return products;
  return products.filter(
    (p) =>
      p.sku.toLowerCase().includes(term) ||
      p.nome.toLowerCase().includes(term)
  );
}

function renderTable() {
  const body = document.getElementById("produtos-body");
  const rows = filteredProducts();
  document.getElementById("produtos-count").textContent = `${products.length} SKUs cadastrados`;

  if (!rows.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="8">Nenhum produto encontrado.</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map((p) => {
      const d = p.detalhes_extintor;
      const temDetalhesExtintor = d && (d.registro_inmetro || d.tipo_extintor || d.capacidade_peso || d.classe_incendio);

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
  const paneGeral = document.getElementById("tab-pane-geral");
  const paneDetalhes = document.getElementById("tab-pane-detalhes");

  if (!tabBtnGeral || !tabBtnDetalhes || !paneGeral || !paneDetalhes) return;

  if (tabName === "detalhes") {
    tabBtnGeral.classList.remove("is-active");
    tabBtnGeral.setAttribute("aria-selected", "false");
    tabBtnDetalhes.classList.add("is-active");
    tabBtnDetalhes.setAttribute("aria-selected", "true");

    paneGeral.style.display = "none";
    paneDetalhes.style.display = "block";
  } else {
    tabBtnDetalhes.classList.remove("is-active");
    tabBtnDetalhes.setAttribute("aria-selected", "false");
    tabBtnGeral.classList.add("is-active");
    tabBtnGeral.setAttribute("aria-selected", "true");

    paneDetalhes.style.display = "none";
    paneGeral.style.display = "block";
  }
}

function openModal(product) {
  const modal = document.getElementById("modal");
  const title = document.getElementById("modal-title");
  document.getElementById("form-error").textContent = "";

  // Retorna sempre para a primeira aba por padrão
  switchModalTab("geral");

  document.getElementById("id_produto").value = product ? product.id_produto : "";
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
  `;

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
  };
}

function bindEvents() {
  document.getElementById("busca").addEventListener("input", (event) => {
    query = event.target.value;
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
  if (tabBtnGeral) tabBtnGeral.addEventListener("click", () => switchModalTab("geral"));
  if (tabBtnDetalhes) tabBtnDetalhes.addEventListener("click", () => switchModalTab("detalhes"));

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

  document.getElementById("produtos-body").addEventListener("click", (event) => {
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
      if (product && confirm(`Deseja realmente excluir o produto "${product.nome}" (SKU: ${product.sku})?`)) {
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

  document.getElementById("form-produto").addEventListener("submit", (event) => {
    event.preventDefault();
    const editingId = Number(document.getElementById("id_produto").value) || null;
    const payload = readForm();
    const error = validateForm(payload, editingId);
    document.getElementById("form-error").textContent = error;
    if (error) {
      // Se houver erro em campo da aba geral, volta para a aba geral para o usuário corrigir
      if (error.includes("SKU") || error.includes("nome") || error.includes("Custo") || error.includes("Preço") || error.includes("categoria") || error.includes("combo")) {
        switchModalTab("geral");
      }
      return;
    }

    if (editingId) {
      products = products.map((p) =>
        p.id_produto === editingId ? { ...p, ...payload, id_produto: editingId } : p
      );
    } else {
      products = [
        ...products,
        { ...payload, quantidade_atual: 0, estoque_minimo: 0, id_produto: RezFireData.nextProductId(products) },
      ];
    }

    RezFireData.saveProducts(products);
    closeModal();
    renderTable();
  });
}

function init() {
  RezFireLayout.renderSidebar("produtos");
  products = RezFireData.loadProducts();
  bindEvents();
  renderTable();
}

init();
