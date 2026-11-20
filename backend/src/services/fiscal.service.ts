import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { AppDataSource } from '../config/database';
import { env } from '../config/env';
import { EmitenteFiscal } from '../entities/EmitenteFiscal';
import { Pedido } from '../entities/Pedido';
import { Produto } from '../entities/Produto';
import { decryptBuffer, encryptBuffer, encryptText, sha256Hex } from '../utils/cryptoVault';
import { validarCertificadoA1 } from '../utils/certificadoA1Parser';
import {
  CFOPS_SUGERIDOS,
  CSOSN_LISTA,
  CST_LISTA,
  NCMS_SUGERIDOS_REZFIRE,
  ORIGENS_MERCADORIA,
  REGIMES_TRIBUTARIOS,
  UFS_VALIDAS,
  UNIDADES_COMERCIAIS_SUGERIDAS,
  avaliarAptidaoFiscalProduto,
  limparDigitos,
  validarCep,
  validarCnpj,
  validarInscricaoEstadual,
} from '../utils/fiscalValidator';
import { ProdutoService } from './produto.service';

export interface SalvarEmitenteDTO {
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj: string;
  inscricao_estadual: string;
  regime_tributario: '1' | '2' | '3' | '4';
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  municipio: string;
  codigo_municipio_ibge?: string | null;
  uf: string;
  serie_nfe: number;
  proximo_numero_nfe: number;
  ambiente?: 'homologacao' | 'producao';
  modo_integracao?: 'sefaz_direto' | 'intermediario';
  confirmacao_producao?: boolean;
  texto_confirmacao?: string;
}

export class FiscalService {
  private produtoService = new ProdutoService();

  private get emitenteRepo() {
    return AppDataSource.getRepository(EmitenteFiscal);
  }

  private get pedidoRepo() {
    return AppDataSource.getRepository(Pedido);
  }

  private get produtoRepo() {
    return AppDataSource.getRepository(Produto);
  }

  /**
   * Converte EmitenteFiscal para DTO público estritamente sanitizado.
   * Nunca retorna senha, hash ou caminho/arquivo do certificado A1.
   */
  public toEmitentePublicDTO(emitente: EmitenteFiscal | null) {
    if (!emitente) return null;

    const agora = new Date();
    const possuiCertificado = Boolean(
      emitente.certificado_cnpj && emitente.certificado_valido_ate
    );

    let diasRestantes: number | null = null;
    let certificadoStatus: 'nao_configurado' | 'valido' | 'vencendo' | 'vencido' =
      'nao_configurado';

    if (possuiCertificado && emitente.certificado_valido_ate) {
      const diffMs = new Date(emitente.certificado_valido_ate).getTime() - agora.getTime();
      diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diasRestantes < 0) {
        certificadoStatus = 'vencido';
      } else if (diasRestantes <= 30) {
        certificadoStatus = 'vencendo';
      } else {
        certificadoStatus = 'valido';
      }
    }

    const pendencias: string[] = [];
    if (!possuiCertificado) {
      pendencias.push('Certificado digital A1 (.pfx / .p12) não instalado.');
    } else if (certificadoStatus === 'vencido') {
      pendencias.push('Certificado digital A1 está vencido. Envie um novo certificado válido.');
    } else if (emitente.certificado_cnpj !== emitente.cnpj) {
      pendencias.push('CNPJ do certificado A1 diverge do CNPJ do emitente.');
    }

    if (!emitente.inscricao_estadual) {
      pendencias.push('Inscrição Estadual não informada.');
    }

