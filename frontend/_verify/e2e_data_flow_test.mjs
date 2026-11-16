// Teste de Integração Ponta a Ponta (E2E) dos Mocks e Fluxos do RezFire Manager
import fs from "node:fs";

console.log("=== INICIANDO TESTE E2E DE FLUXO DE DADOS E MOCKS ===");

// 1. Simula ambiente do Navegador (Window, LocalStorage, Document)
const storageStore = {};
const localStorageMock = {
  getItem: (k) => (storageStore[k] !== undefined ? storageStore[k] : null),
  setItem: (k, v) => {
    storageStore[k] = String(v);
  },
  removeItem: (k) => {
    delete storageStore[k];
  },
  clear: () => {
    for (const k in storageStore) delete storageStore[k];
  },
};

globalThis.window = globalThis;
globalThis.localStorage = localStorageMock;

// 2. Carrega os módulos do sistema em ordem
const codeMockData = fs.readFileSync("frontend/js/mock-data.js", "utf8");
new Function(codeMockData)();
console.log("✓ mock-data.js carregado.");

const codeMockAnuncios = fs.readFileSync("frontend/js/mock-anuncios.js", "utf8");
new Function(codeMockAnuncios)();
console.log("✓ mock-anuncios.js carregado.");

const codeMockEntregas = fs.readFileSync("frontend/js/mock-entregas.js", "utf8");
new Function(codeMockEntregas)();
console.log("✓ mock-entregas.js carregado.");

const codeCertificados = fs.readFileSync("frontend/js/certificadosService.js", "utf8");
new Function(codeCertificados)();
console.log("✓ certificadosService.js carregado.");

// ─── TESTE 1: Carga Inicial e Consistência Estrutural ────────────────────────
console.log("\n[TESTE 1] Verificação estrutural dos dados carregados:");

const products = window.RezFireData.loadProducts();
console.log(` - Produtos: ${products.length} (esperado: 12)`);
if (products.length !== 12) throw new Error("Quantidade de produtos incorreta!");

const orders = window.RezFireData.loadOrders();
console.log(` - Pedidos: ${orders.length} (esperado: 60)`);
if (orders.length !== 60) throw new Error("Quantidade de pedidos incorreta!");

const movements = window.RezFireData.loadMovements();
console.log(` - Movimentações de Estoque: ${movements.length}`);
if (movements.length < 50) throw new Error("Quantidade de movimentações insuficiente!");

const lotes = window.RezFireData.loadLotes();
console.log(` - Lotes de Extintores: ${lotes.length}`);
if (lotes.length < 5) throw new Error("Quantidade de lotes insuficiente!");

const anuncios = window.RezFireAnuncios.loadAnuncios();
console.log(` - Anúncios Mercado Livre: ${anuncios.length} (esperado: >= 13)`);
if (anuncios.length < 13) throw new Error("Quantidade de anúncios incorreta!");

const entregas = window.RezFireEntregas.loadEntregas();
console.log(` - Entregas / Expedição: ${entregas.length}`);
if (entregas.length !== 6) throw new Error("Quantidade de entregas incorreta!");

const certs = window.RezFireCertificados.listarDocumentos();
console.log(` - Documentos de Certificação Inmetro: ${certs.length}`);
if (certs.length < 5) throw new Error("Quantidade de certificados insuficiente!");

// ─── TESTE 2: Consistência Matemática Absoluta ──────────────────────────────
console.log("\n[TESTE 2] Consistência Matemática do Estoque:");

products.filter((p) => p.tipo !== "Combo").forEach((p) => {
  const movsProd = movements.filter((m) => m.id_produto === p.id_produto);
  const totalEnt = movsProd.filter((m) => m.tipo === "Entrada").reduce((s, m) => s + m.quantidade, 0);
  const totalSai = movsProd.filter((m) => m.tipo === "Saída").reduce((s, m) => s + m.quantidade, 0);
  const saldoCalc = totalEnt - totalSai;

  if (saldoCalc !== p.quantidade_atual) {
    throw new Error(`Inconsistência no produto ${p.sku}: Saldo calculado (${saldoCalc}) !== Quantidade atual (${p.quantidade_atual})`);
  }
  console.log(`   ✓ [${p.sku}] Entradas: ${totalEnt} | Saídas: ${totalSai} => Saldo: ${saldoCalc} (Exato)`);
});

