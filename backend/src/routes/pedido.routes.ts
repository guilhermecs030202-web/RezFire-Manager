import { Router } from 'express';
import { PedidoController } from '../controllers/pedido.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new PedidoController();

router.use(authMiddleware);

router.get('/', controller.listar);
router.get('/alertas-postagem', controller.obterAlertasPostagem);
router.get('/estatisticas/devolucoes', controller.obterEstatisticasDevolucoes);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar);
router.post('/:id/devolucao', controller.registrarDevolucao);
router.patch('/:id/status', controller.atualizarStatus);

export default router;

