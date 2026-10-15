const MOVIMENTACOES_KEY = "rezfire.movimentacoes";

let movements = [];
let products = [];
let query = "";

function loadMovements() {
  const raw = localStorage.getItem(MOVIMENTACOES_KEY);
  if (raw) {
    return JSON.parse(raw);
  }
  // Initial mock data if empty
  return [
    {
      id_movimentacao: 1,
      id_produto: 1,
      tipo: "Entrada",
      motivo: "Nota Fiscal",
      quantidade: 100,
      data: new Date(Date.now() - 86400000 * 2).toISOString(),
      responsavel: "Gestor RezFire",
    },
    {
      id_movimentacao: 2,
      id_produto: 2,
      tipo: "Saída",
      motivo: "Venda Mercado Livre",
      quantidade: 5,
      data: new Date(Date.now() - 86400000).toISOString(),
      responsavel: "Gestor RezFire",
    }
  ];
}

function saveMovements(movs) {
  localStorage.setItem(MOVIMENTACOES_KEY, JSON.stringify(movs));
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderTable() {
  const body = document.getElementById("movimentacoes-body");
  
  let filtered = movements;
  if (query) {
    const term = query.toLowerCase();
    filtered = movements.filter((m) => {
      const prod = products.find(p => p.id_produto === m.id_produto);
      const prodStr = prod ? `${prod.sku} ${prod.nome}`.toLowerCase() : "";
      return prodStr.includes(term) || m.motivo.toLowerCase().includes(term);
    });
  }

  // Sort descending by date
  filtered.sort((a, b) => new Date(b.data) - new Date(a.data));

  document.getElementById("movimentacoes-count").textContent = `${filtered.length} registros encontrados`;

  if (!filtered.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="6">Nenhuma movimentação encontrada.</td></tr>`;
    return;
  }

  body.innerHTML = filtered
    .map((m) => {
      const prod = products.find((p) => p.id_produto === m.id_produto);
      const prodText = prod ? `<span class="sku-main">${prod.sku}</span><span class="sku-sub">${prod.nome}</span>` : "Produto Excluído";
      const isEntrada = m.tipo === "Entrada";
      return `
        <tr>
          <td class="text-gray-500 whitespace-nowrap text-sm">${formatDate(m.data)}</td>
          <td>
            <div class="flex flex-col">
              ${prodText}
            </div>
          </td>
          <td><span class="status-pill ${isEntrada ? 'on' : ''}" style="${!isEntrada ? 'background-color:#fee2e2;color:#991b1b' : ''}">${m.tipo}</span></td>
          <td>${m.motivo}</td>
          <td class="font-bold ${isEntrada ? 'text-green-700' : 'text-red-700'}">${isEntrada ? '+' : '-'}${m.quantidade}</td>
          <td class="text-sm text-gray-600">${m.responsavel}</td>
        </tr>
      `;
    })
    .join("");
}

function updateMotivosOptions() {
  const tipo = document.getElementById("tipo").value;
  const motivoSelect = document.getElementById("motivo");
  
  if (tipo === "Entrada") {
    motivoSelect.innerHTML = `
      <option value="Nota Fiscal (Abastecimento)">Nota Fiscal (Abastecimento)</option>
      <option value="Devolução">Devolução</option>
      <option value="Ajuste Manual">Ajuste Manual</option>
    `;
  } else {
    motivoSelect.innerHTML = `
      <option value="Venda Mercado Livre">Venda Mercado Livre</option>
      <option value="Venda Direta">Venda Direta</option>
      <option value="Avaria / Perda">Avaria / Perda</option>
      <option value="Ajuste Manual">Ajuste Manual</option>
    `;
  }
}

function openModal() {
  document.getElementById("form-error").textContent = "";
  
  // Populate products
  const select = document.getElementById("id_produto");
  select.innerHTML = `<option value="">Selecione o produto...</option>` + 
    products.map(p => `<option value="${p.id_produto}">${p.sku} - ${p.nome}</option>`).join("");
    
  document.getElementById("tipo").value = "Entrada";
  updateMotivosOptions();
  document.getElementById("quantidade").value = 1;

  document.getElementById("modal").classList.add("is-open");
}

function closeModal() {
  document.getElementById("modal").classList.remove("is-open");
}

function bindEvents() {
  document.getElementById("busca").addEventListener("input", (event) => {
    query = event.target.value;
    renderTable();
  });

  document.getElementById("btn-nova-movimentacao").addEventListener("click", openModal);
  document.getElementById("btn-cancelar").addEventListener("click", closeModal);
  document.getElementById("modal").addEventListener("click", (event) => {
    if (event.target.id === "modal") closeModal();
  });

  document.getElementById("tipo").addEventListener("change", updateMotivosOptions);

  document.getElementById("form-movimentacao").addEventListener("submit", (event) => {
    event.preventDefault();
    const idProduto = Number(document.getElementById("id_produto").value);
    const tipo = document.getElementById("tipo").value;
    const motivo = document.getElementById("motivo").value;
    const qtd = Number(document.getElementById("quantidade").value);

    if (!idProduto) {
      document.getElementById("form-error").textContent = "Selecione um produto.";
      return;
    }
    if (!Number.isInteger(qtd) || qtd < 1) {
      document.getElementById("form-error").textContent = "Quantidade deve ser um número inteiro maior que zero.";
      return;
    }

    // Check stock if it's a Saída
    const product = products.find(p => p.id_produto === idProduto);
    if (tipo === "Saída" && product.quantidade_atual < qtd) {
      document.getElementById("form-error").textContent = `Estoque insuficiente. Quantidade atual: ${product.quantidade_atual}`;
      return;
    }

    // Register movement
    const newMov = {
      id_movimentacao: Date.now(),
      id_produto: idProduto,
      tipo,
      motivo,
      quantidade: qtd,
      data: new Date().toISOString(),
      responsavel: "Gestor RezFire",
    };

    movements.push(newMov);
    saveMovements(movements);

    // Update product stock
    if (tipo === "Entrada") {
      product.quantidade_atual += qtd;
    } else {
      product.quantidade_atual -= qtd;
    }
    RezFireData.saveProducts(products);

    closeModal();
    renderTable();
  });
}

function init() {
  RezFireLayout.renderSidebar("movimentacoes");
  products = RezFireData.loadProducts();
  movements = loadMovements();
  bindEvents();
  renderTable();
}

init();
