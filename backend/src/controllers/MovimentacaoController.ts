import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { MovimentacaoEstoque } from '../entities/MovimentacaoEstoque';
import { Produto } from '../entities/Produto';
import { Estoque } from '../entities/Estoque';

export class MovimentacaoController {
  // GET /api/movimentacoes
  static async listar(req: Request, res: Response): Promise<void> {
    try {
      const { id_produto, tipo, limite } = req.query;

      const movRepo = AppDataSource.getRepository(MovimentacaoEstoque);
      const queryBuilder = movRepo
        .createQueryBuilder('mov')
        .leftJoinAndSelect('mov.produto', 'produto')
        .leftJoinAndSelect('mov.usuario', 'usuario')
        .orderBy('mov.data_movimentacao', 'DESC')
        .addOrderBy('mov.id_movimentacao', 'DESC');

      if (id_produto) {
        queryBuilder.andWhere('mov.id_produto = :id_produto', { id_produto: Number(id_produto) });
      }

      if (tipo) {
        const tipoNormalizado = tipo.toString().toLowerCase().includes('ent') ? 'Entrada' : 'Saída';
        queryBuilder.andWhere('mov.tipo = :tipo', { tipo: tipoNormalizado });
      }

      if (limite) {
        queryBuilder.take(Number(limite));
      }

      const movimentacoes = await queryBuilder.getMany();

      // Formata resposta para manter compatibilidade com frontend
      const resultado = movimentacoes.map((m) => ({
        id_movimentacao: m.id_movimentacao,
        id_produto: m.id_produto,
        sku: m.produto ? m.produto.sku : m.codigo_pedido,
        nome_produto: m.produto ? m.produto.nome : 'Produto não encontrado',
        tipo: m.tipo,
        motivo: m.motivo,
        quantidade: m.quantidade,
        data: m.data_movimentacao,
        data_movimentacao: m.data_movimentacao,
        preco_unitario: m.preco_unitario ? Number(m.preco_unitario) : 0,
        valor_total: m.valor_total ? Number(m.valor_total) : 0,
        responsavel: m.responsavel || (m.usuario ? m.usuario.nome : 'Gestor RezFire'),
        codigo_pedido: m.codigo_pedido,
        canal: m.canal,
        tipo_envio: m.tipo_envio,
        cliente: m.cliente,
        uf: m.uf,
        detalhes_remessa: m.detalhes_remessa,
      }));

      res.json(resultado);
    } catch (err) {
      console.error('[MovimentacaoController.listar]', err);
      res.status(500).json({ error: 'Erro interno ao listar movimentações de estoque.' });
    }
  }

  // GET /api/movimentacoes/produto/:id_produto
  static async buscarPorProduto(req: Request, res: Response): Promise<void> {
    try {
      const id_produto = Number(req.params.id_produto);
      if (!id_produto || isNaN(id_produto)) {
        res.status(400).json({ error: 'ID de produto inválido.' });
        return;
      }

      const movRepo = AppDataSource.getRepository(MovimentacaoEstoque);
      const movimentacoes = await movRepo.find({
        where: { id_produto },
        relations: ['produto', 'usuario'],
        order: { data_movimentacao: 'DESC', id_movimentacao: 'DESC' },
      });

      const resultado = movimentacoes.map((m) => ({
        id_movimentacao: m.id_movimentacao,
        id_produto: m.id_produto,
        sku: m.produto ? m.produto.sku : '',
        nome_produto: m.produto ? m.produto.nome : '',
        tipo: m.tipo,
        motivo: m.motivo,
        quantidade: m.quantidade,
        data: m.data_movimentacao,
        preco_unitario: m.preco_unitario ? Number(m.preco_unitario) : 0,
        valor_total: m.valor_total ? Number(m.valor_total) : 0,
        responsavel: m.responsavel || (m.usuario ? m.usuario.nome : 'Gestor RezFire'),
        codigo_pedido: m.codigo_pedido,
        detalhes_remessa: m.detalhes_remessa,
      }));

      res.json(resultado);
    } catch (err) {
      console.error('[MovimentacaoController.buscarPorProduto]', err);
      res.status(500).json({ error: 'Erro interno ao consultar histórico de movimentações do produto.' });
    }
  }

