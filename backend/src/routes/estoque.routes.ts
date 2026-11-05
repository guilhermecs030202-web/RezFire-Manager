import { Router } from 'express';
import { EstoqueController } from '../controllers/estoque.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new EstoqueController();

router.use(authMiddleware);

router.get('/', controller.listar);
router.get('/alertas', controller.obterAlertas);

export default router;

