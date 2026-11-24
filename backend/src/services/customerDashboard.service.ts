import { AppDataSource } from '../config/database';
import { CustomerSource } from '../entities/Customer';

export const LIMITES_ALERTAS_CLIENTES = {
  QUEDA_NOVOS_CLIENTES_PERCENTUAL: -20, // Queda de novos clientes pior ou igual a -20%
  TAXA_RECORRENCIA_MINIMA_PERCENTUAL: 25, // Recorrência menor que 25%
  DEPENDENCIA_CANAL_MAXIMA_PERCENTUAL: 75, // Concentração de mais de 75% da receita em um canal
  TAXA_INATIVIDADE_MAXIMA_PERCENTUAL: 30, // Mais de 30% da base sem compras
  DIAS_INATIVIDADE_PADRAO: 90, // Inatividade padrão em 90 dias
  VALOR_CLIENTE_ALTO_RISCO: 1500, // Faturamento acumulado mínimo para alertar risco de perda
  DIAS_RISCO_CLIENTE_VIP: 60, // Dias sem comprar para considerar cliente VIP em risco
};

export interface FiltrosDashboardClientes {
  from?: string | Date;
  to?: string | Date;
  dias?: number;
  source?: CustomerSource | 'ALL';
  diasInativo?: number;
}

export interface KpiItem {
  valor: number;
  valorFormatado?: string;
  deltaPercentual: number;
  deltaSentidoBom: boolean; // se delta positivo é bom (true) ou ruim (false, como inatividade)
  tooltip: string;
}

export interface AlertaAtencaoCliente {
  id: string;
  tipo: 'queda_novos' | 'baixa_recorrencia' | 'dependencia_canal' | 'alto_inativos' | 'cliente_risco';
  severidade: 'critico' | 'atencao';
  titulo: string;
  mensagem: string;
  valorAtual: string | number;
  limiteConfigurado: string | number;
  acaoTexto?: string;
  acaoLink?: string;
}

