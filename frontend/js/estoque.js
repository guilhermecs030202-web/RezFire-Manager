const pencilIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

let products = [];
let query = "";

function saldoClass(product) {
  const qty = Number(product.quantidade_atual);
  if (qty <= 0) return "zero";
  if (qty <= Number(product.estoque_minimo)) return "low";
  return "ok";
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
  const body = document.getElementById("estoque-body");
  const rows = filteredProducts();
  document.getElementById("estoque-count").textContent = `${products.length} produtos monitorados`;

  if (!rows.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="6">Nenhum produto encontrado.</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map((p) => {
      const chip = saldoClass(p);
      const statusText = chip === "zero" ? "Sem Estoque" : (chip === "low" ? "Estoque Baixo" : "Normal");
      // using the same style logic from the original design
      return `
        <tr>
          <td>
            <span class="sku-main">${escapeHtml(p.sku)}</span>
          </td>
          <td class="prod-name">${escapeHtml(p.nome)}</td>
          <td><span class="saldo-chip ${chip}">${p.quantidade_atual}</span></td>
          <td>${p.estoque_minimo}</td>
          <td><span class="status-pill ${chip === 'ok' ? 'on' : ''}">${statusText}</span></td>
          <td>
            <div class="flex gap-2">
              <button class="icon-btn" type="button" data-edit="${p.id_produto}" title="Ajustar Estoque">
                ${pencilIcon}
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
  document.getElementById("form-error").textContent = "";
  document.getElementById("id_produto").value = product.id_produto;
  document.getElementById("quantidade_atual").value = product.quantidade_atual;
  document.getElementById("estoque_minimo").value = product.estoque_minimo;
  modal.classList.add("is-open");
  document.getElementById("quantidade_atual").focus();
}

function closeModal() {
  document.getElementById("modal").classList.remove("is-open");
}

function bindEvents() {
  document.getElementById("busca").addEventListener("input", (event) => {
    query = event.target.value;
    renderTable();
  });

  document.getElementById("btn-cancelar").addEventListener("click", closeModal);
  document.getElementById("modal").addEventListener("click", (event) => {
    if (event.target.id === "modal") closeModal();
  });

  document.getElementById("estoque-body").addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-edit]");
    if (editBtn) {
      const id = Number(editBtn.getAttribute("data-edit"));
      const product = products.find((p) => p.id_produto === id);
      if (product) openModal(product);
    }
  });

  document.getElementById("form-estoque").addEventListener("submit", (event) => {
    event.preventDefault();
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

    products = products.map((p) =>
      p.id_produto === editingId ? { ...p, quantidade_atual: qtdAtual, estoque_minimo: estqMin } : p
    );

    RezFireData.saveProducts(products);
    closeModal();
    renderTable();
  });
}

function init() {
  RezFireLayout.renderSidebar("estoque");
  products = RezFireData.loadProducts();
  bindEvents();
  renderTable();
}

init();
