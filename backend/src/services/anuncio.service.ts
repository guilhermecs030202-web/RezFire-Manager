import { AppDataSource } from '../config/database';
import {
  AnuncioML,
  OcorrenciaAnuncio,
  MidiaAnuncio,
  ProdutoAnuncio,
  Produto,
  ConexaoMercadoLivre,
} from '../entities';
import { NotificacaoService } from './notificacao.service';

export interface CriarAnuncioManualDTO {
  ml_item_id?: string;
  codigo_externo_ml?: string | null;
  titulo: string;
  preco: number;
  status?: 'Ativo' | 'Pausado' | 'Rebaixado' | 'Sob Revisão' | 'Excluído' | string;
  quantidade_disponivel?: number;
  quantidade_vendida?: number;
  visitas?: number;
  url?: string;
  id_produto?: number;
  quantidade_anunciada?: number;
  produtos_vinculados?: Array<{ id_produto: number; quantidade_anunciada?: number }>;
}

export interface AtualizarAnuncioManualDTO {
  ml_item_id?: string;
  codigo_externo_ml?: string | null;
  titulo?: string;
  preco?: number;
  status?: 'Ativo' | 'Pausado' | 'Rebaixado' | 'Sob Revisão' | 'Excluído' | string;
  quantidade_disponivel?: number;
  quantidade_vendida?: number;
  visitas?: number;
  url?: string;
  motivo_mudanca?: string;
  id_produto?: number;
  quantidade_anunciada?: number;
  produtos_vinculados?: Array<{ id_produto: number; quantidade_anunciada?: number }>;
}

