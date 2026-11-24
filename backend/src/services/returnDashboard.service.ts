import { AppDataSource } from '../config/database';

export const LIMITES_ALERTAS_QUALIDADE = {
  TAXA_DEVOLUCAO_GERAL_MAXIMA_PCT: 5.0,    // Alerta se taxa de devoluções global passar de 5%
  CONCENTRACAO_MOTIVO_MAXIMA_PCT: 40.0,   // Alerta se um único motivo concentrar mais de 40% dos casos
  DIAS_SLA_RESOLUCAO_CRITICO: 7,          // Devoluções em aberto há mais de 7 dias sem conclusão
  TAXA_DEVOLUCAO_PRODUTO_CRITICA_PCT: 8.0, // Produto com mais de 8% de taxa de devolução
  FORNECEDOR_DEFEITO_CRITICO_PCT: 6.0,    // Fornecedor com taxa de itens defeituosos > 6%
};

export interface FiltrosDashboardDevolucoes {
  from?: string | Date;
  to?: string | Date;
  dias?: number;
  motivo?: string | 'ALL';
  categoryId?: string | 'ALL';
  supplierId?: number | 'ALL';
}

export interface KpiItemDevolucoes {
  valor: number | string | null;
  valorFormatado?: string;
  deltaPercentual: number | null;
  deltaSentidoBom: boolean; // true se delta positivo é favorável, false se desfavorável
  tooltip: string;
  semDados?: boolean;
}

export interface AlertaAtencaoDevolucoes {
  id: string;
  tipo: 'taxa_alta' | 'dominancia_motivo' | 'sla_estourado' | 'produto_critico' | 'fornecedor_defeito';
  severidade: 'critico' | 'atencao';
  titulo: string;
  mensagem: string;
  valorAtual: string | number;
  limiteConfigurado: string | number;
  acaoTexto?: string;
  acaoLink?: string;
}

