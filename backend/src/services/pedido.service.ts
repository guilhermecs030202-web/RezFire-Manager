import { AppDataSource } from '../config/database';
import { Pedido } from '../entities/Pedido';
import { ItemPedido } from '../entities/ItemPedido';
import { Produto } from '../entities/Produto';
import { Estoque } from '../entities/Estoque';
import { LoteEstoque } from '../entities/LoteEstoque';
import { MovimentacaoEstoque } from '../entities/MovimentacaoEstoque';

export interface CriarItemPedidoDTO {
  id_produto: number;
  quantidade: number;
  preco_unitario?: number;
}

export interface CriarPedidoDTO {
  codigo_pedido?: string;
  cliente_nome: string;
  origem?: string;
  itens: CriarItemPedidoDTO[];
  exibir_na_entrega?: boolean;
}

export class PedidoService {
  private get pedidoRepo() {
    return AppDataSource.getRepository(Pedido);
  }

  /**
   * Lista todos os pedidos com filtros
   */
  async listar(filtros: {
    status?: 'Confirmado' | 'Concluido' | 'Cancelado';
    status_entrega?: 'A separar' | 'Pronto p/ despacho' | 'Despachado' | 'Entregue';
    exibir_na_entrega?: boolean;
    busca?: string;
    limite?: number;
  }) {
    const qb = this.pedidoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.itens', 'i')
      .leftJoinAndSelect('i.produto', 'prod')
      .orderBy('p.data_pedido', 'DESC');

    if (filtros.status) {
      qb.andWhere('p.status = :status', { status: filtros.status });
    }

    if (filtros.status_entrega) {
      qb.andWhere('p.status_entrega = :status_entrega', {
        status_entrega: filtros.status_entrega,
      });
    }

    if (filtros.exibir_na_entrega !== undefined) {
      qb.andWhere('p.exibir_na_entrega = :exibir_na_entrega', {
        exibir_na_entrega: filtros.exibir_na_entrega,
      });
    }

    if (filtros.busca) {
      qb.andWhere('(p.codigo_pedido LIKE :busca OR p.cliente_nome LIKE :busca)', {
        busca: `%${filtros.busca}%`,
      });
    }

    if (filtros.limite) {
      qb.take(filtros.limite);
    }

    return qb.getMany();
  }

  /**
   * Busca detalhes de um pedido
   */
  async buscarPorId(id_pedido: number) {
    const pedido = await this.pedidoRepo.findOne({
      where: { id_pedido },
      relations: ['itens', 'itens.produto'],
    });

    if (!pedido) {
      throw new Error(`Pedido #${id_pedido} não encontrado.`);
    }

    return pedido;
  }

