import { Router } from 'express';
import { InspecaoController } from '../controllers/inspecao.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new InspecaoController();

// Todas as rotas de inspeção são protegidas conforme AGENTS.md
router.use(authMiddleware);

router.get('/resumo', controller.obterResumo);
router.get('/pedido/:id_pedido', controller.buscarPorPedido);
router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.registrar);

export default router;

