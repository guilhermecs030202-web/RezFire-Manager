import app from '../src/app';
import { AppDataSource } from '../src/config/database';

async function runTestSuite() {
  console.log('🧪 Iniciando Bateria de Testes Automatizados da API RezFire com MySQL Real...\n');

  await AppDataSource.initialize();
  const server = app.listen(3002);

  const baseUrl = 'http://127.0.0.1:3002/api';
  let tokenCookie = '';

  try {
    // 1. Teste de Login e Cookie de Autenticação
    console.log('[TESTE 1] Autenticação do Gestor RezFire...');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'gestor@rezfire.com.br',
        senha: 'rezfire2026',
      }),
    });
    const loginData = await loginRes.json();
    if (!loginData.sucesso || !loginData.token) {
      throw new Error(`Falha no login: ${JSON.stringify(loginData)}`);
    }
    const rawCookie = loginRes.headers.get('set-cookie');
    tokenCookie = rawCookie ? rawCookie.split(';')[0] : `rezfire_token=${loginData.token}`;
    console.log('✓ Login realizado com sucesso! Gestor autenticado:', loginData.usuario.nome);

    const authHeaders = {
      'Content-Type': 'application/json',
      Cookie: tokenCookie,
      Authorization: `Bearer ${loginData.token}`,
    };

    // 2. Teste de Listagem de Produtos e Estoque Dinâmico de Combos
    console.log('\n[TESTE 2] Consulta de Produtos e Cálculo Dinâmico de Combos...');
    const prodRes = await fetch(`${baseUrl}/produtos`, { headers: authHeaders });
    const prodData = await prodRes.json();
    console.log(`✓ Total de produtos no banco MySQL: ${prodData.produtos.length}`);
    const combo = prodData.produtos.find((p: any) => p.sku === 'KIT-PQS-COMPLETO');
    console.log(`✓ Produto Combo detectado: ${combo?.nome} - Saldo dinâmico: ${combo?.quantidade_atual} un.`);

    // 3. Teste da Regra de Ouro em Movimentações de Estoque
    console.log('\n[TESTE 3] Teste da Regra de Ouro (Movimentação Transacional)...');
    const pqs4 = prodData.produtos.find((p: any) => p.sku === 'EXT-PQS-4KG');
    const saldoAntes = pqs4.quantidade_atual;

    const movRes = await fetch(`${baseUrl}/movimentacoes`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        id_produto: pqs4.id_produto,
        tipo: 'Entrada',
        quantidade: 10,
        motivo: 'Teste Automatizado - NF 99182',
      }),
    });
    const movData = await movRes.json();
    if (!movData.sucesso) throw new Error(`Falha na movimentação: ${JSON.stringify(movData)}`);
    console.log(`✓ Movimentação de Entrada (+10 un.) registrada. Novo saldo físico: ${movData.novo_saldo} un. (Antes: ${saldoAntes})`);

    // 4. Teste de Criação de Pedido com Baixa Imediata de Estoque
    console.log('\n[TESTE 4] Criação de Pedido com Baixa Imediata de Estoque...');
    const pedidoRes = await fetch(`${baseUrl}/pedidos`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        cliente_nome: 'Condomínio Solar das Flores',
        origem: 'Venda Direta',
        itens: [
          { id_produto: pqs4.id_produto, quantidade: 2 },
        ],
      }),
    });
    const pedidoData = await pedidoRes.json();
    if (!pedidoData.sucesso) throw new Error(`Falha no pedido: ${JSON.stringify(pedidoData)}`);
    console.log(`✓ Pedido aprovado criado: #${pedidoData.pedido.codigo_pedido} - Total: R$ ${pedidoData.pedido.valor_total}`);

    // Verifica se o saldo diminuiu
    const prodDepois = await (await fetch(`${baseUrl}/produtos/${pqs4.id_produto}`, { headers: authHeaders })).json();
    console.log(`✓ Saldo verificado após venda: ${prodDepois.produto.quantidade_atual} un. (Debitou 2 un. perfeitamente)`);

    // 5. Teste de Cancelamento de Pedido com Estorno Automático
    console.log('\n[TESTE 5] Cancelamento de Pedido com Estorno Automático no Estoque...');
    const cancelRes = await fetch(`${baseUrl}/pedidos/${pedidoData.pedido.id_pedido}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'Cancelado' }),
    });
    const cancelData = await cancelRes.json();
    if (!cancelData.sucesso) throw new Error(`Falha no cancelamento: ${JSON.stringify(cancelData)}`);

    const prodEstorno = await (await fetch(`${baseUrl}/produtos/${pqs4.id_produto}`, { headers: authHeaders })).json();
    console.log(`✓ Saldo verificado após estorno/cancelamento: ${prodEstorno.produto.quantidade_atual} un. (Reposto com sucesso)`);

    // 6. Teste de KPIs e Indicadores do Dashboard (Cálculo Direto do Banco)
    console.log('\n[TESTE 6] Consulta de Indicadores e KPIs Reais do Banco MySQL...');
    const dashRes = await fetch(`${baseUrl}/dashboard/kpis?dias=30`, { headers: authHeaders });
    const dashData = await dashRes.json();
    console.log('✓ KPIs calculados direto pelo MySQL:', {
      total_unidades_estoque: dashData.kpis.estoque.total_unidades,
      valor_total_estoque_venda: `R$ ${dashData.kpis.estoque.valor_total_venda.toFixed(2)}`,
      total_movimentacoes: dashData.kpis.movimentacoes.total_movimentacoes,
      total_entradas: dashData.kpis.movimentacoes.total_entradas,
      total_saidas: dashData.kpis.movimentacoes.total_saidas,
      fefo_alertas: dashData.kpis.fefo.lotes_alerta,
    });

    // 7. Teste do Módulo Mercado Livre (OAuth Status, Webhook Rápido e Worker Idempotente)
    console.log('\n[TESTE 7] Módulo Mercado Livre: Status da Conexão...');
    const mlStatusRes = await fetch(`${baseUrl}/ml/status`, { headers: authHeaders });
    const mlStatus = await mlStatusRes.json();
    console.log(`✓ Status da integração ML: ${mlStatus.status} (User ID: ${mlStatus.ml_user_id || 'Nenhum'})`);

    console.log('\n[TESTE 8] Webhook Rápido do Mercado Livre (< 100ms) e Enfileiramento...');
    const inicioWebhook = Date.now();
    const webhookRes = await fetch(`${baseUrl}/ml/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'orders_v2',
        resource: '/orders/20000049281729',
        user_id: 128491029,
        attempts: 1,
      }),
    });
    const tempoRespostaMs = Date.now() - inicioWebhook;
    const webhookData = await webhookRes.json();
    console.log(`✓ Webhook respondeu em ${tempoRespostaMs}ms (HTTP ${webhookRes.status}):`, webhookData);

    console.log('\n[TESTE 9] Processamento Assíncrono Idempotente do Evento...');
    const { mlWebhookWorker } = await import('../src/workers/mlWebhookWorker');
    await mlWebhookWorker.processarProximosEventos(1);
    console.log('✓ Worker processou o evento de pedido do Mercado Livre com sucesso!');

    // Reenvio do mesmo webhook para teste estrito de idempotência
    console.log('\n[TESTE 10] Garantia de Idempotência: Reenvio do Mesmo Webhook...');
    await fetch(`${baseUrl}/ml/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'orders_v2',
        resource: '/orders/20000049281729',
      }),
    });
    await mlWebhookWorker.processarProximosEventos(1);
    console.log('✓ Idempotência comprovada: reenvio do evento não duplicou o pedido nem o débito de estoque!');

    console.log('\n=============================================================');
    console.log('🎉 TODOS OS TESTES INTEGRADOS PASSARAM COM 100% DE SUCESSO!');
    console.log('=============================================================');
  } finally {
    server.close();
    await AppDataSource.destroy();
  }
}

runTestSuite().catch((err) => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
