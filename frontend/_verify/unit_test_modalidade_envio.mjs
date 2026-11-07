/**
 * unit_test_modalidade_envio.mjs
 * Teste automatizado de aceite da User Story SCRUM-27 · #24 · Modalidade de envio (Sprint 3).
 *
 * Critérios validados:
 * 1. É possível registrar a modalidade de envio de um pedido entre as opções disponíveis
 *    ('Tradicional', 'Coleta', 'Full', 'Logística Própria').
 * 2. Custos e prazos podem ser comparados por modalidade (custo médio de frete,
 *    prazo médio de entrega/despacho, taxa de pontualidade e volume de pedidos).
 */

import { AppDataSource } from '../../backend/dist/config/database.js';
import { PedidoService } from '../../backend/dist/services/pedido.service.js';
import { Produto } from '../../backend/dist/entities/Produto.js';
import { Estoque } from '../../backend/dist/entities/Estoque.js';
import { Pedido } from '../../backend/dist/entities/Pedido.js';
import { ItemPedido } from '../../backend/dist/entities/ItemPedido.js';
import { MovimentacaoEstoque } from '../../backend/dist/entities/MovimentacaoEstoque.js';
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
  console.log('🧪 Iniciando Testes Automatizados da User Story SCRUM-27 · #24 (Modalidades de Envio)...\n');

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const pedidoService = new PedidoService();
    const prodRepo = AppDataSource.getRepository(Produto);
    const estRepo = AppDataSource.getRepository(Estoque);
    const pedRepo = AppDataSource.getRepository(Pedido);
    const itemRepo = AppDataSource.getRepository(ItemPedido);
    const movRepo = AppDataSource.getRepository(MovimentacaoEstoque);
    const usuarioRepo = AppDataSource.getRepository(Usuario);

    // 1. Obtém usuário gestor
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

    // 2. Prepara produto base de teste
    const skuBase = `EXT-MOD-${Date.now()}`;
    let prod = prodRepo.create({
      sku: skuBase,
      nome: 'Extintor Pó Químico ABC 6kg Industrial',
      preco: 180.00,
      custo: 75.00,
      ativo: true,
      tipo: 'Simples',
    });
    prod = await prodRepo.save(prod);

    let estoque = estRepo.create({
      id_produto: prod.id_produto,
      quantidade_atual: 50,
      estoque_minimo: 5,
    });
    await estRepo.save(estoque);

    const pedidosCriadosIds = [];

    // =========================================================================
    // TESTE 1: Registro de pedidos nas 4 modalidades disponíveis (Critério 1)
    // =========================================================================
    console.log('--- Teste 1: Registro e Associação de Modalidades de Envio (#24 Critério 1) ---');

    // 1.1 Modalidade Coleta
    const pedColeta = await pedidoService.criarPedido({
      codigo_pedido: `TEST-MOD-COL-${Date.now()}`,
      cliente_nome: 'Condomínio Solar das Flores',
      origem: 'Mercado Livre',
      modalidade_envio: 'Coleta',
      itens: [{ id_produto: prod.id_produto, quantidade: 2, preco_unitario: 180.00 }],
    });
    pedidosCriadosIds.push(pedColeta.id_pedido);
    assert(pedColeta.modalidade_envio === 'Coleta', 'Pedido criado com modalidade "Coleta" registrada com sucesso');
    assert(Number(pedColeta.prazo_dias_estimado) === 3, 'Prazo estimado para "Coleta" definido corretamente como 3 dias');
    assert(Number(pedColeta.custo_frete) === 26.00, 'Custo de frete padrão de Coleta calculado em R$ 26,00');

    // 1.2 Modalidade Full
    const pedFull = await pedidoService.criarPedido({
      codigo_pedido: `TEST-MOD-FUL-${Date.now()}`,
      cliente_nome: 'Auto Center Rápido',
      origem: 'Mercado Livre',
      modalidade_envio: 'Full',
      itens: [{ id_produto: prod.id_produto, quantidade: 1, preco_unitario: 180.00 }],
    });
    pedidosCriadosIds.push(pedFull.id_pedido);
    assert(pedFull.modalidade_envio === 'Full', 'Pedido criado com modalidade "Full" registrada com sucesso');
    assert(Number(pedFull.prazo_dias_estimado) === 1, 'Prazo estimado para "Full" definido corretamente como 1 dia');
    assert(Number(pedFull.custo_frete) === 22.00, 'Custo de frete subsidiado de Full calculado em R$ 22,00');

    // 1.3 Modalidade Tradicional
    const pedTrad = await pedidoService.criarPedido({
      codigo_pedido: `TEST-MOD-TRA-${Date.now()}`,
      cliente_nome: 'Indústria Metalúrgica Alfa',
      origem: 'Mercado Livre',
      modalidade_envio: 'Tradicional',
      itens: [{ id_produto: prod.id_produto, quantidade: 1, preco_unitario: 180.00 }],
    });
    pedidosCriadosIds.push(pedTrad.id_pedido);
    assert(pedTrad.modalidade_envio === 'Tradicional', 'Pedido criado com modalidade "Tradicional" registrada com sucesso');
    assert(Number(pedTrad.prazo_dias_estimado) === 4, 'Prazo estimado para "Tradicional" definido como 4 dias');
    assert(Number(pedTrad.custo_frete) === 30.00, 'Custo de frete tradicional calculado em R$ 30,00');

    // 1.4 Modalidade Logística Própria
    const pedPropria = await pedidoService.criarPedido({
      codigo_pedido: `TEST-MOD-PRO-${Date.now()}`,
      cliente_nome: 'Transportes Rodoviários Rezende',
      origem: 'Venda Direta',
      modalidade_envio: 'Logística Própria',
      itens: [{ id_produto: prod.id_produto, quantidade: 3, preco_unitario: 180.00 }],
    });
    pedidosCriadosIds.push(pedPropria.id_pedido);
    assert(pedPropria.modalidade_envio === 'Logística Própria', 'Pedido criado com "Logística Própria" registrado com sucesso');
    assert(Number(pedPropria.prazo_dias_estimado) === 2, 'Prazo estimado para "Logística Própria" definido como 2 dias');

    // =========================================================================
    // TESTE 2: Atualização de Modalidade de Envio com recálculo (Critério 1)
    // =========================================================================
    console.log('\n--- Teste 2: Atualização de Modalidade de Envio e Recálculo DRE ---');

    const pedAtualizado = await pedidoService.atualizarModalidadeEnvio(pedTrad.id_pedido, {
      modalidade_envio: 'Full',
    });
    assert(pedAtualizado.modalidade_envio === 'Full', 'Modalidade do pedido alterada dinamicamente de Tradicional para Full');
    assert(Number(pedAtualizado.prazo_dias_estimado) === 1, 'Prazo estimado atualizado para 1 dia');
    assert(Number(pedAtualizado.custo_frete) === 22.00, 'Frete recalculado automaticamente de R$ 30,00 para R$ 22,00');
    assert(Number(pedAtualizado.lucro_liquido) > 0, 'Lucro líquido DRE recalculado com o novo frete');

    // =========================================================================
    // TESTE 3: Comparativo de Custos e Prazos por Modalidade (Critério 2)
    // =========================================================================
    console.log('\n--- Teste 3: Comparativo Analítico por Modalidade (#24 Critério 2) ---');

    const resComparativo = await pedidoService.obterComparativoModalidadesEnvio();
    assert(resComparativo && resComparativo.sucesso === true, 'Método obterComparativoModalidadesEnvio executado com sucesso');
    const comparativo = resComparativo.comparativo;
    assert(Array.isArray(comparativo) && comparativo.length === 4, 'Comparativo retorna as 4 modalidades de envio');

    const modFull = comparativo.find((c) => c.modalidade === 'Full');
    const modColeta = comparativo.find((c) => c.modalidade === 'Coleta');
    const modPropria = comparativo.find((c) => c.modalidade === 'Logística Própria');

    assert(modFull && modFull.total_pedidos >= 2, 'Modalidade Full totaliza pedidos corretamente (mínimo 2)');
    assert(modFull && modFull.prazo_medio_dias === 1.0, 'Modalidade Full apresenta prazo médio rápido de 1.0 dia');
    assert(modFull && modFull.custo_frete_medio === 22.0, 'Modalidade Full apresenta frete médio de R$ 22,00');
    assert(modFull && modFull.taxa_pontualidade_percentual >= 90.0, 'Taxa de pontualidade da modalidade Full consolidada');

    assert(modColeta && modColeta.total_pedidos >= 1, 'Modalidade Coleta presente no comparativo consolidado');
    assert(modColeta && modColeta.prazo_medio_dias > 0, `Prazo médio de Coleta registrado como ${modColeta?.prazo_medio_dias} dias`);
    assert(modColeta && modColeta.custo_frete_medio > 0, `Frete médio de Coleta calculado positivamente como R$ ${modColeta?.custo_frete_medio}`);

    assert(modPropria && modPropria.total_pedidos >= 1, 'Modalidade Logística Própria presente no comparativo');
    assert(modPropria && modPropria.margem_media_percentual > 0, 'Margem de lucro média por modalidade calculada com sucesso');

    // =========================================================================
    // LIMPEZA DOS REGISTROS DE TESTE
    // =========================================================================
    console.log('\n🧹 Limpando dados de teste...');
    for (const id of pedidosCriadosIds) {
      await itemRepo.delete({ id_pedido: id });
      await pedRepo.delete({ id_pedido: id });
    }
    await movRepo.delete({ id_produto: prod.id_produto });
    await estRepo.delete({ id_produto: prod.id_produto });
    await prodRepo.delete({ id_produto: prod.id_produto });

    console.log('✅ Dados de teste limpos com sucesso.');

    if (falhas === 0) {
      console.log('\n🎉 TODOS OS TESTES DA SCRUM-27 · #24 FORAM APROVADOS COM SUCESSO (100% OK)!');
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
