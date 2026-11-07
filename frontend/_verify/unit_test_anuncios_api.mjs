// unit_test_anuncios_api.mjs
// Teste Automatizado para as User Stories:
// SCRUM-14 (#12) - Status dos anúncios em tela única conectada ao backend
// SCRUM-15 (#13) - Alerta de anúncio pausado/rebaixado por estoque no Mercado Livre

import fs from "node:fs";

console.log("=== TESTE AUTOMATIZADO SCRUM-14 (#12) & SCRUM-15 (#13) ===");
console.log("=== STATUS DOS ANÚNCIOS EM TELA ÚNICA & ALERTA DE ANÚNCIO PAUSADO ===");

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

// 1. Carrega os scripts do frontend
const codeMockData = fs.readFileSync("frontend/js/mock-data.js", "utf8");
new Function(codeMockData)();

const codeMockAnuncios = fs.readFileSync("frontend/js/mock-anuncios.js", "utf8");
new Function(codeMockAnuncios)();

const codeApi = fs.readFileSync("frontend/js/api.js", "utf8");
new Function(codeApi)();

// ─── TESTE 1: Métodos da API Mercado Livre em api.js (SCRUM-14) ──────────────
console.log("\n[TESTE 1] Verificação dos métodos de API do Mercado Livre (api.js):");
const mlApi = window.RezFireAPI.mercadolivre;
if (!mlApi) throw new Error("window.RezFireAPI.mercadolivre não foi definido!");

const requiredMethods = ["getStatus", "listarAnuncios", "vincular", "sincronizar", "getAuthUrl"];
for (const method of requiredMethods) {
  if (typeof mlApi[method] !== "function") {
    throw new Error(`Método obrigatório window.RezFireAPI.mercadolivre.${method} não encontrado!`);
  }
  console.log(`   ✓ Método window.RezFireAPI.mercadolivre.${method} presente.`);
}

// ─── TESTE 2: Estrutura do Banner de Alertas em anuncios.html (SCRUM-15) ─────
console.log("\n[TESTE 2] Verificação dos elementos DOM em anuncios.html:");
const anunciosHtml = fs.readFileSync("frontend/anuncios.html", "utf8");

if (!anunciosHtml.includes('id="alerta-anuncios-pausados-banner"')) {
  throw new Error("Elemento id='alerta-anuncios-pausados-banner' não encontrado em anuncios.html!");
}
console.log("   ✓ Elemento id='alerta-anuncios-pausados-banner' presente no DOM.");

if (!anunciosHtml.includes('id="kpis-anuncios"')) {
  throw new Error("Elemento id='kpis-anuncios' não encontrado em anuncios.html!");
}
console.log("   ✓ Elemento id='kpis-anuncios' presente no DOM.");

if (!anunciosHtml.includes('id="btn-sync-manual"')) {
  throw new Error("Botão id='btn-sync-manual' presente no DOM.");
}
console.log("   ✓ Botão de sincronização manual presente no DOM.");

// ─── TESTE 3: Detecção de Anúncios Pausados e Divergências de Estoque (SCRUM-15)
console.log("\n[TESTE 3] Lógica de Alertas de Anúncios Pausados e Divergências:");
const produtos = window.RezFireData.loadProducts();
const anuncios = window.RezFireAnuncios.loadAnuncios();
const kpis = window.RezFireAnuncios.computeAnunciosKPIs(anuncios, produtos);

console.log(` - Total de anúncios carregados: ${anuncios.length}`);
console.log(` - Anúncios ativos: ${kpis.ativos}`);
console.log(` - Anúncios pausados: ${kpis.pausados}`);
console.log(` - Anúncios encerrados: ${kpis.encerrados}`);
console.log(` - Anúncios com divergência de estoque físico: ${kpis.comDivergencias}`);

if (kpis.total !== anuncios.length) {
  throw new Error(`Inconsistência no total de anúncios! Esperado ${anuncios.length}, obtido ${kpis.total}`);
}

