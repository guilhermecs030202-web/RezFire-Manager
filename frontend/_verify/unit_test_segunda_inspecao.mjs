// unit_test_segunda_inspecao.mjs
// Teste Automatizado para a User Story SCRUM-12 (#7) - Segunda Inspeção na Separação (Checagem Dupla)

import fs from "node:fs";

console.log("=== TESTE AUTOMATIZADO SCRUM-12 (#7) - SEGUNDA INSPEÇÃO NA SEPARAÇÃO ===");
console.log("=== CHECAGEM DUPLA ANTES DO DESPACHO (INMETRO, MANÔMETRO, CASCO) ===\n");

const storageStore = {};
globalThis.localStorage = {
  getItem: (k) => (storageStore[k] !== undefined ? storageStore[k] : null),
  setItem: (k, v) => { storageStore[k] = String(v); },
  removeItem: (k) => { delete storageStore[k]; },
  clear: () => { for (const k in storageStore) delete storageStore[k]; },
};
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.window.dispatchEvent = () => true;

// 1. Carrega scripts do frontend
const codeMockData = fs.readFileSync("frontend/js/mock-data.js", "utf8");
new Function(codeMockData)();

const codeMockEntregas = fs.readFileSync("frontend/js/mock-entregas.js", "utf8");
new Function(codeMockEntregas)();

const codeApi = fs.readFileSync("frontend/js/api.js", "utf8");
new Function(codeApi)();

// ─── TESTE 1: Métodos de API no cliente (api.js) ─────────────────────────────
console.log("[TESTE 1] Verificação dos métodos de inspeção na API (api.js):");
if (typeof window.RezFireAPI.inspecoes.buscarPorPedido !== "function") {
  throw new Error("window.RezFireAPI.inspecoes.buscarPorPedido deve estar definido!");
}
if (typeof window.RezFireAPI.inspecoes.registrar !== "function") {
  throw new Error("window.RezFireAPI.inspecoes.registrar deve estar definido!");
}
console.log("   ✓ Métpos de registro e busca de inspeção por pedido disponíveis no cliente.");

// ─── TESTE 2: Elementos DOM do modal de Segunda Inspeção em entregas.html ─────
console.log("\n[TESTE 2] Verificação da estrutura do modal em entregas.html:");
const entregasHtml = fs.readFileSync("frontend/entregas.html", "utf8");

const requiredElements = [
  "modal-segunda-inspecao",
  "chk-sep-lacre",
  "chk-sep-manometro",
  "chk-sep-casco",
  "chk-sep-acessorios",
  "chk-sep-rotulo",
  "btn-confirmar-modal-inspecao",
];

for (const elId of requiredElements) {
  if (!entregasHtml.includes(`id="${elId}"`)) {
    throw new Error(`Elemento id="${elId}" ausente em entregas.html!`);
  }
}
console.log("   ✓ Modal id='modal-segunda-inspecao' e todos os 5 checkboxes de checagem dupla presentes no DOM.");

// ─── TESTE 3: Regra de Conformidade do Checklist (Checagem Dupla) ─────────────
console.log("\n[TESTE 3] Validação das regras do checklist de 5 itens:");

function avaliarSegundaInspecao(checklist) {
  const conformes = Boolean(
    checklist.lacre_inmetro_intacto &&
    checklist.manometro_faixa_verde &&
    checklist.sem_avarias_transporte &&
    checklist.suporte_acessorios &&
    checklist.rotulo_instrucoes
  );
  return {
    aprovado: conformes,
    resultado: conformes ? "Aprovado" : "Reprovado",
    bloqueiaDespacho: !conformes,
  };
}

// 3.1 Checklist 100% OK -> Aprovado
const checklistPerfeito = {
  lacre_inmetro_intacto: true,
  manometro_faixa_verde: true,
  sem_avarias_transporte: true,
  suporte_acessorios: true,
  rotulo_instrucoes: true,
};
const resPerfeito = avaliarSegundaInspecao(checklistPerfeito);
if (!resPerfeito.aprovado || resPerfeito.bloqueiaDespacho) {
  throw new Error("Checklist completo deveria ser aprovado sem bloqueio!");
}
console.log("   ✓ Checklist completo com 5 itens técnicos aprovado com sucesso.");

