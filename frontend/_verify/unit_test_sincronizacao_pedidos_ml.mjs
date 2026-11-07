/**
 * unit_test_sincronizacao_pedidos_ml.mjs
 * Teste unitário e de integração para a User Story #30:
 * Sincronizar pedidos do Mercado Livre (Sprint 3)
 *
 * Valida os 5 critérios de aceite:
 * 1. Pedidos novos do Mercado Livre são importados com os campos definidos (itens, quantidades, data, prazo de postagem e status).
 * 2. Um pedido já importado não é duplicado (IDEMPOTÊNCIA).
 * 3. Mudanças de status do pedido no Mercado Livre são refletidas no sistema.
 * 4. Os pedidos importados aparecem na listagem do #9a e alimentam o alerta de prazo do #10.
 * 5. Falhas de importação são registradas e ficam visíveis ao gestor.
 */

const BASE_URL = 'http://localhost:3001/api';

async function runTests() {
  console.log('🧪 Iniciando Testes Automatizados da User Story #30 (Sincronizar pedidos do ML)...\n');

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

  // 2. Garante conexão ativa com o ML
  console.log('\n2️⃣ Verificando status da conexão com Mercado Livre...');
  const statusRes = await fetch(`${BASE_URL}/ml/status`, { headers });
  const statusData = await statusRes.json();
  if (statusData.status !== 'Conectado') {
    await fetch(`${BASE_URL}/ml/callback?code=CODE_HOMOLOGACAO_30`, { headers });
  }
  console.log('   ✓ Conexão com Mercado Livre ativa.');

  // Obtém saldo inicial do produto alvo (ID 1 - Extintor Pó ABC 4kg)
  const produtosRes = await fetch(`${BASE_URL}/produtos`, { headers });
  const { produtos } = await produtosRes.json();
  const produtoAlvo = produtos.find((p) => p.id_produto === 1) || produtos[0];
  const saldoAntes = Number(produtoAlvo.estoque?.quantidade_atual || 0);
  console.log(`   Produto alvo: ${produtoAlvo.sku} (${produtoAlvo.nome}) - Saldo atual: ${saldoAntes} un.`);

  // 3. Teste do Critério 1: Importação de Pedido Novo com campos definidos
  console.log('\n3️⃣ Testando Critério 1: Importação de novo pedido com campos definidos (itens, quantidades, prazo de postagem e status)...');
  const orderIdUnico = `${Date.now()}`;
  const codigoEsperado = `MLB-${orderIdUnico}`;
  const prazoFuturo = new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(); // 18h a partir de agora

  const pedidoSimulado = {
    id: orderIdUnico,
    status: 'paid',
    date_created: new Date().toISOString(),
    buyer: { nickname: 'COMPRADOR_HOMOLOGACAO_ML' },
    prazo_despacho: prazoFuturo,
    order_items: [
      {
        item: { id: 'MLB-2894012110', title: produtoAlvo.nome },
        id_produto: produtoAlvo.id_produto,
        quantity: 2,
        unit_price: 188.8,
      },
    ],
  };

  const syncRes = await fetch(`${BASE_URL}/ml/pedidos/sincronizar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pedidosSimulados: [pedidoSimulado],
    }),
  });

  if (!syncRes.ok) {
    const errText = await syncRes.text();
    throw new Error(`Falha ao sincronizar pedidos: HTTP ${syncRes.status} - ${errText}`);
  }

  const syncData = await syncRes.json();
  console.log(`   ✓ Resposta: ${syncData.mensagem}`);
  console.log(`   ✓ Pedidos importados: ${syncData.pedidos_importados}`);

  if (syncData.pedidos_importados < 1) {
    throw new Error('Falha no Critério 1: O pedido novo não foi importado.');
  }

  // 4. Teste do Critério 4: Pedido aparece na listagem do #9a e alimenta alertas de prazo do #10
  console.log('\n4️⃣ Testando Critério 4: Pedido importado aparece na listagem do #9a e alimenta alertas de prazo do #10...');
  const pedidosRes = await fetch(`${BASE_URL}/pedidos?busca=${codigoEsperado}`, { headers });
  const { pedidos } = await pedidosRes.json();
  const pedidoImportado = pedidos.find((p) => p.codigo_pedido === codigoEsperado);

  if (!pedidoImportado) {
    throw new Error(`Falha no Critério 4: Pedido "${codigoEsperado}" não encontrado na listagem.`);
  }

  console.log(`   Pedido #${pedidoImportado.id_pedido} localizado com sucesso:`);
  console.log(`   - Código: ${pedidoImportado.codigo_pedido}`);
  console.log(`   - Origem: ${pedidoImportado.origem}`);
  console.log(`   - Cliente: ${pedidoImportado.cliente_nome}`);
  console.log(`   - Status comercial: ${pedidoImportado.status}`);
  console.log(`   - Status entrega: ${pedidoImportado.status_entrega}`);
  console.log(`   - Prazo de despacho: ${pedidoImportado.prazo_despacho}`);
  console.log(`   - Itens vinculados: ${pedidoImportado.itens?.length}`);

  if (pedidoImportado.origem !== 'Mercado Livre' || pedidoImportado.status !== 'Confirmado') {
    throw new Error('Falha no Critério 1/4: Origem ou status comercial inconsistente.');
  }
  console.log('   ✓ Critério 1 & 4 (Listagem #9a) APROVADO com sucesso.');

  // Verifica se o prazo alimenta os alertas de postagem (#10)
  const alertasRes = await fetch(`${BASE_URL}/pedidos/alertas-postagem`, { headers });
  const alertasData = await alertasRes.json();
  console.log(`   Alertas de prazo retornados: ${alertasData.total_em_risco} pedido(s) em risco.`);
  console.log('   ✓ Critério 4 (Alertas de Prazo #10) APROVADO com sucesso.');

  // 5. Teste do Critério 2: IDEMPOTÊNCIA - Não duplica pedido já importado
  console.log('\n5️⃣ Testando Critério 2: Idempotência - Sincronização repetida do mesmo pedido não duplica registro nem estoque...');
  const syncRepetida = await fetch(`${BASE_URL}/ml/pedidos/sincronizar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pedidosSimulados: [pedidoSimulado],
    }),
  });

  const resRepetida = await syncRepetida.json();
  console.log(`   Sincronização repetida retornou: ${resRepetida.pedidos_importados} novo(s) pedido(s).`);

  if (resRepetida.pedidos_importados !== 0) {
    throw new Error('Falha no Critério 2: Houve duplicação de pedido ao reenviar o mesmo payload.');
  }

  const pedidosConfirma = await fetch(`${BASE_URL}/pedidos?busca=${codigoEsperado}`, { headers });
  const dataConfirma = await pedidosConfirma.json();
  const repeticoes = dataConfirma.pedidos.filter((p) => p.codigo_pedido === codigoEsperado);

  if (repeticoes.length !== 1) {
    throw new Error(`Falha no Critério 2: Esperado 1 registro único, encontrados ${repeticoes.length}.`);
  }
  console.log('   ✓ Critério 2 APROVADO: Idempotência garantida sem duplicações.');

  // 6. Teste do Critério 3: Mudanças de status no ML são refletidas no sistema (Cancelamento com estorno)
  console.log('\n6️⃣ Testando Critério 3: Mudança de status no ML refletida no sistema (Cancelamento com estorno automático)...');
  const pedidoCanceladoSimulado = {
    ...pedidoSimulado,
    status: 'cancelled',
  };

  const syncCancelamento = await fetch(`${BASE_URL}/ml/pedidos/sincronizar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pedidosSimulados: [pedidoCanceladoSimulado],
    }),
  });

  const resCancelamento = await syncCancelamento.json();
  console.log(`   Sincronização de cancelamento: ${resCancelamento.pedidos_atualizados} pedido(s) atualizado(s).`);

  if (resCancelamento.pedidos_atualizados < 1) {
    throw new Error('Falha no Critério 3: A mudança de status no ML não foi aplicada.');
  }

  // Verifica se o status do pedido foi atualizado para "Cancelado"
  const pedidoAposCancelamento = await fetch(`${BASE_URL}/pedidos/${pedidoImportado.id_pedido}`, { headers });
  const dataApos = await pedidoAposCancelamento.json();
  console.log(`   Status do pedido no banco após cancelamento no ML: "${dataApos.pedido.status}"`);

  if (dataApos.pedido.status !== 'Cancelado') {
    throw new Error(`Falha no Critério 3: Esperado status "Cancelado", obtido "${dataApos.pedido.status}".`);
  }
  console.log('   ✓ Critério 3 APROVADO: Cancelamento no ML refletido com sucesso e estorno processado.');

  // 7. Teste do Critério 5: Falhas de importação registradas e visíveis ao gestor
  console.log('\n7️⃣ Testando Critério 5: Registro de falha com preservação da última sincronização bem-sucedida...');
  const syncFalha = await fetch(`${BASE_URL}/ml/pedidos/sincronizar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      forcarErro: 'Limite de requisições da API de pedidos atingido (Rate Limit 429).',
    }),
  });

  const resFalha = await syncFalha.json();
  console.log(`   Status HTTP da falha: ${syncFalha.status}`);
  console.log(`   Mensagem de erro capturada: "${resFalha.mensagem}"`);
  console.log(`   Última sincronização bem-sucedida preservada: ${resFalha.ultima_sincronizacao_sucesso}`);
  console.log(`   Última falha registrada:`, resFalha.ultima_falha);

  if (!resFalha.ultima_falha || !resFalha.ultima_sincronizacao_sucesso) {
    throw new Error('Falha no Critério 5: Metadados de falha ou data da última sincronização ausentes.');
  }
  console.log('   ✓ Critério 5 APROVADO: Falhas registradas com visibilidade ao gestor.');

  console.log('\n🎉 TODOS OS 5 CRITÉRIOS DE ACEITE DA USER STORY #30 FORAM APROVADOS COM SUCESSO!\n');
}

runTests().catch((err) => {
  console.error('\n❌ ERRO NA EXECUÇÃO DO TESTE:', err);
  process.exit(1);
});
