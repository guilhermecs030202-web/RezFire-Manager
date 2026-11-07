import { Request, Response } from 'express';
import { RespostaPadraoService } from '../services/respostaPadrao.service';

const service = new RespostaPadraoService();

export class RespostaPadraoController {
  async listar(req: Request, res: Response) {
    try {
      const { busca, categoria, ativo } = req.query;
      const resultado = await service.listar({
        busca: busca ? String(busca) : undefined,
        categoria: categoria ? String(categoria) : undefined,
        ativo: ativo !== undefined ? ativo === 'true' : undefined,
      });
      return res.json(resultado);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async buscarPorId(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const resposta = await service.buscarPorId(id);
      return res.json({ sucesso: true, resposta });
    } catch (error: any) {
      return res.status(404).json({ sucesso: false, mensagem: error.message });
    }
  }

  async criar(req: Request, res: Response) {
    try {
      const { titulo, categoria, pergunta_exemplo, resposta, tags, ativo } = req.body;
      const nova = await service.criar({
        titulo,
        categoria,
        pergunta_exemplo,
        resposta,
        tags,
        ativo,
      });
      return res.status(201).json({
        sucesso: true,
        mensagem: 'Resposta padrão cadastrada com sucesso.',
        resposta: nova,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async atualizar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const atualizada = await service.atualizar(id, req.body);
      return res.json({
        sucesso: true,
        mensagem: 'Resposta padrão atualizada com sucesso.',
        resposta: atualizada,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async excluir(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await service.excluir(id);
      return res.json({
        sucesso: true,
        mensagem: 'Resposta padrão excluída com sucesso.',
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async incrementarUso(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const resultado = await service.incrementarUso(id);
      return res.json(resultado);
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }
}
