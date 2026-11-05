import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';

const dashboardService = new DashboardService();

export class DashboardController {
  async obterKpis(req: Request, res: Response) {
    try {
      const dias = req.query.dias ? Number(req.query.dias) : 30;
      const kpis = await dashboardService.obterKpis(dias);
      return res.json({ sucesso: true, kpis });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterGraficos(req: Request, res: Response) {
    try {
      const dias = req.query.dias ? Number(req.query.dias) : 30;
      const graficos = await dashboardService.obterSeriesGraficos(dias);
      return res.json({ sucesso: true, graficos });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }
}

