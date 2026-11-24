import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new DashboardController();

router.use(authMiddleware);

router.get('/kpis', controller.obterKpis);
router.get('/graficos', controller.obterGraficos);
router.get('/impacto-quedas-anuncios', controller.obterImpactoQuedasAnuncios);
router.get('/customers', controller.obterMetricasClientes);
router.get('/clientes', controller.obterMetricasClientes);
router.get('/purchases', controller.obterMetricasCompras);
router.get('/compras', controller.obterMetricasCompras);
router.get('/returns', controller.obterMetricasDevolucoes);
router.get('/devolucoes', controller.obterMetricasDevolucoes);
router.get('/returns/recentes', controller.obterDevolucoesRecentes);
router.get('/devolucoes/recentes', controller.obterDevolucoesRecentes);
router.get('/fiscal', controller.obterMetricasFiscal);
router.get('/fiscal/notas', controller.obterNotasFiscaisTabela);

export default router;

