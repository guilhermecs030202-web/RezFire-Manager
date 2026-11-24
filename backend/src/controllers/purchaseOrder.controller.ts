import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { PurchaseOrderService } from '../services/purchaseOrder.service';

const poService = new PurchaseOrderService();

function formatarErro(error: any): string {
  if (error instanceof ZodError) {
    return error.errors.map((e) => e.message).join('; ');
  }
  return error?.message || 'Ocorreu um erro interno no servidor.';
}

export class PurchaseOrderController {
  async listar(req: Request, res: Response) {
    try {
      const { page, limit, search, status, supplierId, from, to, sortBy, sortOrder } = req.query;

      const resultado = await poService.listar({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
        search: search ? String(search) : undefined,
        status: status ? String(status) : undefined,
        supplierId: supplierId ? Number(supplierId) : undefined,
        from: from ? String(from) : undefined,
        to: to ? String(to) : undefined,
        sortBy: sortBy ? String(sortBy) : undefined,
        sortOrder: sortOrder ? (String(sortOrder) as any) : undefined,
      });

      return res.json(resultado);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }

  async buscarPorId(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido.' });
      }

      const po = await poService.buscarPorId(id);
      if (!po) {
        return res.status(404).json({ sucesso: false, mensagem: 'Pedido de compra não encontrado.' });
      }

      return res.json({ sucesso: true, pedido: po });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }

  async proximoNumero(req: Request, res: Response) {
    try {
      const numero = await poService.gerarProximoNumero();
      return res.json({ sucesso: true, numero });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }

  async criar(req: Request, res: Response) {
    try {
      const novoPedido = await poService.criar(req.body);
      return res.status(201).json({
        sucesso: true,
        mensagem: 'Pedido de compra registrado com sucesso!',
        pedido: novoPedido,
      });
    } catch (error: any) {
      const status = error instanceof ZodError ? 400 : 500;
      return res.status(status).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }

  async atualizar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido.' });
      }

      const atualizado = await poService.atualizar(id, req.body);
      return res.json({
        sucesso: true,
        mensagem: 'Pedido de compra atualizado com sucesso!',
        pedido: atualizado,
      });
    } catch (error: any) {
      const status = error instanceof ZodError ? 400 : 500;
      return res.status(status).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }

  async receber(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido.' });
      }

      const idUsuario = (req as any).user?.id_usuario || null;
      const resultado = await poService.registrarRecebimento(id, req.body, idUsuario);

      return res.json({
        sucesso: true,
        mensagem: 'Recebimento registrado com sucesso! O estoque foi atualizado.',
        pedido: resultado,
      });
    } catch (error: any) {
      const status = error instanceof ZodError ? 400 : 400;
      return res.status(status).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }

  async cancelar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido.' });
      }

      const { motivo } = req.body;
      const resultado = await poService.cancelar(id, motivo);

      return res.json({
        sucesso: true,
        mensagem: 'Pedido de compra cancelado com sucesso.',
        pedido: resultado,
      });
    } catch (error: any) {
      const status = error instanceof ZodError ? 400 : 400;
      return res.status(status).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }
}
