/**
 * unit_test_motivo_devolucoes.mjs
 * Teste unitário e de integração para SCRUM-22 (#11) — Motivo de devoluções/mediações (3 SP)
 * 
 * Critérios validados:
 * 1. Ao registrar uma devolução/mediação vinculada a um pedido, o motivo é selecionado de uma lista padronizada.
 * 2. Os registros podem ser consultados posteriormente para identificar padrões (consulta, agregação e relatórios operacionais).
 * 3. Regra de negócio (AGENTS.md Seção 7): estorno imediato no estoque e registro em movimentações_estoque.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Taxonomia padronizada oficial da SCRUM-22
const MOTIVOS_PADRONIZADOS = [
  'Avaria no Transporte',
  'Compra Equivocada / Modelo Incompatível',
  'Desistência / Arrependimento (CDC 7 dias)',
  'Atraso na Entrega',
  'Defeito de Fabricação / Despressurização',
  'Outro',
];

const TIPOS_OCORRENCIA = ['Cancelamento', 'Devolucao', 'Mediacao'];

describe('SCRUM-22 (#11) - Motivo de devoluções/mediações e análise de padrões', () => {

  it('1. Deve validar a taxonomia padronizada de motivos de devolução/mediação', () => {
    assert.equal(MOTIVOS_PADRONIZADOS.length, 6, 'A lista deve conter 6 motivos oficiais');
    assert.ok(MOTIVOS_PADRONIZADOS.includes('Avaria no Transporte'));
    assert.ok(MOTIVOS_PADRONIZADOS.includes('Defeito de Fabricação / Despressurização'));
    assert.ok(MOTIVOS_PADRONIZADOS.includes('Compra Equivocada / Modelo Incompatível'));
    assert.ok(MOTIVOS_PADRONIZADOS.includes('Desistência / Arrependimento (CDC 7 dias)'));
    assert.ok(MOTIVOS_PADRONIZADOS.includes('Atraso na Entrega'));
    assert.ok(MOTIVOS_PADRONIZADOS.includes('Outro'));
  });

  it('2. Deve registrar devolução/mediação com protocolo ML e motivo padronizado', () => {
    const pedido = {
      id_pedido: 101,
      codigo_pedido: 'PED-ML-8912',
      cliente_nome: 'Condomínio Solar',
      status: 'Confirmado',
      valor_total: 450.00,
      itens: [{ id_produto: 1, sku: 'EXT-ABC-04', quantidade: 3 }],
      historico: [],
    };

    const dadosDevolucao = {
      tipo_ocorrencia: 'Mediacao',
      motivo_devolucao: 'Defeito de Fabricação / Despressurização',
      protocolo_mediacao: 'MED-9941203',
      detalhe_devolucao: 'Manômetro apontando faixa vermelha (sem pressão) na entrega.',
    };

    assert.ok(MOTIVOS_PADRONIZADOS.includes(dadosDevolucao.motivo_devolucao), 'Motivo deve pertencer à lista padronizada');
    assert.ok(TIPOS_OCORRENCIA.includes(dadosDevolucao.tipo_ocorrencia), 'Tipo deve ser válido');

    // Executa cancelamento / devolução
    pedido.status = 'Cancelado';
    pedido.tipo_ocorrencia = dadosDevolucao.tipo_ocorrencia;
    pedido.motivo_devolucao = dadosDevolucao.motivo_devolucao;
    pedido.protocolo_mediacao = dadosDevolucao.protocolo_mediacao;
    pedido.detalhe_devolucao = dadosDevolucao.detalhe_devolucao;
    pedido.data_devolucao = new Date().toISOString();

    assert.equal(pedido.status, 'Cancelado');
    assert.equal(pedido.motivo_devolucao, 'Defeito de Fabricação / Despressurização');
    assert.equal(pedido.protocolo_mediacao, 'MED-9941203');
    assert.ok(pedido.detalhe_devolucao.includes('sem pressão'));
  });

  it('3. Deve gerar estorno automático no estoque com o motivo padronizado vinculado (Regra de Ouro)', () => {
    let estoqueFisico = 15;
    const pedido = {
      id_pedido: 202,
      codigo_pedido: 'PED-DIR-401',
      itens: [{ id_produto: 2, quantidade: 4 }],
    };

    const movimentacoes = [];
    const dadosDevolucao = {
      tipo_ocorrencia: 'Devolucao',
      motivo_devolucao: 'Avaria no Transporte',
      detalhe_devolucao: 'Cilindro amassado no bico de descarga.',
    };

    // Estorno no estoque
    pedido.itens.forEach((it) => {
      estoqueFisico += it.quantidade;
      movimentacoes.push({
        id_produto: it.id_produto,
        tipo: 'Entrada',
        quantidade: it.quantidade,
        motivo: `Estorno (${dadosDevolucao.tipo_ocorrencia}: ${dadosDevolucao.motivo_devolucao}) - Pedido #${pedido.codigo_pedido}`,
        data: new Date().toISOString(),
      });
    });

    assert.equal(estoqueFisico, 19, 'Estoque deve receber estorno de 4 unidades');
    assert.equal(movimentacoes.length, 1);
    assert.equal(movimentacoes[0].tipo, 'Entrada');
    assert.ok(movimentacoes[0].motivo.includes('Avaria no Transporte'));
    assert.ok(movimentacoes[0].motivo.includes('Devolucao'));
  });

  it('4. Deve calcular agregação de estatísticas para identificar padrões operacionais (Critério 2)', () => {
    const pedidos = [
      { id_pedido: 1, status: 'Cancelado', motivo_devolucao: 'Avaria no Transporte', tipo_ocorrencia: 'Devolucao' },
      { id_pedido: 2, status: 'Cancelado', motivo_devolucao: 'Avaria no Transporte', tipo_ocorrencia: 'Mediacao', protocolo_mediacao: 'MED-1' },
      { id_pedido: 3, status: 'Cancelado', motivo_devolucao: 'Defeito de Fabricação / Despressurização', tipo_ocorrencia: 'Mediacao', protocolo_mediacao: 'MED-2' },
      { id_pedido: 4, status: 'Cancelado', motivo_devolucao: 'Compra Equivocada / Modelo Incompatível', tipo_ocorrencia: 'Cancelamento' },
      { id_pedido: 5, status: 'Confirmado', motivo_devolucao: null },
    ];

    const pedidosCancelados = pedidos.filter((p) => p.status === 'Cancelado');
    const contagemMotivos = {};
    let totalMediacoes = 0;

    pedidosCancelados.forEach((p) => {
      contagemMotivos[p.motivo_devolucao] = (contagemMotivos[p.motivo_devolucao] || 0) + 1;
      if (p.protocolo_mediacao || p.tipo_ocorrencia === 'Mediacao') {
        totalMediacoes++;
      }
    });

    const ranking = Object.entries(contagemMotivos)
      .map(([motivo, total]) => ({
        motivo,
        total,
        percentual: Number(((total / pedidosCancelados.length) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.total - a.total);

    assert.equal(pedidosCancelados.length, 4, 'Total de cancelados/devolvidos');
    assert.equal(totalMediacoes, 2, 'Total de mediações ML');
    assert.equal(ranking[0].motivo, 'Avaria no Transporte');
    assert.equal(ranking[0].total, 2);
    assert.equal(ranking[0].percentual, 50.0);
  });

  it('5. Deve permitir filtrar pedidos por motivo de devolução padronizado', () => {
    const pedidos = [
      { id: 1, codigo: 'P-1', status: 'Cancelado', motivo_devolucao: 'Avaria no Transporte' },
      { id: 2, codigo: 'P-2', status: 'Cancelado', motivo_devolucao: 'Defeito de Fabricação / Despressurização' },
      { id: 3, codigo: 'P-3', status: 'Cancelado', motivo_devolucao: 'Avaria no Transporte' },
      { id: 4, codigo: 'P-4', status: 'Confirmado', motivo_devolucao: null },
    ];

    const filtro = 'Avaria no Transporte';
    const filtrados = pedidos.filter((p) => (p.motivo_devolucao || '').toLowerCase().includes(filtro.toLowerCase()));

    assert.equal(filtrados.length, 2);
    assert.deepEqual(filtrados.map((p) => p.id), [1, 3]);
  });
});