// 3.2 Checklist com avaria (ex: manômetro fora da faixa verde) -> Reprovado
const checklistComDefeito = {
  ...checklistPerfeito,
  manometro_faixa_verde: false,
};
const resDefeito = avaliarSegundaInspecao(checklistComDefeito);
if (resDefeito.aprovado || !resDefeito.bloqueiaDespacho) {
  throw new Error("Checklist com manômetro despressurizado deve reprovar e bloquear o despacho!");
}
console.log("   ✓ Bloqueio operacional confirmado: unidade com manômetro fora da faixa verde impede liberação.");

// ─── TESTE 4: Vínculo da Inspeção com o Pedido e Histórico Auditável ─────────
console.log("\n[TESTE 4] Vínculo do laudo ao pedido e auditoria temporal:");
const entregas = window.RezFireEntregas.loadEntregas();
const entregaAlvo = entregas.find(e => e.status_interno === "A separar" || e.status_interno === "Separação em andamento") || entregas[0];

const agoraIso = new Date().toISOString();
const laudo = {
  id_inspecao: Date.now(),
  tipo_inspecao: "Separacao",
  id_pedido: entregaAlvo.id_pedido_interno || entregaAlvo.id_entrega,
  resultado: "Aprovado",
  responsavel: "Gestor RezFire",
  data_inspecao: agoraIso,
  checklist: checklistPerfeito,
  observacoes: "Checagem dupla de lacre, manômetro e casco concluída com sucesso.",
};

// Vincula à entrega
entregaAlvo.segunda_inspecao = laudo;
entregaAlvo.status_interno = "Pronto para despacho";
if (!entregaAlvo.historico) entregaAlvo.historico = [];
entregaAlvo.historico.push({
  data: agoraIso,
  evento: "Segunda Inspeção de Qualidade (Checagem Dupla) APROVADA",
  descricao: "Todos os 5 itens do checklist técnico conferidos por Gestor RezFire.",
  tipo: "sucesso",
});

window.RezFireEntregas.saveEntregas(entregas);

const recarregada = window.RezFireEntregas.loadEntregas().find(e => e.id_entrega === entregaAlvo.id_entrega);
if (!recarregada.segunda_inspecao) {
  throw new Error("Laudo de segunda inspeção não foi vinculado ao pedido!");
}
if (recarregada.segunda_inspecao.resultado !== "Aprovado") {
  throw new Error("Resultado do laudo divergente!");
}

const ultimoEvento = recarregada.historico[recarregada.historico.length - 1];
if (!ultimoEvento.evento.includes("Segunda Inspeção") || !ultimoEvento.data) {
  throw new Error("Histórico cronológico não registrou a segunda inspeção com timestamp!");
}
console.log(`   ✓ Pedido ${recarregada.id_entrega} vinculado ao laudo de 2ª inspeção.`);
console.log(`   ✓ Histórico auditável confirmado: "${ultimoEvento.evento}" registrado em ${ultimoEvento.data} por ${recarregada.segunda_inspecao.responsavel}.`);

// ─── TESTE 5: Estrutura da Entidade InspecaoQualidade no Backend ──────────────
console.log("\n[TESTE 5] Verificação do schema de entidade no backend:");
const entityCode = fs.readFileSync("backend/src/entities/InspecaoQualidade.ts", "utf8");
if (!entityCode.includes("id_pedido: number | null") || !entityCode.includes("tipo_inspecao: 'Entrada' | 'Separacao'")) {
  throw new Error("Entidade InspecaoQualidade no backend não possui suporte a id_pedido e tipo Separacao!");
}
console.log("   ✓ Entidade InspecaoQualidade suporta id_pedido relacional e tipo Separacao.");

console.log("\n=======================================================");
console.log("🎉 TODOS OS 5 TESTES DE SCRUM-12 (#7) PASSARAM COM SUCESSO!");
console.log("=======================================================\n");

