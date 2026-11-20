export const UFS_VALIDAS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const REGIMES_TRIBUTARIOS = [
  { codigo: '1', nome: 'Simples Nacional', descricao: 'CRT 1 — Optante pelo Simples Nacional (RezFire padrão)' },
  { codigo: '2', nome: 'Simples Nacional — Excesso de sublimite', descricao: 'CRT 2 — Sublimite estadual ultrapassado' },
  { codigo: '3', nome: 'Regime Normal (Lucro Presumido / Real)', descricao: 'CRT 3 — Utiliza tabela CST (2 dígitos)' },
  { codigo: '4', nome: 'Simples Nacional — MEI', descricao: 'CRT 4 — Microempreendedor Individual' },
] as const;

export const ORIGENS_MERCADORIA = [
  { codigo: '0', descricao: '0 — Nacional (exceto as indicadas nos códigos 3, 4, 5 e 8)' },
  { codigo: '1', descricao: '1 — Estrangeira — Importação direta' },
  { codigo: '2', descricao: '2 — Estrangeira — Adquirida no mercado interno' },
  { codigo: '3', descricao: '3 — Nacional — Conteúdo de Importação > 40% e <= 70%' },
  { codigo: '4', descricao: '4 — Nacional — Produção em conformidade com processos produtivos básicos' },
  { codigo: '5', descricao: '5 — Nacional — Conteúdo de Importação <= 40%' },
  { codigo: '6', descricao: '6 — Estrangeira — Importação direta sem similar nacional (CAMEX)' },
  { codigo: '7', descricao: '7 — Estrangeira — Mercado interno sem similar nacional (CAMEX)' },
  { codigo: '8', descricao: '8 — Nacional — Conteúdo de Importação > 70%' },
] as const;

export const CSOSN_LISTA = [
  { codigo: '101', descricao: '101 — Tributada pelo Simples Nacional com permissão de crédito' },
  { codigo: '102', descricao: '102 — Tributada pelo Simples Nacional sem permissão de crédito' },
  { codigo: '103', descricao: '103 — Isenção do ICMS no Simples Nacional para faixa de receita bruta' },
  { codigo: '201', descricao: '201 — Tributada pelo SN com permissão de crédito e cobrança do ICMS por ST' },
  { codigo: '202', descricao: '202 — Tributada pelo SN sem permissão de crédito e cobrança do ICMS por ST' },
  { codigo: '203', descricao: '203 — Isenção do ICMS no SN para faixa de receita bruta e cobrança por ST' },
  { codigo: '300', descricao: '300 — Imune' },
  { codigo: '400', descricao: '400 — Não tributada pelo Simples Nacional' },
  { codigo: '500', descricao: '500 — ICMS cobrado anteriormente por substituição tributária ou antecipação' },
  { codigo: '900', descricao: '900 — Outros' },
] as const;

export const CST_LISTA = [
  { codigo: '00', descricao: '00 — Tributada integralmente' },
  { codigo: '10', descricao: '10 — Tributada e com cobrança do ICMS por substituição tributária' },
  { codigo: '20', descricao: '20 — Com redução de base de cálculo' },
  { codigo: '30', descricao: '30 — Isenta ou não tributada e com cobrança do ICMS por ST' },
  { codigo: '40', descricao: '40 — Isenta' },
  { codigo: '41', descricao: '41 — Não tributada' },
  { codigo: '50', descricao: '50 — Suspensão' },
  { codigo: '51', descricao: '51 — Diferimento' },
  { codigo: '60', descricao: '60 — ICMS cobrado anteriormente por substituição tributária' },
  { codigo: '70', descricao: '70 — Com redução de base de cálculo e cobrança do ICMS por ST' },
  { codigo: '90', descricao: '90 — Outras' },
] as const;

