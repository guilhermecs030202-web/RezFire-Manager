import { Router } from 'express';
import { ProdutoController } from '../controllers/produto.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new ProdutoController();

// Todas as rotas de produtos são protegidas pelo middleware de autenticação do gestor
router.use(authMiddleware);

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar);
router.put('/:id', controller.atualizar);
router.delete('/:id', controller.inativar);

export default router;

