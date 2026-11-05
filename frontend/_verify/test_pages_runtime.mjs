import fs from "node:fs";

console.log("=== SIMULANDO EXECUÇÃO COMPLETA NO BROWSER ===");

const store = {};
globalThis.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; }
};

globalThis.addEventListener = () => {};
globalThis.location = { search: "", reload: () => {}, href: "http://localhost/dashboard.html" };
globalThis.window = globalThis;

const elements = {};
function getEl(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      innerHTML: "",
      textContent: "",
      value: "30",
      style: {},
      dataset: {}, classList: {
        add: () => {},
        remove: () => {},
        contains: () => false,
        toggle: () => {}
      },
      addEventListener: () => {},
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

globalThis.document = {
  getElementById: getEl,
  querySelectorAll: (sel) => [getEl("sel_" + sel)],
  querySelector: (sel) => getEl("sel_" + sel),
  addEventListener: () => {},
  createElement: (tag) => getEl("elem_" + tag),
};

globalThis.ApexCharts = function () {
  return {
    render: () => {},
    updateSeries: () => {},
    updateOptions: () => {},
    destroy: () => {}
  };
};

console.log("\n1. Testando Dashboard...");
try {
  new Function(fs.readFileSync("frontend/js/mock-data.js", "utf8"))();
  new Function(fs.readFileSync("frontend/js/mock-entregas.js", "utf8"))();
  new Function(fs.readFileSync("frontend/js/layout.js", "utf8"))();
  new Function(fs.readFileSync("frontend/js/dashboard-entregas.js", "utf8"))();
  new Function(fs.readFileSync("frontend/js/dashboard.js", "utf8"))();
  console.log("✓ DASHBOARD CARREGOU E EXECUTOU SEM NENHUM ERRO!");
} catch (err) {
  console.error("FALHA NO DASHBOARD:", err);
}

console.log("\n2. Testando Movimentações...");
try {
  new Function(fs.readFileSync("frontend/js/movimentacoes.js", "utf8"))();
  console.log("✓ MOVIMENTAÇÕES CARREGOU E EXECUTOU SEM NENHUM ERRO!");
} catch (err) {
  console.error("FALHA EM MOVIMENTAÇÕES:", err);
}

console.log("\n3. Testando Pedidos...");
try {
  new Function(fs.readFileSync("frontend/js/pedidos.js", "utf8"))();
  console.log("✓ PEDIDOS CARREGOU E EXECUTOU SEM NENHUM ERRO!");
} catch (err) {
  console.error("FALHA EM PEDIDOS:", err);
}
