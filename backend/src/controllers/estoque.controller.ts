import { Request, Response } from 'express';
import { EstoqueService } from '../services/estoque.service';

const estoqueService = new EstoqueService();

export class EstoqueController {
  async listar(req: Request, res: Response) {
    try {
      const itens = await estoqueService.listarEstoqueCompleto();
      return res.json({ sucesso: true, estoque: itens });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterAlertas(req: Request, res: Response) {
    try {
      const alertas = await estoqueService.obterAlertasOperacionais();
      return res.json({ sucesso: true, alertas });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }
}

