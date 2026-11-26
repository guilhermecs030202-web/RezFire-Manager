import { AppDataSource } from '../config/database';

export const LIMITES_ALERTAS_COMPRAS = {
  TAXA_ATRASO_RECORRENTE_MAXIMA_PERCENTUAL: 20, // Fornecedor com mais de 20% de pedidos entregues atrasados
  AUMENTO_CUSTO_ITEM_MAXIMO_PERCENTUAL: 10,     // Aumento de custo unitário de um item > 10%
  CONCENTRACAO_FORNECEDOR_MAXIMA_PERCENTUAL: 50, // Dependência > 50% em um único fornecedor
  DIAS_ATRASO_PEDIDO_CRITICO: 3,                 // Pedido em aberto com mais de 3 dias além do prazo previsto
};

export interface FiltrosDashboardCompras {
  from?: string | Date;
  to?: string | Date;
  dias?: number;
  supplierId?: number | 'ALL';
  categoryId?: string | 'ALL';
}

export interface KpiItemCompras {
  valor: number | string | null;
  valorFormatado?: string;
  deltaPercentual: number | null;
  deltaSentidoBom: boolean; // true se delta positivo é favorável, false se desfavorável
  tooltip: string;
  semDados?: boolean;
}

export interface AlertaAtencaoCompras {
  id: string;
  tipo: 'atraso_fornecedor' | 'aumento_custo' | 'alta_concentracao' | 'fornecedor_unico' | 'ruptura_sem_pedido' | 'pedido_muito_atrasado';
  severidade: 'critico' | 'atencao';
  titulo: string;
  mensagem: string;
  valorAtual: string | number;
  limiteConfigurado: string | number;
  acaoTexto?: string;
  acaoLink?: string;
}

