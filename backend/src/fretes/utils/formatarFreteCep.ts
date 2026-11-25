/**
 * Extrai apenas os 8 dígitos numéricos de um CEP, preservando zeros à esquerda.
 * Nunca trata CEP como número.
 */
export function extrairFreteCepDigitos(freteCepEntrada: string): string {
  return String(freteCepEntrada ?? '').replace(/\D/g, '').slice(0, 8);
}

/**
 * Formata CEP no padrão brasileiro 00000-000 preservando zeros à esquerda.
 */
export function formatarFreteCep(freteCepEntrada: string): string {
  const freteDigitos = extrairFreteCepDigitos(freteCepEntrada);
  if (freteDigitos.length <= 5) {
    return freteDigitos;
  }
  return `${freteDigitos.slice(0, 5)}-${freteDigitos.slice(5)}`;
}

/**
 * Verifica se o CEP possui exatamente 8 dígitos.
 */
export function validarFreteCep(freteCepEntrada: string): boolean {
  const freteTexto = String(freteCepEntrada ?? '').trim();
  const freteDigitos = freteTexto.replace(/\D/g, '');
  if (freteDigitos.length !== 8) {
    return false;
  }
  return /^\d{5}-?\d{3}$/.test(freteTexto);
}