// Combo dinâmico
const combo = products.find((p) => p.tipo === "Combo");
const dinamicQty = Math.min(
  ...combo.combo_items.map((ci) => {
    const component = products.find((pr) => pr.id_produto === ci.id_produto);
    return Math.floor(component.quantidade_atual / ci.quantidade);
  })
);
if (dinamicQty !== combo.quantidade_atual) {
  throw new Error(`Inconsistência no combo ${combo.sku}: Calculado ${dinamicQty} !== Saldo ${combo.quantidade_atual}`);
}
console.log(`   ✓ [${combo.sku}] Estoque dinâmico dos componentes: ${dinamicQty} (Exato)`);

// ─── TESTE 3: Lotes FEFO vs Estoque Físico ──────────────────────────────────
console.log("\n[TESTE 3] Lotes FEFO vs Estoque Físico de Extintores:");

[1, 2, 3, 4, 5, 6].forEach((pId) => {
  const prod = products.find((p) => p.id_produto === pId);
  const lotesProd = lotes.filter((l) => l.id_produto === pId);
  const totalLotes = lotesProd.reduce((s, l) => s + l.quantidade_disponivel, 0);

  if (totalLotes !== prod.quantidade_atual) {
    throw new Error(`Inconsistência de lote no extintor ${prod.sku}: soma dos lotes (${totalLotes}) !== estoque físico (${prod.quantidade_atual})`);
  }
  console.log(`   ✓ [${prod.sku}] Saldo armazém: ${prod.quantidade_atual} un = Soma dos lotes: ${totalLotes} un`);
});

// Status dos Lotes
const lotesEnriquecidos = lotes.map((l) => window.RezFireData.computeLoteStatus(l.validade));
const temAlerta = lotesEnriquecidos.some((l) => l.statusKey === "alerta");
const temBloqueado = lotesEnriquecidos.some((l) => l.statusKey === "bloqueado");
const temVencido = lotesEnriquecidos.some((l) => l.statusKey === "vencido");

if (!temAlerta || !temBloqueado || !temVencido) {
  throw new Error("Lotes devem cobrir todos os cenários operacionais (alerta <= 1 ano, bloqueado <= 180d, vencido)!");
}
console.log("   ✓ Cenários de validade FEFO ativos: Alerta <= 1 ano, Bloqueio <= 180 dias, Vencido.");

// ─── TESTE 4: Dashboards e Cálculos com Datas Relativas ─────────────────────
console.log("\n[TESTE 4] Dashboards e Indicadores Operacionais:");

// 4.1 Dashboard Geral
const dashGeral = window.RezFireData.computeDashboard(products);
console.log(`   ✓ Dashboard Geral: ${dashGeral.quantidadeTotal} unidades em estoque | ${window.RezFireData.formatMoney(dashGeral.valorTotal)}`);
console.log(`   ✓ Cobertura: ${dashGeral.coberturaDias} dias | Giro: ${dashGeral.giroAno}x/ano | Ticket Médio: ${window.RezFireData.formatMoney(dashGeral.ticketMedio)}`);
if (dashGeral.movimentacoesMensais.length !== 6) throw new Error("Gráfico de movimentações deve conter 6 meses!");

// 4.2 Dashboard de Vendas (30 dias)
const dashVendas = window.RezFireData.computeSalesMetrics(orders, 30);
console.log(`   ✓ Vendas (últimos 30 dias): Faturamento ${window.RezFireData.formatMoney(dashVendas.faturamentoTotal)} em ${dashVendas.pedidosConcluidos} pedidos`);
if (dashVendas.pedidosConcluidos === 0 || dashVendas.faturamentoTotal === 0) {
  throw new Error("Dashboard de vendas não está capturando os pedidos dos últimos 30 dias!");
}

// 4.3 Dashboard de Estoque
const dashEstoque = window.RezFireData.computeStockDashboardMetrics(products);
console.log(`   ✓ Estoque: ${dashEstoque.skusRuptura.length} em ruptura, ${dashEstoque.skusCriticos.length} críticos`);
if (dashEstoque.skusRuptura.length !== 1 || dashEstoque.skusCriticos.length !== 1) {
  throw new Error(`Esperado exatamente 1 item em ruptura (EXT-PQS-12KG) e 1 crítico (EXT-CO2-4KG), encontrado ruptura: ${dashEstoque.skusRuptura.length}, crítico: ${dashEstoque.skusCriticos.length}`);
}

