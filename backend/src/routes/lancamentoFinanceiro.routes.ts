import { Router } from 'express';
import { LancamentoFinanceiroController } from '../controllers/lancamentoFinanceiro.controller';
import { authMiddleware, requerPerfil } from '../middlewares/authMiddleware';

const router = Router();
const controller = new LancamentoFinanceiroController();

router.use(authMiddleware);
router.use(requerPerfil(['GESTOR'])); // Módulo financeiro estritamente restrito ao Gestor (AGENTS.md RBAC)

router.get('/relatorio-segregacao', controller.obterRelatorioSegregacao);
router.get('/lancamentos', controller.listar);
router.post('/lancamentos', controller.criar);
router.get('/lancamentos/:id', controller.buscarPorId);
router.put('/lancamentos/:id', controller.atualizar);
router.delete('/lancamentos/:id', controller.excluir);

export default router;

