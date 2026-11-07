import { AppDataSource } from '../config/database';
import {
  InspecaoQualidade,
  ChecklistQualidadeEntrada,
  ChecklistQualidadeSeparacao,
} from '../entities/InspecaoQualidade';
import { Produto } from '../entities/Produto';
import { LoteEstoque } from '../entities/LoteEstoque';

export interface RegistrarInspecaoDTO {
  id_produto: number;
  id_lote?: number | null;
  id_movimentacao?: number | null;
  id_pedido?: number | null;
  id_usuario?: number | null;
  tipo_inspecao?: 'Entrada' | 'Separacao';
  checklist: ChecklistQualidadeEntrada | ChecklistQualidadeSeparacao | Record<string, boolean>;
  quantidade_total: number;
  quantidade_reprovada?: number;
  motivo_reprovacao?: string;
  destino_reprovados?: 'Devolucao Fornecedor' | 'Descarte' | 'Quarentena';
  observacoes?: string;
  responsavel?: string;
}

export class InspecaoService {
  private get inspecaoRepo() {
    return AppDataSource.getRepository(InspecaoQualidade);
  }

  /**
   * Lista o histórico de inspeções com filtros
   */
  async listar(filtros: {
    id_produto?: number;
    id_pedido?: number;
    tipo_inspecao?: 'Entrada' | 'Separacao';
    resultado?: 'Aprovado' | 'Reprovado' | 'Aprovado Parcial';
    data_inicio?: string;
    data_fim?: string;
    limite?: number;
  }) {
    const qb = this.inspecaoRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.produto', 'p')
      .leftJoinAndSelect('i.lote', 'l')
      .leftJoinAndSelect('i.movimentacao', 'm')
      .leftJoinAndSelect('i.pedido', 'ped')
      .leftJoinAndSelect('i.usuario', 'u')
      .orderBy('i.data_inspecao', 'DESC');

    if (filtros.id_produto) {
      qb.andWhere('i.id_produto = :id_produto', { id_produto: filtros.id_produto });
    }

    if (filtros.id_pedido) {
      qb.andWhere('i.id_pedido = :id_pedido', { id_pedido: filtros.id_pedido });
    }

    if (filtros.tipo_inspecao) {
      qb.andWhere('i.tipo_inspecao = :tipo_inspecao', { tipo_inspecao: filtros.tipo_inspecao });
    }

    if (filtros.resultado) {
      qb.andWhere('i.resultado = :resultado', { resultado: filtros.resultado });
    }

    if (filtros.data_inicio) {
      qb.andWhere('i.data_inspecao >= :data_inicio', {
        data_inicio: new Date(filtros.data_inicio),
      });
    }

    if (filtros.data_fim) {
      qb.andWhere('i.data_inspecao <= :data_fim', {
        data_fim: new Date(filtros.data_fim),
      });
    }

    if (filtros.limite) {
      qb.take(filtros.limite);
    }

    return qb.getMany();
  }

  /**
   * Busca detalhes de uma inspeção por ID
   */
  async buscarPorId(id_inspecao: number) {
    const inspecao = await this.inspecaoRepo.findOne({
      where: { id_inspecao },
      relations: ['produto', 'lote', 'movimentacao', 'usuario'],
    });

    if (!inspecao) {
      throw new Error(`Inspeção de qualidade #${id_inspecao} não encontrada.`);
    }

    return inspecao;
  }