  /**
   * Cria um pedido aprovado (Confirmado) e executa a baixa transacional imediata de estoque
   */
  async criarPedido(dados: CriarPedidoDTO, id_usuario?: number) {
    if (!dados.itens || dados.itens.length === 0) {
      throw new Error('O pedido deve conter ao menos um item.');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const prodRepoTx = queryRunner.manager.getRepository(Produto);
      const estRepoTx = queryRunner.manager.getRepository(Estoque);
      const loteRepoTx = queryRunner.manager.getRepository(LoteEstoque);
      const movRepoTx = queryRunner.manager.getRepository(MovimentacaoEstoque);
      const pedRepoTx = queryRunner.manager.getRepository(Pedido);
      const itemRepoTx = queryRunner.manager.getRepository(ItemPedido);

      const codigoPedido = dados.codigo_pedido?.trim() || `PED-${Date.now()}`;

      const pedidoExistente = await pedRepoTx.findOne({ where: { codigo_pedido: codigoPedido } });
      if (pedidoExistente) {
        throw new Error(`Código de pedido "${codigoPedido}" já cadastrado.`);
      }

      let valorTotal = 0;
      const itensParaSalvar: ItemPedido[] = [];

      // Itens físicos a debitar do estoque: Map<id_produto_fisico, quantidade_total>
      const baixasFisicas = new Map<number, { produto: Produto; quantidade: number }>();

      // 1. Validação dos itens e composição de combos
      for (const itemDto of dados.itens) {
        if (!itemDto.quantidade || itemDto.quantidade <= 0) {
          throw new Error('A quantidade de cada item deve ser maior que zero.');
        }

        const produto = await prodRepoTx.findOne({
          where: { id_produto: itemDto.id_produto },
          relations: ['estoque'],
        });

        if (!produto) {
          throw new Error(`Produto #${itemDto.id_produto} não localizado.`);
        }

        const precoUnitario = itemDto.preco_unitario !== undefined ? itemDto.preco_unitario : Number(produto.preco);
        const subtotal = precoUnitario * itemDto.quantidade;
        valorTotal += subtotal;

        // Se for combo, explode nos componentes físicos
        if (produto.tipo === 'Combo' && produto.combo_items && produto.combo_items.length > 0) {
          for (const ci of produto.combo_items) {
            const comp = await prodRepoTx.findOne({ where: { id_produto: ci.id_produto } });
            if (!comp) throw new Error(`Componente #${ci.id_produto} do combo não encontrado.`);
            const qtdTotalComp = ci.quantidade * itemDto.quantidade;
            const anterior = baixasFisicas.get(ci.id_produto) || { produto: comp, quantidade: 0 };
            baixasFisicas.set(ci.id_produto, { produto: comp, quantidade: anterior.quantidade + qtdTotalComp });
          }
        } else {
          // Produto simples
          const anterior = baixasFisicas.get(produto.id_produto) || { produto, quantidade: 0 };
          baixasFisicas.set(produto.id_produto, {
            produto,
            quantidade: anterior.quantidade + itemDto.quantidade,
          });
        }

        const itemEntity = itemRepoTx.create({
          id_produto: produto.id_produto,
          quantidade: itemDto.quantidade,
          preco_unitario: precoUnitario,
          subtotal,
        });
        itensParaSalvar.push(itemEntity);
      }

      // 2. Executa a baixa transacional e controle FEFO para cada item físico
      const agora = new Date();
      for (const [idProd, { produto, quantidade }] of baixasFisicas.entries()) {
        const estoque = await estRepoTx.findOne({ where: { id_produto: idProd } });
        if (!estoque || estoque.quantidade_atual < quantidade) {
          throw new Error(
            `Saldo insuficiente para expedir "${produto.nome}". Disponível: ${estoque?.quantidade_atual || 0}, Necessário: ${quantidade}.`
          );
        }

        // Debita do estoque físico
        estoque.quantidade_atual -= quantidade;
        await estRepoTx.save(estoque);

        // Se o produto tiver lotes (extintores), aloca pelo método FEFO (validade mais próxima e não bloqueada)
        const lotes = await loteRepoTx
          .createQueryBuilder('l')
          .where('l.id_produto = :idProd', { idProd })
          .andWhere('l.quantidade_disponivel > 0')
          .andWhere('l.status = :status', { status: 'Ativo' })
          .orderBy('l.data_validade', 'ASC')
          .getMany();

        let qtdRestanteParaBaixar = quantidade;
        for (const lote of lotes) {
          if (qtdRestanteParaBaixar <= 0) break;

          // Valida se o lote não está no prazo de bloqueio de 6 meses
          const diasParaVencer = Math.ceil(
            (new Date(lote.data_validade).getTime() - agora.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diasParaVencer <= 180) {
            // Lote bloqueado conforme AGENTS.md (prazo mínimo útil ao cliente)
            lote.status = 'Bloqueado';
            await loteRepoTx.save(lote);
            continue;
          }

          const baixarDoLote = Math.min(lote.quantidade_disponivel, qtdRestanteParaBaixar);
          lote.quantidade_disponivel -= baixarDoLote;
          if (lote.quantidade_disponivel === 0) {
            lote.status = 'Esgotado';
          }
          await loteRepoTx.save(lote);
          qtdRestanteParaBaixar -= baixarDoLote;
        }

        // Regra de Ouro: Registra movimentação de saída para o pedido
        const mov = movRepoTx.create({
          id_produto: idProd,
          id_usuario: id_usuario || null,
          tipo: 'Saída',
          quantidade,
          motivo: `Venda - Pedido #${codigoPedido}`,
          data_movimentacao: agora,
        });
        await movRepoTx.save(mov);
      }

      // 3. Salva o Pedido
      const pedido = pedRepoTx.create({
        codigo_pedido: codigoPedido,
        cliente_nome: dados.cliente_nome.trim(),
        origem: dados.origem || 'Venda Direta',
        status: 'Confirmado',
        valor_total: valorTotal,
        data_pedido: agora,
        exibir_na_entrega: dados.exibir_na_entrega ?? true,
        status_entrega: 'A separar',
      });
      const pedidoSalvo = await pedRepoTx.save(pedido);

      // Associa itens ao pedido
      for (const item of itensParaSalvar) {
        item.id_pedido = pedidoSalvo.id_pedido;
        await itemRepoTx.save(item);
      }

      await queryRunner.commitTransaction();

      return this.buscarPorId(pedidoSalvo.id_pedido);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Atualiza status do pedido com estorno automático caso seja cancelado
   */
  async atualizarStatus(
    id_pedido: number,
    novoStatus: 'Confirmado' | 'Concluido' | 'Cancelado',
    novoStatusEntrega?: 'A separar' | 'Pronto p/ despacho' | 'Despachado' | 'Entregue',
    id_usuario?: number
  ) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pedRepoTx = queryRunner.manager.getRepository(Pedido);
      const estRepoTx = queryRunner.manager.getRepository(Estoque);
      const prodRepoTx = queryRunner.manager.getRepository(Produto);
      const movRepoTx = queryRunner.manager.getRepository(MovimentacaoEstoque);

      const pedido = await pedRepoTx.findOne({
        where: { id_pedido },
        relations: ['itens', 'itens.produto'],
      });

      if (!pedido) {
        throw new Error(`Pedido #${id_pedido} não encontrado.`);
      }

      // Se estiver cancelando um pedido que estava Confirmado ou Concluído -> ESTORNO AUTOMÁTICO
      if (novoStatus === 'Cancelado' && pedido.status !== 'Cancelado') {
        const agora = new Date();

        for (const item of pedido.itens) {
          const produto = item.produto;

          // Se combo, estorna os itens físicos
          if (produto.tipo === 'Combo' && produto.combo_items) {
            for (const ci of produto.combo_items) {
              const qtdEstorno = ci.quantidade * item.quantidade;
              const est = await estRepoTx.findOne({ where: { id_produto: ci.id_produto } });
              if (est) {
                est.quantidade_atual += qtdEstorno;
                await estRepoTx.save(est);
              }

              // Regra de Ouro: Movimentação de entrada por estorno
              const mov = movRepoTx.create({
                id_produto: ci.id_produto,
                id_usuario: id_usuario || null,
                tipo: 'Entrada',
                quantidade: qtdEstorno,
                motivo: `Estorno (Cancelamento) - Pedido #${pedido.codigo_pedido}`,
                data_movimentacao: agora,
              });
              await movRepoTx.save(mov);
            }
          } else {
            // Produto simples
            const est = await estRepoTx.findOne({ where: { id_produto: produto.id_produto } });
            if (est) {
              est.quantidade_atual += item.quantidade;
              await estRepoTx.save(est);
            }

            const mov = movRepoTx.create({
              id_produto: produto.id_produto,
              id_usuario: id_usuario || null,
              tipo: 'Entrada',
              quantidade: item.quantidade,
              motivo: `Estorno (Cancelamento) - Pedido #${pedido.codigo_pedido}`,
              data_movimentacao: agora,
            });
            await movRepoTx.save(mov);
          }
        }
      }

      pedido.status = novoStatus;
      if (novoStatusEntrega) {
        pedido.status_entrega = novoStatusEntrega;
        if (novoStatusEntrega === 'Entregue' && pedido.status === 'Confirmado') {
          pedido.status = 'Concluido';
        }
      }

      await pedRepoTx.save(pedido);
      await queryRunner.commitTransaction();

      return this.buscarPorId(id_pedido);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

