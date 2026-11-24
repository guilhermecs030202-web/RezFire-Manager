import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { SupplierService } from '../services/supplier.service';

const supplierService = new SupplierService();

function formatarErro(error: any): string {
  if (error instanceof ZodError) {
    return error.errors.map((e) => e.message).join('; ');
  }
  return error?.message || 'Ocorreu um erro interno.';
}

export class SupplierController {
  async listar(req: Request, res: Response) {
    try {
      const { page, limit, search, status, sortBy, sortOrder } = req.query;

      const resultado = await supplierService.listar({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
        search: search ? String(search) : undefined,
        status: status ? (String(status) as any) : undefined,
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

      const fornecedor = await supplierService.buscarPorId(id);
      if (!fornecedor) {
        return res.status(404).json({ sucesso: false, mensagem: 'Fornecedor não encontrado.' });
      }

      return res.json({ sucesso: true, fornecedor });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }

  async criar(req: Request, res: Response) {
    try {
      const novoFornecedor = await supplierService.criar(req.body);
      return res.status(201).json({
        sucesso: true,
        mensagem: 'Fornecedor cadastrado com sucesso!',
        fornecedor: novoFornecedor,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }

  async atualizar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido.' });
      }

      const fornecedorAtualizado = await supplierService.atualizar(id, req.body);
      return res.json({
        sucesso: true,
        mensagem: 'Fornecedor atualizado com sucesso!',
        fornecedor: fornecedorAtualizado,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }

  async alternarStatus(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido.' });
      }

      const { ativo } = req.body;
      const resultado = await supplierService.alternarStatus(id, ativo);
      return res.json(resultado);
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }

  async listarProdutos(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido.' });
      }

      const produtos = await supplierService.listarProdutosVinculados(id);
      return res.json({ sucesso: true, produtos });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }

  async vincularProduto(req: Request, res: Response) {
    try {
      const idFornecedor = Number(req.params.id);
      if (isNaN(idFornecedor)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID do fornecedor inválido.' });
      }

      const resultado = await supplierService.vincularProduto(idFornecedor, req.body);
      return res.status(201).json(resultado);
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }

  async desvincularProduto(req: Request, res: Response) {
    try {
      const idFornecedor = Number(req.params.id);
      const idProduto = Number(req.params.idProduto);

      if (isNaN(idFornecedor) || isNaN(idProduto)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Parâmetros inválidos.' });
      }

      const resultado = await supplierService.desvincularProduto(idFornecedor, idProduto);
      return res.json(resultado);
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: formatarErro(error) });
    }
  }
}
