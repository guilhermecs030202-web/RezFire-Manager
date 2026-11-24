import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new CustomerController();

router.use(authMiddleware);

router.get('/', controller.listar);
router.post('/', controller.criar);
router.get('/:id', controller.buscarPorId);
router.put('/:id', controller.atualizar);

export default router;