export const CFOPS_SUGERIDOS = [
  { codigo: '5102', descricao: '5102 — Venda de mercadoria adquirida/recebida de terceiros (dentro do estado)' },
  { codigo: '5405', descricao: '5405 — Venda de mercadoria com ST cobrada anteriormente (dentro do estado)' },
  { codigo: '6102', descricao: '6102 — Venda de mercadoria adquirida/recebida de terceiros (interestadual)' },
  { codigo: '6404', descricao: '6404 — Venda de mercadoria sujeita à ST (interestadual)' },
  { codigo: '5101', descricao: '5101 — Venda de produção do estabelecimento (dentro do estado)' },
  { codigo: '6101', descricao: '6101 — Venda de produção do estabelecimento (interestadual)' },
] as const;

export const NCMS_SUGERIDOS_REZFIRE = [
  { codigo: '84241000', descricao: '84241000 — Extintores de incêndio, mesmo carregados' },
  { codigo: '84249090', descricao: '84249090 — Partes e acessórios de aparelhos extintores (mangueira/bico/válvula)' },
  { codigo: '83024900', descricao: '83024900 — Suportes metálicos de fixação para parede/solo' },
  { codigo: '39269090', descricao: '39269090 — Placas de sinalização fotoluminescente em PVC' },
] as const;

export const UNIDADES_COMERCIAIS_SUGERIDAS = ['UN', 'PC', 'KIT', 'CX', 'KG', 'LT', 'PAR'] as const;

export const CODIGO_UF_IBGE: Record<string, string> = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53',
  ES: '32', GO: '52', MA: '21', MT: '51', MS: '50', MG: '31', PA: '15',
  PB: '25', PR: '41', PE: '26', PI: '22', RJ: '33', RN: '24', RS: '43',
  RO: '11', RR: '14', SC: '42', SP: '35', SE: '28', TO: '17',
};

export const CODIGO_MUNICIPIO_CAPITAL_UF: Record<string, string> = {
  AC: '1200401', AL: '2704302', AM: '1302603', AP: '1600303', BA: '2927408',
  CE: '2304400', DF: '5300108', ES: '3205309', GO: '5208707', MA: '2111300',
  MG: '3106200', MS: '5002704', MT: '5103403', PA: '1501402', PB: '2507507',
  PE: '2611606', PI: '2211001', PR: '4106902', RJ: '3304557', RN: '2408102',
  RO: '1100205', RR: '1400100', RS: '4314902', SC: '4205407', SE: '2800308',
  SP: '3550308', TO: '1721000',
};

const CSOSN_SET = new Set<string>(CSOSN_LISTA.map((item) => item.codigo));
const CST_SET = new Set<string>(CST_LISTA.map((item) => item.codigo));
const ORIGEM_SET = new Set<string>(ORIGENS_MERCADORIA.map((item) => item.codigo));

export function limparDigitos(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace(/\D/g, '');
}

