import { Router } from 'express';
import { NotificacaoController } from '../controllers/notificacao.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new NotificacaoController();

router.use(authMiddleware);

router.get('/', controller.listar);
router.put('/marcar-todas', controller.marcarTodasComoLidas);
router.put('/:id/lida', controller.marcarComoLida);

export default router;

