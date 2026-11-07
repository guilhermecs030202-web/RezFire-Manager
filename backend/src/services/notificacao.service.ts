import { AppDataSource } from '../config/database';
import { Notificacao } from '../entities/Notificacao';
import { Usuario } from '../entities/Usuario';

export interface ParametrosNotificacaoAnuncio {
  id_usuario?: number;
  id_anuncio: number;
  ml_item_id: string;
  titulo: string;
  status_anterior: string;
  novo_status: string; // 'Pausado' | 'Rebaixado' | 'Sob Revisão' | etc.
  data_mudanca?: Date;
}

export class NotificacaoService {
  private get notificacaoRepo() {
    return AppDataSource.getRepository(Notificacao);
  }

  private get usuarioRepo() {
    return AppDataSource.getRepository(Usuario);
  }

  /**
   * Notifica o gestor sobre mudança de status de anúncio (Pausado, Rebaixado, Sob Revisão)
   * Atende aos Critérios 1, 2 e 4 da User Story #32.
   */
  async notificarGestorMudancaStatusAnuncio(params: ParametrosNotificacaoAnuncio): Promise<Notificacao | null> {
    const dataMudanca = params.data_mudanca || new Date();
    const dataHoraFormatada = dataMudanca.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // 1. Identifica o usuário destinatário (Gestor Operacional)
    let idUsuario = params.id_usuario;
    let emailGestor = 'gestor@rezfire.com.br';
    let nomeGestor = 'Gestor RezFire';

    if (idUsuario) {
      const u = await this.usuarioRepo.findOne({ where: { id_usuario: idUsuario } });
      if (u) {
        emailGestor = u.email;
        nomeGestor = u.nome;
      }
    } else {
      const gestor = await this.usuarioRepo.findOne({ where: { perfil: 'GESTOR', ativo: true } });
      if (gestor) {
        idUsuario = gestor.id_usuario;
        emailGestor = gestor.email;
        nomeGestor = gestor.nome;
      } else {
        // Fallback para primeiro usuário caso não haja perfil configurado
        const primeiro = await this.usuarioRepo.findOne({ where: { ativo: true } });
        if (primeiro) {
          idUsuario = primeiro.id_usuario;
          emailGestor = primeiro.email;
          nomeGestor = primeiro.nome;
        }
      }
    }

    if (!idUsuario) {
      console.warn('Nenhum usuário gestor encontrado para despachar notificação.');
      return null;
    }

    // 2. Define criticidade e tipo com base no novo status
    const isRebaixado = params.novo_status.toLowerCase().includes('rebaixado') ||
                        params.novo_status.toLowerCase().includes('revis') ||
                        params.novo_status.toLowerCase().includes('under_review');
    const tipo = isRebaixado ? 'ANUNCIO_REBAIXADO' : 'ANUNCIO_PAUSADO';

    // 3. Regra Antirruído / Idempotência (Critério 4 da US #32):
    // Impede notificações duplicadas para a mesma mudança de status no mesmo anúncio
    const notificacaoExistente = await this.notificacaoRepo
      .createQueryBuilder('n')
      .where('n.id_usuario = :idUsuario', { idUsuario })
      .andWhere('n.tipo = :tipo', { tipo })
      .andWhere("JSON_UNQUOTE(JSON_EXTRACT(n.dados_origem, '$.ml_item_id')) = :mlItemId", { mlItemId: params.ml_item_id })
      .andWhere("JSON_UNQUOTE(JSON_EXTRACT(n.dados_origem, '$.novo_status')) = :novoStatus", { novoStatus: params.novo_status })
      .andWhere('n.created_at >= :limiteTempo', { limiteTempo: new Date(Date.now() - 2 * 60 * 60 * 1000) }) // 2 horas de janela antirruído
      .getOne();

    if (notificacaoExistente) {
      // Já foi emitida notificação para este anúncio e status recentemente — antirruído ativo
      return null;
    }

    // 4. Montagem da notificação completa com anúncio, novo status e data/hora (Critério 2 da US #32)
    const titulo = isRebaixado
      ? `🚨 Anúncio REBAIXADO no Mercado Livre: ${params.ml_item_id}`
      : `⚠️ Anúncio PAUSADO no Mercado Livre: ${params.ml_item_id}`;

    const mensagem = isRebaixado
      ? `O anúncio "${params.titulo}" [${params.ml_item_id}] foi REBAIXADO/SOB REVISÃO pela moderação do Mercado Livre em ${dataHoraFormatada} (Status anterior: "${params.status_anterior}"). Impacto: perda de exposição nos resultados de busca. Ação necessária: regularize pendências ou dados cadastrais.`
      : `O anúncio "${params.titulo}" [${params.ml_item_id}] teve seu status alterado de "${params.status_anterior}" para "${params.novo_status}" pelo Mercado Livre em ${dataHoraFormatada}. Impacto: vendas interrompidas no canal oficial. Ação necessária: verifique o estoque físico ou reative na plataforma.`;

    const notificacao = this.notificacaoRepo.create({
      id_usuario: idUsuario,
      tipo: tipo,
      canal: 'TODOS',
      titulo: titulo,
      mensagem: mensagem,
      link: 'anuncios.html',
      dados_origem: {
        id_anuncio: params.id_anuncio,
        ml_item_id: params.ml_item_id,
        titulo: params.titulo,
        status_anterior: params.status_anterior,
        novo_status: params.novo_status,
        data_mudanca: dataMudanca.toISOString(),
        data_hora_formatada: dataHoraFormatada,
        destinatario: {
          nome: nomeGestor,
          email: emailGestor,
        },
      },
      lida: false,
      enviado_email: true,
      created_at: new Date(),
    });

    await this.notificacaoRepo.save(notificacao);

    // 5. Simulação de Despacho de E-mail Corporativo (Critério 1 da US #32)
    console.log(`\n======================================================`);
    console.log(`📧 [EMAIL NOTIFICAÇÃO AO GESTOR - REZFIRE MANAGER]`);
    console.log(`Para: ${nomeGestor} <${emailGestor}>`);
    console.log(`Assunto: ${titulo}`);
    console.log(`Data/Hora: ${dataHoraFormatada}`);
    console.log(`Mensagem: ${mensagem}`);
    console.log(`Atalho: https://rezfire-manager.com.br/anuncios.html`);
    console.log(`======================================================\n`);

    return notificacao;
  }

  /**
   * Lista notificações do gestor
   */
  async listarNotificacoes(id_usuario: number, limite: number = 30) {
    const notificacoes = await this.notificacaoRepo.find({
      where: { id_usuario },
      order: { created_at: 'DESC' },
      take: limite,
    });

    const naoLidas = await this.notificacaoRepo.count({
      where: { id_usuario, lida: false },
    });

    return {
      total: notificacoes.length,
      nao_lidas: naoLidas,
      notificacoes,
    };
  }

  /**
   * Marca notificação como lida
   */
  async marcarComoLida(id_notificacao: number, id_usuario: number) {
    const notif = await this.notificacaoRepo.findOne({
      where: { id_notificacao, id_usuario },
    });
    if (!notif) return false;

    notif.lida = true;
    await this.notificacaoRepo.save(notif);
    return true;
  }

  /**
   * Marca todas como lidas
   */
  async marcarTodasComoLidas(id_usuario: number) {
    await this.notificacaoRepo.update({ id_usuario, lida: false }, { lida: true });
    return true;
  }
}
