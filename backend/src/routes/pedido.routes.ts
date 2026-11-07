import { Router } from 'express';
import { PedidoController } from '../controllers/pedido.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new PedidoController();

router.use(authMiddleware);

router.get('/', controller.listar);
router.get('/alertas-postagem', controller.obterAlertasPostagem);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar);
router.patch('/:id/status', controller.atualizarStatus);

export default router;

