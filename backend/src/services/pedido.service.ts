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
  prazo_despacho?: Date | string;
}

export interface DadosDevolucaoDTO {
  motivo_devolucao: string;
  tipo_ocorrencia?: 'Cancelamento' | 'Devolucao' | 'Mediacao' | string;
  detalhe_devolucao?: string;
  protocolo_mediacao?: string;
}

export interface ParametrosCalculoLucroDTO {
  tipo_anuncio?: 'Classico' | 'Premium' | 'Direta' | string;
  custo_produtos?: number;
  aliquota_imposto_percentual?: number;
  custo_embalagem?: number;
  tarifa_ml_percentual?: number;
  custo_frete?: number;
  custo_ads?: number;
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

      // 3. Apuração financeira de Lucro Real inicial (SCRUM-23 / #18abc)
      let custoProdutos = 0;
      for (const [idProd, { produto, quantidade }] of baixasFisicas.entries()) {
        custoProdutos += Number(produto.custo || 0) * quantidade;
      }

      const origemPedido = dados.origem || 'Venda Direta';
      const isML = origemPedido === 'Mercado Livre';
      const tipoAnuncio = isML ? 'Classico' : 'Direta';
      const aliquotaImposto = 6.00;
      const custoImpostos = Number((valorTotal * (aliquotaImposto / 100)).toFixed(2));
      const custoEmbalagem = 5.00;
      const totalCustosFixos = Number((custoProdutos + custoImpostos + custoEmbalagem).toFixed(2));

      const tarifaMlPercentual = isML ? 12.00 : 0.00;
      const tarifaMlComissao = Number((valorTotal * (tarifaMlPercentual / 100)).toFixed(2));
      const tarifaMlFixa = isML && valorTotal < 79.00 ? 6.00 : 0.00;
      const custoFrete = isML && valorTotal >= 79.00 ? 26.00 : 0.00;
      const custoAds = 0.00;
      const totalTarifasPlataforma = Number((tarifaMlComissao + tarifaMlFixa + custoFrete + custoAds).toFixed(2));

      const lucroLiquido = Number((valorTotal - totalCustosFixos - totalTarifasPlataforma).toFixed(2));
      const margemLiquidaPercentual = valorTotal > 0 ? Number(((lucroLiquido / valorTotal) * 100).toFixed(2)) : 0.00;

      // 4. Salva o Pedido
      const prazoDespachoCalculado = dados.prazo_despacho
        ? new Date(dados.prazo_despacho)
        : new Date(agora.getTime() + 24 * 60 * 60 * 1000);

