import { Request, Response } from 'express';
import { LancamentoFinanceiroService } from '../services/lancamentoFinanceiro.service';

const lancamentoService = new LancamentoFinanceiroService();

export class LancamentoFinanceiroController {
  async criar(req: Request, res: Response) {
    try {
      const idUsuario = (req as any).usuario?.id_usuario;
      const novo = await lancamentoService.criarLancamento(req.body, idUsuario);
      return res.status(201).json({
        sucesso: true,
        mensagem: 'Lançamento financeiro registrado com sucesso!',
        lancamento: novo,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async listar(req: Request, res: Response) {
    try {
      const { classificacao, tipo, categoria, data_inicio, data_fim, dias } = req.query;
      const lancamentos = await lancamentoService.listarLancamentos({
        classificacao: classificacao as any,
        tipo: tipo as any,
        categoria: categoria as string,
        data_inicio: data_inicio as string,
        data_fim: data_fim as string,
        dias: dias ? Number(dias) : undefined,
      });
      return res.json({ sucesso: true, lancamentos });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async buscarPorId(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const item = await lancamentoService.buscarPorId(id);
      if (!item) {
        return res.status(404).json({ sucesso: false, mensagem: 'Lançamento financeiro não encontrado.' });
      }
      return res.json({ sucesso: true, lancamento: item });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async atualizar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const atualizado = await lancamentoService.atualizarLancamento(id, req.body);
      return res.json({
        sucesso: true,
        mensagem: 'Lançamento financeiro atualizado com sucesso!',
        lancamento: atualizado,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async excluir(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const excluido = await lancamentoService.excluirLancamento(id);
      if (!excluido) {
        return res.status(404).json({ sucesso: false, mensagem: 'Lançamento não encontrado para exclusão.' });
      }
      return res.json({ sucesso: true, mensagem: 'Lançamento financeiro excluído com sucesso!' });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterRelatorioSegregacao(req: Request, res: Response) {
    try {
      const { dias, data_inicio, data_fim } = req.query;
      const relatorio = await lancamentoService.obterRelatorioSegregacao({
        dias: dias ? Number(dias) : 30,
        data_inicio: data_inicio as string,
        data_fim: data_fim as string,
      });
      return res.json(relatorio);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }
}