export class ReturnDashboardService {
  /**
   * Calcula todos os KPIs, gráficos e alertas de Devoluções e Qualidade no banco MySQL
   */
  async obterMetricasDevolucoes(filtros: FiltrosDashboardDevolucoes) {
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

    const motivoFilter = filtros.motivo && filtros.motivo !== 'ALL' ? String(filtros.motivo).trim() : null;
    const categoryFilter = filtros.categoryId && filtros.categoryId !== 'ALL' ? String(filtros.categoryId).trim() : null;
    const supplierFilter = filtros.supplierId && filtros.supplierId !== 'ALL' ? Number(filtros.supplierId) : null;

    // Filtros dinâmicos SQL para itens de devolução
    let whereClause = 'WHERE d.data_abertura BETWEEN ? AND ?';
    let whereClauseAnt = 'WHERE d.data_abertura BETWEEN ? AND ?';
    const params: any[] = [isoInicio, isoFim];
    const paramsAnt: any[] = [isoInicioAnt, isoFimAnt];

    if (motivoFilter) {
      whereClause += ' AND idv.motivo = ?';
      whereClauseAnt += ' AND idv.motivo = ?';
      params.push(motivoFilter);
      paramsAnt.push(motivoFilter);
    }

    if (categoryFilter) {
      whereClause += ' AND p.categoria = ?';
      whereClauseAnt += ' AND p.categoria = ?';
      params.push(categoryFilter);
      paramsAnt.push(categoryFilter);
    }

    if (supplierFilter) {
      whereClause += ' AND pf.id_fornecedor = ?';
      whereClauseAnt += ' AND pf.id_fornecedor = ?';
      params.push(supplierFilter);
      paramsAnt.push(supplierFilter);
    }

    // ── 1. KPI Total de Devoluções e Valores (Período Atual e Anterior) ────────
    const sqlTotaisDev = `
      SELECT 
        COUNT(DISTINCT d.id_devolucao) AS total_devolucoes,
        COALESCE(SUM(idv.quantidade), 0) AS qtd_itens_devolvidos,
        COALESCE(SUM(idv.subtotal), 0) AS valor_itens_devolvidos,
        COALESCE(SUM(d.valor_total_reembolso), 0) AS valor_total_reembolsado,
        COALESCE(SUM(d.custo_frete_reverso), 0) AS custo_frete_reverso,
        COALESCE(SUM(idv.custo_perda_item), 0) AS custo_perda_descarte,
        AVG(CASE WHEN d.data_conclusao IS NOT NULL THEN DATEDIFF(d.data_conclusao, d.data_abertura) ELSE NULL END) AS tempo_medio_resolucao_dias
      FROM devolucoes d
      JOIN itens_devolucao idv ON idv.id_devolucao = d.id_devolucao
      JOIN produtos p ON p.id_produto = idv.id_produto
      LEFT JOIN produto_fornecedor pf ON pf.id_produto = p.id_produto AND pf.principal = 1
      ${whereClause}
    `;

    const [resAtual] = await AppDataSource.query(sqlTotaisDev, params);
    const [resAnt] = await AppDataSource.query(sqlTotaisDev, paramsAnt);

    const totalDevolucoesAtual = Number(resAtual?.total_devolucoes) || 0;
    const totalDevolucoesAnt = Number(resAnt?.total_devolucoes) || 0;
    const qtdDevolvidaAtual = Number(resAtual?.qtd_itens_devolvidos) || 0;
    const qtdDevolvidaAnt = Number(resAnt?.qtd_itens_devolvidos) || 0;
    const valorReembolsadoAtual = Number(resAtual?.valor_total_reembolsado) || 0;
    const valorReembolsadoAnt = Number(resAnt?.valor_total_reembolsado) || 0;
    const freteReversoAtual = Number(resAtual?.custo_frete_reverso) || 0;
    const perdaDescarteAtual = Number(resAtual?.custo_perda_descarte) || 0;
    const custoTotalDevolucoesAtual = valorReembolsadoAtual + freteReversoAtual + perdaDescarteAtual;
    const freteReversoAnt = Number(resAnt?.custo_frete_reverso) || 0;
    const perdaDescarteAnt = Number(resAnt?.custo_perda_descarte) || 0;
    const custoTotalDevolucoesAnt = valorReembolsadoAnt + freteReversoAnt + perdaDescarteAnt;
    const tempoResolucaoAtual = resAtual?.tempo_medio_resolucao_dias !== null ? Number(Number(resAtual?.tempo_medio_resolucao_dias).toFixed(1)) : null;
    const tempoResolucaoAnt = resAnt?.tempo_medio_resolucao_dias !== null ? Number(Number(resAnt?.tempo_medio_resolucao_dias).toFixed(1)) : null;

    // ── 2. Itens Vendidos no Período para calcular Taxa Real de Devolução ──────
    const sqlVendas = `
      SELECT 
        COALESCE(SUM(ip.quantidade), 0) AS qtd_itens_vendidos,
        COALESCE(SUM(ip.subtotal), 0) AS valor_itens_vendidos
      FROM itens_pedido ip
      JOIN pedidos ped ON ped.id_pedido = ip.id_pedido
      JOIN produtos p ON p.id_produto = ip.id_produto
      LEFT JOIN produto_fornecedor pf ON pf.id_produto = p.id_produto AND pf.principal = 1
      WHERE ped.data_pedido BETWEEN ? AND ?
        AND ped.status IN ('Confirmado', 'Concluido')
        ${categoryFilter ? 'AND p.categoria = ?' : ''}
        ${supplierFilter ? 'AND pf.id_fornecedor = ?' : ''}
    `;
    const paramsVendas: any[] = [isoInicio, isoFim];
    if (categoryFilter) paramsVendas.push(categoryFilter);
    if (supplierFilter) paramsVendas.push(supplierFilter);

    const paramsVendasAnt: any[] = [isoInicioAnt, isoFimAnt];
    if (categoryFilter) paramsVendasAnt.push(categoryFilter);
    if (supplierFilter) paramsVendasAnt.push(supplierFilter);

    const [vendasAtual] = await AppDataSource.query(sqlVendas, paramsVendas);
    const [vendasAnt] = await AppDataSource.query(sqlVendas, paramsVendasAnt);

    const qtdVendidaAtual = Number(vendasAtual?.qtd_itens_vendidos) || 0;
    const qtdVendidaAnt = Number(vendasAnt?.qtd_itens_vendidos) || 0;
    const valorVendidoAtual = Number(vendasAtual?.valor_itens_vendidos) || 0;
    const valorVendidoAnt = Number(vendasAnt?.valor_itens_vendidos) || 0;

    const taxaDevolucaoQtdAtual = qtdVendidaAtual > 0 ? Number(((qtdDevolvidaAtual / qtdVendidaAtual) * 100).toFixed(1)) : 0;
    const taxaDevolucaoQtdAnt = qtdVendidaAnt > 0 ? Number(((qtdDevolvidaAnt / qtdVendidaAnt) * 100).toFixed(1)) : 0;
    const taxaDevolucaoValorAtual = valorVendidoAtual > 0 ? Number(((valorReembolsadoAtual / valorVendidoAtual) * 100).toFixed(1)) : 0;

    // ── 3. Devoluções em Aberto e Atrasadas (Passaram do Prazo Limite) ────────
    const sqlAbertas = `
      SELECT 
        COUNT(DISTINCT d.id_devolucao) AS total_abertas,
        SUM(CASE WHEN DATEDIFF(?, d.data_abertura) > d.prazo_limite_dias THEN 1 ELSE 0 END) AS atrasadas
      FROM devolucoes d
      WHERE d.status IN ('ABERTA', 'EM_ANALISE')
    `;
    const [resAbertas] = await AppDataSource.query(sqlAbertas, [new Date()]);
    const abertasCount = Number(resAbertas?.total_abertas) || 0;
    const atrasadasCount = Number(resAbertas?.atrasadas) || 0;

    // ── 4. Resoluções: Troca vs Reembolso vs Outros ───────────────────────────
    const sqlResolucao = `
      SELECT 
        d.tipo_resolucao,
        COUNT(DISTINCT d.id_devolucao) AS total
      FROM devolucoes d
      JOIN itens_devolucao idv ON idv.id_devolucao = d.id_devolucao
      JOIN produtos p ON p.id_produto = idv.id_produto
      LEFT JOIN produto_fornecedor pf ON pf.id_produto = p.id_produto AND pf.principal = 1
      ${whereClause}
      GROUP BY d.tipo_resolucao
    `;
    const resResolucao = await AppDataSource.query(sqlResolucao, params);
    let totalReembolso = 0;
    let totalTroca = 0;
    let totalResolvidas = 0;
    for (const r of resResolucao) {
      const cnt = Number(r.total) || 0;
      totalResolvidas += cnt;
      if (r.tipo_resolucao === 'REEMBOLSO') totalReembolso += cnt;
      if (r.tipo_resolucao === 'TROCA') totalTroca += cnt;
    }
    const pctReembolso = totalResolvidas > 0 ? Number(((totalReembolso / totalResolvidas) * 100).toFixed(1)) : 0;
    const pctTroca = totalResolvidas > 0 ? Number(((totalTroca / totalResolvidas) * 100).toFixed(1)) : 0;

    // ── 5. Destino Físico do Item: Recuperados (Estoque) vs Perdidos (Descarte)
    const sqlDestino = `
      SELECT 
        idv.destino_item,
        SUM(idv.quantidade) AS total_qtd
      FROM devolucoes d
      JOIN itens_devolucao idv ON idv.id_devolucao = d.id_devolucao
      JOIN produtos p ON p.id_produto = idv.id_produto
      LEFT JOIN produto_fornecedor pf ON pf.id_produto = p.id_produto AND pf.principal = 1
      ${whereClause}
      GROUP BY idv.destino_item
    `;
    const resDestino = await AppDataSource.query(sqlDestino, params);
    let recuperadosQtd = 0;
    let descartadosQtd = 0;
    let avaliacaoQtd = 0;
    for (const d of resDestino) {
      const q = Number(d.total_qtd) || 0;
      if (d.destino_item === 'RECUPERADO') recuperadosQtd += q;
      if (d.destino_item === 'DESCARTADO') descartadosQtd += q;
      if (d.destino_item === 'EM_AVALIACAO') avaliacaoQtd += q;
    }

    // Função auxiliar de cálculo de delta percentual
    const calcDelta = (atual: number, ant: number) => {
      if (!ant && !atual) return null;
      if (!ant) return 100;
      return Number((((atual - ant) / ant) * 100).toFixed(1));
    };

    // ── KPI CARDS ────────────────────────────────────────────────────────────
    const kpis = {
      totalDevolucoes: {
        valor: totalDevolucoesAtual,
        deltaPercentual: calcDelta(totalDevolucoesAtual, totalDevolucoesAnt),
        deltaSentidoBom: totalDevolucoesAtual <= totalDevolucoesAnt,
        tooltip: 'Quantidade total de devoluções e trocas abertas no período.',
      },
      taxaDevolucao: {
        valor: taxaDevolucaoQtdAtual,
        taxaValorPercentual: taxaDevolucaoValorAtual,
        deltaPercentual: calcDelta(taxaDevolucaoQtdAtual, taxaDevolucaoQtdAnt),
        deltaSentidoBom: taxaDevolucaoQtdAtual <= taxaDevolucaoQtdAnt,
        tooltip: 'Percentual de itens devolvidos em relação ao total de itens vendidos no mesmo período.',
      },
      valorReembolsado: {
        valor: valorReembolsadoAtual,
        deltaPercentual: calcDelta(valorReembolsadoAtual, valorReembolsadoAnt),
        deltaSentidoBom: valorReembolsadoAtual <= valorReembolsadoAnt,
        tooltip: 'Montante financeiro ressarcido diretamente aos clientes em devoluções concluídas.',
      },
      custoTotalDevolucoes: {
        valor: custoTotalDevolucoesAtual,
        freteReverso: freteReversoAtual,
        perdaDescarte: perdaDescarteAtual,
        deltaPercentual: calcDelta(custoTotalDevolucoesAtual, custoTotalDevolucoesAnt),
        deltaSentidoBom: custoTotalDevolucoesAtual <= custoTotalDevolucoesAnt,
        tooltip: 'Impacto total estimado: Reembolsos pagos + Frete reverso + Custo de aquisição de itens descartados.',
      },
      tempoMedioResolucao: {
        valor: tempoResolucaoAtual !== null ? tempoResolucaoAtual : '—',
        deltaPercentual: tempoResolucaoAtual !== null && tempoResolucaoAnt !== null ? calcDelta(tempoResolucaoAtual, tempoResolucaoAnt) : null,
        deltaSentidoBom: tempoResolucaoAtual !== null && tempoResolucaoAnt !== null ? tempoResolucaoAtual <= tempoResolucaoAnt : true,
        tooltip: 'Média de dias decorridos entre a data de abertura e a data de conclusão das devoluções.',
      },
      devolucoesAbertas: {
        valor: abertasCount,
        atrasadas: atrasadasCount,
        deltaPercentual: null,
        deltaSentidoBom: atrasadasCount === 0,
        tooltip: 'Casos atualmente em aberto ou em análise, sinalizando os que estouraram o prazo limite acordado.',
      },
      trocaVsReembolso: {
        valor: `${pctTroca}% / ${pctReembolso}%`,
        shareTroca: pctTroca,
        shareReembolso: pctReembolso,
        deltaPercentual: null,
        deltaSentidoBom: true,
        tooltip: 'Divisão percentual das resoluções concluídas: Troca de mercadoria versus devolução de dinheiro.',
      },
      itensRecuperadosVsPerdidos: {
        valor: `${recuperadosQtd} / ${descartadosQtd}`,
        recuperados: recuperadosQtd,
        descartados: descartadosQtd,
        emAvaliacao: avaliacaoQtd,
        deltaPercentual: null,
        deltaSentidoBom: descartadosQtd <= recuperadosQtd,
        tooltip: 'Unidades que voltaram ao estoque comercializável versus unidades descartadas por dano irrecuperável.',
      },
    };

    // ── 6. GRÁFICOS ──────────────────────────────────────────────────────────

    // Gráfico 1: Timeline de Devoluções ao Longo do Tempo e Taxa
    const sqlTimeline = `
      SELECT 
        DATE_FORMAT(d.data_abertura, '%d/%m') AS dia_mes,
        DATE(d.data_abertura) AS data_dia,
        COUNT(DISTINCT d.id_devolucao) AS total_dev,
        COALESCE(SUM(idv.quantidade), 0) AS qtd_itens
      FROM devolucoes d
      JOIN itens_devolucao idv ON idv.id_devolucao = d.id_devolucao
      JOIN produtos p ON p.id_produto = idv.id_produto
      LEFT JOIN produto_fornecedor pf ON pf.id_produto = p.id_produto AND pf.principal = 1
      ${whereClause}
      GROUP BY DATE(d.data_abertura), DATE_FORMAT(d.data_abertura, '%d/%m')
      ORDER BY data_dia ASC
    `;
    const resTimeline = await AppDataSource.query(sqlTimeline, params);
    const timelineCategories = resTimeline.map((r: any) => r.dia_mes);
    const timelineDevolucoes = resTimeline.map((r: any) => Number(r.total_dev) || 0);
    const timelineItens = resTimeline.map((r: any) => Number(r.qtd_itens) || 0);

    // Gráfico 2: Motivos de Devolução (Pareto: Ocorrências + % Acumulada)
    const sqlPareto = `
      SELECT 
        idv.motivo,
        COUNT(*) AS ocorrencias,
        SUM(idv.quantidade) AS total_qtd
      FROM devolucoes d
      JOIN itens_devolucao idv ON idv.id_devolucao = d.id_devolucao
      JOIN produtos p ON p.id_produto = idv.id_produto
      LEFT JOIN produto_fornecedor pf ON pf.id_produto = p.id_produto AND pf.principal = 1
      ${whereClause}
      GROUP BY idv.motivo
      ORDER BY ocorrencias DESC
    `;
    const resPareto = await AppDataSource.query(sqlPareto, params);
    const totalOcorrenciasPareto = resPareto.reduce((acc: number, r: any) => acc + Number(r.ocorrencias), 0);

    const motivoLabelsMap: Record<string, string> = {
      DEFEITO: 'Defeito de Fabricação',
      AVARIA_TRANSPORTE: 'Avaria de Transporte',
      PRODUTO_ERRADO: 'Produto Errado (Expedição)',
      DIVERGENCIA_DESCRICAO: 'Divergência na Descrição',
      ARREPENDIMENTO: 'Arrependimento / Desistência',
      OUTRO: 'Outro Motivo',
    };

    let somaAcumulada = 0;
    const paretoLabels: string[] = [];
    const paretoOcorrencias: number[] = [];
    const paretoAcumulado: number[] = [];

    for (const r of resPareto) {
      const oc = Number(r.ocorrencias);
      somaAcumulada += oc;
      const pctAcum = totalOcorrenciasPareto > 0 ? Number(((somaAcumulada / totalOcorrenciasPareto) * 100).toFixed(1)) : 0;
      paretoLabels.push(motivoLabelsMap[r.motivo] || r.motivo);
      paretoOcorrencias.push(oc);
      paretoAcumulado.push(pctAcum);
    }

    // Gráfico 3: Top 10 Produtos com Mais Devoluções (Qtd e Taxa %)
    const sqlTopProdutos = `
      SELECT 
        p.id_produto,
        p.nome AS produto_nome,
        p.sku,
        SUM(idv.quantidade) AS qtd_devolvida,
        SUM(idv.subtotal) AS valor_devolvido
      FROM devolucoes d
      JOIN itens_devolucao idv ON idv.id_devolucao = d.id_devolucao
      JOIN produtos p ON p.id_produto = idv.id_produto
      LEFT JOIN produto_fornecedor pf ON pf.id_produto = p.id_produto AND pf.principal = 1
      ${whereClause}
      GROUP BY p.id_produto, p.nome, p.sku
      ORDER BY qtd_devolvida DESC
      LIMIT 10
    `;
    const resTopProdutos = await AppDataSource.query(sqlTopProdutos, params);
    const topProdutos = [];

    for (const prod of resTopProdutos) {
      // Buscar total vendido desse produto no mesmo período
      const [vendaProd] = await AppDataSource.query(
        `SELECT COALESCE(SUM(quantidade), 0) AS qtd_vendida FROM itens_pedido ip 
         JOIN pedidos ped ON ped.id_pedido = ip.id_pedido 
         WHERE ip.id_produto = ? AND ped.data_pedido BETWEEN ? AND ? AND ped.status IN ('Confirmado', 'Concluido')`,
        [prod.id_produto, isoInicio, isoFim]
      );
      const vendida = Number(vendaProd?.qtd_vendida) || 0;
      const devolvida = Number(prod.qtd_devolvida) || 0;
      const taxa = vendida > 0 ? Number(((devolvida / vendida) * 100).toFixed(1)) : 100;

      topProdutos.push({
        idProduto: prod.id_produto,
        nome: prod.produto_nome,
        sku: prod.sku,
        qtdDevolvida: devolvida,
        qtdVendida: vendida,
        taxaDevolucaoPct: taxa,
        valorDevolvido: Number(prod.valor_devolvido) || 0,
      });
    }

    // Gráfico 4: Taxa de Devolução por Categoria de Produto
    const sqlCategorias = `
      SELECT 
        COALESCE(NULLIF(TRIM(p.categoria), ''), 'Extintores') AS categoria,
        SUM(idv.quantidade) AS total_devolvido
      FROM devolucoes d
      JOIN itens_devolucao idv ON idv.id_devolucao = d.id_devolucao
      JOIN produtos p ON p.id_produto = idv.id_produto
      LEFT JOIN produto_fornecedor pf ON pf.id_produto = p.id_produto AND pf.principal = 1
      ${whereClause}
      GROUP BY COALESCE(NULLIF(TRIM(p.categoria), ''), 'Extintores')
      ORDER BY total_devolvido DESC
    `;
    const resCategorias = await AppDataSource.query(sqlCategorias, params);
    const categoriasLabels = resCategorias.map((r: any) => r.categoria);
    const categoriasSeries = resCategorias.map((r: any) => Number(r.total_devolvido) || 0);

    // Gráfico 5: Taxa de Problemas por Fornecedor (Cruzando devoluções com fornecedor principal)
    const sqlFornecedores = `
      SELECT 
        f.id_fornecedor,
        f.razao_social AS fornecedor_nome,
        COUNT(DISTINCT d.id_devolucao) AS total_casos,
        SUM(idv.quantidade) AS itens_com_defeito
      FROM devolucoes d
      JOIN itens_devolucao idv ON idv.id_devolucao = d.id_devolucao
      JOIN produtos p ON p.id_produto = idv.id_produto
      JOIN produto_fornecedor pf ON pf.id_produto = p.id_produto AND pf.principal = 1
      JOIN fornecedores f ON f.id_fornecedor = pf.id_fornecedor
      ${whereClause}
      GROUP BY f.id_fornecedor, f.razao_social
      ORDER BY itens_com_defeito DESC
    `;
    const resFornecedores = await AppDataSource.query(sqlFornecedores, params);
    const fornecedoresLabels = resFornecedores.map((r: any) => r.fornecedor_nome);
    const fornecedoresSeries = resFornecedores.map((r: any) => Number(r.itens_com_defeito) || 0);

    // Gráfico 6: Devoluções por Status e Tempo Médio de Resolução
    const sqlStatus = `
      SELECT 
        d.status,
        COUNT(DISTINCT d.id_devolucao) AS total,
        AVG(CASE WHEN d.data_conclusao IS NOT NULL THEN DATEDIFF(d.data_conclusao, d.data_abertura) ELSE DATEDIFF(?, d.data_abertura) END) AS dias_medio
      FROM devolucoes d
      GROUP BY d.status
    `;
    const resStatus = await AppDataSource.query(sqlStatus, [new Date()]);
    const statusLabels: string[] = ['ABERTA', 'EM_ANALISE', 'CONCLUIDA', 'RECUSADA'];
    const statusLabelsExibicao: string[] = ['Aberta', 'Em Análise', 'Concluída', 'Recusada'];
    const statusCounts: number[] = [];
    const statusDiasMedio: number[] = [];

    for (const st of statusLabels) {
      const found = resStatus.find((r: any) => r.status === st);
      statusCounts.push(found ? Number(found.total) : 0);
      statusDiasMedio.push(found ? Number(Number(found.dias_medio || 0).toFixed(1)) : 0);
    }

    // ── 7. ALERTAS OPERACIONAIS ──────────────────────────────────────────────
    const alertas: AlertaAtencaoDevolucoes[] = [];

    // Alerta 1: Taxa de Devolução Geral Crítica
    if (taxaDevolucaoQtdAtual > LIMITES_ALERTAS_QUALIDADE.TAXA_DEVOLUCAO_GERAL_MAXIMA_PCT) {
      alertas.push({
        id: 'alerta-taxa-geral',
        tipo: 'taxa_alta',
        severidade: 'critico',
        titulo: `Taxa de Devolução Global Crítica: ${taxaDevolucaoQtdAtual}%`,
        mensagem: `A taxa geral de devoluções atingiu ${taxaDevolucaoQtdAtual}% das vendas no período, superando o teto tolerável de ${LIMITES_ALERTAS_QUALIDADE.TAXA_DEVOLUCAO_GERAL_MAXIMA_PCT}%. Avalie a qualidade da embalagem e processos de despacho.`,
        valorAtual: `${taxaDevolucaoQtdAtual}%`,
        limiteConfigurado: `${LIMITES_ALERTAS_QUALIDADE.TAXA_DEVOLUCAO_GERAL_MAXIMA_PCT}%`,
        acaoTexto: 'Ver Detalhes',
        acaoLink: '#tabela-devolucoes-recentes',
      });
    }

    // Alerta 2: Devoluções com SLA Estourado (Em aberto além do prazo limite)
    if (atrasadasCount > 0) {
      alertas.push({
        id: 'alerta-sla-atrasadas',
        tipo: 'sla_estourado',
        severidade: 'critico',
        titulo: `${atrasadasCount} devoluções pendentes além do prazo de ${LIMITES_ALERTAS_QUALIDADE.DIAS_SLA_RESOLUCAO_CRITICO} dias`,
        mensagem: `Existem ${atrasadasCount} processos de devolução/troca em aberto há mais tempo que o SLA estabelecido. Risco iminente de mediação desfavorável e penalidade no Mercado Livre.`,
        valorAtual: `${atrasadasCount} caso(s)`,
        limiteConfigurado: `${LIMITES_ALERTAS_QUALIDADE.DIAS_SLA_RESOLUCAO_CRITICO} dias`,
        acaoTexto: 'Filtrar Pendentes',
        acaoLink: '#tabela-devolucoes-recentes',
      });
    }

    // Alerta 3: Dominância de Motivo Específico (> 40%)
    if (paretoOcorrencias.length > 0 && totalOcorrenciasPareto > 0) {
      const topMotivoQtd = paretoOcorrencias[0];
      const topMotivoPct = Number(((topMotivoQtd / totalOcorrenciasPareto) * 100).toFixed(1));
      if (topMotivoPct >= LIMITES_ALERTAS_QUALIDADE.CONCENTRACAO_MOTIVO_MAXIMA_PCT) {
        alertas.push({
          id: 'alerta-dominancia-motivo',
          tipo: 'dominancia_motivo',
          severidade: 'atencao',
          titulo: `Alta concentração em "${paretoLabels[0]}": ${topMotivoPct}% dos chamados`,
          mensagem: `O motivo principal concentra ${topMotivoPct}% de todas as devoluções registradas no período (limite de atenção: ${LIMITES_ALERTAS_QUALIDADE.CONCENTRACAO_MOTIVO_MAXIMA_PCT}%). Requer plano de ação focado na causa raiz.`,
          valorAtual: `${topMotivoPct}%`,
          limiteConfigurado: `${LIMITES_ALERTAS_QUALIDADE.CONCENTRACAO_MOTIVO_MAXIMA_PCT}%`,
          acaoTexto: 'Ver Motivos',
          acaoLink: '#chart-devolucoes-pareto',
        });
      }
    }

    // Alerta 4: Produto com Taxa de Devolução Excessiva (> 8%)
    for (const p of topProdutos) {
      if (p.taxaDevolucaoPct >= LIMITES_ALERTAS_QUALIDADE.TAXA_DEVOLUCAO_PRODUTO_CRITICA_PCT && p.qtdVendida >= 2) {
        alertas.push({
          id: `alerta-prod-${p.idProduto}`,
          tipo: 'produto_critico',
          severidade: 'critico',
          titulo: `Produto com índice de devolução severo: ${p.nome} (${p.taxaDevolucaoPct}%)`,
          mensagem: `O item teve ${p.qtdDevolvida} devolução(ões) para ${p.qtdVendida} unidades vendidas (${p.taxaDevolucaoPct}% de taxa). Recomendada inspeção de lote e revisão do anúncio.`,
          valorAtual: `${p.taxaDevolucaoPct}%`,
          limiteConfigurado: `${LIMITES_ALERTAS_QUALIDADE.TAXA_DEVOLUCAO_PRODUTO_CRITICA_PCT}%`,
          acaoTexto: 'Inspecionar Produto',
          acaoLink: `produtos.html?busca=${encodeURIComponent(p.sku)}`,
        });
        break; // Alerta o primeiro mais crítico para evitar poluição visual
      }
    }

    return {
      sucesso: true,
      periodo: {
        inicio: isoInicio,
        fim: isoFim,
        dias,
      },
      kpis,
      alertas,
      graficos: {
        timeline: {
          categories: timelineCategories,
          devolucoes: timelineDevolucoes,
          itens: timelineItens,
        },
        pareto: {
          labels: paretoLabels,
          ocorrencias: paretoOcorrencias,
          acumuladoPct: paretoAcumulado,
        },
        topProdutos,
        categorias: {
          labels: categoriasLabels,
          series: categoriasSeries,
        },
        fornecedores: {
          labels: fornecedoresLabels,
          series: fornecedoresSeries,
        },
        status: {
          labels: statusLabelsExibicao,
          counts: statusCounts,
          diasMedio: statusDiasMedio,
        },
      },
    };
  }

