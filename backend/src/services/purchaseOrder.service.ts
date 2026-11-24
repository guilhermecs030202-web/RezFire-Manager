import { z } from 'zod';
import { AppDataSource } from '../config/database';
import { PurchaseOrder, PurchaseOrderStatus } from '../entities/PurchaseOrder';
import { PurchaseOrderItem } from '../entities/PurchaseOrderItem';
import { Supplier } from '../entities/Supplier';
import { Produto } from '../entities/Produto';
import { Estoque } from '../entities/Estoque';
import { MovimentacaoEstoque } from '../entities/MovimentacaoEstoque';
import { LoteEstoque } from '../entities/LoteEstoque';
import { ProdutoFornecedor } from '../entities/ProdutoFornecedor';

// ── Esquemas de Validação (Zod) ─────────────────────────────────────────────

const itemCompraSchema = z.object({
  idProduto: z.number().int().positive('ID do produto inválido'),
  quantidadePedida: z.number().int().positive('A quantidade pedida deve ser maior que zero'),
  precoUnitario: z.number().min(0.01, 'O custo unitário deve ser maior que zero'),
});

export const criarPurchaseOrderSchema = z.object({
  idFornecedor: z.number().int().positive('Selecione um fornecedor válido'),
  dataEmissao: z.string().optional(),
  dataPrevisaoEntrega: z.string().min(1, 'A data de previsão de entrega é obrigatória'),
  condicoesPagamento: z.string().max(150).optional().nullable(),
  valorFrete: z.number().min(0, 'O frete não pode ser negativo').default(0),
  valorDesconto: z.number().min(0, 'O desconto não pode ser negativo').default(0),
  observacoes: z.string().optional().nullable(),
  status: z.enum(['RASCUNHO', 'ABERTO']).default('RASCUNHO'),
  itens: z
    .array(itemCompraSchema)
    .min(1, 'O pedido de compra deve conter ao menos 1 item')
    .refine(
      (items) => {
        const ids = items.map((i) => i.idProduto);
        return new Set(ids).size === ids.length;
      },
      { message: 'Não é permitido incluir o mesmo produto repetido no pedido de compra' }
    ),
});

export const atualizarPurchaseOrderSchema = z.object({
  idFornecedor: z.number().int().positive().optional(),
  dataEmissao: z.string().optional(),
  dataPrevisaoEntrega: z.string().optional(),
  condicoesPagamento: z.string().max(150).optional().nullable(),
  valorFrete: z.number().min(0).optional(),
  valorDesconto: z.number().min(0).optional(),
  observacoes: z.string().optional().nullable(),
  status: z.enum(['RASCUNHO', 'ABERTO']).optional(),
  itens: z.array(itemCompraSchema).optional(),
});

export const receberItemSchema = z.object({
  idItemCompra: z.number().int().positive('ID do item de compra inválido'),
  quantidadeRecebida: z.number().int().positive('A quantidade recebida deve ser maior que zero'),
  idLote: z.number().int().positive().optional(),
  novoLote: z
    .object({
      numero_lote: z.string().min(1, 'Número do lote obrigatório'),
      numero_lacre_inmetro: z.string().optional(),
      data_fabricacao: z.string().optional(),
      data_validade: z.string().min(1, 'Data de validade do lote obrigatória'),
    })
    .optional(),
});

export const receberPedidoSchema = z.object({
  dataRecebimento: z.string().optional(),
  itens: z.array(receberItemSchema).min(1, 'Informe ao menos um item para registrar o recebimento'),
});

export const cancelarPedidoSchema = z.object({
  motivo: z.string().min(3, 'O motivo do cancelamento é obrigatório (mínimo 3 caracteres)'),
});

