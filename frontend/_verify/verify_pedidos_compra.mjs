import fs from 'node:fs';

console.log('=== TESTE DE VERIFICAÇÃO INTEGRADA: PEDIDOS DE COMPRA ===');

// 1. Verificar HTML de pedidos-compra.html
console.log('\n[1] Verificando estrutura de pedidos-compra.html...');
const html = fs.readFileSync('frontend/pedidos-compra.html', 'utf8');

const checks = [
  'id="app-shell"',
  'id="btn-novo-pedido-compra"',
  'id="modal-pedido-compra"',
  'id="modal-recebimento"',
  'id="modal-cancelamento"',
  'id="drawer-detalhes"',
  'id="tabela-pedidos-body"',
  'id="kpi-total-pedidos"',
  'id="kpi-pedidos-abertos"',
  'id="kpi-pedidos-recebidos"',
  'id="kpi-pedidos-atrasados"',
  'id="filtro-busca"',
  'id="filtro-status"',
  'id="filtro-fornecedor"',
  'id="paginacao-container"',
  'js/pedidos-compra.js',
];

checks.forEach((c) => {
  if (!html.includes(c)) {
    throw new Error(`Elemento ausente no HTML: ${c}`);
  }
  console.log(`   ✓ ${c} presente.`);
});

// 2. Verificar layout.js
console.log('\n[2] Verificando layout.js...');
const layout = fs.readFileSync('frontend/js/layout.js', 'utf8');
if (!layout.includes('pedidos-compra.html') || !layout.includes('clipboard')) {
  throw new Error('Link ou ícone de Pedidos de Compra ausente no layout.js!');
}
console.log('   ✓ Link e ícone de Pedidos de Compra presentes no menu lateral.');

// 3. Verificar api.js
console.log('\n[3] Verificando api.js...');
const apiJs = fs.readFileSync('frontend/js/api.js', 'utf8');
if (!apiJs.includes('purchaseOrders:') || !apiJs.includes('RezFireAPI.pedidosCompra')) {
  throw new Error('Módulo purchaseOrders / pedidosCompra ausente no api.js!');
}
console.log('   ✓ Módulo window.RezFireAPI.purchaseOrders e alias pedidosCompra presentes.');

// 4. Testes de Integração via API Backend (http://localhost:3001/api)
console.log('\n[4] Executando testes na API do Backend...');
let token = null;

const loginRes = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'gestor@rezfire.com.br', senha: 'rezfire2026' }),
});

if (!loginRes.ok) {
  throw new Error(`Falha no login: HTTP ${loginRes.status}`);
}
const loginData = await loginRes.json();
token = loginData.token;
console.log('   ✓ Autenticação realizada com sucesso (Gestor RezFire).');

const authHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

// 4.1 Obter lista de produtos existentes para vincular no teste
const prodRes = await fetch('http://localhost:3001/api/produtos', { headers: authHeaders });
const produtosLista = await prodRes.json();
const prods = Array.isArray(produtosLista) ? produtosLista : (produtosLista.produtos || produtosLista.data || []);
console.log(`   ✓ Produtos encontrados no catálogo: ${prods.length}. Exemplos: ID ${prods[0]?.id_produto || prods[0]?.id} (${prods[0]?.sku}), ID ${prods[1]?.id_produto || prods[1]?.id} (${prods[1]?.sku})`);

const p1Id = prods[0]?.id_produto || prods[0]?.id;
const p2Id = prods[1]?.id_produto || prods[1]?.id;

// 4.1.1 Obter próximo número de pedido
const numRes = await fetch('http://localhost:3001/api/purchase-orders/proximo-numero', {
  headers: authHeaders,
});
const numData = await numRes.json();
console.log(`   ✓ Próximo número gerado: ${numData.numero}`);

// 4.2 Criar um novo pedido de compra como RASCUNHO
console.log('\n[4.2] Criando pedido de compra como RASCUNHO...');
const createRes = await fetch('http://localhost:3001/api/purchase-orders', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    idFornecedor: 1, // Resil
    dataPrevisaoEntrega: '2026-12-01',
    condicoesPagamento: '28 DDL',
    valorFrete: 50.0,
    valorDesconto: 20.0,
    observacoes: 'Pedido de teste de integração automatizado',
    status: 'RASCUNHO',
    itens: [
      { idProduto: p1Id, quantidadePedida: 10, precoUnitario: 38.5 },
      { idProduto: p2Id, quantidadePedida: 5, precoUnitario: 70.0 },
    ],
  }),
});

if (!createRes.ok) {
  const errBody = await createRes.text();
  throw new Error(`Falha ao criar pedido: HTTP ${createRes.status} - ${errBody}`);
}
const createData = await createRes.json();
const pedidoCriado = createData.pedido;
console.log(`   ✓ Pedido criado: ID ${pedidoCriado.id} (${pedidoCriado.numeroPedido}) com status ${pedidoCriado.status}`);
console.log(`     Total recalculado no backend: R$ ${pedidoCriado.valorTotal} (esperado: 765.00)`);

if (Number(pedidoCriado.valorTotal) !== 765) {
  throw new Error(`Valor total incorreto: ${pedidoCriado.valorTotal} !== 765`);
}

