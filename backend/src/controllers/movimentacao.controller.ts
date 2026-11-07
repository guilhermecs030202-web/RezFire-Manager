import { Request, Response } from 'express';
import { MovimentacaoService } from '../services/movimentacao.service';

const movService = new MovimentacaoService();

export class MovimentacaoController {
  async listar(req: Request, res: Response) {
    try {
      const { id_produto, tipo, data_inicio, data_fim, limite } = req.query;
      const movimentacoes = await movService.listar({
        id_produto: id_produto ? Number(id_produto) : undefined,
        tipo: tipo ? (String(tipo) as 'Entrada' | 'Saída') : undefined,
        data_inicio: data_inicio ? String(data_inicio) : undefined,
        data_fim: data_fim ? String(data_fim) : undefined,
        limite: limite ? Number(limite) : 100,
      });

      return res.json({ sucesso: true, movimentacoes });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async registrar(req: Request, res: Response) {
    try {
      const { id_produto, tipo, quantidade, motivo, id_lote, novo_lote, inspecao } = req.body;
      const id_usuario = req.usuario?.id_usuario;

      if (!id_produto || !tipo || !quantidade || !motivo) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'id_produto, tipo, quantidade e motivo são campos obrigatórios.',
        });
      }

      const resultado = await movService.registrar({
        id_produto: Number(id_produto),
        id_usuario,
        tipo,
        quantidade: Number(quantidade),
        motivo: String(motivo),
        id_lote: id_lote ? Number(id_lote) : undefined,
        novo_lote,
        inspecao,
      });

      return res.status(201).json(resultado);
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async ajustarInventario(req: Request, res: Response) {
    try {
      const { id_produto, quantidade_contada } = req.body;
      const id_usuario = req.usuario?.id_usuario;

      if (!id_produto || quantidade_contada === undefined) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'id_produto e quantidade_contada são obrigatórios.',
        });
      }

      const resultado = await movService.ajustarInventario(
        Number(id_produto),
        Number(quantidade_contada),
        id_usuario
      );

      return res.json(resultado);
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }
}

