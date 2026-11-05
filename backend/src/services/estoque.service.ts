import { AppDataSource } from '../config/database';
import { Estoque } from '../entities/Estoque';
import { Produto } from '../entities/Produto';
import { LoteEstoque } from '../entities/LoteEstoque';

export class EstoqueService {
  private get estoqueRepo() {
    return AppDataSource.getRepository(Estoque);
  }

  private get produtoRepo() {
    return AppDataSource.getRepository(Produto);
  }

  private get loteRepo() {
    return AppDataSource.getRepository(LoteEstoque);
  }

  /**
   * Retorna visão consolidada de estoque com status operacional e cálculos FEFO
   */
  async listarEstoqueCompleto() {
    const produtos = await this.produtoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.estoque', 'e')
      .leftJoinAndSelect('p.lotes', 'l')
      .where('p.ativo = :ativo', { ativo: true })
      .orderBy('p.nome', 'ASC')
      .getMany();

    // Mapeamento para kits
    const saldosFisicos = new Map<number, number>();
    for (const p of produtos) {
      if (p.tipo !== 'Combo') {
        saldosFisicos.set(p.id_produto, p.estoque?.quantidade_atual || 0);
      }
    }

    const agora = new Date();

    return produtos.map((p) => {
      let quantidadeAtual = p.estoque?.quantidade_atual || 0;
      const estoqueMinimo = p.estoque?.estoque_minimo || 0;

      if (p.tipo === 'Combo' && p.combo_items && p.combo_items.length > 0) {
        const disponibilidades = p.combo_items.map((ci) => {
          const saldo = saldosFisicos.get(ci.id_produto) || 0;
          return Math.floor(saldo / ci.quantidade);
        });
        quantidadeAtual = Math.min(...disponibilidades);
      }

      // Avaliação de Lotes FEFO para produtos do tipo extintor
      const lotesComFefo = (p.lotes || []).map((lote) => {
        const dataValidade = new Date(lote.data_validade);
        const diffMs = dataValidade.getTime() - agora.getTime();
        const diasParaVencer = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let fefoStatus: 'Normal' | 'Alerta' | 'Bloqueado' | 'Vencido' = 'Normal';
        if (diasParaVencer <= 0) {
          fefoStatus = 'Vencido';
        } else if (diasParaVencer <= 180) {
          fefoStatus = 'Bloqueado'; // Prazo mínimo de 6 meses para cliente
        } else if (diasParaVencer <= 365) {
          fefoStatus = 'Alerta'; // Prioridade máxima de despacho
        }

        return {
          ...lote,
          dias_para_vencer: diasParaVencer,
          fefo_status: fefoStatus,
        };
      });

      // Ordenação padrão FEFO: validade mais próxima primeiro
      lotesComFefo.sort((a, b) => new Date(a.data_validade).getTime() - new Date(b.data_validade).getTime());

      // Status do Estoque
      let situacaoEstoque: 'Zerado' | 'Baixo' | 'Normal' = 'Normal';
      if (quantidadeAtual <= 0) {
        situacaoEstoque = 'Zerado';
      } else if (quantidadeAtual <= estoqueMinimo) {
        situacaoEstoque = 'Baixo';
      }

      return {
        id_produto: p.id_produto,
        sku: p.sku,
        nome: p.nome,
        categoria: p.categoria,
        tipo: p.tipo,
        preco: p.preco,
        custo: p.custo,
        quantidade_atual: quantidadeAtual,
        estoque_minimo: estoqueMinimo,
        situacao_estoque: situacaoEstoque,
        lotes: lotesComFefo,
      };
    });
  }

  /**
   * Retorna a central de alertas operacionais de estoque
   */
  async obterAlertasOperacionais() {
    const lista = await this.listarEstoqueCompleto();
    const agora = new Date();

    const produtosAbaixoMinimo = lista.filter((i) => i.quantidade_atual <= i.estoque_minimo);
    const produtosZerados = lista.filter((i) => i.quantidade_atual === 0);

    const lotesCriticos: any[] = [];
    for (const item of lista) {
      for (const lote of item.lotes) {
        if (lote.fefo_status !== 'Normal' && lote.quantidade_disponivel > 0) {
          lotesCriticos.push({
            id_lote: lote.id_lote,
            id_produto: item.id_produto,
            produto_nome: item.nome,
            sku: item.sku,
            numero_lote: lote.numero_lote,
            numero_lacre_inmetro: lote.numero_lacre_inmetro,
            data_validade: lote.data_validade,
            dias_para_vencer: lote.dias_para_vencer,
            quantidade_disponivel: lote.quantidade_disponivel,
            fefo_status: lote.fefo_status,
          });
        }
      }
    }

    return {
      total_produtos_criticos: produtosAbaixoMinimo.length,
      produtos_zerados: produtosZerados,
      produtos_abaixo_minimo: produtosAbaixoMinimo,
      lotes_fefo_criticos: lotesCriticos,
    };
  }
}

