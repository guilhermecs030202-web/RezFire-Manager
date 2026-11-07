import { AppDataSource } from '../config/database';
import { Pedido } from '../entities/Pedido';
import { Estoque } from '../entities/Estoque';
import { Produto } from '../entities/Produto';
import { MovimentacaoEstoque } from '../entities/MovimentacaoEstoque';
import { LoteEstoque } from '../entities/LoteEstoque';
import { AnuncioML } from '../entities/AnuncioML';
import { OcorrenciaAnuncio } from '../entities/OcorrenciaAnuncio';

export class DashboardService {
  /**
   * Calcula todos os 10 indicadores e KPIs oficiais diretamente do banco MySQL
   */
  async obterKpis(diasPeriodo: number = 30) {
    const dataCorte = new Date(Date.now() - diasPeriodo * 24 * 60 * 60 * 1000);

    // 1. Quantidade total e valor do estoque físico
    const estoqueQuery = await AppDataSource.query(`
      SELECT 
        COALESCE(SUM(e.quantidade_atual), 0) AS total_unidades,
        COALESCE(SUM(e.quantidade_atual * p.custo), 0) AS valor_total_custo,
        COALESCE(SUM(e.quantidade_atual * p.preco), 0) AS valor_total_venda,
        COALESCE(AVG(p.custo), 0) AS custo_medio_aquisicao
      FROM estoque e
      JOIN produtos p ON p.id_produto = e.id_produto
      WHERE p.ativo = TRUE AND p.tipo != 'Combo'
    `);

    const totalUnidadesEstoque = Number(estoqueQuery[0]?.total_unidades || 0);
    const valorTotalEstoqueCusto = Number(estoqueQuery[0]?.valor_total_custo || 0);
    const valorTotalEstoqueVenda = Number(estoqueQuery[0]?.valor_total_venda || 0);
    const custoMedioAquisicao = Number(estoqueQuery[0]?.custo_medio_aquisicao || 0);

    // 2. Produtos com estoque baixo ou zerado
    const alertasEstoqueQuery = await AppDataSource.query(`
      SELECT 
        COUNT(CASE WHEN e.quantidade_atual <= e.estoque_minimo THEN 1 END) AS produtos_estoque_baixo,
        COUNT(CASE WHEN e.quantidade_atual = 0 THEN 1 END) AS produtos_zerados
      FROM estoque e
      JOIN produtos p ON p.id_produto = e.id_produto
      WHERE p.ativo = TRUE AND p.tipo != 'Combo'
    `);

    const produtosEstoqueBaixo = Number(alertasEstoqueQuery[0]?.produtos_estoque_baixo || 0);
    const produtosZerados = Number(alertasEstoqueQuery[0]?.produtos_zerados || 0);

    // 3. Vendas e Pedidos (Faturamento, pedidos confirmados, ticket médio)
    const vendasQuery = await AppDataSource.query(`
      SELECT 
        COUNT(*) AS total_pedidos,
        COALESCE(SUM(valor_total), 0) AS faturamento_total,
        COALESCE(AVG(valor_total), 0) AS ticket_medio,
        COUNT(CASE WHEN status = 'Concluido' THEN 1 END) AS concluidos,
        COUNT(CASE WHEN status = 'Confirmado' THEN 1 END) AS confirmados,
        COUNT(CASE WHEN status = 'Cancelado' THEN 1 END) AS cancelados
      FROM pedidos
      WHERE data_pedido >= ?
    `, [dataCorte]);

    const totalPedidos = Number(vendasQuery[0]?.total_pedidos || 0);
    const faturamentoTotal = Number(vendasQuery[0]?.faturamento_total || 0);
    const ticketMedio = Number(vendasQuery[0]?.ticket_medio || 0);
    const pedidosConcluidos = Number(vendasQuery[0]?.concluidos || 0);
    const pedidosConfirmados = Number(vendasQuery[0]?.confirmados || 0);
    const pedidosCancelados = Number(vendasQuery[0]?.cancelados || 0);

    // 4. Movimentações no período (Entradas e Saídas)
    const movQuery = await AppDataSource.query(`
      SELECT 
        COUNT(*) AS total_movimentacoes,
        COALESCE(SUM(CASE WHEN tipo = 'Entrada' THEN quantidade ELSE 0 END), 0) AS total_entradas,
        COALESCE(SUM(CASE WHEN tipo = 'Saída' THEN quantidade ELSE 0 END), 0) AS total_saidas
      FROM movimentacoes_estoque
      WHERE data_movimentacao >= ?
    `, [dataCorte]);

    const totalMovimentacoes = Number(movQuery[0]?.total_movimentacoes || 0);
    const totalEntradas = Number(movQuery[0]?.total_entradas || 0);
    const totalSaidas = Number(movQuery[0]?.total_saidas || 0);
    const frequenciaMediaMovimentacao = diasPeriodo > 0 ? (totalMovimentacoes / diasPeriodo) : 0;

    // 5. Giro de Estoque e Cobertura de Estoque
    // Giro = Saídas no período / Estoque médio
    const giroEstoque = totalUnidadesEstoque > 0 ? Number((totalSaidas / totalUnidadesEstoque).toFixed(2)) : 0;
    // Cobertura em dias = (Estoque atual / Saídas diárias médias)
    const saidaMediaDiaria = diasPeriodo > 0 ? (totalSaidas / diasPeriodo) : 0;
    const coberturaDias = saidaMediaDiaria > 0 ? Math.round(totalUnidadesEstoque / saidaMediaDiaria) : 999;

    // 6. Alertas de validade FEFO dos extintores
    const fefoQuery = await AppDataSource.query(`
      SELECT 
        COUNT(CASE WHEN DATEDIFF(data_validade, NOW()) <= 0 THEN 1 END) AS lotes_vencidos,
        COUNT(CASE WHEN DATEDIFF(data_validade, NOW()) > 0 AND DATEDIFF(data_validade, NOW()) <= 180 THEN 1 END) AS lotes_bloqueados,
        COUNT(CASE WHEN DATEDIFF(data_validade, NOW()) > 180 AND DATEDIFF(data_validade, NOW()) <= 365 THEN 1 END) AS lotes_alerta
      FROM lotes_estoque
      WHERE quantidade_disponivel > 0
    `);

    const lotesVencidos = Number(fefoQuery[0]?.lotes_vencidos || 0);
    const lotesBloqueados = Number(fefoQuery[0]?.lotes_bloqueados || 0);
    const lotesAlerta = Number(fefoQuery[0]?.lotes_alerta || 0);

    return {
      periodo_dias: diasPeriodo,
      estoque: {
        total_unidades: totalUnidadesEstoque,
        valor_total_custo: valorTotalEstoqueCusto,
        valor_total_venda: valorTotalEstoqueVenda,
        custo_medio_aquisicao: custoMedioAquisicao,
        produtos_estoque_baixo: produtosEstoqueBaixo,
        produtos_zerados: produtosZerados,
        giro_estoque: giroEstoque,
        cobertura_dias: coberturaDias,
      },
      vendas: {
        faturamento_total: faturamentoTotal,
        ticket_medio: ticketMedio,
        total_pedidos: totalPedidos,
        pedidos_confirmados: pedidosConfirmados,
        pedidos_concluidos: pedidosConcluidos,
        pedidos_cancelados: pedidosCancelados,
      },
      movimentacoes: {
        total_movimentacoes: totalMovimentacoes,
        total_entradas: totalEntradas,
        total_saidas: totalSaidas,
        frequencia_media_diaria: Number(frequenciaMediaMovimentacao.toFixed(1)),
      },
      fefo: {
        lotes_vencidos: lotesVencidos,
        lotes_bloqueados: lotesBloqueados,
        lotes_alerta: lotesAlerta,
      },
    };
  }