// 4.3 Confirmar pedido (mudar para ABERTO)
console.log('\n[4.3] Confirmando pedido para status ABERTO...');
const confirmRes = await fetch(`http://localhost:3001/api/purchase-orders/${pedidoCriado.id}`, {
  method: 'PUT',
  headers: authHeaders,
  body: JSON.stringify({
    status: 'ABERTO',
  }),
});
if (!confirmRes.ok) throw new Error('Falha ao confirmar pedido');
const confirmData = await confirmRes.json();
console.log(`   ✓ Status atualizado para: ${confirmData.pedido.status}`);

// 4.4 Registrar recebimento parcial (Receber 4 unidades do item 1)
console.log('\n[4.4] Registrando recebimento PARCIAL (4 unidades do item 1)...');
const item1 = confirmData.pedido.itens[0];
const receiveRes1 = await fetch(`http://localhost:3001/api/purchase-orders/${pedidoCriado.id}/receive`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    itens: [
      {
        idItemCompra: item1.id,
        quantidadeRecebida: 4,
        novoLote: {
          numero_lote: 'LOTE-TESTE-01',
          data_validade: '2028-11-20',
        },
      },
    ],
  }),
});

if (!receiveRes1.ok) {
  const errBody = await receiveRes1.text();
  throw new Error(`Falha no recebimento parcial: HTTP ${receiveRes1.status} - ${errBody}`);
}
const receiveData1 = await receiveRes1.json();
console.log(`   ✓ Recebimento parcial registrado. Novo status: ${receiveData1.pedido.status} (esperado: PARCIAL)`);
if (receiveData1.pedido.status !== 'PARCIAL') {
  throw new Error(`Status esperado PARCIAL, recebido: ${receiveData1.pedido.status}`);
}

// 4.5 Testar bloqueio de cancelamento após recebimento parcial
console.log('\n[4.5] Testando bloqueio de cancelamento em pedido parcialmente recebido...');
const cancelBlockRes = await fetch(`http://localhost:3001/api/purchase-orders/${pedidoCriado.id}/cancel`, {
  method: 'PATCH',
  headers: authHeaders,
  body: JSON.stringify({ motivo: 'Tentativa de cancelamento indevida' }),
});
console.log(`   ✓ Resposta recebida: HTTP ${cancelBlockRes.status} (esperado: erro 400 por já ter recebimento)`);
if (cancelBlockRes.status !== 400) {
  throw new Error('Cancelamento deveria ter sido bloqueado com status 400!');
}

// 4.6 Concluir recebimento (receber os saldos pendentes: 6 do item 1 e 5 do item 2)
console.log('\n[4.6] Concluindo recebimento total do pedido...');
const item2 = confirmData.pedido.itens[1];
const receiveRes2 = await fetch(`http://localhost:3001/api/purchase-orders/${pedidoCriado.id}/receive`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    itens: [
      { idItemCompra: item1.id, quantidadeRecebida: 6 },
      { idItemCompra: item2.id, quantidadeRecebida: 5 },
    ],
  }),
});
if (!receiveRes2.ok) throw new Error('Falha no recebimento total');
const receiveData2 = await receiveRes2.json();
console.log(`   ✓ Pedido totalmente recebido. Novo status: ${receiveData2.pedido.status} (esperado: RECEBIDO)`);
if (receiveData2.pedido.status !== 'RECEBIDO') {
  throw new Error(`Status esperado RECEBIDO, recebido: ${receiveData2.pedido.status}`);
}

// 4.7 Testar cancelamento de um pedido sem recebimento
console.log('\n[4.7] Testando cancelamento de pedido sem recebimento...');
const createRes2 = await fetch('http://localhost:3001/api/purchase-orders', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    idFornecedor: 2, // Bucka
    dataPrevisaoEntrega: '2026-12-10',
    valorFrete: 0,
    status: 'RASCUNHO',
    itens: [{ idProduto: p1Id, quantidadePedida: 2, precoUnitario: 140.0 }],
  }),
});
const po2 = (await createRes2.json()).pedido;

const cancelRes = await fetch(`http://localhost:3001/api/purchase-orders/${po2.id}/cancel`, {
  method: 'PATCH',
  headers: authHeaders,
  body: JSON.stringify({ motivo: 'Cotação descartada pela diretoria.' }),
});
if (!cancelRes.ok) throw new Error('Falha ao cancelar pedido');
const cancelData = await cancelRes.json();
console.log(`   ✓ Pedido #${po2.id} cancelado com sucesso. Status: ${cancelData.pedido.status}, Motivo: "${cancelData.pedido.motivoCancelamento}"`);

// 4.8 Listagem com filtros
console.log('\n[4.8] Testando listagem paginada e filtros...');
const listRes = await fetch('http://localhost:3001/api/purchase-orders?limit=5', {
  headers: authHeaders,
});
const listData = await listRes.json();
console.log(`   ✓ Listagem retornou ${listData.data.length} pedidos. Total cadastrados: ${listData.total}`);

console.log('\n============================================================');
console.log('🎉 TODOS OS TESTES DE PEDIDOS DE COMPRA FORAM APROVADOS (100%)');
console.log('============================================================');
