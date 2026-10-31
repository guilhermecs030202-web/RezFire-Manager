// estoqueLogic.js
// Funções de frontend para registrar entradas e saídas de estoque, calcular saldo e exibir histórico.

import { store } from "./store.js";

// -------------------------------------------------------------------
// Calcula o saldo atual de cada produto a partir das movimentações persistidas
// -------------------------------------------------------------------
export function calcularSaldos(produtos) {
  const saldoMap = {};
  produtos.forEach(p => (saldoMap[p.id_produto] = 0));
  store.state.movimentacoes.forEach(m => {
    const id = m.id_produto;
    if (saldoMap[id] === undefined) return; // produto desconhecido
    if (m.tipo === "entrada") saldoMap[id] += Number(m.quantidade);
    else if (m.tipo === "saida") saldoMap[id] -= Number(m.quantidade);
  });
  // retorna nova lista com campo saldo_atual
  return produtos.map(p => ({ ...p, saldo_atual: saldoMap[p.id_produto] ?? 0 }));
}

// -------------------------------------------------------------------
// Registra uma movimentação de estoque (entrada ou saída)
// -------------------------------------------------------------------
export function registrarMovimentacao({ tipo, data, id_produto, quantidade, motivo = "" }) {
  if (!["entrada", "saida"].includes(tipo)) {
    console.error("Tipo de movimentação inválido:", tipo);
    return;
  }
  const novaMov = {
    id_movimentacao: Date.now(), // id simples baseado em timestamp
    tipo,
    data_movimentacao: data,
    id_produto,
    quantidade: Number(quantidade),
    motivo,
  };
  const novoArray = [...store.state.movimentacoes, novaMov];
  store.setState("movimentacoes", novoArray);
  // notifica quaisquer telas que precisam reagir
  store.emit("novaMovimentacao", novaMov);

  // Atualiza o saldo no próprio produto (para UI imediata)
  // Supondo que produtos estejam carregados via window.RezFireData
  if (window.RezFireData) {
    const prods = window.RezFireData.loadProducts();
    const idx = prods.findIndex(p => p.id_produto === id_produto);
    if (idx !== -1) {
      const delta = tipo === "entrada" ? Number(quantidade) : -Number(quantidade);
      prods[idx].quantidade_atual = (Number(prods[idx].quantidade_atual) || 0) + delta;
      window.RezFireData.saveProducts(prods);
    }
  }
}

// -------------------------------------------------------------------
// Renderiza a lista de produtos com saldo e os botões de entrada/saída
// -------------------------------------------------------------------
export function renderEstoqueTabela(produtos) {
  const tbody = document.querySelector("#estoque-produtos tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  produtos.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="px-2 py-1">${p.id_produto}</td>
      <td class="px-2 py-1">${p.sku}</td>
      <td class="px-2 py-1">${p.nome}</td>
      <td class="px-2 py-1 text-center">${p.saldo_atual}</td>
      <td class="px-2 py-1">
        <button class="btn-entrada bg-green-500 text-white px-2 py-1 rounded" data-id="${p.id_produto}">Entrada</button>
        <button class="btn-saida bg-red-500 text-white px-2 py-1 rounded" data-id="${p.id_produto}">Saída</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // eventos dos botões
  tbody.querySelectorAll(".btn-entrada").forEach(btn => {
    btn.addEventListener("click", () => abrirModalEntrada(btn.dataset.id));
  });
  tbody.querySelectorAll(".btn-saida").forEach(btn => {
    btn.addEventListener("click", () => abrirModalSaida(btn.dataset.id));
  });
}

// -------------------------------------------------------------------
// Modais simples (utiliza elementos já existentes na página HTML)
// -------------------------------------------------------------------
function abrirModalEntrada(prodId) {
  const modal = document.getElementById("modal-entrada");
  if (!modal) return;
  modal.querySelector("#entrada-produto").value = prodId;
  modal.classList.add("is-open");
}

function abrirModalSaida(prodId) {
  const modal = document.getElementById("modal-saida");
  if (!modal) return;
  modal.querySelector("#saida-produto").value = prodId;
  modal.classList.add("is-open");
}

function fecharModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("is-open");
}

// -------------------------------------------------------------------
// Bind dos formulários de entrada/saída
// -------------------------------------------------------------------
export function bindEstoqueForms() {
  const entradaForm = document.getElementById("form-entrada");
  const saidaForm = document.getElementById("form-saida");
  const fecharEntrada = document.getElementById("fechar-entrada");
  const fecharSaida = document.getElementById("fechar-saida");

  entradaForm?.addEventListener("submit", e => {
    e.preventDefault();
    const data = e.target.querySelector("#entrada-data").value;
    const id_produto = Number(e.target.querySelector("#entrada-produto").value);
    const quantidade = Number(e.target.querySelector("#entrada-qtde").value);
    if (!data || !id_produto || quantidade <= 0) {
      alert("Preencha todos os campos da entrada.");
      return;
    }
    registrarMovimentacao({ tipo: "entrada", data, id_produto, quantidade });
    e.target.reset();
    fecharModal("modal-entrada");
    atualizarUI();
  });

  saidaForm?.addEventListener("submit", e => {
    e.preventDefault();
    const data = e.target.querySelector("#saida-data").value;
    const id_produto = Number(e.target.querySelector("#saida-produto").value);
    const quantidade = Number(e.target.querySelector("#saida-qtde").value);
    const motivo = e.target.querySelector("#saida-motivo").value.trim();
    if (!data || !id_produto || quantidade <= 0 || !motivo) {
      alert("Preencha todos os campos da saída, incluindo o motivo.");
      return;
    }
    registrarMovimentacao({ tipo: "saida", data, id_produto, quantidade, motivo });
    e.target.reset();
    fecharModal("modal-saida");
    atualizarUI();
  });

  fecharEntrada?.addEventListener("click", () => fecharModal("modal-entrada"));
  fecharSaida?.addEventListener("click", () => fecharModal("modal-saida"));
}

// -------------------------------------------------------------------
// Atualiza toda a UI da tela de estoque
// -------------------------------------------------------------------
export function atualizarUI() {
  const produtos = window.RezFireData ? window.RezFireData.loadProducts() : [];
  const comSaldo = calcularSaldos(produtos);
  renderEstoqueTabela(comSaldo);
  renderHistoricoMov();
}

function renderHistoricoMov() {
  const tbody = document.querySelector("#estoque-historico tbody");
  if (!tbody) return;
  const movs = store.state.movimentacoes.slice().reverse();
  tbody.innerHTML = "";
  movs.forEach(m => {
    const tr = document.createElement("tr");
    const dataFmt = new Date(m.data_movimentacao).toLocaleString("pt-BR");
    const tipoCls = m.tipo === "entrada" ? "badge-entrada" : "badge-saida";
    tr.innerHTML = `
      <td class="px-2 py-1">${m.id_movimentacao}</td>
      <td class="px-2 py-1">${m.id_produto}</td>
      <td class="px-2 py-1"><span class="${tipoCls}">${m.tipo}</span></td>
      <td class="px-2 py-1 text-center">${m.quantidade}</td>
      <td class="px-2 py-1">${m.motivo || "-"}</td>
      <td class="px-2 py-1">${dataFmt}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Expor funções úteis para depuração
window.Estoque = {
  registrarMovimentacao,
  calcularSaldos,
  atualizarUI,
};