  /**
   * Dados agregados para gráficos e evolução temporal
   */
  async obterSeriesGraficos(dias: number = 30) {
    const dataCorte = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    // Série temporal de movimentações (Entradas vs Saídas por dia)
    const seriesMovimentacoes = await AppDataSource.query(`
      SELECT 
        DATE(data_movimentacao) as data,
        COALESCE(SUM(CASE WHEN tipo = 'Entrada' THEN quantidade ELSE 0 END), 0) as entradas,
        COALESCE(SUM(CASE WHEN tipo = 'Saída' THEN quantidade ELSE 0 END), 0) as saidas
      FROM movimentacoes_estoque
      WHERE data_movimentacao >= ?
      GROUP BY DATE(data_movimentacao)
      ORDER BY data ASC
    `, [dataCorte]);

    // Série temporal de vendas (Faturamento por dia)
    const seriesVendas = await AppDataSource.query(`
      SELECT 
        DATE(data_pedido) as data,
        COALESCE(SUM(valor_total), 0) as faturamento,
        COUNT(*) as quantidade_pedidos
      FROM pedidos
      WHERE data_pedido >= ? AND status != 'Cancelado'
      GROUP BY DATE(data_pedido)
      ORDER BY data ASC
    `, [dataCorte]);

    // Distribuição por categoria de produto
    const distribuicaoCategorias = await AppDataSource.query(`
      SELECT 
        COALESCE(p.categoria, 'Outros') as categoria,
        COALESCE(SUM(e.quantidade_atual), 0) as quantidade_estoque,
        COALESCE(SUM(e.quantidade_atual * p.preco), 0) as valor_estoque
      FROM produtos p
      JOIN estoque e ON e.id_produto = p.id_produto
      WHERE p.ativo = TRUE AND p.tipo != 'Combo'
      GROUP BY p.categoria
      ORDER BY quantidade_estoque DESC
    `);

    return {
      movimentacoes_por_dia: seriesMovimentacoes,
      vendas_por_dia: seriesVendas,
      distribuicao_categorias: distribuicaoCategorias,
    };
  }

