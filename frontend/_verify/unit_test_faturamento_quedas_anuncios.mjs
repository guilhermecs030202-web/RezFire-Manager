/**
 * unit_test_faturamento_quedas_anuncios.mjs
 * Teste automatizado de aceite da User Story SCRUM-25 · #17 · Faturamento x quedas de anúncio (Sprint 4).
 *
 * Critérios validados:
 * 1. Um indicador/gráfico cruza períodos de anúncio pausado ou rebaixado com a variação de faturamento no mesmo período.
 * 2. Cálculo da receita cessante (perda estimada) por run-rate durante os dias em que anúncios ficaram caídos.
 * 3. Identificação e agregação das causas raiz das quedas (Falta de Estoque FEFO, Moderação ML, etc.).
 * 4. Geração de ranking de anúncios mais prejudicados com recomendação de ações corretivas.
 */

import { AppDataSource } from '../../backend/dist/config/database.js';
import { DashboardService } from '../../backend/dist/services/dashboard.service.js';
import { AnuncioML } from '../../backend/dist/entities/AnuncioML.js';
import { OcorrenciaAnuncio } from '../../backend/dist/entities/OcorrenciaAnuncio.js';
import { Pedido } from '../../backend/dist/entities/Pedido.js';
import { Produto } from '../../backend/dist/entities/Produto.js';
import { Estoque } from '../../backend/dist/entities/Estoque.js';
import { ConexaoMercadoLivre } from '../../backend/dist/entities/ConexaoMercadoLivre.js';
import { Usuario } from '../../backend/dist/entities/Usuario.js';

let falhas = 0;
function assert(condicao, mensagem) {
  if (condicao) {
    console.log(`  ✅ [PASS] ${mensagem}`);
  } else {
    console.error(`  ❌ [FAIL] ${mensagem}`);
    falhas++;
  }
}

