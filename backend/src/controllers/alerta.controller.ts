import { Request, Response } from 'express';
import { AlertaService } from '../services/alerta.service';

const alertaService = new AlertaService();

export class AlertaController {
  /**
   * Retorna os alertas operacionais unificados do sistema (SCRUM-24 / #19)
   */
  async obterCentral(req: Request, res: Response) {
    try {
      const dados = await alertaService.obterCentralAlertas();
      return res.status(200).json({
        sucesso: true,
        ...dados,
      });
    } catch (err: any) {
      console.error('Erro ao obter central de alertas:', err);
      return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro interno ao consultar a central unificada de alertas.',
        erro: err.message,
      });
    }
  }
}