  /**
   * SCRUM-25 · #17: Faturamento x Quedas de Anúncio
   * Cruza períodos de anúncios pausados ou rebaixados com a variação de faturamento diário,
   * calculando perda estimada por run-rate e correlação de impacto financeiro.
   */
  async obterImpactoQuedasAnuncios(diasPeriodo: number = 30) {
    const dataCorte = new Date(Date.now() - diasPeriodo * 24 * 60 * 60 * 1000);
    const agora = new Date();

    const anuncioRepo = AppDataSource.getRepository(AnuncioML);
    const ocorrenciaRepo = AppDataSource.getRepository(OcorrenciaAnuncio);
    const pedidoRepo = AppDataSource.getRepository(Pedido);

    // 1. Busca todos os anúncios e ocorrências de pausas/rebaixamentos
    const anuncios = await anuncioRepo.find();
    const ocorrencias = await ocorrenciaRepo.find({
      order: { data_ocorrencia: 'ASC' },
    });

    // 2. Busca vendas diárias no período
    const pedidos = await pedidoRepo.find({
      where: [
        { status: 'Confirmado' },
        { status: 'Concluido' },
      ],
      order: { data_pedido: 'ASC' },
    });

    const pedidosNoPeriodo = pedidos.filter(
      (p) => new Date(p.data_pedido) >= dataCorte
    );

    // Mapeia faturamento diário real
    const vendasPorDiaMap: Record<string, { faturamento: number; pedidos: number }> = {};
    for (const ped of pedidosNoPeriodo) {
      const dataStr = new Date(ped.data_pedido).toISOString().split('T')[0];
      if (!vendasPorDiaMap[dataStr]) {
        vendasPorDiaMap[dataStr] = { faturamento: 0, pedidos: 0 };
      }
      vendasPorDiaMap[dataStr].faturamento += Number(ped.valor_total || 0);
      vendasPorDiaMap[dataStr].pedidos += 1;
    }

    // 3. Mapeia períodos de inatividade/queda por anúncio
    const tiposQueda = [
      'Pausa por Estoque',
      'Pausa Manual',
      'Pausa por Reclamação / Moderação',
      'Rebaixado',
      'Suspensão ML',
      'Advertência',
      'Pausado',
      'Sob Revisão',
      'Queda de Status',
    ];

    interface IntervaloQueda {
      id_anuncio: number;
      titulo: string;
      ml_item_id: string;
      tipo_evento: string;
      detalhe: string;
      inicio: Date;
      fim: Date;
      dias_duracao: number;
      run_rate_diario: number;
      perda_estimada: number;
    }

    const intervalosQuedas: IntervaloQueda[] = [];

    // Analisa ocorrências registradas
    for (let i = 0; i < ocorrencias.length; i++) {
      const oc = ocorrencias[i];
      const ehQueda = tiposQueda.some((t) =>
        oc.tipo_evento?.toLowerCase().includes(t.toLowerCase()) ||
        oc.titulo?.toLowerCase().includes('pausado') ||
        oc.titulo?.toLowerCase().includes('rebaixado')
      );

      if (ehQueda) {
        const anuncio = anuncios.find((a) => a.id_anuncio === oc.id_anuncio);
        const dataInicio = new Date(oc.data_ocorrencia);

        // Procura próxima reativação após esta ocorrência
        let dataFim = agora;
        for (let j = i + 1; j < ocorrencias.length; j++) {
          if (
            ocorrencias[j].id_anuncio === oc.id_anuncio &&
            (ocorrencias[j].tipo_evento?.toLowerCase().includes('reativa') ||
             ocorrencias[j].tipo_evento?.toLowerCase().includes('ativo') ||
             ocorrencias[j].titulo?.toLowerCase().includes('reativa'))
          ) {
            dataFim = new Date(ocorrencias[j].data_ocorrencia);
            break;
          }
        }

        if (anuncio && anuncio.status === 'Ativo' && dataFim === agora) {
          const diffMs = agora.getTime() - dataInicio.getTime();
          const diasDiff = Math.min(Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24))), 5);
          dataFim = new Date(dataInicio.getTime() + diasDiff * 24 * 60 * 60 * 1000);
        }

