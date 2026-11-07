import { AppDataSource } from '../config/database';
import { AnuncioML, OcorrenciaAnuncio } from '../entities';

export interface CriarOcorrenciaDTO {
  tipo_evento: string;
  titulo: string;
  detalhe: string;
  autor?: string;
  dados_anteriores?: Record<string, any>;
  data_ocorrencia?: Date | string;
}

export interface MarcarRecriadoDTO {
  id_anuncio_novo?: number;
  ml_item_id_novo?: string;
  motivo_exclusao: string;
  data_exclusao: Date | string;
  data_recriacao: Date | string;
  observacoes?: string;
}

export class AnuncioService {
  private anuncioRepo = AppDataSource.getRepository(AnuncioML);
  private ocorrenciaRepo = AppDataSource.getRepository(OcorrenciaAnuncio);

  /**
   * Lista anúncios com suporte a filtros e ordenação
   */
  async listar(filtros?: { status?: string; foi_recriado?: boolean; busca?: string }) {
    const qb = this.anuncioRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.ocorrencias', 'o')
      .leftJoinAndSelect('a.produto_anuncios', 'pa')
      .leftJoinAndSelect('pa.produto', 'p');

    if (filtros?.status && filtros.status !== 'todos') {
      qb.andWhere('a.status = :status', { status: filtros.status });
    }

    if (filtros?.foi_recriado !== undefined) {
      qb.andWhere('a.foi_recriado = :foi_recriado', { foi_recriado: filtros.foi_recriado });
    }

    if (filtros?.busca) {
      qb.andWhere('(a.titulo LIKE :busca OR a.ml_item_id LIKE :busca)', {
        busca: `%${filtros.busca}%`,
      });
    }

    qb.orderBy('a.updated_at', 'DESC');
    return qb.getMany();
  }

  /**
   * Busca anúncio por ID com todo seu histórico cronológico (SCRUM-19 / #14)
   */
  async buscarPorId(id_anuncio: number) {
    const anuncio = await this.anuncioRepo.findOne({
      where: { id_anuncio },
      relations: ['ocorrencias', 'produto_anuncios', 'produto_anuncios.produto'],
      order: {
        ocorrencias: {
          data_ocorrencia: 'DESC',
        },
      },
    });

    if (!anuncio) {
      throw new Error(`Anúncio #${id_anuncio} não encontrado.`);
    }

    return anuncio;
  }

  /**
   * Retorna timeline cronológica de ocorrências do anúncio (SCRUM-19 / #14)
   */
  async listarHistorico(id_anuncio: number) {
    const anuncioExistente = await this.anuncioRepo.findOne({ where: { id_anuncio } });
    if (!anuncioExistente) {
      throw new Error(`Anúncio #${id_anuncio} não encontrado.`);
    }

    return this.ocorrenciaRepo.find({
      where: { id_anuncio },
      order: { data_ocorrencia: 'DESC' },
    });
  }

  /**
   * Registra uma nova ocorrência no histórico do anúncio (SCRUM-19 / #14)
   */
  async adicionarOcorrencia(id_anuncio: number, dados: CriarOcorrenciaDTO) {
    const anuncio = await this.anuncioRepo.findOne({ where: { id_anuncio } });
    if (!anuncio) {
      throw new Error(`Anúncio #${id_anuncio} não encontrado.`);
    }

    if (!dados.tipo_evento?.trim()) {
      throw new Error('O tipo de evento é obrigatório.');
    }
    if (!dados.titulo?.trim()) {
      throw new Error('O título da ocorrência é obrigatório.');
    }
    if (!dados.detalhe?.trim()) {
      throw new Error('O detalhamento da ocorrência é obrigatório.');
    }

    const dataOcorrencia = dados.data_ocorrencia
      ? new Date(dados.data_ocorrencia)
      : new Date();

    const ocorrencia = this.ocorrenciaRepo.create({
      id_anuncio,
      tipo_evento: dados.tipo_evento.trim(),
      titulo: dados.titulo.trim(),
      detalhe: dados.detalhe.trim(),
      autor: dados.autor?.trim() || 'Gestor RezFire',
      dados_anteriores: dados.dados_anteriores || null,
      data_ocorrencia: dataOcorrencia,
    });

    const salva = await this.ocorrenciaRepo.save(ocorrencia);
    return salva;
  }

  /**
   * Marca anúncio como excluído/recriado com cálculo do tempo de reposicionamento (SCRUM-20 / #15)
   */
  async marcarRecriado(id_anuncio_antigo: number, dados: MarcarRecriadoDTO) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const anuncioRepoTx = queryRunner.manager.getRepository(AnuncioML);
      const ocorrenciaRepoTx = queryRunner.manager.getRepository(OcorrenciaAnuncio);

      const antigo = await anuncioRepoTx.findOne({ where: { id_anuncio: id_anuncio_antigo } });
      if (!antigo) {
        throw new Error(`Anúncio antigo #${id_anuncio_antigo} não encontrado.`);
      }

      if (!dados.motivo_exclusao?.trim()) {
        throw new Error('O motivo da exclusão é obrigatório para registrar a recriação.');
      }

      const dExclusao = new Date(dados.data_exclusao || new Date());
      const dRecriacao = new Date(dados.data_recriacao || new Date());