      const pedido = pedRepoTx.create({
        codigo_pedido: codigoPedido,
        cliente_nome: dados.cliente_nome.trim(),
        origem: origemPedido,
        status: 'Confirmado',
        valor_total: valorTotal,
        data_pedido: agora,
        prazo_despacho: prazoDespachoCalculado,
        data_despacho: null,
        exibir_na_entrega: dados.exibir_na_entrega ?? true,
        status_entrega: 'A separar',
        tipo_anuncio: tipoAnuncio,
        custo_produtos: Number(custoProdutos.toFixed(2)),
        aliquota_imposto_percentual: aliquotaImposto,
        custo_impostos: custoImpostos,
        custo_embalagem: custoEmbalagem,
        total_custos_fixos: totalCustosFixos,
        tarifa_ml_percentual: tarifaMlPercentual,
        tarifa_ml_comissao: tarifaMlComissao,
        tarifa_ml_fixa: tarifaMlFixa,
        custo_frete: custoFrete,
        custo_ads: custoAds,
        total_tarifas_plataforma: totalTarifasPlataforma,
        lucro_liquido: lucroLiquido,
        margem_liquida_percentual: margemLiquidaPercentual,
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
   * Atualiza status do pedido com estorno automático caso seja cancelado ou devolvido (SCRUM-22 / #11)
   */
  async atualizarStatus(
    id_pedido: number,
    novoStatus: 'Confirmado' | 'Concluido' | 'Cancelado',
    novoStatusEntrega?: 'A separar' | 'Pronto p/ despacho' | 'Despachado' | 'Entregue',
    id_usuario?: number,
    dadosDevolucao?: DadosDevolucaoDTO
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
        const rotuloOcorrencia = dadosDevolucao?.tipo_ocorrencia || 'Cancelamento';
        const motivoFormatado = dadosDevolucao?.motivo_devolucao
          ? `Estorno (${rotuloOcorrencia}: ${dadosDevolucao.motivo_devolucao}) - Pedido #${pedido.codigo_pedido}`
          : `Estorno (Cancelamento) - Pedido #${pedido.codigo_pedido}`;

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
                motivo: motivoFormatado,
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
              motivo: motivoFormatado,
              data_movimentacao: agora,
            });
            await movRepoTx.save(mov);
          }
        }
      }

      if (dadosDevolucao) {
        pedido.motivo_devolucao = dadosDevolucao.motivo_devolucao;
        pedido.tipo_ocorrencia = dadosDevolucao.tipo_ocorrencia || 'Cancelamento';
        pedido.detalhe_devolucao = dadosDevolucao.detalhe_devolucao || null;
        pedido.protocolo_mediacao = dadosDevolucao.protocolo_mediacao || null;
        pedido.data_devolucao = new Date();
      }

      pedido.status = novoStatus;
      if (novoStatusEntrega) {
        pedido.status_entrega = novoStatusEntrega;
        if ((novoStatusEntrega === 'Despachado' || novoStatusEntrega === 'Entregue') && !pedido.data_despacho) {
          pedido.data_despacho = new Date();
        }
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

  /**
   * Obtém estatísticas e padrões de devoluções/mediações/cancelamentos (SCRUM-22 / #11)
   */
  async obterEstatisticasDevolucoes() {
    const pedidosOcorrencias = await this.pedidoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.itens', 'i')
      .leftJoinAndSelect('i.produto', 'prod')
      .where('p.status = :cancelado OR p.motivo_devolucao IS NOT NULL', { cancelado: 'Cancelado' })
      .orderBy('p.data_devolucao', 'DESC')
      .addOrderBy('p.updated_at', 'DESC')
      .getMany();

    const motivosContagem: Record<string, number> = {};
    const ocorrenciasPorTipo: Record<string, number> = {
      Cancelamento: 0,
      Devolucao: 0,
      Mediacao: 0,
      Outro: 0,
    };

    const totalOcorrencias = pedidosOcorrencias.length;
    let totalComProtocolo = 0;

    for (const p of pedidosOcorrencias) {
      const motivo = p.motivo_devolucao || 'Outro / Não especificado';
      motivosContagem[motivo] = (motivosContagem[motivo] || 0) + 1;

      const tipo = (p.tipo_ocorrencia || 'Cancelamento') as string;
      if (ocorrenciasPorTipo[tipo] !== undefined) {
        ocorrenciasPorTipo[tipo]++;
      } else {
        ocorrenciasPorTipo['Outro'] = (ocorrenciasPorTipo['Outro'] || 0) + 1;
      }

      if (p.protocolo_mediacao) {
        totalComProtocolo++;
      }
    }

    const rankingMotivos = Object.entries(motivosContagem)
      .map(([motivo, total]) => ({
        motivo,
        total,
        percentual: totalOcorrencias > 0 ? Number(((total / totalOcorrencias) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      total_ocorrencias: totalOcorrencias,
      total_com_protocolo_ml: totalComProtocolo,
      por_tipo: ocorrenciasPorTipo,
      ranking_motivos: rankingMotivos,
      ultimas_ocorrencias: pedidosOcorrencias.slice(0, 15).map((p) => ({
        id_pedido: p.id_pedido,
        codigo_pedido: p.codigo_pedido,
        cliente_nome: p.cliente_nome,
        valor_total: Number(p.valor_total),
        tipo_ocorrencia: p.tipo_ocorrencia || 'Cancelamento',
        motivo_devolucao: p.motivo_devolucao || 'Não especificado',
        detalhe_devolucao: p.detalhe_devolucao,
        protocolo_mediacao: p.protocolo_mediacao,
        data_devolucao: p.data_devolucao || p.updated_at,
      })),
    };
  }

  /**
   * Consulta alertas de prazo de postagem/despacho (SCRUM-18 / #10)
   */
  async obterAlertasPostagem() {
    const agora = new Date();
    const pedidosPendentes = await this.pedidoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.itens', 'i')
      .leftJoinAndSelect('i.produto', 'prod')
      .where('p.status != :cancelado', { cancelado: 'Cancelado' })
      .andWhere('p.status_entrega NOT IN (:...concluidos)', {
        concluidos: ['Despachado', 'Entregue'],
      })
      .orderBy('p.prazo_despacho', 'ASC')
      .getMany();

    const hojeFim = new Date(agora);
    hojeFim.setHours(23, 59, 59, 999);

    let atrasadosCount = 0;
    let hojeCount = 0;
    let amanhaCount = 0;
    let noPrazoCount = 0;

    const listaFormatada = pedidosPendentes.map((ped) => {
      const prazo = ped.prazo_despacho
        ? new Date(ped.prazo_despacho)
        : new Date(new Date(ped.data_pedido).getTime() + 24 * 3600 * 1000);

      const diffMs = prazo.getTime() - agora.getTime();
      const diffHoras = Math.round(diffMs / (1000 * 60 * 60));
      const isAtrasado = diffMs < 0;
      const isHoje = !isAtrasado && prazo <= hojeFim;
      const isAmanha = !isAtrasado && !isHoje && diffHoras <= 48;

      let criticidade: 'atrasado' | 'hoje' | 'amanha' | 'no_prazo';
      let labelAlerta: string;

      if (isAtrasado) {
        atrasadosCount++;
        criticidade = 'atrasado';
        const horasAtraso = Math.abs(diffHoras);
        labelAlerta = horasAtraso >= 24
          ? `Atrasado há ${Math.floor(horasAtraso / 24)}d`
          : `Atrasado há ${horasAtraso}h`;
      } else if (isHoje) {
        hojeCount++;
        criticidade = 'hoje';
        labelAlerta = diffHoras <= 0 ? 'Vence agora' : `Vence em ${diffHoras}h`;
      } else if (isAmanha) {
        amanhaCount++;
        criticidade = 'amanha';
        labelAlerta = 'Vence amanhã';
      } else {
        noPrazoCount++;
        criticidade = 'no_prazo';
        labelAlerta = 'No prazo';
      }

      return {
        id_pedido: ped.id_pedido,
        codigo_pedido: ped.codigo_pedido,
        cliente_nome: ped.cliente_nome,
        origem: ped.origem,
        data_pedido: ped.data_pedido,
        prazo_despacho: prazo,
        status_entrega: ped.status_entrega,
        valor_total: ped.valor_total,
        itens_resumo: ped.itens?.map((i) => `${i.quantidade}x ${i.produto?.nome || 'Item'}`).join(', '),
        horas_restantes: diffHoras,
        criticidade,
        label_alerta: labelAlerta,
      };
    });

    return {
      resumo: {
        total_pendentes: pedidosPendentes.length,
        atrasados: atrasadosCount,
        vencem_hoje: hojeCount,
        vencem_amanha: amanhaCount,
        no_prazo: noPrazoCount,
        necessita_atencao: atrasadosCount + hojeCount,
      },
      pedidos: listaFormatada,
    };
  }

  /**
   * Apura o Lucro Real por Venda (SCRUM-23 / #18abc)
   * Decompõe receita bruta em custos fixos (#18a), tarifas e fretes (#18b), e apura lucro líquido real (#18c).
   */
  async calcularLucroPedido(id_pedido: number, params?: ParametrosCalculoLucroDTO) {
    const pedido = await this.pedidoRepo.findOne({
      where: { id_pedido },
      relations: ['itens', 'itens.produto'],
    });

    if (!pedido) {
      throw new Error(`Pedido #${id_pedido} não encontrado.`);
    }

    const valorTotal = Number(pedido.valor_total || 0);

    // 1. Custo dos Produtos (CMV): manual ou calculado a partir dos produtos/combos
    let custoProdutos = 0;
    if (params?.custo_produtos !== undefined) {
      custoProdutos = Number(params.custo_produtos);
    } else {
      for (const item of pedido.itens || []) {
        const prod = item.produto;
        if (prod?.tipo === 'Combo' && prod.combo_items && prod.combo_items.length > 0) {
          const prodRepo = AppDataSource.getRepository(Produto);
          let custoCombo = 0;
          for (const ci of prod.combo_items) {
            const comp = await prodRepo.findOne({ where: { id_produto: ci.id_produto } });
            custoCombo += Number(comp?.custo || 0) * ci.quantidade;
          }
          custoProdutos += custoCombo * item.quantidade;
        } else {
          custoProdutos += Number(prod?.custo || 0) * item.quantidade;
        }
      }
    }

    // 2. Custos Fixos / Diretos da Venda (#18a)
    const aliquotaImposto = params?.aliquota_imposto_percentual !== undefined
      ? Number(params.aliquota_imposto_percentual)
      : Number(pedido.aliquota_imposto_percentual || 6.00);

    const custoImpostos = Number((valorTotal * (aliquotaImposto / 100)).toFixed(2));

    const custoEmbalagem = params?.custo_embalagem !== undefined
      ? Number(params.custo_embalagem)
      : Number(pedido.custo_embalagem ?? 5.00);

    const totalCustosFixos = Number((custoProdutos + custoImpostos + custoEmbalagem).toFixed(2));

    // 3. Tarifas Variáveis do Mercado Livre e Frete (#18b)
    const tipoAnuncio = params?.tipo_anuncio || pedido.tipo_anuncio || (pedido.origem === 'Mercado Livre' ? 'Classico' : 'Direta');
    const isML = tipoAnuncio !== 'Direta';

    let defaultTarifaPercentual = 0.00;
    if (tipoAnuncio === 'Premium') {
      defaultTarifaPercentual = 17.00;
    } else if (tipoAnuncio === 'Classico') {
      defaultTarifaPercentual = 12.00;
    }

    const tarifaMlPercentual = params?.tarifa_ml_percentual !== undefined
      ? Number(params.tarifa_ml_percentual)
      : defaultTarifaPercentual;

    const tarifaMlComissao = Number((valorTotal * (tarifaMlPercentual / 100)).toFixed(2));

    // Taxa fixa do Mercado Livre para vendas < R$ 79,00
    const tarifaMlFixa = (isML && valorTotal < 79.00) ? 6.00 : 0.00;

    // Frete: para ML >= R$ 79,00, frete é subsidiado/pago pelo vendedor (média de R$ 26,00 para extintores)
    const defaultFrete = (isML && valorTotal >= 79.00) ? 26.00 : 0.00;
    const custoFrete = params?.custo_frete !== undefined
      ? Number(params.custo_frete)
      : (Number(pedido.custo_frete) > 0 ? Number(pedido.custo_frete) : defaultFrete);

    const custoAds = params?.custo_ads !== undefined
      ? Number(params.custo_ads)
      : Number(pedido.custo_ads || 0.00);

    const totalTarifasPlataforma = Number((tarifaMlComissao + tarifaMlFixa + custoFrete + custoAds).toFixed(2));

    // 4. Lucro Líquido Real e Margem (#18c)
    const lucroLiquido = Number((valorTotal - totalCustosFixos - totalTarifasPlataforma).toFixed(2));
    const margemLiquidaPercentual = valorTotal > 0
      ? Number(((lucroLiquido / valorTotal) * 100).toFixed(2))
      : 0.00;

    // 5. Persiste valores no Pedido
    pedido.tipo_anuncio = tipoAnuncio;
    pedido.custo_produtos = Number(custoProdutos.toFixed(2));
    pedido.aliquota_imposto_percentual = Number(aliquotaImposto.toFixed(2));
    pedido.custo_impostos = custoImpostos;
    pedido.custo_embalagem = Number(custoEmbalagem.toFixed(2));
    pedido.total_custos_fixos = totalCustosFixos;
    pedido.tarifa_ml_percentual = Number(tarifaMlPercentual.toFixed(2));
    pedido.tarifa_ml_comissao = tarifaMlComissao;
    pedido.tarifa_ml_fixa = tarifaMlFixa;
    pedido.custo_frete = Number(custoFrete.toFixed(2));
    pedido.custo_ads = Number(custoAds.toFixed(2));
    pedido.total_tarifas_plataforma = totalTarifasPlataforma;
    pedido.lucro_liquido = lucroLiquido;
    pedido.margem_liquida_percentual = margemLiquidaPercentual;

    await this.pedidoRepo.save(pedido);

    return {
      sucesso: true,
      id_pedido: pedido.id_pedido,
      codigo_pedido: pedido.codigo_pedido,
      cliente_nome: pedido.cliente_nome,
      origem: pedido.origem,
      data_pedido: pedido.data_pedido,
      valor_total: valorTotal,
      custos_fixos: {
        custo_produtos_cmv: Number(custoProdutos.toFixed(2)),
        aliquota_imposto_percentual: Number(aliquotaImposto.toFixed(2)),
        custo_impostos: custoImpostos,
        custo_embalagem: Number(custoEmbalagem.toFixed(2)),
        total_custos_fixos: totalCustosFixos,
      },
      tarifas_plataforma: {
        tipo_anuncio: tipoAnuncio,
        tarifa_ml_percentual: Number(tarifaMlPercentual.toFixed(2)),
        tarifa_ml_comissao: tarifaMlComissao,
        tarifa_ml_fixa: tarifaMlFixa,
        custo_frete: Number(custoFrete.toFixed(2)),
        custo_ads: Number(custoAds.toFixed(2)),
        total_tarifas_plataforma: totalTarifasPlataforma,
      },
      resultado: {
        lucro_liquido: lucroLiquido,
        margem_liquida_percentual: margemLiquidaPercentual,
        status_margem: lucroLiquido >= 0 ? (margemLiquidaPercentual >= 15 ? 'alta' : 'moderada') : 'prejuizo',
      },
    };
  }

  /**
   * Retorna resumo consolidado de lucro e margem de todas as vendas
   */
  async obterResumoFinanceiroLucro() {
    const pedidos = await this.pedidoRepo.find({
      where: [
        { status: 'Confirmado' },
        { status: 'Concluido' },
      ],
      relations: ['itens', 'itens.produto'],
    });

    let receitaTotal = 0;
    let cmvTotal = 0;
    let impostosTotal = 0;
    let embalagemTotal = 0;
    let custosFixosTotal = 0;
    let tarifasMlTotal = 0;
    let freteTotal = 0;
    let adsTotal = 0;
    let tarifasPlataformaTotal = 0;
    let lucroLiquidoTotal = 0;

    for (const p of pedidos) {
      // Se ainda não tiver sido calculado, apura
      if (!p.total_custos_fixos || Number(p.total_custos_fixos) === 0) {
        await this.calcularLucroPedido(p.id_pedido);
      }

      receitaTotal += Number(p.valor_total || 0);
      cmvTotal += Number(p.custo_produtos || 0);
      impostosTotal += Number(p.custo_impostos || 0);
      embalagemTotal += Number(p.custo_embalagem || 0);
      custosFixosTotal += Number(p.total_custos_fixos || 0);
      tarifasMlTotal += Number(p.tarifa_ml_comissao || 0) + Number(p.tarifa_ml_fixa || 0);
      freteTotal += Number(p.custo_frete || 0);
      adsTotal += Number(p.custo_ads || 0);
      tarifasPlataformaTotal += Number(p.total_tarifas_plataforma || 0);
      lucroLiquidoTotal += Number(p.lucro_liquido || 0);
    }

    const margemMedia = receitaTotal > 0
      ? Number(((lucroLiquidoTotal / receitaTotal) * 100).toFixed(2))
      : 0.00;

    return {
      sucesso: true,
      pedidos_analisados: pedidos.length,
      faturamento_bruto_total: Number(receitaTotal.toFixed(2)),
      custos_fixos: {
        total_cmv: Number(cmvTotal.toFixed(2)),
        total_impostos: Number(impostosTotal.toFixed(2)),
        total_embalagem: Number(embalagemTotal.toFixed(2)),
        total_custos_fixos: Number(custosFixosTotal.toFixed(2)),
      },
      tarifas_plataforma: {
        total_comissao_fixa_ml: Number(tarifasMlTotal.toFixed(2)),
        total_frete_vendedor: Number(freteTotal.toFixed(2)),
        total_ads: Number(adsTotal.toFixed(2)),
        total_taxas_plataforma: Number(tarifasPlataformaTotal.toFixed(2)),
      },
      resultado: {
        lucro_liquido_total: Number(lucroLiquidoTotal.toFixed(2)),
        margem_liquida_media: margemMedia,
      },
    };
  }
}