  /**
   * Retorna resumo e métricas consolidadas de conformidade de entrada
   */
  async obterResumo() {
    const total = await this.inspecaoRepo.count();
    const aprovadas = await this.inspecaoRepo.count({ where: { resultado: 'Aprovado' } });
    const parciais = await this.inspecaoRepo.count({ where: { resultado: 'Aprovado Parcial' } });
    const reprovadas = await this.inspecaoRepo.count({ where: { resultado: 'Reprovado' } });

    const somaUnidades = await this.inspecaoRepo
      .createQueryBuilder('i')
      .select('SUM(i.quantidade_total)', 'total_inspecionado')
      .addSelect('SUM(i.quantidade_aprovada)', 'total_aprovado')
      .addSelect('SUM(i.quantidade_reprovada)', 'total_reprovado')
      .getRawOne();

    const ultimas = await this.listar({ limite: 10 });

    const totalInspecionado = Number(somaUnidades?.total_inspecionado || 0);
    const totalAprovado = Number(somaUnidades?.total_aprovado || 0);
    const totalReprovado = Number(somaUnidades?.total_reprovado || 0);

    const taxaAprovacao = totalInspecionado > 0 ? (totalAprovado / totalInspecionado) * 100 : 100;

    return {
      total_inspecoes: total,
      distribuicao: {
        aprovadas,
        aprovadas_parcial: parciais,
        reprovadas,
      },
      unidades: {
        inspecionadas: totalInspecionado,
        aprovadas: totalAprovado,
        reprovadas_bloqueadas: totalReprovado,
      },
      taxa_conformidade_pct: Number(taxaAprovacao.toFixed(1)),
      ultimas_inspecoes: ultimas,
    };
  }

  /**
   * Busca as inspeções vinculadas a um pedido específico (SCRUM-12 / #7)
   */
  async buscarPorPedido(id_pedido: number) {
    return this.inspecaoRepo.find({
      where: { id_pedido },
      relations: ['produto', 'lote', 'usuario'],
      order: { data_inspecao: 'DESC' },
    });
  }

  /**
   * Registra uma inspeção de qualidade (Entrada ou Segunda Inspeção na Separação)
   */
  async registrar(dados: RegistrarInspecaoDTO) {
    const prodRepo = AppDataSource.getRepository(Produto);
    const produto = await prodRepo.findOne({ where: { id_produto: dados.id_produto } });
    if (!produto) {
      throw new Error(`Produto #${dados.id_produto} não localizado para inspeção.`);
    }

    const { checklist } = dados;
    const isSeparacao = dados.tipo_inspecao === 'Separacao';

    let todosConformes = false;
    if (isSeparacao) {
      const sep = checklist as ChecklistQualidadeSeparacao;
      todosConformes = Boolean(
        sep.lacre_inmetro_intacto &&
        sep.manometro_faixa_verde &&
        sep.sem_avarias_transporte &&
        sep.suporte_acessorios &&
        sep.rotulo_instrucoes
      );
    } else {
      const ent = checklist as ChecklistQualidadeEntrada;
      todosConformes = Boolean(
        ent.avarias_casco &&
        ent.sem_corrosao &&
        ent.rotulo_legivel &&
        ent.manometro_pressao &&
        ent.lacre_acessorios
      );
    }

    let qtdReprovada = Number(dados.quantidade_reprovada || 0);
    if (!todosConformes && qtdReprovada <= 0) {
      // Se algum item falhou e não especificou quantidade, reprova todo o lote
      qtdReprovada = dados.quantidade_total;
    }

    const qtdAprovada = Math.max(0, dados.quantidade_total - qtdReprovada);

    let resultado: 'Aprovado' | 'Reprovado' | 'Aprovado Parcial' = 'Aprovado';
    if (qtdAprovada === 0) {
      resultado = 'Reprovado';
    } else if (qtdReprovada > 0) {
      resultado = 'Aprovado Parcial';
    }

    const novaInspecao = this.inspecaoRepo.create({
      id_produto: dados.id_produto,
      id_lote: dados.id_lote || null,
      id_movimentacao: dados.id_movimentacao || null,
      id_pedido: dados.id_pedido || null,
      id_usuario: dados.id_usuario || null,
      tipo_inspecao: dados.tipo_inspecao || 'Entrada',
      checklist: dados.checklist,
      resultado,
      quantidade_total: dados.quantidade_total,
      quantidade_aprovada: qtdAprovada,
      quantidade_reprovada: qtdReprovada,
      motivo_reprovacao: qtdReprovada > 0 ? (dados.motivo_reprovacao || 'Não-conformidade detectada no checklist físico') : null,
      destino_reprovados: qtdReprovada > 0 ? (dados.destino_reprovados || (isSeparacao ? 'Quarentena' : 'Devolucao Fornecedor')) : null,
      observacoes: dados.observacoes || null,
      responsavel: dados.responsavel || 'Gestor RezFire',
      data_inspecao: new Date(),
    });

    return this.inspecaoRepo.save(novaInspecao);
  }
}

