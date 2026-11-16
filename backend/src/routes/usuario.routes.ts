import { Router } from 'express';
import { UsuarioController } from '../controllers/usuario.controller';
import { authMiddleware, requerPerfil } from '../middlewares/authMiddleware';

const router = Router();
const controller = new UsuarioController();

// Todas as rotas de gerenciamento de usuários exigem autenticação e perfil GESTOR
router.use(authMiddleware);
router.use(requerPerfil(['GESTOR']));

router.get('/', (req, res, next) => controller.listar(req, res, next));
router.get('/:id', (req, res, next) => controller.obterPorId(req, res, next));
router.post('/', (req, res, next) => controller.criar(req, res, next));
router.put('/:id', (req, res, next) => controller.atualizar(req, res, next));
router.patch('/:id/status', (req, res, next) => controller.alternarStatus(req, res, next));
router.delete('/:id', (req, res, next) => controller.alternarStatus(req, res, next)); // suporte a delete como desativação

export default router;

