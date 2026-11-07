import { Router } from 'express';
import { AnuncioController } from '../controllers/anuncio.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new AnuncioController();

router.use(authMiddleware);

// Rotas fixas antes das rotas dinâmicas :id
router.get('/', controller.listar);
router.get('/relatorios/recriados', controller.listarRecriados);

// Rotas dinâmicas por ID do anúncio
router.get('/:id', controller.buscarPorId);
router.get('/:id/historico', controller.listarHistorico);
router.post('/:id/historico', controller.adicionarOcorrencia);
router.post('/:id/marcar-recriado', controller.marcarRecriado);

export default router;
