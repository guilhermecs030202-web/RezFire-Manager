import { Router } from 'express';
import { RespostaPadraoController } from '../controllers/respostaPadrao.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new RespostaPadraoController();

router.use(authMiddleware);

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar);
router.put('/:id', controller.atualizar);
router.delete('/:id', controller.excluir);
router.post('/:id/copiar', controller.incrementarUso);

export default router;

