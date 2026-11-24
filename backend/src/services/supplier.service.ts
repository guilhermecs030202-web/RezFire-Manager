import { Repository } from 'typeorm';
import { z } from 'zod';
import { AppDataSource } from '../config/database';
import { Supplier } from '../entities/Supplier';
import { ProdutoFornecedor } from '../entities/ProdutoFornecedor';
import { Produto } from '../entities/Produto';
import { PurchaseOrder } from '../entities/PurchaseOrder';
import { limparDocumento, validarCpfOuCnpj } from './customer.service';

// ── Esquemas de Validação Zod em Português ──────────────────────────────────
export const criarFornecedorSchema = z.object({
  razaoSocial: z
    .string()
    .trim()
    .min(2, 'A Razão Social / Nome deve ter no mínimo 2 caracteres')
    .max(150, 'A Razão Social deve ter no máximo 150 caracteres'),
  nomeFantasia: z.string().trim().max(100).optional().nullable(),
  cnpj: z
    .string()
    .trim()
    .min(11, 'O documento deve ter no mínimo 11 dígitos')
    .max(20, 'O documento deve ter no máximo 20 caracteres')
    .refine((val) => validarCpfOuCnpj(val), {
      message: 'CNPJ ou CPF inválido. Verifique os dígitos verificadores.',
    }),
  inscricaoEstadual: z.string().trim().max(30).optional().nullable(),
  contatoNome: z.string().trim().max(100).optional().nullable(),
  email: z
    .string()
    .trim()
    .email('E-mail em formato inválido')
    .max(150)
    .optional()
    .nullable()
    .or(z.literal('')),
  telefone: z.string().trim().max(30).optional().nullable(),
  cep: z.string().trim().max(15).optional().nullable(),
  logradouro: z.string().trim().max(150).optional().nullable(),
  numero: z.string().trim().max(30).optional().nullable(),
  bairro: z.string().trim().max(100).optional().nullable(),
  cidade: z.string().trim().max(100).optional().nullable(),
  estado: z.string().trim().max(10).optional().nullable(),
  prazoPadraoDias: z.coerce.number().int().min(0).default(7),
  condicoesPagamento: z.string().trim().max(150).optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
});

export const atualizarFornecedorSchema = z.object({
  razaoSocial: z.string().trim().min(2).max(150).optional(),
  nomeFantasia: z.string().trim().max(100).optional().nullable(),
  cnpj: z
    .string()
    .trim()
    .min(11)
    .max(20)
    .refine((val) => !val || validarCpfOuCnpj(val), {
      message: 'CNPJ ou CPF inválido',
    })
    .optional(),
  inscricaoEstadual: z.string().trim().max(30).optional().nullable(),
  contatoNome: z.string().trim().max(100).optional().nullable(),
  email: z
    .string()
    .trim()
    .email('E-mail em formato inválido')
    .max(150)
    .optional()
    .nullable()
    .or(z.literal('')),
  telefone: z.string().trim().max(30).optional().nullable(),
  cep: z.string().trim().max(15).optional().nullable(),
  logradouro: z.string().trim().max(150).optional().nullable(),
  numero: z.string().trim().max(30).optional().nullable(),
  bairro: z.string().trim().max(100).optional().nullable(),
  cidade: z.string().trim().max(100).optional().nullable(),
  estado: z.string().trim().max(10).optional().nullable(),
  prazoPadraoDias: z.coerce.number().int().min(0).optional(),
  condicoesPagamento: z.string().trim().max(150).optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
});

export const vincularProdutoSchema = z.object({
  idProduto: z.coerce.number().int().positive('Selecione um produto válido'),
  custoCompra: z.coerce.number().min(0, 'O custo de compra não pode ser negativo'),
  principal: z.boolean().optional().default(true),
});

export class SupplierService {
  private supplierRepo: Repository<Supplier>;
  private pfRepo: Repository<ProdutoFornecedor>;
  private produtoRepo: Repository<Produto>;

  constructor() {
    this.supplierRepo = AppDataSource.getRepository(Supplier);
    this.pfRepo = AppDataSource.getRepository(ProdutoFornecedor);
    this.produtoRepo = AppDataSource.getRepository(Produto);
  }