async function runTests() {
  console.log('🧪 Iniciando Testes Automatizados da User Story SCRUM-25 · #17 (Faturamento x Quedas de Anúncio)...\n');

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const dashboardService = new DashboardService();
    const anuncioRepo = AppDataSource.getRepository(AnuncioML);
    const ocorrenciaRepo = AppDataSource.getRepository(OcorrenciaAnuncio);
    const pedidoRepo = AppDataSource.getRepository(Pedido);
    const conexaoRepo = AppDataSource.getRepository(ConexaoMercadoLivre);
    const usuarioRepo = AppDataSource.getRepository(Usuario);

    // 1. Garante usuário e conexão ML
    let gestor = await usuarioRepo.findOne({ where: { email: 'gestor@rezfire.com.br' } });
    if (!gestor) {
      gestor = usuarioRepo.create({
        nome: 'Gestor RezFire',
        email: 'gestor@rezfire.com.br',
        senha_hash: '$2b$10$hashed_test_password',
        perfil: 'GESTOR',
        ativo: true,
      });
      await usuarioRepo.save(gestor);
    }

    let conexao = await conexaoRepo.findOne({ where: { id_usuario: gestor.id_usuario } });
    if (!conexao) {
      conexao = conexaoRepo.create({
        id_usuario: gestor.id_usuario,
        ml_user_id: 'TEST_USER_123',
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        status: 'Conectado',
      });
      await conexaoRepo.save(conexao);
    }

    // 2. Cria anúncio e simula ocorrência de pausa por falta de estoque FEFO
    const mlItemIdTeste = `MLB-TEST-${Date.now()}`;
    let anuncio = anuncioRepo.create({
      id_conexao: conexao.id_conexao,
      ml_item_id: mlItemIdTeste,
      titulo: 'Extintor ABC 4kg com Suporte Veicular',
      preco: 190.00,
      status: 'Pausado',
      quantidade_disponivel: 0,
      quantidade_vendida: 30,
      url: 'https://produto.mercadolivre.com.br/MLB-test',
    });
    anuncio = await anuncioRepo.save(anuncio);

    // Registra ocorrência de queda ocorrida há 5 dias
    const dataQueda = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    let ocorrencia = ocorrenciaRepo.create({
      id_anuncio: anuncio.id_anuncio,
      tipo_evento: 'Pausa por Estoque',
      titulo: 'Anúncio Pausado por Estoque Esgotado (FEFO)',
      detalhe: 'Lote de extintores atingiu validade mínima de 180 dias e foi bloqueado.',
      autor: 'Sincronizador ML (Automático)',
      data_ocorrencia: dataQueda,
    });
    ocorrencia = await ocorrenciaRepo.save(ocorrencia);

    // 3. Registra pedidos para compor a série temporal de faturamento
    const dataPedido1 = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const dataPedido2 = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

    const ped1 = pedidoRepo.create({
      codigo_pedido: `PED-TEST-FAT-1-${Date.now()}`,
      cliente_nome: 'Condomínio Residencial Central',
      origem: 'Mercado Livre',
      status: 'Confirmado',
      data_pedido: dataPedido1,
      valor_total: 380.00,
    });
    const ped2 = pedidoRepo.create({
      codigo_pedido: `PED-TEST-FAT-2-${Date.now()}`,
      cliente_nome: 'Oficina Mecânica São Jorge',
      origem: 'Venda Direta',
      status: 'Concluido',
      data_pedido: dataPedido2,
      valor_total: 570.00,
    });
    await pedidoRepo.save([ped1, ped2]);

    // =========================================================================
    // EXECUÇÃO DO SERVIÇO ANALÍTICO (#17)
    // =========================================================================
    console.log('--- Executando obterImpactoQuedasAnuncios(30) ---');
    const resultado = await dashboardService.obterImpactoQuedasAnuncios(30);

    assert(resultado && resultado.sucesso === true, 'Endpoint analítico executado com sucesso');
    assert(resultado.kpis !== undefined, 'Objeto de KPIs executivos presente');
    assert(resultado.timeline_cruzada !== undefined, 'Série temporal de correlação cruzada presente');
    assert(resultado.ranking_anuncios !== undefined, 'Ranking de anúncios prejudicados presente');
    assert(resultado.distribuicao_motivos !== undefined, 'Distribuição de causas raiz presente');

    // Validação Critério 1: Cruzamento temporal faturamento x quedas
    console.log('\n--- Testando Critério 1: Cruzamento Temporal Faturamento x Quedas de Anúncio ---');
    assert(Array.isArray(resultado.timeline_cruzada) && resultado.timeline_cruzada.length === 30, 'Série temporal cobre os 30 dias do período');

    const diasComQuedas = resultado.timeline_cruzada.filter((t) => t.anuncios_pausados_count > 0);
    assert(diasComQuedas.length >= 4, `Identificados ${diasComQuedas.length} dias com anúncios em estado de queda`);

    const diaComVendaEQueda = resultado.timeline_cruzada.find((t) => t.faturamento_real > 0 && t.perda_estimada_quedas > 0);
    assert(diaComVendaEQueda !== undefined, 'Cruzamento validado: identificado dia com faturamento real e perda estimada calculada simultaneamente');
    if (diaComVendaEQueda) {
      assert(diaComVendaEQueda.faturamento_potencial > diaComVendaEQueda.faturamento_real, 'Faturamento potencial sem quedas é estritamente maior que faturamento real no dia da queda');
    }

    // Validação Critério 2: Cálculo da receita cessante (perda estimada)
    console.log('\n--- Testando Critério 2: Apuração de Faturamento Cessante e Perda Estimada ---');
    assert(resultado.kpis.faturamento_perdido_total > 0, `Perda estimada acumulada no período calculada em R$ ${resultado.kpis.faturamento_perdido_total}`);
    assert(resultado.kpis.faturamento_potencial_total >= resultado.kpis.faturamento_realizado_total, 'Faturamento potencial total consolida receita realizada + perda cessante');
    assert(resultado.kpis.impacto_percentual_receita > 0, `Impacto na receita apurado em ${resultado.kpis.impacto_percentual_receita}%`);

    // Validação Critério 3: Ranking e Ação Preventiva
    console.log('\n--- Testando Critério 3: Ranking de Anúncios e Ações Preventivas ---');
    const anuncioNoRanking = resultado.ranking_anuncios.find((r) => r.id_anuncio === anuncio.id_anuncio);
    assert(anuncioNoRanking !== undefined, 'Anúncio em queda identificado e listado no ranking de prejuízos');
    assert(anuncioNoRanking && anuncioNoRanking.perda_estimada > 0, `Perda estimada do anúncio apurada em R$ ${anuncioNoRanking?.perda_estimada}`);
    assert(anuncioNoRanking && anuncioNoRanking.sugestao_acao.includes('FEFO'), 'Sugestão de ação corretiva baseada na causa raiz identificada (FEFO/Estoque)');

    // =========================================================================
    // LIMPEZA DOS REGISTROS DE TESTE
    // =========================================================================
    console.log('\n🧹 Limpando dados de teste...');
    await ocorrenciaRepo.delete({ id_ocorrencia: ocorrencia.id_ocorrencia });
    await anuncioRepo.delete({ id_anuncio: anuncio.id_anuncio });
    await pedidoRepo.delete({ id_pedido: ped1.id_pedido });
    await pedidoRepo.delete({ id_pedido: ped2.id_pedido });

    console.log('✅ Dados de teste limpos com sucesso.');

    if (falhas === 0) {
      console.log('\n🎉 TODOS OS TESTES DA SCRUM-25 · #17 FORAM APROVADOS COM SUCESSO (100% OK)!');
    } else {
      console.error(`\n❌ ${falhas} TESTE(S) FALHARAM.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erro inesperado durante os testes:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

runTests();