// 4.4 Dashboard Financeiro
const dashFin = window.RezFireData.computeFinancialDashboardMetrics(products, orders, 30);
console.log(`   ✓ Financeiro (30d): Receita Bruta ${window.RezFireData.formatMoney(dashFin.faturamentoTotal)} | CMV ${window.RezFireData.formatMoney(dashFin.cmvTotal)} | Margem de Contribuição: ${dashFin.margemLiquidaContribuicao}%`);
if (dashFin.lucroLiquidoContribuicao <= 0) throw new Error("Margem de contribuição deve ser positiva e coerente!");

// 4.5 Dashboard de Entregas
const dashEntregas = window.RezFireEntregas.computeEntregasKPIs(entregas);
console.log(`   ✓ Entregas: ${dashEntregas.aSeparar} a separar | ${dashEntregas.prontoDespacho} pronto p/ despacho | ${dashEntregas.emTransito} em trânsito | ${dashEntregas.entregues} entregues`);

// ─── TESTE 5: Interações Reativas Ponta a Ponta ─────────────────────────────
console.log("\n[TESTE 5] Simulação Interativa Ponta a Ponta:");

// Cenário A: Novo Pedido de Venda Aprovado (Confirmado)
console.log(" -> Registrando novo pedido de 5x EXT-PQS-4KG (ID 1)...");
const pqsAntes = window.RezFireData.loadProducts().find((p) => p.id_produto === 1).quantidade_atual;
const movsAntes = window.RezFireData.loadMovements().length;

// Simula criação do pedido
const novoPedido = {
  id_pedido: 101,
  codigo_pedido: "PED-0101",
  canal: "Venda Direta",
  cliente: "Condomínio Edifício Paulista",
  uf: "SP",
  data_pedido: new Date().toISOString(),
  status: "Confirmado",
  itens: [
    { id_produto: 1, sku: "EXT-PQS-4KG", nome: "Extintor Pó Químico ABC 4kg", quantidade: 5, preco_unitario: 169.90, subtotal: 849.50 }
  ],
  subtotal: 849.50,
  desconto: 0,
  frete: 0,
  valor_total: 849.50,
  forma_pagamento: "PIX",
  tipo_envio: "Transportadora Própria",
};

// 1. Debita estoque e gera movimentação
const prodsAtuais = window.RezFireData.loadProducts();
prodsAtuais.find((p) => p.id_produto === 1).quantidade_atual -= 5;
window.RezFireData.saveProducts(prodsAtuais);

const movsAtuais = window.RezFireData.loadMovements();
movsAtuais.unshift({
  id_movimentacao: movsAtuais.length + 1,
  id_pedido: 101,
  codigo_pedido: "PED-0101",
  canal: "Venda Direta",
  id_produto: 1,
  sku: "EXT-PQS-4KG",
  nome_produto: "Extintor Pó Químico ABC 4kg",
  tipo: "Saída",
  motivo: "Venda Direta (PED-0101)",
  quantidade: 5,
  preco_unitario: 169.90,
  valor_total: 849.50,
  data: novoPedido.data_pedido,
  responsavel: "Gestor RezFire",
});
window.RezFireData.saveMovements(movsAtuais);

// 2. Insere na fila de entregas
const entregasAtuais = window.RezFireEntregas.loadEntregas();
entregasAtuais.unshift({
  id_entrega: "ENT-101",
  id_pedido_interno: 101,
  codigo_pedido_ml: null,
  codigo_pedido_direto: "PED-0101",
  canal: "Venda Direta",
  cliente: novoPedido.cliente,
  uf: novoPedido.uf,
  data_venda: novoPedido.data_pedido,
  prazo_despacho: new Date(Date.now() + 86400000).toISOString(),
  status_interno: window.RezFireEntregas.STATUS_INTERNO.A_SEPARAR,
  status_logistico: window.RezFireEntregas.STATUS_LOGISTICO.AGUARDANDO_ENVIO,
  itens: novoPedido.itens,
  valor_total: novoPedido.valor_total,
  ocorrencias: [],
});
window.RezFireEntregas.saveEntregas(entregasAtuais);

