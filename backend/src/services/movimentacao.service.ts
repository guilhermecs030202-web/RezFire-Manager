import { AppDataSource } from '../config/database';
import { MovimentacaoEstoque } from '../entities/MovimentacaoEstoque';
import { Estoque } from '../entities/Estoque';
import { Produto } from '../entities/Produto';
import { LoteEstoque } from '../entities/LoteEstoque';
import { InspecaoQualidade, ChecklistQualidadeEntrada } from '../entities/InspecaoQualidade';

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
  // Inspeção de qualidade na entrada (SCRUM-11 / #6)
  inspecao?: {
    checklist: ChecklistQualidadeEntrada;
    quantidade_reprovada?: number;
    motivo_reprovacao?: string;
    destino_reprovados?: 'Devolucao Fornecedor' | 'Descarte' | 'Quarentena';
    observacoes?: string;
    responsavel?: string;
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
        // Entrada com suporte a Inspeção de Qualidade (SCRUM-11 / #6)
        const inspecaoRepoTx = queryRunner.manager.getRepository(InspecaoQualidade);
        let qtdEfetivaEntrada = dados.quantidade;
        let inspecaoSalva: InspecaoQualidade | null = null;
        let idLotePrincipal: number | null = dados.id_lote || null;

        if (dados.inspecao) {
          const { checklist } = dados.inspecao;
          const todosConformes =
            checklist.avarias_casco &&
            checklist.sem_corrosao &&
            checklist.rotulo_legivel &&
            checklist.manometro_pressao &&
            checklist.lacre_acessorios;

          let qtdReprovada = Number(dados.inspecao.quantidade_reprovada || 0);
          if (!todosConformes && qtdReprovada <= 0) {
            qtdReprovada = dados.quantidade;
          }

          const qtdAprovada = Math.max(0, dados.quantidade - qtdReprovada);
          // Critério de Aceite 2: Item reprovado impede que entre no estoque disponível para venda
          qtdEfetivaEntrada = qtdAprovada;

          let resultado: 'Aprovado' | 'Reprovado' | 'Aprovado Parcial' = 'Aprovado';
          if (qtdAprovada === 0) {
            resultado = 'Reprovado';
          } else if (qtdReprovada > 0) {
            resultado = 'Aprovado Parcial';
          }

          // Atualiza saldo físico disponível apenas com as unidades aprovadas
          estoque.quantidade_atual += qtdEfetivaEntrada;

          // Gestão de lotes com controle de conformidade
          if (dados.id_lote) {
            const lote = await loteRepoTx.findOne({ where: { id_lote: dados.id_lote } });
            if (lote && qtdAprovada > 0) {
              lote.quantidade_disponivel += qtdAprovada;
              if (lote.status === 'Esgotado') {
                lote.status = 'Ativo';
              }
              await loteRepoTx.save(lote);
            }
          } else if (dados.novo_lote) {
            if (qtdAprovada > 0) {
              const loteCriado = loteRepoTx.create({
                id_produto: dados.id_produto,
                numero_lote: dados.novo_lote.numero_lote,
                numero_lacre_inmetro: dados.novo_lote.numero_lacre_inmetro,
                data_fabricacao: dados.novo_lote.data_fabricacao,
                data_validade: dados.novo_lote.data_validade,
                quantidade_disponivel: qtdAprovada,
                status: 'Ativo',
              });
              const saved = await loteRepoTx.save(loteCriado);
              idLotePrincipal = saved.id_lote;
            }

            // Se houver unidades reprovadas, registra lote bloqueado para segregação física
            if (qtdReprovada > 0) {
              const loteBloqueado = loteRepoTx.create({
                id_produto: dados.id_produto,
                numero_lote: `${dados.novo_lote.numero_lote}-BLOQ`,
                numero_lacre_inmetro: dados.novo_lote.numero_lacre_inmetro,
                data_fabricacao: dados.novo_lote.data_fabricacao,
                data_validade: dados.novo_lote.data_validade,
                quantidade_disponivel: qtdReprovada,
                status: 'Bloqueado',
              });
              const savedBloq = await loteRepoTx.save(loteBloqueado);
              if (!idLotePrincipal) idLotePrincipal = savedBloq.id_lote;
            }
          }

          // Cria registro de auditoria da Inspeção de Qualidade (Critérios 1 e 3)
          const novaInspecao = inspecaoRepoTx.create({
            id_produto: dados.id_produto,
            id_lote: idLotePrincipal,
            id_usuario: dados.id_usuario || null,
            tipo_inspecao: 'Entrada',
            checklist: dados.inspecao.checklist,
            resultado,
            quantidade_total: dados.quantidade,
            quantidade_aprovada: qtdAprovada,
            quantidade_reprovada: qtdReprovada,
            motivo_reprovacao:
              qtdReprovada > 0
                ? dados.inspecao.motivo_reprovacao || 'Reprovado no checklist físico de entrada'
                : null,
            destino_reprovados:
              qtdReprovada > 0
                ? dados.inspecao.destino_reprovados || 'Devolucao Fornecedor'
                : null,
            observacoes: dados.inspecao.observacoes || null,
            responsavel: dados.inspecao.responsavel || 'Gestor RezFire',
            data_inspecao: new Date(),
          });
          inspecaoSalva = await inspecaoRepoTx.save(novaInspecao);
        } else {
          // Entrada regular sem checklist específico
          estoque.quantidade_atual += dados.quantidade;

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

        // Define motivo descritivo da movimentação de entrada
        let motivoFinal = dados.motivo.trim();
        if (dados.inspecao && inspecaoSalva) {
          motivoFinal += ` [Inspeção: ${inspecaoSalva.resultado} - ${inspecaoSalva.quantidade_aprovada}/${inspecaoSalva.quantidade_total} un. liberadas p/ venda]`;
        }

        // Registra a movimentação obrigatória (Regra de Ouro) com a quantidade que realmente entrou
        const movimentacao = movRepoTx.create({
          id_produto: dados.id_produto,
          id_usuario: dados.id_usuario || null,
          tipo: 'Entrada',
          quantidade: qtdEfetivaEntrada,
          motivo: motivoFinal,
          data_movimentacao: new Date(),
        });
        const movimentacaoSalva = await movRepoTx.save(movimentacao);

        // Se houver inspeção salva, vincula a movimentação à inspeção
        if (inspecaoSalva) {
          inspecaoSalva.id_movimentacao = movimentacaoSalva.id_movimentacao;
          await inspecaoRepoTx.save(inspecaoSalva);
        }

        await queryRunner.commitTransaction();

        return {
          sucesso: true,
          mensagem: `Movimentação de entrada registrada com sucesso.${inspecaoSalva ? ` Inspeção de qualidade: ${inspecaoSalva.resultado}.` : ''}`,
          movimentacao: movimentacaoSalva,
          inspecao: inspecaoSalva,
          novo_saldo: estoque.quantidade_atual,
        };
      }
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

