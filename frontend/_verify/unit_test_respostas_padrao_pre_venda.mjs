/**
 * unit_test_respostas_padrao_pre_venda.mjs
 * Teste automatizado de aceite da User Story SCRUM-28 · #22 · Respostas padrão de pré-venda (Sprint 3).
 *
 * Critérios validados:
 * 1. É possível cadastrar perguntas e respostas padrão com validação e persistência.
 * 2. As respostas padrão podem ser consultadas pelo gestor durante o atendimento (busca por palavra-chave, filtro por categoria e cópia com registro de métrica).
 */

import { AppDataSource } from '../../backend/dist/config/database.js';
import { RespostaPadraoService } from '../../backend/dist/services/respostaPadrao.service.js';
import { RespostaPadrao } from '../../backend/dist/entities/RespostaPadrao.js';

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
  console.log('🧪 Iniciando Testes Automatizados da User Story SCRUM-28 · #22 (Respostas Padrão de Pré-Venda)...\n');

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const service = new RespostaPadraoService();
    const repo = AppDataSource.getRepository(RespostaPadrao);

    // =========================================================================
    // CRITÉRIO 1: Cadastrar perguntas e respostas padrão
    // =========================================================================
    console.log('--- Testando Critério 1: Cadastro de Perguntas e Respostas Padrão ---');
    const tituloTeste = `Garantia de Pressão e Manômetro Teste #${Date.now()}`;
    const novaResposta = await service.criar({
      titulo: tituloTeste,
      categoria: 'INMETRO & Normas',
      pergunta_exemplo: 'Como sei se o extintor não perdeu a pressão no transporte?',
      resposta: 'Olá! Todos os nossos extintores saem da fábrica pressurizados com nitrogênio seco de alta pureza. O indicador do manômetro deve estar sempre na faixa verde central. Caso receba com qualquer alteração, nossa garantia cobre a reposição imediata.',
      tags: 'pressao, manometro, faixa verde, transporte, garantia, vazamento',
      ativo: true,
    });

    assert(!!novaResposta.id_resposta, 'Resposta padrão criada e salva com ID primário gerado.');
    assert(novaResposta.titulo === tituloTeste, 'Título cadastrado com fidelidade.');
    assert(novaResposta.categoria === 'INMETRO & Normas', 'Categoria técnica associada corretamente.');
    assert(novaResposta.vezes_utilizada === 0, 'Contador de utilização iniciado em 0.');

    // Teste de atualização
    const atualizada = await service.atualizar(novaResposta.id_resposta, {
      pergunta_exemplo: 'Pergunta revisada: Como verificar o manômetro?',
    });
    assert(atualizada.pergunta_exemplo?.includes('revisada'), 'Edição de resposta padrão executada com sucesso.');

    // Teste de validação de campos obrigatórios
    let erroValidacao = false;
    try {
      await service.criar({ titulo: '', resposta: '' });
    } catch {
      erroValidacao = true;
    }
    assert(erroValidacao, 'Bloqueou cadastro com campos vazios (validação de obrigatoriedade).');

    // =========================================================================
    // CRITÉRIO 2: Consulta e uso durante o atendimento
    // =========================================================================
    console.log('\n--- Testando Critério 2: Consulta e Cópia Durante o Atendimento ---');

    // 2A: Listagem geral
    const listagemGeral = await service.listar();
    assert(listagemGeral.sucesso === true, 'Listagem de respostas padrão executada com sucesso.');
    assert(listagemGeral.total >= 5, `Base técnica contém respostas ativas (total: ${listagemGeral.total}).`);
    assert(Array.isArray(listagemGeral.categorias) && listagemGeral.categorias.length >= 3, 'Categorias técnicas consolidadas para filtro.');

    // 2B: Consulta com filtro por categoria "Validade"
    const filtroValidade = await service.listar({ categoria: 'Validade' });
    assert(
      filtroValidade.respostas.every((r) => r.categoria === 'Validade'),
      `Filtro por categoria "Validade" retornou apenas itens da categoria (total: ${filtroValidade.total}).`
    );

    // 2C: Busca textual por palavra-chave "AVCB" ou "Bombeiros"
    const buscaAvcb = await service.listar({ busca: 'bombeiros' });
    assert(
      buscaAvcb.total >= 1,
      `Busca por palavra-chave "bombeiros" localizou resposta técnica adequada (encontradas: ${buscaAvcb.total}).`
    );
    assert(
      buscaAvcb.respostas.some((r) => r.resposta.toLowerCase().includes('bombeiros') || r.tags?.includes('bombeiros')),
      'Resultado da busca contém a orientação técnica aos bombeiros.'
    );

    // 2D: Cópia da resposta rápida com incremento da métrica de utilização
    const usoAntes = novaResposta.vezes_utilizada;
    const copiaResult = await service.incrementarUso(novaResposta.id_resposta);

    assert(copiaResult.sucesso === true, 'Ação de cópia rápida executada.');
    assert(
      copiaResult.vezes_utilizada === usoAntes + 1,
      `Contador de uso incrementado com sucesso (${usoAntes} -> ${copiaResult.vezes_utilizada}).`
    );
    assert(
      typeof copiaResult.resposta === 'string' && copiaResult.resposta.length > 20,
      'Texto da resposta fornecido na íntegra para área de transferência.'
    );

    // Limpeza da resposta de teste
    await service.excluir(novaResposta.id_resposta);
    const posExclusao = await repo.findOne({ where: { id_resposta: novaResposta.id_resposta } });
    assert(!posExclusao, 'Limpeza da resposta de teste efetuada com sucesso.');

    console.log('\n===============================================================');
    if (falhas === 0) {
      console.log('🎉 TODOS OS CRITÉRIOS DE ACEITE DA USER STORY SCRUM-28 · #22 FORAM HOMOLOGADOS COM SUCESSO!');
    } else {
      console.error(`❌ OCORRERAM ${falhas} FALHA(S) NOS TESTES DA USER STORY SCRUM-28 · #22.`);
    }
    console.log('===============================================================\n');

    process.exit(falhas === 0 ? 0 : 1);
  } catch (err) {
    console.error('Erro fatal no teste automatizado:', err);
    process.exit(1);
  }
}

runTests();
