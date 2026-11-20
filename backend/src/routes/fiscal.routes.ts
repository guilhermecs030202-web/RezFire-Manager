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

// Preparação, assinatura, transmissão SEFAZ e download de XML — transmissão/preparação restritas ao GESTOR
router.post('/pedidos/:id/preparar-nfe', requerPerfil(['GESTOR']), controller.prepararNFePedido);
router.post('/pedidos/:id/transmitir-nfe', requerPerfil(['GESTOR']), controller.transmitirNFePedido);
router.post('/pedidos/:id/consultar-nfe', requerPerfil(['GESTOR']), controller.consultarSituacaoNFePedido);
router.get('/pedidos/:id/nfe/transmissoes', controller.listarTransmissoesDoPedido);
router.get('/notas/:id/xml', requerPerfil(['GESTOR']), controller.baixarXmlNota);
router.get('/sefaz/status', requerPerfil(['GESTOR']), controller.verificarStatusServicoSefaz);

// Configuração do emitente, certificado A1 e ambiente SEFAZ — estritamente restrita ao GESTOR (DoR 33a + #20)
router.get('/emitente', requerPerfil(['GESTOR']), controller.obterEmitente);
router.put('/emitente', requerPerfil(['GESTOR']), controller.salvarEmitente);
router.patch('/emitente/ambiente', requerPerfil(['GESTOR']), controller.alterarAmbiente);
router.post(
  '/emitente/certificado',
  requerPerfil(['GESTOR']),
  handleUploadCertificadoA1,
  controller.uploadCertificadoA1
);
router.delete('/emitente/certificado', requerPerfil(['GESTOR']), controller.removerCertificadoA1);

export default router;

