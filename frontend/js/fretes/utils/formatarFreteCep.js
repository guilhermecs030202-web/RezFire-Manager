/**
 * Extrai até 8 dígitos de um CEP, preservando zeros à esquerda (nunca trata CEP como número).
 */
export function extrairFreteCepDigitos(freteCepEntrada) {
  return String(freteCepEntrada ?? '').replace(/\D/g, '').slice(0, 8);
}

/**
 * Formata CEP no padrão brasileiro 00000-000.
 */
export function formatarFreteCep(freteCepEntrada) {
  const freteDigitos = extrairFreteCepDigitos(freteCepEntrada);
  if (freteDigitos.length <= 5) {
    return freteDigitos;
  }
  return `${freteDigitos.slice(0, 5)}-${freteDigitos.slice(5)}`;
}

/**
 * Valida se o CEP contém exatamente 8 dígitos (com ou sem hífen).
 */
export function validarFreteCep(freteCepEntrada) {
  const freteTexto = String(freteCepEntrada ?? '').trim();
  const freteDigitos = freteTexto.replace(/\D/g, '');
  if (freteDigitos.length !== 8) {
    return false;
  }
  return /^\d{5}-?\d{3}$/.test(freteTexto);
}

/**
 * Aplica máscara de CEP preservando a posição do cursor durante a digitação.
 */
export function aplicarFreteMascaraCepComCursor(freteInputEl) {
  const freteValorAnterior = freteInputEl.value;
  const freteCursorAnterior = freteInputEl.selectionStart ?? freteValorAnterior.length;
  const freteDigitosAntesCursor = freteValorAnterior
    .slice(0, freteCursorAnterior)
    .replace(/\D/g, '').length;

  const freteFormatado = formatarFreteCep(freteValorAnterior);
  if (freteInputEl.value !== freteFormatado) {
    freteInputEl.value = freteFormatado;
  }

  let freteNovaPosicao = freteDigitosAntesCursor;
  if (freteDigitosAntesCursor > 5 && freteFormatado.length > 5) {
    freteNovaPosicao += 1;
  }
  freteNovaPosicao = Math.min(freteNovaPosicao, freteFormatado.length);

  if (typeof freteInputEl.setSelectionRange === 'function') {
    freteInputEl.setSelectionRange(freteNovaPosicao, freteNovaPosicao);
  }
}
