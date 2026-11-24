import { Router } from 'express';
import { PurchaseOrderController } from '../controllers/purchaseOrder.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new PurchaseOrderController();

// Todas as rotas de pedidos de compra exigem autenticação do RezFire
router.use(authMiddleware);

router.get('/', controller.listar);
router.get('/proximo-numero', controller.proximoNumero);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar);
router.put('/:id', controller.atualizar);

// Recebimento total/parcial
router.post('/:id/receive', controller.receber);
router.post('/:id/receber', controller.receber);

// Cancelamento
router.patch('/:id/cancel', controller.cancelar);
router.patch('/:id/cancelar', controller.cancelar);

export default router;
