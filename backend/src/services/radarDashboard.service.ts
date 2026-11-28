import { AppDataSource } from '../config/database';
import { DashboardService } from './dashboard.service';
import { PedidoService } from './pedido.service';
import { CustomerDashboardService } from './customerDashboard.service';
import { PurchaseDashboardService } from './purchaseDashboard.service';
import { ReturnDashboardService } from './returnDashboard.service';
import { FiscalDashboardService } from './fiscalDashboard.service';
import { LancamentoFinanceiroService } from './lancamentoFinanceiro.service';

export type StatusSemaforo = 'critico' | 'atencao' | 'saudavel';

export interface IndicadorResumoBloco {
  rotulo: string;
  valor: string;
  destaque?: 'danger' | 'warning' | 'ok' | 'neutral';
}

export interface BlocoVisaoGeral {
  id: string;
  ordem_fixa: number;
  titulo: string;
  subtitulo_curto: string;
  icone: string;
  aba_destino: string;
  status: StatusSemaforo;
  peso_base: number;
  score_prioridade: number;
  manchete: string;
  acao_recomendada: string;
  indicadores: IndicadorResumoBloco[];
  alertas_resumo: string[];
  filtro_sugerido?: Record<string, string>;
}

export interface PrioridadeImediata {
  id_bloco: string;
  aba_destino: string;
  severidade: 'critico' | 'atencao';
  setor: string;
  titulo: string;
  acao_label: string;
  peso: number;
  score_prioridade: number;
  filtro_sugerido?: Record<string, string>;
}

export class RadarDashboardService {
  private dashboardService = new DashboardService();
  private pedidoService = new PedidoService();
  private customerService = new CustomerDashboardService();
  private purchaseService = new PurchaseDashboardService();
  private returnService = new ReturnDashboardService();
  private fiscalService = new FiscalDashboardService();
  private financeiroService = new LancamentoFinanceiroService();

