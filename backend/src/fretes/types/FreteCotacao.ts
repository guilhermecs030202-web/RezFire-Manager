export type FreteTipoMensagem = 'padrao' | 'direta';

export interface FreteCotacaoEntrada {
  freteCepDestino: string;
  freteValorOriginal: number;
  fretePrazoDiasUteis: number;
  freteTaxaPercentual: number;
  freteCustoGasolina?: number;
  freteQuantidadeUnidades?: number;
  freteTransportadora?: string | null;
  freteClienteNome?: string | null;
  freteClienteEndereco?: string | null;
  freteTipoMensagem: FreteTipoMensagem;
}

export interface FreteCalculoEntrada {
  freteValorOriginal: number;
  freteCustoGasolina?: number;
  freteTaxaPercentual: number;
}

export interface FreteCalculoResultado {
  freteValorOriginal: number;
  freteCustoGasolina: number;
  freteValorLiquidoNecessario: number;
  freteTaxaPercentual: number;
  freteValorComTaxa: number;
  freteValorFinal: number;
}

export interface FreteValidacaoErros {
  freteCepDestino?: string;
  freteValorOriginal?: string;
  fretePrazoDiasUteis?: string;
  freteTaxaPercentual?: string;
  freteCustoGasolina?: string;
  freteQuantidadeUnidades?: string;
  freteTransportadora?: string;
  freteClienteNome?: string;
  freteClienteEndereco?: string;
}

export interface FreteValidacaoResultado {
  freteValido: boolean;
  freteErros: FreteValidacaoErros;
}

export interface FreteTrechoFinalAnalise {
  freteTrechoEncontrado: boolean;
  freteCaracteresTrechoFinal: number;
  freteLimiteCaracteresFinal: number;
  freteExcedeuLimite: boolean;
  freteCaracteresExcedentes: number;
  freteCaracteresRestantes: number;
}

export interface FreteMensagemResultado {
  freteTipoMensagem: FreteTipoMensagem;
  freteMensagemGerada: string;
  freteTrechoFinalAnalise: FreteTrechoFinalAnalise | null;
}
