import { Router } from 'express';
import { PedidoController } from '../controllers/pedido.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new PedidoController();

router.use(authMiddleware);

router.get('/', controller.listar);
router.get('/alertas-postagem', controller.obterAlertasPostagem);
router.get('/estatisticas/devolucoes', controller.obterEstatisticasDevolucoes);
router.get('/resumo-lucro', controller.obterResumoLucro);
router.get('/comparativo-modalidades', controller.obterComparativoModalidades);
router.get('/:id', controller.buscarPorId);
router.get('/:id/lucro', controller.obterLucroPedido);
router.put('/:id/lucro', controller.calcularLucroPedido);
router.post('/', controller.criar);
router.post('/:id/devolucao', controller.registrarDevolucao);
router.patch('/:id/modalidade', controller.atualizarModalidade);
router.patch('/:id/status', controller.atualizarStatus);

export default router;