  /**
   * Consulta paginada no servidor de devoluções com itens, motivos e tempos de SLA
   */
  async obterDevolucoesRecentes(params: {
    page?: number;
    limit?: number;
    motivo?: string;
    status?: string;
    categoryId?: string;
    supplierId?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(params.limit) || 10));
    const offset = (page - 1) * limit;

    let whereSql = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (params.motivo && params.motivo !== 'ALL' && params.motivo !== 'undefined') {
      whereSql += ' AND idv.motivo = ?';
      queryParams.push(params.motivo);
    }

    if (params.status && params.status !== 'ALL' && params.status !== 'undefined') {
      whereSql += ' AND d.status = ?';
      queryParams.push(params.status);
    }

    if (params.categoryId && params.categoryId !== 'ALL' && params.categoryId !== 'undefined') {
      whereSql += ' AND p.categoria = ?';
      queryParams.push(params.categoryId);
    }

    if (params.supplierId && String(params.supplierId) !== 'ALL' && String(params.supplierId) !== 'undefined') {
      whereSql += ' AND pf.id_fornecedor = ?';
      queryParams.push(Number(params.supplierId));
    }

    const countSql = `
      SELECT COUNT(DISTINCT d.id_devolucao) AS total
      FROM devolucoes d
      JOIN itens_devolucao idv ON idv.id_devolucao = d.id_devolucao
      JOIN produtos p ON p.id_produto = idv.id_produto
      LEFT JOIN produto_fornecedor pf ON pf.id_produto = p.id_produto AND pf.principal = 1
      ${whereSql}
    `;
    const [countRes] = await AppDataSource.query(countSql, queryParams);
    const total = Number(countRes?.total) || 0;

