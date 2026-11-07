import { Router } from 'express';
import { AlertaController } from '../controllers/alerta.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new AlertaController();

router.use(authMiddleware);

router.get('/central', controller.obterCentral);

export default router;

