/**
 * unit_test_lucro_real_venda.mjs
 * Teste automatizado de aceite da User Story SCRUM-23 · #18abc · Lucro real por venda (Sprint 3).
 *
 * Critérios validados:
 * 1. É possível associar custo de produto, impostos e embalagem a cada venda registrada (#18a).
 * 2. O sistema apresenta o total de custos fixos por venda (#18a).
 * 3. O sistema calcula automaticamente a tarifa do Mercado Livre conforme o tipo de anúncio (clássico ou premium) (#18b).
 * 4. O frete aplicável é somado ao cálculo da tarifa (#18b).
 * 5. O sistema soma custos fixos (#18a), tarifas variáveis e frete (#18b), ads e transporte, apresentando o lucro líquido por venda (#18c).
 */

import { AppDataSource } from '../../backend/dist/config/database.js';
import { PedidoService } from '../../backend/dist/services/pedido.service.js';
import { Produto } from '../../backend/dist/entities/Produto.js';
import { Estoque } from '../../backend/dist/entities/Estoque.js';
import { Pedido } from '../../backend/dist/entities/Pedido.js';
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
  console.log('🧪 Iniciando Testes Automatizados da User Story SCRUM-23 · #18abc (Lucro Real por Venda)...\n');

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const pedidoService = new PedidoService();
    const prodRepo = AppDataSource.getRepository(Produto);
    const estRepo = AppDataSource.getRepository(Estoque);
    const pedRepo = AppDataSource.getRepository(Pedido);
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

    // 2. Prepara produto de teste com custo de aquisição (CMV) conhecido
    const skuTeste = `EXT-LUCRO-${Date.now()}`;
    let prod = prodRepo.create({
      sku: skuTeste,
      nome: 'Extintor ABC 4kg com Suporte Automotivo',
      preco: 200.00,
      custo: 80.00, // Custo de aquisição unitário = R$ 80,00
      ativo: true,
      tipo: 'Simples',
    });
    prod = await prodRepo.save(prod);

    let estoque = estRepo.create({
      id_produto: prod.id_produto,
      quantidade_atual: 50,
      estoque_minimo: 5,
    });
    estoque = await estRepo.save(estoque);

    // 3. Cria pedido de venda no Mercado Livre (2 unidades @ R$ 200 = R$ 400,00)
    const codigoPedidoTeste = `MLB-LUCRO-${Date.now()}`;
    const pedidoCriado = await pedidoService.criarPedido({
      codigo_pedido: codigoPedidoTeste,
      cliente_nome: 'Cliente RezFire Financeiro',
      origem: 'Mercado Livre',
      itens: [
        { id_produto: prod.id_produto, quantidade: 2, preco_unitario: 200.00 }
      ],
    }, gestor.id_usuario);

    console.log(`📌 Pedido #${pedidoCriado.id_pedido} [${pedidoCriado.codigo_pedido}] criado. Valor total: R$ ${pedidoCriado.valor_total}.\n`);

    // =========================================================================
    // CRITÉRIO 1: Associação de custo de produto, impostos e embalagem à venda
    // =========================================================================
    console.log('--- Testando Critério 1: Associação de custos diretos à venda (#18a) ---');
    const dreInicial = await pedidoService.calcularLucroPedido(pedidoCriado.id_pedido);

    // CMV esperado: 2 un * R$ 80,00 = R$ 160,00
    assert(dreInicial.custos_fixos.custo_produtos_cmv === 160.00, `Custo dos produtos (CMV) associado corretamente: R$ ${dreInicial.custos_fixos.custo_produtos_cmv} (esperado: R$ 160.00).`);

    // Impostos esperados: 6% de R$ 400,00 = R$ 24,00
    assert(dreInicial.custos_fixos.custo_impostos === 24.00, `Impostos calculados sobre a receita: R$ ${dreInicial.custos_fixos.custo_impostos} (alíquota: ${dreInicial.custos_fixos.aliquota_imposto_percentual}%).`);

    // Embalagem esperada: R$ 5,00 padrão
    assert(dreInicial.custos_fixos.custo_embalagem === 5.00, `Custo de embalagem associado à venda: R$ ${dreInicial.custos_fixos.custo_embalagem}.`);

    // =========================================================================
    // CRITÉRIO 2: Apresentação do total de custos fixos por venda (#18a)
    // =========================================================================
    console.log('\n--- Testando Critério 2: Apresentação do total de custos fixos (#18a) ---');
    // Total custos fixos esperados: 160 + 24 + 5 = R$ 189,00
    const totalCustosFixosEsperado = 160.00 + 24.00 + 5.00;
    assert(
      dreInicial.custos_fixos.total_custos_fixos === totalCustosFixosEsperado,
      `Total de custos fixos apresentado corretamente: R$ ${dreInicial.custos_fixos.total_custos_fixos} (esperado: R$ ${totalCustosFixosEsperado}).`
    );

    // =========================================================================
    // CRITÉRIO 3: Cálculo automático de tarifa ML conforme tipo de anúncio (#18b)
    // =========================================================================
    console.log('\n--- Testando Critério 3: Cálculo de tarifa ML conforme tipo de anúncio (#18b) ---');
    // Teste 3A: Tipo Clássico (12%) sobre R$ 400,00 = R$ 48,00
    assert(dreInicial.tarifas_plataforma.tipo_anuncio === 'Classico', 'Tipo de anúncio padrão definido como Clássico.');
    assert(dreInicial.tarifas_plataforma.tarifa_ml_percentual === 12.00, 'Percentual do anúncio Clássico é 12.00%.');
    assert(dreInicial.tarifas_plataforma.tarifa_ml_comissao === 48.00, `Comissão ML Clássico calculada: R$ ${dreInicial.tarifas_plataforma.tarifa_ml_comissao} (esperado: R$ 48.00).`);

    // Teste 3B: Simula alteração para anúncio Premium (17%) sobre R$ 400,00 = R$ 68,00
    const drePremium = await pedidoService.calcularLucroPedido(pedidoCriado.id_pedido, {
      tipo_anuncio: 'Premium',
    });
    assert(drePremium.tarifas_plataforma.tipo_anuncio === 'Premium', 'Tipo de anúncio alterado para Premium.');
    assert(drePremium.tarifas_plataforma.tarifa_ml_percentual === 17.00, 'Percentual do anúncio Premium é 17.00%.');
    assert(drePremium.tarifas_plataforma.tarifa_ml_comissao === 68.00, `Comissão ML Premium calculada: R$ ${drePremium.tarifas_plataforma.tarifa_ml_comissao} (esperado: R$ 68.00).`);

    // =========================================================================
    // CRITÉRIO 4: Frete aplicável somado ao cálculo da tarifa (#18b)
    // =========================================================================
    console.log('\n--- Testando Critério 4: Frete aplicável somado à tarifa (#18b) ---');
    // Valor total R$ 400,00 >= R$ 79,00 -> frete grátis custeado pelo vendedor (default R$ 26,00)
    assert(drePremium.tarifas_plataforma.custo_frete === 26.00, `Frete vendedor calculado para pedido >= R$ 79: R$ ${drePremium.tarifas_plataforma.custo_frete}.`);
    // Tarifa total na modalidade Premium = Comissão (R$ 68,00) + Frete (R$ 26,00) = R$ 94,00
    const totalTarifasEsperado = 68.00 + 26.00;
    assert(
      drePremium.tarifas_plataforma.total_tarifas_plataforma === totalTarifasEsperado,
      `Tarifa total ML (comissão + frete) calculada: R$ ${drePremium.tarifas_plataforma.total_tarifas_plataforma} (esperado: R$ ${totalTarifasEsperado}).`
    );

    // =========================================================================
    // CRITÉRIO 5: Apresentação do Lucro Líquido Real e Margem por venda (#18c)
    // =========================================================================
    console.log('\n--- Testando Critério 5: Apuração do Lucro Líquido Real e Margem (#18c) ---');
    // Receita Bruta: R$ 400,00
    // Custos Fixos: R$ 189,00
    // Tarifas e Frete: R$ 94,00
    // Lucro Líquido Esperado: 400 - 189 - 94 = R$ 117,00
    // Margem Líquida Esperada: (117 / 400) * 100 = 29.25%
    const lucroEsperado = 400.00 - 189.00 - 94.00;
    const margemEsperada = 29.25;

    assert(
      drePremium.resultado.lucro_liquido === lucroEsperado,
      `Lucro Líquido Real apurado com exatidão: R$ ${drePremium.resultado.lucro_liquido} (esperado: R$ ${lucroEsperado}).`
    );
    assert(
      drePremium.resultado.margem_liquida_percentual === margemEsperada,
      `Margem Líquida Real apurada: ${drePremium.resultado.margem_liquida_percentual}% (esperado: ${margemEsperada}%).`
    );
    assert(drePremium.resultado.status_margem === 'alta', `Status de margem classificado como "alta" (margem >= 15%).`);

    // 6. Teste de Consolidação Financeira Geral
    console.log('\n--- Testando Consolidação Financeira Geral (Resumo de Lucro) ---');
    const resumoConsolidado = await pedidoService.obterResumoFinanceiroLucro();
    assert(resumoConsolidado.sucesso === true, 'Resumo financeiro consolidado gerado com sucesso.');
    assert(resumoConsolidado.faturamento_bruto_total > 0, `Faturamento consolidado: R$ ${resumoConsolidado.faturamento_bruto_total}.`);
    assert(resumoConsolidado.resultado.lucro_liquido_total > 0, `Lucro líquido consolidado: R$ ${resumoConsolidado.resultado.lucro_liquido_total}.`);
    assert(resumoConsolidado.resultado.margem_liquida_media > 0, `Margem média da operação: ${resumoConsolidado.resultado.margem_liquida_media}%.`);

    // Limpeza dos dados de teste
    await pedRepo.delete({ codigo_pedido: codigoPedidoTeste });
    const movRepo = AppDataSource.getRepository('movimentacoes_estoque');
    await movRepo.delete({ id_produto: prod.id_produto });
    await estRepo.delete({ id_produto: prod.id_produto });
    await prodRepo.delete({ id_produto: prod.id_produto });

    console.log('\n===============================================================');
    if (falhas === 0) {
      console.log('🎉 TODOS OS 5 CRITÉRIOS DE ACEITE DA USER STORY SCRUM-23 · #18abc FORAM HOMOLOGADOS COM SUCESSO!');
    } else {
      console.error(`❌ OCORRERAM ${falhas} FALHA(S) NOS TESTES DA USER STORY SCRUM-23 · #18abc.`);
    }
    console.log('===============================================================\n');

    process.exit(falhas === 0 ? 0 : 1);
  } catch (err) {
    console.error('Erro fatal no teste automatizado:', err);
    process.exit(1);
  }
}

runTests();