export function formatarCnpj(cnpj: string): string {
  const digits = limparDigitos(cnpj);
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function formatarCpf(cpf: string): string {
  const digits = limparDigitos(cpf);
  if (digits.length !== 11) return cpf;
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

export function formatarCpfOuCnpj(doc: string): string {
  const digits = limparDigitos(doc);
  if (digits.length === 11) return formatarCpf(digits);
  if (digits.length === 14) return formatarCnpj(digits);
  return doc;
}

export function validarCpf(cpf: string): boolean {
  const digits = limparDigitos(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcDigito = (base: string, fatorInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (fatorInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 || resto === 11 ? 0 : resto;
  };

  const d1 = calcDigito(digits.slice(0, 9), 10);
  if (d1 !== Number(digits[9])) return false;

  const d2 = calcDigito(digits.slice(0, 10), 11);
  return d2 === Number(digits[10]);
}

export function validarCpfOuCnpj(doc: string): {
  valido: boolean;
  tipo: 'CPF' | 'CNPJ' | null;
  digitos: string;
} {
  const digitos = limparDigitos(doc);
  if (digitos.length === 11) {
    return { valido: validarCpf(digitos), tipo: 'CPF', digitos };
  }
  if (digitos.length === 14) {
    return { valido: validarCnpj(digitos), tipo: 'CNPJ', digitos };
  }
  return { valido: false, tipo: null, digitos };
}

export function validarCnpj(cnpj: string): boolean {
  const digits = limparDigitos(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcDigito = (base: string, pesos: number[]) => {
    let soma = 0;
    for (let i = 0; i < pesos.length; i++) {
      soma += Number(base[i]) * pesos[i];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigito(digits.slice(0, 12), pesos1);
  if (d1 !== Number(digits[12])) return false;

  const d2 = calcDigito(digits.slice(0, 13), pesos2);
  return d2 === Number(digits[13]);
}

export function validarInscricaoEstadual(ie: string): boolean {
  const raw = String(ie || '').trim().toUpperCase();
  if (!raw) return false;
  if (raw === 'ISENTO') return true;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 2 && digits.length <= 14;
}

export function validarCep(cep: string): boolean {
  const digits = limparDigitos(cep);
  return digits.length === 8;
}

export interface DadosFiscaisProdutoInput {
  ncm?: string | null;
  cfop?: string | null;
  origem_mercadoria?: string | null;
  cst_csosn?: string | null;
  unidade_comercial?: string | null;
  cest?: string | null;
}

export interface DadosFiscaisProdutoNormalizados {
  ncm: string | null;
  cfop: string | null;
  origem_mercadoria: string | null;
  cst_csosn: string | null;
  unidade_comercial: string | null;
  cest: string | null;
}

function limparTextoOpcional(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const trimmed = String(v).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normaliza e valida os campos fiscais de um produto (33b).
 * Campos não informados (vazios/null) permanecem null (produto fica marcado como pendente para NF-e),
 * mas qualquer campo preenchido com formato inválido é rejeitado imediatamente com mensagem clara.
 */
export function normalizarEValidarDadosFiscaisProduto(
  input: DadosFiscaisProdutoInput
): DadosFiscaisProdutoNormalizados {
  const ncmRaw = limparTextoOpcional(input.ncm);
  let ncm: string | null = null;
  if (ncmRaw !== null) {
    const clean = ncmRaw.replace(/[.\-\s]/g, '');
    if (!/^\d{8}$/.test(clean)) {
      throw new Error('NCM inválido: deve conter exatamente 8 dígitos numéricos (ex: 84241000).');
    }
    ncm = clean;
  }

  const cfopRaw = limparTextoOpcional(input.cfop);
  let cfop: string | null = null;
  if (cfopRaw !== null) {
    const clean = cfopRaw.replace(/[.\-\s]/g, '');
    if (!/^[56]\d{3}$/.test(clean)) {
      throw new Error('CFOP inválido: deve conter 4 dígitos iniciados em 5 (estadual) ou 6 (interestadual), ex: 5102 ou 6102.');
    }
    cfop = clean;
  }

  const origemRaw = limparTextoOpcional(input.origem_mercadoria);
  let origem_mercadoria: string | null = null;
  if (origemRaw !== null) {
    if (!ORIGEM_SET.has(origemRaw)) {
      throw new Error('Origem da mercadoria inválida: informe um código de 0 a 8 conforme Tabela A da SEFAZ.');
    }
    origem_mercadoria = origemRaw;
  }

  const cstRaw = limparTextoOpcional(input.cst_csosn);
  let cst_csosn: string | null = null;
  if (cstRaw !== null) {
    const clean = cstRaw.replace(/\D/g, '');
    if (!CSOSN_SET.has(clean) && !CST_SET.has(clean)) {
      throw new Error(
        `CST/CSOSN inválido ("${cstRaw}"): utilize um código CSOSN do Simples Nacional (101, 102, 103, 201, 202, 203, 300, 400, 500, 900) ou CST do Regime Normal (00, 10, 20, 30, 40, 41, 50, 51, 60, 70, 90).`
      );
    }
    cst_csosn = clean;
  }

  const unidadeRaw = limparTextoOpcional(input.unidade_comercial);
  let unidade_comercial: string | null = null;
  if (unidadeRaw !== null) {
    const clean = unidadeRaw.toUpperCase();
    if (!/^[A-Z0-9]{1,6}$/.test(clean)) {
      throw new Error('Unidade comercial inválida: informe de 1 a 6 caracteres alfanuméricos sem acentos (ex: UN, PC, KIT, CX, KG).');
    }
    unidade_comercial = clean;
  }

  const cestRaw = limparTextoOpcional(input.cest);
  let cest: string | null = null;
  if (cestRaw !== null) {
    const clean = cestRaw.replace(/[.\-\s]/g, '');
    if (!/^\d{7}$/.test(clean)) {
      throw new Error('CEST inválido: quando informado, deve conter exatamente 7 dígitos numéricos.');
    }
    cest = clean;
  }

  return {
    ncm,
    cfop,
    origem_mercadoria,
    cst_csosn,
    unidade_comercial,
    cest,
  };
}

export interface AvaliacaoFiscalProduto {
  apto_nfe: boolean;
  campos_faltantes: string[];
  alertas_fiscais: string[];
  resumo: string;
}

const LABELS_CAMPOS_FISCAIS: Record<string, string> = {
  ncm: 'NCM (8 dígitos)',
  cfop: 'CFOP (4 dígitos)',
  origem_mercadoria: 'Origem da mercadoria (0 a 8)',
  cst_csosn: 'CST/CSOSN',
  unidade_comercial: 'Unidade comercial (ex: UN)',
};

export function avaliarAptidaoFiscalProduto(
  produto: DadosFiscaisProdutoInput,
  regimeTributarioEmitente?: string | null
): AvaliacaoFiscalProduto {
  const faltantes: string[] = [];
  const alertas: string[] = [];

  if (!produto.ncm || !/^\d{8}$/.test(String(produto.ncm).trim())) {
    faltantes.push(LABELS_CAMPOS_FISCAIS.ncm);
  }
  if (!produto.cfop || !/^[56]\d{3}$/.test(String(produto.cfop).trim())) {
    faltantes.push(LABELS_CAMPOS_FISCAIS.cfop);
  }
  if (
    produto.origem_mercadoria === null ||
    produto.origem_mercadoria === undefined ||
    !ORIGEM_SET.has(String(produto.origem_mercadoria).trim())
  ) {
    faltantes.push(LABELS_CAMPOS_FISCAIS.origem_mercadoria);
  }

  const cst = produto.cst_csosn ? String(produto.cst_csosn).trim() : '';
  if (!cst || (!CSOSN_SET.has(cst) && !CST_SET.has(cst))) {
    faltantes.push(LABELS_CAMPOS_FISCAIS.cst_csosn);
  } else if (regimeTributarioEmitente) {
    const ehSimples = ['1', '2', '4'].includes(regimeTributarioEmitente);
    if (ehSimples && CST_SET.has(cst)) {
      alertas.push(`Emitente está no Simples Nacional (CRT ${regimeTributarioEmitente}), mas o produto usa CST (${cst}) em vez de CSOSN (3 dígitos).`);
    } else if (regimeTributarioEmitente === '3' && CSOSN_SET.has(cst)) {
      alertas.push(`Emitente está no Regime Normal (CRT 3), mas o produto usa CSOSN (${cst}) em vez de CST (2 dígitos).`);
    }
  }

  if (!produto.unidade_comercial || !/^[A-Z0-9]{1,6}$/.test(String(produto.unidade_comercial).trim().toUpperCase())) {
    faltantes.push(LABELS_CAMPOS_FISCAIS.unidade_comercial);
  }

  const apto = faltantes.length === 0;
  const resumo = apto
    ? 'Apto para emissão de NF-e'
    : `Pendente (${faltantes.join(', ')})`;

  return {
    apto_nfe: apto,
    campos_faltantes: faltantes,
    alertas_fiscais: alertas,
    resumo,
  };
}

