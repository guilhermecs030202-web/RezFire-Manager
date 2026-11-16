import { AppDataSource } from '../config/database';
import {
  LancamentoFinanceiro,
  TipoLancamento,
  ClassificacaoLancamento,
} from '../entities/LancamentoFinanceiro';
import { Between, FindOptionsWhere } from 'typeorm';

export interface CriarLancamentoDTO {
  descricao: string;
  valor: number;
  tipo: TipoLancamento;
  classificacao: ClassificacaoLancamento;
  categoria?: string;
  data_competencia: string | Date;
  comprovante_url?: string;
  observacoes?: string;
}

export interface FiltrosLancamentoDTO {
  classificacao?: ClassificacaoLancamento | 'todos';
  tipo?: TipoLancamento | 'todos';
  categoria?: string;
  data_inicio?: string;
  data_fim?: string;
  dias?: number;
}

export class LancamentoFinanceiroService {
  private lancamentoRepo = AppDataSource.getRepository(LancamentoFinanceiro);

  /**
   * Registra um novo lançamento financeiro com classificação explícita (Empresa ou Pessoal)
   */
  async criarLancamento(dados: CriarLancamentoDTO, id_usuario?: number): Promise<LancamentoFinanceiro> {
    if (!dados.descricao || dados.descricao.trim() === '') {
      throw new Error('A descrição do lançamento é obrigatória.');
    }

    const valorNum = Number(dados.valor);
    if (isNaN(valorNum) || valorNum <= 0) {
      throw new Error('O valor do lançamento deve ser maior que zero.');
    }

    if (!['Receita', 'Despesa'].includes(dados.tipo)) {
      throw new Error('O tipo do lançamento deve ser "Receita" ou "Despesa".');
    }

    if (!['Empresa', 'Pessoal'].includes(dados.classificacao)) {
      throw new Error('A classificação deve ser estritamente "Empresa" ou "Pessoal".');
    }

    if (!dados.data_competencia) {
      throw new Error('A data de competência é obrigatória.');
    }

    const dataCompetencia = new Date(dados.data_competencia);
    if (isNaN(dataCompetencia.getTime())) {
      throw new Error('Data de competência inválida.');
    }

    const novoLancamento = this.lancamentoRepo.create({
      descricao: dados.descricao.trim(),
      valor: valorNum,
      tipo: dados.tipo,
      classificacao: dados.classificacao,
      categoria: dados.categoria?.trim() || (dados.classificacao === 'Empresa' ? 'Operacional' : 'Despesa Pessoal'),
      data_competencia: dataCompetencia,
      comprovante_url: dados.comprovante_url?.trim() || null,
      observacoes: dados.observacoes?.trim() || null,
      id_usuario: id_usuario || null,
    });

    return await this.lancamentoRepo.save(novoLancamento);
  }

  /**
   * Lista lançamentos com filtros dinâmicos por classificação (Empresa x Pessoal) e tipo
   */
  async listarLancamentos(filtros: FiltrosLancamentoDTO = {}): Promise<LancamentoFinanceiro[]> {
    const where: FindOptionsWhere<LancamentoFinanceiro> = {};

    if (filtros.classificacao && filtros.classificacao !== 'todos') {
      where.classificacao = filtros.classificacao;
    }

    if (filtros.tipo && filtros.tipo !== 'todos') {
      where.tipo = filtros.tipo;
    }

    if (filtros.categoria && filtros.categoria !== 'todas') {
      where.categoria = filtros.categoria;
    }

    // Filtro de data
    if (filtros.data_inicio && filtros.data_fim) {
      where.data_competencia = Between(new Date(filtros.data_inicio), new Date(filtros.data_fim));
    } else if (filtros.dias) {
      const dataInicio = new Date(Date.now() - filtros.dias * 24 * 60 * 60 * 1000);
      where.data_competencia = Between(dataInicio, new Date());
    }

    return await this.lancamentoRepo.find({
      where,
      order: {
        data_competencia: 'DESC',
        id_lancamento: 'DESC',
      },
      relations: ['usuario'],
    });
  }

  async buscarPorId(id: number): Promise<LancamentoFinanceiro | null> {
    return await this.lancamentoRepo.findOne({
      where: { id_lancamento: id },
      relations: ['usuario'],
    });
  }

  async atualizarLancamento(id: number, dados: Partial<CriarLancamentoDTO>): Promise<LancamentoFinanceiro> {
    const lancamento = await this.buscarPorId(id);
    if (!lancamento) {
      throw new Error(`Lançamento financeiro #${id} não encontrado.`);
    }

    if (dados.descricao !== undefined) {
      if (!dados.descricao.trim()) throw new Error('A descrição não pode ser vazia.');
      lancamento.descricao = dados.descricao.trim();
    }

    if (dados.valor !== undefined) {
      const v = Number(dados.valor);
      if (isNaN(v) || v <= 0) throw new Error('Valor inválido.');
      lancamento.valor = v;
    }

    if (dados.tipo !== undefined) {
      if (!['Receita', 'Despesa'].includes(dados.tipo)) throw new Error('Tipo inválido.');
      lancamento.tipo = dados.tipo;
    }

    if (dados.classificacao !== undefined) {
      if (!['Empresa', 'Pessoal'].includes(dados.classificacao)) throw new Error('Classificação inválida.');
      lancamento.classificacao = dados.classificacao;
    }

    if (dados.categoria !== undefined) {
      lancamento.categoria = dados.categoria.trim();
    }

    if (dados.data_competencia !== undefined) {
      lancamento.data_competencia = new Date(dados.data_competencia);
    }

    if (dados.observacoes !== undefined) {
      lancamento.observacoes = dados.observacoes.trim() || null;
    }

    return await this.lancamentoRepo.save(lancamento);
  }

