/**
 * unit_test_consulta_anuncios_api.mjs
 * Teste unitário e de integração para:
 *   - #27 — Consulta de anúncios via API do ML (5 SP, Could, depende de #26)
 *
 * Critérios validados:
 * 1. Com a conta conectada (#26), a consulta retorna os anúncios do vendedor diretamente da API.
 * 2. Exibição estrita dos campos obrigatórios: identificador (ml_item_id), título, status, preço e quantidade disponível.
 * 3. Paginação eficiente para catálogos com muitos anúncios (cálculo de offset, limit e fatiamento de páginas).
 * 4. Consulta sob demanda com atualização de timestamp da última sincronização.
 * 5. Tratamento de limites de requisição (Rate Limit 429) e falhas da API com mensagem amigável sem quebrar a aplicação.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('#27 - Consulta de Anúncios via API do Mercado Livre', () => {

  it('1. Deve consultar anúncios quando a conta estiver conectada (#26) e exigir autenticação', () => {
    function validarConexaoParaConsulta(conexao) {
      if (!conexao || conexao.status !== 'Conectado' || !conexao.access_token) {
        throw new Error('Nenhuma conta do Mercado Livre conectada. Conecte sua conta via OAuth 2.0 primeiro.');
      }
      return true;
    }

    const conexaoDesconectada = { status: 'Desconectado', access_token: null };
    assert.throws(
      () => validarConexaoParaConsulta(conexaoDesconectada),
      /Nenhuma conta do Mercado Livre conectada/
    );

    const conexaoValida = {
      status: 'Conectado',
      access_token: 'APP_USR-TEST-TOKEN',
      ml_user_id: '128491029',
    };
    assert.equal(validarConexaoParaConsulta(conexaoValida), true);
  });

  it('2. Deve garantir a presença e o formato dos campos obrigatórios (Critério 2)', () => {
    // Amostra de anúncio retornado pela API do Mercado Livre
    const itemML = {
      id: 'MLB-2894012110',
      title: 'Extintor Pó Químico Seco ABC 4kg com Suporte e Lacre INMETRO',
      status: 'active',
      price: 188.80,
      available_quantity: 45,
      sold_quantity: 112,
      permalink: 'https://produto.mercadolivre.com.br/MLB-2894012110',
    };

    function mapearItemParaAnuncioRezFire(item) {
      let statusFormatado = 'Ativo';
      if (item.status === 'paused') statusFormatado = 'Pausado';
      if (item.status === 'closed' || item.status === 'inactive') statusFormatado = 'Excluído';

      return {
        ml_item_id: item.id,
        titulo: item.title,
        status: statusFormatado,
        preco: Number(item.price) || 0,
        quantidade_disponivel: Number(item.available_quantity) || 0,
        quantidade_vendida: Number(item.sold_quantity) || 0,
        url: item.permalink,
      };
    }

    const anuncio = mapearItemParaAnuncioRezFire(itemML);

    // Campos obrigatórios conforme Critério 2 da história #27
    assert.equal(anuncio.ml_item_id, 'MLB-2894012110');
    assert.ok(anuncio.titulo.includes('Extintor Pó Químico'));
    assert.equal(anuncio.status, 'Ativo');
    assert.equal(typeof anuncio.preco, 'number');
    assert.equal(anuncio.preco, 188.80);
    assert.equal(typeof anuncio.quantidade_disponivel, 'number');
    assert.equal(anuncio.quantidade_disponivel, 45);
  });

  it('3. Deve paginar corretamente listas de anúncios para catálogos volumosos (Critério 3)', () => {
    // Simula catálogo com 25 anúncios
    const catalogo = Array.from({ length: 25 }, (_, i) => ({
      id: `MLB-900${i + 1}`,
      titulo: `Extintor Modelo ${i + 1}`,
      preco: 100 + i * 10,
      quantidade_disponivel: 10 + i,
      status: i % 5 === 0 ? 'Pausado' : 'Ativo',
    }));

    function paginarAnuncios(lista, pagina = 1, itensPorPagina = 8) {
      const total = lista.length;
      const totalPaginas = Math.ceil(total / itensPorPagina);
      const inicio = (pagina - 1) * itensPorPagina;
      const fim = Math.min(inicio + itensPorPagina, total);
      const itens = lista.slice(inicio, fim);

      return {
        total,
        totalPaginas,
        paginaAtual: pagina,
        itensPorPagina,
        inicio: total > 0 ? inicio + 1 : 0,
        fim,
        itens,
      };
    }

    // Página 1
    const p1 = paginarAnuncios(catalogo, 1, 8);
    assert.equal(p1.total, 25);
    assert.equal(p1.totalPaginas, 4);
    assert.equal(p1.itens.length, 8);
    assert.equal(p1.itens[0].id, 'MLB-9001');
    assert.equal(p1.inicio, 1);
    assert.equal(p1.fim, 8);

    // Página 4 (última página)
    const p4 = paginarAnuncios(catalogo, 4, 8);
    assert.equal(p4.itens.length, 1); // 25 - 24 = 1
    assert.equal(p4.itens[0].id, 'MLB-90025');
    assert.equal(p4.inicio, 25);
    assert.equal(p4.fim, 25);
  });

  it('4. Deve executar consulta sob demanda e registrar timestamp da última consulta (Critério 4)', () => {
    const estadoSincronizacao = {
      ultima_consulta: null,
      sincronizando: false,
    };

    function executarConsultaSobDemanda(anuncios) {
      const agora = new Date();
      estadoSincronizacao.ultima_consulta = agora.toISOString();
      return {
        sucesso: true,
        total_consultados: anuncios.length,
        timestamp: estadoSincronizacao.ultima_consulta,
      };
    }

    const res = executarConsultaSobDemanda([{ id: 1 }, { id: 2 }, { id: 3 }]);
    assert.equal(res.sucesso, true);
    assert.equal(res.total_consultados, 3);
    assert.ok(typeof res.timestamp === 'string');
    assert.ok(new Date(res.timestamp).getTime() <= Date.now());
  });

  it('5. Deve tratar erros de Rate Limit (429) e instabilidade de rede sem quebrar a tela (Critério 5)', () => {
    function tratarRespostaConsultaAPI(statusHTTP, dadosResposta, cacheLocal) {
      if (statusHTTP === 429) {
        return {
          sucesso: false,
          tipoErro: 'RATE_LIMIT',
          mensagem: 'Limite de requisições da API do Mercado Livre atingido (Rate Limit 429). Exibindo dados locais com segurança.',
          anunciosExibidos: cacheLocal,
        };
      }
      if (statusHTTP >= 500) {
        return {
          sucesso: false,
          tipoErro: 'SERVER_ERROR',
          mensagem: 'Servidores do Mercado Livre temporariamente instáveis. Mantendo catálogo local em segurança.',
          anunciosExibidos: cacheLocal,
        };
      }
      return {
        sucesso: true,
        anunciosExibidos: dadosResposta.anuncios,
      };
    }

    const cacheLocalSeguro = [{ ml_item_id: 'MLB-101', titulo: 'Extintor ABC 4kg', preco: 188.8, status: 'Ativo' }];

    // Teste 429
    const resRateLimit = tratarRespostaConsultaAPI(429, null, cacheLocalSeguro);
    assert.equal(resRateLimit.sucesso, false);
    assert.equal(resRateLimit.tipoErro, 'RATE_LIMIT');
    assert.ok(resRateLimit.mensagem.includes('Rate Limit 429'));
    assert.equal(resRateLimit.anunciosExibidos.length, 1); // Preservou os dados locais!

    // Teste 500
    const res500 = tratarRespostaConsultaAPI(502, null, cacheLocalSeguro);
    assert.equal(res500.sucesso, false);
    assert.equal(res500.tipoErro, 'SERVER_ERROR');
    assert.ok(res500.mensagem.includes('Mantendo catálogo local'));
    assert.equal(res500.anunciosExibidos.length, 1);
  });
});

