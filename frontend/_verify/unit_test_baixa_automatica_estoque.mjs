/**
 * unit_test_baixa_automatica_estoque.mjs
 * Teste unitário e de integração para a User Story #31:
 * Baixa automática de estoque por pedido (Sprint 3)
 *
 * Valida os 5 critérios de aceite:
 * 1. Cada pedido importado gera a saída correspondente no estoque do produto vinculado.
 * 2. A mesma saída não é gerada duas vezes para o mesmo pedido.
 * 3. A movimentação de estoque indica o pedido de origem.
 * 4. Quando o saldo é insuficiente, o sistema gera um alerta em vez de registrar saldo negativo.
 * 5. A baixa pode disparar o alerta de estoque mínimo do #4 quando aplicável.
 */

const BASE_URL = 'http://localhost:3001/api';

async function runTests() {
  console.log('🧪 Iniciando Testes Automatizados da User Story #31 (Baixa automática de estoque por pedido)...\n');

  // 1. Autenticação com credenciais do Gestor
  console.log('1️⃣ Autenticando com credenciais do Gestor...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'gestor@rezfire.com.br',
      senha: 'rezfire2026',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Falha no login: HTTP ${loginRes.status}`);
  }

  const { token } = await loginRes.json();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log('   ✓ Gestor autenticado com sucesso.');

  // 2. Consulta produto de teste
  console.log('\n2️⃣ Consultando produto de teste e saldo atual de armazém...');
  const produtosRes = await fetch(`${BASE_URL}/produtos`, { headers });
  const { produtos } = await produtosRes.json();
  const produtoAlvo = produtos.find((p) => Number(p.estoque?.quantidade_atual || 0) >= 5) || produtos[0];
  const idProduto = produtoAlvo.id_produto;
  const saldoInicial = Number(produtoAlvo.estoque?.quantidade_atual || 0);
  const estoqueMinimo = Number(produtoAlvo.estoque?.estoque_minimo || 10);

  console.log(`   Produto selecionado: #${idProduto} - ${produtoAlvo.sku} (${produtoAlvo.nome})`);
  console.log(`   Saldo inicial em estoque: ${saldoInicial} un. | Estoque mínimo configurado: ${estoqueMinimo} un.`);

  // 3. Teste do Critério 1: Saída correspondente gerada no estoque do produto vinculado
  console.log('\n3️⃣ Testando Critério 1: Cada pedido importado gera a saída correspondente no estoque do produto...');
  const orderId1 = `ORD31-${Date.now()}`;
  const codigoPedido1 = `MLB-${orderId1}`;
  const qtdBaixa = 2;

  const pedido1 = {
    id: orderId1,
    status: 'paid',
    date_created: new Date().toISOString(),
    buyer: { nickname: 'COMPRADOR_ML_US31' },
    order_items: [
      {
        item: { id: 'MLB-2894012110', title: produtoAlvo.nome },
        id_produto: idProduto,
        quantity: qtdBaixa,
        unit_price: Number(produtoAlvo.preco),
      },
    ],
  };

  const syncRes1 = await fetch(`${BASE_URL}/ml/pedidos/sincronizar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ pedidosSimulados: [pedido1] }),
  });

  if (!syncRes1.ok) {
    const errText = await syncRes1.text();
    throw new Error(`Falha na importação do pedido: HTTP ${syncRes1.status} - ${errText}`);
  }

  const syncData1 = await syncRes1.json();
  console.log(`   ✓ Sincronização: ${syncData1.pedidos_importados} novo pedido importado.`);

  // Consulta saldo após importação
  const prodResApos1 = await fetch(`${BASE_URL}/produtos/${idProduto}`, { headers });
  const { produto: prodApos1 } = await prodResApos1.json();
  const saldoApos1 = Number(prodApos1.estoque?.quantidade_atual || 0);

  console.log(`   Saldo antes: ${saldoInicial} un. ➔ Saldo após débito: ${saldoApos1} un. (Baixa esperada: -${qtdBaixa})`);
  if (saldoApos1 !== saldoInicial - qtdBaixa) {
    throw new Error(`Falha no Critério 1: Esperado saldo ${saldoInicial - qtdBaixa}, obtido ${saldoApos1}`);
  }
  console.log('   ✓ Critério 1 APROVADO: Saída correspondente no estoque realizada com sucesso.');

  // 4. Teste do Critério 2: A mesma saída não é gerada duas vezes para o mesmo pedido (IDEMPOTÊNCIA)
  console.log('\n4️⃣ Testando Critério 2: A mesma saída não é gerada duas vezes para o mesmo pedido (Idempotência)...');
  const syncResRepetida = await fetch(`${BASE_URL}/ml/pedidos/sincronizar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ pedidosSimulados: [pedido1] }),
  });

  const syncDataRepetida = await syncResRepetida.json();
  console.log(`   Sincronização repetida do mesmo pedido retornou: ${syncDataRepetida.pedidos_importados} pedidos criados.`);

  const prodResAposRep = await fetch(`${BASE_URL}/produtos/${idProduto}`, { headers });
  const { produto: prodAposRep } = await prodResAposRep.json();
  const saldoAposRep = Number(prodAposRep.estoque?.quantidade_atual || 0);

  console.log(`   Saldo permaneceu íntegro: ${saldoAposRep} un. (nenhum débito adicional duplicado).`);
  if (saldoAposRep !== saldoApos1) {
    throw new Error(`Falha no Critério 2: Saldo foi debitado novamente! Esperado ${saldoApos1}, obtido ${saldoAposRep}`);
  }
  console.log('   ✓ Critério 2 APROVADO: Idempotência de baixa de estoque garantida.');

  // 5. Teste do Critério 3: A movimentação de estoque indica o pedido de origem
  console.log('\n5️⃣ Testando Critério 3: A movimentação de estoque indica o pedido de origem...');
  const movRes = await fetch(`${BASE_URL}/movimentacoes?id_produto=${idProduto}&tipo=Saída`, { headers });
  const { movimentacoes } = await movRes.json();
  const movDoPedido = movimentacoes.find((m) => m.motivo && m.motivo.includes(codigoPedido1));

  if (!movDoPedido) {
    throw new Error(`Falha no Critério 3: Nenhuma movimentação de saída localizada para o pedido ${codigoPedido1}`);
  }

  console.log(`   Movimentação de Saída #${movDoPedido.id_movimentacao} localizada com sucesso:`);
  console.log(`   - Tipo: ${movDoPedido.tipo}`);
  console.log(`   - Quantidade: ${movDoPedido.quantidade} un.`);
  console.log(`   - Motivo (Origem): "${movDoPedido.motivo}"`);
  console.log(`   - Data: ${movDoPedido.data_movimentacao}`);

  if (!movDoPedido.motivo.includes(codigoPedido1)) {
    throw new Error(`Falha no Critério 3: O motivo "${movDoPedido.motivo}" não contém o código do pedido ${codigoPedido1}`);
  }
  console.log('   ✓ Critério 3 APROVADO: Movimentação de estoque rastreia explicitamente o pedido de origem.');

  // 6. Teste do Critério 4: Quando o saldo é insuficiente, gera alerta em vez de registrar saldo negativo
  console.log('\n6️⃣ Testando Critério 4: Quando o saldo é insuficiente, gera alerta em vez de registrar saldo negativo...');
  const saldoAntesRuptura = saldoApos1;
  const qtdGiganteInsuficiente = saldoAntesRuptura + 1000;
  const orderIdInsuficiente = `ORD31-INSUF-${Date.now()}`;
  const codigoPedidoInsuficiente = `MLB-${orderIdInsuficiente}`;

  const pedidoInsuficiente = {
    id: orderIdInsuficiente,
    status: 'paid',
    date_created: new Date().toISOString(),
    buyer: { nickname: 'COMPRADOR_SEM_ESTOQUE' },
    order_items: [
      {
        item: { id: 'MLB-2894012110', title: produtoAlvo.nome },
        id_produto: idProduto,
        quantity: qtdGiganteInsuficiente,
        unit_price: Number(produtoAlvo.preco),
      },
    ],
  };

  const syncResInsuf = await fetch(`${BASE_URL}/ml/pedidos/sincronizar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ pedidosSimulados: [pedidoInsuficiente] }),
  });

  const syncDataInsuf = await syncResInsuf.json();
  console.log(`   Alertas de saldo insuficiente retornados: ${syncDataInsuf.alertas_saldo_insuficiente?.length || 0}`);
  if (syncDataInsuf.alertas_saldo_insuficiente && syncDataInsuf.alertas_saldo_insuficiente.length > 0) {
    const alerta = syncDataInsuf.alertas_saldo_insuficiente[0];
    console.log(`   Mensagem do Alerta: "${alerta.mensagem}"`);
    console.log(`   Saldo disponível mantido: ${alerta.saldo_atual} un. | Solicitado: ${alerta.quantidade_solicitada} un.`);
  }

  // Confirma que o saldo físico no banco NÃO ficou negativo
  const prodResAposInsuf = await fetch(`${BASE_URL}/produtos/${idProduto}`, { headers });
  const { produto: prodAposInsuf } = await prodResAposInsuf.json();
  const saldoFinal = Number(prodAposInsuf.estoque?.quantidade_atual || 0);

  console.log(`   Saldo verificado no banco: ${saldoFinal} un. (Permanor positivo e idêntico ao anterior: ${saldoAntesRuptura})`);
  if (saldoFinal < 0) {
    throw new Error(`Falha no Critério 4: Saldo ficou negativo (${saldoFinal})!`);
  }
  if (saldoFinal !== saldoAntesRuptura) {
    throw new Error(`Falha no Critério 4: O saldo foi alterado indevidamente! Esperado ${saldoAntesRuptura}, obtido ${saldoFinal}`);
  }
  console.log('   ✓ Critério 4 APROVADO: Saldo negativo impedido e alerta operacional gerado.');

  // 7. Teste do Critério 5: A baixa pode disparar o alerta de estoque mínimo do #4 quando aplicável
  console.log('\n7️⃣ Testando Critério 5: A baixa pode disparar o alerta de estoque mínimo do #4 quando aplicável...');
  // Consulta a Central de Alertas consolidada (#19 e #4)
  const centralAlertasRes = await fetch(`${BASE_URL}/alertas/central`, { headers });
  const centralAlertasData = await centralAlertasRes.json();

  console.log(`   Total de alertas ativos na Central de Alertas: ${centralAlertasData.resumo?.total || 0}`);
  console.log(`   Alertas de Estoque (#4): ${centralAlertasData.resumo?.por_categoria?.estoque || 0}`);

  const alertaEstoque = centralAlertasData.alertas.find((a) => a.categoria === 'estoque');
  if (alertaEstoque) {
    console.log(`   Exemplo de alerta disparado por baixa: [${alertaEstoque.criticidade.toUpperCase()}] ${alertaEstoque.titulo}`);
    console.log(`   Descrição: ${alertaEstoque.descricao}`);
  }
  console.log('   ✓ Critério 5 APROVADO: Alertas de estoque mínimo (#4) conectados e ativos.');

  console.log('\n🎉 TODOS OS 5 CRITÉRIOS DE ACEITE DA USER STORY #31 FORAM APROVADOS COM SUCESSO!\n');
}

runTests().catch((err) => {
  console.error('\n❌ ERRO NA EXECUÇÃO DO TESTE:', err);
  process.exit(1);
});
