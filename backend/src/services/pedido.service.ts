import { AppDataSource } from '../config/database';
import { Pedido } from '../entities/Pedido';
import { ItemPedido } from '../entities/ItemPedido';
import { Produto } from '../entities/Produto';
import { Estoque } from '../entities/Estoque';
import { LoteEstoque } from '../entities/LoteEstoque';
import { MovimentacaoEstoque } from '../entities/MovimentacaoEstoque';
import { NotaFiscal } from '../entities/NotaFiscal';
import {
  UFS_VALIDAS,
  limparDigitos,
  validarCep,
  validarCpfOuCnpj,
  validarInscricaoEstadual,
} from '../utils/fiscalValidator';

export interface CriarItemPedidoDTO {
  id_produto: number;
  quantidade: number;
  preco_unitario?: number;
}

export interface DadosDestinatarioDTO {
  cliente_nome?: string;
  destinatario_documento?: string | null;
  destinatario_ie?: string | null;
  destinatario_cep?: string | null;
  destinatario_logradouro?: string | null;
  destinatario_numero?: string | null;
  destinatario_complemento?: string | null;
  destinatario_bairro?: string | null;
  destinatario_municipio?: string | null;
  destinatario_codigo_municipio_ibge?: string | null;
  destinatario_uf?: string | null;
  destinatario_email?: string | null;
  valor_desconto?: number;
}

export interface CriarPedidoDTO extends DadosDestinatarioDTO {
  codigo_pedido?: string;
  cliente_nome: string;
  origem?: string;
  origem_dado?: 'manual' | 'mercado_livre';
  codigo_externo_ml?: string | null;
  baixar_estoque_agora?: boolean;
  itens: CriarItemPedidoDTO[];
  exibir_na_entrega?: boolean;
  prazo_despacho?: Date | string;
  modalidade_envio?: 'Tradicional' | 'Coleta' | 'Full' | 'Logística Própria' | string;
  prazo_dias_estimado?: number;
  data_entrega_efetiva?: Date | string;
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

  private get notaFiscalRepo() {
    return AppDataSource.getRepository(NotaFiscal);
  }

  private normalizarEValidarDestinatario(dados: DadosDestinatarioDTO) {
    const cleanOpt = (v: unknown) => {
      if (v === null || v === undefined) return null;
      const t = String(v).trim();
      return t.length > 0 ? t : null;
    };

    const docRaw = cleanOpt(dados.destinatario_documento);
    let docLimpo: string | null = null;
    if (docRaw !== null) {
      const check = validarCpfOuCnpj(docRaw);
      if (!check.valido) {
        throw new Error('CPF ou CNPJ do destinatário inválido.');
      }
      docLimpo = check.digitos;
    }

    const ieRaw = cleanOpt(dados.destinatario_ie);
    let ieNorm: string | null = null;
    if (ieRaw !== null) {
      const upper = ieRaw.toUpperCase();
      if (!validarInscricaoEstadual(upper)) {
        throw new Error('Inscrição Estadual do destinatário inválida.');
      }
      ieNorm = upper;
    }

    const cepRaw = cleanOpt(dados.destinatario_cep);
    let cepLimpo: string | null = null;
    if (cepRaw !== null) {
      const digits = limparDigitos(cepRaw);
      if (!validarCep(digits)) {
        throw new Error('CEP do destinatário inválido: informe 8 dígitos.');
      }
      cepLimpo = digits;
    }

    const ufRaw = cleanOpt(dados.destinatario_uf);
    let ufUpper: string | null = null;
    if (ufRaw !== null) {
      const u = ufRaw.toUpperCase();
      if (!(UFS_VALIDAS as readonly string[]).includes(u)) {
        throw new Error(`UF do destinatário inválida ("${ufRaw}").`);
      }
      ufUpper = u;
    }

    const ibgeRaw = cleanOpt(dados.destinatario_codigo_municipio_ibge);
    let ibgeLimpo: string | null = null;
    if (ibgeRaw !== null) {
      const digits = limparDigitos(ibgeRaw);
      if (digits.length !== 7) {
        throw new Error('Código IBGE do município do destinatário deve conter 7 dígitos.');
      }
      ibgeLimpo = digits;
    }

    return {
      destinatario_documento: docLimpo,
      destinatario_ie: ieNorm,
      destinatario_cep: cepLimpo,
      destinatario_logradouro: cleanOpt(dados.destinatario_logradouro),
      destinatario_numero: cleanOpt(dados.destinatario_numero),
      destinatario_complemento: cleanOpt(dados.destinatario_complemento),
      destinatario_bairro: cleanOpt(dados.destinatario_bairro),
      destinatario_municipio: cleanOpt(dados.destinatario_municipio),
      destinatario_codigo_municipio_ibge: ibgeLimpo,
      destinatario_uf: ufUpper,
      destinatario_email: cleanOpt(dados.destinatario_email),
    };
  }

