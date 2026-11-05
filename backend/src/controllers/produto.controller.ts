import { Request, Response } from 'express';
import { ProdutoService } from '../services/produto.service';

const produtoService = new ProdutoService();

export class ProdutoController {
  async listar(req: Request, res: Response) {
    try {
      const { busca, categoria, apenasAtivos } = req.query;
      const produtos = await produtoService.listarTodos(
        busca ? String(busca) : undefined,
        categoria ? String(categoria) : undefined,
        apenasAtivos === 'true'
      );
      return res.json({ sucesso: true, produtos });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async buscarPorId(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const produto = await produtoService.buscarPorId(id);
      return res.json({ sucesso: true, produto });
    } catch (error: any) {
      return res.status(404).json({ sucesso: false, mensagem: error.message });
    }
  }

  async criar(req: Request, res: Response) {
    try {
      const { sku, nome, descricao, preco, custo, categoria, tipo, estoque_minimo, combo_items, detalhes_extintor } = req.body;

      if (!sku || !nome || preco === undefined) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'SKU, Nome e Preço são obrigatórios.',
        });
      }

      const novoProduto = await produtoService.criar({
        sku,
        nome,
        descricao,
        preco: Number(preco),
        custo: custo !== undefined ? Number(custo) : 0,
        categoria,
        tipo,
        estoque_minimo: estoque_minimo !== undefined ? Number(estoque_minimo) : 0,
        combo_items,
        detalhes_extintor,
      });

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Produto cadastrado com sucesso.',
        produto: novoProduto,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async atualizar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const atualizado = await produtoService.atualizar(id, req.body);
      return res.json({
        sucesso: true,
        mensagem: 'Produto atualizado com sucesso.',
        produto: atualizado,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async inativar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const resultado = await produtoService.inativar(id);
      return res.json(resultado);
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }
}

