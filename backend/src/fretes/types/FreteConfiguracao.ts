export const FRETE_TAXA_PERCENTUAL_PADRAO = 4.5;
export const FRETE_CUSTO_GASOLINA_PADRAO = 0;
export const FRETE_QUANTIDADE_UNIDADES_PADRAO = 1;
export const FRETE_TRANSPORTADORAS_OPCOES = ['JadLog', 'Loggi', 'Buslog'] as const;

export interface FreteConfiguracaoDados {
  freteConfiguracaoId?: number;
  freteTaxaPercentualPadrao: number;
  freteTransportadoraPadrao: string | null;
  freteAtualizadoPorUsuarioId?: number | null;
  freteConfiguracaoCriadaEm?: Date | string;
  freteConfiguracaoAtualizadaEm?: Date | string;
}

export interface FreteConfiguracaoAtualizarDTO {
  freteTaxaPercentualPadrao: number;
  freteTransportadoraPadrao?: string | null;
}
