/**
 * Formata valor monetário brasileiro com espaço padrão ("R$ 105,00").
 */
export function formatarFreteMoeda(freteValorNumerico) {
  if (typeof freteValorNumerico !== 'number' || !Number.isFinite(freteValorNumerico)) {
    return 'R$ 0,00';
  }
  const freteFormatado = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(freteValorNumerico);

  return `R$ ${freteFormatado}`;
}

/**
 * Formata número monetário sem o símbolo "R$" (ex.: "90,08") para exibição em campos de entrada.
 */
export function formatarFreteNumeroInput(freteValorNumerico) {
  if (typeof freteValorNumerico !== 'number' || !Number.isFinite(freteValorNumerico)) {
    return '';
  }
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(freteValorNumerico);
}

/**
 * Formata percentual brasileiro (ex.: 4.5 -> "4,5%").
 */
export function formatarFreteTaxaPercentual(freteTaxaPercentual) {
  if (typeof freteTaxaPercentual !== 'number' || !Number.isFinite(freteTaxaPercentual)) {
    return '0%';
  }
  const freteFormatado = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(freteTaxaPercentual);

  return `${freteFormatado}%`;
}

/**
 * Formata taxa numérica para input sem "%" (ex.: 4.5 -> "4,5").
 */
export function formatarFreteTaxaInput(freteTaxaPercentual) {
  if (typeof freteTaxaPercentual !== 'number' || !Number.isFinite(freteTaxaPercentual)) {
    return '';
  }
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(freteTaxaPercentual);
}

/**
 * Interpreta entradas monetárias brasileiras (ex.: "90,08", "1.290,08", "90.08", "R$ 90,08").
 */
export function parseFreteValorMonetario(freteValorTexto) {
  if (typeof freteValorTexto === 'number') {
    return freteValorTexto;
  }
  const freteLimpo = String(freteValorTexto ?? '')
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .trim();

  if (!freteLimpo) {
    return NaN;
  }

  if (freteLimpo.includes(',')) {
    const freteNormalizado = freteLimpo.replace(/\./g, '').replace(',', '.');
    return Number(freteNormalizado);
  }

  return Number(freteLimpo);
}

/**
 * Interpreta entrada de taxa percentual aceitando vírgula ou ponto decimal.
 */
export function parseFreteTaxaPercentual(freteTaxaTexto) {
  if (typeof freteTaxaTexto === 'number') {
    return freteTaxaTexto;
  }
  const freteLimpo = String(freteTaxaTexto ?? '')
    .replace(/%/g, '')
    .replace(/\s+/g, '')
    .trim();

  if (!freteLimpo) {
    return NaN;
  }

  return Number(freteLimpo.replace(',', '.'));
}