export interface ListarPurchaseOrdersFiltros {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  supplierId?: number;
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export class PurchaseOrderService {
  private get poRepo() {
    return AppDataSource.getRepository(PurchaseOrder);
  }

  private get itemRepo() {
    return AppDataSource.getRepository(PurchaseOrderItem);
  }

  private get supplierRepo() {
    return AppDataSource.getRepository(Supplier);
  }

  /**
   * Gera o próximo número sequencial de pedido de compra (ex: PC-2026-0001)
   */
  async gerarProximoNumero(): Promise<string> {
    const anoAtual = new Date().getFullYear();
    const prefixo = `PC-${anoAtual}-`;

    const ultimo = await this.poRepo
      .createQueryBuilder('po')
      .where('po.numeroPedido LIKE :prefixo', { prefixo: `${prefixo}%` })
      .orderBy('po.id', 'DESC')
      .getOne();

    if (!ultimo || !ultimo.numeroPedido) {
      return `${prefixo}0001`;
    }

    const partes = ultimo.numeroPedido.split('-');
    const seq = parseInt(partes[partes.length - 1], 10);
    const proximo = isNaN(seq) ? 1 : seq + 1;
    return `${prefixo}${String(proximo).padStart(4, '0')}`;
  }

  /**
   * Lista pedidos de compra com paginação, busca e filtros no MySQL
   */
  async listar(filtros: ListarPurchaseOrdersFiltros) {
    const page = Math.max(1, filtros.page || 1);
    const limit = Math.max(1, Math.min(100, filtros.limit || 10));
    const offset = (page - 1) * limit;

    const qb = this.poRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 's')
      .leftJoinAndSelect('po.items', 'items')
      .leftJoinAndSelect('items.produto', 'p');

    // Filtro por texto (número do pedido ou fornecedor)
    if (filtros.search && filtros.search.trim()) {
      const termo = `%${filtros.search.trim()}%`;
      qb.andWhere('(po.numeroPedido LIKE :termo OR s.razaoSocial LIKE :termo OR s.nomeFantasia LIKE :termo)', {
        termo,
      });
    }

    // Filtro por fornecedor
    if (filtros.supplierId) {
      qb.andWhere('po.idFornecedor = :supplierId', { supplierId: filtros.supplierId });
    }

    // Filtro por período de emissão
    if (filtros.from) {
      qb.andWhere('po.dataEmissao >= :from', { from: new Date(`${filtros.from} 00:00:00`) });
    }
    if (filtros.to) {
      qb.andWhere('po.dataEmissao <= :to', { to: new Date(`${filtros.to} 23:59:59`) });
    }

    // Filtro por status
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (filtros.status && filtros.status !== 'ALL') {
      const st = filtros.status.toUpperCase();
      if (st === 'ATRASADO') {
        qb.andWhere('po.status IN (:...openStatus)', { openStatus: ['ABERTO', 'PARCIAL', 'Aberto', 'Parcial'] });
        qb.andWhere('po.dataPrevisaoEntrega < :hoje', { hoje });
      } else {
        qb.andWhere('(po.status = :st OR po.status = :stTitle)', {
          st,
          stTitle: st.charAt(0) + st.slice(1).toLowerCase(),
        });
      }
    }

    // Ordenação
    const allowedSort: Record<string, string> = {
      numero: 'po.numeroPedido',
      dataEmissao: 'po.dataEmissao',
      dataPrevisao: 'po.dataPrevisaoEntrega',
      valorTotal: 'po.valorTotal',
      status: 'po.status',
    };
    const sortCol = allowedSort[filtros.sortBy || 'dataEmissao'] || 'po.dataEmissao';
    const sortDir = filtros.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(sortCol, sortDir);
    qb.skip(offset).take(limit);

    const [pedidos, total] = await qb.getManyAndCount();

    // Adiciona flag computada de atraso
    const formatados = pedidos.map((po) => {
      const stNorm = String(po.status).toUpperCase();
      const previsao = new Date(po.dataPrevisaoEntrega);
      previsao.setHours(0, 0, 0, 0);
      const isAtrasado = (stNorm === 'ABERTO' || stNorm === 'PARCIAL') && previsao < hoje;

      return {
        id: po.id,
        numeroPedido: po.numeroPedido,
        idFornecedor: po.idFornecedor,
        fornecedor: {
          id: po.supplier?.id,
          razaoSocial: po.supplier?.razaoSocial,
          nomeFantasia: po.supplier?.nomeFantasia,
          cnpj: po.supplier?.cnpj,
          email: po.supplier?.email,
          telefone: po.supplier?.telefone,
        },
        dataEmissao: po.dataEmissao,
        dataPrevisaoEntrega: po.dataPrevisaoEntrega,
        dataRecebimento: po.dataRecebimento,
        condicoesPagamento: po.condicoesPagamento,
        status: stNorm,
        atrasado: isAtrasado,
        valorTotal: Number(po.valorTotal),
        valorFrete: Number(po.valorFrete),
        valorDesconto: Number(po.valorDesconto),
        observacoes: po.observacoes,
        motivoCancelamento: po.motivoCancelamento,
        totalItens: po.items?.length || 0,
        createdAt: po.createdAt,
        updatedAt: po.updatedAt,
      };
    });

    return {
      sucesso: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      data: formatados,
    };
  }