        const duracaoDias = Math.max(1, Math.round((dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24)));

        const preco = Number(anuncio?.preco || 150);
        const qtdVendida = Number(anuncio?.quantidade_vendida || 10);
        const vendasDiaEstimadas = qtdVendida > 0 ? (qtdVendida / 60) : 1.2;
        const runRateDiario = Number((preco * Math.max(0.8, vendasDiaEstimadas)).toFixed(2));
        const perdaEstimada = Number((runRateDiario * duracaoDias).toFixed(2));

        intervalosQuedas.push({
          id_anuncio: oc.id_anuncio,
          titulo: anuncio?.titulo || oc.titulo || `Anúncio #${oc.id_anuncio}`,
          ml_item_id: anuncio?.ml_item_id || 'MLB-UNKNOWN',
          tipo_evento: oc.tipo_evento,
          detalhe: oc.detalhe,
          inicio: dataInicio,
          fim: dataFim,
          dias_duracao: duracaoDias,
          run_rate_diario: runRateDiario,
          perda_estimada: perdaEstimada,
        });
      }
    }

    // Se houver anúncios atualmente com status Pausado ou Rebaixado que não tinham ocorrência explícita
    for (const an of anuncios) {
      if (an.status === 'Pausado' || an.status === 'Rebaixado' || an.status === 'Sob Revisão') {
        const jaRegistrado = intervalosQuedas.some((iq) => iq.id_anuncio === an.id_anuncio);
        if (!jaRegistrado) {
          const dataInicio = an.data_exclusao ? new Date(an.data_exclusao) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const duracaoDias = Math.max(1, Math.round((agora.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24)));
          const preco = Number(an.preco || 160);
          const runRateDiario = Number((preco * 1.5).toFixed(2));
          intervalosQuedas.push({
            id_anuncio: an.id_anuncio,
            titulo: an.titulo,
            ml_item_id: an.ml_item_id,
            tipo_evento: `Pausa (${an.status})`,
            detalhe: an.motivo_exclusao || `Anúncio em estado ${an.status}`,
            inicio: dataInicio,
            fim: agora,
            dias_duracao: duracaoDias,
            run_rate_diario: runRateDiario,
            perda_estimada: Number((runRateDiario * duracaoDias).toFixed(2)),
          });
        }
      }
    }

    // 4. Monta a série temporal dia a dia do período
    const timeline: Array<{
      data: string;
      dia_formatado: string;
      faturamento_real: number;
      perda_estimada_quedas: number;
      faturamento_potencial: number;
      anuncios_pausados_count: number;
      quedas_ativas: string[];
    }> = [];

    let totalFaturamentoReal = 0;
    let totalPerdaEstimada = 0;

    for (let i = diasPeriodo - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dataStr = d.toISOString().split('T')[0];
      const diaFormatado = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

      const vendasDia = vendasPorDiaMap[dataStr] || { faturamento: 0, pedidos: 0 };
      const faturamentoReal = Number(vendasDia.faturamento.toFixed(2));

      let perdaDia = 0;
      let countPausados = 0;
      const quedasAtivasDia: string[] = [];

      for (const iq of intervalosQuedas) {
        const diaTime = d.getTime();
        const inicioTime = new Date(iq.inicio.toISOString().split('T')[0]).getTime();
        const fimTime = new Date(iq.fim.toISOString().split('T')[0]).getTime();

        if (diaTime >= inicioTime && diaTime <= fimTime) {
          perdaDia += iq.run_rate_diario;
          countPausados += 1;
          quedasAtivasDia.push(`${iq.titulo} (${iq.tipo_evento})`);
        }
      }

      perdaDia = Number(perdaDia.toFixed(2));
      const faturamentoPotencial = Number((faturamentoReal + perdaDia).toFixed(2));

      totalFaturamentoReal += faturamentoReal;
      totalPerdaEstimada += perdaDia;

      timeline.push({
        data: dataStr,
        dia_formatado: diaFormatado,
        faturamento_real: faturamentoReal,
        perda_estimada_quedas: perdaDia,
        faturamento_potencial: faturamentoPotencial,
        anuncios_pausados_count: countPausados,
        quedas_ativas: quedasAtivasDia,
      });
    }

    totalFaturamentoReal = Number(totalFaturamentoReal.toFixed(2));
    totalPerdaEstimada = Number(totalPerdaEstimada.toFixed(2));
    const faturamentoPotencialTotal = Number((totalFaturamentoReal + totalPerdaEstimada).toFixed(2));
    const impactoPercentual = faturamentoPotencialTotal > 0
      ? Number(((totalPerdaEstimada / faturamentoPotencialTotal) * 100).toFixed(1))
      : 0.0;

    // 5. Ranking de anúncios mais prejudicados
    const rankingMap: Record<number, {
      id_anuncio: number;
      titulo: string;
      ml_item_id: string;
      dias_pausado: number;
      perda_estimada: number;
      motivo_predominante: string;
    }> = {};

    for (const iq of intervalosQuedas) {
      if (!rankingMap[iq.id_anuncio]) {
        rankingMap[iq.id_anuncio] = {
          id_anuncio: iq.id_anuncio,
          titulo: iq.titulo,
          ml_item_id: iq.ml_item_id,
          dias_pausado: 0,
          perda_estimada: 0,
          motivo_predominante: iq.tipo_evento,
        };
      }
      rankingMap[iq.id_anuncio].dias_pausado += iq.dias_duracao;
      rankingMap[iq.id_anuncio].perda_estimada += iq.perda_estimada;
    }

    const rankingAnuncios = Object.values(rankingMap)
      .sort((a, b) => b.perda_estimada - a.perda_estimada)
      .map((r) => ({
        ...r,
        perda_estimada: Number(r.perda_estimada.toFixed(2)),
        sugestao_acao: r.motivo_predominante.toLowerCase().includes('estoque')
          ? 'Reabastecer lote FEFO de extintores e reativar anúncio imediatamente'
          : 'Revisar atributos técnicos / certificação INMETRO perante o ML',
      }));

    // 6. Distribuição de motivos
    const motivosMap: Record<string, number> = {};
    for (const iq of intervalosQuedas) {
      const mot = iq.tipo_evento || 'Outro';
      motivosMap[mot] = (motivosMap[mot] || 0) + 1;
    }
    const distribuicaoMotivos = Object.entries(motivosMap).map(([motivo, count]) => ({
      motivo,
      total_ocorrencias: count,
      percentual: intervalosQuedas.length > 0 ? Number(((count / intervalosQuedas.length) * 100).toFixed(1)) : 0,
    }));

    return {
      sucesso: true,
      periodo_dias: diasPeriodo,
      kpis: {
        faturamento_realizado_total: totalFaturamentoReal,
        faturamento_perdido_total: totalPerdaEstimada,
        faturamento_potencial_total: faturamentoPotencialTotal,
        impacto_percentual_receita: impactoPercentual,
        total_eventos_quedas: intervalosQuedas.length,
        total_dias_anuncio_indisponivel: intervalosQuedas.reduce((s, q) => s + q.dias_duracao, 0),
        anuncios_ativos_atualmente: anuncios.filter((a) => a.status === 'Ativo').length,
        anuncios_pausados_atualmente: anuncios.filter((a) => a.status === 'Pausado' || a.status === 'Rebaixado').length,
      },
      timeline_cruzada: timeline,
      ranking_anuncios: rankingAnuncios,
      distribuicao_motivos: distribuicaoMotivos,
    };
  }
}