  /**
   * Listagem paginada no servidor com busca, filtro de status, ordenação e cálculo de prazo médio
   */
  async listar(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'TODOS' | 'ATIVO' | 'INATIVO';
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const offset = (page - 1) * limit;

    let whereSql = 'WHERE 1=1';
    const queryParams: any[] = [];

    // Filtro de Status
    if (params.status === 'ATIVO') {
      whereSql += ' AND f.ativo = 1';
    } else if (params.status === 'INATIVO') {
      whereSql += ' AND f.ativo = 0';
    }

    // Busca por Nome / Razão Social, CNPJ, Email, Telefone, Contato ou Cidade
    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      const docClean = `%${limparDocumento(params.search.trim())}%`;
      whereSql += ` AND (
        f.razao_social LIKE ? 
        OR f.nome_fantasia LIKE ? 
        OR f.cnpj LIKE ? 
        OR REPLACE(REPLACE(REPLACE(f.cnpj, '.', ''), '-', ''), '/', '') LIKE ? 
        OR f.email LIKE ? 
        OR f.telefone LIKE ? 
        OR f.contato_nome LIKE ? 
        OR f.cidade LIKE ?
      )`;
      queryParams.push(term, term, term, docClean, term, term, term, term);
    }

    // Contagem total
    const countSql = `
      SELECT COUNT(*) AS total
      FROM fornecedores f
      ${whereSql}
    `;
    const [countRes] = await AppDataSource.query(countSql, queryParams);
    const total = Number(countRes?.total) || 0;

    // Ordenação dinâmica
    const sortOrder = params.sortOrder === 'DESC' ? 'DESC' : 'ASC';
    let sortColumn = 'f.razao_social';
    if (params.sortBy === 'cnpj') sortColumn = 'f.cnpj';
    else if (params.sortBy === 'cidade') sortColumn = 'f.cidade';
    else if (params.sortBy === 'status') sortColumn = 'f.ativo';
    else if (params.sortBy === 'prazo') sortColumn = 'f.prazo_padrao_dias';

