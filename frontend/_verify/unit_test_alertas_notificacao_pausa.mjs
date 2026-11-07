/**
 * unit_test_alertas_notificacao_pausa.mjs
 * Teste automatizado de aceite da User Story #32 · Alertas por notificação de pausa/rebaixamento (Sprint 3).
 *
 * Critérios validados:
 * 1. Quando a sincronização detecta mudança para pausado ou rebaixado, uma notificação é enviada ao gestor.
 * 2. A notificação informa o anúncio, o novo status e a data e hora da mudança.
 * 3. O mesmo alerta aparece no painel central do #19 (GET /api/alertas/central).
 * 4. Uma mesma mudança não gera notificações duplicadas (antirruído/idempotência).
 * 5. O tempo entre a mudança no Mercado Livre e a notificação respeita o limite acordado (sincronização periódica e webhook).
 */

import { AppDataSource } from '../../backend/dist/config/database.js';
import { MercadoLivreService } from '../../backend/dist/services/mercadolivre.service.js';
import { NotificacaoService } from '../../backend/dist/services/notificacao.service.js';
import { AlertaService } from '../../backend/dist/services/alerta.service.js';
import { AnuncioML } from '../../backend/dist/entities/AnuncioML.js';
import { ConexaoMercadoLivre } from '../../backend/dist/entities/ConexaoMercadoLivre.js';
import { Usuario } from '../../backend/dist/entities/Usuario.js';
import { Notificacao } from '../../backend/dist/entities/Notificacao.js';

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
  console.log('🧪 Iniciando Testes Automatizados da User Story #32 (Alertas por notificação de pausa/rebaixamento)...\n');

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const mlService = new MercadoLivreService();
    const notifService = new NotificacaoService();
    const alertaService = new AlertaService();

    const usuarioRepo = AppDataSource.getRepository(Usuario);
    const conexaoRepo = AppDataSource.getRepository(ConexaoMercadoLivre);
    const anuncioRepo = AppDataSource.getRepository(AnuncioML);
    const notifRepo = AppDataSource.getRepository(Notificacao);

    // 1. Garante usuário Gestor e Conexão de Teste
    let gestor = await usuarioRepo.findOne({ where: { email: 'gestor@rezfire.com.br' } });
    if (!gestor) {
      gestor = usuarioRepo.create({
        nome: 'Gestor RezFire Homologação',
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
        ml_user_id: '998877665',
        access_token: 'test_token_notif_32',
        refresh_token: 'test_refresh_notif_32',
        status: 'conectado',
      });
      await conexaoRepo.save(conexao);
    }

    // 2. Prepara anúncio de teste com status inicial "Ativo"
    const mlItemIdTeste = `MLB-NOTIF-TEST-${Date.now()}`;
    let anuncioTeste = anuncioRepo.create({
      id_conexao: conexao.id_conexao,
      ml_item_id: mlItemIdTeste,
      titulo: 'Extintor CO2 6kg Automotivo Teste Notificação',
      preco: 285.50,
      status: 'Ativo',
      quantidade_disponivel: 15,
      quantidade_vendida: 3,
      url: `https://produto.mercadolivre.com.br/${mlItemIdTeste}`,
      ultima_sincronizacao: new Date(),
    });
    anuncioTeste = await anuncioRepo.save(anuncioTeste);
    console.log(`📌 Anúncio de teste criado: [${anuncioTeste.ml_item_id}] com status inicial "${anuncioTeste.status}".\n`);

    // =========================================================================
    // CRITÉRIO 1: Detecção de mudança para Pausado gerando notificação ao gestor
    // =========================================================================
    console.log('--- Testando Critério 1: Mudança para Pausado gerando notificação ao gestor ---');
    const syncPausa = await mlService.sincronizarStatusAnuncios(gestor.id_usuario, {
      simularStatusRemotos: {
        [mlItemIdTeste]: 'Pausado',
      },
    });

    assert(syncPausa.sucesso === true, 'Sincronização de status executada com sucesso.');
    assert(syncPausa.mudancas_status >= 1, 'Detectou pelo menos 1 mudança de status.');
    assert(
      Array.isArray(syncPausa.notificacoes_enviadas) && syncPausa.notificacoes_enviadas.length >= 1,
      'Retornou notificação gerada ao gestor no payload da sincronização.'
    );

    const notifSalva = await notifRepo.findOne({
      where: { id_usuario: gestor.id_usuario, tipo: 'ANUNCIO_PAUSADO' },
      order: { created_at: 'DESC' },
    });
    assert(!!notifSalva, 'Notificação gravada com sucesso na tabela `notificacoes` para o Gestor.');
    assert(notifSalva?.lida === false, 'Notificação registrada inicialmente com status `lida: false`.');

    // =========================================================================
    // CRITÉRIO 2: Conteúdo da notificação (anúncio, novo status, data e hora)
    // =========================================================================
    console.log('\n--- Testando Critério 2: Conteúdo detalhado da notificação (anúncio, status, data/hora) ---');
    assert(
      notifSalva?.titulo.includes(mlItemIdTeste),
      `Título da notificação identifica o anúncio: "${notifSalva?.titulo}".`
    );
    assert(
      notifSalva?.mensagem.includes('Pausado'),
      'Mensagem da notificação informa o novo status "Pausado".'
    );
    assert(
      notifSalva?.dados_origem?.ml_item_id === mlItemIdTeste,
      `Metadados contêm ml_item_id correto (${notifSalva?.dados_origem?.ml_item_id}).`
    );
    assert(
      notifSalva?.dados_origem?.novo_status === 'Pausado',
      'Metadados contêm novo_status: "Pausado".'
    );
    assert(
      !!notifSalva?.dados_origem?.data_hora_formatada,
      `Data e hora da mudança informadas com clareza: "${notifSalva?.dados_origem?.data_hora_formatada}".`
    );

    // =========================================================================
    // CRITÉRIO 3: Presença do alerta na Central de Alertas (#19)
    // =========================================================================
    console.log('\n--- Testando Critério 3: Reflexo na Central de Alertas (#19) ---');
    const central = await alertaService.obterCentralAlertas();
    const alertaEncontrado = central.alertas.find(
      (a) => a.categoria === 'anuncio' && a.dados_origem?.ml_item_id === mlItemIdTeste
    );

    assert(!!alertaEncontrado, `Alerta do anúncio [${mlItemIdTeste}] encontrado na Central de Alertas.`);
    assert(alertaEncontrado?.criticidade === 'critico', 'Alerta de anúncio pausado classificado como CRÍTICO.');
    assert(alertaEncontrado?.acao_url === 'anuncios.html', 'Alerta oferece atalho de ação para "anuncios.html".');

    // =========================================================================
    // CRITÉRIO 4: Antirruído / Idempotência (não gera notificações duplicadas)
    // =========================================================================
    console.log('\n--- Testando Critério 4: Antirruído / Idempotência (sem notificações duplicadas) ---');
    const totalNotifsAntes = await notifRepo.count({
      where: { id_usuario: gestor.id_usuario, tipo: 'ANUNCIO_PAUSADO' },
    });

    // Re-executa sincronização mantendo o anúncio Pausado
    const syncRepetida = await mlService.sincronizarStatusAnuncios(gestor.id_usuario, {
      simularStatusRemotos: {
        [mlItemIdTeste]: 'Pausado',
      },
    });

    const totalNotifsDepois = await notifRepo.count({
      where: { id_usuario: gestor.id_usuario, tipo: 'ANUNCIO_PAUSADO' },
    });

    assert(
      syncRepetida.mudancas_status === 0,
      'Segunda sincronização com mesmo status não detecta nova mudança (anúncio já está Pausado).'
    );
    assert(
      totalNotifsDepois === totalNotifsAntes,
      `Total de notificações mantido inalterado (${totalNotifsDepois} == ${totalNotifsAntes}), garantindo antirruído.`
    );
    assert(
      syncRepetida.notificacoes_enviadas.length === 0,
      'Nenhuma notificação duplicada retornada no payload.'
    );

    // =========================================================================
    // CRITÉRIO 5: Rebaixamento / Sob Revisão e tempo de resposta
    // =========================================================================
    console.log('\n--- Testando Critério 5: Detecção de Rebaixamento / Sob Revisão ---');
    const mlItemRebaixado = `MLB-REBAIXADO-${Date.now()}`;
    let anuncioRebaixado = anuncioRepo.create({
      id_conexao: conexao.id_conexao,
      ml_item_id: mlItemRebaixado,
      titulo: 'Extintor ABC 4kg com Selo INMETRO Rebaixado Teste',
      preco: 179.90,
      status: 'Ativo',
      quantidade_disponivel: 8,
      quantidade_vendida: 12,
      url: `https://produto.mercadolivre.com.br/${mlItemRebaixado}`,
      ultima_sincronizacao: new Date(),
    });
    anuncioRebaixado = await anuncioRepo.save(anuncioRebaixado);

    const inicio = Date.now();
    const syncRebaixado = await mlService.sincronizarStatusAnuncios(gestor.id_usuario, {
      simularStatusRemotos: {
        [mlItemRebaixado]: 'under_review',
      },
    });
    const duracaoMs = Date.now() - inicio;

    assert(syncRebaixado.sucesso === true, 'Sincronização de rebaixamento executada.');
    assert(
      syncRebaixado.notificacoes_enviadas.length >= 1,
      'Notificação de rebaixamento gerada para o gestor.'
    );
    assert(
      duracaoMs < 3000,
      `Tempo de processamento e emissão de alerta foi de ${duracaoMs}ms (respeita tempo hábil/tempo quase real).`
    );

    const notifRebaixada = await notifRepo.findOne({
      where: { id_usuario: gestor.id_usuario, tipo: 'ANUNCIO_REBAIXADO' },
      order: { created_at: 'DESC' },
    });
    assert(!!notifRebaixada, 'Notificação com tipo ANUNCIO_REBAIXADO persistida.');
    assert(
      notifRebaixada?.mensagem.includes('REBAIXADO'),
      'Mensagem especifica que o anúncio foi REBAIXADO/SOB REVISÃO.'
    );

    // Limpeza dos dados de homologação de teste
    await anuncioRepo.delete({ ml_item_id: mlItemIdTeste });
    await anuncioRepo.delete({ ml_item_id: mlItemRebaixado });

    console.log('\n===============================================================');
    if (falhas === 0) {
      console.log('🎉 TODOS OS 5 CRITÉRIOS DE ACEITE DA USER STORY #32 FORAM HOMOLOGADOS COM SUCESSO!');
    } else {
      console.error(`❌ OCORRERAM ${falhas} FALHA(S) NOS TESTES DA USER STORY #32.`);
    }
    console.log('===============================================================\n');

    process.exit(falhas === 0 ? 0 : 1);
  } catch (err) {
    console.error('Erro fatal no teste automatizado:', err);
    process.exit(1);
  }
}

runTests();