export interface CriarMidiaDTO {
  tipo?: 'imagem' | 'video';
  rotulo: string;
  url: string;
  ordem?: number;
}

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
  private midiaRepo = AppDataSource.getRepository(MidiaAnuncio);
  private produtoAnuncioRepo = AppDataSource.getRepository(ProdutoAnuncio);
  private produtoRepo = AppDataSource.getRepository(Produto);
  private conexaoRepo = AppDataSource.getRepository(ConexaoMercadoLivre);
  private notificacaoService = new NotificacaoService();

  /**
   * Lista anúncios com suporte a filtros e ordenação
   */
  async listar(filtros?: {
    status?: string;
    foi_recriado?: boolean;
    origem_dado?: 'manual' | 'mercado_livre';
    busca?: string;
  }) {
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

    if (filtros?.origem_dado) {
      qb.andWhere('a.origem_dado = :origem_dado', { origem_dado: filtros.origem_dado });
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
      relations: ['ocorrencias', 'midias', 'produto_anuncios', 'produto_anuncios.produto'],
      order: {
        ocorrencias: {
          data_ocorrencia: 'DESC',
        },
        midias: {
          ordem: 'ASC',
          created_at: 'ASC',
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

  /**
   * Retorna todas as mídias (fotos e vídeos) de um anúncio (SCRUM-26 / #23)
   */
  async listarMidias(id_anuncio: number) {
    const anuncio = await this.anuncioRepo.findOne({ where: { id_anuncio } });
    if (!anuncio) {
      throw new Error(`Anúncio #${id_anuncio} não encontrado.`);
    }

    return this.midiaRepo.find({
      where: { id_anuncio },
      order: { ordem: 'ASC', created_at: 'ASC' },
    });
  }

  /**
   * Anexa uma nova foto ou vídeo ao anúncio (SCRUM-26 / #23)
   */
  async adicionarMidia(id_anuncio: number, dados: CriarMidiaDTO) {
    const anuncio = await this.anuncioRepo.findOne({ where: { id_anuncio } });
    if (!anuncio) {
      throw new Error(`Anúncio #${id_anuncio} não encontrado.`);
    }

    if (!dados.url?.trim()) {
      throw new Error('A URL da mídia (imagem ou vídeo) é obrigatória.');
    }
    if (!dados.rotulo?.trim()) {
      throw new Error('O rótulo/legenda da mídia é obrigatório.');
    }

    const tipo = dados.tipo || (dados.url.includes('youtube.com') || dados.url.includes('youtu.be') || dados.url.includes('vimeo.com') || dados.url.endsWith('.mp4') ? 'video' : 'imagem');

    const midia = this.midiaRepo.create({
      id_anuncio,
      tipo,
      rotulo: dados.rotulo.trim(),
      url: dados.url.trim(),
      ordem: Number(dados.ordem || 0),
    });

    const salva = await this.midiaRepo.save(midia);

    // Registra ocorrência de atualização visual no histórico do anúncio (SCRUM-19)
    await this.adicionarOcorrencia(id_anuncio, {
      tipo_evento: 'Atualização Visual',
      titulo: `${tipo === 'video' ? 'Vídeo Demonstrativo' : 'Foto'} Anexada`,
      detalhe: `${tipo === 'video' ? 'Vídeo' : 'Imagem'} "${dados.rotulo}" adicionada ao catálogo de mídia do anúncio.`,
      autor: 'Gestor RezFire',
    });

    return salva;
  }

  /**
   * Remove uma foto ou vídeo anexado ao anúncio (SCRUM-26 / #23)
   */
  async removerMidia(id_anuncio: number, id_midia: number) {
    const midia = await this.midiaRepo.findOne({ where: { id_midia, id_anuncio } });
    if (!midia) {
      throw new Error(`Mídia #${id_midia} não encontrada para o anúncio #${id_anuncio}.`);
    }

    await this.midiaRepo.remove(midia);

    // Registra no histórico do anúncio
    await this.adicionarOcorrencia(id_anuncio, {
      tipo_evento: 'Atualização Visual',
      titulo: 'Mídia Removida',
      detalhe: `${midia.tipo === 'video' ? 'Vídeo' : 'Foto'} "${midia.rotulo}" removida do anúncio.`,
      autor: 'Gestor RezFire',
    });

    return { sucesso: true, mensagem: 'Mídia removida com sucesso.' };
  }

  /**
   * Story #34 (Critérios 1, 2, 4): Cadastra um anúncio em modo manual sem exigir conta conectada ao ML.
   * Registra `origem_dado = 'manual'` e permite vincular produtos do catálogo para alertas (#13/#19).
   */
  async criarAnuncioManual(dados: CriarAnuncioManualDTO, id_usuario?: number) {
    const titulo = String(dados.titulo || '').trim();
    if (titulo.length < 3) {
      throw new Error('O título do anúncio é obrigatório (mínimo 3 caracteres).');
    }

    const preco = Number(dados.preco);
    if (!Number.isFinite(preco) || preco <= 0) {
      throw new Error('O preço do anúncio deve ser maior que zero.');
    }

    const codigoInformado = String(dados.ml_item_id || dados.codigo_externo_ml || '').trim();
    const mlItemId =
      codigoInformado.length > 0
        ? codigoInformado.toUpperCase()
        : `MAN-${Date.now().toString().slice(-8)}`;
    const codigoExternoMl = dados.codigo_externo_ml
      ? String(dados.codigo_externo_ml).trim().toUpperCase()
      : mlItemId.startsWith('MLB')
      ? mlItemId
      : null;

    const existente = await this.anuncioRepo.findOne({ where: { ml_item_id: mlItemId } });
    if (existente) {
      throw new Error(`Já existe um anúncio cadastrado com o código "${mlItemId}".`);
    }

    const conexaoExistente = id_usuario
      ? await this.conexaoRepo.findOne({ where: { id_usuario }, order: { id_conexao: 'DESC' } })
      : await this.conexaoRepo.findOne({ where: {}, order: { id_conexao: 'DESC' } });

    const statusInicial = dados.status?.trim() || 'Ativo';
    const qtdDisponivel = Math.max(0, Number(dados.quantidade_disponivel ?? 1));
    const qtdVendida = Math.max(0, Number(dados.quantidade_vendida ?? 0));
    const visitas = Math.max(0, Number(dados.visitas ?? 0));

    const novo = this.anuncioRepo.create({
      id_conexao: conexaoExistente ? conexaoExistente.id_conexao : null,
      ml_item_id: mlItemId,
      origem_dado: 'manual',
      codigo_externo_ml: codigoExternoMl,
      titulo,
      preco,
      status: statusInicial,
      quantidade_disponivel: qtdDisponivel,
      quantidade_vendida: qtdVendida,
      visitas,
      url: dados.url?.trim() || `https://produto.mercadolivre.com.br/${mlItemId}`,
      ultima_sincronizacao: null as any,
    });

    const salvo = await this.anuncioRepo.save(novo);

    // Vincula produtos se informados
    const listaVinculos: Array<{ id_produto: number; quantidade_anunciada: number }> = [];
    if (Array.isArray(dados.produtos_vinculados) && dados.produtos_vinculados.length > 0) {
      for (const pv of dados.produtos_vinculados) {
        if (pv.id_produto) {
          listaVinculos.push({
            id_produto: Number(pv.id_produto),
            quantidade_anunciada: Math.max(1, Number(pv.quantidade_anunciada || 1)),
          });
        }
      }
    } else if (dados.id_produto) {
      listaVinculos.push({
        id_produto: Number(dados.id_produto),
        quantidade_anunciada: Math.max(1, Number(dados.quantidade_anunciada || 1)),
      });
    }

    for (const v of listaVinculos) {
      const prod = await this.produtoRepo.findOne({ where: { id_produto: v.id_produto } });
      if (prod) {
        await this.produtoAnuncioRepo.save(
          this.produtoAnuncioRepo.create({
            id_anuncio: salvo.id_anuncio,
            id_produto: prod.id_produto,
            quantidade_anunciada: v.quantidade_anunciada,
          })
        );
      }
    }

    await this.adicionarOcorrencia(salvo.id_anuncio, {
      tipo_evento: 'Cadastro Manual',
      titulo: 'Anúncio cadastrado em modo manual',
      detalhe: `Anúncio [${mlItemId}] "${titulo}" cadastrado manualmente com status "${statusInicial}" e estoque anunciado de ${qtdDisponivel} un.`,
      autor: 'Gestor RezFire (Modo Manual)',
    });

    if (statusInicial === 'Pausado' || statusInicial === 'Rebaixado' || statusInicial === 'Sob Revisão') {
      await this.notificacaoService
        .notificarGestorMudancaStatusAnuncio({
          id_usuario,
          id_anuncio: salvo.id_anuncio,
          ml_item_id: salvo.ml_item_id,
          titulo: salvo.titulo,
          status_anterior: 'Ativo',
          novo_status: statusInicial,
          data_mudanca: new Date(),
        })
        .catch(() => null);
    }

    return this.buscarPorId(salvo.id_anuncio);
  }

  /**
   * Story #34 (Critério 2 & DoR 4): Atualiza dados e status de um anúncio em modo manual.
   * Quando o status muda (ex.: Ativo -> Pausado/Rebaixado), grava ocorrência no histórico (#14/#17)
   * e dispara notificação (#32), alimentando automaticamente os alertas (#13/#19).
   */
  async atualizarAnuncioManual(
    id_anuncio: number,
    dados: AtualizarAnuncioManualDTO,
    id_usuario?: number
  ) {
    const anuncio = await this.anuncioRepo.findOne({ where: { id_anuncio } });
    if (!anuncio) {
      throw new Error(`Anúncio #${id_anuncio} não encontrado.`);
    }

    const statusAnterior = anuncio.status;

    if (dados.titulo !== undefined) {
      const t = String(dados.titulo).trim();
      if (t.length < 3) throw new Error('O título do anúncio deve ter ao menos 3 caracteres.');
      anuncio.titulo = t;
    }

    if (dados.preco !== undefined) {
      const p = Number(dados.preco);
      if (!Number.isFinite(p) || p <= 0) throw new Error('O preço deve ser maior que zero.');
      anuncio.preco = p;
    }

    if (dados.quantidade_disponivel !== undefined) {
      anuncio.quantidade_disponivel = Math.max(0, Number(dados.quantidade_disponivel));
    }

    if (dados.quantidade_vendida !== undefined) {
      anuncio.quantidade_vendida = Math.max(0, Number(dados.quantidade_vendida));
    }

    if (dados.visitas !== undefined) {
      anuncio.visitas = Math.max(0, Number(dados.visitas));
    }

    if (dados.url !== undefined) {
      anuncio.url = String(dados.url).trim() || anuncio.url;
    }

    if (dados.codigo_externo_ml !== undefined) {
      const ext = dados.codigo_externo_ml ? String(dados.codigo_externo_ml).trim().toUpperCase() : null;
      anuncio.codigo_externo_ml = ext && ext.length > 0 ? ext : null;
    }

    if (dados.ml_item_id !== undefined) {
      const novoCodigo = String(dados.ml_item_id).trim().toUpperCase();
      if (novoCodigo && novoCodigo !== anuncio.ml_item_id) {
        const dup = await this.anuncioRepo.findOne({ where: { ml_item_id: novoCodigo } });
        if (dup && dup.id_anuncio !== id_anuncio) {
          throw new Error(`Código "${novoCodigo}" já pertence a outro anúncio.`);
        }
        anuncio.ml_item_id = novoCodigo;
        if (novoCodigo.startsWith('MLB') && !anuncio.codigo_externo_ml) {
          anuncio.codigo_externo_ml = novoCodigo;
        }
      }
    }

    let statusMudou = false;
    if (dados.status !== undefined && String(dados.status).trim()) {
      const novoStatus = String(dados.status).trim();
      if (novoStatus !== statusAnterior) {
        anuncio.status = novoStatus;
        statusMudou = true;
      }
    }

    await this.anuncioRepo.save(anuncio);

    // Atualiza vínculos de produto se informados
    if (Array.isArray(dados.produtos_vinculados)) {
      await this.produtoAnuncioRepo.delete({ id_anuncio });
      for (const pv of dados.produtos_vinculados) {
        if (!pv.id_produto) continue;
        const prod = await this.produtoRepo.findOne({ where: { id_produto: Number(pv.id_produto) } });
        if (prod) {
          await this.produtoAnuncioRepo.save(
            this.produtoAnuncioRepo.create({
              id_anuncio,
              id_produto: prod.id_produto,
              quantidade_anunciada: Math.max(1, Number(pv.quantidade_anunciada || 1)),
            })
          );
        }
      }
    } else if (dados.id_produto !== undefined && dados.id_produto) {
      const prod = await this.produtoRepo.findOne({ where: { id_produto: Number(dados.id_produto) } });
      if (prod) {
        await this.produtoAnuncioRepo.delete({ id_anuncio });
        await this.produtoAnuncioRepo.save(
          this.produtoAnuncioRepo.create({
            id_anuncio,
            id_produto: prod.id_produto,
            quantidade_anunciada: Math.max(1, Number(dados.quantidade_anunciada || 1)),
          })
        );
      }
    }

    if (statusMudou) {
      const motivoExtra = dados.motivo_mudanca ? ` Motivo: ${dados.motivo_mudanca}.` : '';
      await this.adicionarOcorrencia(id_anuncio, {
        tipo_evento: 'Mudança de Status',
        titulo: `Status alterado manualmente para ${anuncio.status}`,
        detalhe: `Status do anúncio [${anuncio.ml_item_id}] alterado de "${statusAnterior}" para "${anuncio.status}" em modo manual.${motivoExtra}`,
        autor: 'Gestor RezFire (Modo Manual)',
        dados_anteriores: {
          status_anterior: statusAnterior,
          status_novo: anuncio.status,
          modo: 'manual',
        },
      });

      if (
        anuncio.status === 'Pausado' ||
        anuncio.status === 'Rebaixado' ||
        anuncio.status === 'Sob Revisão'
      ) {
        await this.notificacaoService
          .notificarGestorMudancaStatusAnuncio({
            id_usuario,
            id_anuncio: anuncio.id_anuncio,
            ml_item_id: anuncio.ml_item_id,
            titulo: anuncio.titulo,
            status_anterior: statusAnterior,
            novo_status: anuncio.status,
            data_mudanca: new Date(),
          })
          .catch(() => null);
      }
    }

    return this.buscarPorId(id_anuncio);
  }
}