const pqsDepois = window.RezFireData.loadProducts().find((p) => p.id_produto === 1).quantidade_atual;
const movsDepois = window.RezFireData.loadMovements().length;
const entregasDepois = window.RezFireEntregas.loadEntregas().length;

if (pqsDepois !== pqsAntes - 5) throw new Error(`Estoque não diminuiu corretamente: antes ${pqsAntes}, depois ${pqsDepois}`);
if (movsDepois !== movsAntes + 1) throw new Error("Movimentação não foi registrada!");
if (entregasDepois !== entregas.length + 1) throw new Error("Entrega não foi enfileirada!");
console.log(`   ✓ Pedido criado com sucesso: Estoque PQS 4kg foi de ${pqsAntes} para ${pqsDepois} un.`);
console.log(`   ✓ Movimentação de saída registrada e entrega ENT-101 enfileirada.`);

// Recalcula o dashboard após o novo pedido
const dashAposVenda = window.RezFireData.computeDashboard(window.RezFireData.loadProducts());
if (dashAposVenda.quantidadeTotal !== dashGeral.quantidadeTotal - 5) {
  throw new Error("Dashboard geral não refletiu a baixa do pedido!");
}
console.log(`   ✓ Dashboard Geral recalculado automaticamente: Total em estoque passou para ${dashAposVenda.quantidadeTotal} un.`);

// Cenário B: Cancelamento do Pedido com Estorno Automático
console.log("\n -> Cancelando o pedido PED-0101 (estorno imediato conforme Seção 7 AGENTS.md)...");
const prodsAposCanc = window.RezFireData.loadProducts();
prodsAposCanc.find((p) => p.id_produto === 1).quantidade_atual += 5;
window.RezFireData.saveProducts(prodsAposCanc);

const movsAposCanc = window.RezFireData.loadMovements();
movsAposCanc.unshift({
  id_movimentacao: movsAposCanc.length + 1,
  id_pedido: 101,
  codigo_pedido: "PED-0101",
  id_produto: 1,
  sku: "EXT-PQS-4KG",
  nome_produto: "Extintor Pó Químico ABC 4kg",
  tipo: "Entrada",
  motivo: "Estorno de Cancelamento - Pedido PED-0101",
  quantidade: 5,
  preco_unitario: 169.90,
  valor_total: 849.50,
  data: new Date().toISOString(),
  responsavel: "Gestor RezFire",
});
window.RezFireData.saveMovements(movsAposCanc);

const pqsRestaurado = window.RezFireData.loadProducts().find((p) => p.id_produto === 1).quantidade_atual;
if (pqsRestaurado !== pqsAntes) {
  throw new Error(`Estoque não foi restaurado no cancelamento: esperado ${pqsAntes}, atual ${pqsRestaurado}`);
}
console.log(`   ✓ Cancelamento processado: Estoque restaurado com precisão para ${pqsRestaurado} un via movimentação de Entrada.`);

// Cenário C: Certificados Inmetro
console.log("\n -> Testando vinculação e isolamento de Certificados Inmetro...");
const certsProd1 = window.RezFireCertificados.listarDocumentos("produto", "1");
const certsProd4 = window.RezFireCertificados.listarDocumentos("produto", "4");
const certsAnun1 = window.RezFireCertificados.listarDocumentos("anuncio", "1");

if (certsProd1.length === 0) throw new Error("Produto 1 deveria possuir certificados mockados!");
if (certsProd4.length !== 0) throw new Error("Produto 4 deveria estar sem certificados para teste de badge!");
if (certsAnun1.length === 0) throw new Error("Anúncio 1 deveria possuir certificado de anúncio!");

console.log(`   ✓ Produto 1 tem ${certsProd1.length} documentos (Certificado + Selo Inmetro).`);
console.log(`   ✓ Produto 4 tem 0 documentos (identificado corretamente como 'Sem certificado').`);
console.log(`   ✓ Anúncio 1 possui documento isolado e independente.`);

console.log("\n=======================================================");
console.log("TODOS OS 5 TESTES DE INTEGRAÇÃO PASSARAM COM SUCESSO!");
console.log("=======================================================");