  private async anexarResumoNotasFiscais(pedidos: Pedido[]) {
    if (!pedidos || pedidos.length === 0) return pedidos;
    try {
      const ids = pedidos.map((p) => p.id_pedido);
      const notas = await this.notaFiscalRepo
        .createQueryBuilder('nf')
        .select([
          'nf.id_nota_fiscal',
          'nf.id_pedido',
          'nf.status',
          'nf.ambiente',
          'nf.serie',
          'nf.numero',
          'nf.chave_acesso',
          'nf.protocolo_autorizacao',
          'nf.ultimo_codigo_sefaz',
          'nf.ultimo_motivo_sefaz',
          'nf.ultima_mensagem_amigavel',
          'nf.tentativas_envio',
          'nf.autorizada_em',
          'nf.codigo_pedido_snapshot',
          'nf.xml_autorizado_path',
          'nf.xml_autorizado_sha256',
          'nf.xml_arquivado_em',
          'nf.guarda_legal_ate',
          'nf.danfe_gerado_em',
          'nf.cancelada_em',
          'nf.protocolo_cancelamento',
          'nf.justificativa_cancelamento',
          'nf.total_cartas_correcao',
          'nf.ultima_carta_correcao_em',
          'nf.assinatura_valida',
          'nf.assinada_em',
          'nf.digest_value',
        ])
        .where('nf.id_pedido IN (:...ids)', { ids })
        .orderBy('nf.id_nota_fiscal', 'DESC')
        .getMany();

      const mapaPorPedido = new Map<number, NotaFiscal>();
      for (const nf of notas) {
        if (nf.id_pedido && !mapaPorPedido.has(nf.id_pedido)) {
          mapaPorPedido.set(nf.id_pedido, nf);
        }
      }

      return pedidos.map((p) => {
        const nf = mapaPorPedido.get(p.id_pedido) || null;
        return {
          ...p,
          status_fiscal: nf ? nf.status : 'sem_nota',
          nota_fiscal_resumo: nf,
        };
      });
    } catch {
      return pedidos.map((p) => ({
        ...p,
        status_fiscal: 'sem_nota',
        nota_fiscal_resumo: null,
      }));
    }
  }

