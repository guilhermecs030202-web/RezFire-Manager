import { Router } from 'express';
import { CertificadoController } from '../controllers/certificado.controller';
import { authMiddleware } from '../middlewares/authMiddleware';
import { uploadCertificado } from '../middlewares/upload.middleware';

const router = Router();
const controller = new CertificadoController();

router.use(authMiddleware);

router.get('/', controller.listar);
router.get('/:id/download', controller.download);
router.post('/upload', uploadCertificado.single('arquivo'), controller.upload);
router.delete('/:id', controller.remover);

export default router;

