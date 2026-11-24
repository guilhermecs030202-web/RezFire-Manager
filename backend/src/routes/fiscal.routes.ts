import { Router } from 'express';
import { FiscalController } from '../controllers/fiscal.controller';
import { authMiddleware, requerPerfil } from '../middlewares/authMiddleware';
import { handleUploadCertificadoA1 } from '../middlewares/uploadCertificadoA1.middleware';

const router = Router();
const controller = new FiscalController();

router.use(authMiddleware);

// Consultas fiscais de apoio ao catálogo e validação pré-emissão (usuários autenticados)
router.get('/referencias', controller.obterReferencias);
router.get('/produtos/pendencias', controller.listarPendenciasProdutos);
router.post('/validar-emissao', controller.validarEmissao);
router.get('/pedidos/:id/nfe', controller.obterNFeDoPedido);

// Preparação, assinatura, transmissão SEFAZ e guarda/download de XML e DANFE
router.post('/pedidos/:id/preparar-nfe', requerPerfil(['GESTOR']), controller.prepararNFePedido);
router.post('/pedidos/:id/transmitir-nfe', requerPerfil(['GESTOR']), controller.transmitirNFePedido);
router.post('/pedidos/:id/consultar-nfe', requerPerfil(['GESTOR']), controller.consultarSituacaoNFePedido);
router.post('/pedidos/:id/cancelar-nfe', requerPerfil(['GESTOR']), controller.cancelarNFePedido);
router.post('/pedidos/:id/carta-correcao', requerPerfil(['GESTOR']), controller.registrarCartaCorrecaoPedido);
router.get('/pedidos/:id/nfe/transmissoes', controller.listarTransmissoesDoPedido);
router.get('/pedidos/:id/nfe/eventos', controller.listarEventosDoPedido);
router.get('/pedidos/:id/nfe/xml', requerPerfil(['GESTOR']), controller.baixarXmlPorPedido);
router.get('/pedidos/:id/nfe/danfe', controller.visualizarDanfePorPedido);
router.get('/notas', requerPerfil(['GESTOR']), controller.listarNotasFiscais);
router.get('/notas/:id/xml', requerPerfil(['GESTOR']), controller.baixarXmlNota);
router.get('/notas/:id/danfe', controller.visualizarDanfePorNota);
router.get('/eventos/:id/xml', requerPerfil(['GESTOR']), controller.baixarXmlEvento);
router.get('/inutilizacoes', requerPerfil(['GESTOR']), controller.listarInutilizacoes);
router.post('/inutilizacoes', requerPerfil(['GESTOR']), controller.inutilizarNumeracao);
router.get('/inutilizacoes/:id/xml', requerPerfil(['GESTOR']), controller.baixarXmlInutilizacao);
router.get('/sefaz/status', requerPerfil(['GESTOR']), controller.verificarStatusServicoSefaz);

// Configuração do emitente, certificado A1 e ambiente SEFAZ — estritamente restrita ao GESTOR (DoR 33a + #20)
router.get('/emitente', requerPerfil(['GESTOR']), controller.obterEmitente);
router.put('/emitente', requerPerfil(['GESTOR']), controller.salvarEmitente);
router.patch('/emitente/ambiente', requerPerfil(['GESTOR']), controller.alterarAmbiente);
router.get('/certificado/status', requerPerfil(['GESTOR']), controller.obterStatusCertificado);
router.post(
  '/emitente/certificado',
  requerPerfil(['GESTOR']),
  handleUploadCertificadoA1,
  controller.uploadCertificadoA1
);
router.delete('/emitente/certificado', requerPerfil(['GESTOR']), controller.removerCertificadoA1);

export default router;

