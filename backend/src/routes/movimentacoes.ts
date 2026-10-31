import { Router } from 'express';
import { MovimentacaoController } from '../controllers/MovimentacaoController';

const router = Router();

router.get('/', MovimentacaoController.listar);
router.get('/produto/:id_produto', MovimentacaoController.buscarPorProduto);
router.post('/', MovimentacaoController.criar);

export default router;
