import { AppDataSource } from '../config/database';
import { Pedido } from '../entities/Pedido';
import { Estoque } from '../entities/Estoque';
import { Produto } from '../entities/Produto';
import { MovimentacaoEstoque } from '../entities/MovimentacaoEstoque';
import { LoteEstoque } from '../entities/LoteEstoque';

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
}

