import { Router } from 'express';
import { MercadoLivreController } from '../controllers/mercadolivre.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new MercadoLivreController();

// 1. Webhook receptor do Mercado Livre (Público, chamado pelos servidores do ML)
router.post('/webhook', controller.webhook);

// 2. Callback OAuth do Mercado Livre (Redirecionamento do navegador)
router.get('/callback', controller.callback);

// 3. Rotas operacionais e administrativas (Protegidas por autenticação do gestor)
router.get('/auth', authMiddleware, controller.getAuthUrl);
router.get('/status', authMiddleware, controller.obterStatusConexao);
router.post('/desconectar', authMiddleware, controller.desconectar);
router.get('/anuncios', authMiddleware, controller.listarAnuncios);
router.get('/anuncios/consultar', authMiddleware, controller.consultarAnunciosSobDemanda);
router.post('/anuncios/consultar', authMiddleware, controller.consultarAnunciosSobDemanda);
router.get('/anuncios/sincronizar-status', authMiddleware, controller.obterStatusSincronizacao);
router.post('/anuncios/sincronizar-status', authMiddleware, controller.sincronizarStatusAnuncios);
router.post('/anuncios/vincular', authMiddleware, controller.vincularProduto);
router.get('/pedidos/sincronizacao-status', authMiddleware, controller.obterStatusSincronizacaoPedidos);
router.post('/pedidos/sincronizar', authMiddleware, controller.sincronizarPedidos);
router.post('/sincronizar', authMiddleware, controller.sincronizar);

export default router;

