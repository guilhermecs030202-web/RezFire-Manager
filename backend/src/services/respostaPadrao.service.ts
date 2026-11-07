import { AppDataSource } from '../config/database';
import { RespostaPadrao } from '../entities/RespostaPadrao';

export interface CriarRespostaPadraoDTO {
  titulo: string;
  categoria?: string;
  pergunta_exemplo?: string;
  resposta: string;
  tags?: string;
  ativo?: boolean;
}

export interface AtualizarRespostaPadraoDTO {
  titulo?: string;
  categoria?: string;
  pergunta_exemplo?: string;
  resposta?: string;
  tags?: string;
  ativo?: boolean;
}

export class RespostaPadraoService {
  private get repo() {
    return AppDataSource.getRepository(RespostaPadrao);
  }

  /**
   * Lista respostas padrão com busca textual por palavra-chave e filtro de categoria
   * Atende aos Critérios 1 e 2 da User Story #22.
   */
  async listar(filtros?: { busca?: string; categoria?: string; ativo?: boolean }) {
    const qb = this.repo.createQueryBuilder('r').orderBy('r.vezes_utilizada', 'DESC').addOrderBy('r.titulo', 'ASC');

    if (filtros?.ativo !== undefined) {
      qb.andWhere('r.ativo = :ativo', { ativo: filtros.ativo });
    } else {
      qb.andWhere('r.ativo = :ativo', { ativo: true });
    }

    if (filtros?.categoria && filtros.categoria !== 'todos' && filtros.categoria !== 'Todas') {
      qb.andWhere('r.categoria = :categoria', { categoria: filtros.categoria });
    }

    if (filtros?.busca && filtros.busca.trim()) {
      const termo = `%${filtros.busca.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(r.titulo) LIKE :termo OR LOWER(r.pergunta_exemplo) LIKE :termo OR LOWER(r.resposta) LIKE :termo OR LOWER(r.tags) LIKE :termo)',
        { termo }
      );
    }

    const respostas = await qb.getMany();

    const categoriasDisponiveis = await this.repo
      .createQueryBuilder('r')
      .select('DISTINCT r.categoria', 'categoria')
      .where('r.ativo = :ativo', { ativo: true })
      .orderBy('r.categoria', 'ASC')
      .getRawMany();

    return {
      sucesso: true,
      total: respostas.length,
      categorias: categoriasDisponiveis.map((c) => c.categoria),
      respostas,
    };
  }

  /**
   * Busca resposta padrão por ID
   */
  async buscarPorId(id_resposta: number) {
    const resposta = await this.repo.findOne({ where: { id_resposta } });
    if (!resposta) {
      throw new Error(`Resposta padrão #${id_resposta} não encontrada.`);
    }
    return resposta;
  }

  /**
   * Cadastra nova resposta padrão
   * Atende ao Critério 1 da User Story #22.
   */
  async criar(dados: CriarRespostaPadraoDTO) {
    if (!dados.titulo || !dados.titulo.trim()) {
      throw new Error('O título da resposta padrão é obrigatório.');
    }
    if (!dados.resposta || !dados.resposta.trim()) {
      throw new Error('O conteúdo da resposta padrão é obrigatório.');
    }

    const novaResposta = this.repo.create({
      titulo: dados.titulo.trim(),
      categoria: dados.categoria?.trim() || 'Geral',
      pergunta_exemplo: dados.pergunta_exemplo ? dados.pergunta_exemplo.trim() : null,
      resposta: dados.resposta.trim(),
      tags: dados.tags ? dados.tags.trim() : null,
      ativo: dados.ativo ?? true,
      vezes_utilizada: 0,
    });

    return this.repo.save(novaResposta);
  }

  /**
   * Atualiza resposta padrão existente
   */
  async atualizar(id_resposta: number, dados: AtualizarRespostaPadraoDTO) {
    const resposta = await this.buscarPorId(id_resposta);

    if (dados.titulo !== undefined) resposta.titulo = dados.titulo.trim();
    if (dados.categoria !== undefined) resposta.categoria = dados.categoria.trim();
    if (dados.pergunta_exemplo !== undefined) resposta.pergunta_exemplo = dados.pergunta_exemplo ? dados.pergunta_exemplo.trim() : null;
    if (dados.resposta !== undefined) resposta.resposta = dados.resposta.trim();
    if (dados.tags !== undefined) resposta.tags = dados.tags ? dados.tags.trim() : null;
    if (dados.ativo !== undefined) resposta.ativo = dados.ativo;

    return this.repo.save(resposta);
  }

  /**
   * Exclui (ou inativa) resposta padrão
   */
  async excluir(id_resposta: number) {
    const resposta = await this.buscarPorId(id_resposta);
    await this.repo.remove(resposta);
    return true;
  }

  /**
   * Incrementa o contador de uso ao copiar/utilizar no atendimento (Critério 2)
   */
  async incrementarUso(id_resposta: number) {
    const resposta = await this.buscarPorId(id_resposta);
    resposta.vezes_utilizada = (resposta.vezes_utilizada || 0) + 1;
    await this.repo.save(resposta);
    return {
      sucesso: true,
      id_resposta: resposta.id_resposta,
      vezes_utilizada: resposta.vezes_utilizada,
      resposta: resposta.resposta,
    };
  }
}
