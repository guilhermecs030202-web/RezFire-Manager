import { Request, Response } from 'express';
import { CertificadoService } from '../services/certificado.service';

const certificadoService = new CertificadoService();

export class CertificadoController {
  async listar(req: Request, res: Response) {
    try {
      const { tipo_entidade, entidade_id } = req.query;

      if (!tipo_entidade || !entidade_id) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'tipo_entidade e entidade_id são parâmetros obrigatórios.',
        });
      }

      const documentos = await certificadoService.listar(
        String(tipo_entidade).toUpperCase() as 'PRODUTO' | 'ANUNCIO',
        Number(entidade_id)
      );

      return res.json({ sucesso: true, documentos });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async upload(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'Nenhum arquivo enviado.',
        });
      }

      const { tipo_entidade, entidade_id } = req.body;

      if (!tipo_entidade || !entidade_id) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'tipo_entidade (PRODUTO | ANUNCIO) e entidade_id são obrigatórios.',
        });
      }

      const doc = await certificadoService.registrarDocumento({
        tipo_entidade: String(tipo_entidade).toUpperCase() as 'PRODUTO' | 'ANUNCIO',
        entidade_id: Number(entidade_id),
        nome_arquivo_original: req.file.originalname,
        caminho_disco: req.file.path,
        tamanho_bytes: req.file.size,
        mime_type: req.file.mimetype,
      });

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Documento anexado com sucesso.',
        documento: doc,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async remover(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const resultado = await certificadoService.remover(id);
      return res.json(resultado);
    } catch (error: any) {
      return res.status(404).json({ sucesso: false, mensagem: error.message });
    }
  }
}

