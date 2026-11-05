import { Router } from 'express';
import { MovimentacaoController } from '../controllers/movimentacao.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new MovimentacaoController();

router.use(authMiddleware);

router.get('/', controller.listar);
router.post('/', controller.registrar);
router.post('/ajuste-inventario', controller.ajustarInventario);

export default router;