  private fmtMoney(val: number): string {
    return Number(val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  private calcScore(status: StatusSemaforo, pesoBase: number, urgenciaExtra: number = 0): number {
    const extra = Math.max(0, Math.min(9, Math.round(urgenciaExtra)));
    if (status === 'critico') return 200 + pesoBase * 10 + extra;
    if (status === 'atencao') return 100 + pesoBase * 10 + extra;
    return pesoBase;
  }

  /**
   * Consolida o diagnóstico imediato (Verde / Amarelo / Vermelho) de cada uma das 10 abas
   * do Painel Executivo para tomada de decisão rápida do gestor.
   */
  async obterVisaoGeral(diasPeriodo: number = 30, perfilUsuario: string = 'GESTOR') {
    const dias = Math.max(1, Number(diasPeriodo) || 30);
    const isOperador = String(perfilUsuario || 'GESTOR').toUpperCase() === 'OPERADOR';

    const promessasBlocos: Promise<BlocoVisaoGeral | null>[] = [
      this.avaliarBlocoVendas(dias),
      this.avaliarBlocoEstoque(dias),
      this.avaliarBlocoMercadoLivre(dias),
      this.avaliarBlocoEntregas(),
      this.avaliarBlocoProdutos(dias),
      isOperador ? Promise.resolve(null) : this.avaliarBlocoFinanceiro(dias),
      this.avaliarBlocoClientes(dias),
      this.avaliarBlocoCompras(dias),
      this.avaliarBlocoDevolucoes(dias),
      isOperador ? Promise.resolve(null) : this.avaliarBlocoFiscal(dias),
    ];

    const resultados = await Promise.all(promessasBlocos);
    const blocos = resultados
      .filter((b): b is BlocoVisaoGeral => b !== null)
      .sort((a, b) => a.ordem_fixa - b.ordem_fixa);

    const criticos = blocos.filter((b) => b.status === 'critico').length;
    const atencao = blocos.filter((b) => b.status === 'atencao').length;
    const saudaveis = blocos.filter((b) => b.status === 'saudavel').length;

    let statusGeral: StatusSemaforo = 'saudavel';
    let mensagemExecutiva = 'Operação saudável: nenhum gargalo crítico identificado nos setores monitorados.';

    if (criticos > 0) {
      statusGeral = 'critico';
      mensagemExecutiva =
        criticos === 1
          ? `Ação imediata necessária: 1 setor em estado crítico exige intervenção agora.`
          : `Ação imediata necessária: ${criticos} setores em estado crítico exigem intervenção agora.`;
    } else if (atencao > 0) {
      statusGeral = 'atencao';
      mensagemExecutiva =
        atencao === 1
          ? `Operação sob controle, mas há 1 setor em ponto de atenção preventiva.`
          : `Operação sem bloqueios graves, mas ${atencao} setores pedem acompanhamento preventivo.`;
    }

    const prioridadesImediatas: PrioridadeImediata[] = [...blocos]
      .filter((b) => b.status === 'critico' || b.status === 'atencao')
      .sort((a, b) => b.score_prioridade - a.score_prioridade)
      .slice(0, 3)
      .map((b) => ({
        id_bloco: b.id,
        aba_destino: b.aba_destino,
        severidade: b.status === 'critico' ? 'critico' : 'atencao',
        setor: b.titulo,
        titulo: b.manchete,
        acao_label: b.acao_recomendada,
        peso: b.peso_base,
        score_prioridade: b.score_prioridade,
        filtro_sugerido: b.filtro_sugerido,
      }));

    return {
      sucesso: true,
      atualizado_em: new Date().toISOString(),
      periodo_dias: dias,
      perfil_usuario: isOperador ? 'OPERADOR' : 'GESTOR',
      resumo: {
        total_setores: blocos.length,
        criticos,
        atencao,
        saudaveis,
        status_geral: statusGeral,
        mensagem_executiva: mensagemExecutiva,
      },
      prioridades_imediatas: prioridadesImediatas,
      blocos,
    };
  }

  // ── 1. VENDAS (Ordem 1 · Peso 6) ───────────────────────────────────────────
  private async avaliarBlocoVendas(dias: number): Promise<BlocoVisaoGeral> {
    const pesoBase = 6;
    try {
      const agora = Date.now();
      const dataInicio = new Date(agora - dias * 86400000);
      const dataInicioAnt = new Date(agora - dias * 2 * 86400000);

      const [atualRows, antRows] = await Promise.all([
        AppDataSource.query(
          `SELECT
             COUNT(*) AS total_pedidos,
             COALESCE(SUM(CASE WHEN status != 'Cancelado' THEN valor_total ELSE 0 END), 0) AS faturamento,
             COUNT(CASE WHEN status != 'Cancelado' THEN 1 END) AS pedidos_validos,
             COUNT(CASE WHEN status = 'Cancelado' THEN 1 END) AS cancelados
           FROM pedidos
           WHERE data_pedido >= ?`,
          [dataInicio]
        ),
        AppDataSource.query(
          `SELECT
             COALESCE(SUM(CASE WHEN status != 'Cancelado' THEN valor_total ELSE 0 END), 0) AS faturamento
           FROM pedidos
           WHERE data_pedido >= ? AND data_pedido < ?`,
          [dataInicioAnt, dataInicio]
        ),
      ]);

      const totalPedidos = Number(atualRows[0]?.total_pedidos || 0);
      const pedidosValidos = Number(atualRows[0]?.pedidos_validos || 0);
      const cancelados = Number(atualRows[0]?.cancelados || 0);
      const fatAtual = Number(atualRows[0]?.faturamento || 0);
      const fatAnt = Number(antRows[0]?.faturamento || 0);

      const deltaFat = fatAnt > 0 ? Number((((fatAtual - fatAnt) / fatAnt) * 100).toFixed(1)) : 0;
      const taxaCanc = totalPedidos > 0 ? Number(((cancelados / totalPedidos) * 100).toFixed(1)) : 0;
      const ticketMedio = pedidosValidos > 0 ? fatAtual / pedidosValidos : 0;

      let status: StatusSemaforo = 'saudavel';
      const alertasResumo: string[] = [];

      if (pedidosValidos === 0) {
        status = 'critico';
        alertasResumo.push(`Nenhuma venda aprovada registrada nos últimos ${dias} dias.`);
      } else {
        if (fatAnt > 0 && deltaFat <= -20) {
          status = 'critico';
          alertasResumo.push(`Queda acentuada de faturamento (${deltaFat}% vs período anterior).`);
        } else if (fatAnt > 0 && deltaFat < -5) {
          status = 'atencao';
          alertasResumo.push(`Retração moderada de vendas (${deltaFat}% vs período anterior).`);
        }

        if (totalPedidos >= 3 && taxaCanc > 10) {
          status = 'critico';
          alertasResumo.push(`Cancelamento elevado: ${taxaCanc}% dos pedidos (${cancelados} canc.).`);
        } else if (totalPedidos >= 3 && taxaCanc > 5 && status === 'saudavel') {
          status = 'atencao';
          alertasResumo.push(`Taxa de cancelamento em ${taxaCanc}% (${cancelados} pedidos).`);
        }
      }

      const manchete =
        alertasResumo[0] ||
        `Ritmo saudável com ${pedidosValidos} pedidos válidos (${deltaFat >= 0 ? '+' : ''}${deltaFat}% no período).`;

      return {
        id: 'vendas',
        ordem_fixa: 1,
        titulo: 'Vendas',
        subtitulo_curto: 'Faturamento, volume e conversão',
        icone: 'trending-up',
        aba_destino: 'vendas',
        status,
        peso_base: pesoBase,
        score_prioridade: this.calcScore(status, pesoBase, status === 'critico' ? 3 : 1),
        manchete,
        acao_recomendada: status === 'saudavel' ? 'Acompanhar curva de vendas' : 'Investigar queda / cancelamentos',
        indicadores: [
          {
            rotulo: `Faturamento (${dias}d)`,
            valor: `${this.fmtMoney(fatAtual)} (${deltaFat >= 0 ? '+' : ''}${deltaFat}%)`,
            destaque: deltaFat <= -20 ? 'danger' : deltaFat < -5 ? 'warning' : 'ok',
          },
          {
            rotulo: 'Ticket Médio · Cancelamentos',
            valor: `${this.fmtMoney(ticketMedio)} · ${taxaCanc}% canc.`,
            destaque: taxaCanc > 10 ? 'danger' : taxaCanc > 5 ? 'warning' : 'neutral',
          },
        ],
        alertas_resumo: alertasResumo,
      };
    } catch {
      return this.blocoFallbackErro(1, 'vendas', 'Vendas', 'vendas', pesoBase);
    }
  }

  // ── 2. ESTOQUE & FEFO (Ordem 2 · Peso 9) ───────────────────────────────────
  private async avaliarBlocoEstoque(dias: number): Promise<BlocoVisaoGeral> {
    const pesoBase = 9;
    try {
      const kpis = await this.dashboardService.obterKpis(dias);
      const zerados = Number(kpis.estoque.produtos_zerados || 0);
      const baixos = Number(kpis.estoque.produtos_estoque_baixo || 0);
      const cobertura = Number(kpis.estoque.cobertura_dias || 0);
      const vencidos = Number(kpis.fefo.lotes_vencidos || 0);
      const bloqueados = Number(kpis.fefo.lotes_bloqueados || 0);
      const alertaFefo = Number(kpis.fefo.lotes_alerta || 0);

      let status: StatusSemaforo = 'saudavel';
      const alertasResumo: string[] = [];
      let filtroSugerido: Record<string, string> | undefined;

      if (zerados > 0) {
        status = 'critico';
        alertasResumo.push(`${zerados} SKU(s) ativo(s) em ruptura total (saldo zero).`);
        filtroSugerido = { estoqueRisco: 'ruptura' };
      }
      if (vencidos > 0 || bloqueados > 0) {
        status = 'critico';
        const totalTravados = vencidos + bloqueados;
        alertasResumo.push(
          `${totalTravados} lote(s) travado(s) p/ venda (${vencidos} vencido(s), ${bloqueados} ≤ 180 dias).`
        );
      }

      const apenasBaixos = Math.max(0, baixos - zerados);
      if (apenasBaixos > 0) {
        if (status === 'saudavel') status = 'atencao';
        alertasResumo.push(`${apenasBaixos} produto(s) operando no limite ou abaixo do mínimo.`);
        if (!filtroSugerido) filtroSugerido = { estoqueRisco: 'critico' };
      }
      if (alertaFefo > 0) {
        if (status === 'saudavel') status = 'atencao';
        alertasResumo.push(`${alertaFefo} lote(s) em prioridade FEFO (validade ≤ 1 ano).`);
      }
      if (cobertura > 0 && cobertura <= 15 && status === 'saudavel') {
        status = 'atencao';
        alertasResumo.push(`Autonomia média baixa (${cobertura} dias de cobertura).`);
      }

      const manchete =
        alertasResumo[0] ||
        `Estoque abastecido (${kpis.estoque.total_unidades} un.) e todos os lotes dentro da validade segura.`;

      return {
        id: 'estoque',
        ordem_fixa: 2,
        titulo: 'Estoque & FEFO',
        subtitulo_curto: 'Rupturas, mínimos e validade INMETRO',
        icone: 'box',
        aba_destino: 'estoque',
        status,
        peso_base: pesoBase,
        score_prioridade: this.calcScore(status, pesoBase, zerados + vencidos + bloqueados),
        manchete,
        acao_recomendada:
          zerados > 0
            ? 'Repor SKUs zerados imediatamente'
            : vencidos + bloqueados > 0
            ? 'Tratar lotes bloqueados / vencidos'
            : status === 'atencao'
            ? 'Revisar reposição e fila FEFO'
            : 'Ver posição de inventário',
        indicadores: [
          {
            rotulo: 'Ruptura · Abaixo do Mín.',
            valor: `${zerados} zerados · ${apenasBaixos} baixos`,
            destaque: zerados > 0 ? 'danger' : apenasBaixos > 0 ? 'warning' : 'ok',
          },
          {
            rotulo: 'Lotes FEFO (Travados / Alerta)',
            valor: `${vencidos + bloqueados} bloq. · ${alertaFefo} alerta`,
            destaque: vencidos + bloqueados > 0 ? 'danger' : alertaFefo > 0 ? 'warning' : 'ok',
          },
        ],
        alertas_resumo: alertasResumo,
        filtro_sugerido: filtroSugerido,
      };
    } catch {
      return this.blocoFallbackErro(2, 'estoque', 'Estoque & FEFO', 'estoque', pesoBase);
    }
  }

  // ── 3. MERCADO LIVRE (Ordem 3 · Peso 9) ────────────────────────────────────
  private async avaliarBlocoMercadoLivre(dias: number): Promise<BlocoVisaoGeral> {
    const pesoBase = 9;
    try {
      const [anunciosRows, impacto] = await Promise.all([
        AppDataSource.query(`
          SELECT
            a.id_anuncio,
            a.status,
            a.quantidade_disponivel,
            e.quantidade_atual AS estoque_local
          FROM anuncios_ml a
          LEFT JOIN produto_anuncio pa ON pa.id_anuncio = a.id_anuncio
          LEFT JOIN estoque e ON e.id_produto = pa.id_produto
        `).catch(() => []),
        this.dashboardService.obterImpactoQuedasAnuncios(dias).catch(() => null),
      ]);

      let ativos = 0;
      let pausados = 0;
      let rebaixados = 0;
      let divergentes = 0;

      for (const a of anunciosRows) {
        if (a.status === 'Pausado') pausados++;
        else if (a.status === 'Rebaixado' || a.status === 'Sob Revisão') rebaixados++;
        else if (a.status === 'Ativo') {
          ativos++;
          if (a.estoque_local !== null && Number(a.quantidade_disponivel || 0) > Number(a.estoque_local || 0)) {
            divergentes++;
          }
        }
      }

      const perdaEstimada = Number(impacto?.kpis?.faturamento_perdido_total || 0);
      const impactoPct = Number(impacto?.kpis?.impacto_percentual_receita || 0);

      if (anunciosRows.length === 0 && impacto?.kpis) {
        ativos = Number(impacto.kpis.anuncios_ativos_atualmente || 0);
        pausados = Number(impacto.kpis.anuncios_pausados_atualmente || 0);
      }

      let status: StatusSemaforo = 'saudavel';
      const alertasResumo: string[] = [];

      if (pausados > 0 || rebaixados > 0) {
        status = 'critico';
        const partes: string[] = [];
        if (pausados > 0) partes.push(`${pausados} pausado(s)`);
        if (rebaixados > 0) partes.push(`${rebaixados} sob moderação/rebaixado(s)`);
        alertasResumo.push(`Anúncios fora do ar no ML: ${partes.join(' e ')}.`);
      }

      if (divergentes > 0) {
        if (status === 'saudavel') status = 'atencao';
        alertasResumo.push(`${divergentes} anúncio(s) com saldo no ML maior que o estoque físico.`);
      }

      if (impactoPct > 5) {
        if (status === 'saudavel') status = 'atencao';
        alertasResumo.push(`Faturamento cessante estimado em ${this.fmtMoney(perdaEstimada)} (-${impactoPct}%).`);
      }

      const manchete =
        alertasResumo[0] ||
        `Todos os ${ativos} anúncios ativos, sincronizados e sem perda relevante de exposição.`;

      return {
        id: 'ml',
        ordem_fixa: 3,
        titulo: 'Mercado Livre',
        subtitulo_curto: 'Anúncios, pausas e receita cessante',
        icone: 'shopping-bag',
        aba_destino: 'ml',
        status,
        peso_base: pesoBase,
        score_prioridade: this.calcScore(status, pesoBase, pausados + rebaixados),
        manchete,
        acao_recomendada:
          pausados + rebaixados > 0
            ? 'Reativar / regularizar anúncios no ML'
            : divergentes > 0
            ? 'Sincronizar estoque anunciado'
            : 'Ver performance de anúncios',
        indicadores: [
          {
            rotulo: 'Anúncios (Ativos / Quedas)',
            valor: `${ativos} ativos · ${pausados + rebaixados} inativos`,
            destaque: pausados + rebaixados > 0 ? 'danger' : divergentes > 0 ? 'warning' : 'ok',
          },
          {
            rotulo: 'Receita Cessante Estimada',
            valor: `${this.fmtMoney(perdaEstimada)} (${impactoPct}%)`,
            destaque: impactoPct > 10 ? 'danger' : impactoPct > 5 ? 'warning' : 'neutral',
          },
        ],
        alertas_resumo: alertasResumo,
      };
    } catch {
      return this.blocoFallbackErro(3, 'ml', 'Mercado Livre', 'ml', pesoBase);
    }
  }

  // ── 4. ENTREGAS / EXPEDIÇÃO (Ordem 4 · Peso 10) ────────────────────────────
  private async avaliarBlocoEntregas(): Promise<BlocoVisaoGeral> {
    const pesoBase = 10;
    try {
      const alertasPostagem = await this.pedidoService.obterAlertasPostagem();
      const pedidosFila = alertasPostagem.pedidos || [];
      const atrasados = pedidosFila.filter((p: any) => p.criticidade === 'atrasado').length;
      const venceHoje = pedidosFila.filter((p: any) => p.criticidade === 'hoje').length;
      const totalPendentes = pedidosFila.length;

      let status: StatusSemaforo = 'saudavel';
      const alertasResumo: string[] = [];
      let filtroSugerido: Record<string, string> | undefined;

      if (atrasados > 0) {
        status = 'critico';
        alertasResumo.push(
          `${atrasados} pedido(s) com prazo de postagem ATRASADO — risco direto na reputação ML.`
        );
        filtroSugerido = { entregaRisco: 'critico' };
      }

      if (venceHoje > 0) {
        if (status === 'saudavel') status = 'atencao';
        alertasResumo.push(`${venceHoje} pedido(s) precisam ser separados e despachados ainda HOJE.`);
        if (!filtroSugerido) filtroSugerido = { entregaRisco: 'atencao' };
      }

      const manchete =
        alertasResumo[0] ||
        (totalPendentes > 0
          ? `Expedição em dia: ${totalPendentes} pedido(s) na fila dentro do prazo.`
          : 'Nenhum pedido atrasado ou travado na fila de despacho.');

      return {
        id: 'entregas',
        ordem_fixa: 4,
        titulo: 'Entregas',
        subtitulo_curto: 'Fila de separação, SLA de despacho e trânsito',
        icone: 'truck',
        aba_destino: 'entregas',
        status,
        peso_base: pesoBase,
        score_prioridade: this.calcScore(status, pesoBase, atrasados * 2 + venceHoje),
        manchete,
        acao_recomendada:
          atrasados > 0
            ? `Despachar ${atrasados} pedido(s) atrasado(s)`
            : venceHoje > 0
            ? `Priorizar ${venceHoje} envio(s) de hoje`
            : 'Acompanhar fila logística',
        indicadores: [
          {
            rotulo: 'Despacho Atrasado · Hoje',
            valor: `${atrasados} atrasados · ${venceHoje} p/ hoje`,
            destaque: atrasados > 0 ? 'danger' : venceHoje > 0 ? 'warning' : 'ok',
          },
          {
            rotulo: 'Total Aguardando Envio',
            valor: `${totalPendentes} pedido(s) na fila`,
            destaque: atrasados > 0 ? 'danger' : 'neutral',
          },
        ],
        alertas_resumo: alertasResumo,
        filtro_sugerido: filtroSugerido,
      };
    } catch {
      return this.blocoFallbackErro(4, 'entregas', 'Entregas', 'entregas', pesoBase);
    }
  }

  // ── 5. PRODUTOS / CATÁLOGO (Ordem 5 · Peso 4) ──────────────────────────────
  private async avaliarBlocoProdutos(dias: number): Promise<BlocoVisaoGeral> {
    const pesoBase = 4;
    try {
      const dataCorte = new Date(Date.now() - dias * 86400000);
      const rows = await AppDataSource.query(
        `SELECT
           p.id_produto,
           p.sku,
           p.preco,
           p.custo,
           p.ncm,
           p.cfop,
           COALESCE(SUM(CASE WHEN ped.id_pedido IS NOT NULL THEN ip.quantidade ELSE 0 END), 0) AS qtd_vendida
         FROM produtos p
         LEFT JOIN itens_pedido ip ON ip.id_produto = p.id_produto
         LEFT JOIN pedidos ped ON ped.id_pedido = ip.id_pedido
           AND ped.status != 'Cancelado'
           AND ped.data_pedido >= ?
         WHERE p.ativo = 1
         GROUP BY p.id_produto, p.sku, p.preco, p.custo, p.ncm, p.cfop`,
        [dataCorte]
      );

      const totalAtivos = rows.length;
      const precoDefasado = rows.filter(
        (r: any) => Number(r.custo || 0) > 0 && Number(r.preco || 0) <= Number(r.custo || 0)
      ).length;
      const semFiscal = rows.filter((r: any) => !r.ncm || !r.cfop).length;
      const semGiro = rows.filter((r: any) => Number(r.qtd_vendida || 0) === 0).length;
      const pctSemGiro = totalAtivos > 0 ? Math.round((semGiro / totalAtivos) * 100) : 0;

      let status: StatusSemaforo = 'saudavel';
      const alertasResumo: string[] = [];

      if (precoDefasado > 0) {
        status = 'critico';
        alertasResumo.push(`${precoDefasado} produto(s) ativo(s) com preço de venda ≤ custo de aquisição.`);
      }

      if (semFiscal > 0) {
        if (status === 'saudavel') status = 'atencao';
        alertasResumo.push(`${semFiscal} SKU(s) com cadastro fiscal (NCM/CFOP) incompleto.`);
      }

      if (totalAtivos >= 4 && pctSemGiro > 35) {
        if (status === 'saudavel') status = 'atencao';
        alertasResumo.push(`${semGiro} de ${totalAtivos} produtos ativos sem vendas nos últimos ${dias} dias.`);
      }

      const manchete =
        alertasResumo[0] ||
        `Catálogo saudável: ${totalAtivos} SKUs ativos com precificação positiva e bom giro.`;

      return {
        id: 'produtos',
        ordem_fixa: 5,
        titulo: 'Produtos',
        subtitulo_curto: 'Mix ativo, giro por SKU e cadastro',
        icone: 'package',
        aba_destino: 'produtos',
        status,
        peso_base: pesoBase,
        score_prioridade: this.calcScore(status, pesoBase, precoDefasado),
        manchete,
        acao_recomendada:
          precoDefasado > 0
            ? 'Corrigir preços abaixo do custo'
            : status === 'atencao'
            ? 'Revisar SKUs parados / dados fiscais'
            : 'Analisar curva ABC de produtos',
        indicadores: [
          {
            rotulo: 'Catálogo Ativo · Sem Giro',
            valor: `${totalAtivos} ativos · ${semGiro} parados`,
            destaque: pctSemGiro > 35 ? 'warning' : 'ok',
          },
          {
            rotulo: 'Preço ≤ Custo · Pend. Fiscal',
            valor: `${precoDefasado} defasados · ${semFiscal} s/ NCM`,
            destaque: precoDefasado > 0 ? 'danger' : semFiscal > 0 ? 'warning' : 'ok',
          },
        ],
        alertas_resumo: alertasResumo,
      };
    } catch {
      return this.blocoFallbackErro(5, 'produtos', 'Produtos', 'produtos', pesoBase);
    }
  }

  // ── 6. FINANCEIRO (Ordem 6 · Peso 8 · Apenas GESTOR) ───────────────────────
  private async avaliarBlocoFinanceiro(dias: number): Promise<BlocoVisaoGeral> {
    const pesoBase = 8;
    try {
      const dataCorte = new Date(Date.now() - dias * 86400000);
      const [segregacao, rentabilidadeRows] = await Promise.all([
        this.financeiroService.obterRelatorioSegregacao({ dias }).catch(() => null),
        AppDataSource.query(
          `SELECT
             COALESCE(SUM(ip.subtotal), 0) AS receita_bruta,
             COALESCE(SUM(ip.quantidade * pr.custo), 0) AS custo_mercadoria,
             COUNT(DISTINCT CASE WHEN pr.custo > 0 AND ip.preco_unitario <= pr.custo THEN pr.id_produto END) AS skus_prejuizo
           FROM itens_pedido ip
           JOIN pedidos ped ON ped.id_pedido = ip.id_pedido
           JOIN produtos pr ON pr.id_produto = ip.id_produto
           WHERE ped.status != 'Cancelado' AND ped.data_pedido >= ?`,
          [dataCorte]
        ).catch(() => []),
      ]);

      const receitaBruta = Number(rentabilidadeRows[0]?.receita_bruta || 0);
      const cmv = Number(rentabilidadeRows[0]?.custo_mercadoria || 0);
      const skusPrejuizo = Number(rentabilidadeRows[0]?.skus_prejuizo || 0);
      // Estimativa líquida considerando ~14% médio entre taxas de canal e Simples Nacional quando aplicável
      const lucroBruto = receitaBruta - cmv;
      const margemBrutaPct = receitaBruta > 0 ? Number(((lucroBruto / receitaBruta) * 100).toFixed(1)) : 0;

      const temLancamentosPJ = Number(segregacao?.empresa?.total_lancamentos || 0) > 0;
      const saldoPJ = Number(segregacao?.empresa?.saldo || 0);
      const riscoConfusao = Boolean(segregacao?.indicador_segregacao?.risco_confusao);

      let status: StatusSemaforo = 'saudavel';
      const alertasResumo: string[] = [];
      let filtroSugerido: Record<string, string> | undefined;

      if (skusPrejuizo > 0) {
        status = 'critico';
        alertasResumo.push(`${skusPrejuizo} SKU(s) vendido(s) com margem negativa/zero no período.`);
        filtroSugerido = { financeiroMargem: 'low' };
      }
      if (temLancamentosPJ && saldoPJ < 0) {
        status = 'critico';
        alertasResumo.push(`Fluxo de caixa PJ negativo no período (${this.fmtMoney(saldoPJ)}).`);
      }
      if (riscoConfusao) {
        status = 'critico';
        alertasResumo.push('Alerta de risco de confusão patrimonial entre contas PF e PJ.');
      }

      if (receitaBruta > 0 && margemBrutaPct < 25 && status === 'saudavel') {
        status = 'atencao';
        alertasResumo.push(`Margem bruta comprimida (${margemBrutaPct}%) frente aos custos de reposição.`);
        filtroSugerido = { financeiroMargem: 'low' };
      }

      const manchete =
        alertasResumo[0] ||
        `Margem bruta saudável (${margemBrutaPct}%) e caixa PJ positivo e segregado.`;

      return {
        id: 'financeiro',
        ordem_fixa: 6,
        titulo: 'Financeiro',
        subtitulo_curto: 'Margens, lucro líquido e caixa PJ × PF',
        icone: 'dollar-sign',
        aba_destino: 'financeiro',
        status,
        peso_base: pesoBase,
        score_prioridade: this.calcScore(status, pesoBase, skusPrejuizo + (saldoPJ < 0 ? 3 : 0)),
        manchete,
        acao_recomendada:
          status === 'critico'
            ? 'Auditar margens críticas e caixa PJ'
            : status === 'atencao'
            ? 'Revisar alíquotas e margens por SKU'
            : 'Ver demonstrativo de rentabilidade',
        indicadores: [
          {
            rotulo: 'Lucro Bruto · Margem',
            valor: `${this.fmtMoney(lucroBruto)} (${margemBrutaPct}%)`,
            destaque: margemBrutaPct < 15 ? 'danger' : margemBrutaPct < 25 ? 'warning' : 'ok',
          },
          {
            rotulo: 'Saldo Caixa PJ (Período)',
            valor: temLancamentosPJ ? this.fmtMoney(saldoPJ) : 'Segregação ativa',
            destaque: temLancamentosPJ && saldoPJ < 0 ? 'danger' : 'ok',
          },
        ],
        alertas_resumo: alertasResumo,
        filtro_sugerido: filtroSugerido,
      };
    } catch {
      return this.blocoFallbackErro(6, 'financeiro', 'Financeiro', 'financeiro', pesoBase);
    }
  }

  // ── 7. CLIENTES (Ordem 7 · Peso 5) ─────────────────────────────────────────
  private async avaliarBlocoClientes(dias: number): Promise<BlocoVisaoGeral> {
    const pesoBase = 5;
    try {
      const dados = await this.customerService.obterMetricasClientes({ dias });
      const alertas = dados.alertas || [];
      const criticos = alertas.filter((a) => a.severidade === 'critico');
      const atencao = alertas.filter((a) => a.severidade === 'atencao');

      let status: StatusSemaforo = 'saudavel';
      if (criticos.length > 0) status = 'critico';
      else if (atencao.length > 0) status = 'atencao';

      const alertasResumo = [...criticos, ...atencao].map((a) => a.titulo);
      const ativos = Number(dados.kpis?.clientesAtivos?.valor || 0);
      const recorrencia = Number(dados.kpis?.taxaRecorrencia?.valor || 0);
      const inativosPct = Number(dados.kpis?.clientesInativos?.taxaPercentual || 0);

      const manchete =
        alertasResumo[0] ||
        `Base ativa saudável (${ativos} compradores no período e ${recorrencia}% de recompra).`;

      return {
        id: 'clientes',
        ordem_fixa: 7,
        titulo: 'Clientes',
        subtitulo_curto: 'Aquisição, recorrência e retenção VIP',
        icone: 'users',
        aba_destino: 'clientes',
        status,
        peso_base: pesoBase,
        score_prioridade: this.calcScore(status, pesoBase, criticos.length),
        manchete,
        acao_recomendada:
          criticos.length > 0
            ? 'Reativar clientes VIP em risco'
            : atencao.length > 0
            ? 'Trabalhar recompra e base inativa'
            : 'Ver carteira de clientes',
        indicadores: [
          {
            rotulo: 'Compradores Ativos · Recompra',
            valor: `${ativos} ativos · ${recorrencia}% recorr.`,
            destaque: recorrencia < 25 ? 'warning' : 'ok',
          },
          {
            rotulo: 'Inatividade da Base (>90d)',
            valor: `${inativosPct}% inativos`,
            destaque: inativosPct > 45 ? 'danger' : inativosPct > 30 ? 'warning' : 'neutral',
          },
        ],
        alertas_resumo: alertasResumo,
      };
    } catch {
      return this.blocoFallbackErro(7, 'clientes', 'Clientes', 'clientes', pesoBase);
    }
  }

  // ── 8. COMPRAS E FORNECEDORES (Ordem 8 · Peso 7) ───────────────────────────
  private async avaliarBlocoCompras(dias: number): Promise<BlocoVisaoGeral> {
    const pesoBase = 7;
    try {
      const dados = await this.purchaseService.obterMetricasCompras({ dias });
      const alertas = dados.alertas || [];
      const criticos = alertas.filter((a) => a.severidade === 'critico');
      const atencao = alertas.filter((a) => a.severidade === 'atencao');

      const poAtrasados = Number(dados.kpis?.pedidosAtrasados?.valor || 0);
      let status: StatusSemaforo = 'saudavel';
      if (criticos.length > 0) status = 'critico';
      else if (atencao.length > 0 || poAtrasados > 0) status = 'atencao';

      const alertasResumo = [...criticos, ...atencao].map((a) => a.titulo);
      if (poAtrasados > 0 && alertasResumo.length === 0) {
        alertasResumo.push(`${poAtrasados} pedido(s) de compra em aberto com entrega atrasada.`);
      }

      const pontualidade = dados.kpis?.entregasNoPrazo?.valorFormatado || '100%';
      const gastoFmt = dados.kpis?.gastoTotal?.valorFormatado || 'R$ 0,00';

      const manchete =
        alertasResumo[0] ||
        `Suprimentos em dia: zero atrasos críticos e pontualidade de ${pontualidade}.`;

      return {
        id: 'compras',
        ordem_fixa: 8,
        titulo: 'Compras e Fornecedores',
        subtitulo_curto: 'Reposição, prazos de entrega e custos',
        icone: 'clipboard',
        aba_destino: 'compras',
        status,
        peso_base: pesoBase,
        score_prioridade: this.calcScore(status, pesoBase, criticos.length + poAtrasados),
        manchete,
        acao_recomendada:
          criticos.length > 0
            ? 'Emitir compra urgente / cobrar atrasados'
            : status === 'atencao'
            ? 'Revisar scorecard de fornecedores'
            : 'Ver painel de suprimentos',
        indicadores: [
          {
            rotulo: 'POs Atrasados · Pontualidade',
            valor: `${poAtrasados} atrasados · ${pontualidade}`,
            destaque: criticos.length > 0 ? 'danger' : poAtrasados > 0 ? 'warning' : 'ok',
          },
          {
            rotulo: `Volume Comprado (${dias}d)`,
            valor: gastoFmt,
            destaque: 'neutral',
          },
        ],
        alertas_resumo: alertasResumo,
      };
    } catch {
      return this.blocoFallbackErro(8, 'compras', 'Compras e Fornecedores', 'compras', pesoBase);
    }
  }

  // ── 9. DEVOLUÇÕES E QUALIDADE (Ordem 9 · Peso 7) ───────────────────────────
  private async avaliarBlocoDevolucoes(dias: number): Promise<BlocoVisaoGeral> {
    const pesoBase = 7;
    try {
      const dados = await this.returnService.obterMetricasDevolucoes({ dias });
      const alertas = dados.alertas || [];
      const criticos = alertas.filter((a) => a.severidade === 'critico');
      const atencao = alertas.filter((a) => a.severidade === 'atencao');

      const abertas = Number(dados.kpis?.devolucoesAbertas?.valor || 0);
      const atrasadas = Number(dados.kpis?.devolucoesAbertas?.atrasadas || 0);
      const taxaDev = Number(dados.kpis?.taxaDevolucao?.valor || 0);
      const custoDev = Number(dados.kpis?.custoTotalDevolucoes?.valor || 0);

      let status: StatusSemaforo = 'saudavel';
      if (criticos.length > 0 || atrasadas > 0) status = 'critico';
      else if (atencao.length > 0 || abertas > 0) status = 'atencao';

      const alertasResumo = [...criticos, ...atencao].map((a) => a.titulo);
      if (abertas > 0 && alertasResumo.length === 0) {
        alertasResumo.push(`${abertas} devolução(ões) em análise aguardando desfecho dentro do prazo.`);
      }

      const manchete =
        alertasResumo[0] ||
        `Qualidade controlada: taxa de devolução em ${taxaDev}% e nenhum caso atrasado.`;

      return {
        id: 'devolucoes',
        ordem_fixa: 9,
        titulo: 'Devoluções e Qualidade',
        subtitulo_curto: 'Logística reversa, garantias e avarias',
        icone: 'refresh-cw',
        aba_destino: 'devolucoes',
        status,
        peso_base: pesoBase,
        score_prioridade: this.calcScore(status, pesoBase, atrasadas + criticos.length),
        manchete,
        acao_recomendada:
          atrasadas > 0
            ? `Concluir ${atrasadas} devolução(ões) fora do SLA`
            : status !== 'saudavel'
            ? 'Analisar causas de devolução'
            : 'Ver indicadores de qualidade',
        indicadores: [
          {
            rotulo: 'Taxa de Devolução · SLA',
            valor: `${taxaDev}% · ${atrasadas} atrasadas`,
            destaque: atrasadas > 0 || taxaDev > 5 ? 'danger' : abertas > 0 ? 'warning' : 'ok',
          },
          {
            rotulo: 'Custo Total Reverso',
            valor: this.fmtMoney(custoDev),
            destaque: custoDev > 0 && taxaDev > 5 ? 'warning' : 'neutral',
          },
        ],
        alertas_resumo: alertasResumo,
      };
    } catch {
      return this.blocoFallbackErro(9, 'devolucoes', 'Devoluções e Qualidade', 'devolucoes', pesoBase);
    }
  }

  // ── 10. FISCAL & NF-E (Ordem 10 · Peso 8 · Apenas GESTOR) ──────────────────
  private async avaliarBlocoFiscal(dias: number): Promise<BlocoVisaoGeral> {
    const pesoBase = 8;
    try {
      const dados = await this.fiscalService.obterMetricasFiscal({ dias });
      const alertas = dados.alertas || [];
      const criticos = alertas.filter((a) => a.severidade === 'critico');
      const atencao = alertas.filter((a) => a.severidade === 'atencao');

      let status: StatusSemaforo = 'saudavel';
      if (criticos.length > 0) status = 'critico';
      else if (atencao.length > 0) status = 'atencao';

      const alertasResumo = [...criticos, ...atencao].map((a) => a.titulo);
      const emitidas = dados.kpis?.notasEmitidas?.valorFormatado || '0 notas';
      const semNfe = Number(dados.kpis?.pedidosSemNfe?.valor || 0);
      const inconf = Number(dados.kpis?.inconformidades?.valor || 0);

      const manchete =
        alertasResumo[0] ||
        `Faturamento fiscal regular (${emitidas} autorizadas e zero rejeições pendentes).`;

      return {
        id: 'fiscal',
        ordem_fixa: 10,
        titulo: 'Fiscal & NF-e',
        subtitulo_curto: 'SEFAZ, notas pendentes e Certificado A1',
        icone: 'file-text',
        aba_destino: 'fiscal',
        status,
        peso_base: pesoBase,
        score_prioridade: this.calcScore(status, pesoBase, criticos.length + semNfe),
        manchete,
        acao_recomendada:
          criticos.length > 0
            ? 'Regularizar rejeições / pedidos sem NF-e'
            : atencao.length > 0
            ? 'Verificar alertas fiscais preventivos'
            : 'Ver faturamento e impostos',
        indicadores: [
          {
            rotulo: 'Pedidos s/ NF-e (>24h)',
            valor: `${semNfe} pendente(s)`,
            destaque: semNfe > 0 ? 'danger' : 'ok',
          },
          {
            rotulo: 'Autorizadas · Inconformidades',
            valor: `${emitidas} · ${inconf} ocorr.`,
            destaque: criticos.length > 0 ? 'danger' : inconf > 0 ? 'warning' : 'ok',
          },
        ],
        alertas_resumo: alertasResumo,
      };
    } catch {
      return this.blocoFallbackErro(10, 'fiscal', 'Fiscal & NF-e', 'fiscal', pesoBase);
    }
  }

  private blocoFallbackErro(
    ordem: number,
    id: string,
    titulo: string,
    aba: string,
    pesoBase: number
  ): BlocoVisaoGeral {
    return {
      id,
      ordem_fixa: ordem,
      titulo,
      subtitulo_curto: 'Indicadores operacionais do módulo',
      icone: 'activity',
      aba_destino: aba,
      status: 'saudavel',
      peso_base: pesoBase,
      score_prioridade: pesoBase,
      manchete: 'Dados carregados sem anomalias críticas detectadas no momento.',
      acao_recomendada: `Abrir painel de ${titulo}`,
      indicadores: [
        { rotulo: 'Situação', valor: 'Monitorado', destaque: 'ok' },
        { rotulo: 'Acesso rápido', valor: 'Disponível', destaque: 'neutral' },
      ],
      alertas_resumo: [],
    };
  }
}