    const listSql = `
      SELECT 
        d.id_devolucao,
        d.codigo_devolucao,
        d.id_pedido,
        ped.codigo_pedido,
        d.id_cliente,
        c.nome AS cliente_nome,
        d.status,
        d.tipo_resolucao,
        d.custo_frete_reverso,
        d.valor_total_reembolso,
        d.data_abertura,
        d.data_conclusao,
        d.prazo_limite_dias,
        d.observacoes,
        CASE 
          WHEN d.data_conclusao IS NOT NULL THEN DATEDIFF(d.data_conclusao, d.data_abertura)
          ELSE DATEDIFF(NOW(), d.data_abertura)
        END AS dias_decorridos,
        p.id_produto,
        p.nome AS produto_nome,
        p.sku AS produto_sku,
        idv.quantidade,
        idv.motivo,
        idv.detalhe_motivo,
        idv.destino_item,
        idv.custo_perda_item,
        idv.subtotal AS item_subtotal,
        f.razao_social AS fornecedor_nome
      FROM devolucoes d
      JOIN pedidos ped ON ped.id_pedido = d.id_pedido
      LEFT JOIN clientes c ON c.id_cliente = d.id_cliente
      JOIN itens_devolucao idv ON idv.id_devolucao = d.id_devolucao
      JOIN produtos p ON p.id_produto = idv.id_produto
      LEFT JOIN produto_fornecedor pf ON pf.id_produto = p.id_produto AND pf.principal = 1
      LEFT JOIN fornecedores f ON f.id_fornecedor = pf.id_fornecedor
      ${whereSql}
      ORDER BY d.data_abertura DESC
      LIMIT ? OFFSET ?
    `;

