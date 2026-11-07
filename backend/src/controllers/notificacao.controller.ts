import { Request, Response } from 'express';
import { NotificacaoService } from '../services/notificacao.service';

const notificacaoService = new NotificacaoService();

export class NotificacaoController {
  async listar(req: Request, res: Response) {
    try {
      const idUsuario = req.usuario?.id_usuario;
      if (!idUsuario) {
        return res.status(401).json({ sucesso: false, mensagem: 'Usuário não autenticado.' });
      }

      const limite = req.query.limite ? Number(req.query.limite) : 30;
      const resultado = await notificacaoService.listarNotificacoes(idUsuario, limite);

      return res.status(200).json({
        sucesso: true,
        ...resultado,
      });
    } catch (err: any) {
      console.error('Erro ao listar notificações:', err);
      return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro ao listar notificações.',
        erro: err.message,
      });
    }
  }

  async marcarComoLida(req: Request, res: Response) {
    try {
      const idUsuario = req.usuario?.id_usuario;
      const idNotificacao = Number(req.params.id);

      if (!idUsuario) {
        return res.status(401).json({ sucesso: false, mensagem: 'Usuário não autenticado.' });
      }

      const sucesso = await notificacaoService.marcarComoLida(idNotificacao, idUsuario);
      return res.status(200).json({
        sucesso,
        mensagem: sucesso ? 'Notificação marcada como lida.' : 'Notificação não encontrada.',
      });
    } catch (err: any) {
      return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro ao marcar notificação como lida.',
        erro: err.message,
      });
    }
  }

  async marcarTodasComoLidas(req: Request, res: Response) {
    try {
      const idUsuario = req.usuario?.id_usuario;
      if (!idUsuario) {
        return res.status(401).json({ sucesso: false, mensagem: 'Usuário não autenticado.' });
      }

      await notificacaoService.marcarTodasComoLidas(idUsuario);
      return res.status(200).json({
        sucesso: true,
        mensagem: 'Todas as notificações foram marcadas como lidas.',
      });
    } catch (err: any) {
      return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro ao marcar notificações.',
        erro: err.message,
      });
    }
  }
}
