import { Router } from 'express';
import { ProdutoController } from '../controllers/ProdutoController';

const router = Router();

router.get('/', ProdutoController.listar);
router.get('/:id', ProdutoController.buscarPorId);
router.post('/', ProdutoController.criar);
router.put('/:id', ProdutoController.editar);
router.delete('/:id', ProdutoController.deletar);

export default router;
