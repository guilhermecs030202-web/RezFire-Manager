import { AppDataSource } from '../config/database';
import { MovimentacaoEstoque } from '../entities/MovimentacaoEstoque';
import { Estoque } from '../entities/Estoque';
import { Produto } from '../entities/Produto';
import { LoteEstoque } from '../entities/LoteEstoque';

export interface RegistrarMovimentacaoDTO {
  id_produto: number;
  id_usuario?: number | null;
  tipo: 'Entrada' | 'Saída';
  quantidade: number;
  motivo: string;
  // Campos opcionais para rastreabilidade de lote / extintor
  id_lote?: number;
  novo_lote?: {
    numero_lote: string;
    numero_lacre_inmetro?: string;
    data_fabricacao?: string;
    data_validade: string;
  };
}

export class MovimentacaoService {
  private get movRepo() {
    return AppDataSource.getRepository(MovimentacaoEstoque);
  }

  /**
   * Lista movimentações com filtros por produto, tipo e período
   */
  async listar(filtros: {
    id_produto?: number;
    tipo?: 'Entrada' | 'Saída';
    data_inicio?: string;
    data_fim?: string;
    limite?: number;
  }) {
    const qb = this.movRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.produto', 'p')
      .leftJoinAndSelect('m.usuario', 'u')
      .orderBy('m.data_movimentacao', 'DESC');

    if (filtros.id_produto) {
      qb.andWhere('m.id_produto = :id_produto', { id_produto: filtros.id_produto });
    }

    if (filtros.tipo) {
      qb.andWhere('m.tipo = :tipo', { tipo: filtros.tipo });
    }

    if (filtros.data_inicio) {
      qb.andWhere('m.data_movimentacao >= :data_inicio', {
        data_inicio: new Date(filtros.data_inicio),
      });
    }

    if (filtros.data_fim) {
      qb.andWhere('m.data_movimentacao <= :data_fim', {
        data_fim: new Date(filtros.data_fim),
      });
    }

    if (filtros.limite) {
      qb.take(filtros.limite);
    }

    return qb.getMany();
  }

  /**
   * Executa a Regra de Ouro: Registra movimentação e atualiza saldo físico do estoque atomicamente
   */
  async registrar(dados: RegistrarMovimentacaoDTO) {
    if (!dados.quantidade || dados.quantidade <= 0) {
      throw new Error('A quantidade da movimentação deve ser maior que zero.');
    }

    if (!dados.motivo || !dados.motivo.trim()) {
      throw new Error('O motivo da movimentação é obrigatório.');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const prodRepoTx = queryRunner.manager.getRepository(Produto);
      const estRepoTx = queryRunner.manager.getRepository(Estoque);
      const loteRepoTx = queryRunner.manager.getRepository(LoteEstoque);
      const movRepoTx = queryRunner.manager.getRepository(MovimentacaoEstoque);

      const produto = await prodRepoTx.findOne({ where: { id_produto: dados.id_produto } });
      if (!produto) {
        throw new Error(`Produto #${dados.id_produto} não encontrado.`);
      }

      if (produto.tipo === 'Combo') {
        throw new Error(
          'Não é permitido movimentar estoque direto de um Combo. Movimente os componentes físicos individuais.'
        );
      }

      // Obtém ou cria registro de estoque
      let estoque = await estRepoTx.findOne({ where: { id_produto: dados.id_produto } });
      if (!estoque) {
        estoque = estRepoTx.create({
          id_produto: dados.id_produto,
          quantidade_atual: 0,
          estoque_minimo: 0,
        });
        await estRepoTx.save(estoque);
      }

      // Validação de saldo para saídas
      if (dados.tipo === 'Saída') {
        if (estoque.quantidade_atual < dados.quantidade) {
          throw new Error(
            `Saldo insuficiente em estoque para "${produto.nome}". Disponível: ${estoque.quantidade_atual}, Solicitado: ${dados.quantidade}.`
          );
        }
        estoque.quantidade_atual -= dados.quantidade;

        // Se houver lote especificado, debita do lote
        if (dados.id_lote) {
          const lote = await loteRepoTx.findOne({ where: { id_lote: dados.id_lote } });
          if (!lote) {
            throw new Error(`Lote #${dados.id_lote} não encontrado.`);
          }
          if (lote.quantidade_disponivel < dados.quantidade) {
            throw new Error(
              `Saldo insuficiente no lote ${lote.numero_lote}. Disponível no lote: ${lote.quantidade_disponivel}.`
            );
          }
          lote.quantidade_disponivel -= dados.quantidade;
          if (lote.quantidade_disponivel === 0) {
            lote.status = 'Esgotado';
          }
          await loteRepoTx.save(lote);
        }
      } else {
        // Entrada
        estoque.quantidade_atual += dados.quantidade;

        // Gestão de lotes para entrada
        if (dados.id_lote) {
          const lote = await loteRepoTx.findOne({ where: { id_lote: dados.id_lote } });
          if (lote) {
            lote.quantidade_disponivel += dados.quantidade;
            if (lote.status === 'Esgotado') {
              lote.status = 'Ativo';
            }
            await loteRepoTx.save(lote);
          }
        } else if (dados.novo_lote) {
          // Criação de novo lote na entrada
          const loteCriado = loteRepoTx.create({
            id_produto: dados.id_produto,
            numero_lote: dados.novo_lote.numero_lote,
            numero_lacre_inmetro: dados.novo_lote.numero_lacre_inmetro,
            data_fabricacao: dados.novo_lote.data_fabricacao,
            data_validade: dados.novo_lote.data_validade,
            quantidade_disponivel: dados.quantidade,
            status: 'Ativo',
          });
          await loteRepoTx.save(loteCriado);
        }
      }

      await estRepoTx.save(estoque);

      // Registra a movimentação obrigatória (Regra de Ouro)
      const movimentacao = movRepoTx.create({
        id_produto: dados.id_produto,
        id_usuario: dados.id_usuario || null,
        tipo: dados.tipo,
        quantidade: dados.quantidade,
        motivo: dados.motivo.trim(),
        data_movimentacao: new Date(),
      });
      const movimentacaoSalva = await movRepoTx.save(movimentacao);

      await queryRunner.commitTransaction();

      return {
        sucesso: true,
        mensagem: `Movimentação de ${dados.tipo.toLowerCase()} registrada com sucesso.`,
        movimentacao: movimentacaoSalva,
        novo_saldo: estoque.quantidade_atual,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Realiza ajuste de balanço físico / contagem de inventário
   */
  async ajustarInventario(id_produto: number, quantidadeContada: number, id_usuario?: number) {
    const estoque = await AppDataSource.getRepository(Estoque).findOne({ where: { id_produto } });
    if (!estoque) {
      throw new Error(`Estoque do produto #${id_produto} não localizado.`);
    }

    const diferenca = quantidadeContada - estoque.quantidade_atual;
    if (diferenca === 0) {
      return { sucesso: true, mensagem: 'Saldo já confere com a contagem física.', novo_saldo: quantidadeContada };
    }

    const tipo: 'Entrada' | 'Saída' = diferenca > 0 ? 'Entrada' : 'Saída';
    const quantidade = Math.abs(diferenca);

    return this.registrar({
      id_produto,
      id_usuario,
      tipo,
      quantidade,
      motivo: `Ajuste de Balanço / Inventário Físico (${tipo === 'Entrada' ? '+' : '-'}${quantidade} un.)`,
    });
  }
}

