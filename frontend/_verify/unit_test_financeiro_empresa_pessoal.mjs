/**
 * unit_test_financeiro_empresa_pessoal.mjs
 * Teste unitário e de integração para a história SCRUM-29 · #25 · Financeiro empresa x pessoal
 * 
 * Critérios de Aceite:
 * 1. Lançamentos financeiros podem ser classificados explicitamente como "Empresa" ou "Pessoal".
 * 2. É possível gerar relatórios e consultas financeiras filtradas por essa classificação (segregação patrimonial PJ x PF).
 */

const BASE_URL = 'http://localhost:3001/api';

async function runTests() {
  console.log('🧪 Iniciando Teste de Aceite SCRUM-29 · #25 · Financeiro Empresa x Pessoal...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Login como GESTOR para obter token JWT
    console.log('Passo 1: Autenticando como Gestor...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'gestor@rezfire.com.br',
        senha: 'rezfire2026'
      })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.token, 'Autenticação do Gestor realizada com sucesso');
    const token = loginData.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 2. Criar Lançamento com Classificação "Empresa" (Critério 1)
    console.log('\nPasso 2: Criando lançamento com classificação "Empresa" (PJ)...');
    const lancEmpresaRes = await fetch(`${BASE_URL}/financeiro/lancamentos`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        descricao: 'Teste Unitário - Matéria-prima Extintores ABC (PJ)',
        valor: 1500.50,
        tipo: 'Despesa',
        classificacao: 'Empresa',
        categoria: 'Insumos / Matéria-prima',
        data_competencia: '2026-11-05',
        observacoes: 'Registro automatizado pelo teste #25'
      })
    });
    const lancEmpresaData = await lancEmpresaRes.json();
    const lancEmpresa = lancEmpresaData.lancamento || lancEmpresaData;
    assert(lancEmpresaRes.status === 201, 'Lançamento Empresa criado com status 201');
    assert(lancEmpresa.classificacao === 'Empresa', 'Classificação salva explicitamente como "Empresa"');
    assert(Number(lancEmpresa.valor) === 1500.50, 'Valor registrado corretamente');

    // 3. Criar Lançamento com Classificação "Pessoal" (Critério 1)
    console.log('\nPasso 3: Criando lançamento com classificação "Pessoal" (PF)...');
    const lancPessoalRes = await fetch(`${BASE_URL}/financeiro/lancamentos`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        descricao: 'Teste Unitário - Plano de Saúde Familiar (PF)',
        valor: 850.00,
        tipo: 'Despesa',
        classificacao: 'Pessoal',
        categoria: 'Saúde / Pessoal',
        data_competencia: '2026-11-06',
        observacoes: 'Despesa particular - segregada da PJ'
      })
    });
    const lancPessoalData = await lancPessoalRes.json();
    const lancPessoal = lancPessoalData.lancamento || lancPessoalData;
    assert(lancPessoalRes.status === 201, 'Lançamento Pessoal criado com status 201');
    assert(lancPessoal.classificacao === 'Pessoal', 'Classificação salva explicitamente como "Pessoal"');

    // 4. Validar Rejeição de Classificação Inválida
    console.log('\nPasso 4: Validando rejeição de classificação inválida...');
    const invalidRes = await fetch(`${BASE_URL}/financeiro/lancamentos`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        descricao: 'Teste Inválido',
        valor: 100,
        tipo: 'Despesa',
        classificacao: 'OutroInvalido',
        data_competencia: '2026-11-06'
      })
    });
    assert(invalidRes.status === 400, 'Rejeitou lançamento com classificação fora de Empresa/Pessoal');

    // 5. Consulta Filtrada por Classificação "Empresa" (Critério 2)
    console.log('\nPasso 5: Consultando lançamentos filtrados por classificação "Empresa"...');
    const listEmpresaRes = await fetch(`${BASE_URL}/financeiro/lancamentos?classificacao=Empresa`, {
      headers: authHeaders
    });
    const listEmpresaData = await listEmpresaRes.json();
    const listEmpresa = listEmpresaData.lancamentos || listEmpresaData;
    assert(listEmpresaRes.status === 200, 'Consulta filtrada retornou status 200');
    assert(Array.isArray(listEmpresa) && listEmpresa.length > 0, 'Retornou array de lançamentos');
    const todosEmpresa = listEmpresa.every(l => l.classificacao === 'Empresa');
    assert(todosEmpresa, 'Todos os registros retornados pertencem exclusivamente à "Empresa"');

    // 6. Consulta Filtrada por Classificação "Pessoal" (Critério 2)
    console.log('\nPasso 6: Consultando lançamentos filtrados por classificação "Pessoal"...');
    const listPessoalRes = await fetch(`${BASE_URL}/financeiro/lancamentos?classificacao=Pessoal`, {
      headers: authHeaders
    });
    const listPessoalData = await listPessoalRes.json();
    const listPessoal = listPessoalData.lancamentos || listPessoalData;
    assert(listPessoalRes.status === 200, 'Consulta filtrada retornou status 200');
    assert(Array.isArray(listPessoal) && listPessoal.length > 0, 'Retornou array de lançamentos');
    const todosPessoal = listPessoal.every(l => l.classificacao === 'Pessoal');
    assert(todosPessoal, 'Todos os registros retornados pertencem exclusivamente a "Pessoal"');

    // 7. Relatório Consolidado de Segregação Patrimonial PJ x PF (Critério 2)
    console.log('\nPasso 7: Verificando relatório de segregação patrimonial PJ x PF...');
    const relatorioRes = await fetch(`${BASE_URL}/financeiro/relatorio-segregacao?dias=365`, {
      headers: authHeaders
    });
    const relatorioData = await relatorioRes.json();
    const relatorio = relatorioData.relatorio || relatorioData;
    assert(relatorioRes.status === 200, 'Relatório de segregação retornou status 200');
    assert(typeof relatorio.empresa === 'object', 'Contém bloco segregado "empresa"');
    assert(typeof relatorio.pessoal === 'object', 'Contém bloco segregado "pessoal"');
    assert(typeof relatorio.indicador_segregacao === 'object', 'Contém bloco "indicador_segregacao"');
    assert(relatorio.empresa.total_lancamentos >= 1, 'Total de lançamentos Empresa contabilizado');
    assert(relatorio.pessoal.total_lancamentos >= 1, 'Total de lançamentos Pessoal contabilizado');
    assert(typeof relatorio.empresa.saldo === 'number', 'Saldo da Empresa calculado numericamente');
    assert(typeof relatorio.pessoal.saldo === 'number', 'Saldo Pessoal calculado numericamente');
    assert(relatorio.indicador_segregacao.taxa_segregacao_pct === 100, 'Taxa de segregação calculada em 100%');

    // 8. Limpeza dos lançamentos de teste
    console.log('\nPasso 8: Limpeza dos lançamentos criados no teste...');
    if (lancEmpresa.id_lancamento) {
      const del1 = await fetch(`${BASE_URL}/financeiro/lancamentos/${lancEmpresa.id_lancamento}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      assert(del1.status === 200, `Lançamento Empresa ${lancEmpresa.id_lancamento} excluído`);
    }
    if (lancPessoal.id_lancamento) {
      const del2 = await fetch(`${BASE_URL}/financeiro/lancamentos/${lancPessoal.id_lancamento}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      assert(del2.status === 200, `Lançamento Pessoal ${lancPessoal.id_lancamento} excluído`);
    }

    console.log(`\n========================================`);
    console.log(`Resultado do Teste: ${passed} passaram, ${failed} falharam.`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Erro inesperado durante a execução do teste:', err);
    process.exit(1);
  }
}

runTests();