  /**
   * Busca detalhes completos do pedido de compra
   */
  async buscarPorId(id: number) {
    const po = await this.poRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 's')
      .leftJoinAndSelect('po.items', 'items')
      .leftJoinAndSelect('items.produto', 'p')
      .where('po.id = :id', { id })
      .getOne();

    if (!po) return null;

    const stNorm = String(po.status).toUpperCase();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const previsao = new Date(po.dataPrevisaoEntrega);
    previsao.setHours(0, 0, 0, 0);
    const isAtrasado = (stNorm === 'ABERTO' || stNorm === 'PARCIAL') && previsao < hoje;

    const itensFormatados = (po.items || []).map((i) => {
      const qtdPed = Number(i.quantidadePedida);
      const qtdEnt = Number(i.quantidadeEntregue);
      const preco = Number(i.precoUnitario);
      const subtotal = Number(i.subtotal);
      const pendente = Math.max(0, qtdPed - qtdEnt);

      return {
        id: i.id,
        idProduto: i.idProduto,
        produto: {
          id: i.produto?.id_produto,
          sku: i.produto?.sku,
          nome: i.produto?.nome,
        },
        quantidadePedida: qtdPed,
        quantidadeEntregue: qtdEnt,
        quantidadePendente: pendente,
        precoUnitario: preco,
        subtotal,
      };
    });

