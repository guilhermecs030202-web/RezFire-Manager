import { AppDataSource } from '../config/database';
import { PedidoService } from './pedido.service';

export interface AlertaItem {
  id: string;
  categoria: 'postagem' | 'estoque' | 'validade' | 'anuncio';
  criticidade: 'critico' | 'atencao';
  titulo: string;
  descricao: string;
  impacto: string;
  acao_label: string;
  acao_url: string;
  dados_origem: Record<string, any>;
  criado_em: string;
}

export class AlertaService {
  private pedidoService = new PedidoService();

  /**
   * Consolida todos os alertas operacionais do sistema em um painel único (SCRUM-24 / #19)
   * Agrega Stories: #4 (Estoque Mínimo), #8 (Validade FEFO), #10 (Prazo Postagem) e #13 (Anúncios ML)
   */
  async obterCentralAlertas(): Promise<{
    resumo: {
      total: number;
      criticos: number;
      atencao: number;
      por_categoria: {
        postagem: number;
        estoque: number;
        validade: number;
        anuncio: number;
      };
    };
    alertas: AlertaItem[];
  }> {
    const alertas: AlertaItem[] = [];
    const agora = new Date();

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Alertas de Prazo de Postagem (#10)
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const prazosPostagem = await this.pedidoService.obterAlertasPostagem();
      for (const p of prazosPostagem.pedidos) {
        if (p.criticidade === 'atrasado') {
          alertas.push({
            id: `postagem-${p.id_pedido}`,
            categoria: 'postagem',
            criticidade: 'critico',
            titulo: `Pedido ${p.codigo_pedido} com postagem ATRASADA`,
            descricao: `Venceu há ${Math.abs(p.horas_restantes)}h (${p.itens_resumo || 'Itens diversos'}). Canal: ${p.origem}.`,
            impacto: 'Risco iminente de reclamação do cliente e penalidade de reputação no Mercado Livre.',
            acao_label: 'Despachar Pedido',
            acao_url: 'entregas.html',
            dados_origem: p,
            criado_em: p.prazo_despacho ? new Date(p.prazo_despacho).toISOString() : agora.toISOString(),
          });
        } else if (p.criticidade === 'hoje') {
          alertas.push({
            id: `postagem-${p.id_pedido}`,
            categoria: 'postagem',
            criticidade: 'atencao',
            titulo: `Pedido ${p.codigo_pedido} deve ser postado HOJE`,
            descricao: `Restam ${p.horas_restantes}h para o prazo limite (${p.itens_resumo || 'Itens diversos'}).`,
            impacto: 'Necessita separação e embalagem imediatas para não estourar o SLA do dia.',
            acao_label: 'Ver na Expedição',
            acao_url: 'entregas.html',
            dados_origem: p,
            criado_em: p.prazo_despacho ? new Date(p.prazo_despacho).toISOString() : agora.toISOString(),
          });
        }
      }
    } catch (err) {
      console.warn('Aviso ao consultar alertas de postagem:', err);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Alertas de Estoque Mínimo e Ruptura (#4)
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const estoqueQuery = await AppDataSource.query(`
        SELECT 
          p.id_produto,
          p.sku,
          p.nome,
          p.preco,
          e.quantidade_atual,
          e.estoque_minimo
        FROM produtos p
        INNER JOIN estoque e ON e.id_produto = p.id_produto
        WHERE p.ativo = 1 AND e.quantidade_atual <= e.estoque_minimo
        ORDER BY e.quantidade_atual ASC
      `);

      for (const item of estoqueQuery) {
        const saldo = Number(item.quantidade_atual || 0);
        const minimo = Number(item.estoque_minimo || 0);

        if (saldo === 0) {
          alertas.push({
            id: `estoque-ruptura-${item.id_produto}`,
            categoria: 'estoque',
            criticidade: 'critico',
            titulo: `RUPTURA TOTAL: ${item.sku} - ${item.nome}`,
            descricao: `Estoque físico esgotado (0 unidades). Estoque de segurança configurado: ${minimo} un.`,
            impacto: 'Vendas travadas ou risco de vender sem estoque no Mercado Livre.',
            acao_label: 'Registrar Entrada / Reabastecer',
            acao_url: 'movimentacoes.html',
            dados_origem: item,
            criado_em: agora.toISOString(),
          });
        } else {
          alertas.push({
            id: `estoque-baixo-${item.id_produto}`,
            categoria: 'estoque',
            criticidade: 'atencao',
            titulo: `Estoque Baixo: ${item.sku} (${saldo}/${minimo} un.)`,
            descricao: `O saldo atual de ${saldo} unidades está igual ou abaixo do estoque mínimo (${minimo} un.).`,
            impacto: 'Risco de ruptura a curto prazo se houver pico de pedidos.',
            acao_label: 'Consultar Estoque',
            acao_url: 'estoque.html',
            dados_origem: item,
            criado_em: agora.toISOString(),
          });
        }
      }
    } catch (err) {
      console.warn('Aviso ao consultar alertas de estoque:', err);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Alertas de Validade FEFO dos Extintores (#8)
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const lotesQuery = await AppDataSource.query(`
        SELECT 
          l.id_lote,
          l.numero_lote,
          l.numero_lacre_inmetro,
          l.data_validade,
          l.quantidade_disponivel,
          l.status,
          p.sku,
          p.nome AS produto_nome,
          DATEDIFF(l.data_validade, NOW()) AS dias_para_vencer
        FROM lotes_estoque l
        INNER JOIN produtos p ON p.id_produto = l.id_produto
        WHERE l.quantidade_disponivel > 0 AND DATEDIFF(l.data_validade, NOW()) <= 365
        ORDER BY l.data_validade ASC
      `);

      for (const lote of lotesQuery) {
        const dias = Number(lote.dias_para_vencer || 0);

        if (dias <= 0) {
          alertas.push({
            id: `validade-vencido-${lote.id_lote}`,
            categoria: 'validade',
            criticidade: 'critico',
            titulo: `Extintor VENCIDO: Lote ${lote.numero_lote} (${lote.sku})`,
            descricao: `Lote vencido há ${Math.abs(dias)} dias com ${lote.quantidade_disponivel} un. no armazém. Lacre: ${lote.numero_lacre_inmetro || 'N/A'}.`,
            impacto: 'Proibida comercialização perante INMETRO. Exige descarte ou envio imediato para recarga.',
            acao_label: 'Segregar / Dar Saída',
            acao_url: 'movimentacoes.html',
            dados_origem: lote,
            criado_em: lote.data_validade ? new Date(lote.data_validade).toISOString() : agora.toISOString(),
          });
        } else if (dias <= 180) {
          alertas.push({
            id: `validade-bloqueado-${lote.id_lote}`,
            categoria: 'validade',
            criticidade: 'critico',
            titulo: `Bloqueio de Expedição (< 6 meses): Lote ${lote.numero_lote}`,
            descricao: `Restam apenas ${dias} dias de validade útil para ${lote.sku} (${lote.quantidade_disponivel} un.).`,
            impacto: 'Bloqueado para venda conforme regra operacional para assegurar tempo útil mínimo de 6 meses ao cliente.',
            acao_label: 'Ver Lotes no Estoque',
            acao_url: 'estoque.html',
            dados_origem: lote,
            criado_em: lote.data_validade ? new Date(lote.data_validade).toISOString() : agora.toISOString(),
          });
        } else {
          alertas.push({
            id: `validade-alerta-${lote.id_lote}`,
            categoria: 'validade',
            criticidade: 'atencao',
            titulo: `Prioridade FEFO (Vence em ${dias} dias): Lote ${lote.numero_lote}`,
            descricao: `Lote de ${lote.sku} com ${lote.quantidade_disponivel} un. entra em alerta de expedição prioritária (validade <= 1 ano).`,
            impacto: 'Priorizar despacho deste lote nas próximas saídas para evitar encalhe e perda de validade.',
            acao_label: 'Priorizar na Expedição',
            acao_url: 'entregas.html',
            dados_origem: lote,
            criado_em: lote.data_validade ? new Date(lote.data_validade).toISOString() : agora.toISOString(),
          });
        }
      }
    } catch (err) {
      console.warn('Aviso ao consultar alertas de validade FEFO:', err);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Alertas de Anúncios ML Pausados ou Divergentes (#13)
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const anunciosQuery = await AppDataSource.query(`
        SELECT 
          a.id_anuncio,
          a.ml_item_id,
          a.titulo,
          a.status,
          a.quantidade_disponivel,
          a.quantidade_vendida,
          a.preco,
          p.sku AS produto_sku,
          e.quantidade_atual AS estoque_local
        FROM anuncios_ml a
        LEFT JOIN produto_anuncio pa ON pa.id_anuncio = a.id_anuncio
        LEFT JOIN produtos p ON p.id_produto = pa.id_produto
        LEFT JOIN estoque e ON e.id_produto = p.id_produto
      `);

      for (const a of anunciosQuery) {
        if (a.status === 'Pausado') {
          alertas.push({
            id: `anuncio-pausado-${a.id_anuncio}`,
            categoria: 'anuncio',
            criticidade: 'critico',
            titulo: `Anúncio PAUSADO no Mercado Livre: ${a.ml_item_id}`,
            descricao: `"${a.titulo}". Status atual no ML: Pausado. Estoque físico no galpão: ${a.estoque_local ?? 0} un.`,
            impacto: 'Perda diária de faturamento e queda de posicionamento nos algoritmos de busca do Mercado Livre.',
            acao_label: 'Ver Anúncio',
            acao_url: 'anuncios.html',
            dados_origem: a,
            criado_em: agora.toISOString(),
          });
        } else if (a.status === 'Ativo' && a.estoque_local !== null) {
          const qtdAnunciada = Number(a.quantidade_disponivel || 0);
          const estoqueReal = Number(a.estoque_local || 0);

          if (qtdAnunciada > estoqueReal) {
            alertas.push({
              id: `anuncio-divergencia-${a.id_anuncio}`,
              categoria: 'anuncio',
              criticidade: 'atencao',
              titulo: `Divergência de Estoque: ${a.ml_item_id}`,
              descricao: `Anunciado no ML: ${qtdAnunciada} un., mas o saldo físico disponível é de apenas ${estoqueReal} un.`,
              impacto: 'Risco de venda a descoberto (vender sem ter a mercadoria para despachar).',
              acao_label: 'Ajustar no ML',
              acao_url: 'anuncios.html',
              dados_origem: a,
              criado_em: agora.toISOString(),
            });
          }
        }
      }
    } catch (err) {
      console.warn('Aviso ao consultar alertas de anúncios:', err);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Ordenação por Prioridade Operacional:
    // 1º Críticos (postagem atrasada, ruptura, vencidos/bloqueados, pausados)
    // 2º Atenção (postar hoje, estoque baixo, alerta FEFO, divergência)
    // ─────────────────────────────────────────────────────────────────────────
    alertas.sort((a, b) => {
      if (a.criticidade === 'critico' && b.criticidade !== 'critico') return -1;
      if (a.criticidade !== 'critico' && b.criticidade === 'critico') return 1;
      return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
    });

    const resumo = {
      total: alertas.length,
      criticos: alertas.filter((a) => a.criticidade === 'critico').length,
      atencao: alertas.filter((a) => a.criticidade === 'atencao').length,
      por_categoria: {
        postagem: alertas.filter((a) => a.categoria === 'postagem').length,
        estoque: alertas.filter((a) => a.categoria === 'estoque').length,
        validade: alertas.filter((a) => a.categoria === 'validade').length,
        anuncio: alertas.filter((a) => a.categoria === 'anuncio').length,
      },
    };

    return { resumo, alertas };
  }
}
