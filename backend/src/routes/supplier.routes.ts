import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new SupplierController();

router.use(authMiddleware);

// Endpoints principais de fornecedores
router.get('/', controller.listar);
router.post('/', controller.criar);
router.get('/:id', controller.buscarPorId);
router.put('/:id', controller.atualizar);
router.patch('/:id/status', controller.alternarStatus);

// Endpoints de vínculo de produtos com fornecedor
router.get('/:id/products', controller.listarProdutos);
router.post('/:id/products', controller.vincularProduto);
router.put('/:id/products/:idProduto', controller.vincularProduto);
router.delete('/:id/products/:idProduto', controller.desvincularProduto);

export default router;
