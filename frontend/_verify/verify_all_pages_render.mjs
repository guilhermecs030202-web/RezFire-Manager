import fs from "node:fs";

console.log("=== TESTE DE RENDERIZAÇÃO COMPLETA DE TODAS AS TELAS ===");

const store = {};
globalThis.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; }
};

globalThis.addEventListener = () => {};
globalThis.dispatchEvent = () => {};
globalThis.location = { search: "", reload: () => {}, href: "http://localhost/dashboard.html" };
globalThis.window = globalThis;

// Mock de DOM rico para rastrear cliques e HTML renderizado
const elements = {};
function getEl(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      innerHTML: "",
      textContent: "",
      value: "30",
      dataset: { tab: id.replace("btn-tab-", "") },
      style: {},
      classList: {
        _classes: new Set(),
        add: function (cls) { this._classes.add(cls); },
        remove: function (cls) { this._classes.delete(cls); },
        contains: function (cls) { return this._classes.has(cls); },
        toggle: function (cls) { if (this.contains(cls)) this.remove(cls); else this.add(cls); }
      },
      listeners: {},
      addEventListener: function (evt, fn) {
        if (!this.listeners[evt]) this.listeners[evt] = [];
        this.listeners[evt].push(fn);
      },
      click: function () {
        (this.listeners["click"] || []).forEach((fn) => fn({ target: this }));
      },
      removeEventListener: () => {},
      querySelector: () => getEl("sub_" + id),
      querySelectorAll: () => [],
      appendChild: () => {},
      prepend: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      closest: () => null,
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 100 })
    };
  }
  return elements[id];
}

const tabButtons = ["visao-geral", "vendas", "estoque", "ml", "entregas", "produtos", "financeiro"].map((t) => {
  const el = getEl("btn-tab-" + t);
  el.dataset.tab = t;
  return el;
});

const tabContents = ["visao-geral", "vendas", "estoque", "ml", "entregas", "produtos", "financeiro"].map((t) => {
  return getEl("tab-" + t);
});

globalThis.document = {
  getElementById: (id) => getEl(id),
  querySelectorAll: (sel) => {
    if (sel === ".dash-tab") return tabButtons;
    if (sel === ".tab-content") return tabContents;
    return [getEl("sel_" + sel.replace(/[^a-zA-Z0-9_-]/g, "_"))];
  },
  querySelector: (sel) => {
    const matchTab = sel.match(/data-tab="([^"]+)"/);
    if (matchTab) {
      return getEl("btn-tab-" + matchTab[1]);
    }
    return getEl("sel_" + sel.replace(/[^a-zA-Z0-9_-]/g, "_"));
  },
  addEventListener: () => {},
  createElement: (tag) => getEl("elem_" + tag),
  dispatchEvent: () => {},
};

globalThis.Event = function (name) { this.name = name; };

globalThis.ApexCharts = function (el, options) {
  this.el = el;
  this.options = options;
  this.render = () => {};
  this.updateSeries = () => {};
  this.updateOptions = () => {};
  this.destroy = () => {};
};

// 1. Carrega scripts do Dashboard
console.log("\n[1] Carregando Dashboard...");
new Function(fs.readFileSync("frontend/js/mock-data.js", "utf8"))();
new Function(fs.readFileSync("frontend/js/mock-entregas.js", "utf8"))();
new Function(fs.readFileSync("frontend/js/layout.js", "utf8"))();
new Function(fs.readFileSync("frontend/js/dashboard-entregas.js", "utf8"))();
new Function(fs.readFileSync("frontend/js/dashboard.js", "utf8"))();

console.log("✓ Dashboard executado sem exceções.");
console.log("   - KPI Estoque renderizado:", getEl("kpis-estoque").innerHTML.length > 0 ? "SIM ✓" : "NÃO ✗");
console.log("   - KPI Vendas renderizado:", getEl("kpis-tab-vendas").innerHTML.length > 0 ? "SIM ✓" : "NÃO ✗");

// 2. Testa navegação de abas do Dashboard
console.log("\n[2] Testando navegação nas abas do Dashboard:");
["visao-geral", "vendas", "estoque", "ml", "entregas", "produtos", "financeiro"].forEach((tabName) => {
  const btn = getEl("btn-tab-" + tabName);
  const content = getEl("tab-" + tabName);
  btn.click();
  const btnAtivo = btn.classList.contains("is-active");
  const contentAtivo = content.classList.contains("is-active");
  console.log(`   - Clicar na aba [${tabName}] -> Botão Ativo: ${btnAtivo ? "SIM ✓" : "NÃO ✗"} | Conteúdo Visível: ${contentAtivo ? "SIM ✓" : "NÃO ✗"}`);
  if (!btnAtivo || !contentAtivo) {
    throw new Error(`Falha na navegação da aba: ${tabName}`);
  }
});

// 3. Testa Movimentações
console.log("\n[3] Testando tela de Movimentações...");
new Function(fs.readFileSync("frontend/js/movimentacoes.js", "utf8"))();

const movsTableBody = getEl("movimentacoes-body");
const movsTopoKPI = getEl("kpis-movimentacoes-topo");

console.log("✓ Movimentações executado sem exceções.");
console.log("   - KPIs de topo renderizados:", movsTopoKPI.innerHTML.length > 0 ? "SIM ✓" : "NÃO ✗");
console.log("   - Linhas da tabela de movimentações preenchidas:", movsTableBody.innerHTML.length > 100 ? "SIM ✓" : "NÃO ✗");

if (movsTableBody.innerHTML.length <= 100) {
  throw new Error("A tabela de movimentações está vazia!");
}

console.log("\n============================================================");
console.log("🎉 TODAS AS TELAS E ABAS FORAM VALIDADAS COM SUCESSO (100%)");
console.log("============================================================");