  // POST /api/movimentacoes
  static async criar(req: Request, res: Response): Promise<void> {
    try {
      const {
        id_produto,
        tipo,
        quantidade,
        motivo,
        data_movimentacao,
        preco_unitario,
        codigo_pedido,
        canal,
        tipo_envio,
        cliente,
        uf,
        detalhes_remessa,
        atualizar_produto_extintor,
      } = req.body;

      // 1. Validação do Produto
      const numIdProduto = Number(id_produto);
      if (!numIdProduto || isNaN(numIdProduto)) {
        res.status(400).json({ error: 'Informe um produto válido.' });
        return;
      }

      // 2. Validação da Quantidade
      const numQtd = Number(quantidade);
      if (!numQtd || isNaN(numQtd) || !Number.isInteger(numQtd) || numQtd <= 0) {
        res.status(400).json({ error: 'A quantidade deve ser um número inteiro maior que zero.' });
        return;
      }

      // 3. Validação do Tipo
      const tipoNormalizado =
        tipo && tipo.toString().toLowerCase().includes('ent') ? 'Entrada' : 'Saída';

      // 4. Validação do Motivo (obrigatório para Saída conforme critério de aceite 2)
      if (tipoNormalizado === 'Saída' && (!motivo || !motivo.toString().trim())) {
        res.status(400).json({ error: 'O motivo é obrigatório para operações de saída.' });
        return;
      }

      const motivoFinal = motivo ? motivo.toString().trim() : 'Nota Fiscal (Abastecimento)';

      // 5. Data da movimentação (critério de aceite 1 e 2)
      const dataFinal = data_movimentacao ? new Date(data_movimentacao) : new Date();
      if (isNaN(dataFinal.getTime())) {
        res.status(400).json({ error: 'Data de movimentação inválida.' });
        return;
      }

      // 6. Transação Atômica: Registrar movimentação e recalcular saldo do estoque
      const resultado = await AppDataSource.transaction(async (manager) => {
        const produtoRepo = manager.getRepository(Produto);
        const estoqueRepo = manager.getRepository(Estoque);
        const movRepo = manager.getRepository(MovimentacaoEstoque);

        const produto = await produtoRepo.findOne({
          where: { id_produto: numIdProduto },
          relations: ['estoque'],
        });

        if (!produto) {
          throw new Error('PRODUTO_NAO_ENCONTRADO');
        }

        // Recupera ou cria registro de estoque com bloqueio pessimista de escrita
        let estoque = await estoqueRepo.findOne({
          where: { produto: { id_produto: numIdProduto } },
          lock: { mode: 'pessimistic_write' },
        });

        if (!estoque) {
          estoque = estoqueRepo.create({
            produto,
            quantidade_atual: 0,
            estoque_minimo: 0,
          });
          estoque = await estoqueRepo.save(estoque);
        }

        const saldoAnterior = Number(estoque.quantidade_atual);
        let novoSaldo: number;

        if (tipoNormalizado === 'Entrada') {
          novoSaldo = saldoAnterior + numQtd;
        } else {
          // SCRUM-8: Bloquear saída quando a quantidade solicitada for maior que o saldo atual
          if (numQtd > saldoAnterior) {
            throw new Error(`ESTOQUE_INSUFICIENTE:${saldoAnterior}`);
          }
          novoSaldo = saldoAnterior - numQtd;
        }

        // Atualiza saldo no estoque (Recálculo automático - Critério de aceite 3)
        estoque.quantidade_atual = novoSaldo;
        await estoqueRepo.save(estoque);

        // Preço unitário e valor total
        const precoUn = preco_unitario !== undefined && preco_unitario !== null
          ? Number(preco_unitario)
          : Number(tipoNormalizado === 'Entrada' ? produto.custo : produto.preco);

        const valorTot = precoUn * numQtd;

        // Cria a movimentação
        const novaMovimentacao = movRepo.create({
          id_produto: produto.id_produto,
          tipo: tipoNormalizado,
          quantidade: numQtd,
          motivo: motivoFinal,
          data_movimentacao: dataFinal,
          preco_unitario: precoUn,
          valor_total: valorTot,
          responsavel: req.body.responsavel || 'Gestor RezFire',
          codigo_pedido: codigo_pedido ? codigo_pedido.toString().trim() : null,
          canal: canal || (tipoNormalizado === 'Entrada' ? 'Fornecedor' : 'Operação'),
          tipo_envio: tipo_envio || null,
          cliente: cliente ? cliente.toString().trim() : null,
          uf: uf || null,
          detalhes_remessa: detalhes_remessa || null,
        });

        const movimentacaoSalva = await movRepo.save(novaMovimentacao);

        // Se for extintor e foi marcado para atualizar cadastro principal com a nova remessa
        if (atualizar_produto_extintor && detalhes_remessa && tipoNormalizado === 'Entrada') {
          const currentDet = (produto.detalhes_extintor as Record<string, unknown>) || {};
          const updatedDet = {
            ...currentDet,
            ...(detalhes_remessa.validade ? { data_validade: detalhes_remessa.validade } : {}),
            ...(detalhes_remessa.fabricacao ? { data_fabricacao: detalhes_remessa.fabricacao } : {}),
            ...(detalhes_remessa.lacre ? { numero_lacre: detalhes_remessa.lacre } : {}),
            ...(detalhes_remessa.inmetro ? { registro_inmetro: detalhes_remessa.inmetro } : {}),
            ...(detalhes_remessa.lote ? { id_lote: detalhes_remessa.lote } : {}),
          };
          produto.detalhes_extintor = updatedDet;
          await produtoRepo.save(produto);
        }

        return {
          movimentacao: movimentacaoSalva,
          produto,
          saldoAnterior,
          novoSaldo,
        };
      });

      res.status(201).json({
        id_movimentacao: resultado.movimentacao.id_movimentacao,
        id_produto: resultado.produto.id_produto,
        sku: resultado.produto.sku,
        nome_produto: resultado.produto.nome,
        tipo: resultado.movimentacao.tipo,
        quantidade: resultado.movimentacao.quantidade,
        motivo: resultado.movimentacao.motivo,
        data: resultado.movimentacao.data_movimentacao,
        data_movimentacao: resultado.movimentacao.data_movimentacao,
        saldo_anterior: resultado.saldoAnterior,
        novo_saldo: resultado.novoSaldo,
        preco_unitario: resultado.movimentacao.preco_unitario,
        valor_total: resultado.movimentacao.valor_total,
        responsavel: resultado.movimentacao.responsavel,
        codigo_pedido: resultado.movimentacao.codigo_pedido,
        detalhes_remessa: resultado.movimentacao.detalhes_remessa,
      });
    } catch (err: any) {
      if (err.message === 'PRODUTO_NAO_ENCONTRADO') {
        res.status(404).json({ error: 'Produto informado não foi encontrado.' });
        return;
      }
      if (typeof err.message === 'string' && err.message.startsWith('ESTOQUE_INSUFICIENTE:')) {
        const saldoDisponivel = Number(err.message.split(':')[1]);
        res.status(400).json({
          error: `Operação bloqueada: a quantidade solicitada (${req.body.quantidade} un.) é maior que o saldo atual disponível (${saldoDisponivel} un.).`,
          saldo_disponivel: saldoDisponivel,
          quantidade_solicitada: Number(req.body.quantidade),
        });
        return;
      }
      console.error('[MovimentacaoController.criar]', err);
      res.status(500).json({ error: 'Erro interno ao registrar movimentação de estoque.' });
    }
  }
}
