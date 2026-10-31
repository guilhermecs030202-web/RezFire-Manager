import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Produto } from '../entities/Produto';
import { Estoque } from '../entities/Estoque';

// Campos não-vazios de detalhes_extintor
function sanitizeDetalhesExtintor(raw: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (raw[key] !== null && raw[key] !== undefined && raw[key] !== '') {
      filtered[key] = raw[key];
    }
  }
  return Object.keys(filtered).length > 0 ? filtered : null;
}

// Monta objeto de resposta com campos de estoque mesclados
function buildProdutoResponse(produto: Produto, estoque?: Estoque | null) {
  return {
    id_produto: produto.id_produto,
    sku: produto.sku,
    nome: produto.nome,
    descricao: produto.descricao,
    categoria: produto.categoria,
    tipo: produto.tipo,
    unidade_medida: produto.unidade_medida,
    custo: Number(produto.custo),
    preco: Number(produto.preco),
    ativo: produto.ativo,
    detalhes_extintor: produto.detalhes_extintor,
    created_at: produto.created_at,
    updated_at: produto.updated_at,
    quantidade_atual: estoque ? estoque.quantidade_atual : 0,
    estoque_minimo: estoque ? estoque.estoque_minimo : 0,
  };
}

export class ProdutoController {
  // GET /api/produtos
  static async listar(req: Request, res: Response): Promise<void> {
    try {
      const produtoRepo = AppDataSource.getRepository(Produto);
      const produtos = await produtoRepo.find({
        relations: ['estoque'],
        order: { created_at: 'DESC' },
      });

      const result = produtos.map((p) => buildProdutoResponse(p, p.estoque));
      res.json(result);
    } catch (err) {
      console.error('[ProdutoController.listar]', err);
      res.status(500).json({ error: 'Erro interno ao listar produtos.' });
    }
  }

