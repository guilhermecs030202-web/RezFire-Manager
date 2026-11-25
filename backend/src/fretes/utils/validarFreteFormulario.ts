import { FreteCotacaoEntrada, FreteValidacaoErros, FreteValidacaoResultado } from '../types/FreteCotacao';
import { validarFreteCep } from './formatarFreteCep';

export function validarFreteTaxaPercentual(freteTaxaPercentual: number): string | null {
  if (typeof freteTaxaPercentual !== 'number' || !Number.isFinite(freteTaxaPercentual)) {
    return 'Informe uma taxa percentual válida.';
  }
  if (freteTaxaPercentual < 0) {
    return 'A taxa percentual não pode ser negativa.';
  }
  if (freteTaxaPercentual >= 100) {
    return 'A taxa percentual deve ser menor que 100%.';
  }
  return null;
}

export function validarFreteFormulario(freteDados: Partial<FreteCotacaoEntrada>): FreteValidacaoResultado {
  const freteErros: FreteValidacaoErros = {};

  // 1. CEP de destino
  if (!freteDados.freteCepDestino || !String(freteDados.freteCepDestino).trim()) {
    freteErros.freteCepDestino = 'Informe o CEP de destino com 8 dígitos.';
  } else if (!validarFreteCep(String(freteDados.freteCepDestino))) {
    freteErros.freteCepDestino = 'CEP incompleto ou inválido. Utilize 8 dígitos (00000-000).';
  }

  // 2. Valor original do frete
  if (
    typeof freteDados.freteValorOriginal !== 'number' ||
    !Number.isFinite(freteDados.freteValorOriginal) ||
    freteDados.freteValorOriginal <= 0
  ) {
    freteErros.freteValorOriginal = 'Informe um valor de frete maior que R$ 0,00.';
  }

  // 3. Prazo em dias úteis
  if (
    typeof freteDados.fretePrazoDiasUteis !== 'number' ||
    !Number.isInteger(freteDados.fretePrazoDiasUteis) ||
    freteDados.fretePrazoDiasUteis <= 0
  ) {
    freteErros.fretePrazoDiasUteis = 'Informe um prazo inteiro positivo em dias úteis.';
  }

  // 4. Taxa percentual
  const freteErroTaxa = validarFreteTaxaPercentual(freteDados.freteTaxaPercentual as number);
  if (freteErroTaxa) {
    freteErros.freteTaxaPercentual = freteErroTaxa;
  }

  // 5. Custo adicional de gasolina (opcional, >= 0)
  const freteGasolina = freteDados.freteCustoGasolina ?? 0;
  if (typeof freteGasolina !== 'number' || !Number.isFinite(freteGasolina) || freteGasolina < 0) {
    freteErros.freteCustoGasolina = 'O custo de gasolina não pode ser negativo.';
  }

  // 6. Quantidade de unidades (padrão 1, inteiro positivo)
  const freteQuantidade = freteDados.freteQuantidadeUnidades ?? 1;
  if (typeof freteQuantidade !== 'number' || !Number.isInteger(freteQuantidade) || freteQuantidade <= 0) {
    freteErros.freteQuantidadeUnidades = 'A quantidade deve ser um número inteiro positivo.';
  }

  // 7. Regras específicas do Modo 2 — Mensagem Direta
  if (freteDados.freteTipoMensagem === 'direta') {
    const freteEndereco = String(freteDados.freteClienteEndereco ?? '').trim();
    if (!freteEndereco) {
      freteErros.freteClienteEndereco =
        'Informe o endereço completo do cliente (Rua, número, CEP, cidade/UF).';
    }

    const freteTransportadora = String(freteDados.freteTransportadora ?? '').trim();
    if (!freteTransportadora) {
      freteErros.freteTransportadora =
        'Selecione ou informe a transportadora para gerar a Mensagem Direta.';
    }
  }

  return {
    freteValido: Object.keys(freteErros).length === 0,
    freteErros,
  };
}