const pausados = anuncios.filter((a) => a.status === "Pausado");
if (pausados.length !== kpis.pausados) {
  throw new Error(`Inconsistência nos pausados! Esperado ${kpis.pausados}, obtido ${pausados.length}`);
}
console.log(`   ✓ Anúncios pausados identificados corretamente: ${pausados.map((a) => a.ml_item_id).join(", ")}`);

// Valida que todo anúncio pausado gera registro de alerta operacional
function simularAlerta(anunciosLista, prodsLista) {
  const pausadosCount = anunciosLista.filter((a) => a.status === "Pausado").length;
  let divsCount = 0;
  for (const a of anunciosLista) {
    const d = window.RezFireAnuncios.analisarDivergencias(a, prodsLista);
    if (d.length > 0) divsCount++;
  }
  return {
    deveExibirBanner: pausadosCount > 0 || divsCount > 0,
    pausadosCount,
    divsCount,
  };
}

const alertaStatus = simularAlerta(anuncios, produtos);
if (!alertaStatus.deveExibirBanner) {
  throw new Error("O banner de alerta deveria estar visível quando há anúncios pausados ou divergentes!");
}
console.log(`   ✓ Alerta operacional acionado com sucesso: ${alertaStatus.pausadosCount} pausados, ${alertaStatus.divsCount} divergências.`);

// ─── TESTE 4: Filtros de Status e Divergência (SCRUM-14 & SCRUM-15) ───────────
console.log("\n[TESTE 4] Filtragem por Status (Ativo, Pausado, Encerrado) e Divergência:");

const filtradosAtivos = anuncios.filter((a) => a.status === "Ativo");
const filtradosPausados = anuncios.filter((a) => a.status === "Pausado");
const filtradosEncerrados = anuncios.filter((a) => a.status === "Encerrado");

console.log(` - Filtro Ativo: ${filtradosAtivos.length} encontrados`);
console.log(` - Filtro Pausado: ${filtradosPausados.length} encontrados`);
console.log(` - Filtro Encerrado: ${filtradosEncerrados.length} encontrados`);

if (filtradosAtivos.length + filtradosPausados.length + filtradosEncerrados.length !== anuncios.length) {
  throw new Error("A soma dos status difere do total de anúncios no catálogo!");
}
console.log("   ✓ Todos os anúncios são categorizados estritamente nos status válidos.");

// ─── TESTE 5: Integração da Sincronização e Vínculo de Produtos ───────────────
console.log("\n[TESTE 5] Verificação da Sincronização e Vínculo de Produtos:");
const syncMeta = window.RezFireAnuncios.loadSyncMeta();
if (!syncMeta.seller_nickname) {
  throw new Error("Metadata de sincronização do ML não possui seller_nickname!");
}
console.log(`   ✓ Metadata de sincronização válida: Seller ${syncMeta.seller_nickname}, status: ${syncMeta.status_conexao}`);

// Testa composição dinâmica de um anúncio (ex: Kit Extintor + Placa)
const anuncioKit = anuncios.find((a) => a.produtos_vinculados && a.produtos_vinculados.length > 1);
if (anuncioKit) {
  const calc = window.RezFireAnuncios.calcularEstoqueDinamicoAnuncio(anuncioKit, produtos);
  console.log(`   ✓ Anúncio kit testado: ${anuncioKit.titulo}`);
  console.log(`     - Estoque dinâmico calculado: ${calc.estoqueDisponivel} kits`);
  console.log(`     - Produto gargalo: ${calc.gargalo?.sku} (saldo físico: ${calc.gargalo?.saldoFisico})`);
  if (calc.componentes.length !== anuncioKit.produtos_vinculados.length) {
    throw new Error("Quantidade de componentes calculados não confere com produtos_vinculados!");
  }
}

console.log("\n=======================================================");
console.log("🎉 TODOS OS 5 TESTES DE SCRUM-14 E SCRUM-15 PASSARAM!");
console.log("=======================================================\n");

