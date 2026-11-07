import fs from 'fs';
import path from 'path';
import { AppDataSource } from '../config/database';
import { DocumentoCertificacao } from '../entities/DocumentoCertificacao';

export class CertificadoService {
  private get docRepo() {
    return AppDataSource.getRepository(DocumentoCertificacao);
  }

  /**
   * Lista documentos vinculados a uma entidade (PRODUTO ou ANUNCIO)
   */
  async listar(tipo_entidade: 'PRODUTO' | 'ANUNCIO', entidade_id: number) {
    return this.docRepo.find({
      where: { tipo_entidade, entidade_id },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Busca um documento por ID
   */
  async buscarPorId(id_documento: number) {
    const doc = await this.docRepo.findOne({ where: { id_documento } });
    if (!doc) {
      throw new Error(`Documento #${id_documento} não encontrado.`);
    }
    return doc;
  }

  /**
   * Registra um novo documento após upload bem-sucedido
   */
  async registrarDocumento(dados: {
    tipo_entidade: 'PRODUTO' | 'ANUNCIO';
    entidade_id: number;
    nome_arquivo_original: string;
    caminho_disco: string;
    tamanho_bytes: number;
    mime_type: string;
  }) {
    const doc = this.docRepo.create({
      tipo_entidade: dados.tipo_entidade,
      entidade_id: dados.entidade_id,
      nome_arquivo_original: dados.nome_arquivo_original,
      caminho_disco: dados.caminho_disco,
      tamanho_bytes: dados.tamanho_bytes,
      mime_type: dados.mime_type,
    });

    return this.docRepo.save(doc);
  }

  /**
   * Remove um documento do banco e deleta o arquivo físico do disco local
   * Garantia de isolamento: Deletar documento do produto não afeta anúncios e vice-versa
   */
  async remover(id_documento: number) {
    const doc = await this.docRepo.findOne({ where: { id_documento } });
    if (!doc) {
      throw new Error(`Documento #${id_documento} não encontrado.`);
    }

    // Exclui arquivo físico do disco se existir
    if (fs.existsSync(doc.caminho_disco)) {
      try {
        fs.unlinkSync(doc.caminho_disco);
      } catch (err) {
        console.warn(`Não foi possível apagar arquivo físico ${doc.caminho_disco}:`, err);
      }
    }

    await this.docRepo.remove(doc);

    return {
      sucesso: true,
      mensagem: `Certificado "${doc.nome_arquivo_original}" removido com sucesso.`,
    };
  }
}