export class CustomerDashboardService {
  /**
   * Calcula todos os KPIs, dados para gráficos e alertas de clientes no banco MySQL
   */
  async obterMetricasClientes(filtros: FiltrosDashboardClientes) {
    const agora = new Date();
    const dias = filtros.dias ? Math.max(1, Number(filtros.dias)) : 30;
    const diasInativo = filtros.diasInativo ? Number(filtros.diasInativo) : LIMITES_ALERTAS_CLIENTES.DIAS_INATIVIDADE_PADRAO;

    let dataFim = filtros.to ? new Date(filtros.to) : agora;
    let dataInicio: Date;

    if (filtros.from) {
      dataInicio = new Date(filtros.from);
    } else {
      dataInicio = new Date(dataFim.getTime() - dias * 24 * 60 * 60 * 1000);
    }

    const duracaoMs = dataFim.getTime() - dataInicio.getTime();
    const dataInicioAnterior = new Date(dataInicio.getTime() - duracaoMs);
    const dataFimAnterior = new Date(dataInicio.getTime());

    const sourceFiltro = filtros.source && filtros.source !== 'ALL' ? filtros.source : null;

    // ── 1. KPI: Total de Clientes na Base (Atual vs Período Anterior) ────────
    let sqlTotalBaseAtual = `SELECT COUNT(*) AS total FROM clientes WHERE created_at <= ?`;
    let sqlTotalBaseAnt = `SELECT COUNT(*) AS total FROM clientes WHERE created_at <= ?`;
    const paramsBaseAtual: any[] = [dataFim];
    const paramsBaseAnt: any[] = [dataFimAnterior];

    if (sourceFiltro) {
      sqlTotalBaseAtual += ` AND origem = ?`;
      sqlTotalBaseAnt += ` AND origem = ?`;
      paramsBaseAtual.push(sourceFiltro);
      paramsBaseAnt.push(sourceFiltro);
    }

    const resTotalAtual = await AppDataSource.query(sqlTotalBaseAtual, paramsBaseAtual);
    const resTotalAnt = await AppDataSource.query(sqlTotalBaseAnt, paramsBaseAnt);

    const totalClientesBase = Number(resTotalAtual[0]?.total || 0);
    const totalClientesBaseAnt = Number(resTotalAnt[0]?.total || 0);
    const deltaTotalBase = this.calcularDelta(totalClientesBase, totalClientesBaseAnt);

    // ── 2. KPI: Novos Clientes no Período ─────────────────────────────────────
    let sqlNovosAtual = `SELECT COUNT(*) AS total FROM clientes WHERE created_at BETWEEN ? AND ?`;
    let sqlNovosAnt = `SELECT COUNT(*) AS total FROM clientes WHERE created_at BETWEEN ? AND ?`;
    const paramsNovosAtual: any[] = [dataInicio, dataFim];
    const paramsNovosAnt: any[] = [dataInicioAnterior, dataFimAnterior];

    if (sourceFiltro) {
      sqlNovosAtual += ` AND origem = ?`;
      sqlNovosAnt += ` AND origem = ?`;
      paramsNovosAtual.push(sourceFiltro);
      paramsNovosAnt.push(sourceFiltro);
    }

    const resNovosAtual = await AppDataSource.query(sqlNovosAtual, paramsNovosAtual);
    const resNovosAnt = await AppDataSource.query(sqlNovosAnt, paramsNovosAnt);

    const novosClientes = Number(resNovosAtual[0]?.total || 0);
    const novosClientesAnt = Number(resNovosAnt[0]?.total || 0);
    const deltaNovos = this.calcularDelta(novosClientes, novosClientesAnt);

    // ── 3. KPI: Clientes Ativos (com pelo menos 1 pedido no período) ──────────
    let sqlAtivosAtual = `
      SELECT COUNT(DISTINCT p.id_cliente) AS total_ativos,
             COALESCE(SUM(p.valor_total), 0) AS faturamento_periodo,
             COUNT(p.id_pedido) AS total_pedidos_periodo
      FROM pedidos p
      WHERE p.id_cliente IS NOT NULL 
        AND p.data_pedido BETWEEN ? AND ?
    `;
    let sqlAtivosAnt = `
      SELECT COUNT(DISTINCT p.id_cliente) AS total_ativos,
             COALESCE(SUM(p.valor_total), 0) AS faturamento_periodo
      FROM pedidos p
      WHERE p.id_cliente IS NOT NULL 
        AND p.data_pedido BETWEEN ? AND ?
    `;
    const paramsAtivosAtual: any[] = [dataInicio, dataFim];
    const paramsAtivosAnt: any[] = [dataInicioAnterior, dataFimAnterior];

    if (sourceFiltro) {
      const origPedido = sourceFiltro === 'MERCADO_LIVRE' ? 'Mercado Livre' : 'Venda Direta';
      sqlAtivosAtual += ` AND p.origem = ?`;
      sqlAtivosAnt += ` AND p.origem = ?`;
      paramsAtivosAtual.push(origPedido);
      paramsAtivosAnt.push(origPedido);
    }

    const resAtivosAtual = await AppDataSource.query(sqlAtivosAtual, paramsAtivosAtual);
    const resAtivosAnt = await AppDataSource.query(sqlAtivosAnt, paramsAtivosAnt);

    const clientesAtivos = Number(resAtivosAtual[0]?.total_ativos || 0);
    const clientesAtivosAnt = Number(resAtivosAnt[0]?.total_ativos || 0);
    const deltaAtivos = this.calcularDelta(clientesAtivos, clientesAtivosAnt);

    const receitaTotal = Number(resAtivosAtual[0]?.faturamento_periodo || 0);
    const receitaTotalAnt = Number(resAtivosAnt[0]?.faturamento_periodo || 0);

    // ── 4. KPI: Taxa de Recorrência (% clientes com 2+ pedidos na base) ──────
    let sqlRecorrencia = `
      SELECT 
        COUNT(CASE WHEN qtd_pedidos >= 2 THEN 1 END) AS clientes_recorrentes,
        COUNT(*) AS clientes_com_compras
      FROM (
        SELECT id_cliente, COUNT(id_pedido) AS qtd_pedidos
        FROM pedidos
        WHERE id_cliente IS NOT NULL AND data_pedido <= ?
        GROUP BY id_cliente
      ) t
    `;
    const resRecorrenciaAtual = await AppDataSource.query(sqlRecorrencia, [dataFim]);
    const resRecorrenciaAnt = await AppDataSource.query(sqlRecorrencia, [dataFimAnterior]);

    const recorrentesAtual = Number(resRecorrenciaAtual[0]?.clientes_recorrentes || 0);
    const comComprasAtual = Number(resRecorrenciaAtual[0]?.clientes_com_compras || 0);
    const taxaRecorrencia = comComprasAtual > 0 ? Number(((recorrentesAtual / comComprasAtual) * 100).toFixed(1)) : 0;

    const recorrentesAnt = Number(resRecorrenciaAnt[0]?.clientes_recorrentes || 0);
    const comComprasAnt = Number(resRecorrenciaAnt[0]?.clientes_com_compras || 0);
    const taxaRecorrenciaAnt = comComprasAnt > 0 ? Number(((recorrentesAnt / comComprasAnt) * 100).toFixed(1)) : 0;
    const deltaRecorrencia = Number((taxaRecorrencia - taxaRecorrenciaAnt).toFixed(1));

    // ── 5. KPI: Ticket Médio por Cliente ──────────────────────────────────────
    const ticketMedio = clientesAtivos > 0 ? Number((receitaTotal / clientesAtivos).toFixed(2)) : 0;
    const ticketMedioAnt = clientesAtivosAnt > 0 ? Number((receitaTotalAnt / clientesAtivosAnt).toFixed(2)) : 0;
    const deltaTicketMedio = this.calcularDelta(ticketMedio, ticketMedioAnt);

    // ── 6. KPI: Receita por Origem (Presencial x Mercado Livre) ──────────────
    const sqlReceitaCanais = `
      SELECT 
        COALESCE(SUM(CASE WHEN p.origem = 'Mercado Livre' THEN p.valor_total ELSE 0 END), 0) AS receita_ml,
        COALESCE(SUM(CASE WHEN p.origem != 'Mercado Livre' THEN p.valor_total ELSE 0 END), 0) AS receita_presencial,
        COUNT(CASE WHEN p.origem = 'Mercado Livre' THEN 1 END) AS pedidos_ml,
        COUNT(CASE WHEN p.origem != 'Mercado Livre' THEN 1 END) AS pedidos_presencial
      FROM pedidos p
      WHERE p.data_pedido BETWEEN ? AND ?
    `;
    const resReceitaCanais = await AppDataSource.query(sqlReceitaCanais, [dataInicio, dataFim]);
    const receitaML = Number(resReceitaCanais[0]?.receita_ml || 0);
    const receitaPresencial = Number(resReceitaCanais[0]?.receita_presencial || 0);
    const totalCanais = receitaML + receitaPresencial;
    const shareML = totalCanais > 0 ? Number(((receitaML / totalCanais) * 100).toFixed(1)) : 0;
    const sharePresencial = totalCanais > 0 ? Number(((receitaPresencial / totalCanais) * 100).toFixed(1)) : 0;

    // ── 7. KPI: Clientes Inativos (sem pedidos há mais de X dias) ─────────────
    const dataCorteInatividade = new Date(dataFim.getTime() - diasInativo * 24 * 60 * 60 * 1000);
    const dataCorteInatividadeAnt = new Date(dataFimAnterior.getTime() - diasInativo * 24 * 60 * 60 * 1000);

    const sqlInativos = `
      SELECT COUNT(*) AS total_inativos
      FROM clientes c
      WHERE c.created_at <= ?
        AND c.id_cliente NOT IN (
          SELECT DISTINCT p.id_cliente 
          FROM pedidos p 
          WHERE p.id_cliente IS NOT NULL 
            AND p.data_pedido > ?
        )
    `;
    const resInativosAtual = await AppDataSource.query(sqlInativos, [dataFim, dataCorteInatividade]);
    const resInativosAnt = await AppDataSource.query(sqlInativos, [dataFimAnterior, dataCorteInatividadeAnt]);

    const clientesInativos = Number(resInativosAtual[0]?.total_inativos || 0);
    const clientesInativosAnt = Number(resInativosAnt[0]?.total_inativos || 0);
    const taxaInatividade = totalClientesBase > 0 ? Number(((clientesInativos / totalClientesBase) * 100).toFixed(1)) : 0;
    const deltaInativos = this.calcularDelta(clientesInativos, clientesInativosAnt);

    // ── 8. Gráfico 1: Novos clientes ao longo do tempo (por origem) ───────────
    const sqlTimeline = `
      SELECT 
        DATE(created_at) AS data_dia,
        COUNT(CASE WHEN origem = 'PRESENCIAL' THEN 1 END) AS qtd_presencial,
        COUNT(CASE WHEN origem = 'MERCADO_LIVRE' THEN 1 END) AS qtd_ml,
        COUNT(*) AS qtd_total
      FROM clientes
      WHERE created_at BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `;
    const resTimeline = await AppDataSource.query(sqlTimeline, [dataInicio, dataFim]);

    // ── 9. Gráfico 2 & 3: Novos vs Recorrentes e Distribuição por Origem ───────
    const sqlNovosVsRecorrentesPeriodo = `
      SELECT 
        COUNT(CASE WHEN t.data_primeiro_pedido BETWEEN ? AND ? THEN 1 END) AS compradores_novos,
        COUNT(CASE WHEN t.data_primeiro_pedido < ? THEN 1 END) AS compradores_recorrentes
      FROM (
        SELECT id_cliente, MIN(data_pedido) AS data_primeiro_pedido
        FROM pedidos
        WHERE id_cliente IS NOT NULL AND data_pedido BETWEEN ? AND ?
        GROUP BY id_cliente
      ) t
    `;
    const resNovosVsRec = await AppDataSource.query(sqlNovosVsRecorrentesPeriodo, [
      dataInicio, dataFim,
      dataInicio,
      dataInicio, dataFim,
    ]);
    const compradoresNovos = Number(resNovosVsRec[0]?.compradores_novos || 0);
    const compradoresRecorrentes = Number(resNovosVsRec[0]?.compradores_recorrentes || 0);

    // Distribuição de base por origem
    const sqlBaseOrigem = `
      SELECT origem, COUNT(*) AS total
      FROM clientes
      GROUP BY origem
    `;
    const resBaseOrigem = await AppDataSource.query(sqlBaseOrigem);
    let countPresencial = 0;
    let countML = 0;
    for (const r of resBaseOrigem) {
      if (r.origem === 'PRESENCIAL') countPresencial = Number(r.total);
      if (r.origem === 'MERCADO_LIVRE') countML = Number(r.total);
    }

    // ── 10. Top 10 Clientes por Receita ───────────────────────────────────────
    const sqlTopClientes = `
      SELECT 
        c.id_cliente AS id,
        c.nome,
        c.origem,
        COALESCE(c.cidade, '—') AS cidade,
        COALESCE(c.estado, '—') AS uf,
        COUNT(p.id_pedido) AS total_pedidos,
        COALESCE(SUM(p.valor_total), 0) AS receita_total,
        MAX(p.data_pedido) AS ultimo_pedido
      FROM clientes c
      JOIN pedidos p ON p.id_cliente = c.id_cliente
      WHERE p.data_pedido BETWEEN ? AND ?
      GROUP BY c.id_cliente, c.nome, c.origem, c.cidade, c.estado
      ORDER BY receita_total DESC
      LIMIT 10
    `;
    const resTopClientes = await AppDataSource.query(sqlTopClientes, [dataInicio, dataFim]);

    // ── 11. Distribuição Geográfica (Top Estados e Cidades) ───────────────────
    const sqlGeoUFs = `
      SELECT 
        COALESCE(c.estado, 'Outros') AS uf,
        COUNT(DISTINCT c.id_cliente) AS total_clientes,
        COALESCE(SUM(p.valor_total), 0) AS receita
      FROM clientes c
      LEFT JOIN pedidos p ON p.id_cliente = c.id_cliente AND p.data_pedido BETWEEN ? AND ?
      GROUP BY c.estado
      ORDER BY total_clientes DESC
      LIMIT 8
    `;
    const resGeoUFs = await AppDataSource.query(sqlGeoUFs, [dataInicio, dataFim]);

    const sqlGeoCidades = `
      SELECT 
        CONCAT(COALESCE(c.cidade, 'Não informado'), ' / ', COALESCE(c.estado, '—')) AS cidade_uf,
        COUNT(DISTINCT c.id_cliente) AS total_clientes,
        COALESCE(SUM(p.valor_total), 0) AS receita
      FROM clientes c
      LEFT JOIN pedidos p ON p.id_cliente = c.id_cliente AND p.data_pedido BETWEEN ? AND ?
      WHERE c.cidade IS NOT NULL
      GROUP BY c.cidade, c.estado
      ORDER BY total_clientes DESC
      LIMIT 6
    `;
    const resGeoCidades = await AppDataSource.query(sqlGeoCidades, [dataInicio, dataFim]);

    // ── 12. Alertas de Atenção (Pontos de Atenção Automatizados) ───────────────
    const alertas: AlertaAtencaoCliente[] = [];

    // Alerta 1: Queda no volume de novos clientes
    if (deltaNovos <= LIMITES_ALERTAS_CLIENTES.QUEDA_NOVOS_CLIENTES_PERCENTUAL) {
      alertas.push({
        id: 'alerta-queda-novos',
        tipo: 'queda_novos',
        severidade: deltaNovos <= -40 ? 'critico' : 'atencao',
        titulo: `Queda de ${Math.abs(deltaNovos)}% na captação de novos clientes`,
        mensagem: `Foram captados apenas ${novosClientes} cliente(s) no período selecionado, contra ${novosClientesAnt} no período anterior. Avalie ações de marketing ou expansão de catálogo.`,
        valorAtual: `${deltaNovos}%`,
        limiteConfigurado: `${LIMITES_ALERTAS_CLIENTES.QUEDA_NOVOS_CLIENTES_PERCENTUAL}%`,
        acaoTexto: 'Ver Clientes Recentes',
        acaoLink: 'clientes.html',
      });
    }

    // Alerta 2: Baixa taxa de recorrência
    if (taxaRecorrencia < LIMITES_ALERTAS_CLIENTES.TAXA_RECORRENCIA_MINIMA_PERCENTUAL && comComprasAtual >= 2) {
      alertas.push({
        id: 'alerta-baixa-recorrencia',
        tipo: 'baixa_recorrencia',
        severidade: taxaRecorrencia < 15 ? 'critico' : 'atencao',
        titulo: `Taxa de recompra em ${taxaRecorrencia}% (Abaixo da meta de ${LIMITES_ALERTAS_CLIENTES.TAXA_RECORRENCIA_MINIMA_PERCENTUAL}%)`,
        mensagem: `Apenas ${recorrentesAtual} de ${comComprasAtual} clientes com compras voltaram a comprar. O negócio de extintores depende da recarga periódica de 1 ano.`,
        valorAtual: `${taxaRecorrencia}%`,
        limiteConfigurado: `${LIMITES_ALERTAS_CLIENTES.TAXA_RECORRENCIA_MINIMA_PERCENTUAL}%`,
        acaoTexto: 'Acompanhar Validades FEFO',
        acaoLink: 'alertas.html',
      });
    }

    // Alerta 3: Dependência excessiva de um canal
    if (shareML >= LIMITES_ALERTAS_CLIENTES.DEPENDENCIA_CANAL_MAXIMA_PERCENTUAL) {
      alertas.push({
        id: 'alerta-dependencia-ml',
        tipo: 'dependencia_canal',
        severidade: 'atencao',
        titulo: `Alta dependência do Mercado Livre (${shareML}% do faturamento)`,
        mensagem: `Mais de ${LIMITES_ALERTAS_CLIENTES.DEPENDENCIA_CANAL_MAXIMA_PERCENTUAL}% da receita provém do marketplace. Risco operacional elevado caso ocorram pausas de reputação ou variações nas tarifas da plataforma.`,
        valorAtual: `${shareML}%`,
        limiteConfigurado: `${LIMITES_ALERTAS_CLIENTES.DEPENDENCIA_CANAL_MAXIMA_PERCENTUAL}%`,
        acaoTexto: 'Expandir Venda Presencial',
        acaoLink: 'clientes.html?source=PRESENCIAL',
      });
    } else if (sharePresencial >= LIMITES_ALERTAS_CLIENTES.DEPENDENCIA_CANAL_MAXIMA_PERCENTUAL && totalCanais > 0) {
      alertas.push({
        id: 'alerta-dependencia-balcao',
        tipo: 'dependencia_canal',
        severidade: 'atencao',
        titulo: `Alta dependência do balcão presencial (${sharePresencial}% do faturamento)`,
        mensagem: `As vendas físicas locais concentram a maioria da receita. Acelere a sincronização e os anúncios no Mercado Livre para diversificar o alcance geográfico.`,
        valorAtual: `${sharePresencial}%`,
        limiteConfigurado: `${LIMITES_ALERTAS_CLIENTES.DEPENDENCIA_CANAL_MAXIMA_PERCENTUAL}%`,
        acaoTexto: 'Ver Anúncios ML',
        acaoLink: 'anuncios.html',
      });
    }

    // Alerta 4: Alto percentual de clientes inativos
    if (taxaInatividade >= LIMITES_ALERTAS_CLIENTES.TAXA_INATIVIDADE_MAXIMA_PERCENTUAL && totalClientesBase >= 3) {
      alertas.push({
        id: 'alerta-inativos',
        tipo: 'alto_inativos',
        severidade: taxaInatividade >= 50 ? 'critico' : 'atencao',
        titulo: `${taxaInatividade}% da base está inativa há mais de ${diasInativo} dias`,
        mensagem: `${clientesInativos} cliente(s) não realizam nenhum pedido há mais de 3 meses. Recomendado disparo de contato ativo para inspeção e recarga anual de cilindros.`,
        valorAtual: `${taxaInatividade}%`,
        limiteConfigurado: `${LIMITES_ALERTAS_CLIENTES.TAXA_INATIVIDADE_MAXIMA_PERCENTUAL}%`,
        acaoTexto: 'Filtrar Clientes Inativos',
        acaoLink: 'clientes.html?filtro=inativos',
      });
    }

    // Alerta 5: Clientes VIP (alto valor) sem compras há mais de 60 dias (Risco de churn)
    const sqlClientesVipRisco = `
      SELECT 
        c.id_cliente,
        c.nome,
        c.telefone,
        SUM(p.valor_total) AS total_historico,
        MAX(p.data_pedido) AS data_ultimo_pedido,
        DATEDIFF(NOW(), MAX(p.data_pedido)) AS dias_sem_comprar
      FROM clientes c
      JOIN pedidos p ON p.id_cliente = c.id_cliente
      GROUP BY c.id_cliente, c.nome, c.telefone
      HAVING total_historico >= ? AND dias_sem_comprar >= ?
      ORDER BY total_historico DESC
      LIMIT 3
    `;
    const resVipsRisco = await AppDataSource.query(sqlClientesVipRisco, [
      LIMITES_ALERTAS_CLIENTES.VALOR_CLIENTE_ALTO_RISCO,
      LIMITES_ALERTAS_CLIENTES.DIAS_RISCO_CLIENTE_VIP,
    ]);

    if (resVipsRisco.length > 0) {
      const vip = resVipsRisco[0];
      alertas.push({
        id: 'alerta-cliente-vip-risco',
        tipo: 'cliente_risco',
        severidade: 'critico',
        titulo: `Risco de perda: Cliente corporativo de alto valor inativo`,
        mensagem: `"${vip.nome}" comprou R$ ${Number(vip.total_historico).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no histórico e está há ${vip.dias_sem_comprar} dias sem realizar pedidos. Contato: ${vip.telefone || 'sem telefone'}.`,
        valorAtual: `${vip.dias_sem_comprar} dias`,
        limiteConfigurado: `${LIMITES_ALERTAS_CLIENTES.DIAS_RISCO_CLIENTE_VIP} dias`,
        acaoTexto: 'Abrir Cadastro do Cliente',
        acaoLink: `clientes.html?busca=${encodeURIComponent(vip.nome)}`,
      });
    }

    return {
      sucesso: true,
      periodo: {
        de: dataInicio.toISOString().split('T')[0],
        ate: dataFim.toISOString().split('T')[0],
        dias,
        origem: sourceFiltro || 'ALL',
      },
      kpis: {
        totalClientesBase: {
          valor: totalClientesBase,
          deltaPercentual: deltaTotalBase,
          deltaSentidoBom: deltaTotalBase >= 0,
          tooltip: 'Total de clientes cadastrados no sistema até a data final do período.',
        },
        novosClientes: {
          valor: novosClientes,
          deltaPercentual: deltaNovos,
          deltaSentidoBom: deltaNovos >= 0,
          tooltip: 'Clientes com data de cadastro compreendida dentro do período selecionado.',
        },
        clientesAtivos: {
          valor: clientesAtivos,
          deltaPercentual: deltaAtivos,
          deltaSentidoBom: deltaAtivos >= 0,
          tooltip: 'Clientes únicos que efetuaram ao menos 1 pedido no período selecionado.',
        },
        taxaRecorrencia: {
          valor: taxaRecorrencia,
          deltaPercentual: deltaRecorrencia,
          deltaSentidoBom: deltaRecorrencia >= 0,
          tooltip: 'Percentual de clientes com 2 ou mais compras em relação ao total com histórico de pedidos.',
        },
        ticketMedioCliente: {
          valor: ticketMedio,
          deltaPercentual: deltaTicketMedio,
          deltaSentidoBom: deltaTicketMedio >= 0,
          tooltip: 'Receita total no período dividida pela quantidade de clientes compradores ativos.',
        },
        receitaPorOrigem: {
          valorTotal: receitaTotal,
          presencial: receitaPresencial,
          mercadoLivre: receitaML,
          sharePresencial,
          shareMercadoLivre: shareML,
          tooltip: 'Divisão do faturamento bruto gerado por venda balcão versus Mercado Livre.',
        },
        clientesInativos: {
          valor: clientesInativos,
          taxaPercentual: taxaInatividade,
          deltaPercentual: deltaInativos,
          deltaSentidoBom: deltaInativos <= 0, // menos inativos é melhor!
          diasConfigurados: diasInativo,
          tooltip: `Clientes da base sem nenhuma compra realizada há mais de ${diasInativo} dias consecutivos.`,
        },
      },
      graficos: {
        timeline: {
          categories: resTimeline.map((r: any) => {
            const d = r.data_dia instanceof Date ? r.data_dia : new Date(r.data_dia);
            if (!isNaN(d.getTime())) {
              const dia = String(d.getUTCDate()).padStart(2, '0');
              const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
              return `${dia}/${mes}`;
            }
            return String(r.data_dia);
          }),
          presencial: resTimeline.map((r: any) => Number(r.qtd_presencial || 0)),
          mercadoLivre: resTimeline.map((r: any) => Number(r.qtd_ml || 0)),
          total: resTimeline.map((r: any) => Number(r.qtd_total || 0)),
        },
        distribuicaoOrigem: {
          labels: ['Presencial (Balcão)', 'Mercado Livre'],
          clientesSeries: [countPresencial, countML],
          receitaSeries: [receitaPresencial, receitaML],
        },
        novosVsRecorrentes: {
          labels: ['Novos Clientes', 'Recorrentes (Recompra)'],
          series: [compradoresNovos, compradoresRecorrentes],
        },
        topClientesReceita: resTopClientes.map((c: any) => ({
          id: Number(c.id),
          nome: String(c.nome),
          origem: String(c.origem),
          cidade: String(c.cidade),
          uf: String(c.uf),
          totalPedidos: Number(c.total_pedidos || 0),
          receitaTotal: Number(c.receita_total || 0),
          ultimoPedido: c.ultimo_pedido ? new Date(c.ultimo_pedido).toISOString() : null,
        })),
        distribuicaoGeografica: {
          ufs: resGeoUFs.map((u: any) => ({
            uf: String(u.uf),
            totalClientes: Number(u.total_clientes || 0),
            receita: Number(u.receita || 0),
          })),
          cidades: resGeoCidades.map((c: any) => ({
            cidadeUf: String(c.cidade_uf),
            totalClientes: Number(c.total_clientes || 0),
            receita: Number(c.receita || 0),
          })),
        },
      },
      alertas,
    };
  }

  private calcularDelta(atual: number, anterior: number): number {
    if (anterior === 0) {
      return atual > 0 ? 100 : 0;
    }
    return Number((((atual - anterior) / anterior) * 100).toFixed(1));
  }
}
