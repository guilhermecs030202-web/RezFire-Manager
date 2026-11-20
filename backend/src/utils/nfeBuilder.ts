import crypto from 'crypto';
import { EmitenteFiscal } from '../entities/EmitenteFiscal';
import { Pedido } from '../entities/Pedido';
import {
  CODIGO_MUNICIPIO_CAPITAL_UF,
  CODIGO_UF_IBGE,
  CSOSN_LISTA,
  CST_LISTA,
  UFS_VALIDAS,
  avaliarAptidaoFiscalProduto,
  limparDigitos,
  validarCep,
  validarCnpj,
  validarCpfOuCnpj,
  validarInscricaoEstadual,
} from './fiscalValidator';

export interface ErroValidacaoNFe {
  secao: 'emitente' | 'certificado' | 'pedido' | 'destinatario' | 'item';
  campo: string;
  label: string;
  motivo: string;
}

const CSOSN_SET = new Set<string>(CSOSN_LISTA.map((i) => i.codigo));
const CST_SET = new Set<string>(CST_LISTA.map((i) => i.codigo));

function escapeXmlText(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlAttr(val: unknown): string {
  return escapeXmlText(val).replace(/"/g, '&quot;');
}

function padLeft(val: number | string, len: number): string {
  return String(val).padStart(len, '0').slice(-len);
}

function money2(val: number): string {
  return Number(val || 0).toFixed(2);
}

function qty4(val: number): string {
  return Number(val || 0).toFixed(4);
}

function formatarIsoTimezoneSP(d: Date): string {
  // Emite no fuso padrão Brasil (-03:00) conforme exigência do layout NF-e v4.00
  const utcMs = d.getTime() - 3 * 3600 * 1000;
  const local = new Date(utcMs);
  const yyyy = local.getUTCFullYear();
  const mm = padLeft(local.getUTCMonth() + 1, 2);
  const dd = padLeft(local.getUTCDate(), 2);
  const hh = padLeft(local.getUTCHours(), 2);
  const mi = padLeft(local.getUTCMinutes(), 2);
  const ss = padLeft(local.getUTCSeconds(), 2);
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`;
}

/**
 * Calcula o Dígito Verificador (cDV) da Chave de Acesso NF-e (Módulo 11, pesos 2..9).
 */
export function calcularDigitoVerificadorChaveNFe(chave43: string): string {
  if (!/^\d{43}$/.test(chave43)) {
    throw new Error('Base da chave NF-e deve conter exatamente 43 dígitos numéricos.');
  }
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
  return String(dv);
}

export function gerarChaveAcessoNFe(params: {
  uf: string;
  dataEmissao: Date;
  cnpjEmitente: string;
  serie: number;
  numero: number;
  tpEmis?: string;
}): { chave: string; cUF: string; cNF: string; cDV: string } {
  const ufUpper = String(params.uf || 'SP').trim().toUpperCase();
  const cUF = CODIGO_UF_IBGE[ufUpper] || '35';

  // AAMM calculado em horário Brasília (-03:00)
  const spDate = new Date(params.dataEmissao.getTime() - 3 * 3600 * 1000);
  const aa = String(spDate.getUTCFullYear()).slice(-2);
  const mm = padLeft(spDate.getUTCMonth() + 1, 2);
  const aamm = `${aa}${mm}`;

  const cnpj = padLeft(limparDigitos(params.cnpjEmitente), 14);
  const mod = '55';
  const serie = padLeft(params.serie, 3);
  const nNF = padLeft(params.numero, 9);
  const tpEmis = params.tpEmis || '1';

  // Código numérico aleatório de 8 dígitos diferente de nNF
  let cNFNum = crypto.randomInt(10000000, 99999999);
  while (padLeft(cNFNum, 8) === nNF.slice(-8)) {
    cNFNum = crypto.randomInt(10000000, 99999999);
  }
  const cNF = padLeft(cNFNum, 8);

  const base43 = `${cUF}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;
  const cDV = calcularDigitoVerificadorChaveNFe(base43);
  return {
    chave: `${base43}${cDV}`,
    cUF,
    cNF,
    cDV,
  };
}

/**
 * Valida todas as pré-condições de Emitente, Certificado A1, Pedido, Destinatário e Itens
 * antes da assinatura da NF-e (Critérios 2 e 4 da Story 33c).
 */
export function validarDadosParaNFe(
  emitente: EmitenteFiscal | null,
  pedido: Pedido | null
): ErroValidacaoNFe[] {
  const erros: ErroValidacaoNFe[] = [];

  if (!emitente) {
    erros.push({
      secao: 'emitente',
      campo: 'emitente_fiscal',
      label: 'Emitente Fiscal',
      motivo: 'Nenhum emitente fiscal cadastrado. Configure o emitente na tela Fiscal & NF-e (Story 33a).',
    });
  } else {
    if (!emitente.razao_social || emitente.razao_social.trim().length < 3) {
      erros.push({ secao: 'emitente', campo: 'razao_social', label: 'Razão Social do Emitente', motivo: 'Não informada.' });
    }
    if (!validarCnpj(emitente.cnpj)) {
      erros.push({ secao: 'emitente', campo: 'cnpj', label: 'CNPJ do Emitente', motivo: 'CNPJ inválido.' });
    }
    if (!validarInscricaoEstadual(emitente.inscricao_estadual)) {
      erros.push({ secao: 'emitente', campo: 'inscricao_estadual', label: 'Inscrição Estadual', motivo: 'Não informada ou inválida.' });
    }
    if (!validarCep(emitente.cep) || !emitente.logradouro || !emitente.municipio || !emitente.uf) {
      erros.push({ secao: 'emitente', campo: 'endereco', label: 'Endereço do Emitente', motivo: 'Endereço fiscal do emitente incompleto.' });
    }

    if (!emitente.certificado_cnpj || !emitente.certificado_valido_ate) {
      erros.push({
        secao: 'certificado',
        campo: 'certificado_a1',
        label: 'Certificado Digital A1',
        motivo: 'Certificado digital A1 (.pfx/.p12) não instalado no emitente.',
      });
    } else {
      const agora = new Date();
      const dataValidade = new Date(emitente.certificado_valido_ate);
      if (agora.getTime() >= dataValidade.getTime()) {
        const dataExpBr = dataValidade.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        erros.push({
          secao: 'certificado',
          campo: 'certificado_valido_ate',
          label: 'Validade do Certificado A1',
          motivo: `O certificado digital A1 (${emitente.certificado_titular || emitente.razao_social}) venceu em ${dataExpBr}. Substitua o certificado (.pfx/.p12) na tela Fiscal & NF-e para desbloquear a emissão de notas.`,
        });
      }
      if (limparDigitos(emitente.certificado_cnpj) !== limparDigitos(emitente.cnpj)) {
        erros.push({
          secao: 'certificado',
          campo: 'certificado_cnpj',
          label: 'CNPJ do Certificado A1',
          motivo: 'O CNPJ do certificado digital não confere com o CNPJ do emitente.',
        });
      }
    }
  }

  if (!pedido) {
    erros.push({ secao: 'pedido', campo: 'id_pedido', label: 'Pedido', motivo: 'Pedido não encontrado.' });
    return erros;
  }

  if (pedido.status === 'Cancelado') {
    erros.push({
      secao: 'pedido',
      campo: 'status',
      label: 'Status do Pedido',
      motivo: 'Não é permitido preparar NF-e para um pedido cancelado.',
    });
  }

  if (!pedido.itens || pedido.itens.length === 0) {
    erros.push({
      secao: 'pedido',
      campo: 'itens',
      label: 'Itens do Pedido',
      motivo: 'O pedido não possui nenhum item vinculado.',
    });
  }

  // Validação obrigatória do Destinatário (Critério 4 da 33c)
  if (!pedido.cliente_nome || pedido.cliente_nome.trim().length < 2) {
    erros.push({
      secao: 'destinatario',
      campo: 'cliente_nome',
      label: 'Nome / Razão Social do Destinatário',
      motivo: 'Nome do destinatário não informado no pedido.',
    });
  }

  const docCheck = validarCpfOuCnpj(pedido.destinatario_documento || '');
  if (!docCheck.valido) {
    erros.push({
      secao: 'destinatario',
      campo: 'destinatario_documento',
      label: 'CPF ou CNPJ do Destinatário',
      motivo: pedido.destinatario_documento
        ? 'CPF ou CNPJ do destinatário possui dígitos verificadores inválidos.'
        : 'CPF ou CNPJ do destinatário não informado no pedido.',
    });
  }

  if (pedido.destinatario_ie && !validarInscricaoEstadual(pedido.destinatario_ie)) {
    erros.push({
      secao: 'destinatario',
      campo: 'destinatario_ie',
      label: 'IE do Destinatário',
      motivo: 'Inscrição Estadual do destinatário inválida.',
    });
  }

  if (!validarCep(pedido.destinatario_cep || '')) {
    erros.push({
      secao: 'destinatario',
      campo: 'destinatario_cep',
      label: 'CEP do Destinatário',
      motivo: 'CEP do destinatário obrigatório (8 dígitos numéricos).',
    });
  }

  if (!pedido.destinatario_logradouro || pedido.destinatario_logradouro.trim().length < 2) {
    erros.push({
      secao: 'destinatario',
      campo: 'destinatario_logradouro',
      label: 'Logradouro do Destinatário',
      motivo: 'Logradouro de entrega/faturamento não informado.',
    });
  }

  if (!pedido.destinatario_numero || pedido.destinatario_numero.trim().length < 1) {
    erros.push({
      secao: 'destinatario',
      campo: 'destinatario_numero',
      label: 'Número (Endereço Destinatário)',
      motivo: 'Número do endereço do destinatário não informado (use S/N se aplicável).',
    });
  }

  if (!pedido.destinatario_bairro || pedido.destinatario_bairro.trim().length < 2) {
    erros.push({
      secao: 'destinatario',
      campo: 'destinatario_bairro',
      label: 'Bairro do Destinatário',
      motivo: 'Bairro do destinatário não informado.',
    });
  }

  if (!pedido.destinatario_municipio || pedido.destinatario_municipio.trim().length < 2) {
    erros.push({
      secao: 'destinatario',
      campo: 'destinatario_municipio',
      label: 'Município do Destinatário',
      motivo: 'Município do destinatário não informado.',
    });
  }

  const destUf = String(pedido.destinatario_uf || '').trim().toUpperCase();
  if (!(UFS_VALIDAS as readonly string[]).includes(destUf)) {
    erros.push({
      secao: 'destinatario',
      campo: 'destinatario_uf',
      label: 'UF do Destinatário',
      motivo: 'UF de destino não informada ou inválida.',
    });
  }

  if (pedido.destinatario_codigo_municipio_ibge) {
    const ibgeClean = limparDigitos(pedido.destinatario_codigo_municipio_ibge);
    if (ibgeClean.length !== 7) {
      erros.push({
        secao: 'destinatario',
        campo: 'destinatario_codigo_municipio_ibge',
        label: 'Código IBGE do Destinatário',
        motivo: 'Quando informado, deve conter exatamente 7 dígitos numéricos.',
      });
    }
  }

  // Validação fiscal de cada item/produto (Story 33b + compatibilidade com CRT do emitente)
  const regimeEmitente = emitente?.regime_tributario || null;
  for (const item of pedido.itens || []) {
    const prod = item.produto;
    if (!prod) {
      erros.push({
        secao: 'item',
        campo: `item_${item.id_item}`,
        label: `Item #${item.id_item}`,
        motivo: 'Produto associado ao item não localizado no catálogo.',
      });
      continue;
    }

    if (!item.quantidade || Number(item.quantidade) <= 0) {
      erros.push({
        secao: 'item',
        campo: `item_${prod.sku}_quantidade`,
        label: `Item ${prod.sku}`,
        motivo: 'Quantidade do item deve ser maior que zero.',
      });
    }
    if (Number(item.preco_unitario || 0) <= 0) {
      erros.push({
        secao: 'item',
        campo: `item_${prod.sku}_preco`,
        label: `Item ${prod.sku}`,
        motivo: 'Valor unitário do item deve ser maior que zero para NF-e.',
      });
    }

    const aval = avaliarAptidaoFiscalProduto(prod, regimeEmitente);
    if (!aval.apto_nfe) {
      erros.push({
        secao: 'item',
        campo: `produto_${prod.sku}`,
        label: `Produto ${prod.sku} (${prod.nome})`,
        motivo: `Dados fiscais incompletos: ${aval.campos_faltantes.join(', ')}.`,
      });
    } else if (regimeEmitente) {
      const ehSimples = ['1', '2', '4'].includes(regimeEmitente);
      const cst = String(prod.cst_csosn || '').trim();
      if (ehSimples && CST_SET.has(cst)) {
        erros.push({
          secao: 'item',
          campo: `produto_${prod.sku}_cst_csosn`,
          label: `CST/CSOSN de ${prod.sku}`,
          motivo: `Emitente é Simples Nacional (CRT ${regimeEmitente}) e exige código CSOSN de 3 dígitos (ex: 102), mas o produto usa CST "${cst}".`,
        });
      } else if (regimeEmitente === '3' && CSOSN_SET.has(cst)) {
        erros.push({
          secao: 'item',
          campo: `produto_${prod.sku}_cst_csosn`,
          label: `CST/CSOSN de ${prod.sku}`,
          motivo: `Emitente é Regime Normal (CRT 3) e exige código CST de 2 dígitos (ex: 00), mas o produto usa CSOSN "${cst}".`,
        });
      }
    }
  }

  return erros;
}

export interface NFeMontadaResultado {
  chave_acesso: string;
  xml_gerado: string;
  emitente_snapshot: Record<string, any>;
  destinatario_snapshot: Record<string, any>;
  totais_snapshot: {
    vProd: number;
    vFrete: number;
    vDesc: number;
    vTotTrib: number;
    vBC: number;
    vICMS: number;
    vPIS: number;
    vCOFINS: number;
    vNF: number;
    vIBS: number;
    vCBS: number;
  };
  impostos_snapshot: Record<string, any>;
  itens_snapshot: Array<{
    id_produto: number;
    sku_snapshot: string;
    nome_snapshot: string;
    ncm_snapshot: string;
    cfop_snapshot: string;
    origem_snapshot: string;
    cst_csosn_snapshot: string;
    unidade_snapshot: string;
    cest_snapshot: string | null;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
    vFrete_item: number;
    vDesc_item: number;
    vTotTrib_item: number;
  }>;
}

function montarBlocoIcmsXml(params: {
  crt: string;
  orig: string;
  cstCsosn: string;
}): string {
  const { crt, orig, cstCsosn } = params;
  const isSimples = ['1', '2', '4'].includes(crt);

  if (isSimples) {
    if (cstCsosn === '101') {
      return `<ICMS><ICMSSN101><orig>${orig}</orig><CSOSN>101</CSOSN><pCredSN>0.00</pCredSN><vCredICMSSN>0.00</vCredICMSSN></ICMSSN101></ICMS>`;
    }
    if (['102', '103', '300', '400'].includes(cstCsosn)) {
      return `<ICMS><ICMSSN102><orig>${orig}</orig><CSOSN>${cstCsosn}</CSOSN></ICMSSN102></ICMS>`;
    }
    if (cstCsosn === '500') {
      return `<ICMS><ICMSSN500><orig>${orig}</orig><CSOSN>500</CSOSN></ICMSSN500></ICMS>`;
    }
    if (['201', '202', '203'].includes(cstCsosn)) {
      const tag = cstCsosn === '201' ? 'ICMSSN201' : 'ICMSSN202';
      return `<ICMS><${tag}><orig>${orig}</orig><CSOSN>${cstCsosn}</CSOSN><modBCST>4</modBCST><vBCST>0.00</vBCST><pICMSST>0.00</pICMSST><vICMSST>0.00</vICMSST></${tag}></ICMS>`;
    }
    return `<ICMS><ICMSSN900><orig>${orig}</orig><CSOSN>900</CSOSN></ICMSSN900></ICMS>`;
  }

  // CRT 3 (Regime Normal)
  if (cstCsosn === '00') {
    return `<ICMS><ICMS00><orig>${orig}</orig><CST>00</CST><modBC>3</modBC><vBC>0.00</vBC><pICMS>0.00</pICMS><vICMS>0.00</vICMS></ICMS00></ICMS>`;
  }
  if (['40', '41', '50'].includes(cstCsosn)) {
    return `<ICMS><ICMS40><orig>${orig}</orig><CST>${cstCsosn}</CST></ICMS40></ICMS>`;
  }
  if (cstCsosn === '60') {
    return `<ICMS><ICMS60><orig>${orig}</orig><CST>60</CST></ICMS60></ICMS>`;
  }
  return `<ICMS><ICMS90><orig>${orig}</orig><CST>${cstCsosn}</CST></ICMS90></ICMS>`;
}

function ajustarCfopParaDestino(cfopBase: string, idDest: '1' | '2'): string {
  const clean = padLeft(limparDigitos(cfopBase), 4);
  const sufixo = clean.slice(1);
  return `${idDest === '1' ? '5' : '6'}${sufixo}`;
}

export function montarXmlNFe400(params: {
  emitente: EmitenteFiscal;
  pedido: Pedido;
  serie: number;
  numero: number;
  dataEmissao?: Date;
}): NFeMontadaResultado {
  const { emitente, pedido, serie, numero } = params;
  const dataEmissao = params.dataEmissao || new Date();

  const erros = validarDadosParaNFe(emitente, pedido);
  if (erros.length > 0) {
    throw new Error(erros.map((e) => `${e.label}: ${e.motivo}`).join(' | '));
  }

  const chaveInfo = gerarChaveAcessoNFe({
    uf: emitente.uf,
    dataEmissao,
    cnpjEmitente: emitente.cnpj,
    serie,
    numero,
    tpEmis: '1',
  });

  const emitUf = emitente.uf.toUpperCase();
  const destUf = String(pedido.destinatario_uf || 'SP').trim().toUpperCase();
  const idDest: '1' | '2' = emitUf === destUf ? '1' : '2';

  const emitCMun =
    limparDigitos(emitente.codigo_municipio_ibge) ||
    CODIGO_MUNICIPIO_CAPITAL_UF[emitUf] ||
    '3550308';
  const destCMun =
    limparDigitos(pedido.destinatario_codigo_municipio_ibge) ||
    CODIGO_MUNICIPIO_CAPITAL_UF[destUf] ||
    '3550308';

  const docDest = limparDigitos(pedido.destinatario_documento);
  const isDestCnpj = docDest.length === 14;
  const destIe = pedido.destinatario_ie
    ? pedido.destinatario_ie.trim().toUpperCase()
    : '';
  // indIEDest: 1=Contribuinte ICMS, 2=Isento, 9=Não contribuinte
  const indIEDest =
    isDestCnpj && destIe && destIe !== 'ISENTO'
      ? '1'
      : destIe === 'ISENTO'
      ? '2'
      : '9';

  const tpAmb = emitente.ambiente === 'producao' ? '1' : '2';
  const dhEmi = formatarIsoTimezoneSP(dataEmissao);

  // Calcula vProd total e rateia frete/desconto com precisão nos centavos
  const itensPedido = pedido.itens || [];
  let vProdTotal = 0;
  const valoresBrutosItens = itensPedido.map((item) => {
    const qtd = Number(item.quantidade);
    const vUn = Number(item.preco_unitario);
    const vItem = Number((qtd * vUn).toFixed(2));
    vProdTotal = Number((vProdTotal + vItem).toFixed(2));
    return { item, qtd, vUn, vItem };
  });

  const vFreteTotal = Number(Number(pedido.custo_frete || 0).toFixed(2));
  const vDescTotal = Number(Number(pedido.valor_desconto || 0).toFixed(2));
  const aliquotaTributo = Number(pedido.aliquota_imposto_percentual || 6.0);

  let freteAcum = 0;
  let descAcum = 0;
  let vTotTribTotal = 0;

  const itensSnapshot: NFeMontadaResultado['itens_snapshot'] = [];
  const detXmlParts: string[] = [];

  valoresBrutosItens.forEach(({ item, qtd, vUn, vItem }, idx) => {
    const prod = item.produto!;
    const ehUltimo = idx === valoresBrutosItens.length - 1;
    const proporcao = vProdTotal > 0 ? vItem / vProdTotal : 0;

    const vFreteItem = ehUltimo
      ? Number((vFreteTotal - freteAcum).toFixed(2))
      : Number((vFreteTotal * proporcao).toFixed(2));
    freteAcum = Number((freteAcum + vFreteItem).toFixed(2));

    const vDescItem = ehUltimo
      ? Number((vDescTotal - descAcum).toFixed(2))
      : Number((vDescTotal * proporcao).toFixed(2));
    descAcum = Number((descAcum + vDescItem).toFixed(2));

    const baseItemLiquida = Math.max(0, Number((vItem + vFreteItem - vDescItem).toFixed(2)));
    const vTotTribItem = Number((baseItemLiquida * (aliquotaTributo / 100)).toFixed(2));
    vTotTribTotal = Number((vTotTribTotal + vTotTribItem).toFixed(2));

    const cfopAplicado = ajustarCfopParaDestino(prod.cfop!, idDest);
    const orig = String(prod.origem_mercadoria);
    const cstCsosn = String(prod.cst_csosn);
    const un = String(prod.unidade_comercial).toUpperCase();

    itensSnapshot.push({
      id_produto: prod.id_produto,
      sku_snapshot: prod.sku,
      nome_snapshot: prod.nome,
      ncm_snapshot: prod.ncm!,
      cfop_snapshot: cfopAplicado,
      origem_snapshot: orig,
      cst_csosn_snapshot: cstCsosn,
      unidade_snapshot: un,
      cest_snapshot: prod.cest || null,
      quantidade: qtd,
      valor_unitario: vUn,
      valor_total: vItem,
      vFrete_item: vFreteItem,
      vDesc_item: vDescItem,
      vTotTrib_item: vTotTribItem,
    });

    const nItem = idx + 1;
    const icmsXml = montarBlocoIcmsXml({
      crt: emitente.regime_tributario,
      orig,
      cstCsosn,
    });

    const pisTag = ['1', '2', '4'].includes(emitente.regime_tributario) ? 'PISOutr' : 'PISAliq';
    const pisCst = ['1', '2', '4'].includes(emitente.regime_tributario) ? '49' : '01';
    const pisXml =
      pisTag === 'PISOutr'
        ? `<PIS><PISOutr><CST>${pisCst}</CST><vBC>0.00</vBC><pPIS>0.00</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>`
        : `<PIS><PISAliq><CST>${pisCst}</CST><vBC>0.00</vBC><pPIS>0.00</pPIS><vPIS>0.00</vPIS></PISAliq></PIS>`;

    const cofinsTag = ['1', '2', '4'].includes(emitente.regime_tributario) ? 'COFINSOutr' : 'COFINSAliq';
    const cofinsCst = ['1', '2', '4'].includes(emitente.regime_tributario) ? '49' : '01';
    const cofinsXml =
      cofinsTag === 'COFINSOutr'
        ? `<COFINS><COFINSOutr><CST>${cofinsCst}</CST><vBC>0.00</vBC><pCOFINS>0.00</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>`
        : `<COFINS><COFINSAliq><CST>${cofinsCst}</CST><vBC>0.00</vBC><pCOFINS>0.00</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSAliq></COFINS>`;

    detXmlParts.push(
      `<det nItem="${nItem}">` +
        `<prod>` +
          `<cProd>${escapeXmlText(prod.sku)}</cProd>` +
          `<cEAN>SEM GTIN</cEAN>` +
          `<xProd>${escapeXmlText(prod.nome)}</xProd>` +
          `<NCM>${escapeXmlText(prod.ncm)}</NCM>` +
          (prod.cest ? `<CEST>${escapeXmlText(prod.cest)}</CEST>` : '') +
          `<CFOP>${cfopAplicado}</CFOP>` +
          `<uCom>${escapeXmlText(un)}</uCom>` +
          `<qCom>${qty4(qtd)}</qCom>` +
          `<vUnCom>${Number(vUn).toFixed(4)}</vUnCom>` +
          `<vProd>${money2(vItem)}</vProd>` +
          `<cEANTrib>SEM GTIN</cEANTrib>` +
          `<uTrib>${escapeXmlText(un)}</uTrib>` +
          `<qTrib>${qty4(qtd)}</qTrib>` +
          `<vUnTrib>${Number(vUn).toFixed(4)}</vUnTrib>` +
          (vFreteItem > 0 ? `<vFrete>${money2(vFreteItem)}</vFrete>` : '') +
          (vDescItem > 0 ? `<vDesc>${money2(vDescItem)}</vDesc>` : '') +
          `<indTot>1</indTot>` +
        `</prod>` +
        `<imposto>` +
          `<vTotTrib>${money2(vTotTribItem)}</vTotTrib>` +
          icmsXml +
          pisXml +
          cofinsXml +
        `</imposto>` +
      `</det>`
    );
  });

  const vNF = Math.max(0, Number((vProdTotal + vFreteTotal - vDescTotal).toFixed(2)));
  const xNomeDestXml =
    tpAmb === '2'
      ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
      : pedido.cliente_nome.trim();

  const xFantXml = emitente.nome_fantasia
    ? `<xFant>${escapeXmlText(emitente.nome_fantasia)}</xFant>`
    : '';
  const emitCplXml = emitente.complemento
    ? `<xCpl>${escapeXmlText(emitente.complemento)}</xCpl>`
    : '';
  const destCplXml = pedido.destinatario_complemento
    ? `<xCpl>${escapeXmlText(pedido.destinatario_complemento)}</xCpl>`
    : '';
  const destIeXml =
    indIEDest === '1' && destIe ? `<IE>${escapeXmlText(destIe)}</IE>` : '';
  const destEmailXml = pedido.destinatario_email
    ? `<email>${escapeXmlText(pedido.destinatario_email)}</email>`
    : '';

  const modFrete = vFreteTotal > 0 ? '0' : '9';

  const xmlGerado =
    `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">` +
      `<infNFe Id="${escapeXmlAttr(`NFe${chaveInfo.chave}`)}" versao="4.00">` +
        `<ide>` +
          `<cUF>${chaveInfo.cUF}</cUF>` +
          `<cNF>${chaveInfo.cNF}</cNF>` +
          `<natOp>VENDA DE MERCADORIA</natOp>` +
          `<mod>55</mod>` +
          `<serie>${serie}</serie>` +
          `<nNF>${numero}</nNF>` +
          `<dhEmi>${dhEmi}</dhEmi>` +
          `<tpNF>1</tpNF>` +
          `<idDest>${idDest}</idDest>` +
          `<cMunFG>${emitCMun}</cMunFG>` +
          `<tpImp>1</tpImp>` +
          `<tpEmis>1</tpEmis>` +
          `<cDV>${chaveInfo.cDV}</cDV>` +
          `<tpAmb>${tpAmb}</tpAmb>` +
          `<finNFe>1</finNFe>` +
          `<indFinal>1</indFinal>` +
          `<indPres>2</indPres>` +
          `<procEmi>0</procEmi>` +
          `<verProc>RezFireManager 1.0</verProc>` +
        `</ide>` +
        `<emit>` +
          `<CNPJ>${limparDigitos(emitente.cnpj)}</CNPJ>` +
          `<xNome>${escapeXmlText(emitente.razao_social)}</xNome>` +
          xFantXml +
          `<enderEmit>` +
            `<xLgr>${escapeXmlText(emitente.logradouro)}</xLgr>` +
            `<nro>${escapeXmlText(emitente.numero)}</nro>` +
            emitCplXml +
            `<xBairro>${escapeXmlText(emitente.bairro)}</xBairro>` +
            `<cMun>${emitCMun}</cMun>` +
            `<xMun>${escapeXmlText(emitente.municipio)}</xMun>` +
            `<UF>${emitUf}</UF>` +
            `<CEP>${limparDigitos(emitente.cep)}</CEP>` +
            `<cPais>1058</cPais>` +
            `<xPais>BRASIL</xPais>` +
          `</enderEmit>` +
          `<IE>${escapeXmlText(emitente.inscricao_estadual)}</IE>` +
          `<CRT>${emitente.regime_tributario}</CRT>` +
        `</emit>` +
        `<dest>` +
          (isDestCnpj ? `<CNPJ>${docDest}</CNPJ>` : `<CPF>${docDest}</CPF>`) +
          `<xNome>${escapeXmlText(xNomeDestXml)}</xNome>` +
          `<enderDest>` +
            `<xLgr>${escapeXmlText(pedido.destinatario_logradouro)}</xLgr>` +
            `<nro>${escapeXmlText(pedido.destinatario_numero)}</nro>` +
            destCplXml +
            `<xBairro>${escapeXmlText(pedido.destinatario_bairro)}</xBairro>` +
            `<cMun>${destCMun}</cMun>` +
            `<xMun>${escapeXmlText(pedido.destinatario_municipio)}</xMun>` +
            `<UF>${destUf}</UF>` +
            `<CEP>${limparDigitos(pedido.destinatario_cep)}</CEP>` +
            `<cPais>1058</cPais>` +
            `<xPais>BRASIL</xPais>` +
          `</enderDest>` +
          `<indIEDest>${indIEDest}</indIEDest>` +
          destIeXml +
          destEmailXml +
        `</dest>` +
        detXmlParts.join('') +
        `<total>` +
          `<ICMSTot>` +
            `<vBC>0.00</vBC>` +
            `<vICMS>0.00</vICMS>` +
            `<vICMSDeson>0.00</vICMSDeson>` +
            `<vFCP>0.00</vFCP>` +
            `<vBCST>0.00</vBCST>` +
            `<vST>0.00</vST>` +
            `<vFCPST>0.00</vFCPST>` +
            `<vFCPSTRet>0.00</vFCPSTRet>` +
            `<vProd>${money2(vProdTotal)}</vProd>` +
            `<vFrete>${money2(vFreteTotal)}</vFrete>` +
            `<vSeg>0.00</vSeg>` +
            `<vDesc>${money2(vDescTotal)}</vDesc>` +
            `<vII>0.00</vII>` +
            `<vIPI>0.00</vIPI>` +
            `<vIPIDevol>0.00</vIPIDevol>` +
            `<vPIS>0.00</vPIS>` +
            `<vCOFINS>0.00</vCOFINS>` +
            `<vOutro>0.00</vOutro>` +
            `<vNF>${money2(vNF)}</vNF>` +
            `<vTotTrib>${money2(vTotTribTotal)}</vTotTrib>` +
          `</ICMSTot>` +
        `</total>` +
        `<transp>` +
          `<modFrete>${modFrete}</modFrete>` +
        `</transp>` +
        `<pag>` +
          `<detPag>` +
            `<tPag>99</tPag>` +
            `<vPag>${money2(vNF)}</vPag>` +
          `</detPag>` +
        `</pag>` +
        `<infAdic>` +
          `<infCpl>${escapeXmlText(`Pedido RezFire: ${pedido.codigo_pedido} | Modalidade: ${pedido.modalidade_envio || 'Padrao'}`)}</infCpl>` +
        `</infAdic>` +
      `</infNFe>` +
    `</NFe>`;

  const emitenteSnapshot = {
    razao_social: emitente.razao_social,
    nome_fantasia: emitente.nome_fantasia,
    cnpj: limparDigitos(emitente.cnpj),
    inscricao_estadual: emitente.inscricao_estadual,
    regime_tributario: emitente.regime_tributario,
    endereco: `${emitente.logradouro}, ${emitente.numero}${emitente.complemento ? ' - ' + emitente.complemento : ''}`,
    bairro: emitente.bairro,
    municipio: emitente.municipio,
    codigo_municipio_ibge: emitCMun,
    uf: emitUf,
    cep: limparDigitos(emitente.cep),
  };

  const destinatarioSnapshot = {
    nome: pedido.cliente_nome.trim(),
    documento: docDest,
    tipo_documento: isDestCnpj ? 'CNPJ' : 'CPF',
    ie: destIe || null,
    indIEDest,
    logradouro: pedido.destinatario_logradouro,
    numero: pedido.destinatario_numero,
    complemento: pedido.destinatario_complemento || null,
    bairro: pedido.destinatario_bairro,
    municipio: pedido.destinatario_municipio,
    codigo_municipio_ibge: destCMun,
    uf: destUf,
    cep: limparDigitos(pedido.destinatario_cep),
    email: pedido.destinatario_email || null,
    idDest,
  };

  const totaisSnapshot = {
    vProd: vProdTotal,
    vFrete: vFreteTotal,
    vDesc: vDescTotal,
    vTotTrib: vTotTribTotal,
    vBC: 0,
    vICMS: 0,
    vPIS: 0,
    vCOFINS: 0,
    vNF,
    vIBS: 0,
    vCBS: 0,
  };

  const impostosSnapshot = {
    regime_tributario: emitente.regime_tributario,
    aliquota_estimada_simples_pct: aliquotaTributo,
    valor_aproximado_tributos: vTotTribTotal,
    reforma_tributaria_preparacao: {
      vIBS: 0,
      vCBS: 0,
      nota: 'Campos reservados para transição IBS/CBS conforme DoR 33c.',
    },
  };

  return {
    chave_acesso: chaveInfo.chave,
    xml_gerado: xmlGerado,
    emitente_snapshot: emitenteSnapshot,
    destinatario_snapshot: destinatarioSnapshot,
    totais_snapshot: totaisSnapshot,
    impostos_snapshot: impostosSnapshot,
    itens_snapshot: itensSnapshot,
  };
}

