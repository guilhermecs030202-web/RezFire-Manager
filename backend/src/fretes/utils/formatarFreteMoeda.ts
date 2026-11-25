/**
 * Formata valor monetário brasileiro com espaço padrão ("R$ 105,00"),
 * evitando espaço inseparável (\u00A0) que pode dificultar comparações ou colagens.
 */
export function formatarFreteMoeda(freteValorNumerico: number): string {
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
 * Formata percentual brasileiro (ex.: 4.5 -> "4,5%").
 */
export function formatarFreteTaxaPercentual(freteTaxaPercentual: number): string {
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
 * Converte texto monetário brasileiro (ex.: "R$ 1.290,08", "90,08", "90.08") para número.
 */
export function parseFreteValorMonetario(freteValorTexto: string | number): number {
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

  // Se contém vírgula, assume formato pt-BR (ponto como milhar, vírgula como decimal)
  if (freteLimpo.includes(',')) {
    const freteNormalizado = freteLimpo.replace(/\./g, '').replace(',', '.');
    return Number(freteNormalizado);
  }

  return Number(freteLimpo);
}
