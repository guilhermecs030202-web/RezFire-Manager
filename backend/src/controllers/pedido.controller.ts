import { Request, Response } from 'express';
import { PedidoService } from '../services/pedido.service';

const pedidoService = new PedidoService();

export class PedidoController {
  async listar(req: Request, res: Response) {
    try {
      const { status, status_entrega, exibir_na_entrega, busca, limite } = req.query;
      const pedidos = await pedidoService.listar({
        status: status ? (String(status) as any) : undefined,
        status_entrega: status_entrega ? (String(status_entrega) as any) : undefined,
        exibir_na_entrega: exibir_na_entrega !== undefined ? exibir_na_entrega === 'true' : undefined,
        busca: busca ? String(busca) : undefined,
        limite: limite ? Number(limite) : 100,
      });

      return res.json({ sucesso: true, pedidos });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async buscarPorId(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const pedido = await pedidoService.buscarPorId(id);
      return res.json({ sucesso: true, pedido });
    } catch (error: any) {
      return res.status(404).json({ sucesso: false, mensagem: error.message });
    }
  }

  async criar(req: Request, res: Response) {
    try {
      const { codigo_pedido, cliente_nome, origem, itens, exibir_na_entrega } = req.body;
      const id_usuario = req.usuario?.id_usuario;

      if (!cliente_nome || !itens || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'cliente_nome e itens (array) são obrigatórios.',
        });
      }

      const novoPedido = await pedidoService.criarPedido(
        {
          codigo_pedido,
          cliente_nome,
          origem,
          itens,
          exibir_na_entrega,
        },
        id_usuario
      );

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Pedido aprovado e baixado no estoque com sucesso.',
        pedido: novoPedido,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async atualizarStatus(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { status, status_entrega } = req.body;
      const id_usuario = req.usuario?.id_usuario;

      if (!status) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'status é obrigatório.',
        });
      }

      const pedidoAtualizado = await pedidoService.atualizarStatus(
        id,
        status,
        status_entrega,
        id_usuario
      );

      return res.json({
        sucesso: true,
        mensagem: 'Status do pedido atualizado com sucesso.',
        pedido: pedidoAtualizado,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }
}

