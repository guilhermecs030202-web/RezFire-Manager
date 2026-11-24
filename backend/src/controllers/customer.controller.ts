import { Request, Response } from 'express';
import { CustomerService } from '../services/customer.service';

const customerService = new CustomerService();

export class CustomerController {
  async listar(req: Request, res: Response) {
    try {
      const { page, limit, search, source } = req.query;

      const resultado = await customerService.listar({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
        search: search ? String(search) : undefined,
        source: source ? (String(source) as any) : undefined,
      });

      return res.json(resultado);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async buscarPorId(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido.' });
      }

      const cliente = await customerService.buscarPorId(id);
      if (!cliente) {
        return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
      }

      return res.json({ sucesso: true, cliente });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async criar(req: Request, res: Response) {
    try {
      const novoCliente = await customerService.criarPresencial(req.body);
      return res.status(201).json({
        sucesso: true,
        mensagem: 'Cliente cadastrado com sucesso!',
        cliente: novoCliente,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async atualizar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido.' });
      }

      const clienteAtualizado = await customerService.atualizar(id, req.body);
      return res.json({
        sucesso: true,
        mensagem: 'Cliente atualizado com sucesso!',
        cliente: clienteAtualizado,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }
}