    // Consulta de fornecedores com agregação de métricas de pedidos e produtos
    const listSql = `
      SELECT 
        f.id_fornecedor AS id,
        f.razao_social AS razaoSocial,
        f.nome_fantasia AS nomeFantasia,
        f.cnpj,
        f.inscricao_estadual AS inscricaoEstadual,
        f.contato_nome AS contatoNome,
        f.email,
        f.telefone,
        f.cep,
        f.logradouro,
        f.numero,
        f.bairro,
        f.cidade,
        f.estado,
        f.prazo_padrao_dias AS prazoPadraoDias,
        f.condicoes_pagamento AS condicoesPagamento,
        f.observacoes,
        f.ativo,
        f.created_at AS createdAt,
        f.updated_at AS updatedAt,
        (
          SELECT COUNT(*) 
          FROM produto_fornecedor pf 
          WHERE pf.id_fornecedor = f.id_fornecedor
        ) AS totalProdutos,
        (
          SELECT COUNT(*) 
          FROM pedidos_compra po 
          WHERE po.id_fornecedor = f.id_fornecedor AND po.status != 'Cancelado'
        ) AS totalPedidos,
        (
          SELECT COALESCE(SUM(po.valor_total), 0) 
          FROM pedidos_compra po 
          WHERE po.id_fornecedor = f.id_fornecedor AND po.status != 'Cancelado'
        ) AS totalGasto,
        (
          SELECT ROUND(AVG(DATEDIFF(po.data_recebimento, po.data_emissao)), 1)
          FROM pedidos_compra po 
          WHERE po.id_fornecedor = f.id_fornecedor 
            AND po.data_recebimento IS NOT NULL
        ) AS prazoMedioReal
      FROM fornecedores f
      ${whereSql}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const listParams = [...queryParams, limit, offset];
    const rows = await AppDataSource.query(listSql, listParams);

    const data = rows.map((r: any) => ({
      id: Number(r.id),
      razaoSocial: r.razaoSocial,
      nomeFantasia: r.nomeFantasia,
      cnpj: r.cnpj,
      inscricaoEstadual: r.inscricaoEstadual,
      contatoNome: r.contatoNome,
      email: r.email,
      telefone: r.telefone,
      cep: r.cep,
      logradouro: r.logradouro,
      numero: r.numero,
      bairro: r.bairro,
      cidade: r.cidade,
      estado: r.estado,
      prazoPadraoDias: Number(r.prazoPadraoDias) || 7,
      condicoesPagamento: r.condicoesPagamento,
      observacoes: r.observacoes,
      ativo: Boolean(r.ativo),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      totalProdutos: Number(r.totalProdutos) || 0,
      totalPedidos: Number(r.totalPedidos) || 0,
      totalGasto: Number(r.totalGasto) || 0,
      prazoMedioReal: r.prazoMedioReal !== null ? Number(r.prazoMedioReal) : null,
    }));

    return {
      sucesso: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      data,
    };
  }

  /**
   * Busca detalhes completos do fornecedor, incluindo vínculos com produtos e histórico de compras
   */
  async buscarPorId(id: number) {
    const fornecedor = await this.supplierRepo.findOne({
      where: { id },
    });

    if (!fornecedor) return null;

    // 1. Produtos vinculados com custo de compra negociado
    const produtosSql = `
      SELECT 
        pf.id_produto_fornecedor AS idVinculo,
        pf.id_produto AS idProduto,
        p.sku,
        p.nome,
        p.categoria,
        p.preco AS precoVenda,
        p.custo AS custoCadastro,
        pf.custo_compra AS custoCompra,
        pf.principal,
        pf.created_at AS vinculadoEm
      FROM produto_fornecedor pf
      JOIN produtos p ON p.id_produto = pf.id_produto
      WHERE pf.id_fornecedor = ?
      ORDER BY pf.principal DESC, p.nome ASC
    `;
    const produtos = await AppDataSource.query(produtosSql, [id]);

    // 2. Resumo de compras e pedidos recentes
    const resumoSql = `
      SELECT 
        COUNT(*) AS totalPedidos,
        COALESCE(SUM(po.valor_total), 0) AS totalGasto,
        ROUND(AVG(CASE WHEN po.data_recebimento IS NOT NULL THEN DATEDIFF(po.data_recebimento, po.data_emissao) ELSE NULL END), 1) AS prazoMedioReal,
        SUM(CASE WHEN po.status = 'Atrasado' THEN 1 ELSE 0 END) AS pedidosAtrasados
      FROM pedidos_compra po
      WHERE po.id_fornecedor = ? AND po.status != 'Cancelado'
    `;
    const [resumo] = await AppDataSource.query(resumoSql, [id]);

    const ultimosPedidosSql = `
      SELECT 
        po.id_pedido_compra AS idPedidoCompra,
        po.numero_pedido AS numeroPedido,
        po.data_emissao AS dataEmissao,
        po.data_previsao_entrega AS dataPrevisao,
        po.data_recebimento AS dataRecebimento,
        po.status,
        po.valor_total AS valorTotal
      FROM pedidos_compra po
      WHERE po.id_fornecedor = ?
      ORDER BY po.data_emissao DESC
      LIMIT 5
    `;
    const ultimosPedidos = await AppDataSource.query(ultimosPedidosSql, [id]);

    return {
      ...fornecedor,
      totalProdutos: produtos.length,
      totalPedidos: Number(resumo?.totalPedidos) || 0,
      totalGasto: Number(resumo?.totalGasto) || 0,
      prazoMedioReal: resumo?.prazoMedioReal !== null ? Number(resumo?.prazoMedioReal) : null,
      pedidosAtrasados: Number(resumo?.pedidosAtrasados) || 0,
      produtos: produtos.map((p: any) => ({
        idVinculo: Number(p.idVinculo),
        idProduto: Number(p.idProduto),
        sku: p.sku,
        nome: p.nome,
        categoria: p.categoria || 'Geral',
        precoVenda: Number(p.precoVenda) || 0,
        custoCadastro: Number(p.custoCadastro) || 0,
        custoCompra: Number(p.custoCompra) || 0,
        principal: Boolean(p.principal),
        vinculadoEm: p.vinculadoEm,
      })),
      ultimosPedidos: ultimosPedidos.map((po: any) => ({
        idPedidoCompra: Number(po.idPedidoCompra),
        numeroPedido: po.numeroPedido,
        dataEmissao: po.dataEmissao,
        dataPrevisao: po.dataPrevisao,
        dataRecebimento: po.dataRecebimento,
        status: po.status,
        valorTotal: Number(po.valorTotal) || 0,
      })),
    };
  }

  /**
   * Cadastro de fornecedor com validação e proteção contra duplicidade de CNPJ/CPF
   */
  async criar(dadosRaw: unknown) {
    const dados = criarFornecedorSchema.parse(dadosRaw);
    const docLimpo = limparDocumento(dados.cnpj);

    // Verificar duplicidade de CNPJ
    const duplicado = await AppDataSource.query(
      `SELECT id_fornecedor, razao_social FROM fornecedores 
       WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '') = ? LIMIT 1`,
      [docLimpo]
    );

    if (duplicado && duplicado.length > 0) {
      throw new Error(
        `Já existe um fornecedor cadastrado com este documento: "${duplicado[0].razao_social}" (ID: ${duplicado[0].id_fornecedor}).`
      );
    }

    const fornecedor = this.supplierRepo.create({
      razaoSocial: dados.razaoSocial,
      nomeFantasia: dados.nomeFantasia || null,
      cnpj: dados.cnpj,
      inscricaoEstadual: dados.inscricaoEstadual || null,
      contatoNome: dados.contatoNome || null,
      email: dados.email || null,
      telefone: dados.telefone || null,
      cep: dados.cep || null,
      logradouro: dados.logradouro || null,
      numero: dados.numero || null,
      bairro: dados.bairro || null,
      cidade: dados.cidade || null,
      estado: dados.estado ? dados.estado.toUpperCase() : null,
      prazoPadraoDias: dados.prazoPadraoDias ?? 7,
      condicoesPagamento: dados.condicoesPagamento || null,
      observacoes: dados.observacoes || null,
      ativo: true,
    });

    return await this.supplierRepo.save(fornecedor);
  }

  /**
   * Atualização de dados cadastrais de fornecedor com proteção contra duplicidade
   */
  async atualizar(id: number, dadosRaw: unknown) {
    const dados = atualizarFornecedorSchema.parse(dadosRaw);

    const fornecedor = await this.supplierRepo.findOne({ where: { id } });
    if (!fornecedor) {
      throw new Error(`Fornecedor com ID ${id} não foi encontrado.`);
    }

    if (dados.cnpj) {
      const docLimpo = limparDocumento(dados.cnpj);
      const duplicado = await AppDataSource.query(
        `SELECT id_fornecedor, razao_social FROM fornecedores 
         WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '') = ? 
           AND id_fornecedor != ? LIMIT 1`,
        [docLimpo, id]
      );

      if (duplicado && duplicado.length > 0) {
        throw new Error(
          `Outro fornecedor já utiliza este CNPJ/CPF: "${duplicado[0].razao_social}" (ID: ${duplicado[0].id_fornecedor}).`
        );
      }
      fornecedor.cnpj = dados.cnpj;
    }

    if (dados.razaoSocial !== undefined) fornecedor.razaoSocial = dados.razaoSocial;
    if (dados.nomeFantasia !== undefined) fornecedor.nomeFantasia = dados.nomeFantasia;
    if (dados.inscricaoEstadual !== undefined) fornecedor.inscricaoEstadual = dados.inscricaoEstadual;
    if (dados.contatoNome !== undefined) fornecedor.contatoNome = dados.contatoNome;
    if (dados.email !== undefined) fornecedor.email = dados.email || null;
    if (dados.telefone !== undefined) fornecedor.telefone = dados.telefone;
    if (dados.cep !== undefined) fornecedor.cep = dados.cep;
    if (dados.logradouro !== undefined) fornecedor.logradouro = dados.logradouro;
    if (dados.numero !== undefined) fornecedor.numero = dados.numero;
    if (dados.bairro !== undefined) fornecedor.bairro = dados.bairro;
    if (dados.cidade !== undefined) fornecedor.cidade = dados.cidade;
    if (dados.estado !== undefined) fornecedor.estado = dados.estado ? dados.estado.toUpperCase() : null;
    if (dados.prazoPadraoDias !== undefined) fornecedor.prazoPadraoDias = dados.prazoPadraoDias;
    if (dados.condicoesPagamento !== undefined) fornecedor.condicoesPagamento = dados.condicoesPagamento;
    if (dados.observacoes !== undefined) fornecedor.observacoes = dados.observacoes;

    return await this.supplierRepo.save(fornecedor);
  }

  /**
   * Ativar / Inativar fornecedor (Soft Delete / Status operacional)
   */
  async alternarStatus(id: number, ativo?: boolean) {
    const fornecedor = await this.supplierRepo.findOne({ where: { id } });
    if (!fornecedor) {
      throw new Error(`Fornecedor com ID ${id} não encontrado.`);
    }

    const novoStatus = typeof ativo === 'boolean' ? ativo : !fornecedor.ativo;
    fornecedor.ativo = novoStatus;
    await this.supplierRepo.save(fornecedor);

    return {
      sucesso: true,
      mensagem: novoStatus
        ? `Fornecedor "${fornecedor.razaoSocial}" reativado com sucesso!`
        : `Fornecedor "${fornecedor.razaoSocial}" inativado com sucesso! Não aparecerá para novos pedidos de compra.`,
      fornecedor,
    };
  }

  /**
   * Lista todos os produtos vinculados ao fornecedor
   */
  async listarProdutosVinculados(idFornecedor: number) {
    const fornecedor = await this.supplierRepo.findOne({ where: { id: idFornecedor } });
    if (!fornecedor) {
      throw new Error('Fornecedor não encontrado.');
    }

    const sql = `
      SELECT 
        pf.id_produto_fornecedor AS idVinculo,
        pf.id_produto AS idProduto,
        p.sku,
        p.nome,
        p.categoria,
        p.preco AS precoVenda,
        pf.custo_compra AS custoCompra,
        pf.principal,
        pf.created_at AS vinculadoEm
      FROM produto_fornecedor pf
      JOIN produtos p ON p.id_produto = pf.id_produto
      WHERE pf.id_fornecedor = ?
      ORDER BY pf.principal DESC, p.nome ASC
    `;
    return await AppDataSource.query(sql, [idFornecedor]);
  }

  /**
   * Vincula um produto ao fornecedor com o custo padrão negociado
   */
  async vincularProduto(idFornecedor: number, dadosRaw: unknown) {
    const dados = vincularProdutoSchema.parse(dadosRaw);

    const fornecedor = await this.supplierRepo.findOne({ where: { id: idFornecedor } });
    if (!fornecedor) throw new Error('Fornecedor não encontrado.');

    const produto = await this.produtoRepo.findOne({ where: { id_produto: dados.idProduto } });
    if (!produto) throw new Error('Produto não encontrado.');

    // Verificar se já existe vínculo
    let vinculo = await this.pfRepo.findOne({
      where: { idFornecedor, idProduto: dados.idProduto },
    });

    if (vinculo) {
      vinculo.custoCompra = dados.custoCompra;
      vinculo.principal = dados.principal;
    } else {
      vinculo = this.pfRepo.create({
        idFornecedor,
        idProduto: dados.idProduto,
        custoCompra: dados.custoCompra,
        principal: dados.principal,
      });
    }

    await this.pfRepo.save(vinculo);

    return {
      sucesso: true,
      mensagem: `Produto "${produto.nome}" vinculado ao fornecedor com sucesso!`,
      vinculo,
    };
  }

  /**
   * Desvincula um produto do fornecedor
   */
  async desvincularProduto(idFornecedor: number, idProduto: number) {
    const vinculo = await this.pfRepo.findOne({
      where: { idFornecedor, idProduto },
    });

    if (!vinculo) {
      throw new Error('Vínculo entre o produto e fornecedor não encontrado.');
    }

    await this.pfRepo.remove(vinculo);

    return {
      sucesso: true,
      mensagem: 'Produto desvinculado com sucesso!',
    };
  }
}
