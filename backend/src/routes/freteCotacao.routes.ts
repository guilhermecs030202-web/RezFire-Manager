import { Router } from 'express';
import { FreteCotacaoController } from '../controllers/freteCotacao.controller';
import { authMiddleware, requerPerfil } from '../middlewares/authMiddleware';

const router = Router();
const freteController = new FreteCotacaoController();

// Todas as rotas exigem usuário autenticado
router.use(authMiddleware);

// Leitura da taxa padrão global: acessível a GESTOR e OPERADOR
router.get('/configuracoes', freteController.obterFreteConfiguracoes);

// Alteração da taxa padrão global: estritamente restrita ao perfil GESTOR
router.put(
  '/configuracoes',
  requerPerfil(['GESTOR']),
  freteController.atualizarFreteConfiguracoes
);

// Cálculo e geração stateless (sem persistência de cotações ou dados pessoais)
router.post('/calcular', freteController.calcularFreteStateless);

export default router;
