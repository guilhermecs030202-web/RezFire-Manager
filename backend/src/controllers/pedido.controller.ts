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
      const {
        status,
        status_entrega,
        motivo_devolucao,
        tipo_ocorrencia,
        detalhe_devolucao,
        protocolo_mediacao,
      } = req.body;
      const id_usuario = req.usuario?.id_usuario;

      if (!status) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'status é obrigatório.',
        });
      }

      const dadosDevolucao = motivo_devolucao
        ? {
            motivo_devolucao: String(motivo_devolucao).trim(),
            tipo_ocorrencia: tipo_ocorrencia || 'Cancelamento',
            detalhe_devolucao: detalhe_devolucao ? String(detalhe_devolucao).trim() : undefined,
            protocolo_mediacao: protocolo_mediacao ? String(protocolo_mediacao).trim() : undefined,
          }
        : undefined;

      const pedidoAtualizado = await pedidoService.atualizarStatus(
        id,
        status,
        status_entrega,
        id_usuario,
        dadosDevolucao
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

  async registrarDevolucao(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { motivo_devolucao, tipo_ocorrencia, detalhe_devolucao, protocolo_mediacao } = req.body;
      const id_usuario = req.usuario?.id_usuario;

      if (!motivo_devolucao || !String(motivo_devolucao).trim()) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'O motivo da devolução/mediação é obrigatório e deve ser selecionado da lista padronizada.',
        });
      }

      const pedidoAtualizado = await pedidoService.atualizarStatus(
        id,
        'Cancelado',
        undefined,
        id_usuario,
        {
          motivo_devolucao: String(motivo_devolucao).trim(),
          tipo_ocorrencia: tipo_ocorrencia || 'Devolucao',
          detalhe_devolucao: detalhe_devolucao ? String(detalhe_devolucao).trim() : undefined,
          protocolo_mediacao: protocolo_mediacao ? String(protocolo_mediacao).trim() : undefined,
        }
      );

      return res.json({
        sucesso: true,
        mensagem: 'Devolução/mediação registrada com sucesso e estoque estornado.',
        pedido: pedidoAtualizado,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterEstatisticasDevolucoes(_req: Request, res: Response) {
    try {
      const estatisticas = await pedidoService.obterEstatisticasDevolucoes();
      return res.json({ sucesso: true, ...estatisticas });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterAlertasPostagem(_req: Request, res: Response) {
    try {
      const alertas = await pedidoService.obterAlertasPostagem();
      return res.json({ sucesso: true, ...alertas });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }
}