      // Cálculo em dias do tempo de reposicionamento (tempo de perda)
      const diffMs = Math.max(0, dRecriacao.getTime() - dExclusao.getTime());
      const tempoDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Localiza anúncio novo se fornecido ID ou ml_item_id
      let novo: AnuncioML | null = null;
      if (dados.id_anuncio_novo) {
        novo = await anuncioRepoTx.findOne({ where: { id_anuncio: dados.id_anuncio_novo } });
      } else if (dados.ml_item_id_novo) {
        novo = await anuncioRepoTx.findOne({ where: { ml_item_id: dados.ml_item_id_novo.trim() } });
      }

      const mlItemIdNovo = dados.ml_item_id_novo?.trim() || novo?.ml_item_id || 'MLB-Novo-Pendente';

      // 1. Atualiza anúncio antigo
      antigo.foi_recriado = true;
      antigo.status = 'Excluído';
      antigo.motivo_exclusao = dados.motivo_exclusao.trim();
      antigo.data_exclusao = dExclusao;
      antigo.data_recriacao = dRecriacao;
      antigo.tempo_reposicionamento_dias = tempoDias;
      antigo.id_anuncio_substituto = novo ? novo.id_anuncio : null;
      antigo.ml_item_id_substituto = mlItemIdNovo;
      await anuncioRepoTx.save(antigo);

      // Registra ocorrência de histórico no anúncio antigo
      const ocAntigo = ocorrenciaRepoTx.create({
        id_anuncio: antigo.id_anuncio,
        tipo_evento: 'Exclusão e Recriação',
        titulo: 'Anúncio Excluído no ML e Substituído',
        detalhe: `Anúncio excluído pela moderação/robô do ML e recriado como [${mlItemIdNovo}]. Motivo: ${dados.motivo_exclusao}. Tempo de reposicionamento: ${tempoDias} dia(s).`,
        autor: 'Gestor RezFire',
        dados_anteriores: {
          ml_item_id_antigo: antigo.ml_item_id,
          ml_item_id_novo: mlItemIdNovo,
          tempo_reposicionamento_dias: tempoDias,
          data_exclusao: dExclusao.toISOString(),
          data_recriacao: dRecriacao.toISOString(),
        },
        data_ocorrencia: new Date(),
      });
      await ocorrenciaRepoTx.save(ocAntigo);

      // 2. Se o novo anúncio já existir no banco, vincula e registra herança histórica
      if (novo) {
        novo.id_anuncio_origem = antigo.id_anuncio;
        novo.ml_item_id_origem = antigo.ml_item_id;
        novo.data_recriacao = dRecriacao;
        novo.tempo_reposicionamento_dias = tempoDias;
        await anuncioRepoTx.save(novo);

        const ocNovo = ocorrenciaRepoTx.create({
          id_anuncio: novo.id_anuncio,
          tipo_evento: 'Sucessor de Anúncio Excluído',
          titulo: `Herdeiro do Anúncio Excluído [${antigo.ml_item_id}]`,
          detalhe: `Este anúncio foi criado do zero para substituir o anúncio histórico [${antigo.ml_item_id}], que foi excluído em ${dExclusao.toLocaleDateString('pt-BR')}. Motivo: ${dados.motivo_exclusao}.`,
          autor: 'Gestor RezFire',
          dados_anteriores: {
            ml_item_id_antigo: antigo.ml_item_id,
            tempo_reposicionamento_dias: tempoDias,
          },
          data_ocorrencia: new Date(),
        });
        await ocorrenciaRepoTx.save(ocNovo);
      }

      await queryRunner.commitTransaction();

      return {
        sucesso: true,
        mensagem: 'Anúncio marcado como excluído/recriado com histórico cronológico atualizado.',
        anuncio_antigo: antigo,
        anuncio_novo: novo,
        tempo_reposicionamento_dias: tempoDias,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Lista anúncios excluídos e recriados para relatório de reposicionamento (SCRUM-20 / #15)
   */
  async listarRecriados() {
    const anunciosRecriados = await this.anuncioRepo.find({
      where: { foi_recriado: true },
      relations: ['ocorrencias'],
      order: { data_recriacao: 'DESC' },
    });

    const totalRecriados = anunciosRecriados.length;
    const mediaTempoDias = totalRecriados > 0
      ? Number(
          (
            anunciosRecriados.reduce((acc, a) => acc + (a.tempo_reposicionamento_dias || 0), 0) /
            totalRecriados
          ).toFixed(1)
        )
      : 0;

    return {
      total_recriados: totalRecriados,
      media_tempo_reposicionamento_dias: mediaTempoDias,
      anuncios: anunciosRecriados.map((a) => ({
        id_anuncio: a.id_anuncio,
        ml_item_id_antigo: a.ml_item_id,
        ml_item_id_novo: a.ml_item_id_substituto,
        titulo: a.titulo,
        motivo_exclusao: a.motivo_exclusao,
        data_exclusao: a.data_exclusao,
        data_recriacao: a.data_recriacao,
        tempo_reposicionamento_dias: a.tempo_reposicionamento_dias,
        total_ocorrencias: (a.ocorrencias || []).length,
      })),
    };
  }
}