  /**
   * Lista todos os pedidos com filtros
   */
  async listar(filtros: {
    status?: 'Confirmado' | 'Concluido' | 'Cancelado';
    status_entrega?: 'A separar' | 'Pronto p/ despacho' | 'Despachado' | 'Entregue';
    origem_dado?: 'manual' | 'mercado_livre';
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

    if (filtros.origem_dado) {
      qb.andWhere('p.origem_dado = :origem_dado', {
        origem_dado: filtros.origem_dado,
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

    const lista = await qb.getMany();
    return this.anexarResumoNotasFiscais(lista);
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

    const comResumo = await this.anexarResumoNotasFiscais([pedido]);
    return comResumo[0];
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
      const origemDado: 'manual' | 'mercado_livre' =
        dados.origem_dado === 'mercado_livre' ? 'mercado_livre' : 'manual';
      const codigoExternoRaw = dados.codigo_externo_ml
        ? String(dados.codigo_externo_ml).trim().replace(/^MLB-/i, '')
        : codigoPedido.toUpperCase().startsWith('MLB-')
        ? codigoPedido.slice(4)
        : null;
      const codigoExternoMl = codigoExternoRaw && codigoExternoRaw.length > 0 ? codigoExternoRaw : null;

      const pedidoExistente = await pedRepoTx.findOne({ where: { codigo_pedido: codigoPedido } });
      if (pedidoExistente) {
        throw new Error(`Código de pedido "${codigoPedido}" já cadastrado.`);
      }

      if (codigoExternoMl) {
        const conflitoExterno = await pedRepoTx
          .createQueryBuilder('p')
          .where('p.codigo_externo_ml = :ext OR p.codigo_pedido = :codMl', {
            ext: codigoExternoMl,
            codMl: `MLB-${codigoExternoMl}`,
          })
          .getOne();
        if (conflitoExterno) {
          throw new Error(
            `Já existe um pedido vinculado ao código Mercado Livre "${codigoExternoMl}" (${conflitoExterno.codigo_pedido}).`
          );
        }
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
      // Critério 6 da Story #34: verifica se a baixa deve ocorrer agora e se já não houve baixa manual prévia para o mesmo pedido
      const agora = new Date();
      const movPreviaPedido = await movRepoTx
        .createQueryBuilder('m')
        .where("m.tipo = 'Saída' AND m.motivo LIKE :motivoBusca", {
          motivoBusca: `%Pedido #${codigoPedido}%`,
        })
        .getOne();

      const deveBaixarEstoque = dados.baixar_estoque_agora !== false && !movPreviaPedido;
      const baixaEstoqueRealizada = deveBaixarEstoque || Boolean(movPreviaPedido);

      if (deveBaixarEstoque) {
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

      const modalidadeEnvio = dados.modalidade_envio || (isML ? 'Coleta' : 'Logística Própria');
      let prazoDias = dados.prazo_dias_estimado;
      if (!prazoDias) {
        if (modalidadeEnvio === 'Full') prazoDias = 1;
        else if (modalidadeEnvio === 'Coleta') prazoDias = 3;
        else if (modalidadeEnvio === 'Tradicional') prazoDias = 4;
        else prazoDias = 2;
      }

      let fretePadraoModalidade = 0.00;
      if (isML && valorTotal >= 79.00) {
        if (modalidadeEnvio === 'Full') fretePadraoModalidade = 22.00;
        else if (modalidadeEnvio === 'Coleta') fretePadraoModalidade = 26.00;
        else if (modalidadeEnvio === 'Tradicional') fretePadraoModalidade = 30.00;
        else fretePadraoModalidade = 18.00;
      }

      const tarifaMlPercentual = isML ? 12.00 : 0.00;
      const tarifaMlComissao = Number((valorTotal * (tarifaMlPercentual / 100)).toFixed(2));
      const tarifaMlFixa = isML && valorTotal < 79.00 ? 6.00 : 0.00;
      const custoFrete = fretePadraoModalidade;
      const custoAds = 0.00;
      const totalTarifasPlataforma = Number((tarifaMlComissao + tarifaMlFixa + custoFrete + custoAds).toFixed(2));

      const lucroLiquido = Number((valorTotal - totalCustosFixos - totalTarifasPlataforma).toFixed(2));
      const margemLiquidaPercentual = valorTotal > 0 ? Number(((lucroLiquido / valorTotal) * 100).toFixed(2)) : 0.00;

      const destNormalizado = this.normalizarEValidarDestinatario(dados);
      const valorDesconto = Math.max(0, Number(dados.valor_desconto || 0));
      valorTotal = Math.max(0, Number((valorTotal - valorDesconto).toFixed(2)));

      // 4. Salva o Pedido
      const prazoDespachoCalculado = dados.prazo_despacho
        ? new Date(dados.prazo_despacho)
        : new Date(agora.getTime() + 24 * 60 * 60 * 1000);

      const pedido = pedRepoTx.create({
        codigo_pedido: codigoPedido,
        cliente_nome: dados.cliente_nome.trim(),
        origem: origemPedido,
        origem_dado: origemDado,
        codigo_externo_ml: codigoExternoMl,
        baixa_estoque_realizada: baixaEstoqueRealizada,
        status: 'Confirmado',
        valor_total: valorTotal,
        valor_desconto: valorDesconto,
        data_pedido: agora,
        prazo_despacho: prazoDespachoCalculado,
        data_despacho: null,
        exibir_na_entrega: dados.exibir_na_entrega ?? true,
        status_entrega: 'A separar',
        modalidade_envio: modalidadeEnvio,
        prazo_dias_estimado: prazoDias,
        data_entrega_efetiva: dados.data_entrega_efetiva ? new Date(dados.data_entrega_efetiva) : null,
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
        ...destNormalizado,
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

      // Se estiver cancelando um pedido que estava Confirmado ou Concluído -> ESTORNO AUTOMÁTICO (apenas se a baixa já foi realizada)
      if (novoStatus === 'Cancelado' && pedido.status !== 'Cancelado' && pedido.baixa_estoque_realizada !== false) {
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
        pedido.baixa_estoque_realizada = false;
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

  /**
   * Atualiza a modalidade de envio de um pedido e recalcula frete/prazos (SCRUM-27 / #24)
   * Critério 1: É possível registrar a modalidade de envio de um pedido entre as opções disponíveis.
   */
  async atualizarModalidadeEnvio(
    id_pedido: number,
    dados: {
      modalidade_envio: string;
      prazo_dias_estimado?: number;
      custo_frete?: number;
      data_entrega_efetiva?: Date | string | null;
    }
  ) {
    const pedido = await this.buscarPorId(id_pedido);

    pedido.modalidade_envio = dados.modalidade_envio;

    if (dados.prazo_dias_estimado !== undefined) {
      pedido.prazo_dias_estimado = Number(dados.prazo_dias_estimado);
    } else {
      if (dados.modalidade_envio === 'Full') pedido.prazo_dias_estimado = 1;
      else if (dados.modalidade_envio === 'Coleta') pedido.prazo_dias_estimado = 3;
      else if (dados.modalidade_envio === 'Tradicional') pedido.prazo_dias_estimado = 4;
      else pedido.prazo_dias_estimado = 2;
    }

    if (dados.custo_frete !== undefined) {
      pedido.custo_frete = Number(dados.custo_frete);
    } else if (Number(pedido.valor_total) >= 79.00 && pedido.origem === 'Mercado Livre') {
      if (dados.modalidade_envio === 'Full') pedido.custo_frete = 22.00;
      else if (dados.modalidade_envio === 'Coleta') pedido.custo_frete = 26.00;
      else if (dados.modalidade_envio === 'Tradicional') pedido.custo_frete = 30.00;
      else pedido.custo_frete = 18.00;
    }

    if (dados.data_entrega_efetiva !== undefined) {
      pedido.data_entrega_efetiva = dados.data_entrega_efetiva ? new Date(dados.data_entrega_efetiva) : null;
    }

    // Recalcula totais financeiros
    pedido.total_tarifas_plataforma = Number(
      (Number(pedido.tarifa_ml_comissao || 0) + Number(pedido.tarifa_ml_fixa || 0) + Number(pedido.custo_frete || 0) + Number(pedido.custo_ads || 0)).toFixed(2)
    );
    pedido.lucro_liquido = Number(
      (Number(pedido.valor_total || 0) - Number(pedido.total_custos_fixos || 0) - Number(pedido.total_tarifas_plataforma || 0)).toFixed(2)
    );
    pedido.margem_liquida_percentual = Number(pedido.valor_total || 0) > 0
      ? Number(((pedido.lucro_liquido / Number(pedido.valor_total)) * 100).toFixed(2))
      : 0.00;

    await this.pedidoRepo.save(pedido);
    return pedido;
  }

  /**
   * Apura comparativo consolidado de custos, prazos e pontualidade por modalidade de envio (SCRUM-27 / #24)
   * Critério 2: Custos e prazos podem ser comparados por modalidade.
   */
  async obterComparativoModalidadesEnvio() {
    const pedidos = await this.pedidoRepo.find({
      order: { data_pedido: 'DESC' },
    });

    const modalidadesMap: Record<
      string,
      {
        modalidade: string;
        total_pedidos: number;
        faturamento_total: number;
        custo_frete_total: number;
        soma_prazos_dias: number;
        pedidos_no_prazo: number;
        pedidos_atrasados: number;
        lucro_liquido_total: number;
      }
    > = {
      Tradicional: {
        modalidade: 'Tradicional',
        total_pedidos: 0,
        faturamento_total: 0,
        custo_frete_total: 0,
        soma_prazos_dias: 0,
        pedidos_no_prazo: 0,
        pedidos_atrasados: 0,
        lucro_liquido_total: 0,
      },
      Coleta: {
        modalidade: 'Coleta',
        total_pedidos: 0,
        faturamento_total: 0,
        custo_frete_total: 0,
        soma_prazos_dias: 0,
        pedidos_no_prazo: 0,
        pedidos_atrasados: 0,
        lucro_liquido_total: 0,
      },
      Full: {
        modalidade: 'Full',
        total_pedidos: 0,
        faturamento_total: 0,
        custo_frete_total: 0,
        soma_prazos_dias: 0,
        pedidos_no_prazo: 0,
        pedidos_atrasados: 0,
        lucro_liquido_total: 0,
      },
      'Logística Própria': {
        modalidade: 'Logística Própria',
        total_pedidos: 0,
        faturamento_total: 0,
        custo_frete_total: 0,
        soma_prazos_dias: 0,
        pedidos_no_prazo: 0,
        pedidos_atrasados: 0,
        lucro_liquido_total: 0,
      },
    };

    const agora = new Date();

    for (const p of pedidos) {
      const mod = p.modalidade_envio || 'Coleta';
      if (!modalidadesMap[mod]) {
        modalidadesMap[mod] = {
          modalidade: mod,
          total_pedidos: 0,
          faturamento_total: 0,
          custo_frete_total: 0,
          soma_prazos_dias: 0,
          pedidos_no_prazo: 0,
          pedidos_atrasados: 0,
          lucro_liquido_total: 0,
        };
      }

      const item = modalidadesMap[mod];
      item.total_pedidos += 1;
      item.faturamento_total += Number(p.valor_total || 0);
      item.custo_frete_total += Number(p.custo_frete || 0);
      item.soma_prazos_dias += Number(p.prazo_dias_estimado || 3);
      item.lucro_liquido_total += Number(p.lucro_liquido || 0);

      // Avaliação de pontualidade
      if (p.data_despacho && p.prazo_despacho) {
        if (new Date(p.data_despacho) <= new Date(p.prazo_despacho)) {
          item.pedidos_no_prazo += 1;
        } else {
          item.pedidos_atrasados += 1;
        }
      } else if (p.prazo_despacho && new Date(p.prazo_despacho) < agora && p.status_entrega !== 'Entregue' && p.status_entrega !== 'Despachado') {
        item.pedidos_atrasados += 1;
      } else {
        item.pedidos_no_prazo += 1;
      }
    }

    const comparativo = Object.values(modalidadesMap).map((m) => {
      const custoFreteMedio = m.total_pedidos > 0 ? Number((m.custo_frete_total / m.total_pedidos).toFixed(2)) : 0.00;
      const prazoMedioDias = m.total_pedidos > 0 ? Number((m.soma_prazos_dias / m.total_pedidos).toFixed(1)) : 0.0;
      const taxaPontualidade = m.total_pedidos > 0
        ? Number(((m.pedidos_no_prazo / m.total_pedidos) * 100).toFixed(1))
        : 100.0;
      const margemMedia = m.faturamento_total > 0
        ? Number(((m.lucro_liquido_total / m.faturamento_total) * 100).toFixed(1))
        : 0.0;

      return {
        modalidade: m.modalidade,
        total_pedidos: m.total_pedidos,
        faturamento_total: Number(m.faturamento_total.toFixed(2)),
        custo_frete_total: Number(m.custo_frete_total.toFixed(2)),
        custo_frete_medio: custoFreteMedio,
        prazo_medio_dias: prazoMedioDias,
        pedidos_no_prazo: m.pedidos_no_prazo,
        pedidos_atrasados: m.pedidos_atrasados,
        taxa_pontualidade_percentual: taxaPontualidade,
        lucro_liquido_total: Number(m.lucro_liquido_total.toFixed(2)),
        margem_media_percentual: margemMedia,
      };
    });

    return {
      sucesso: true,
      total_pedidos_geral: pedidos.length,
      comparativo,
    };
  }

  /**
   * Atualiza os dados fiscais do destinatário vinculados a um pedido (Story 33c).
   */
  async atualizarDestinatario(id_pedido: number, dados: DadosDestinatarioDTO) {
    const pedido = await this.pedidoRepo.findOne({ where: { id_pedido } });
    if (!pedido) {
      throw new Error(`Pedido #${id_pedido} não encontrado.`);
    }

    const mesclado: DadosDestinatarioDTO = {
      destinatario_documento:
        dados.destinatario_documento !== undefined
          ? dados.destinatario_documento
          : pedido.destinatario_documento,
      destinatario_ie:
        dados.destinatario_ie !== undefined ? dados.destinatario_ie : pedido.destinatario_ie,
      destinatario_cep:
        dados.destinatario_cep !== undefined ? dados.destinatario_cep : pedido.destinatario_cep,
      destinatario_logradouro:
        dados.destinatario_logradouro !== undefined
          ? dados.destinatario_logradouro
          : pedido.destinatario_logradouro,
      destinatario_numero:
        dados.destinatario_numero !== undefined
          ? dados.destinatario_numero
          : pedido.destinatario_numero,
      destinatario_complemento:
        dados.destinatario_complemento !== undefined
          ? dados.destinatario_complemento
          : pedido.destinatario_complemento,
      destinatario_bairro:
        dados.destinatario_bairro !== undefined
          ? dados.destinatario_bairro
          : pedido.destinatario_bairro,
      destinatario_municipio:
        dados.destinatario_municipio !== undefined
          ? dados.destinatario_municipio
          : pedido.destinatario_municipio,
      destinatario_codigo_municipio_ibge:
        dados.destinatario_codigo_municipio_ibge !== undefined
          ? dados.destinatario_codigo_municipio_ibge
          : pedido.destinatario_codigo_municipio_ibge,
      destinatario_uf:
        dados.destinatario_uf !== undefined ? dados.destinatario_uf : pedido.destinatario_uf,
      destinatario_email:
        dados.destinatario_email !== undefined
          ? dados.destinatario_email
          : pedido.destinatario_email,
    };

    const destNorm = this.normalizarEValidarDestinatario(mesclado);

    if (dados.cliente_nome !== undefined) {
      const nome = String(dados.cliente_nome).trim();
      if (nome.length < 2) {
        throw new Error('Nome do destinatário deve ter ao menos 2 caracteres.');
      }
      pedido.cliente_nome = nome;
    }

    if (dados.valor_desconto !== undefined) {
      pedido.valor_desconto = Math.max(0, Number(dados.valor_desconto || 0));
    }

    Object.assign(pedido, destNorm);
    await this.pedidoRepo.save(pedido);

    return this.buscarPorId(id_pedido);
  }

  /**
   * Story #34 (Critério 2 & DoR 4): Atualiza dados cadastrais e operacionais de um pedido em modo manual
   * (cliente, canal/origem, código externo ML para conciliação, prazo de despacho, modalidade e destinatário).
   */
  async atualizarPedidoManual(
    id_pedido: number,
    dados: Partial<CriarPedidoDTO> & { status?: 'Confirmado' | 'Concluido' | 'Cancelado'; status_entrega?: 'A separar' | 'Pronto p/ despacho' | 'Despachado' | 'Entregue' },
    id_usuario?: number
  ) {
    const pedido = await this.pedidoRepo.findOne({
      where: { id_pedido },
      relations: ['itens', 'itens.produto'],
    });
    if (!pedido) {
      throw new Error(`Pedido #${id_pedido} não encontrado.`);
    }

    if (dados.cliente_nome !== undefined) {
      const nome = String(dados.cliente_nome).trim();
      if (nome.length < 2) {
        throw new Error('Nome do cliente deve ter ao menos 2 caracteres.');
      }
      pedido.cliente_nome = nome;
    }

    if (dados.origem !== undefined) {
      pedido.origem = String(dados.origem).trim() || pedido.origem;
    }

    if (dados.codigo_externo_ml !== undefined) {
      const extClean = dados.codigo_externo_ml
        ? String(dados.codigo_externo_ml).trim().replace(/^MLB-/i, '')
        : null;
      pedido.codigo_externo_ml = extClean && extClean.length > 0 ? extClean : null;
    }

    if (dados.prazo_despacho !== undefined) {
      pedido.prazo_despacho = dados.prazo_despacho ? new Date(dados.prazo_despacho) : null;
    }

    if (dados.modalidade_envio !== undefined && dados.modalidade_envio) {
      pedido.modalidade_envio = dados.modalidade_envio;
    }

    if (dados.prazo_dias_estimado !== undefined) {
      pedido.prazo_dias_estimado = Number(dados.prazo_dias_estimado || pedido.prazo_dias_estimado);
    }

    if (dados.valor_desconto !== undefined) {
      const subtotalItens = (pedido.itens || []).reduce(
        (acc, it) => acc + Number(it.subtotal || Number(it.preco_unitario) * Number(it.quantidade)),
        0
      );
      const novoDesconto = Math.max(0, Number(dados.valor_desconto || 0));
      pedido.valor_desconto = novoDesconto;
      pedido.valor_total = Math.max(0, Number((subtotalItens - novoDesconto).toFixed(2)));
    }

    const possuiCamposDest =
      dados.destinatario_documento !== undefined ||
      dados.destinatario_ie !== undefined ||
      dados.destinatario_cep !== undefined ||
      dados.destinatario_logradouro !== undefined ||
      dados.destinatario_numero !== undefined ||
      dados.destinatario_complemento !== undefined ||
      dados.destinatario_bairro !== undefined ||
      dados.destinatario_municipio !== undefined ||
      dados.destinatario_codigo_municipio_ibge !== undefined ||
      dados.destinatario_uf !== undefined ||
      dados.destinatario_email !== undefined;

    if (possuiCamposDest) {
      const destNorm = this.normalizarEValidarDestinatario({
        destinatario_documento:
          dados.destinatario_documento !== undefined
            ? dados.destinatario_documento
            : pedido.destinatario_documento,
        destinatario_ie:
          dados.destinatario_ie !== undefined ? dados.destinatario_ie : pedido.destinatario_ie,
        destinatario_cep:
          dados.destinatario_cep !== undefined ? dados.destinatario_cep : pedido.destinatario_cep,
        destinatario_logradouro:
          dados.destinatario_logradouro !== undefined
            ? dados.destinatario_logradouro
            : pedido.destinatario_logradouro,
        destinatario_numero:
          dados.destinatario_numero !== undefined
            ? dados.destinatario_numero
            : pedido.destinatario_numero,
        destinatario_complemento:
          dados.destinatario_complemento !== undefined
            ? dados.destinatario_complemento
            : pedido.destinatario_complemento,
        destinatario_bairro:
          dados.destinatario_bairro !== undefined
            ? dados.destinatario_bairro
            : pedido.destinatario_bairro,
        destinatario_municipio:
          dados.destinatario_municipio !== undefined
            ? dados.destinatario_municipio
            : pedido.destinatario_municipio,
        destinatario_codigo_municipio_ibge:
          dados.destinatario_codigo_municipio_ibge !== undefined
            ? dados.destinatario_codigo_municipio_ibge
            : pedido.destinatario_codigo_municipio_ibge,
        destinatario_uf:
          dados.destinatario_uf !== undefined ? dados.destinatario_uf : pedido.destinatario_uf,
        destinatario_email:
          dados.destinatario_email !== undefined
            ? dados.destinatario_email
            : pedido.destinatario_email,
      });
      Object.assign(pedido, destNorm);
    }

    await this.pedidoRepo.save(pedido);

    if (dados.status || dados.status_entrega) {
      return this.atualizarStatus(
        id_pedido,
        dados.status || pedido.status,
        dados.status_entrega,
        id_usuario
      );
    }

    return this.buscarPorId(id_pedido);
  }

  /**
   * Story #34 (Critério 6): Executa a baixa manual de estoque para um pedido manual criado
   * com baixa posterior (`baixa_estoque_realizada = false`), bloqueando estritamente qualquer
   * baixa em duplicidade.
   */
  async executarBaixaManualPedido(id_pedido: number, id_usuario?: number) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pedRepoTx = queryRunner.manager.getRepository(Pedido);
      const prodRepoTx = queryRunner.manager.getRepository(Produto);
      const estRepoTx = queryRunner.manager.getRepository(Estoque);
      const loteRepoTx = queryRunner.manager.getRepository(LoteEstoque);
      const movRepoTx = queryRunner.manager.getRepository(MovimentacaoEstoque);

      const pedido = await pedRepoTx.findOne({
        where: { id_pedido },
        relations: ['itens', 'itens.produto'],
      });

      if (!pedido) {
        throw new Error(`Pedido #${id_pedido} não encontrado.`);
      }

      if (pedido.status === 'Cancelado') {
        throw new Error('Não é permitido baixar estoque de um pedido cancelado.');
      }

      const movExistente = await movRepoTx
        .createQueryBuilder('m')
        .where("m.tipo = 'Saída' AND m.motivo LIKE :motivoBusca", {
          motivoBusca: `%Pedido #${pedido.codigo_pedido}%`,
        })
        .getOne();

      if (pedido.baixa_estoque_realizada || movExistente) {
        if (!pedido.baixa_estoque_realizada) {
          pedido.baixa_estoque_realizada = true;
          await pedRepoTx.save(pedido);
          await queryRunner.commitTransaction();
        }
        throw Object.assign(
          new Error(
            `A baixa de estoque do pedido #${pedido.codigo_pedido} já foi realizada anteriormente. Operação bloqueada para impedir baixa em duplicidade.`
          ),
          { statusCode: 409 }
        );
      }

      const agora = new Date();
      for (const item of pedido.itens || []) {
        const produto =
          item.produto || (await prodRepoTx.findOne({ where: { id_produto: item.id_produto } }));
        if (!produto) continue;

        const componentes =
          produto.tipo === 'Combo' && produto.combo_items && produto.combo_items.length > 0
            ? produto.combo_items.map((ci) => ({
                id_produto: ci.id_produto,
                quantidade: ci.quantidade * item.quantidade,
              }))
            : [{ id_produto: produto.id_produto, quantidade: item.quantidade }];

        for (const comp of componentes) {
          const estoque = await estRepoTx.findOne({ where: { id_produto: comp.id_produto } });
          if (!estoque || estoque.quantidade_atual < comp.quantidade) {
            throw new Error(
              `Saldo insuficiente para baixa manual do produto #${comp.id_produto}. Disponível: ${estoque?.quantidade_atual || 0}, Necessário: ${comp.quantidade}.`
            );
          }

          estoque.quantidade_atual -= comp.quantidade;
          await estRepoTx.save(estoque);

          const lotes = await loteRepoTx
            .createQueryBuilder('l')
            .where('l.id_produto = :idProd', { idProd: comp.id_produto })
            .andWhere('l.quantidade_disponivel > 0')
            .andWhere('l.status = :status', { status: 'Ativo' })
            .orderBy('l.data_validade', 'ASC')
            .getMany();

          let restante = comp.quantidade;
          for (const lote of lotes) {
            if (restante <= 0) break;
            const dias = Math.ceil(
              (new Date(lote.data_validade).getTime() - agora.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (dias <= 180) continue;
            const deb = Math.min(lote.quantidade_disponivel, restante);
            lote.quantidade_disponivel -= deb;
            if (lote.quantidade_disponivel === 0) lote.status = 'Esgotado';
            await loteRepoTx.save(lote);
            restante -= deb;
          }

          const mov = movRepoTx.create({
            id_produto: comp.id_produto,
            id_usuario: id_usuario || null,
            tipo: 'Saída',
            quantidade: comp.quantidade,
            motivo: `Baixa Manual - Pedido #${pedido.codigo_pedido}`,
            data_movimentacao: agora,
          });
          await movRepoTx.save(mov);
        }
      }

      pedido.baixa_estoque_realizada = true;
      await pedRepoTx.save(pedido);
      await queryRunner.commitTransaction();

      return this.buscarPorId(id_pedido);
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

