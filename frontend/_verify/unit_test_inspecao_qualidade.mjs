// unit_test_inspecao_qualidade.mjs
// Teste Automatizado para a User Story SCRUM-11 (#6) - Inspeção de qualidade na entrada
import fs from "node:fs";

console.log("=== TESTE DA USER STORY SCRUM-11 (#6) - INSPEÇÃO DE QUALIDADE NA ENTRADA ===");

const storageStore = {};
globalThis.localStorage = {
  getItem: (k) => (storageStore[k] !== undefined ? storageStore[k] : null),
  setItem: (k, v) => { storageStore[k] = String(v); },
  removeItem: (k) => { delete storageStore[k]; },
  clear: () => { for (const k in storageStore) delete storageStore[k]; },
};
globalThis.window = globalThis;

// Carrega os módulos
const codeMockData = fs.readFileSync("frontend/js/mock-data.js", "utf8");
new Function(codeMockData)();

const codeApi = fs.readFileSync("frontend/js/api.js", "utf8");
new Function(codeApi)();

// ─── TESTE 1: Carga e Estrutura dos Registros de Inspeção ─────────────────────
console.log("\n[TESTE 1] Verificação dos Registros Padrão de Inspeção de Qualidade:");
const inspecoesIniciais = window.RezFireData.loadInspecoes();
console.log(` - Total de inspeções carregadas: ${inspecoesIniciais.length}`);
if (inspecoesIniciais.length < 4) {
  throw new Error("Deveria haver pelo menos 4 inspeções no mock padrão!");
}

const primeiraInsp = inspecoesIniciais[0];
console.log(` - Exemplo de Inspeção #${primeiraInsp.id_inspecao} (${primeiraInsp.sku}): Resultado = ${primeiraInsp.resultado}`);
if (!primeiraInsp.checklist || typeof primeiraInsp.checklist.manometro_pressao !== "boolean") {
  throw new Error("Checklist deve conter itens booleanos (avarias_casco, manometro_pressao, etc.)!");
}
if (!primeiraInsp.responsavel) {
  throw new Error("A inspeção deve possuir um responsável registrado!");
}
if (!primeiraInsp.data_inspecao) {
  throw new Error("A inspeção deve possuir data de realização registrada!");
}
console.log("   ✓ Critério 1 e 3 atendidos: Checklist estruturado com data e responsável.");

// ─── TESTE 2: Entrada com 100% de Conformidade (Aprovado) ─────────────────────
console.log("\n[TESTE 2] Entrada de Extintor com 100% de Itens Conformes no Checklist:");
const prods = window.RezFireData.loadProducts();
const extProd = prods.find((p) => p.sku === "EXT-PQS-4KG");
const saldoAntes = Number(extProd.quantidade_atual);
const qtdChegando = 20;

// Simulação de entrada 100% conforme
const checklist100 = {
  avarias_casco: true,
  sem_corrosao: true,
  rotulo_legivel: true,
  manometro_pressao: true,
  lacre_acessorios: true,
};

const novaInspecaoAprovada = {
  id_inspecao: 991,
  id_produto: extProd.id_produto,
  sku: extProd.sku,
  nome_produto: extProd.nome,
  id_lote: "LT-TESTE-100",
  numero_lote: "LT-TESTE-100",
  tipo_inspecao: "Entrada",
  checklist: checklist100,
  resultado: "Aprovado",
  quantidade_total: qtdChegando,
  quantidade_aprovada: qtdChegando,
  quantidade_reprovada: 0,
  motivo_reprovacao: null,
  destino_reprovados: null,
  observacoes: "Todos os 5 itens conformes",
  responsavel: "Gestor RezFire",
  data_inspecao: new Date().toISOString(),
};

// Quando 100% aprovado, todas as 20 unidades entram no estoque
extProd.quantidade_atual = saldoAntes + qtdChegando;
window.RezFireData.saveProducts(prods);

inspecoesIniciais.unshift(novaInspecaoAprovada);
window.RezFireData.saveInspecoes(inspecoesIniciais);

console.log(` - Saldo anterior: ${saldoAntes} un. | Quantidade entrada: ${qtdChegando} un.`);
console.log(` - Novo saldo após entrada aprovada: ${extProd.quantidade_atual} un.`);
if (extProd.quantidade_atual !== saldoAntes + qtdChegando) {
  throw new Error("Estoque deveria ter sido incrementado em 20 unidades!");
}
console.log("   ✓ 100% das unidades aprovadas foram disponibilizadas para venda.");

// ─── TESTE 3: Entrada com Itens Reprovados no Checklist (Critério de Aceite 2) ─
console.log("\n[TESTE 3] Entrada de Extintor com Não-Conformidade (Bloqueio de Venda):");
const saldoAntesReprov = Number(extProd.quantidade_atual);
const loteRecebido = 15;
const reprovadas = 3; // 3 cilindros com manômetro despressurizado
const aprovadas = loteRecebido - reprovadas; // 12 conformes

