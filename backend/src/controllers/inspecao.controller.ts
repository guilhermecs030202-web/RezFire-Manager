import { Request, Response } from 'express';
import { InspecaoService } from '../services/inspecao.service';

const inspecaoService = new InspecaoService();

export class InspecaoController {
  async listar(req: Request, res: Response) {
    try {
      const { id_produto, id_pedido, tipo_inspecao, resultado, data_inicio, data_fim, limite } = req.query;
      const inspecoes = await inspecaoService.listar({
        id_produto: id_produto ? Number(id_produto) : undefined,
        id_pedido: id_pedido ? Number(id_pedido) : undefined,
        tipo_inspecao: tipo_inspecao ? (String(tipo_inspecao) as 'Entrada' | 'Separacao') : undefined,
        resultado: resultado ? (String(resultado) as 'Aprovado' | 'Reprovado' | 'Aprovado Parcial') : undefined,
        data_inicio: data_inicio ? String(data_inicio) : undefined,
        data_fim: data_fim ? String(data_fim) : undefined,
        limite: limite ? Number(limite) : 100,
      });

      return res.json({ sucesso: true, inspecoes });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async buscarPorId(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const inspecao = await inspecaoService.buscarPorId(Number(id));
      return res.json({ sucesso: true, inspecao });
    } catch (error: any) {
      return res.status(404).json({ sucesso: false, mensagem: error.message });
    }
  }

  async buscarPorPedido(req: Request, res: Response) {
    try {
      const { id_pedido } = req.params;
      const inspecoes = await inspecaoService.buscarPorPedido(Number(id_pedido));
      return res.json({ sucesso: true, inspecoes });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterResumo(req: Request, res: Response) {
    try {
      const resumo = await inspecaoService.obterResumo();
      return res.json({ sucesso: true, resumo });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async registrar(req: Request, res: Response) {
    try {
      const {
        id_produto,
        id_lote,
        id_movimentacao,
        id_pedido,
        tipo_inspecao,
        checklist,
        quantidade_total,
        quantidade_reprovada,
        motivo_reprovacao,
        destino_reprovados,
        observacoes,
        responsavel,
      } = req.body;

      if (!id_produto || !checklist || !quantidade_total) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'id_produto, checklist e quantidade_total são obrigatórios.',
        });
      }

      const id_usuario = req.usuario?.id_usuario;

      const inspecao = await inspecaoService.registrar({
        id_produto: Number(id_produto),
        id_lote: id_lote ? Number(id_lote) : undefined,
        id_movimentacao: id_movimentacao ? Number(id_movimentacao) : undefined,
        id_pedido: id_pedido ? Number(id_pedido) : undefined,
        id_usuario,
        tipo_inspecao,
        checklist,
        quantidade_total: Number(quantidade_total),
        quantidade_reprovada: quantidade_reprovada !== undefined ? Number(quantidade_reprovada) : undefined,
        motivo_reprovacao,
        destino_reprovados,
        observacoes,
        responsavel: responsavel || req.usuario?.nome || 'Gestor RezFire',
      });

      return res.status(201).json({ sucesso: true, inspecao });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }
}

