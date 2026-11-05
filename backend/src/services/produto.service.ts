import { AppDataSource } from '../config/database';
import { Produto } from '../entities/Produto';
import { Estoque } from '../entities/Estoque';
import { LoteEstoque } from '../entities/LoteEstoque';

export class ProdutoService {
  private get produtoRepo() {
    return AppDataSource.getRepository(Produto);
  }

  private get estoqueRepo() {
    return AppDataSource.getRepository(Estoque);
  }

  private get loteRepo() {
    return AppDataSource.getRepository(LoteEstoque);
  }

  /**
   * Lista todos os produtos com seus estoques e cálculo dinâmico de combos
   */
  async listarTodos(busca?: string, categoria?: string, apenasAtivos: boolean = false) {
    const qb = this.produtoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.estoque', 'e')
      .leftJoinAndSelect('p.lotes', 'l');

    if (apenasAtivos) {
      qb.andWhere('p.ativo = :ativo', { ativo: true });
    }

    if (categoria && categoria !== 'todos') {
      qb.andWhere('p.categoria = :categoria', { categoria });
    }

    if (busca) {
      qb.andWhere('(p.sku LIKE :busca OR p.nome LIKE :busca)', {
        busca: `%${busca}%`,
      });
    }

    qb.orderBy('p.nome', 'ASC');

    const produtos = await qb.getMany();

    // Cria um mapa para consulta rápida de saldos físicos para cálculo de combos
    const estoqueFisicoMap = new Map<number, number>();
    for (const prod of produtos) {
      if (prod.tipo !== 'Combo') {
        estoqueFisicoMap.set(prod.id_produto, prod.estoque?.quantidade_atual || 0);
      }
    }

    // Calcula estoque dinâmico de combos baseado no item gargalo
    return produtos.map((prod) => {
      let quantidadeDisponivel = prod.estoque?.quantidade_atual || 0;

      if (prod.tipo === 'Combo' && prod.combo_items && prod.combo_items.length > 0) {
        const disponibilidades = prod.combo_items.map((item) => {
          const saldoComponente = estoqueFisicoMap.get(item.id_produto) || 0;
          return Math.floor(saldoComponente / item.quantidade);
        });
        quantidadeDisponivel = Math.min(...disponibilidades);
      }

      return {
        ...prod,
        quantidade_atual: quantidadeDisponivel,
        estoque_minimo: prod.estoque?.estoque_minimo || 0,
      };
    });
  }

  /**
   * Busca um produto por ID com detalhes completos
   */
  async buscarPorId(id_produto: number) {
    const produto = await this.produtoRepo.findOne({
      where: { id_produto },
      relations: ['estoque', 'lotes'],
    });

    if (!produto) {
      throw new Error(`Produto #${id_produto} não encontrado.`);
    }

    let quantidadeDisponivel = produto.estoque?.quantidade_atual || 0;

    if (produto.tipo === 'Combo' && produto.combo_items && produto.combo_items.length > 0) {
      const idsComponentes = produto.combo_items.map((ci) => ci.id_produto);
      const componentes = await this.estoqueRepo
        .createQueryBuilder('e')
        .where('e.id_produto IN (:...ids)', { ids: idsComponentes })
        .getMany();

      const mapaSaldos = new Map(componentes.map((c) => [c.id_produto, c.quantidade_atual]));
      const disponibilidades = produto.combo_items.map((item) => {
        const saldo = mapaSaldos.get(item.id_produto) || 0;
        return Math.floor(saldo / item.quantidade);
      });
      quantidadeDisponivel = Math.min(...disponibilidades);
    }

    return {
      ...produto,
      quantidade_atual: quantidadeDisponivel,
      estoque_minimo: produto.estoque?.estoque_minimo || 0,
    };
  }

  /**
   * Criação de um novo produto (Transacional: cadastra produto e registro 1:1 de estoque)
   */
  async criar(dados: {
    sku: string;
    nome: string;
    descricao?: string;
    preco: number;
    custo?: number;
    categoria?: string;
    tipo?: 'Simples' | 'Combo';
    estoque_minimo?: number;
    combo_items?: { id_produto: number; quantidade: number }[];
    detalhes_extintor?: any;
  }) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const prodRepoTx = queryRunner.manager.getRepository(Produto);
      const estRepoTx = queryRunner.manager.getRepository(Estoque);

