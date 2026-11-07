import { Router } from 'express';
import authRoutes from './auth.routes';
import produtoRoutes from './produto.routes';
import estoqueRoutes from './estoque.routes';
import movimentacaoRoutes from './movimentacao.routes';
import pedidoRoutes from './pedido.routes';
import dashboardRoutes from './dashboard.routes';
import certificadoRoutes from './certificado.routes';
import mlRoutes from './mercadolivre.routes';
import inspecaoRoutes from './inspecao.routes';
import alertaRoutes from './alerta.routes';
import anuncioRoutes from './anuncio.routes';
import usuarioRoutes from './usuario.routes';
import notificacaoRoutes from './notificacao.routes';
import respostaPadraoRoutes from './respostaPadrao.routes';
import financeiroRoutes from './lancamentoFinanceiro.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/produtos', produtoRoutes);
router.use('/estoque', estoqueRoutes);
router.use('/movimentacoes', movimentacaoRoutes);
router.use('/pedidos', pedidoRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/certificados', certificadoRoutes);
router.use('/ml', mlRoutes);
router.use('/inspecoes', inspecaoRoutes);
router.use('/alertas', alertaRoutes);
router.use('/anuncios', anuncioRoutes);
router.use('/notificacoes', notificacaoRoutes);
router.use('/respostas-padrao', respostaPadraoRoutes);
router.use('/financeiro', financeiroRoutes);

export default router;