    return {
      id: po.id,
      numeroPedido: po.numeroPedido,
      idFornecedor: po.idFornecedor,
      fornecedor: {
        id: po.supplier?.id,
        razaoSocial: po.supplier?.razaoSocial,
        nomeFantasia: po.supplier?.nomeFantasia,
        cnpj: po.supplier?.cnpj,
        contatoNome: po.supplier?.contatoNome,
        telefone: po.supplier?.telefone,
        email: po.supplier?.email,
        cidade: po.supplier?.cidade,
        estado: po.supplier?.estado,
        condicoesPagamento: po.supplier?.condicoesPagamento,
        prazoPadraoDias: po.supplier?.prazoPadraoDias,
      },
      dataEmissao: po.dataEmissao,
      dataPrevisaoEntrega: po.dataPrevisaoEntrega,
      dataRecebimento: po.dataRecebimento,
      condicoesPagamento: po.condicoesPagamento,
      status: stNorm,
      atrasado: isAtrasado,
      valorTotal: Number(po.valorTotal),
      valorFrete: Number(po.valorFrete),
      valorDesconto: Number(po.valorDesconto),
      observacoes: po.observacoes,
      motivoCancelamento: po.motivoCancelamento,
      itens: itensFormatados,
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
    };
  }

  /**
   * Cria novo pedido de compra (Rascunho ou Aberto/Confirmado) com recálculo de totais
   */
  async criar(dadosBrutos: any) {
    const dados = criarPurchaseOrderSchema.parse(dadosBrutos);

    // Valida se fornecedor existe e está ativo
    const fornecedor = await this.supplierRepo.findOne({ where: { id: dados.idFornecedor } });
    if (!fornecedor) {
      throw new Error(`Fornecedor #${dados.idFornecedor} não encontrado.`);
    }
    if (!fornecedor.ativo) {
      throw new Error(`O fornecedor "${fornecedor.razaoSocial}" está inativo para novos pedidos.`);
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const poRepoTx = queryRunner.manager.getRepository(PurchaseOrder);
      const itemRepoTx = queryRunner.manager.getRepository(PurchaseOrderItem);
      const prodRepoTx = queryRunner.manager.getRepository(Produto);

      // Gera código do pedido
      const numeroPedido = await this.gerarProximoNumero();

      // Calcula subtotais e valida existência dos produtos
      let somaItens = 0;
      const itensParaSalvar: Partial<PurchaseOrderItem>[] = [];

      for (const item of dados.itens) {
        const prod = await prodRepoTx.findOne({ where: { id_produto: item.idProduto } });
        if (!prod) {
          throw new Error(`Produto #${item.idProduto} não encontrado.`);
        }

        const subtotal = Number((item.quantidadePedida * item.precoUnitario).toFixed(2));
        somaItens += subtotal;

        itensParaSalvar.push({
          idProduto: item.idProduto,
          quantidadePedida: item.quantidadePedida,
          quantidadeEntregue: 0,
          precoUnitario: item.precoUnitario,
          subtotal,
        });
      }

      const valorFrete = Number(dados.valorFrete || 0);
      const valorDesconto = Number(dados.valorDesconto || 0);
      const valorTotal = Number((somaItens + valorFrete - valorDesconto).toFixed(2));

      if (valorTotal < 0) {
        throw new Error('O valor total do pedido não pode ser negativo.');
      }

      const statusInicial: PurchaseOrderStatus = dados.status === 'ABERTO' ? 'ABERTO' : 'RASCUNHO';

      const novoPedido = poRepoTx.create({
        numeroPedido,
        idFornecedor: dados.idFornecedor,
        dataEmissao: dados.dataEmissao ? new Date(dados.dataEmissao) : new Date(),
        dataPrevisaoEntrega: new Date(dados.dataPrevisaoEntrega),
        condicoesPagamento: dados.condicoesPagamento || fornecedor.condicoesPagamento || null,
        valorFrete,
        valorDesconto,
        valorTotal,
        status: statusInicial,
        observacoes: dados.observacoes || null,
      });

      const pedidoSalvo = await poRepoTx.save(novoPedido);

      for (const item of itensParaSalvar) {
        item.idPedidoCompra = pedidoSalvo.id;
        const itemSalvo = itemRepoTx.create(item);
        await itemRepoTx.save(itemSalvo);
      }

      await queryRunner.commitTransaction();
      return this.buscarPorId(pedidoSalvo.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Atualiza pedido de compra existente
   * - Rascunho: edição livre de todos os campos e itens, ou transição para ABERTO.
   * - Aberto: permite apenas editar dataPrevisaoEntrega e observacoes.
   * - Parcial/Recebido/Cancelado: bloqueado para edição.
   */
  async atualizar(id: number, dadosBrutos: any) {
    const dados = atualizarPurchaseOrderSchema.parse(dadosBrutos);

    const poExistente = await this.poRepo.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!poExistente) {
      throw new Error(`Pedido de compra #${id} não encontrado.`);
    }

    const stNorm = String(poExistente.status).toUpperCase();

    if (stNorm === 'RECEBIDO' || stNorm === 'CANCELADO' || stNorm === 'PARCIAL') {
      throw new Error(`Pedidos com status "${stNorm}" não podem ser alterados.`);
    }

    // Se já estiver ABERTO, permite apenas alterar previsão de entrega e observações
    if (stNorm === 'ABERTO') {
      if (dados.dataPrevisaoEntrega) {
        poExistente.dataPrevisaoEntrega = new Date(dados.dataPrevisaoEntrega);
      }
      if (dados.observacoes !== undefined) {
        poExistente.observacoes = dados.observacoes;
      }
      await this.poRepo.save(poExistente);
      return this.buscarPorId(id);
    }

    // Caso RASCUNHO: permite edição completa
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const poRepoTx = queryRunner.manager.getRepository(PurchaseOrder);
      const itemRepoTx = queryRunner.manager.getRepository(PurchaseOrderItem);
      const prodRepoTx = queryRunner.manager.getRepository(Produto);

      if (dados.idFornecedor) {
        const fornecedor = await this.supplierRepo.findOne({ where: { id: dados.idFornecedor } });
        if (!fornecedor) throw new Error(`Fornecedor #${dados.idFornecedor} não encontrado.`);
        poExistente.idFornecedor = dados.idFornecedor;
      }

      if (dados.dataEmissao) poExistente.dataEmissao = new Date(dados.dataEmissao);
      if (dados.dataPrevisaoEntrega) poExistente.dataPrevisaoEntrega = new Date(dados.dataPrevisaoEntrega);
      if (dados.condicoesPagamento !== undefined) poExistente.condicoesPagamento = dados.condicoesPagamento;
      if (dados.observacoes !== undefined) poExistente.observacoes = dados.observacoes;
      if (dados.valorFrete !== undefined) poExistente.valorFrete = dados.valorFrete;
      if (dados.valorDesconto !== undefined) poExistente.valorDesconto = dados.valorDesconto;

      if (dados.status === 'ABERTO') {
        poExistente.status = 'ABERTO';
      }

      // Se novos itens foram enviados, substitui os anteriores
      if (dados.itens && dados.itens.length > 0) {
        await itemRepoTx.delete({ idPedidoCompra: id });

        let somaItens = 0;
        for (const item of dados.itens) {
          const prod = await prodRepoTx.findOne({ where: { id_produto: item.idProduto } });
          if (!prod) throw new Error(`Produto #${item.idProduto} não encontrado.`);

          const subtotal = Number((item.quantidadePedida * item.precoUnitario).toFixed(2));
          somaItens += subtotal;

          const novoItem = itemRepoTx.create({
            idPedidoCompra: id,
            idProduto: item.idProduto,
            quantidadePedida: item.quantidadePedida,
            quantidadeEntregue: 0,
            precoUnitario: item.precoUnitario,
            subtotal,
          });
          await itemRepoTx.save(novoItem);
        }

        const frete = Number(poExistente.valorFrete || 0);
        const desconto = Number(poExistente.valorDesconto || 0);
        poExistente.valorTotal = Number((somaItens + frete - desconto).toFixed(2));
      }

      await poRepoTx.save(poExistente);
      await queryRunner.commitTransaction();
      return this.buscarPorId(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Registra recebimento total ou parcial do pedido de compra de forma transacional:
   * 1. Atualiza quantidade entregue dos itens
   * 2. Dá entrada atômica no estoque do produto
   * 3. Registra movimentação de estoque (Regra de Ouro)
   * 4. Atualiza custo padrão de compra do fornecedor (produto_fornecedor)
   * 5. Atualiza status do pedido para PARCIAL ou RECEBIDO
   */
  async registrarRecebimento(id: number, dadosBrutos: any, idUsuario?: number | null) {
    const dados = receberPedidoSchema.parse(dadosBrutos);

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const poRepoTx = queryRunner.manager.getRepository(PurchaseOrder);
      const itemRepoTx = queryRunner.manager.getRepository(PurchaseOrderItem);
      const estRepoTx = queryRunner.manager.getRepository(Estoque);
      const movRepoTx = queryRunner.manager.getRepository(MovimentacaoEstoque);
      const loteRepoTx = queryRunner.manager.getRepository(LoteEstoque);
      const pfRepoTx = queryRunner.manager.getRepository(ProdutoFornecedor);

      const po = await poRepoTx.findOne({
        where: { id },
        relations: ['supplier', 'items'],
      });

      if (!po) {
        throw new Error(`Pedido de compra #${id} não encontrado.`);
      }

      const stNorm = String(po.status).toUpperCase();
      if (stNorm === 'RASCUNHO') {
        throw new Error('Não é possível receber mercadorias de um pedido em RASCUNHO. Confirme o pedido antes.');
      }
      if (stNorm === 'RECEBIDO') {
        throw new Error('Este pedido de compra já foi totalmente recebido.');
      }
      if (stNorm === 'CANCELADO') {
        throw new Error('Este pedido de compra está cancelado.');
      }

      const dataRecebimento = dados.dataRecebimento ? new Date(dados.dataRecebimento) : new Date();

      for (const recItem of dados.itens) {
        const itemPo = po.items.find((i) => i.id === recItem.idItemCompra);
        if (!itemPo) {
          throw new Error(`Item #${recItem.idItemCompra} não pertence a este pedido de compra.`);
        }

        const pendente = itemPo.quantidadePedida - itemPo.quantidadeEntregue;
        if (recItem.quantidadeRecebida > pendente) {
          throw new Error(
            `A quantidade recebida (${recItem.quantidadeRecebida}) não pode exceder o saldo pendente (${pendente}) para o produto #${itemPo.idProduto}.`
          );
        }

        // 1. Atualiza quantidade entregue no item
        itemPo.quantidadeEntregue += recItem.quantidadeRecebida;
        await itemRepoTx.save(itemPo);

        // 2. Atualiza saldo de estoque físico
        let estoque = await estRepoTx.findOne({ where: { id_produto: itemPo.idProduto } });
        if (!estoque) {
          estoque = estRepoTx.create({
            id_produto: itemPo.idProduto,
            quantidade_atual: 0,
            estoque_minimo: 0,
          });
        }
        estoque.quantidade_atual += recItem.quantidadeRecebida;
        await estRepoTx.save(estoque);

        // 3. Atualiza ou cria lote se informado
        if (recItem.idLote) {
          const lote = await loteRepoTx.findOne({ where: { id_lote: recItem.idLote } });
          if (lote) {
            lote.quantidade_disponivel += recItem.quantidadeRecebida;
            if (lote.status === 'Esgotado') lote.status = 'Ativo';
            await loteRepoTx.save(lote);
          }
        } else if (recItem.novoLote) {
          const novoLote = loteRepoTx.create({
            id_produto: itemPo.idProduto,
            numero_lote: recItem.novoLote.numero_lote,
            numero_lacre_inmetro: recItem.novoLote.numero_lacre_inmetro || undefined,
            data_fabricacao: recItem.novoLote.data_fabricacao ? new Date(recItem.novoLote.data_fabricacao) : undefined,
            data_validade: new Date(recItem.novoLote.data_validade),
            quantidade_disponivel: recItem.quantidadeRecebida,
            status: 'Ativo',
          });
          await loteRepoTx.save(novoLote);
        }

        // 4. Registra movimentação de estoque (Regra de Ouro)
        const fornNome = po.supplier?.razaoSocial || po.supplier?.nomeFantasia || 'Fornecedor';
        const mov = movRepoTx.create({
          id_produto: itemPo.idProduto,
          id_usuario: idUsuario || null,
          tipo: 'Entrada',
          quantidade: recItem.quantidadeRecebida,
          motivo: `Recebimento Pedido de Compra ${po.numeroPedido} — Fornecedor: ${fornNome}`,
          data_movimentacao: dataRecebimento,
        });
        await movRepoTx.save(mov);

        // 5. Atualiza custo padrão de compra do fornecedor com o valor negociado
        const vinculo = await pfRepoTx.findOne({
          where: { idFornecedor: po.idFornecedor, idProduto: itemPo.idProduto },
        });
        if (vinculo) {
          vinculo.custoCompra = itemPo.precoUnitario;
          await pfRepoTx.save(vinculo);
        } else {
          const novoVinculo = pfRepoTx.create({
            idFornecedor: po.idFornecedor,
            idProduto: itemPo.idProduto,
            custoCompra: itemPo.precoUnitario,
            principal: true,
          });
          await pfRepoTx.save(novoVinculo);
        }
      }

      // 6. Verifica se todos os itens foram totalmente entregues
      const todosEntregues = po.items.every((i) => i.quantidadeEntregue >= i.quantidadePedida);

      if (todosEntregues) {
        po.status = 'RECEBIDO';
        po.dataRecebimento = dataRecebimento;
      } else {
        po.status = 'PARCIAL';
        if (!po.dataRecebimento) {
          po.dataRecebimento = dataRecebimento;
        }
      }

      await poRepoTx.save(po);
      await queryRunner.commitTransaction();

      return this.buscarPorId(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cancela pedido de compra com justificativa obrigatória
   * Bloqueia estritamente se houver qualquer item recebido.
   */
  async cancelar(id: number, motivo: string) {
    cancelarPedidoSchema.parse({ motivo });

    const po = await this.poRepo.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!po) {
      throw new Error(`Pedido de compra #${id} não encontrado.`);
    }

    const stNorm = String(po.status).toUpperCase();
    if (stNorm === 'CANCELADO') {
      throw new Error('Este pedido de compra já está cancelado.');
    }

    if (stNorm === 'RECEBIDO') {
      throw new Error('Pedidos totalmente recebidos não podem ser cancelados.');
    }

    const temItensRecebidos = po.items.some((i) => Number(i.quantidadeEntregue) > 0);
    if (temItensRecebidos || stNorm === 'PARCIAL') {
      throw new Error(
        'Pedidos com itens já recebidos total ou parcialmente não podem ser cancelados. O estoque já foi movimentado.'
      );
    }

    po.status = 'CANCELADO';
    po.motivoCancelamento = motivo.trim();

    await this.poRepo.save(po);
    return this.buscarPorId(id);
  }
}
