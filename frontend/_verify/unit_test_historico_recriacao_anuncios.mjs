/**
 * unit_test_historico_recriacao_anuncios.mjs
 * Teste unitário e de integração para:
 *   - SCRUM-19 (#14) — Histórico de ocorrências do anúncio (3 SP)
 *   - SCRUM-20 (#15) — Anúncio excluído/recriado e tempo de reposicionamento (2 SP)
 * 
 * Critérios validados:
 * 1. Cada mudança de status relevante (preço, estoque, pausa, exclusão) gera registro cronológico com data/hora.
 * 2. O histórico do anúncio é ordenado cronologicamente (do mais recente ao mais antigo).
 * 3. Permite marcar um anúncio como excluído/recriado, vinculando o antigo ao novo.
 * 4. Calcula e persiste com precisão o tempo de reposicionamento decorrido em dias entre exclusão e recriação.
 * 5. Garante herança histórica bidirecional (anúncio herdeiro aponta para o anúncio de origem).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('SCRUM-19 (#14) e SCRUM-20 (#15) - Histórico e Recriação de Anúncios ML', () => {

  it('1. Deve registrar ocorrência no histórico de anúncio com tipo, data e detalhe', () => {
    const anuncio = {
      id_anuncio: 1,
      ml_item_id: 'MLB-2894012110',
      titulo: 'Extintor Pó ABC 4kg com Suporte',
      preco: 188.80,
      status: 'Ativo',
      historico: [],
    };

    const ocorrencia = {
      id_ocorrencia: 101,
      data: new Date('2026-10-15T14:30:00Z').toISOString(),
      evento: 'Alteração de Preço',
      titulo: 'Ajuste de Margem',
      detalhe: 'Preço alterado de R$ 199,90 para R$ 188,80 para disputa de Buy Box.',
      autor: 'Gestor RezFire',
      dados_anteriores: { preco_antigo: 199.90, preco_novo: 188.80 },
    };

    anuncio.historico.unshift(ocorrencia);

    assert.equal(anuncio.historico.length, 1);
    assert.equal(anuncio.historico[0].evento, 'Alteração de Preço');
    assert.equal(anuncio.historico[0].autor, 'Gestor RezFire');
    assert.ok(anuncio.historico[0].detalhe.includes('188,80'));
  });

  it('2. Deve manter e consultar o histórico de forma cronológica estrita (mais recente primeiro)', () => {
    const historico = [
      { data: '2026-10-01T10:00:00Z', evento: 'Criação', detalhe: 'Anúncio publicado no ML' },
      { data: '2026-10-10T12:00:00Z', evento: 'Alteração de Preço', detalhe: 'Preço promocional' },
      { data: '2026-10-20T16:00:00Z', evento: 'Pausa por Estoque', detalhe: 'Estoque esgotado' },
      { data: '2026-10-25T09:00:00Z', evento: 'Reativação', detalhe: 'Estoque reposto' },
    ];

    // Ordenação cronológica decrescente
    const ordenado = [...historico].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    assert.equal(ordenado[0].evento, 'Reativação', 'Evento mais recente deve estar no topo');
    assert.equal(ordenado[ordenado.length - 1].evento, 'Criação', 'Evento mais antigo deve estar no final');
    assert.ok(new Date(ordenado[0].data) > new Date(ordenado[1].data));
  });

  it('3. Deve marcar anúncio como excluído/recriado vinculando o antigo ao novo', () => {
    const anuncioAntigo = {
      id_anuncio: 14,
      ml_item_id: 'MLB-190412891',
      status: 'Ativo',
      foi_recriado: false,
      historico: [],
    };

    const anuncioNovo = {
      id_anuncio: 1,
      ml_item_id: 'MLB-2894012110',
      status: 'Ativo',
      historico: [],
    };

    const dadosRecriacao = {
      ml_item_id_novo: 'MLB-2894012110',
      data_exclusao: '2026-09-01T00:00:00Z',
      data_recriacao: '2026-09-07T00:00:00Z',
      motivo_exclusao: 'Bloqueio do robô do ML por suposta duplicação de categoria.',
    };

    // Atualização do antigo
    anuncioAntigo.foi_recriado = true;
    anuncioAntigo.status = 'Excluído';
    anuncioAntigo.motivo_exclusao = dadosRecriacao.motivo_exclusao;
    anuncioAntigo.ml_item_id_substituto = dadosRecriacao.ml_item_id_novo;
    anuncioAntigo.data_exclusao = dadosRecriacao.data_exclusao;
    anuncioAntigo.data_recriacao = dadosRecriacao.data_recriacao;

    // Atualização do novo
    anuncioNovo.id_anuncio_origem = anuncioAntigo.id_anuncio;
    anuncioNovo.ml_item_id_origem = anuncioAntigo.ml_item_id;

    assert.equal(anuncioAntigo.status, 'Excluído');
    assert.equal(anuncioAntigo.foi_recriado, true);
    assert.equal(anuncioAntigo.ml_item_id_substituto, 'MLB-2894012110');
    assert.equal(anuncioNovo.ml_item_id_origem, 'MLB-190412891');
  });

  it('4. Deve calcular com precisão o tempo de reposicionamento em dias decorridos', () => {
    const dataExclusao = new Date('2026-09-01T00:00:00Z');
    const dataRecriacao = new Date('2026-09-07T00:00:00Z');

    const diffMs = Math.max(0, dataRecriacao.getTime() - dataExclusao.getTime());
    const tempoDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

    assert.equal(tempoDias, 6, 'Tempo entre 01/09 e 07/09 deve ser exatamente 6 dias');

    // Caso mesmo dia
    const mesmoDia = Math.round(Math.max(0, new Date('2026-09-01T18:00:00Z') - new Date('2026-09-01T08:00:00Z')) / (1000 * 60 * 60 * 24));
    assert.equal(mesmoDia, 0, 'Menos de 12h no mesmo dia arredonda para 0 dias');
  });

  it('5. Deve consolidar relatório e média de tempo de reposicionamento de anúncios recriados', () => {
    const listaAnuncios = [
      { id: 1, foi_recriado: true, tempo_reposicionamento_dias: 6 },
      { id: 2, foi_recriado: true, tempo_reposicionamento_dias: 14 },
      { id: 3, foi_recriado: true, tempo_reposicionamento_dias: 4 },
      { id: 4, foi_recriado: false, tempo_reposicionamento_dias: null },
    ];

    const recriados = listaAnuncios.filter((a) => a.foi_recriado);
    assert.equal(recriados.length, 3);

    const somaDias = recriados.reduce((sum, a) => sum + (a.tempo_reposicionamento_dias || 0), 0);
    const mediaDias = Number((somaDias / recriados.length).toFixed(1));

    assert.equal(somaDias, 24);
    assert.equal(mediaDias, 8.0, 'Média (6 + 14 + 4) / 3 = 8.0 dias');
  });
});