export class PurchaseDashboardService {
  /**
   * Calcula todos os KPIs, séries de gráficos, scorecard e alertas no banco MySQL
   */
  async obterMetricasCompras(filtros: FiltrosDashboardCompras) {
    const agora = new Date();
    const dias = filtros.dias ? Math.max(1, Number(filtros.dias)) : 30;

    let dataFim = filtros.to ? new Date(filtros.to) : agora;
    let dataInicio: Date;

    if (filtros.from) {
      dataInicio = new Date(filtros.from);
    } else {
      dataInicio = new Date(dataFim.getTime() - dias * 24 * 60 * 60 * 1000);
    }

    const duracaoMs = dataFim.getTime() - dataInicio.getTime();
    const dataInicioAnt = new Date(dataInicio.getTime() - duracaoMs);
    const dataFimAnt = new Date(dataInicio.getTime());

    const isoInicio = dataInicio.toISOString().slice(0, 19).replace('T', ' ');
    const isoFim = dataFim.toISOString().slice(0, 19).replace('T', ' ');
    const isoInicioAnt = dataInicioAnt.toISOString().slice(0, 19).replace('T', ' ');
    const isoFimAnt = dataFimAnt.toISOString().slice(0, 19).replace('T', ' ');

    const supplierFilter = filtros.supplierId && filtros.supplierId !== 'ALL' ? Number(filtros.supplierId) : null;
    const categoryFilter = filtros.categoryId && filtros.categoryId !== 'ALL' ? String(filtros.categoryId).trim() : null;

    // Filtros SQL reutilizáveis
    let whereSupplierPO = '';
    let whereSupplierPOAnt = '';
    let paramsPO: any[] = [isoInicio, isoFim];
    let paramsPOAnt: any[] = [isoInicioAnt, isoFimAnt];

    if (supplierFilter) {
      whereSupplierPO = ' AND po.id_fornecedor = ?';
      whereSupplierPOAnt = ' AND po.id_fornecedor = ?';
      paramsPO.push(supplierFilter);
      paramsPOAnt.push(supplierFilter);
    }

    // ── 1. KPI Gasto Total e Pedidos de Compra (Atual e Anterior) ─────────────
    const sqlTotais = `
      SELECT 
        COUNT(po.id_pedido_compra) AS total_pedidos,
        COALESCE(SUM(po.valor_total), 0) AS gasto_total,
        COALESCE(AVG(po.valor_total), 0) AS ticket_medio
      FROM pedidos_compra po
      WHERE po.data_emissao BETWEEN ? AND ?
        AND po.status != 'Cancelado'
        ${whereSupplierPO}
    `;

    const [resAtual] = await AppDataSource.query(sqlTotais, paramsPO);
    const [resAnt] = await AppDataSource.query(sqlTotais, paramsPOAnt);

    const gastoAtual = Number(resAtual?.gasto_total) || 0;
    const gastoAnt = Number(resAnt?.gasto_total) || 0;
    const pedidosAtual = Number(resAtual?.total_pedidos) || 0;
    const pedidosAnt = Number(resAnt?.total_pedidos) || 0;
    const ticketAtual = Number(resAtual?.ticket_medio) || 0;
    const ticketAnt = Number(resAnt?.ticket_medio) || 0;

    // ── 2. KPI Prazo Médio de Entrega e Pontualidade ───────────────────────────
    const sqlPrazos = `
      SELECT 
        COUNT(*) AS recebidos_total,
        COALESCE(AVG(DATEDIFF(po.data_recebimento, po.data_emissao)), 0) AS prazo_medio_dias,
        SUM(CASE WHEN DATE(po.data_recebimento) <= DATE(po.data_previsao_entrega) THEN 1 ELSE 0 END) AS no_prazo_total
      FROM pedidos_compra po
      WHERE po.data_recebimento BETWEEN ? AND ?
        AND po.status = 'Recebido'
        ${whereSupplierPO}
    `;

    const [prazoAtual] = await AppDataSource.query(sqlPrazos, paramsPO);
    const [prazoAnt] = await AppDataSource.query(sqlPrazos, paramsPOAnt);

    const recebidosCount = Number(prazoAtual?.recebidos_total) || 0;
    const recebidosCountAnt = Number(prazoAnt?.recebidos_total) || 0;

    const prazoMedio = recebidosCount > 0 ? Number(prazoAtual?.prazo_medio_dias) || 0 : null;
    const prazoMedioAnt = recebidosCountAnt > 0 ? Number(prazoAnt?.prazo_medio_dias) || 0 : null;

    const taxaNoPrazo = recebidosCount > 0 ? (Number(prazoAtual?.no_prazo_total) / recebidosCount) * 100 : null;
    const taxaNoPrazoAnt = recebidosCountAnt > 0 ? (Number(prazoAnt?.no_prazo_total) / recebidosCountAnt) * 100 : null;

    // ── 3. KPI Pedidos Atrasados em Aberto ─────────────────────────────────────
    const sqlAtrasados = `
      SELECT COUNT(*) AS atrasados_aberto
      FROM pedidos_compra po
      WHERE (po.status = 'Atrasado' OR (po.status IN ('Aberto', 'Parcial') AND po.data_previsao_entrega < CURDATE()))
        ${supplierFilter ? 'AND po.id_fornecedor = ?' : ''}
    `;
    const [resAtrasados] = await AppDataSource.query(sqlAtrasados, supplierFilter ? [supplierFilter] : []);
    const atrasadosAberto = Number(resAtrasados?.atrasados_aberto) || 0;

    // ── 4. KPI Fornecedores Ativos e Concentração ──────────────────────────────
    const sqlFornecedoresAtivos = `
      SELECT 
        po.id_fornecedor,
        f.nome_fantasia,
        f.razao_social,
        SUM(po.valor_total) AS gasto_fornecedor
      FROM pedidos_compra po
      JOIN fornecedores f ON f.id_fornecedor = po.id_fornecedor
      WHERE po.data_emissao BETWEEN ? AND ?
        AND po.status != 'Cancelado'
        ${whereSupplierPO}
      GROUP BY po.id_fornecedor, f.nome_fantasia, f.razao_social
      ORDER BY gasto_fornecedor DESC
    `;
    const fornAtivosRows = await AppDataSource.query(sqlFornecedoresAtivos, paramsPO);
    const totalFornecedoresAtivos = fornAtivosRows.length;

    const maiorFornecedor = fornAtivosRows.length > 0 ? fornAtivosRows[0] : null;
    const gastoMaiorFornecedor = maiorFornecedor ? Number(maiorFornecedor.gasto_fornecedor) || 0 : 0;
    const concentracaoMaiorFornecedor = gastoAtual > 0 ? (gastoMaiorFornecedor / gastoAtual) * 100 : null;

    // ── 5. KPI Variação Média do Custo de Compra ────────────────────────────────
    // Compara o preço médio unitário dos mesmos produtos comprados no período atual vs anterior
    const sqlVariacaoCusto = `
      SELECT 
        atual.id_produto,
        p.nome AS produto_nome,
        atual.preco_medio_atual,
        ant.preco_medio_ant,
        ((atual.preco_medio_atual - ant.preco_medio_ant) / ant.preco_medio_ant) * 100 AS variacao_pct
      FROM (
        SELECT ipc.id_produto, AVG(ipc.preco_unitario) AS preco_medio_atual
        FROM itens_pedido_compra ipc
        JOIN pedidos_compra po ON po.id_pedido_compra = ipc.id_pedido_compra
        WHERE po.data_emissao BETWEEN ? AND ?
          AND po.status != 'Cancelado'
          ${whereSupplierPO}
        GROUP BY ipc.id_produto
      ) atual
      JOIN (
        SELECT ipc.id_produto, AVG(ipc.preco_unitario) AS preco_medio_ant
        FROM itens_pedido_compra ipc
        JOIN pedidos_compra po ON po.id_pedido_compra = ipc.id_pedido_compra
        WHERE po.data_emissao BETWEEN ? AND ?
          AND po.status != 'Cancelado'
          ${whereSupplierPOAnt}
        GROUP BY ipc.id_produto
      ) ant ON ant.id_produto = atual.id_produto
      JOIN produtos p ON p.id_produto = atual.id_produto
    `;

    const rowsVariacaoCusto = await AppDataSource.query(sqlVariacaoCusto, [...paramsPO, ...paramsPOAnt]);
    let variacaoMediaCusto: number | null = null;
    if (rowsVariacaoCusto.length > 0) {
      const somaPct = rowsVariacaoCusto.reduce((acc: number, r: any) => acc + (Number(r.variacao_pct) || 0), 0);
      variacaoMediaCusto = somaPct / rowsVariacaoCusto.length;
    }

    // Função de cálculo de delta percentual
    const calcDelta = (atual: number, anterior: number): number | null => {
      if (!anterior || anterior === 0) return null;
      return Number((((atual - anterior) / anterior) * 100).toFixed(1));
    };

    // ── 6. Montagem dos 8 Cards de KPI ─────────────────────────────────────────
    const kpis = {
      gastoTotal: {
        valor: gastoAtual,
        valorFormatado: Number(gastoAtual).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        deltaPercentual: calcDelta(gastoAtual, gastoAnt),
        deltaSentidoBom: false, // aumento de gasto de compras normalmente requer atenção no fluxo de caixa
        tooltip: 'Soma total dos valores de pedidos de compra emitidos no período (exclui cancelados).',
        semDados: gastoAtual === 0 && gastoAnt === 0,
      },
      pedidosCompra: {
        valor: pedidosAtual,
        valorFormatado: `${pedidosAtual} pedidos`,
        deltaPercentual: calcDelta(pedidosAtual, pedidosAnt),
        deltaSentidoBom: true,
        tooltip: 'Quantidade total de ordens de compra geradas no período selecionado.',
        semDados: pedidosAtual === 0,
      },
      ticketMedio: {
        valor: ticketAtual,
        valorFormatado: Number(ticketAtual).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        deltaPercentual: calcDelta(ticketAtual, ticketAnt),
        deltaSentidoBom: true,
        tooltip: 'Valor médio por pedido de compra emitido.',
        semDados: ticketAtual === 0,
      },
      prazoMedioEntrega: {
        valor: prazoMedio !== null ? Number(prazoMedio.toFixed(1)) : null,
        valorFormatado: prazoMedio !== null ? `${prazoMedio.toFixed(1)} dias` : 'Sem dados',
        deltaPercentual: prazoMedio !== null && prazoMedioAnt !== null ? calcDelta(prazoMedio, prazoMedioAnt) : null,
        deltaSentidoBom: false, // Menor prazo é melhor
        tooltip: 'Tempo médio decorrido entre a emissão do pedido e a confirmação de recebimento no galpão.',
        semDados: prazoMedio === null,
      },
      entregasNoPrazo: {
        valor: taxaNoPrazo !== null ? Number(taxaNoPrazo.toFixed(1)) : null,
        valorFormatado: taxaNoPrazo !== null ? `${taxaNoPrazo.toFixed(1)}%` : 'Sem dados',
        deltaPercentual: taxaNoPrazo !== null && taxaNoPrazoAnt !== null ? Number((taxaNoPrazo - taxaNoPrazoAnt).toFixed(1)) : null,
        deltaSentidoBom: true, // Maior pontualidade é melhor
        tooltip: 'Percentual de pedidos entregues até a data prevista combinada com o fornecedor.',
        semDados: taxaNoPrazo === null,
      },
      pedidosAtrasados: {
        valor: atrasadosAberto,
        valorFormatado: `${atrasadosAberto} em atraso`,
        deltaPercentual: null,
        deltaSentidoBom: false,
        tooltip: 'Pedidos em aberto ou parciais cuja data prevista já foi ultrapassada.',
        semDados: atrasadosAberto === 0,
      },
      variacaoCustoCompra: {
        valor: variacaoMediaCusto !== null ? Number(variacaoMediaCusto.toFixed(1)) : null,
        valorFormatado: variacaoMediaCusto !== null ? `${variacaoMediaCusto > 0 ? '+' : ''}${variacaoMediaCusto.toFixed(1)}%` : 'Sem compras comp.',
        deltaPercentual: variacaoMediaCusto !== null ? Number(variacaoMediaCusto.toFixed(1)) : null,
        deltaSentidoBom: false, // Aumento de custo é desfavorável
        tooltip: 'Variação média ponderada dos preços unitários pagos pelos mesmos itens comprados no período atual vs anterior.',
        semDados: variacaoMediaCusto === null,
      },
      fornecedoresAtivos: {
        valor: totalFornecedoresAtivos,
        valorFormatado: `${totalFornecedoresAtivos} ativos`,
        deltaPercentual: null,
        deltaSentidoBom: true,
        tooltip: 'Número de parceiros comerciais com ao menos 1 pedido de compra no período.',
        semDados: totalFornecedoresAtivos === 0,
      },
      concentracaoCompras: {
        valor: concentracaoMaiorFornecedor !== null ? Number(concentracaoMaiorFornecedor.toFixed(1)) : null,
        valorFormatado: concentracaoMaiorFornecedor !== null ? `${concentracaoMaiorFornecedor.toFixed(1)}%` : 'Sem dados',
        deltaPercentual: null,
        deltaSentidoBom: false, // Menor concentração é mais seguro
        fornecedorNome: maiorFornecedor?.nome_fantasia || maiorFornecedor?.razao_social || 'Nenhum',
        tooltip: `Percentual do volume total de compras concentrado no principal fornecedor (${maiorFornecedor?.nome_fantasia || 'N/A'}).`,
        semDados: concentracaoMaiorFornecedor === null,
      },
    };

    // ── 7. Gráficos ────────────────────────────────────────────────────────────

    // Gráfico 1: Evolução temporal do gasto em compras
    const sqlTimeline = `
      SELECT 
        DATE_FORMAT(po.data_emissao, '%d/%m') AS data_label,
        DATE(po.data_emissao) AS data_ordem,
        SUM(po.valor_total) AS total_dia,
        COUNT(po.id_pedido_compra) AS pedidos_dia
      FROM pedidos_compra po
      WHERE po.data_emissao BETWEEN ? AND ?
        AND po.status != 'Cancelado'
        ${whereSupplierPO}
      GROUP BY DATE(po.data_emissao), DATE_FORMAT(po.data_emissao, '%d/%m')
      ORDER BY data_ordem ASC
    `;
    const timelineRows = await AppDataSource.query(sqlTimeline, paramsPO);

    const timeline = {
      categories: timelineRows.map((r: any) => r.data_label),
      gasto: timelineRows.map((r: any) => Number(r.total_dia) || 0),
      pedidos: timelineRows.map((r: any) => Number(r.pedidos_dia) || 0),
    };

    // Gráfico 2: Top 10 Fornecedores por Gasto
    const topFornecedores = fornAtivosRows.slice(0, 10).map((r: any) => {
      const gasto = Number(r.gasto_fornecedor) || 0;
      const share = gastoAtual > 0 ? (gasto / gastoAtual) * 100 : 0;
      return {
        id: r.id_fornecedor,
        nome: r.nome_fantasia || r.razao_social,
        gasto,
        participacao: Number(share.toFixed(1)),
      };
    });

    // Gráfico 3: Prazo Previsto x Realizado por Fornecedor
    const sqlPrazosPorFornecedor = `
      SELECT 
        f.id_fornecedor,
        COALESCE(f.nome_fantasia, f.razao_social) AS fornecedor_nome,
        COALESCE(AVG(DATEDIFF(po.data_previsao_entrega, po.data_emissao)), 0) AS prazo_previsto_medio,
        COALESCE(AVG(DATEDIFF(po.data_recebimento, po.data_emissao)), 0) AS prazo_realizado_medio,
        COUNT(*) AS total_entregues
      FROM pedidos_compra po
      JOIN fornecedores f ON f.id_fornecedor = po.id_fornecedor
      WHERE po.data_recebimento BETWEEN ? AND ?
        AND po.status = 'Recebido'
        ${whereSupplierPO}
      GROUP BY f.id_fornecedor, fornecedor_nome
      ORDER BY total_entregues DESC
    `;
    const prazosFornRows = await AppDataSource.query(sqlPrazosPorFornecedor, paramsPO);

    const prazosPorFornecedor = {
      labels: prazosFornRows.map((r: any) => r.fornecedor_nome),
      previsto: prazosFornRows.map((r: any) => Number(Number(r.prazo_previsto_medio).toFixed(1))),
      realizado: prazosFornRows.map((r: any) => Number(Number(r.prazo_realizado_medio).toFixed(1))),
    };

    // Gráfico 4: Pedidos por Status
    const sqlStatusCount = `
      SELECT 
        UPPER(po.status) AS status,
        COUNT(*) AS total,
        COALESCE(SUM(po.valor_total), 0) AS valor
      FROM pedidos_compra po
      WHERE po.data_emissao BETWEEN ? AND ?
        ${whereSupplierPO}
      GROUP BY UPPER(po.status)
    `;
    const statusRows = await AppDataSource.query(sqlStatusCount, paramsPO);
    const statusDict: Record<string, { total: number; valor: number }> = {
      ABERTO: { total: 0, valor: 0 },
      PARCIAL: { total: 0, valor: 0 },
      RECEBIDO: { total: 0, valor: 0 },
      ATRASADO: { total: 0, valor: 0 },
      CANCELADO: { total: 0, valor: 0 },
      RASCUNHO: { total: 0, valor: 0 },
    };
    statusRows.forEach((r: any) => {
      const st = String(r.status || '').toUpperCase();
      if (statusDict[st]) {
        statusDict[st] = {
          total: Number(r.total) || 0,
          valor: Number(r.valor) || 0,
        };
      }
    });

    const statusChart = {
      labels: ['Recebido', 'Aberto', 'Atrasado', 'Parcial', 'Cancelado'],
      series: [
        statusDict['RECEBIDO'].total,
        statusDict['ABERTO'].total,
        statusDict['ATRASADO'].total,
        statusDict['PARCIAL'].total,
        statusDict['CANCELADO'].total,
      ],
      valores: [
        statusDict['RECEBIDO'].valor,
        statusDict['ABERTO'].valor,
        statusDict['ATRASADO'].valor,
        statusDict['PARCIAL'].valor,
        statusDict['CANCELADO'].valor,
      ],
    };

    // Gráfico 5: Gasto por Categoria de Produto
    const sqlGastoCategoria = `
      SELECT 
        COALESCE(p.categoria, 'Outros') AS categoria,
        SUM(ipc.subtotal) AS valor_categoria,
        COUNT(DISTINCT ipc.id_produto) AS itens_distintos
      FROM itens_pedido_compra ipc
      JOIN pedidos_compra po ON po.id_pedido_compra = ipc.id_pedido_compra
      JOIN produtos p ON p.id_produto = ipc.id_produto
      WHERE po.data_emissao BETWEEN ? AND ?
        AND po.status != 'Cancelado'
        ${whereSupplierPO}
        ${categoryFilter ? 'AND p.categoria = ?' : ''}
      GROUP BY p.categoria
      ORDER BY valor_categoria DESC
    `;
    const paramsCat = categoryFilter ? [...paramsPO, categoryFilter] : paramsPO;
    const catRows = await AppDataSource.query(sqlGastoCategoria, paramsCat);

    const categoriasChart = {
      labels: catRows.map((r: any) => r.categoria),
      series: catRows.map((r: any) => Number(r.valor_categoria) || 0),
    };

    // Gráfico 6: Evolução do Preço dos Itens Mais Comprados
    const sqlHistoricoPrecos = `
      SELECT 
        ipc.id_produto,
        p.nome AS produto_nome,
        DATE_FORMAT(po.data_emissao, '%d/%m/%Y') AS data_compra,
        po.data_emissao,
        ipc.preco_unitario,
        f.nome_fantasia AS fornecedor_nome
      FROM itens_pedido_compra ipc
      JOIN pedidos_compra po ON po.id_pedido_compra = ipc.id_pedido_compra
      JOIN produtos p ON p.id_produto = ipc.id_produto
      JOIN fornecedores f ON f.id_fornecedor = po.id_fornecedor
      WHERE po.data_emissao >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        AND po.status != 'Cancelado'
        ${supplierFilter ? 'AND po.id_fornecedor = ?' : ''}
      ORDER BY po.data_emissao ASC
    `;
    const precosRows = await AppDataSource.query(sqlHistoricoPrecos, supplierFilter ? [supplierFilter] : []);

    // Agrupa por produto para popular o seletor interativo
    const itensMaisCompradosMap: Record<number, { nome: string; historico: any[] }> = {};
    precosRows.forEach((r: any) => {
      if (!itensMaisCompradosMap[r.id_produto]) {
        itensMaisCompradosMap[r.id_produto] = {
          nome: r.produto_nome,
          historico: [],
        };
      }
      itensMaisCompradosMap[r.id_produto].historico.push({
        data: r.data_compra,
        preco: Number(r.preco_unitario),
        fornecedor: r.fornecedor_nome,
      });
    });

    const itensHistoricoPreco = Object.keys(itensMaisCompradosMap).map((id) => ({
      idProduto: Number(id),
      nome: itensMaisCompradosMap[Number(id)].nome,
      pontos: itensMaisCompradosMap[Number(id)].historico,
    }));

    // ── 8. Scorecard / Ranking de Fornecedores ─────────────────────────────────
    const sqlScorecard = `
      SELECT 
        f.id_fornecedor,
        f.razao_social,
        COALESCE(f.nome_fantasia, f.razao_social) AS nome_exibicao,
        f.cnpj,
        f.cidade,
        f.estado,
        f.ativo,
        COUNT(po.id_pedido_compra) AS total_pedidos,
        COALESCE(SUM(po.valor_total), 0) AS total_gasto,
        SUM(CASE WHEN po.status = 'Recebido' THEN 1 ELSE 0 END) AS pedidos_recebidos,
        SUM(CASE WHEN po.status = 'Recebido' AND DATE(po.data_recebimento) <= DATE(po.data_previsao_entrega) THEN 1 ELSE 0 END) AS pedidos_pontuais,
        COALESCE(AVG(CASE WHEN po.status = 'Recebido' THEN DATEDIFF(po.data_recebimento, po.data_emissao) END), f.prazo_padrao_dias) AS lead_time_medio,
        SUM(CASE WHEN po.status = 'Atrasado' OR (po.status IN ('Aberto', 'Parcial') AND po.data_previsao_entrega < CURDATE()) THEN 1 ELSE 0 END) AS pedidos_atrasados_aberto
      FROM fornecedores f
      LEFT JOIN pedidos_compra po ON po.id_fornecedor = f.id_fornecedor 
        AND po.data_emissao BETWEEN ? AND ?
        AND po.status != 'Cancelado'
      WHERE 1=1
        ${supplierFilter ? 'AND f.id_fornecedor = ?' : ''}
      GROUP BY f.id_fornecedor, f.razao_social, f.nome_fantasia, f.cnpj, f.cidade, f.estado, f.ativo, f.prazo_padrao_dias
      ORDER BY total_gasto DESC
    `;
    const scorecardRows = await AppDataSource.query(sqlScorecard, supplierFilter ? [isoInicio, isoFim, supplierFilter] : [isoInicio, isoFim]);

    // Cruzamento com reprovações/inspeções de qualidade de entrada
    const sqlReprovacoesQualidade = `
      SELECT 
        id_fornecedor_origem,
        COUNT(*) AS total_inspecoes,
        SUM(CASE WHEN status = 'Reprovado' OR destino_reprovados IS NOT NULL THEN 1 ELSE 0 END) AS total_reprovadas
      FROM inspecoes_qualidade
      WHERE id_fornecedor_origem IS NOT NULL
      GROUP BY id_fornecedor_origem
    `;
    let reprovacoesMap: Record<number, number> = {};
    try {
      const reprovRows = await AppDataSource.query(sqlReprovacoesQualidade);
      reprovRows.forEach((r: any) => {
        const total = Number(r.total_inspecoes) || 0;
        const reprov = Number(r.total_reprovadas) || 0;
        reprovacoesMap[r.id_fornecedor_origem] = total > 0 ? Number(((reprov / total) * 100).toFixed(1)) : 0;
      });
    } catch (e) {
      // Caso tabela inspecoes_qualidade não possua id_fornecedor_origem
    }

    const scorecard = scorecardRows.map((r: any) => {
      const totRec = Number(r.pedidos_recebidos) || 0;
      const pontuais = Number(r.pedidos_pontuais) || 0;
      const pontualidadePct = totRec > 0 ? Number(((pontuais / totRec) * 100).toFixed(1)) : null;
      const atrasados = Number(r.pedidos_atrasados_aberto) || 0;
      const taxaDevolucao = reprovacoesMap[r.id_fornecedor] ?? 0;

      // Status do parceiro
      let statusOperacional: 'Excelente' | 'Normal' | 'Alerta' | 'Crítico' = 'Normal';
      if (atrasados > 1 || (pontualidadePct !== null && pontualidadePct < 70)) {
        statusOperacional = 'Crítico';
      } else if (atrasados === 1 || (pontualidadePct !== null && pontualidadePct < 85)) {
        statusOperacional = 'Alerta';
      } else if (pontualidadePct !== null && pontualidadePct >= 95) {
        statusOperacional = 'Excelente';
      }

      return {
        idFornecedor: r.id_fornecedor,
        nome: r.nome_exibicao,
        cnpj: r.cnpj,
        cidadeUf: r.cidade && r.estado ? `${r.cidade}/${r.estado}` : (r.estado || '—'),
        totalPedidos: Number(r.total_pedidos) || 0,
        totalGasto: Number(r.total_gasto) || 0,
        pontualidadePct,
        leadTimeMedioDias: Number(Number(r.lead_time_medio).toFixed(1)),
        pedidosAtrasados: atrasados,
        taxaDevolucaoPct: taxaDevolucao,
        statusOperacional,
      };
    });

    // ── 9. Pontos de Atenção (Alertas Operacionais Inteligentes) ───────────────
    const alertas: AlertaAtencaoCompras[] = [];

    // Alerta 1: Fornecedor com atrasos recorrentes
    scorecard.forEach((s: any) => {
      if (s.pontualidadePct !== null && (100 - s.pontualidadePct) > LIMITES_ALERTAS_COMPRAS.TAXA_ATRASO_RECORRENTE_MAXIMA_PERCENTUAL) {
        const taxaAtraso = (100 - s.pontualidadePct).toFixed(1);
        alertas.push({
          id: `alerta-atraso-${s.idFornecedor}`,
          tipo: 'atraso_fornecedor',
          severidade: 'critico',
          titulo: `Fornecedor ${s.nome} com ${taxaAtraso}% de pedidos atrasados`,
          mensagem: `O parceiro entregou fora da data acordada em ${taxaAtraso}% das remessas recentes (limite seguro: ${LIMITES_ALERTAS_COMPRAS.TAXA_ATRASO_RECORRENTE_MAXIMA_PERCENTUAL}%). Recomendado renegociar SLA.`,
          valorAtual: `${taxaAtraso}%`,
          limiteConfigurado: `${LIMITES_ALERTAS_COMPRAS.TAXA_ATRASO_RECORRENTE_MAXIMA_PERCENTUAL}%`,
          acaoTexto: 'Filtrar Fornecedor',
          acaoLink: `dashboard.html?tab=compras&supplierId=${s.idFornecedor}`,
        });
      }
    });

    // Alerta 2: Aumento de custo de compra acima do limite (> 10%)
    rowsVariacaoCusto.forEach((r: any) => {
      const pct = Number(r.variacao_pct);
      if (pct >= LIMITES_ALERTAS_COMPRAS.AUMENTO_CUSTO_ITEM_MAXIMO_PERCENTUAL) {
        alertas.push({
          id: `alerta-custo-item-${r.id_produto}`,
          tipo: 'aumento_custo',
          severidade: 'atencao',
          titulo: `Aumento de custo em ${r.produto_nome}: +${pct.toFixed(1)}%`,
          mensagem: `O preço médio unitário subiu de R$ ${Number(r.preco_medio_ant).toFixed(2)} para R$ ${Number(r.preco_medio_atual).toFixed(2)}. Esse reajuste impacta diretamente a margem bruta de venda.`,
          valorAtual: `+${pct.toFixed(1)}%`,
          limiteConfigurado: `+${LIMITES_ALERTAS_COMPRAS.AUMENTO_CUSTO_ITEM_MAXIMO_PERCENTUAL}%`,
          acaoTexto: 'Ver Produtos',
          acaoLink: 'produtos.html',
        });
      }
    });

    // Alerta 3: Alta dependência de um único fornecedor (> 50%)
    if (concentracaoMaiorFornecedor !== null && concentracaoMaiorFornecedor >= LIMITES_ALERTAS_COMPRAS.CONCENTRACAO_FORNECEDOR_MAXIMA_PERCENTUAL) {
      alertas.push({
        id: 'alerta-alta-concentracao-fornecedor',
        tipo: 'alta_concentracao',
        severidade: 'atencao',
        titulo: `Alta dependência de compras: ${maiorFornecedor?.nome_fantasia || 'Principal'} concentra ${concentracaoMaiorFornecedor.toFixed(1)}% dos gastos`,
        mensagem: `Mais da metade do capital de aquisição está alocado em um único fornecedor. Desenvolva fornecedores alternativos para mitigar risco operacional de desabastecimento.`,
        valorAtual: `${concentracaoMaiorFornecedor.toFixed(1)}%`,
        limiteConfigurado: `${LIMITES_ALERTAS_COMPRAS.CONCENTRACAO_FORNECEDOR_MAXIMA_PERCENTUAL}%`,
        acaoTexto: 'Ver Scorecard',
        acaoLink: '#tabela-scorecard-compras',
      });
    }

    // Alerta 4: Itens com fornecedor único no catálogo
    const sqlFornecedorUnico = `
      SELECT 
        pf.id_produto,
        p.nome AS produto_nome,
        p.sku,
        f.nome_fantasia AS fornecedor_nome,
        COUNT(pf.id_fornecedor) AS qtd_fornecedores
      FROM produto_fornecedor pf
      JOIN produtos p ON p.id_produto = pf.id_produto
      JOIN fornecedores f ON f.id_fornecedor = pf.id_fornecedor
      GROUP BY pf.id_produto, p.nome, p.sku, f.nome_fantasia
      HAVING qtd_fornecedores = 1
    `;
    const itensFornUnico = await AppDataSource.query(sqlFornecedorUnico);
    if (itensFornUnico.length > 0) {
      const amostra = itensFornUnico.slice(0, 3).map((i: any) => i.sku).join(', ');
      alertas.push({
        id: 'alerta-itens-fornecedor-unico',
        tipo: 'fornecedor_unico',
        severidade: 'atencao',
        titulo: `${itensFornUnico.length} produto(s) possuem apenas 1 fornecedor homologado`,
        mensagem: `SKUs sem fonte alternativa de suprimento (${amostra}${itensFornUnico.length > 3 ? '...' : ''}). Qualquer parada técnica no fornecedor causará ruptura imediata no estoque.`,
        valorAtual: `${itensFornUnico.length} SKUs`,
        limiteConfigurado: '0 SKUs únicos',
        acaoTexto: 'Ver Estoque',
        acaoLink: 'estoque.html',
      });
    }

    // Alerta 5: Itens em ruptura/estoque baixo sem pedido de compra em aberto
    const sqlRupturaSemPedido = `
      SELECT 
        p.id_produto,
        p.sku,
        p.nome,
        e.quantidade_atual,
        e.estoque_minimo
      FROM produtos p
      JOIN estoque e ON e.id_produto = p.id_produto
      WHERE (e.quantidade_atual <= e.estoque_minimo OR e.quantidade_atual = 0)
        AND p.ativo = 1
        AND p.id_produto NOT IN (
          SELECT DISTINCT ipc.id_produto
          FROM itens_pedido_compra ipc
          JOIN pedidos_compra po ON po.id_pedido_compra = ipc.id_pedido_compra
          WHERE po.status IN ('Aberto', 'Parcial', 'Atrasado')
        )
    `;
    const rupturasSemPedido = await AppDataSource.query(sqlRupturaSemPedido);
    if (rupturasSemPedido.length > 0) {
      const nomes = rupturasSemPedido.slice(0, 2).map((r: any) => r.sku).join(', ');
      alertas.push({
        id: 'alerta-ruptura-sem-pedido',
        tipo: 'ruptura_sem_pedido',
        severidade: 'critico',
        titulo: `${rupturasSemPedido.length} produto(s) abaixo do mínimo sem pedido de compra gerado`,
        mensagem: `Itens críticos em risco iminente de desabastecimento (${nomes}) sem ordem de reposição ativa no momento. É urgente emitir pedido de compra.`,
        valorAtual: `${rupturasSemPedido.length} SKUs`,
        limiteConfigurado: '0 sem pedido',
        acaoTexto: 'Abrir Estoque',
        acaoLink: 'estoque.html?filtro=abaixo_minimo',
      });
    }

    // Alerta 6: Pedidos em aberto muito atrasados além do prazo previsto (> 3 dias)
    const sqlPedidosCriticos = `
      SELECT 
        po.id_pedido_compra,
        po.numero_pedido,
        f.nome_fantasia,
        po.data_previsao_entrega,
        DATEDIFF(CURDATE(), po.data_previsao_entrega) AS dias_atraso
      FROM pedidos_compra po
      JOIN fornecedores f ON f.id_fornecedor = po.id_fornecedor
      WHERE po.status IN ('Aberto', 'Atrasado', 'Parcial')
        AND DATEDIFF(CURDATE(), po.data_previsao_entrega) >= ?
      ORDER BY dias_atraso DESC
    `;
    const pedidosCriticos = await AppDataSource.query(sqlPedidosCriticos, [LIMITES_ALERTAS_COMPRAS.DIAS_ATRASO_PEDIDO_CRITICO]);
    if (pedidosCriticos.length > 0) {
      const ped = pedidosCriticos[0];
      alertas.push({
        id: `alerta-pedido-muito-atrasado-${ped.id_pedido_compra}`,
        tipo: 'pedido_muito_atrasado',
        severidade: 'critico',
        titulo: `Pedido ${ped.numero_pedido} (${ped.nome_fantasia}) com ${ped.dias_atraso} dias de atraso crítico`,
        mensagem: `A previsão de entrega venceu em ${new Date(ped.data_previsao_entrega).toLocaleDateString('pt-BR')}. Cobrança imediata ao setor de expedição do fornecedor necessária.`,
        valorAtual: `${ped.dias_atraso} dias`,
        limiteConfigurado: `${LIMITES_ALERTAS_COMPRAS.DIAS_ATRASO_PEDIDO_CRITICO} dias`,
        acaoTexto: 'Cobrar Fornecedor',
        acaoLink: '#tabela-scorecard-compras',
      });
    }

    // Lista de fornecedores para preenchimento de filtros no frontend
    const todosFornecedores = await AppDataSource.query(`
      SELECT id_fornecedor, COALESCE(nome_fantasia, razao_social) AS nome
      FROM fornecedores
      WHERE ativo = 1
      ORDER BY nome ASC
    `);

    return {
      sucesso: true,
      periodo: {
        dias,
        dataInicio: isoInicio,
        dataFim: isoFim,
        supplierId: supplierFilter,
        categoryId: categoryFilter,
      },
      fornecedoresFiltro: todosFornecedores,
      kpis,
      graficos: {
        timeline,
        topFornecedores,
        prazosPorFornecedor,
        statusChart,
        categoriasChart,
        itensHistoricoPreco,
      },
      scorecard,
      alertas,
    };
  }
}