  // GET /api/produtos/:id
  static async buscarPorId(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ error: 'ID inválido.' });
        return;
      }

      const produtoRepo = AppDataSource.getRepository(Produto);
      const produto = await produtoRepo.findOne({
        where: { id_produto: id },
        relations: ['estoque'],
      });

      if (!produto) {
        res.status(404).json({ error: 'Produto não encontrado.' });
        return;
      }

      res.json(buildProdutoResponse(produto, produto.estoque));
    } catch (err) {
      console.error('[ProdutoController.buscarPorId]', err);
      res.status(500).json({ error: 'Erro interno ao buscar produto.' });
    }
  }

  // POST /api/produtos
  static async criar(req: Request, res: Response): Promise<void> {
    try {
      const {
        sku,
        nome,
        descricao,
        categoria,
        tipo,
        unidade_medida,
        custo,
        preco,
        ativo,
        detalhes_extintor,
      } = req.body;

      // Validações obrigatórias
      if (!sku || !sku.toString().trim()) {
        res.status(400).json({ error: 'O campo SKU é obrigatório.' });
        return;
      }
      if (!nome || !nome.toString().trim()) {
        res.status(400).json({ error: 'O campo Nome é obrigatório.' });
        return;
      }
      if (!categoria || !categoria.toString().trim()) {
        res.status(400).json({ error: 'O campo Categoria é obrigatório.' });
        return;
      }
      if (!unidade_medida || !unidade_medida.toString().trim()) {
        res.status(400).json({ error: 'O campo Unidade de Medida é obrigatório.' });
        return;
      }
      if (preco === undefined || preco === null || isNaN(Number(preco)) || Number(preco) < 0) {
        res.status(400).json({ error: 'O campo Preço deve ser maior ou igual a zero.' });
        return;
      }
      if (custo !== undefined && custo !== null && (isNaN(Number(custo)) || Number(custo) < 0)) {
        res.status(400).json({ error: 'O campo Custo deve ser maior ou igual a zero.' });
        return;
      }

      const produtoRepo = AppDataSource.getRepository(Produto);
      const estoqueRepo = AppDataSource.getRepository(Estoque);

      // Verifica SKU duplicado
      const existente = await produtoRepo.findOne({ where: { sku: sku.toString().trim() } });
      if (existente) {
        res.status(409).json({ error: 'Já existe um produto com este SKU.' });
        return;
      }

      // Cria produto
      const novoProduto = produtoRepo.create({
        sku: sku.toString().trim().toUpperCase(),
        nome: nome.toString().trim(),
        descricao: descricao ? descricao.toString().trim() : null,
        categoria: categoria.toString().trim(),
        tipo: tipo || 'Simples',
        unidade_medida: unidade_medida.toString().trim(),
        custo: custo !== undefined && custo !== null ? Number(custo) : 0,
        preco: Number(preco),
        ativo: ativo !== undefined ? Boolean(ativo) : true,
        detalhes_extintor: sanitizeDetalhesExtintor(detalhes_extintor),
      });

      const produtoSalvo = await produtoRepo.save(novoProduto);

      // Cria registro de estoque zerado automaticamente
      const novoEstoque = estoqueRepo.create({
        produto: produtoSalvo,
        quantidade_atual: 0,
        estoque_minimo: 0,
      });
      const estoqueSalvo = await estoqueRepo.save(novoEstoque);

      res.status(201).json(buildProdutoResponse(produtoSalvo, estoqueSalvo));
    } catch (err) {
      console.error('[ProdutoController.criar]', err);
      res.status(500).json({ error: 'Erro interno ao criar produto.' });
    }
  }

  // PUT /api/produtos/:id
  static async editar(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ error: 'ID inválido.' });
        return;
      }

      const {
        sku,
        nome,
        descricao,
        categoria,
        tipo,
        unidade_medida,
        custo,
        preco,
        ativo,
        detalhes_extintor,
      } = req.body;

      // Validações obrigatórias
      if (sku !== undefined && !sku.toString().trim()) {
        res.status(400).json({ error: 'O campo SKU não pode ficar vazio.' });
        return;
      }
      if (nome !== undefined && !nome.toString().trim()) {
        res.status(400).json({ error: 'O campo Nome não pode ficar vazio.' });
        return;
      }
      if (categoria !== undefined && !categoria.toString().trim()) {
        res.status(400).json({ error: 'O campo Categoria não pode ficar vazio.' });
        return;
      }
      if (unidade_medida !== undefined && !unidade_medida.toString().trim()) {
        res.status(400).json({ error: 'O campo Unidade de Medida não pode ficar vazio.' });
        return;
      }
      if (preco !== undefined && (isNaN(Number(preco)) || Number(preco) < 0)) {
        res.status(400).json({ error: 'O campo Preço deve ser maior ou igual a zero.' });
        return;
      }
      if (custo !== undefined && custo !== null && (isNaN(Number(custo)) || Number(custo) < 0)) {
        res.status(400).json({ error: 'O campo Custo deve ser maior ou igual a zero.' });
        return;
      }

      const produtoRepo = AppDataSource.getRepository(Produto);
      const produto = await produtoRepo.findOne({
        where: { id_produto: id },
        relations: ['estoque'],
      });

      if (!produto) {
        res.status(404).json({ error: 'Produto não encontrado.' });
        return;
      }

      // Verifica SKU duplicado (excluindo o próprio produto)
      if (sku && sku.toString().trim().toUpperCase() !== produto.sku) {
        const existente = await produtoRepo.findOne({ where: { sku: sku.toString().trim().toUpperCase() } });
        if (existente) {
          res.status(409).json({ error: 'Já existe um produto com este SKU.' });
          return;
        }
      }

      // Atualiza apenas os campos fornecidos
      if (sku !== undefined) produto.sku = sku.toString().trim().toUpperCase();
      if (nome !== undefined) produto.nome = nome.toString().trim();
      if (descricao !== undefined) produto.descricao = descricao ? descricao.toString().trim() : null;
      if (categoria !== undefined) produto.categoria = categoria.toString().trim();
      if (tipo !== undefined) produto.tipo = tipo;
      if (unidade_medida !== undefined) produto.unidade_medida = unidade_medida.toString().trim();
      if (custo !== undefined) produto.custo = custo !== null ? Number(custo) : 0;
      if (preco !== undefined) produto.preco = Number(preco);
      if (ativo !== undefined) produto.ativo = Boolean(ativo);
      if (detalhes_extintor !== undefined) {
        produto.detalhes_extintor = sanitizeDetalhesExtintor(detalhes_extintor);
      }

      const produtoAtualizado = await produtoRepo.save(produto);
      res.json(buildProdutoResponse(produtoAtualizado, produtoAtualizado.estoque));
    } catch (err) {
      console.error('[ProdutoController.editar]', err);
      res.status(500).json({ error: 'Erro interno ao editar produto.' });
    }
  }

  // DELETE /api/produtos/:id
  static async deletar(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ error: 'ID inválido.' });
        return;
      }

      const produtoRepo = AppDataSource.getRepository(Produto);
      const produto = await produtoRepo.findOne({
        where: { id_produto: id },
        relations: ['estoque'],
      });

      if (!produto) {
        res.status(404).json({ error: 'Produto não encontrado.' });
        return;
      }

      // Soft delete: marca como inativo em vez de excluir fisicamente
      // Isso preserva o histórico de movimentações futuras
      produto.ativo = false;
      await produtoRepo.save(produto);

      res.json({ message: 'Produto desativado com sucesso.', id_produto: id });
    } catch (err) {
      console.error('[ProdutoController.deletar]', err);
      res.status(500).json({ error: 'Erro interno ao deletar produto.' });
    }
  }
}