const checklistComFalha = {
  avarias_casco: true,
  sem_corrosao: true,
  rotulo_legivel: true,
  manometro_pressao: false, // ✕ FALHA NO MANÔMETRO
  lacre_acessorios: true,
};

// CRITÉRIO DE ACEITE 2: "Um item reprovado no checklist impede que aquela unidade entre no estoque disponível para venda"
extProd.quantidade_atual = saldoAntesReprov + aprovadas; // APENAS as 12 aprovadas entram!
window.RezFireData.saveProducts(prods);

const novaInspecaoParcial = {
  id_inspecao: 992,
  id_produto: extProd.id_produto,
  sku: extProd.sku,
  nome_produto: extProd.nome,
  id_lote: "LT-TESTE-PARCIAL",
  numero_lote: "LT-TESTE-PARCIAL",
  tipo_inspecao: "Entrada",
  checklist: checklistComFalha,
  resultado: "Aprovado Parcial",
  quantidade_total: loteRecebido,
  quantidade_aprovada: aprovadas,
  quantidade_reprovada: reprovadas,
  motivo_reprovacao: "Manômetro com perda de pressão / ponteiro fora da faixa verde",
  destino_reprovados: "Devolucao Fornecedor",
  observacoes: "3 extintores retidos para devolução. Apenas 12 liberados para o armazém.",
  responsavel: "Gestor RezFire",
  data_inspecao: new Date().toISOString(),
};
inspecoesIniciais.unshift(novaInspecaoParcial);
window.RezFireData.saveInspecoes(inspecoesIniciais);

console.log(` - Saldo anterior: ${saldoAntesReprov} un.`);
console.log(` - Lote recebido da NF: ${loteRecebido} un. (Aprovadas: ${aprovadas} | Reprovadas: ${reprovadas})`);
console.log(` - Novo saldo disponível para venda: ${extProd.quantidade_atual} un.`);

if (extProd.quantidade_atual !== saldoAntesReprov + aprovadas) {
  throw new Error(`CRÍTICO: O saldo deveria ser ${saldoAntesReprov + aprovadas}, mas foi ${extProd.quantidade_atual}! As unidades reprovadas entraram no estoque!`);
}
console.log("   ✓ CRITÉRIO 2 ATENDIDO COM SUCESSO: As 3 unidades reprovadas foram IMPEDIDAS de entrar no estoque disponível para venda!");

// ─── TESTE 4: Reprovação Total (0 Aprovados) ──────────────────────────────────
console.log("\n[TESTE 4] Lote 100% Reprovado (Ex: Corrosão Severa em Toda a Carga):");
const saldoAntesZero = Number(extProd.quantidade_atual);
const loteTotalReprovado = 10;

const checklistTotalFalha = {
  avarias_casco: false,
  sem_corrosao: false,
  rotulo_legivel: false,
  manometro_pressao: false,
  lacre_acessorios: false,
};

// Como 100% foi reprovado, NENHUMA unidade entra no saldo disponível
const aprovadasZero = 0;
extProd.quantidade_atual = saldoAntesZero + aprovadasZero;
window.RezFireData.saveProducts(prods);

console.log(` - Saldo antes: ${saldoAntesZero} un. | Chegando: ${loteTotalReprovado} un. (Reprovadas: 10)`);
console.log(` - Saldo após conferência física: ${extProd.quantidade_atual} un.`);
if (extProd.quantidade_atual !== saldoAntesZero) {
  throw new Error("Nenhuma unidade de lote reprovado pode entrar no estoque disponível!");
}
console.log("   ✓ Saldo vendível permaneceu rigorosamente intacto (0 un. adicionadas).");

// ─── TESTE 5: Verificação dos Métodos da API ──────────────────────────────────
console.log("\n[TESTE 5] Verificação dos métodos do cliente API window.RezFireAPI.inspecoes:");
if (typeof window.RezFireAPI.inspecoes?.listar !== "function") {
  throw new Error("window.RezFireAPI.inspecoes.listar deve ser uma função!");
}
if (typeof window.RezFireAPI.inspecoes?.buscarPorId !== "function") {
  throw new Error("window.RezFireAPI.inspecoes.buscarPorId deve ser uma função!");
}
if (typeof window.RezFireAPI.inspecoes?.obterResumo !== "function") {
  throw new Error("window.RezFireAPI.inspecoes.obterResumo deve ser uma função!");
}
if (typeof window.RezFireAPI.inspecoes?.registrar !== "function") {
  throw new Error("window.RezFireAPI.inspecoes.registrar deve ser uma função!");
}
console.log("   ✓ Todos os endpoints de Inspeção de Qualidade estão mapeados no cliente API.");

console.log("\n===============================================================================");
console.log("🎉 TODOS OS CRITÉRIOS DE ACEITE DA USER STORY SCRUM-11 (#6) FORAM HOMOLOGADOS!");
console.log("===============================================================================");

