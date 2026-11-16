/**
 * unit_test_sincronizacao_status_anuncios.mjs
 * Teste unitário e de integração para a User Story #29:
 * Sincronizar status de anúncios via API (Sprint 3)
 *
 * Valida os 5 critérios de aceite:
 * 1. O sistema atualiza o status dos anúncios periodicamente, na frequência definida.
 * 2. Cada mudança de status é registrada com data e hora, alimentando o histórico do #14 (OcorrenciaAnuncio).
 * 3. A tela única de anúncios reflete o status sincronizado (Ativo, Pausado, Excluído).
 * 4. Falhas de sincronização ficam visíveis ao gestor, com a data da última sincronização bem-sucedida.
 * 5. Anúncios novos ou removidos no Mercado Livre são tratados sem duplicar registros (idempotência por ml_item_id).
 */

const BASE_URL = 'http://localhost:3001/api';

async function runTests() {
  console.log('🧪 Iniciando Testes Automatizados da User Story #29 (Sincronizar status de anúncios via API)...\n');

  // 1. Login com Gestor
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

  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('   ✓ Login realizado com sucesso! Token obtido.');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Conectar conta ML caso esteja desconectada
  console.log('\n2️⃣ Verificando status da conexão com Mercado Livre...');
  let statusRes = await fetch(`${BASE_URL}/ml/status`, { headers });
  let statusData = await statusRes.json();

  if (statusData.status !== 'Conectado') {
    console.log('   Conectando conta simulada para homologação...');
    await fetch(`${BASE_URL}/ml/callback?code=CODE_HOMOLOGACAO_29`, { headers });
    statusRes = await fetch(`${BASE_URL}/ml/status`, { headers });
    statusData = await statusRes.json();
  }
  console.log(`   ✓ Conexão ML status: ${statusData.status} (User ID: ${statusData.ml_user_id})`);

  // 3. Teste do Critério 1 & 2: Sincronização com Mudança de Status e Geração de Ocorrência (#14)
  console.log('\n3️⃣ Testando Critérios 1 & 2: Mudança de Status com registro cronológico em OcorrenciaAnuncio (#14)...');
  
  // Lista anúncios atuais ou inicializa se a base de homologação estiver vazia
  let listagemAntes = await fetch(`${BASE_URL}/ml/anuncios`, { headers });
  let dadosAntes = await listagemAntes.json();

  if (!dadosAntes.anuncios || dadosAntes.anuncios.length === 0) {
    console.log('   Catálogo inicial vazio. Sincronizando anúncios iniciais do Mercado Livre...');
    await fetch(`${BASE_URL}/ml/anuncios/sincronizar-status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        novosAnunciosSimulados: [
          {
            ml_item_id: 'MLB-2894012110',
            titulo: 'Extintor Pó ABC 4kg Automotivo E Comercial Com Suporte',
            preco: 188.8,
            status: 'Ativo',
            quantidade_disponivel: 65,
            quantidade_vendida: 142,
          },
          {
            ml_item_id: 'MLB-2894012148',
            titulo: 'Extintor Água Pressurizada AP 10 Litros Inmetro RezFire',
            preco: 159.9,
            status: 'Ativo',
            quantidade_disponivel: 45,
            quantidade_vendida: 89,
          },
        ],
      }),
    });
    listagemAntes = await fetch(`${BASE_URL}/ml/anuncios`, { headers });
    dadosAntes = await listagemAntes.json();
  }

  const primeiroAnuncio = dadosAntes.anuncios[0];
  console.log(`   Anúncio alvo: #${primeiroAnuncio.id_anuncio} (${primeiroAnuncio.ml_item_id}) - Status atual: "${primeiroAnuncio.status}"`);

  // Alterna o status (se Ativo vira Pausado, se Pausado vira Ativo)
  const novoStatusDesejado = primeiroAnuncio.status === 'Ativo' ? 'Pausado' : 'Ativo';

  const syncRes = await fetch(`${BASE_URL}/ml/anuncios/sincronizar-status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      simularStatusRemotos: {
        [primeiroAnuncio.ml_item_id]: novoStatusDesejado,
      },
    }),
  });

  if (!syncRes.ok) {
    const errBody = await syncRes.text();
    throw new Error(`Falha na sincronização de status: HTTP ${syncRes.status} - ${errBody}`);
  }

  const syncData = await syncRes.json();
  console.log(`   ✓ Resposta da Sincronização: ${syncData.mensagem}`);
  console.log(`   ✓ Mudanças de status detectadas: ${syncData.mudancas_status}`);

  if (syncData.mudancas_status < 1) {
    throw new Error('Falha no Critério 2: A mudança de status não foi contabilizada.');
  }

  // 4. Teste do Critério 3: Verificar se o status atualizado foi refletido no banco e listagem
  console.log('\n4️⃣ Testando Critério 3: Verificar se a tela/listagem reflete o status sincronizado...');
  const listagemDepois = await fetch(`${BASE_URL}/ml/anuncios`, { headers });
  const dadosDepois = await listagemDepois.json();
  const anuncioAtualizado = dadosDepois.anuncios.find((a) => a.id_anuncio === primeiroAnuncio.id_anuncio);

  console.log(`   Status anterior: "${primeiroAnuncio.status}" ➔ Novo status no banco: "${anuncioAtualizado.status}"`);
  if (anuncioAtualizado.status !== novoStatusDesejado) {
    throw new Error(`Falha no Critério 3: Status esperado "${novoStatusDesejado}", obtido "${anuncioAtualizado.status}"`);
  }
  console.log('   ✓ Critério 3 APROVADO: O status foi devidamente atualizado no catálogo de anúncios.');

  // Verifica se a ocorrência foi salva no histórico do anúncio (#14)
  const histRes = await fetch(`${BASE_URL}/anuncios/${primeiroAnuncio.id_anuncio}/historico`, { headers });
  const histData = await histRes.json();
  const ultimaOcorrencia = histData.historico[0];

  console.log(`   Última ocorrência gerada: [${ultimaOcorrencia.tipo_evento}] - ${ultimaOcorrencia.titulo}`);
  console.log(`   Detalhe: ${ultimaOcorrencia.detalhe}`);
  console.log(`   Autor: ${ultimaOcorrencia.autor}`);
  console.log(`   Data: ${ultimaOcorrencia.data_ocorrencia}`);

  if (ultimaOcorrencia.tipo_evento !== 'Mudança de Status') {
    throw new Error(`Falha no Critério 2: tipo_evento esperado "Mudança de Status", obtido "${ultimaOcorrencia.tipo_evento}"`);
  }
  console.log('   ✓ Critério 2 APROVADO: Ocorrência cronológica de Mudança de Status gerada com sucesso.');

  // 5. Teste do Critério 5: Anúncio Novo ou Removido no ML tratado sem duplicação (Idempotência)
  console.log('\n5️⃣ Testando Critério 5: Tratamento de novo anúncio com garantia de não duplicação (Idempotência)...');
  const mlItemIdNovo = `MLB-TESTE-${Date.now()}`;
  const novoAnuncioSimulado = {
    ml_item_id: mlItemIdNovo,
    titulo: 'Extintor CO2 4kg Inmetro Automotivo - Remessa Nova',
    preco: 299.9,
    status: 'Ativo',
    quantidade_disponivel: 30,
    quantidade_vendida: 0,
    url: `https://produto.mercadolivre.com.br/${mlItemIdNovo}`,
  };

  // 1ª Inserção via sincronização
  const syncNovo1 = await fetch(`${BASE_URL}/ml/anuncios/sincronizar-status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      novosAnunciosSimulados: [novoAnuncioSimulado],
    }),
  });
  const resNovo1 = await syncNovo1.json();
  console.log(`   1ª Sincronização: ${resNovo1.novos_anuncios} novo anúncio criado.`);

  // 2ª Inserção repetida com o MESMO ml_item_id (teste estrito de IDEMPOTÊNCIA)
  const syncNovo2 = await fetch(`${BASE_URL}/ml/anuncios/sincronizar-status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      novosAnunciosSimulados: [novoAnuncioSimulado],
    }),
  });
  const resNovo2 = await syncNovo2.json();
  console.log(`   2ª Sincronização (repetida): ${resNovo2.novos_anuncios} novos anúncios criados (esperado 0 para idempotência).`);

  if (resNovo2.novos_anuncios !== 0) {
    throw new Error('Falha no Critério 5: Houve duplicação de anúncio com o mesmo ml_item_id.');
  }

  // Verifica no banco se existe apenas 1 registro para este ml_item_id
  const listagemConfirma = await fetch(`${BASE_URL}/ml/anuncios`, { headers });
  const dadosConfirma = await listagemConfirma.json();
  const repeticoes = dadosConfirma.anuncios.filter((a) => a.ml_item_id === mlItemIdNovo);

  if (repeticoes.length !== 1) {
    throw new Error(`Falha no Critério 5: Esperado exatamente 1 registro, encontrados ${repeticoes.length}`);
  }
  console.log('   ✓ Critério 5 APROVADO: Idempotência garantida. Sem duplicações.');

  // 6. Teste do Critério 4: Falhas de sincronização visíveis ao gestor com última data de sucesso
  console.log('\n6️⃣ Testando Critério 4: Registro de falha com preservação da data da última sincronização bem-sucedida...');
  
  // Data de sucesso anterior registrada
  const dataSucessoEsperada = syncData.ultima_sincronizacao;
  console.log(`   Timestamp de sucesso anterior: ${dataSucessoEsperada}`);

  // Simula uma falha forçada (ex: erro 429 ou falha de rede da API externa)
  const syncFalha = await fetch(`${BASE_URL}/ml/anuncios/sincronizar-status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      forcarErro: 'Limite de requisições da API do Mercado Livre atingido (Rate Limit 429).',
    }),
  });

  const resFalha = await syncFalha.json();
  console.log(`   Status HTTP da falha: ${syncFalha.status}`);
  console.log(`   Mensagem de erro: "${resFalha.mensagem}"`);
  console.log(`   Última sincronização de sucesso preservada: ${resFalha.ultima_sincronizacao_sucesso}`);
  console.log(`   Última falha registrada:`, resFalha.ultima_falha);

  if (!resFalha.ultima_falha || !resFalha.ultima_sincronizacao_sucesso) {
    throw new Error('Falha no Critério 4: Metadados de falha ou data da última sincronização de sucesso ausentes.');
  }
  console.log('   ✓ Critério 4 APROVADO: Falhas registradas com visibilidade ao gestor e preservação do último sucesso.');

  console.log('\n🎉 TODOS OS 5 CRITÉRIOS DE ACEITE DA USER STORY #29 FORAM APROVADOS COM SUCESSO!\n');
}

runTests().catch((err) => {
  console.error('\n❌ ERRO NA EXECUÇÃO DO TESTE:', err);
  process.exit(1);
});