      const skuExistente = await prodRepoTx.findOne({ where: { sku: dados.sku.trim() } });
      if (skuExistente) {
        throw new Error(`O SKU "${dados.sku}" já está cadastrado.`);
      }

      const produto = prodRepoTx.create({
        sku: dados.sku.trim().toUpperCase(),
        nome: dados.nome.trim(),
        descricao: dados.descricao || '',
        preco: dados.preco,
        custo: dados.custo || 0,
        categoria: dados.categoria || 'Geral',
        tipo: dados.tipo || 'Simples',
        combo_items: dados.tipo === 'Combo' ? dados.combo_items : null,
        detalhes_extintor: dados.detalhes_extintor || null,
        ativo: true,
      });

      const produtoSalvo = await prodRepoTx.save(produto);

      // Criação obrigatória do registro 1:1 em estoque
      const estoque = estRepoTx.create({
        id_produto: produtoSalvo.id_produto,
        quantidade_atual: 0,
        estoque_minimo: dados.estoque_minimo || 0,
      });
      await estRepoTx.save(estoque);

      await queryRunner.commitTransaction();
      return this.buscarPorId(produtoSalvo.id_produto);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Atualização cadastral de produto
   */
  async atualizar(
    id_produto: number,
    dados: {
      sku?: string;
      nome?: string;
      descricao?: string;
      preco?: number;
      custo?: number;
      categoria?: string;
      tipo?: 'Simples' | 'Combo';
      estoque_minimo?: number;
      ativo?: boolean;
      combo_items?: { id_produto: number; quantidade: number }[];
      detalhes_extintor?: any;
    }
  ) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const prodRepoTx = queryRunner.manager.getRepository(Produto);
      const estRepoTx = queryRunner.manager.getRepository(Estoque);

      const produto = await prodRepoTx.findOne({ where: { id_produto } });
      if (!produto) {
        throw new Error(`Produto #${id_produto} não encontrado.`);
      }

      if (dados.sku && dados.sku.toUpperCase() !== produto.sku) {
        const outroProd = await prodRepoTx.findOne({
          where: { sku: dados.sku.trim().toUpperCase() },
        });
        if (outroProd) {
          throw new Error(`O SKU "${dados.sku}" já está em uso por outro produto.`);
        }
        produto.sku = dados.sku.trim().toUpperCase();
      }

      if (dados.nome !== undefined) produto.nome = dados.nome.trim();
      if (dados.descricao !== undefined) produto.descricao = dados.descricao;
      if (dados.preco !== undefined) produto.preco = dados.preco;
      if (dados.custo !== undefined) produto.custo = dados.custo;
      if (dados.categoria !== undefined) produto.categoria = dados.categoria;
      if (dados.tipo !== undefined) produto.tipo = dados.tipo;
      if (dados.ativo !== undefined) produto.ativo = dados.ativo;
      if (dados.combo_items !== undefined) produto.combo_items = dados.combo_items;
      if (dados.detalhes_extintor !== undefined) produto.detalhes_extintor = dados.detalhes_extintor;

      await prodRepoTx.save(produto);

      // Atualiza estoque mínimo se informado
      if (dados.estoque_minimo !== undefined) {
        let estoque = await estRepoTx.findOne({ where: { id_produto } });
        if (estoque) {
          estoque.estoque_minimo = dados.estoque_minimo;
          await estRepoTx.save(estoque);
        }
      }

      await queryRunner.commitTransaction();
      return this.buscarPorId(id_produto);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Inativa um produto no catálogo
   */
  async inativar(id_produto: number) {
    const produto = await this.produtoRepo.findOne({ where: { id_produto } });
    if (!produto) {
      throw new Error(`Produto #${id_produto} não encontrado.`);
    }

    produto.ativo = false;
    await this.produtoRepo.save(produto);
    return { sucesso: true, mensagem: `Produto ${produto.sku} inativado com sucesso.` };
  }
}

