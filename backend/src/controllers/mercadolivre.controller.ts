import { Request, Response } from 'express';
import { MercadoLivreService } from '../services/mercadolivre.service';

const mlService = new MercadoLivreService();

export class MercadoLivreController {
  /**
   * Retorna a URL para redirecionamento do gestor para o OAuth 2.0 do Mercado Livre
   */
  async getAuthUrl(req: Request, res: Response) {
    try {
      const state = req.query.state ? String(req.query.state) : undefined;
      const info = mlService.gerarUrlAutorizacao(state);
      return res.json({ sucesso: true, ...info });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  /**
   * Recebe o código do OAuth e conclui a troca por tokens seguros
   */
  async callback(req: Request, res: Response) {
    try {
      if (req.query.error) {
        const erroDesc = req.query.error_description || req.query.error;
        if (req.headers.accept?.includes('text/html')) {
          return res.redirect(`/anuncios.html?oauth_error=${encodeURIComponent(String(erroDesc))}`);
        }
        return res.status(400).json({
          sucesso: false,
          mensagem: `Autorização cancelada ou negada no Mercado Livre: ${erroDesc}`,
        });
      }

      const code = req.query.code ? String(req.query.code) : '';
      const id_usuario = req.usuario?.id_usuario || 1;

      const resultado = await mlService.processarCallback(code, id_usuario);

      if (req.headers.accept?.includes('text/html')) {
        return res.redirect('/anuncios.html?oauth=success');
      }

      return res.json(resultado);
    } catch (error: any) {
      if (req.headers.accept?.includes('text/html')) {
        return res.redirect(`/anuncios.html?oauth_error=${encodeURIComponent(error.message)}`);
      }
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  /**
   * Desconecta a conta do Mercado Livre
   */
  async desconectar(req: Request, res: Response) {
    try {
      const id_usuario = req.usuario?.id_usuario || 1;
      const resultado = await mlService.desconectar(id_usuario);
      return res.json(resultado);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  /**
   * Endpoint de Webhook Rápido (Push):
   * Responde 200 OK imediatamente e salva o evento para processamento assíncrono idempotente
   */
  async webhook(req: Request, res: Response) {
    // 1. Responde 200 OK imediatamente para evitar timeouts do Mercado Livre
    res.status(200).json({ received: true, timestamp: new Date().toISOString() });

    // 2. Enfileira o payload em segundo plano
    try {
      await mlService.enfileirarWebhook(req.body);
    } catch (err) {
      console.error('[Webhook ML] Erro ao enfileirar notificação:', err);
    }
  }

  /**
   * Consulta o status atual da conexão OAuth do gestor
   */
  async obterStatusConexao(req: Request, res: Response) {
    try {
      const id_usuario = req.usuario?.id_usuario || 1;
      const conexao = await mlService.obterConexao(id_usuario);

      return res.json({
        sucesso: true,
        status: conexao.status,
        ml_user_id: conexao.ml_user_id || null,
        expires_at: conexao.expires_at || null,
        ultima_atualizacao: conexao.updated_at,
        ...mlService.obterStatusSincronizacao(),
      });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  /**
   * Lista anúncios do Mercado Livre com verificação de divergências de estoque
   */
  async listarAnuncios(req: Request, res: Response) {
    try {
      const anuncios = await mlService.listarAnuncios();
      return res.json({ sucesso: true, anuncios });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  /**
   * Vincula um anúncio a um produto do catálogo interno
   */
  async vincularProduto(req: Request, res: Response) {
    try {
      const { id_anuncio, id_produto, quantidade_anunciada } = req.body;

      if (!id_anuncio || !id_produto) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'id_anuncio e id_produto são obrigatórios.',
        });
      }

      const resultado = await mlService.vincularAnuncioProduto(
        Number(id_anuncio),
        Number(id_produto),
        quantidade_anunciada ? Number(quantidade_anunciada) : 1
      );

      return res.json(resultado);
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  /**
   * Sincronização manual (Reconciliação preventiva)
   */
  async sincronizar(req: Request, res: Response) {
    try {
      const id_usuario = req.usuario?.id_usuario || 1;
      const resultado = await mlService.reconciliar(id_usuario);
      return res.json(resultado);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  /**
   * Consulta anúncios diretamente na API do Mercado Livre sob demanda (#27)
   */
  async consultarAnunciosSobDemanda(req: Request, res: Response) {
    try {
      const id_usuario = req.usuario?.id_usuario || 1;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 50;

      const resultado = await mlService.consultarAnunciosAPI(id_usuario, { page, limit });
      return res.json(resultado);
    } catch (error: any) {
      const status = error.message?.includes('Rate Limit') ? 429 : 502;
      return res.status(status).json({
        sucesso: false,
        mensagem: error.message || 'Falha ao consultar anúncios na API do Mercado Livre.',
      });
    }
  }

  /**
   * Sincroniza status dos anúncios via API do Mercado Livre (#29)
   */
  async sincronizarStatusAnuncios(req: Request, res: Response) {
    try {
      const id_usuario = req.usuario?.id_usuario || 1;
      const resultado = await mlService.sincronizarStatusAnuncios(id_usuario, req.body || {});
      return res.json(resultado);
    } catch (error: any) {
      const status = error.message?.includes('Rate Limit') ? 429 : 400;
      return res.status(status).json({
        sucesso: false,
        mensagem: error.message,
        ...mlService.obterStatusSincronizacao(),
      });
    }
  }

  /**
   * Obtém metadados de sincronização (última sincronização com sucesso e última falha)
   */
  async obterStatusSincronizacao(_req: Request, res: Response) {
    try {
      const status = mlService.obterStatusSincronizacao();
      return res.json({ sucesso: true, ...status });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }
}

