import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { AppDataSource } from '../config/database';
import { env } from '../config/env';
import { EmitenteFiscal } from '../entities/EmitenteFiscal';
import { Pedido } from '../entities/Pedido';
import { Produto } from '../entities/Produto';
import { NotaFiscal } from '../entities/NotaFiscal';
import { NotaFiscalItem } from '../entities/NotaFiscalItem';
import {
  NotaFiscalTransmissao,
  ResultadoTransmissao,
  TipoOperacaoTransmissao,
} from '../entities/NotaFiscalTransmissao';
import {
  decryptBuffer,
  decryptText,
  encryptBuffer,
  encryptText,
  sha256Hex,
} from '../utils/cryptoVault';
import { validarCertificadoA1 } from '../utils/certificadoA1Parser';
import { montarXmlNFe400, validarDadosParaNFe } from '../utils/nfeBuilder';
import { assinarXmlNFe } from '../utils/nfeSigner';
import { gerarHtmlDanfe } from '../utils/danfeGenerator';
import {
  CenarioSimulacaoSefaz,
  consultarProtocoloSefaz,
  consultarStatusServicoSefaz,
  enviarAutorizacaoSefaz,
  ModoTransporteSefaz,
  ResultadoChamadaSefaz,
} from '../utils/sefazClient';
import { interpretarCodigoSefaz } from '../utils/sefazCodigos';
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

  private get notaFiscalRepo() {
    return AppDataSource.getRepository(NotaFiscal);
  }

  private get transmissaoRepo() {
    return AppDataSource.getRepository(NotaFiscalTransmissao);
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
    const senha = decryptText(emitente.senha_certificado_enc);
    return {
      pfxBuffer,
      cnpj: emitente.cnpj,
      validoAte: emitente.certificado_valido_ate!,
    };
  }

  private carregarPfxESenhaDeEmitente(emitente: EmitenteFiscal): {
    pfxBuffer: Buffer;
    senha: string;
  } {
    if (!emitente.certificado_arquivo_enc || !emitente.senha_certificado_enc) {
      throw new Error('Certificado digital A1 não configurado no emitente.');
    }

    const caminho = path.join(env.FISCAL_VAULT_DIR, path.basename(emitente.certificado_arquivo_enc));
    if (!fs.existsSync(caminho)) {
      throw new Error('Arquivo cifrado do certificado digital não localizado no cofre.');
    }

    return {
      pfxBuffer: decryptBuffer(fs.readFileSync(caminho)),
      senha: decryptText(emitente.senha_certificado_enc),
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

  /**
   * Consulta a última NF-e preparada/emitida de um pedido + histórico de transmissões + prontidão atual (Stories 33c/33d).
   */
  async obterNFeDoPedido(id_pedido: number) {
    const pedido = await this.pedidoRepo.findOne({
      where: { id_pedido },
      relations: ['itens', 'itens.produto'],
    });
    if (!pedido) {
      throw new Error(`Pedido #${id_pedido} não encontrado.`);
    }

    const emitente = await this.emitenteRepo.findOne({ where: {} });
    const erros = validarDadosParaNFe(emitente, pedido);

    const notaFiscal = await this.notaFiscalRepo.findOne({
      where: { id_pedido },
      relations: ['itens'],
      order: { id_nota_fiscal: 'DESC' },
    });

    const permissoesTransmissoes = await this.listarTransmissoesDoPedido(id_pedido);

    return {
      status_fiscal: notaFiscal ? notaFiscal.status : 'sem_nota',
      nota_fiscal: notaFiscal || null,
      transmissoes: permissoesTransmissoes.transmissoes,
      prontidao_atual: {
        apto: erros.length === 0,
        erros_validacao: erros,
      },
    };
  }

  /**
   * Story 33c/33d: Monta o XML NF-e v4.00 a partir de um pedido, valida todos os dados obrigatórios,
   * garante numeração sequencial atômica (com lock pessimista) e assina digitalmente com o A1.
   * Quando a nota estiver rejeitada (33d), permite corrigir e regerar mantendo a numeração ou avançando número (ex: cStat 204/539).
   */
  async prepararNFePedido(
    id_pedido: number,
    opcoes: { regerar?: boolean; avancar_numero?: boolean } = {}
  ) {
    const pedido = await this.pedidoRepo.findOne({
      where: { id_pedido },
      relations: ['itens', 'itens.produto'],
    });
    if (!pedido) {
      throw new Error(`Pedido #${id_pedido} não encontrado.`);
    }

    const emitenteCheck = await this.emitenteRepo.findOne({ where: {} });
    const erros = validarDadosParaNFe(emitenteCheck, pedido);
    if (erros.length > 0) {
      return {
        sucesso: false,
        bloqueado: true,
        mensagem: `Preparação da NF-e bloqueada: ${erros.length} pendência(s) encontrada(s).`,
        erros_validacao: erros,
      };
    }

    const nfMaisRecente = await this.notaFiscalRepo.findOne({
      where: { id_pedido },
      relations: ['itens'],
      order: { id_nota_fiscal: 'DESC' },
    });

    if (
      nfMaisRecente &&
      (nfMaisRecente.status === 'autorizada' ||
        nfMaisRecente.status === 'em_processamento' ||
        nfMaisRecente.status === 'denegada')
    ) {
      throw new Error(
        `O pedido #${pedido.codigo_pedido} já possui NF-e Nº ${nfMaisRecente.numero} (${nfMaisRecente.status}) e não pode ser substituída.`
      );
    }

    if (nfMaisRecente && nfMaisRecente.status === 'assinada' && !opcoes.regerar) {
      return {
        sucesso: true,
        bloqueado: false,
        criada: false,
        ja_preparada: true,
        mensagem: `NF-e Série ${nfMaisRecente.serie} Nº ${nfMaisRecente.numero} já preparada e assinada.`,
        nota_fiscal: nfMaisRecente,
      };
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let pfxBufferParaZerar: Buffer | null = null;
    try {
      const emitRepoTx = queryRunner.manager.getRepository(EmitenteFiscal);
      const nfRepoTx = queryRunner.manager.getRepository(NotaFiscal);
      const nfItemRepoTx = queryRunner.manager.getRepository(NotaFiscalItem);

      // Lock pessimista no registro único do emitente para assegurar numeração sequencial única sob concorrência
      const emitenteLocked = await emitRepoTx
        .createQueryBuilder('e')
        .setLock('pessimistic_write')
        .addSelect(['e.certificado_arquivo_enc', 'e.senha_certificado_enc'])
        .getOne();

      if (!emitenteLocked) {
        throw new Error('Emitente fiscal não encontrado.');
      }

      const notaParaAtualizar = await nfRepoTx.findOne({
        where: [
          { id_pedido, status: 'assinada' },
          { id_pedido, status: 'rascunho' },
          { id_pedido, status: 'rejeitada' },
        ],
        order: { id_nota_fiscal: 'DESC' },
      });

      const deveAvancarNumero = Boolean(
        opcoes.avancar_numero && notaParaAtualizar && notaParaAtualizar.status === 'rejeitada'
      );

      const serieAlocada =
        notaParaAtualizar && !deveAvancarNumero
          ? Number(notaParaAtualizar.serie)
          : Number(emitenteLocked.serie_nfe);
      let numeroAlocado: number;

      if (notaParaAtualizar && !deveAvancarNumero && Number(notaParaAtualizar.numero) > 0) {
        numeroAlocado = Number(notaParaAtualizar.numero);
      } else {
        const maxRow = await nfRepoTx
          .createQueryBuilder('nf')
          .select('COALESCE(MAX(nf.numero), 0)', 'maxNumero')
          .where('nf.ambiente = :amb AND nf.serie = :ser', {
            amb: emitenteLocked.ambiente,
            ser: serieAlocada,
          })
          .getRawOne();
        const maxExistente = Number(maxRow?.maxNumero || 0);
        numeroAlocado = Math.max(Number(emitenteLocked.proximo_numero_nfe), maxExistente + 1);
        emitenteLocked.proximo_numero_nfe = numeroAlocado + 1;
        await emitRepoTx.save(emitenteLocked);
      }

      const montada = montarXmlNFe400({
        emitente: emitenteLocked,
        pedido,
        serie: serieAlocada,
        numero: numeroAlocado,
      });

      const { pfxBuffer, senha } = this.carregarPfxESenhaDeEmitente(emitenteLocked);
      pfxBufferParaZerar = pfxBuffer;

      const assinada = assinarXmlNFe(
        montada.xml_gerado,
        montada.chave_acesso,
        pfxBuffer,
        senha
      );

      let nfEntity: NotaFiscal;
      let reutilizandoMesmoRegistro = false;
      if (notaParaAtualizar && !deveAvancarNumero) {
        await nfItemRepoTx.delete({ id_nota_fiscal: notaParaAtualizar.id_nota_fiscal });
        nfEntity = notaParaAtualizar;
        reutilizandoMesmoRegistro = true;
      } else {
        nfEntity = nfRepoTx.create({ id_pedido });
      }

      nfEntity.ambiente = emitenteLocked.ambiente;
      nfEntity.serie = serieAlocada;
      nfEntity.numero = numeroAlocado;
      nfEntity.chave_acesso = montada.chave_acesso;
      nfEntity.status = 'assinada';
      nfEntity.protocolo_autorizacao = null;
      nfEntity.xml_autorizado = null;
      nfEntity.autorizada_em = null;
      nfEntity.numero_recibo = null;
      nfEntity.codigo_pedido_snapshot = pedido.codigo_pedido;
      nfEntity.xml_autorizado_path = null;
      nfEntity.xml_autorizado_sha256 = null;
      nfEntity.xml_arquivado_em = null;
      nfEntity.guarda_legal_ate = null;
      nfEntity.danfe_gerado_em = null;
      nfEntity.emitente_snapshot = montada.emitente_snapshot;
      nfEntity.destinatario_snapshot = montada.destinatario_snapshot;
      nfEntity.totais_snapshot = montada.totais_snapshot;
      nfEntity.impostos_snapshot = montada.impostos_snapshot;
      nfEntity.xml_gerado = montada.xml_gerado;
      nfEntity.xml_assinado = assinada.xml_assinado;
      nfEntity.digest_value = assinada.digest_value;
      nfEntity.assinatura_valida = assinada.assinatura_valida;
      nfEntity.assinada_em = new Date();
      nfEntity.assinada_por_certificado_serial = assinada.certificado_serial;
      nfEntity.versao_layout = '4.00';
      nfEntity.valor_total = montada.totais_snapshot.vNF;

      const nfSalva = await nfRepoTx.save(nfEntity);

      for (const itemSnap of montada.itens_snapshot) {
        const itemNf = nfItemRepoTx.create({
          id_nota_fiscal: nfSalva.id_nota_fiscal,
          id_produto: itemSnap.id_produto,
          sku_snapshot: itemSnap.sku_snapshot,
          nome_snapshot: itemSnap.nome_snapshot,
          ncm_snapshot: itemSnap.ncm_snapshot,
          cfop_snapshot: itemSnap.cfop_snapshot,
          origem_snapshot: itemSnap.origem_snapshot,
          cst_csosn_snapshot: itemSnap.cst_csosn_snapshot,
          unidade_snapshot: itemSnap.unidade_snapshot,
          cest_snapshot: itemSnap.cest_snapshot,
          quantidade: itemSnap.quantidade,
          valor_unitario: itemSnap.valor_unitario,
          valor_total: itemSnap.valor_total,
        });
        await nfItemRepoTx.save(itemNf);
      }

      await queryRunner.commitTransaction();

      const completa = await this.notaFiscalRepo.findOne({
        where: { id_nota_fiscal: nfSalva.id_nota_fiscal },
        relations: ['itens'],
      });

      return {
        sucesso: true,
        bloqueado: false,
        criada: !reutilizandoMesmoRegistro,
        ja_preparada: false,
        mensagem: `NF-e Série ${serieAlocada} Nº ${numeroAlocado} montada, validada e assinada digitalmente com sucesso!`,
        nota_fiscal: completa,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      if (pfxBufferParaZerar) {
        pfxBufferParaZerar.fill(0);
      }
      await queryRunner.release();
    }
  }

  async obterXmlAssinadoPorNota(id_nota_fiscal: number) {
    const nf = await this.notaFiscalRepo.findOne({ where: { id_nota_fiscal } });
    if (!nf || (!nf.xml_autorizado && !nf.xml_assinado)) {
      throw new Error(`XML da nota fiscal #${id_nota_fiscal} não encontrado.`);
    }
    return nf;
  }

  // ─── Story 33d: Transmissão à SEFAZ, Consulta de Protocolo e Auditoria ────────

  private mapearResultadoAuditoria(chamada: ResultadoChamadaSefaz): ResultadoTransmissao {
    if (chamada.indisponivel) return 'indisponivel';
    return chamada.parsed.interpretacao.categoria === 'servico_ativo'
      ? 'autorizada'
      : (chamada.parsed.interpretacao.categoria as ResultadoTransmissao);
  }

  private async registrarTransmissao(params: {
    id_nota_fiscal: number;
    id_usuario?: number;
    tipo_operacao: TipoOperacaoTransmissao;
    tentativa_numero: number;
    ambiente: 'homologacao' | 'producao';
    chave_acesso: string | null;
    chamada: ResultadoChamadaSefaz;
  }): Promise<NotaFiscalTransmissao> {
    const { chamada } = params;
    const registro = this.transmissaoRepo.create({
      id_nota_fiscal: params.id_nota_fiscal,
      id_usuario: params.id_usuario ?? null,
      tipo_operacao: params.tipo_operacao,
      modo_transporte: chamada.modoTransporte,
      ambiente: params.ambiente,
      tentativa_numero: params.tentativa_numero,
      sucesso_comunicacao: !chamada.indisponivel,
      resultado: this.mapearResultadoAuditoria(chamada),
      http_status: chamada.httpStatus,
      codigo_sefaz: chamada.parsed.cStat,
      motivo_sefaz: chamada.parsed.xMotivo,
      mensagem_amigavel: chamada.parsed.interpretacao.mensagemAmigavel,
      numero_recibo: chamada.parsed.nRec,
      protocolo: chamada.parsed.nProt,
      chave_acesso: chamada.parsed.chNFe || params.chave_acesso,
      endpoint_url: chamada.endpointUrl,
      duracao_ms: chamada.duracaoMs,
      erro_rede: chamada.erroRede,
      xml_requisicao: chamada.xmlRequisicao,
      xml_resposta: chamada.xmlResposta,
    });
    return this.transmissaoRepo.save(registro);
  }

  private aplicarResultadoChamadaNaNota(
    nota: NotaFiscal,
    chamada: ResultadoChamadaSefaz,
    isEnvio: boolean
  ): void {
    const parsed = chamada.parsed;

    if (chamada.indisponivel) {
      nota.ultimo_codigo_sefaz = parsed.cStat || '108';
      nota.ultimo_motivo_sefaz = chamada.erroRede || parsed.xMotivo || 'SEFAZ indisponível';
      nota.ultima_mensagem_amigavel =
        'SEFAZ temporariamente indisponível. A NF-e foi preservada e pode ser consultada ou retransmitida em instantes.';
    } else {
      nota.ultimo_codigo_sefaz = parsed.cStat;
      nota.ultimo_motivo_sefaz = parsed.xMotivo;
      nota.ultima_mensagem_amigavel = parsed.interpretacao.mensagemAmigavel;

      const cat = parsed.interpretacao.categoria;
      if (cat === 'autorizada') {
        nota.status = 'autorizada';
        nota.protocolo_autorizacao = parsed.nProt || nota.protocolo_autorizacao;
        if (chamada.xmlAutorizado) {
          nota.xml_autorizado = chamada.xmlAutorizado;
        }
        nota.numero_recibo = parsed.nRec || nota.numero_recibo;
        nota.autorizada_em = nota.autorizada_em || new Date();
        nota.emitida_em = nota.emitida_em || nota.autorizada_em;
      } else if (cat === 'em_processamento') {
        nota.status = 'em_processamento';
        nota.numero_recibo = parsed.nRec || nota.numero_recibo;
      } else if (cat === 'rejeitada') {
        nota.status = 'rejeitada';
      } else if (cat === 'denegada') {
        nota.status = 'denegada';
      } else if (cat === 'consulta_vazia' && nota.status === 'em_processamento') {
        nota.status = 'assinada';
      }
    }

    if (isEnvio) {
      nota.tentativas_envio = Number(nota.tentativas_envio || 0) + 1;
      nota.ultima_tentativa_em = new Date();
    } else {
      nota.ultima_tentativa_em = new Date();
    }
  }

  private async persistirRetornoSefazNaNota(
    nota: NotaFiscal,
    chamada: ResultadoChamadaSefaz,
    codigoPedido: string,
    isEnvio: boolean
  ): Promise<void> {
    this.aplicarResultadoChamadaNaNota(nota, chamada, isEnvio);
    if ((nota.status as NotaFiscal['status']) === 'autorizada' && nota.xml_autorizado) {
      nota.codigo_pedido_snapshot = nota.codigo_pedido_snapshot || codigoPedido;
      this.arquivarXmlAutorizadoEmDisco(nota);
    }
    await this.notaFiscalRepo.save(nota);
  }

  private serializarTransmissaoResumo(t: NotaFiscalTransmissao) {
    return {
      id_transmissao: t.id_transmissao,
      id_nota_fiscal: t.id_nota_fiscal,
      id_usuario: t.id_usuario,
      tipo_operacao: t.tipo_operacao,
      modo_transporte: t.modo_transporte,
      ambiente: t.ambiente,
      tentativa_numero: t.tentativa_numero,
      sucesso_comunicacao: t.sucesso_comunicacao,
      resultado: t.resultado,
      http_status: t.http_status,
      codigo_sefaz: t.codigo_sefaz,
      motivo_sefaz: t.motivo_sefaz,
      mensagem_amigavel: t.mensagem_amigavel,
      numero_recibo: t.numero_recibo,
      protocolo: t.protocolo,
      chave_acesso: t.chave_acesso,
      endpoint_url: t.endpoint_url,
      duracao_ms: t.duracao_ms,
      erro_rede: t.erro_rede,
      tem_xml_requisicao: Boolean(t.xml_requisicao),
      tem_xml_resposta: Boolean(t.xml_resposta),
      created_at: t.created_at,
    };
  }

  private validarGuardrailProducaoESelecionarModo(
    ambiente: 'homologacao' | 'producao',
    opcoes: { cenario_teste?: CenarioSimulacaoSefaz; cenario_consulta_previa?: CenarioSimulacaoSefaz; modo_transporte?: ModoTransporteSefaz }
  ): ModoTransporteSefaz {
    const modo: ModoTransporteSefaz =
      opcoes.modo_transporte ||
      (env.SEFAZ_MODO_TRANSPORTE === 'sefaz_soap' ? 'sefaz_soap' : 'simulado');

    if (ambiente === 'producao') {
      if (opcoes.cenario_teste || opcoes.cenario_consulta_previa) {
        throw Object.assign(
          new Error('Simulação de cenário SEFAZ é estritamente bloqueada no ambiente de produção.'),
          { statusCode: 400 }
        );
      }
      if (modo !== 'sefaz_soap') {
        throw Object.assign(
          new Error(
            'Ambiente de produção exige transporte real SEFAZ (SEFAZ_MODO_TRANSPORTE=sefaz_soap). Transmissão simulada bloqueada.'
          ),
          { statusCode: 400 }
        );
      }
    }

    return modo;
  }

  async listarTransmissoesDoPedido(id_pedido: number) {
    const pedido = await this.pedidoRepo.findOne({ where: { id_pedido } });
    if (!pedido) {
      throw new Error(`Pedido #${id_pedido} não encontrado.`);
    }

    const notas = await this.notaFiscalRepo.find({
      where: { id_pedido },
      order: { id_nota_fiscal: 'DESC' },
    });

    if (notas.length === 0) {
      return {
        sucesso: true,
        nota_fiscal_atual: null,
        transmissoes: [],
      };
    }

    const idsNotas = notas.map((n) => n.id_nota_fiscal);
    const transmissoes = await this.transmissaoRepo
      .createQueryBuilder('t')
      .where('t.id_nota_fiscal IN (:...idsNotas)', { idsNotas })
      .orderBy('t.id_transmissao', 'DESC')
      .take(40)
      .getMany();

    return {
      sucesso: true,
      nota_fiscal_atual: notas[0],
      transmissoes: transmissoes.map((t) => this.serializarTransmissaoResumo(t)),
    };
  }

  async transmitirNFePedido(
    id_pedido: number,
    opcoes: {
      cenario_teste?: CenarioSimulacaoSefaz;
      cenario_consulta_previa?: CenarioSimulacaoSefaz;
      cstat_simulado?: string;
      xmotivo_simulado?: string;
      modo_transporte?: ModoTransporteSefaz;
    } = {},
    id_usuario?: number
  ) {
    const pedido = await this.pedidoRepo.findOne({ where: { id_pedido } });
    if (!pedido) {
      throw Object.assign(new Error(`Pedido #${id_pedido} não encontrado.`), { statusCode: 404 });
    }

    const emitente = await this.emitenteRepo
      .createQueryBuilder('e')
      .addSelect(['e.certificado_arquivo_enc', 'e.senha_certificado_enc'])
      .getOne();

    if (!emitente) {
      throw Object.assign(new Error('Emitente fiscal não cadastrado.'), { statusCode: 400 });
    }

    const modo = this.validarGuardrailProducaoESelecionarModo(emitente.ambiente, opcoes);

    const nota = await this.notaFiscalRepo.findOne({
      where: { id_pedido },
      relations: ['itens'],
      order: { id_nota_fiscal: 'DESC' },
    });

    if (!nota) {
      throw Object.assign(
        new Error('Nenhuma NF-e preparada para este pedido. Execute "Preparar NF-e" antes de transmitir.'),
        { statusCode: 400 }
      );
    }

    if (nota.status === 'autorizada') {
      throw Object.assign(
        new Error(`A NF-e Nº ${nota.numero} já está autorizada pela SEFAZ (Protocolo ${nota.protocolo_autorizacao || '—'}).`),
        { statusCode: 400 }
      );
    }

    if (nota.status === 'denegada') {
      throw Object.assign(
        new Error(`A NF-e Nº ${nota.numero} teve Uso Denegado pela SEFAZ (${nota.ultimo_codigo_sefaz || '110'}) e não pode ser retransmitida.`),
        { statusCode: 400 }
      );
    }

    if (nota.status === 'cancelada') {
      throw Object.assign(
        new Error(`A NF-e Nº ${nota.numero} está cancelada.`),
        { statusCode: 400 }
      );
    }

    if (nota.status === 'rascunho' || !nota.xml_assinado || !nota.assinatura_valida || !nota.chave_acesso) {
      throw Object.assign(
        new Error('A NF-e precisa estar preparada e assinada digitalmente antes da transmissão à SEFAZ.'),
        { statusCode: 400 }
      );
    }

    if (nota.ambiente !== emitente.ambiente) {
      throw Object.assign(
        new Error(
          `Esta NF-e foi assinada para o ambiente "${nota.ambiente}", mas o sistema está em "${emitente.ambiente}". Regere o XML assinado no ambiente atual.`
        ),
        { statusCode: 400 }
      );
    }

    let pfxBuffer: Buffer | undefined;
    let senha: string | undefined;

    try {
      if (modo === 'sefaz_soap') {
        const creds = this.carregarPfxESenhaDeEmitente(emitente);
        pfxBuffer = creds.pfxBuffer;
        senha = creds.senha;
      }

      let consultaPreviaRealizada = false;

      // Proteção anti-duplicidade (AC4): nota em processamento deve ser consultada primeiro
      if (nota.status === 'em_processamento') {
        consultaPreviaRealizada = true;
        const chamadaConsulta = await consultarProtocoloSefaz({
          uf: emitente.uf,
          ambiente: emitente.ambiente,
          chaveAcesso: nota.chave_acesso,
          xmlAssinado: nota.xml_assinado,
          digestValue: nota.digest_value,
          pfxBuffer,
          senha,
          cenarioTeste: opcoes.cenario_consulta_previa ?? opcoes.cenario_teste,
          cStatSimulado: opcoes.cstat_simulado,
          xMotivoSimulado: opcoes.xmotivo_simulado,
          modoTransporte: modo,
        });

        const transConsulta = await this.registrarTransmissao({
          id_nota_fiscal: nota.id_nota_fiscal,
          id_usuario,
          tipo_operacao: 'consulta_protocolo',
          tentativa_numero: Number(nota.tentativas_envio || 0) + 1,
          ambiente: emitente.ambiente,
          chave_acesso: nota.chave_acesso,
          chamada: chamadaConsulta,
        });

        await this.persistirRetornoSefazNaNota(nota, chamadaConsulta, pedido.codigo_pedido, false);

        const catConsulta = chamadaConsulta.parsed.interpretacao.categoria;
        if (chamadaConsulta.indisponivel || catConsulta !== 'consulta_vazia') {
          const notaAtualizada = await this.notaFiscalRepo.findOne({
            where: { id_nota_fiscal: nota.id_nota_fiscal },
            relations: ['itens'],
          });
          const hist = await this.listarTransmissoesDoPedido(id_pedido);

          return {
            sucesso: !chamadaConsulta.indisponivel,
            indisponivel: chamadaConsulta.indisponivel,
            pode_tentar_novamente: chamadaConsulta.indisponivel,
            consulta_previa_realizada: true,
            reenvio_bloqueado_por_consulta: true,
            autorizada: notaAtualizada?.status === 'autorizada',
            resultado_sefaz: chamadaConsulta.indisponivel ? 'indisponivel' : catConsulta,
            mensagem: chamadaConsulta.indisponivel
              ? 'SEFAZ indisponível durante a consulta de protocolo prévia. Nenhum reenvio duplicado foi realizado.'
              : catConsulta === 'autorizada'
                ? 'Consulta prévia confirmou que a NF-e já estava AUTORIZADA na SEFAZ. Duplicidade evitada!'
                : `Consulta prévia retornou cStat ${chamadaConsulta.parsed.cStat}: ${chamadaConsulta.parsed.interpretacao.mensagemAmigavel}`,
            interpretacao: chamadaConsulta.parsed.interpretacao,
            nota_fiscal: notaAtualizada,
            transmissao: this.serializarTransmissaoResumo(transConsulta),
            transmissoes: hist.transmissoes,
          };
        }
      }

      const tentativaEnvioNum = Number(nota.tentativas_envio || 0) + 1;
      const chamada = await enviarAutorizacaoSefaz({
        uf: emitente.uf,
        ambiente: emitente.ambiente,
        chaveAcesso: nota.chave_acesso,
        xmlAssinado: nota.xml_assinado,
        digestValue: nota.digest_value,
        pfxBuffer,
        senha,
        cenarioTeste: opcoes.cenario_teste,
        cStatSimulado: opcoes.cstat_simulado,
        xMotivoSimulado: opcoes.xmotivo_simulado,
        modoTransporte: modo,
      });

      const transmissao = await this.registrarTransmissao({
        id_nota_fiscal: nota.id_nota_fiscal,
        id_usuario,
        tipo_operacao: 'autorizacao',
        tentativa_numero: tentativaEnvioNum,
        ambiente: emitente.ambiente,
        chave_acesso: nota.chave_acesso,
        chamada,
      });

      await this.persistirRetornoSefazNaNota(nota, chamada, pedido.codigo_pedido, true);

      const notaAtualizada = await this.notaFiscalRepo.findOne({
        where: { id_nota_fiscal: nota.id_nota_fiscal },
        relations: ['itens'],
      });
      const hist = await this.listarTransmissoesDoPedido(id_pedido);

      const cat = chamada.indisponivel ? 'indisponivel' : chamada.parsed.interpretacao.categoria;
      const mensagem = chamada.indisponivel
        ? 'SEFAZ temporariamente indisponível. A NF-e foi preservada e você pode tentar novamente em instantes.'
        : cat === 'autorizada'
          ? `NF-e Série ${nota.serie} Nº ${nota.numero} AUTORIZADA pela SEFAZ! Protocolo: ${nota.protocolo_autorizacao}`
          : cat === 'em_processamento'
            ? `Lote recebido pela SEFAZ (cStat ${chamada.parsed.cStat}). Consulte a situação para obter o protocolo definitivo.`
            : cat === 'denegada'
              ? `Uso Denegado pela SEFAZ (${chamada.parsed.cStat}): ${chamada.parsed.xMotivo || chamada.parsed.interpretacao.mensagemAmigavel}`
              : `NF-e rejeitada pela SEFAZ (${chamada.parsed.cStat}): ${chamada.parsed.interpretacao.mensagemAmigavel}`;

      return {
        sucesso: !chamada.indisponivel,
        indisponivel: chamada.indisponivel,
        pode_tentar_novamente: chamada.indisponivel || cat === 'rejeitada' || cat === 'em_processamento',
        consulta_previa_realizada: consultaPreviaRealizada,
        reenvio_bloqueado_por_consulta: false,
        autorizada: notaAtualizada?.status === 'autorizada',
        resultado_sefaz: cat,
        mensagem,
        interpretacao: chamada.parsed.interpretacao,
        nota_fiscal: notaAtualizada,
        transmissao: this.serializarTransmissaoResumo(transmissao),
        transmissoes: hist.transmissoes,
      };
    } finally {
      if (pfxBuffer) {
        pfxBuffer.fill(0);
      }
      senha = undefined;
    }
  }

  async consultarSituacaoNFePedido(
    id_pedido: number,
    opcoes: {
      cenario_teste?: CenarioSimulacaoSefaz;
      cstat_simulado?: string;
      xmotivo_simulado?: string;
      modo_transporte?: ModoTransporteSefaz;
    } = {},
    id_usuario?: number
  ) {
    const pedido = await this.pedidoRepo.findOne({ where: { id_pedido } });
    if (!pedido) {
      throw Object.assign(new Error(`Pedido #${id_pedido} não encontrado.`), { statusCode: 404 });
    }

    const emitente = await this.emitenteRepo
      .createQueryBuilder('e')
      .addSelect(['e.certificado_arquivo_enc', 'e.senha_certificado_enc'])
      .getOne();

    if (!emitente) {
      throw Object.assign(new Error('Emitente fiscal não cadastrado.'), { statusCode: 400 });
    }

    const modo = this.validarGuardrailProducaoESelecionarModo(emitente.ambiente, opcoes);

    const nota = await this.notaFiscalRepo.findOne({
      where: { id_pedido },
      relations: ['itens'],
      order: { id_nota_fiscal: 'DESC' },
    });

    if (!nota || !nota.chave_acesso || nota.status === 'rascunho') {
      throw Object.assign(
        new Error('Este pedido não possui NF-e assinada com chave de acesso para consulta na SEFAZ.'),
        { statusCode: 400 }
      );
    }

    if (nota.ambiente !== emitente.ambiente) {
      throw Object.assign(
        new Error(
          `Esta NF-e pertence ao ambiente "${nota.ambiente}", mas o emitente está em "${emitente.ambiente}".`
        ),
        { statusCode: 400 }
      );
    }

    let pfxBuffer: Buffer | undefined;
    let senha: string | undefined;

    try {
      if (modo === 'sefaz_soap') {
        const creds = this.carregarPfxESenhaDeEmitente(emitente);
        pfxBuffer = creds.pfxBuffer;
        senha = creds.senha;
      }

      const chamada = await consultarProtocoloSefaz({
        uf: emitente.uf,
        ambiente: emitente.ambiente,
        chaveAcesso: nota.chave_acesso,
        xmlAssinado: nota.xml_assinado,
        digestValue: nota.digest_value,
        pfxBuffer,
        senha,
        cenarioTeste: opcoes.cenario_teste,
        cStatSimulado: opcoes.cstat_simulado,
        xMotivoSimulado: opcoes.xmotivo_simulado,
        modoTransporte: modo,
      });

      const transmissao = await this.registrarTransmissao({
        id_nota_fiscal: nota.id_nota_fiscal,
        id_usuario,
        tipo_operacao: 'consulta_protocolo',
        tentativa_numero: Number(nota.tentativas_envio || 0),
        ambiente: emitente.ambiente,
        chave_acesso: nota.chave_acesso,
        chamada,
      });

      await this.persistirRetornoSefazNaNota(nota, chamada, pedido.codigo_pedido, false);

      const notaAtualizada = await this.notaFiscalRepo.findOne({
        where: { id_nota_fiscal: nota.id_nota_fiscal },
        relations: ['itens'],
      });
      const hist = await this.listarTransmissoesDoPedido(id_pedido);
      const cat = chamada.indisponivel ? 'indisponivel' : chamada.parsed.interpretacao.categoria;

      return {
        sucesso: !chamada.indisponivel,
        indisponivel: chamada.indisponivel,
        pode_tentar_novamente: chamada.indisponivel || cat === 'em_processamento' || cat === 'consulta_vazia',
        autorizada: nota.status === 'autorizada',
        resultado_sefaz: cat,
        mensagem: chamada.indisponivel
          ? 'SEFAZ indisponível ao consultar protocolo. Tente novamente em instantes.'
          : cat === 'autorizada'
            ? `Consulta confirmou NF-e AUTORIZADA! Protocolo: ${nota.protocolo_autorizacao}`
            : cat === 'consulta_vazia'
              ? 'NF-e não consta na base da SEFAZ (cStat 217). É seguro retransmitir.'
              : `Consulta SEFAZ (${chamada.parsed.cStat}): ${chamada.parsed.interpretacao.mensagemAmigavel}`,
        interpretacao: chamada.parsed.interpretacao,
        nota_fiscal: notaAtualizada,
        transmissao: this.serializarTransmissaoResumo(transmissao),
        transmissoes: hist.transmissoes,
      };
    } finally {
      if (pfxBuffer) {
        pfxBuffer.fill(0);
      }
      senha = undefined;
    }
  }

  async verificarStatusServicoSefaz(
    opcoes: { cenario_teste?: CenarioSimulacaoSefaz; modo_transporte?: ModoTransporteSefaz } = {}
  ) {
    const emitente = await this.emitenteRepo
      .createQueryBuilder('e')
      .addSelect(['e.certificado_arquivo_enc', 'e.senha_certificado_enc'])
      .getOne();

    if (!emitente) {
      throw Object.assign(new Error('Emitente fiscal não cadastrado.'), { statusCode: 400 });
    }

    const modo = this.validarGuardrailProducaoESelecionarModo(emitente.ambiente, opcoes);

    let pfxBuffer: Buffer | undefined;
    let senha: string | undefined;

    try {
      if (modo === 'sefaz_soap') {
        const creds = this.carregarPfxESenhaDeEmitente(emitente);
        pfxBuffer = creds.pfxBuffer;
        senha = creds.senha;
      }

      const chamada = await consultarStatusServicoSefaz({
        uf: emitente.uf,
        ambiente: emitente.ambiente,
        pfxBuffer,
        senha,
        cenarioTeste: opcoes.cenario_teste,
        modoTransporte: modo,
      });

      return {
        sucesso: !chamada.indisponivel,
        indisponivel: chamada.indisponivel,
        ambiente: emitente.ambiente,
        uf: emitente.uf,
        modo_transporte: chamada.modoTransporte,
        endpoint_url: chamada.endpointUrl,
        http_status: chamada.httpStatus,
        duracao_ms: chamada.duracaoMs,
        codigo_sefaz: chamada.parsed.cStat,
        motivo_sefaz: chamada.parsed.xMotivo,
        mensagem: chamada.indisponivel
          ? `SEFAZ indisponível: ${chamada.erroRede || chamada.parsed.interpretacao.mensagemAmigavel}`
          : chamada.parsed.interpretacao.mensagemAmigavel,
        interpretacao: chamada.parsed.interpretacao,
      };
    } finally {
      if (pfxBuffer) {
        pfxBuffer.fill(0);
      }
      senha = undefined;
    }
  }

  // ─── Story 33e: Arquivo XML Autorizado em Disco (Guarda Legal) e DANFE ────────

  private calcularDataGuardaLegal(dataRef: Date): string {
    return `${dataRef.getUTCFullYear() + 5}-12-31`;
  }

  private resolverCaminhoAbsolutoArquivoXml(relPath: string): string {
    const raiz = path.resolve(env.FISCAL_XML_ARCHIVE_DIR);
    const destino = path.resolve(raiz, relPath);
    if (!destino.startsWith(`${raiz}${path.sep}`) && destino !== raiz) {
      throw Object.assign(new Error('Caminho inválido para o arquivo XML fiscal.'), { statusCode: 400 });
    }
    return destino;
  }

  private arquivarXmlAutorizadoEmDisco(nota: NotaFiscal): void {
    if (!nota.xml_autorizado || !nota.chave_acesso) {
      return;
    }

    const buf = Buffer.from(nota.xml_autorizado, 'utf8');
    const hash = sha256Hex(buf);
    const dataRef = nota.autorizada_em || nota.emitida_em || new Date();
    const yyyy = String(dataRef.getUTCFullYear());
    const mm = String(dataRef.getUTCMonth() + 1).padStart(2, '0');
    const relPath = nota.xml_autorizado_path || `${nota.ambiente}/${yyyy}/${mm}/${nota.chave_acesso}-procNFe.xml`;
    const absPath = this.resolverCaminhoAbsolutoArquivoXml(relPath);

    fs.mkdirSync(path.dirname(absPath), { recursive: true });

    if (fs.existsSync(absPath)) {
      const diskHash = sha256Hex(fs.readFileSync(absPath));
      if (nota.xml_autorizado_sha256 && diskHash !== nota.xml_autorizado_sha256) {
        throw Object.assign(
          new Error('Divergência de integridade (SHA-256) no XML autorizado armazenado em disco.'),
          { statusCode: 500 }
        );
      }
      if (diskHash !== hash) {
        throw Object.assign(
          new Error('O arquivo XML autorizado em disco difere do conteúdo registrado no banco de dados.'),
          { statusCode: 500 }
        );
      }
    } else {
      fs.writeFileSync(absPath, buf, { mode: 0o600 });
    }

    nota.xml_autorizado_path = relPath;
    nota.xml_autorizado_sha256 = hash;
    nota.xml_arquivado_em = nota.xml_arquivado_em || new Date();
    nota.guarda_legal_ate = nota.guarda_legal_ate || this.calcularDataGuardaLegal(dataRef);
  }

  async obterXmlParaDownload(id_nota_fiscal: number): Promise<{
    nota: NotaFiscal;
    conteudoXml: string;
    nomeArquivo: string;
    sha256: string;
    autorizado: boolean;
  }> {
    const nf = await this.notaFiscalRepo.findOne({ where: { id_nota_fiscal } });
    if (!nf || (!nf.xml_autorizado && !nf.xml_assinado)) {
      throw Object.assign(new Error(`XML da nota fiscal #${id_nota_fiscal} não encontrado.`), {
        statusCode: 404,
      });
    }

    if ((nf.status === 'autorizada' || nf.status === 'cancelada') && nf.xml_autorizado) {
      if (!nf.xml_autorizado_path || !nf.xml_autorizado_sha256) {
        this.arquivarXmlAutorizadoEmDisco(nf);
        await this.notaFiscalRepo.save(nf);
      }

      const absPath = this.resolverCaminhoAbsolutoArquivoXml(nf.xml_autorizado_path!);
      if (!fs.existsSync(absPath)) {
        this.arquivarXmlAutorizadoEmDisco(nf);
      }

      const bytes = fs.readFileSync(absPath);
      const diskHash = sha256Hex(bytes);
      if (nf.xml_autorizado_sha256 && diskHash !== nf.xml_autorizado_sha256) {
        throw Object.assign(
          new Error('Falha de integridade SHA-256 ao ler XML autorizado do arquivo fiscal.'),
          { statusCode: 500 }
        );
      }

      return {
        nota: nf,
        conteudoXml: bytes.toString('utf8'),
        nomeArquivo: `NFe-${nf.chave_acesso || nf.numero}-procNFe.xml`,
        sha256: diskHash,
        autorizado: true,
      };
    }

    const xmlAssinado = nf.xml_assinado || nf.xml_autorizado!;
    return {
      nota: nf,
      conteudoXml: xmlAssinado,
      nomeArquivo: `NFe-${nf.chave_acesso || nf.numero}.xml`,
      sha256: sha256Hex(Buffer.from(xmlAssinado, 'utf8')),
      autorizado: false,
    };
  }

  async obterXmlParaDownloadPorPedido(id_pedido: number) {
    const notas = await this.notaFiscalRepo.find({
      where: { id_pedido },
      order: { id_nota_fiscal: 'DESC' },
    });
    const alvo =
      notas.find((n) => (n.status === 'autorizada' || n.status === 'cancelada') && Boolean(n.xml_autorizado)) ||
      notas.find((n) => Boolean(n.xml_autorizado || n.xml_assinado));

    if (!alvo) {
      throw Object.assign(new Error(`Nenhum XML fiscal disponível para o pedido #${id_pedido}.`), {
        statusCode: 404,
      });
    }

    return this.obterXmlParaDownload(alvo.id_nota_fiscal);
  }

  async gerarDanfePorNota(id_nota_fiscal: number): Promise<{ nota: NotaFiscal; html: string }> {
    const nf = await this.notaFiscalRepo.findOne({
      where: { id_nota_fiscal },
      relations: ['itens'],
    });

    if (!nf) {
      throw Object.assign(new Error(`Nota fiscal #${id_nota_fiscal} não encontrada.`), {
        statusCode: 404,
      });
    }

    if (nf.status !== 'autorizada' && nf.status !== 'cancelada') {
      throw Object.assign(
        new Error(
          `DANFE só pode ser gerado após autorização na SEFAZ (status atual: "${nf.status}").`
        ),
        { statusCode: 400 }
      );
    }

    if (!nf.protocolo_autorizacao || !nf.chave_acesso) {
      throw Object.assign(
        new Error('NF-e sem protocolo de autorização ou chave de acesso para geração do DANFE.'),
        { statusCode: 400 }
      );
    }

    if (nf.xml_autorizado && !nf.xml_autorizado_path) {
      this.arquivarXmlAutorizadoEmDisco(nf);
      await this.notaFiscalRepo.update(
        { id_nota_fiscal: nf.id_nota_fiscal },
        {
          xml_autorizado_path: nf.xml_autorizado_path,
          xml_autorizado_sha256: nf.xml_autorizado_sha256,
          xml_arquivado_em: nf.xml_arquivado_em,
          guarda_legal_ate: nf.guarda_legal_ate,
        }
      );
    }

    const html = gerarHtmlDanfe(nf);
    const agora = new Date();
    await this.notaFiscalRepo.update({ id_nota_fiscal: nf.id_nota_fiscal }, { danfe_gerado_em: agora });
    nf.danfe_gerado_em = agora;

    return { nota: nf, html };
  }

  async gerarDanfePorPedido(id_pedido: number): Promise<{ nota: NotaFiscal; html: string }> {
    const notas = await this.notaFiscalRepo.find({
      where: { id_pedido },
      order: { id_nota_fiscal: 'DESC' },
    });

    if (!notas || notas.length === 0) {
      throw Object.assign(new Error(`Nenhuma NF-e encontrada para o pedido #${id_pedido}.`), {
        statusCode: 404,
      });
    }

    const alvo =
      notas.find((n) => n.status === 'autorizada' || n.status === 'cancelada') || notas[0];
    return this.gerarDanfePorNota(alvo.id_nota_fiscal);
  }

  async listarNotasFiscais(filtros: { status?: string; ambiente?: string; busca?: string } = {}) {
    const qb = this.notaFiscalRepo
      .createQueryBuilder('nf')
      .select([
        'nf.id_nota_fiscal',
        'nf.id_pedido',
        'nf.codigo_pedido_snapshot',
        'nf.ambiente',
        'nf.serie',
        'nf.numero',
        'nf.chave_acesso',
        'nf.status',
        'nf.protocolo_autorizacao',
        'nf.valor_total',
        'nf.emitida_em',
        'nf.autorizada_em',
        'nf.xml_autorizado_path',
        'nf.xml_autorizado_sha256',
        'nf.xml_arquivado_em',
        'nf.guarda_legal_ate',
        'nf.danfe_gerado_em',
        'nf.destinatario_snapshot',
        'nf.created_at',
      ])
      .orderBy('nf.id_nota_fiscal', 'DESC')
      .take(200);

    if (filtros.status && filtros.status !== 'todos') {
      qb.andWhere('nf.status = :status', { status: filtros.status });
    }
    if (filtros.ambiente && filtros.ambiente !== 'todos') {
      qb.andWhere('nf.ambiente = :ambiente', { ambiente: filtros.ambiente });
    }

    const lista = await qb.getMany();
    const buscaNorm = String(filtros.busca || '').trim().toLowerCase();

    const filtrada = buscaNorm
      ? lista.filter((nf) => {
          const destNome = String(nf.destinatario_snapshot?.nome || '').toLowerCase();
          const destDoc = String(nf.destinatario_snapshot?.documento || '').toLowerCase();
          return (
            String(nf.numero).includes(buscaNorm) ||
            String(nf.chave_acesso || '').toLowerCase().includes(buscaNorm) ||
            String(nf.protocolo_autorizacao || '').toLowerCase().includes(buscaNorm) ||
            String(nf.codigo_pedido_snapshot || '').toLowerCase().includes(buscaNorm) ||
            destNome.includes(buscaNorm) ||
            destDoc.includes(buscaNorm)
          );
        })
      : lista;

    return filtrada.map((nf) => ({
      id_nota_fiscal: nf.id_nota_fiscal,
      id_pedido: nf.id_pedido,
      codigo_pedido_snapshot: nf.codigo_pedido_snapshot,
      ambiente: nf.ambiente,
      serie: nf.serie,
      numero: nf.numero,
      chave_acesso: nf.chave_acesso,
      status: nf.status,
      protocolo_autorizacao: nf.protocolo_autorizacao,
      valor_total: Number(nf.valor_total || 0),
      emitida_em: nf.emitida_em,
      autorizada_em: nf.autorizada_em,
      xml_autorizado_path: nf.xml_autorizado_path,
      xml_autorizado_sha256: nf.xml_autorizado_sha256,
      xml_arquivado_em: nf.xml_arquivado_em,
      guarda_legal_ate: nf.guarda_legal_ate,
      danfe_gerado_em: nf.danfe_gerado_em,
      destinatario_nome: nf.destinatario_snapshot?.nome || null,
      destinatario_documento: nf.destinatario_snapshot?.documento || null,
      tem_xml_autorizado: Boolean(nf.xml_autorizado_path || nf.status === 'autorizada' || nf.status === 'cancelada'),
      pode_gerar_danfe:
        (nf.status === 'autorizada' || nf.status === 'cancelada') && Boolean(nf.protocolo_autorizacao),
      created_at: nf.created_at,
    }));
  }
}

