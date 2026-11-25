import { FreteCalculoEntrada, FreteCalculoResultado } from '../types/FreteCotacao';

const FRETE_ESCALA_CENTAVOS = 100;
const FRETE_ESCALA_TAXA = 10000;
const FRETE_ESCALA_CEM_PORCENTO = 1000000n;
const FRETE_FATOR_REAIS = 10000n; // 1_000_000 / 100

function converterFreteMoedaParaCentavos(freteValorMonetario: number, freteNomeCampo: string): bigint {
  if (typeof freteValorMonetario !== 'number' || !Number.isFinite(freteValorMonetario)) {
    throw new Error(`${freteNomeCampo} deve ser um número válido.`);
  }
  return BigInt(Math.round(freteValorMonetario * FRETE_ESCALA_CENTAVOS));
}

function converterFreteTaxaParaEscala(freteTaxaPercentual: number): bigint {
  if (typeof freteTaxaPercentual !== 'number' || !Number.isFinite(freteTaxaPercentual)) {
    throw new Error('A taxa percentual do frete deve ser um número válido.');
  }
  if (freteTaxaPercentual < 0) {
    throw new Error('A taxa percentual do frete não pode ser negativa.');
  }
  if (freteTaxaPercentual >= 100) {
    throw new Error('A taxa percentual do frete deve ser menor que 100%.');
  }
  const freteTaxaEscala = BigInt(Math.round(freteTaxaPercentual * FRETE_ESCALA_TAXA));
  if (freteTaxaEscala >= FRETE_ESCALA_CEM_PORCENTO) {
    throw new Error('A taxa percentual do frete deve ser menor que 100%.');
  }
  return freteTaxaEscala;
}

/**
 * Calcula o valor bruto necessário do frete para absorver o desconto percentual
 * e arredonda matematicamente para cima até o próximo inteiro em reais,
 * usando aritmética inteira exata (BigInt) para eliminar erros de ponto flutuante.
 */
export function calcularFreteValorFinal(
  freteEntrada: FreteCalculoEntrada
): FreteCalculoResultado {
  const freteValorOriginalCentavos = converterFreteMoedaParaCentavos(
    freteEntrada.freteValorOriginal,
    'O valor original do frete'
  );
  if (freteValorOriginalCentavos <= 0n) {
    throw new Error('O valor original do frete deve ser maior que zero.');
  }

  const freteGasolinaInformada = freteEntrada.freteCustoGasolina ?? 0;
  const freteCustoGasolinaCentavos = converterFreteMoedaParaCentavos(
    freteGasolinaInformada,
    'O custo adicional de gasolina'
  );
  if (freteCustoGasolinaCentavos < 0n) {
    throw new Error('O custo adicional de gasolina não pode ser negativo.');
  }

  const freteTaxaEscala = converterFreteTaxaParaEscala(freteEntrada.freteTaxaPercentual);
  const freteDivisorEscala = FRETE_ESCALA_CEM_PORCENTO - freteTaxaEscala;

  if (freteDivisorEscala <= 0n) {
    throw new Error('A taxa percentual do frete impede o cálculo por divisão por zero.');
  }

  const freteValorLiquidoCentavos =
    freteValorOriginalCentavos + freteCustoGasolinaCentavos;

  // Valor com taxa arredondado em 2 casas decimais (half-up) para exibição detalhada
  const freteNumeradorCentavos = freteValorLiquidoCentavos * FRETE_ESCALA_CEM_PORCENTO;
  const freteValorComTaxaCentavos =
    (freteNumeradorCentavos + freteDivisorEscala / 2n) / freteDivisorEscala;

  // Arredondamento matemático para cima em reais inteiros, sem somar R$ 1,00 quando exato
  const freteNumeradorReais = freteValorLiquidoCentavos * FRETE_FATOR_REAIS;
  const freteValorFinalReaisInteiro =
    (freteNumeradorReais + freteDivisorEscala - 1n) / freteDivisorEscala;

  return {
    freteValorOriginal: Number(freteValorOriginalCentavos) / FRETE_ESCALA_CENTAVOS,
    freteCustoGasolina: Number(freteCustoGasolinaCentavos) / FRETE_ESCALA_CENTAVOS,
    freteValorLiquidoNecessario: Number(freteValorLiquidoCentavos) / FRETE_ESCALA_CENTAVOS,
    freteTaxaPercentual: Number(freteTaxaEscala) / FRETE_ESCALA_TAXA,
    freteValorComTaxa: Number(freteValorComTaxaCentavos) / FRETE_ESCALA_CENTAVOS,
    freteValorFinal: Number(freteValorFinalReaisInteiro),
  };
}
