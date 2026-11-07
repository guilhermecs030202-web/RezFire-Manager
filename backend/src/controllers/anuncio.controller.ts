import { Request, Response } from 'express';
import { AnuncioService } from '../services/anuncio.service';

const anuncioService = new AnuncioService();

export class AnuncioController {
  async listar(req: Request, res: Response) {
    try {
      const { status, busca, foi_recriado } = req.query;
      const anuncios = await anuncioService.listar({
        status: status ? String(status) : undefined,
        busca: busca ? String(busca) : undefined,
        foi_recriado: foi_recriado !== undefined ? foi_recriado === 'true' : undefined,
      });

      return res.json({ sucesso: true, anuncios });
    } catch (err: any) {
      return res.status(500).json({ sucesso: false, mensagem: err.message });
    }
  }

  async buscarPorId(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const anuncio = await anuncioService.buscarPorId(id);
      return res.json({ sucesso: true, anuncio });
    } catch (err: any) {
      return res.status(404).json({ sucesso: false, mensagem: err.message });
    }
  }

  async listarHistorico(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const historico = await anuncioService.listarHistorico(id);
      return res.json({ sucesso: true, historico });
    } catch (err: any) {
      return res.status(404).json({ sucesso: false, mensagem: err.message });
    }
  }

  async adicionarOcorrencia(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { tipo_evento, titulo, detalhe, autor, dados_anteriores, data_ocorrencia } = req.body;

      const ocorrencia = await anuncioService.adicionarOcorrencia(id, {
        tipo_evento,
        titulo,
        detalhe,
        autor,
        dados_anteriores,
        data_ocorrencia,
      });

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Ocorrência registrada no histórico cronológico do anúncio.',
        ocorrencia,
      });
    } catch (err: any) {
      return res.status(400).json({ sucesso: false, mensagem: err.message });
    }
  }

  async marcarRecriado(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const {
        id_anuncio_novo,
        ml_item_id_novo,
        motivo_exclusao,
        data_exclusao,
        data_recriacao,
        observacoes,
      } = req.body;

      const resultado = await anuncioService.marcarRecriado(id, {
        id_anuncio_novo: id_anuncio_novo ? Number(id_anuncio_novo) : undefined,
        ml_item_id_novo,
        motivo_exclusao,
        data_exclusao,
        data_recriacao,
        observacoes,
      });

      return res.json(resultado);
    } catch (err: any) {
      return res.status(400).json({ sucesso: false, mensagem: err.message });
    }
  }

  async listarRecriados(_req: Request, res: Response) {
    try {
      const relatorio = await anuncioService.listarRecriados();
      return res.json({ sucesso: true, ...relatorio });
    } catch (err: any) {
      return res.status(500).json({ sucesso: false, mensagem: err.message });
    }
  }
}
