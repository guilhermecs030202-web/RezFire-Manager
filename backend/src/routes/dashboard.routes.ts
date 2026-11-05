import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new DashboardController();

router.use(authMiddleware);

router.get('/kpis', controller.obterKpis);
router.get('/graficos', controller.obterGraficos);

export default router;