    return {
      id_emitente: emitente.id_emitente,
      razao_social: emitente.razao_social,
      nome_fantasia: emitente.nome_fantasia,
      cnpj: emitente.cnpj,
      inscricao_estadual: emitente.inscricao_estadual,
      regime_tributario: emitente.regime_tributario,
      cep: emitente.cep,
      logradouro: emitente.logradouro,
      numero: emitente.numero,
      complemento: emitente.complemento,
      bairro: emitente.bairro,
      municipio: emitente.municipio,
      codigo_municipio_ibge: emitente.codigo_municipio_ibge,
      uf: emitente.uf,
      serie_nfe: Number(emitente.serie_nfe),
      proximo_numero_nfe: Number(emitente.proximo_numero_nfe),
      ambiente: emitente.ambiente,
      modo_integracao: emitente.modo_integracao,
      ambiente_producao_confirmado_em: emitente.ambiente_producao_confirmado_em,
      certificado_configurado: possuiCertificado,
      certificado_status: certificadoStatus,
      certificado_dias_restantes: diasRestantes,
      certificado_titular: emitente.certificado_titular,
      certificado_emissor: emitente.certificado_emissor,
      certificado_cnpj: emitente.certificado_cnpj,
      certificado_serial: emitente.certificado_serial,
      certificado_valido_de: emitente.certificado_valido_de,
      certificado_valido_ate: emitente.certificado_valido_ate,
      certificado_atualizado_em: emitente.certificado_atualizado_em,
      pronto_para_emissao: pendencias.length === 0,
      pendencias_emitente: pendencias,
      created_at: emitente.created_at,
      updated_at: emitente.updated_at,
    };
  }

  async obterEmitente() {
    const emitente = await this.emitenteRepo.findOne({ where: {} });
    return this.toEmitentePublicDTO(emitente);
  }

  async salvarEmitente(dados: SalvarEmitenteDTO, idUsuario?: number) {
    const razaoSocial = String(dados.razao_social || '').trim();
    if (razaoSocial.length < 3) {
      throw new Error('Razão Social é obrigatória (mínimo 3 caracteres).');
    }

    const cnpj = limparDigitos(dados.cnpj);
    if (!validarCnpj(cnpj)) {
      throw new Error('CNPJ inválido. Informe um CNPJ válido com 14 dígitos.');
    }

    const ie = String(dados.inscricao_estadual || '').trim().toUpperCase();
    if (!validarInscricaoEstadual(ie)) {
      throw new Error('Inscrição Estadual inválida (informe os dígitos da IE ou ISENTO).');
    }

    const regime = String(dados.regime_tributario || '1') as '1' | '2' | '3' | '4';
    if (!['1', '2', '3', '4'].includes(regime)) {
      throw new Error('Regime tributário inválido (CRT esperado: 1, 2, 3 ou 4).');
    }

    const cep = limparDigitos(dados.cep);
    if (!validarCep(cep)) {
      throw new Error('CEP inválido. Informe exatamente 8 dígitos.');
    }

    const logradouro = String(dados.logradouro || '').trim();
    const numero = String(dados.numero || '').trim();
    const bairro = String(dados.bairro || '').trim();
    const municipio = String(dados.municipio || '').trim();
    const uf = String(dados.uf || '').trim().toUpperCase();

    if (!logradouro || !numero || !bairro || !municipio) {
      throw new Error('Logradouro, Número, Bairro e Município do emitente são obrigatórios.');
    }
    if (!(UFS_VALIDAS as readonly string[]).includes(uf)) {
      throw new Error(`UF inválida ("${uf}"). Informe uma sigla de estado brasileiro válida (ex: SP).`);
    }

    let codigoIbge: string | null = null;
    if (dados.codigo_municipio_ibge !== undefined && dados.codigo_municipio_ibge !== null) {
      const ibgeClean = limparDigitos(dados.codigo_municipio_ibge);
      if (ibgeClean.length > 0) {
        if (ibgeClean.length !== 7) {
          throw new Error('Código IBGE do município deve conter exatamente 7 dígitos (ex: 3550308 para São Paulo).');
        }
        codigoIbge = ibgeClean;
      }
    }

    const serieNfe = Number(dados.serie_nfe);
    if (!Number.isInteger(serieNfe) || serieNfe < 1 || serieNfe > 999) {
      throw new Error('Série da NF-e inválida: informe um número inteiro entre 1 e 999.');
    }

    const proximoNumero = Number(dados.proximo_numero_nfe);
    if (!Number.isInteger(proximoNumero) || proximoNumero < 1 || proximoNumero > 999999999) {
      throw new Error('Próximo número de NF-e inválido: informe um inteiro maior ou igual a 1.');
    }

    const modoIntegracao =
      dados.modo_integracao === 'intermediario' ? 'intermediario' : 'sefaz_direto';

    let emitente = await this.emitenteRepo.findOne({ where: {} });

    if (emitente) {
      if (emitente.certificado_cnpj && emitente.certificado_cnpj !== cnpj) {
        throw new Error(
          'Não é possível alterar o CNPJ enquanto houver um certificado digital A1 vinculado ao CNPJ anterior. Remova o certificado atual primeiro.'
        );
      }

      if (dados.ambiente === 'producao' && emitente.ambiente !== 'producao') {
        this.validarConfirmacaoProducao(
          emitente,
          dados.confirmacao_producao,
          dados.texto_confirmacao
        );
        emitente.ambiente = 'producao';
        emitente.ambiente_producao_confirmado_em = new Date();
        emitente.ambiente_producao_confirmado_por = idUsuario || null;
      } else if (dados.ambiente === 'homologacao') {
        emitente.ambiente = 'homologacao';
      }

      emitente.razao_social = razaoSocial;
      emitente.nome_fantasia = dados.nome_fantasia ? String(dados.nome_fantasia).trim() : null;
      emitente.cnpj = cnpj;
      emitente.inscricao_estadual = ie;
      emitente.regime_tributario = regime;
      emitente.cep = cep;
      emitente.logradouro = logradouro;
      emitente.numero = numero;
      emitente.complemento = dados.complemento ? String(dados.complemento).trim() : null;
      emitente.bairro = bairro;
      emitente.municipio = municipio;
      emitente.codigo_municipio_ibge = codigoIbge;
      emitente.uf = uf;
      emitente.serie_nfe = serieNfe;
      emitente.proximo_numero_nfe = proximoNumero;
      emitente.modo_integracao = modoIntegracao;
    } else {
      if (dados.ambiente === 'producao') {
        throw new Error(
          'O emitente fiscal deve iniciar no ambiente de homologação (testes). Cadastre o emitente, instale o certificado A1 e só então ative a produção mediante confirmação explícita.'
        );
      }

      emitente = this.emitenteRepo.create({
        razao_social: razaoSocial,
        nome_fantasia: dados.nome_fantasia ? String(dados.nome_fantasia).trim() : null,
        cnpj,
        inscricao_estadual: ie,
        regime_tributario: regime,
        cep,
        logradouro,
        numero,
        complemento: dados.complemento ? String(dados.complemento).trim() : null,
        bairro,
        municipio,
        codigo_municipio_ibge: codigoIbge,
        uf,
        serie_nfe: serieNfe,
        proximo_numero_nfe: proximoNumero,
        ambiente: 'homologacao',
        modo_integracao: modoIntegracao,
      });
    }

    const salvo = await this.emitenteRepo.save(emitente);
    return this.toEmitentePublicDTO(salvo);
  }

  private validarConfirmacaoProducao(
    emitente: EmitenteFiscal,
    confirmacaoProducao?: boolean,
    textoConfirmacao?: string
  ) {
    if (
      confirmacaoProducao !== true ||
      String(textoConfirmacao || '').trim().toUpperCase() !== 'ATIVAR PRODUCAO'
    ) {
      throw new Error(
        'Para ativar o ambiente de PRODUÇÃO (validade jurídica na SEFAZ), é obrigatória confirmação explícita marcando a ciência e digitando "ATIVAR PRODUCAO".'
      );
    }

    if (!emitente.certificado_cnpj || !emitente.certificado_valido_ate) {
      throw new Error(
        'Não é possível ativar o ambiente de produção sem um certificado digital A1 válido instalado.'
      );
    }

    if (new Date() > new Date(emitente.certificado_valido_ate)) {
      throw new Error(
        'Não é possível ativar o ambiente de produção com certificado digital vencido.'
      );
    }
  }

  async alterarAmbiente(
    ambiente: 'homologacao' | 'producao',
    confirmacaoProducao?: boolean,
    textoConfirmacao?: string,
    idUsuario?: number
  ) {
    if (!['homologacao', 'producao'].includes(ambiente)) {
      throw new Error('Ambiente fiscal inválido. Valores aceitos: homologacao ou producao.');
    }

    const emitente = await this.emitenteRepo.findOne({ where: {} });
    if (!emitente) {
      throw new Error('Cadastre os dados do emitente fiscal antes de alterar o ambiente.');
    }

    if (ambiente === 'producao') {
      this.validarConfirmacaoProducao(emitente, confirmacaoProducao, textoConfirmacao);
      emitente.ambiente = 'producao';
      emitente.ambiente_producao_confirmado_em = new Date();
      emitente.ambiente_producao_confirmado_por = idUsuario || null;
    } else {
      emitente.ambiente = 'homologacao';
    }

    const salvo = await this.emitenteRepo.save(emitente);
    return this.toEmitentePublicDTO(salvo);
  }

  async instalarCertificadoA1(pfxBuffer: Buffer, senha: string) {
    const emitente = await this.emitenteRepo
      .createQueryBuilder('e')
      .addSelect(['e.certificado_arquivo_enc'])
      .getOne();

    if (!emitente) {
      throw new Error(
        'Cadastre e salve os dados do emitente fiscal antes de enviar o certificado digital A1.'
      );
    }

    // 1. Valida em memória antes de cifrar/gravar: senha, validade e compatibilidade do CNPJ
    const meta = validarCertificadoA1(pfxBuffer, senha, emitente.cnpj);

    // 2. Cifra o binário e a senha com AES-256-GCM
    const encryptedPfx = encryptBuffer(pfxBuffer);
    const encryptedPassword = encryptText(senha);
    const hashSha256 = sha256Hex(pfxBuffer);

    if (!fs.existsSync(env.FISCAL_VAULT_DIR)) {
      fs.mkdirSync(env.FISCAL_VAULT_DIR, { recursive: true });
    }

    const novoNomeArquivo = `emitente-${emitente.id_emitente}-${Date.now()}-${randomUUID().slice(0, 8)}.pfx.enc`;
    const novoCaminho = path.join(env.FISCAL_VAULT_DIR, novoNomeArquivo);
    const arquivoAnterior = emitente.certificado_arquivo_enc;

    fs.writeFileSync(novoCaminho, encryptedPfx, { mode: 0o600 });

    try {
      emitente.certificado_arquivo_enc = novoNomeArquivo;
      emitente.senha_certificado_enc = encryptedPassword;
      emitente.certificado_hash_sha256 = hashSha256;
      emitente.certificado_titular = meta.titular;
      emitente.certificado_emissor = meta.emissor;
      emitente.certificado_cnpj = meta.cnpj;
      emitente.certificado_serial = meta.serial;
      emitente.certificado_valido_de = meta.valido_de;
      emitente.certificado_valido_ate = meta.valido_ate;
      emitente.certificado_atualizado_em = new Date();

      const salvo = await this.emitenteRepo.save(emitente);

      // Remove arquivo anterior apenas após confirmação no banco
      if (arquivoAnterior && arquivoAnterior !== novoNomeArquivo) {
        const caminhoAnterior = path.join(env.FISCAL_VAULT_DIR, path.basename(arquivoAnterior));
        if (fs.existsSync(caminhoAnterior)) {
          fs.unlinkSync(caminhoAnterior);
        }
      }

      return this.toEmitentePublicDTO(salvo);
    } catch (error) {
      // Rollback do arquivo recém-gravado em caso de falha na persistência
      if (fs.existsSync(novoCaminho)) {
        fs.unlinkSync(novoCaminho);
      }
      throw error;
    }
  }

  async removerCertificadoA1() {
    const emitente = await this.emitenteRepo
      .createQueryBuilder('e')
      .addSelect(['e.certificado_arquivo_enc'])
      .getOne();

    if (!emitente) {
      throw new Error('Emitente fiscal não cadastrado.');
    }

    const arquivoAtual = emitente.certificado_arquivo_enc;
    if (arquivoAtual) {
      const caminho = path.join(env.FISCAL_VAULT_DIR, path.basename(arquivoAtual));
      if (fs.existsSync(caminho)) {
        fs.unlinkSync(caminho);
      }
    }

    emitente.certificado_arquivo_enc = null;
    emitente.senha_certificado_enc = null;
    emitente.certificado_hash_sha256 = null;
    emitente.certificado_titular = null;
    emitente.certificado_emissor = null;
    emitente.certificado_cnpj = null;
    emitente.certificado_serial = null;
    emitente.certificado_valido_de = null;
    emitente.certificado_valido_ate = null;
    emitente.certificado_atualizado_em = new Date();

    // Segurança: não mantém ambiente em produção sem certificado A1
    if (emitente.ambiente === 'producao') {
      emitente.ambiente = 'homologacao';
    }

    const salvo = await this.emitenteRepo.save(emitente);
    return this.toEmitentePublicDTO(salvo);
  }

  /**
   * Método interno para uso futuro das stories 33c/33d (assinatura XML).
   * Nunca expor o retorno em rotas HTTP.
   */
  async carregarSegredosCertificadoParaAssinatura(): Promise<{
    pfxBuffer: Buffer;
    cnpj: string;
    validoAte: Date;
  }> {
    const emitente = await this.emitenteRepo
      .createQueryBuilder('e')
      .addSelect([
        'e.certificado_arquivo_enc',
        'e.senha_certificado_enc',
      ])
      .getOne();

    if (!emitente || !emitente.certificado_arquivo_enc || !emitente.senha_certificado_enc) {
      throw new Error('Certificado digital A1 não configurado no emitente.');
    }

    const caminho = path.join(env.FISCAL_VAULT_DIR, path.basename(emitente.certificado_arquivo_enc));
    if (!fs.existsSync(caminho)) {
      throw new Error('Arquivo cifrado do certificado digital não localizado no cofre.');
    }

    const pfxBuffer = decryptBuffer(fs.readFileSync(caminho));
    return {
      pfxBuffer,
      cnpj: emitente.cnpj,
      validoAte: emitente.certificado_valido_ate!,
    };
  }

  obterReferenciasFiscais() {
    return {
      ufs: UFS_VALIDAS,
      regimes_tributarios: REGIMES_TRIBUTARIOS,
      origens_mercadoria: ORIGENS_MERCADORIA,
      csosn_lista: CSOSN_LISTA,
      cst_lista: CST_LISTA,
      cfops_sugeridos: CFOPS_SUGERIDOS,
      ncms_sugeridos: NCMS_SUGERIDOS_REZFIRE,
      unidades_comerciais: UNIDADES_COMERCIAIS_SUGERIDAS,
    };
  }

  async listarPendenciasFiscaisProdutos() {
    const produtos = await this.produtoService.listarTodos(undefined, undefined, true);
    const aptos = produtos.filter((p: any) => p.fiscal_status?.apto_nfe);
    const pendentes = produtos.filter((p: any) => !p.fiscal_status?.apto_nfe);
    const total = produtos.length;

    return {
      total_produtos: total,
      total_aptos: aptos.length,
      total_pendentes: pendentes.length,
      percentual_cobertura: total > 0 ? Math.round((aptos.length / total) * 100) : 0,
      produtos,
    };
  }

  async validarProntidaoEmissao(payload: {
    id_pedido?: number;
    itens?: { id_produto: number; quantidade?: number }[];
  }) {
    const emitenteDto = await this.obterEmitente();
    const bloqueiosEmitente: string[] = [];

    if (!emitenteDto) {
      bloqueiosEmitente.push('Emitente fiscal ainda não configurado (Story 33a).');
    } else if (!emitenteDto.pronto_para_emissao) {
      bloqueiosEmitente.push(...emitenteDto.pendencias_emitente);
    }

    const itensParaValidar: { produto: Produto; quantidade: number }[] = [];

    if (payload.id_pedido) {
      const pedido = await this.pedidoRepo.findOne({
        where: { id_pedido: Number(payload.id_pedido) },
        relations: ['itens', 'itens.produto'],
      });
      if (!pedido) {
        throw new Error(`Pedido #${payload.id_pedido} não encontrado.`);
      }
      for (const item of pedido.itens || []) {
        if (item.produto) {
          itensParaValidar.push({ produto: item.produto, quantidade: item.quantidade });
        }
      }
    } else if (Array.isArray(payload.itens) && payload.itens.length > 0) {
      for (const itemReq of payload.itens) {
        const prod = await this.produtoRepo.findOne({
          where: { id_produto: Number(itemReq.id_produto) },
        });
        if (!prod) {
          throw new Error(`Produto #${itemReq.id_produto} não encontrado.`);
        }
        itensParaValidar.push({
          produto: prod,
          quantidade: Number(itemReq.quantidade || 1),
        });
      }
    }

    const regimeAtual = emitenteDto?.regime_tributario || null;
    const produtosBloqueados: {
      id_produto: number;
      sku: string;
      nome: string;
      campos_faltantes: string[];
      alertas_fiscais: string[];
    }[] = [];
    const alertasFiscais: string[] = [];

    for (const entry of itensParaValidar) {
      const aval = avaliarAptidaoFiscalProduto(entry.produto, regimeAtual);
      if (!aval.apto_nfe) {
        produtosBloqueados.push({
          id_produto: entry.produto.id_produto,
          sku: entry.produto.sku,
          nome: entry.produto.nome,
          campos_faltantes: aval.campos_faltantes,
          alertas_fiscais: aval.alertas_fiscais,
        });
      }
      if (aval.alertas_fiscais.length > 0) {
        for (const a of aval.alertas_fiscais) {
          alertasFiscais.push(`[${entry.produto.sku}] ${a}`);
        }
      }
    }

    const apto = bloqueiosEmitente.length === 0 && produtosBloqueados.length === 0;
    let resumo = 'Emitente e todos os produtos estão aptos para emissão de NF-e.';
    if (!apto) {
      const partes: string[] = [];
      if (bloqueiosEmitente.length > 0) {
        partes.push(`${bloqueiosEmitente.length} pendência(s) no emitente fiscal`);
      }
      if (produtosBloqueados.length > 0) {
        partes.push(`${produtosBloqueados.length} produto(s) com dados fiscais incompletos`);
      }
      resumo = `Emissão bloqueada: ${partes.join(' e ')}.`;
    }

    return {
      apto,
      resumo,
      bloqueios_emitente: bloqueiosEmitente,
      produtos_bloqueados: produtosBloqueados,
      alertas_fiscais: alertasFiscais,
    };
  }
}

