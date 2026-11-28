import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { CustomerDashboardService } from '../services/customerDashboard.service';
import { PurchaseDashboardService } from '../services/purchaseDashboard.service';
import { ReturnDashboardService } from '../services/returnDashboard.service';
import { FiscalDashboardService } from '../services/fiscalDashboard.service';
import { RadarDashboardService } from '../services/radarDashboard.service';

const dashboardService = new DashboardService();
const customerDashboardService = new CustomerDashboardService();
const purchaseDashboardService = new PurchaseDashboardService();
const returnDashboardService = new ReturnDashboardService();
const fiscalDashboardService = new FiscalDashboardService();
const radarDashboardService = new RadarDashboardService();

export class DashboardController {
  async obterVisaoGeral(req: Request, res: Response) {
    try {
      const dias = req.query.dias ? Number(req.query.dias) : 30;
      const perfil = req.usuario?.perfil || 'GESTOR';
      const resultado = await radarDashboardService.obterVisaoGeral(dias, perfil);
      return res.json(resultado);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }
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

  async obterImpactoQuedasAnuncios(req: Request, res: Response) {
    try {
      const dias = req.query.dias ? Number(req.query.dias) : 30;
      const resultado = await dashboardService.obterImpactoQuedasAnuncios(dias);
      return res.json(resultado);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterMetricasClientes(req: Request, res: Response) {
    try {
      const { from, to, dias, source, diasInativo } = req.query;
      const resultado = await customerDashboardService.obterMetricasClientes({
        from: from ? String(from) : undefined,
        to: to ? String(to) : undefined,
        dias: dias ? Number(dias) : 30,
        source: source ? (String(source) as any) : 'ALL',
        diasInativo: diasInativo ? Number(diasInativo) : undefined,
      });
      return res.json(resultado);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterMetricasCompras(req: Request, res: Response) {
    try {
      const { from, to, dias, supplierId, categoryId } = req.query;
      const resultado = await purchaseDashboardService.obterMetricasCompras({
        from: from ? String(from) : undefined,
        to: to ? String(to) : undefined,
        dias: dias ? Number(dias) : 30,
        supplierId: supplierId ? (supplierId === 'ALL' ? 'ALL' : Number(supplierId)) : 'ALL',
        categoryId: categoryId ? String(categoryId) : 'ALL',
      });
      return res.json(resultado);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterMetricasDevolucoes(req: Request, res: Response) {
    try {
      const { from, to, dias, motivo, categoryId, supplierId } = req.query;
      const resultado = await returnDashboardService.obterMetricasDevolucoes({
        from: from ? String(from) : undefined,
        to: to ? String(to) : undefined,
        dias: dias ? Number(dias) : 30,
        motivo: motivo ? String(motivo) : 'ALL',
        categoryId: categoryId ? String(categoryId) : 'ALL',
        supplierId: supplierId ? (supplierId === 'ALL' ? 'ALL' : Number(supplierId)) : 'ALL',
      });
      return res.json(resultado);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterDevolucoesRecentes(req: Request, res: Response) {
    try {
      const { page, limit, motivo, status, categoryId, supplierId } = req.query;
      const resultado = await returnDashboardService.obterDevolucoesRecentes({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
        motivo: motivo ? String(motivo) : undefined,
        status: status ? String(status) : undefined,
        categoryId: categoryId ? String(categoryId) : undefined,
        supplierId: supplierId && supplierId !== 'ALL' ? Number(supplierId) : undefined,
      });
      return res.json(resultado);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterMetricasFiscal(req: Request, res: Response) {
    try {
      const { from, to, dias, status, tipo, partnerId } = req.query;
      const resultado = await fiscalDashboardService.obterMetricasFiscal({
        from: from ? String(from) : undefined,
        to: to ? String(to) : undefined,
        dias: dias ? Number(dias) : 30,
        status: status ? String(status) : 'ALL',
        tipo: tipo ? String(tipo) : 'ALL',
        partnerId: partnerId ? String(partnerId) : 'ALL',
      });
      return res.json(resultado);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterNotasFiscaisTabela(req: Request, res: Response) {
    try {
      const { page, limit, status, tipo, search, from, to, sortBy, sortOrder } = req.query;
      const resultado = await fiscalDashboardService.obterNotasFiscaisTabela({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
        status: status ? String(status) : undefined,
        tipo: tipo ? String(tipo) : undefined,
        search: search ? String(search) : undefined,
        from: from ? String(from) : undefined,
        to: to ? String(to) : undefined,
        sortBy: sortBy ? String(sortBy) : undefined,
        sortOrder: sortOrder === 'ASC' ? 'ASC' : 'DESC',
      });
      return res.json(resultado);
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }
}