  async excluirLancamento(id: number): Promise<boolean> {
    const res = await this.lancamentoRepo.delete({ id_lancamento: id });
    return (res.affected || 0) > 0;
  }

  /**
   * SCRUM-29 · #25: Relatório Financeiro de Segregação Patrimonial (Empresa PJ x Pessoal PF)
   * Agrupa e compara receitas, despesas e saldos de cada esfera para planejamento fiscal e conformidade.
   */
  async obterRelatorioSegregacao(filtros: FiltrosLancamentoDTO = {}) {
    const lancamentos = await this.listarLancamentos(filtros);

    // Métricas da Empresa (PJ)
    const lancamentosEmpresa = lancamentos.filter((l) => l.classificacao === 'Empresa');
    const receitasEmpresa = lancamentosEmpresa
      .filter((l) => l.tipo === 'Receita')
      .reduce((sum, l) => sum + Number(l.valor), 0);
    const despesasEmpresa = lancamentosEmpresa
      .filter((l) => l.tipo === 'Despesa')
      .reduce((sum, l) => sum + Number(l.valor), 0);
    const saldoLiquidoEmpresa = receitasEmpresa - despesasEmpresa;

    // Retiradas e Pró-labore (transferência PJ para PF)
    const proLaboreRetiradas = lancamentosEmpresa
      .filter((l) => l.categoria.toLowerCase().includes('pró-labore') || l.categoria.toLowerCase().includes('retirada'))
      .reduce((sum, l) => sum + Number(l.valor), 0);

    // Métricas Pessoais (PF)
    const lancamentosPessoal = lancamentos.filter((l) => l.classificacao === 'Pessoal');
    const receitasPessoal = lancamentosPessoal
      .filter((l) => l.tipo === 'Receita')
      .reduce((sum, l) => sum + Number(l.valor), 0);
    const despesasPessoal = lancamentosPessoal
      .filter((l) => l.tipo === 'Despesa')
      .reduce((sum, l) => sum + Number(l.valor), 0);
    const saldoLiquidoPessoal = receitasPessoal - despesasPessoal;

    // Despesas por Categoria - Empresa
    const categoriasEmpresaMap: Record<string, number> = {};
    for (const l of lancamentosEmpresa.filter((x) => x.tipo === 'Despesa')) {
      const cat = l.categoria || 'Outros';
      categoriasEmpresaMap[cat] = (categoriasEmpresaMap[cat] || 0) + Number(l.valor);
    }
    const categoriasEmpresa = Object.entries(categoriasEmpresaMap).map(([categoria, valor]) => ({
      categoria,
      valor: Number(valor.toFixed(2)),
      percentual: despesasEmpresa > 0 ? Number(((valor / despesasEmpresa) * 100).toFixed(1)) : 0,
    }));

    // Despesas por Categoria - Pessoal
    const categoriasPessoalMap: Record<string, number> = {};
    for (const l of lancamentosPessoal.filter((x) => x.tipo === 'Despesa')) {
      const cat = l.categoria || 'Outros';
      categoriasPessoalMap[cat] = (categoriasPessoalMap[cat] || 0) + Number(l.valor);
    }
    const categoriasPessoal = Object.entries(categoriasPessoalMap).map(([categoria, valor]) => ({
      categoria,
      valor: Number(valor.toFixed(2)),
      percentual: despesasPessoal > 0 ? Number(((valor / despesasPessoal) * 100).toFixed(1)) : 0,
    }));

    const totalMovimentado = lancamentos.reduce((sum, l) => sum + Number(l.valor), 0);

    return {
      sucesso: true,
      periodo: {
        dias: filtros.dias || 30,
        data_inicio: filtros.data_inicio || null,
        data_fim: filtros.data_fim || null,
      },
      resumo_geral: {
        total_lancamentos: lancamentos.length,
        total_movimentado: Number(totalMovimentado.toFixed(2)),
        indice_segregacao_patrimonial: 100.0, // 100% dos lançamentos contam com tag de esfera definida
      },
      empresa: {
        total_lancamentos: lancamentosEmpresa.length,
        receitas: Number(receitasEmpresa.toFixed(2)),
        despesas: Number(despesasEmpresa.toFixed(2)),
        saldo: Number(saldoLiquidoEmpresa.toFixed(2)),
        saldo_liquido: Number(saldoLiquidoEmpresa.toFixed(2)),
        retiradas_pro_labore: Number(proLaboreRetiradas.toFixed(2)),
        categorias_despesas: categoriasEmpresa,
      },
      pessoal: {
        total_lancamentos: lancamentosPessoal.length,
        receitas: Number(receitasPessoal.toFixed(2)),
        despesas: Number(despesasPessoal.toFixed(2)),
        saldo: Number(saldoLiquidoPessoal.toFixed(2)),
        saldo_liquido: Number(saldoLiquidoPessoal.toFixed(2)),
        categorias_despesas: categoriasPessoal,
      },
      indicador_segregacao: {
        taxa_segregacao_pct: 100,
        status: 'Segregação Íntegra',
        risco_confusao: false,
        mensagem: 'Todos os lançamentos financeiros possuem classificação contábil definida entre Empresa (PJ) e Pessoal (PF), atendendo às exigências fiscais do Simples Nacional.',
      },
      lancamentos: lancamentos.map((l) => ({
        id_lancamento: l.id_lancamento,
        descricao: l.descricao,
        valor: Number(l.valor),
        tipo: l.tipo,
        classificacao: l.classificacao,
        categoria: l.categoria,
        data_competencia: l.data_competencia,
        comprovante_url: l.comprovante_url,
        observacoes: l.observacoes,
        usuario_responsavel: l.usuario?.nome || 'Gestor RezFire',
        created_at: l.created_at,
      })),
    };
  }
}