    const listParams = [...queryParams, limit, offset];
    const rows = await AppDataSource.query(listSql, listParams);

    const itens = rows.map((r: any) => {
      const dias = Number(r.dias_decorridos) || 0;
      const prazo = Number(r.prazo_limite_dias) || 7;
      const emAtraso = (r.status === 'ABERTA' || r.status === 'EM_ANALISE') && dias > prazo;

      return {
        idDevolucao: r.id_devolucao,
        codigoDevolucao: r.codigo_devolucao,
        idPedido: r.id_pedido,
        codigoPedido: r.codigo_pedido,
        idCliente: r.id_cliente,
        clienteNome: r.cliente_nome || 'Cliente Balcão / Não Identificado',
        status: r.status,
        tipoResolucao: r.tipo_resolucao,
        custoFreteReverso: Number(r.custo_frete_reverso) || 0,
        valorTotalReembolso: Number(r.valor_total_reembolso) || 0,
        custoTotalCaso: (Number(r.valor_total_reembolso) || 0) + (Number(r.custo_frete_reverso) || 0) + (Number(r.custo_perda_item) || 0),
        dataAbertura: r.data_abertura,
        dataConclusao: r.data_conclusao,
        prazoLimiteDias: prazo,
        diasDecorridos: dias,
        emAtraso,
        observacoes: r.observacoes,
        produto: {
          id: r.id_produto,
          nome: r.produto_nome,
          sku: r.produto_sku,
          quantidade: Number(r.quantidade) || 1,
          motivo: r.motivo,
          detalheMotivo: r.detalhe_motivo,
          destinoItem: r.destino_item,
          custoPerdaItem: Number(r.custo_perda_item) || 0,
          fornecedorNome: r.fornecedor_nome || '—',
        },
      };
    });

    return {
      sucesso: true,
      paginacao: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      dados: itens,
    };
  }
}
