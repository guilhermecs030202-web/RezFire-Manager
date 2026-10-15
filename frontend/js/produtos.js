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
    body.innerHTML = `<tr class="empty-row"><td colspan="7">Nenhum produto encontrado.</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map((p) => {
      return `
        <tr>
          <td>
            <span class="sku-main">${escapeHtml(p.sku)}</span>
            <span class="sku-sub">ID ${p.id_produto}</span>
          </td>
          <td class="prod-name">${escapeHtml(p.nome)}</td>
          <td>${escapeHtml(p.categoria || "Sem Categoria")}</td>
          <td>${p.tipo === "Combo" ? '<span class="status-pill on">Combo</span>' : 'Simples'}</td>
          <td>${RezFireData.formatMoney(Number(p.custo || 0))}</td>
          <td>${RezFireData.formatMoney(Number(p.preco))}</td>
          <td><span class="status-pill ${p.ativo ? "on" : ""}">${p.ativo ? "Ativo" : "Inativo"}</span></td>
          <td>
            <div class="flex gap-2">
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

function openModal(product) {
  const modal = document.getElementById("modal");
  const title = document.getElementById("modal-title");
  document.getElementById("form-error").textContent = "";
  document.getElementById("id_produto").value = product ? product.id_produto : "";
  document.getElementById("sku").value = product ? product.sku : "";
  document.getElementById("nome").value = product ? product.nome : "";
  document.getElementById("descricao").value = product ? product.descricao : "";
  document.getElementById("custo").value = product ? (product.custo || 0) : "";
  document.getElementById("preco").value = product ? product.preco : "";
  document.getElementById("categoria").value = product ? (product.categoria || "") : "";
  document.getElementById("tipo").value = product ? (product.tipo || "Simples") : "Simples";
  document.getElementById("ativo").value = product && product.ativo === false ? "false" : "true";
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

  document.getElementById("form-produto").addEventListener("submit", (event) => {
    event.preventDefault();
    const editingId = Number(document.getElementById("id_produto").value) || null;
    const payload = readForm();
    const error = validateForm(payload, editingId);
    document.getElementById("form-error").textContent = error;
    if (error) return;

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
