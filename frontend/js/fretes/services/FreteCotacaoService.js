export const FRETE_TAXA_PERCENTUAL_PADRAO = 4.5;
export const FRETE_CUSTO_GASOLINA_PADRAO = 0;
export const FRETE_QUANTIDADE_UNIDADES_PADRAO = 1;
export const FRETE_TRANSPORTADORAS_OPCOES = ['JadLog', 'Loggi', 'Buslog'];

/**
 * Serviço de comunicação do módulo de Fretes com a API RezFire.
 * Persiste apenas a configuração global da taxa (ação restrita ao GESTOR).
 * Nunca persiste cotações ou dados pessoais de clientes.
 */
export const FreteCotacaoService = {
  obterFretePerfilLocal() {
    try {
      const freteUserRaw = localStorage.getItem('rezfire_user');
      if (freteUserRaw) {
        const freteUser = JSON.parse(freteUserRaw);
        if (freteUser && freteUser.perfil) {
          return String(freteUser.perfil).toUpperCase();
        }
      }
    } catch {
      // Fallback seguro: se não houver metadado local, o backend ainda impõe RBAC.
    }
    return 'GESTOR';
  },

  async carregarFreteConfiguracoes() {
    const fretePerfilLocal = this.obterFretePerfilLocal();
    const freteFallback = {
      freteConfiguracao: {
        freteTaxaPercentualPadrao: FRETE_TAXA_PERCENTUAL_PADRAO,
        freteTransportadoraPadrao: null,
      },
      fretePodeEditarTaxa: fretePerfilLocal === 'GESTOR',
      freteFonte: 'fallback',
    };

    if (!window.RezFireAPI || !window.RezFireAPI.fretes) {
      return freteFallback;
    }

    try {
      const freteResposta = await window.RezFireAPI.fretes.obterConfiguracoes();
      if (freteResposta && freteResposta.sucesso && freteResposta.freteConfiguracao) {
        return {
          freteConfiguracao: {
            freteConfiguracaoId: freteResposta.freteConfiguracao.freteConfiguracaoId,
            freteTaxaPercentualPadrao: Number(
              freteResposta.freteConfiguracao.freteTaxaPercentualPadrao ?? FRETE_TAXA_PERCENTUAL_PADRAO
            ),
            freteTransportadoraPadrao:
              freteResposta.freteConfiguracao.freteTransportadoraPadrao || null,
            freteConfiguracaoAtualizadaEm:
              freteResposta.freteConfiguracao.freteConfiguracaoAtualizadaEm || null,
          },
          fretePodeEditarTaxa:
            typeof freteResposta.fretePodeEditarTaxa === 'boolean'
              ? freteResposta.fretePodeEditarTaxa
              : fretePerfilLocal === 'GESTOR',
          freteFonte: 'api',
        };
      }
      return freteFallback;
    } catch (freteErro) {
      return {
        ...freteFallback,
        freteErroCarregamento: freteErro?.message || 'Não foi possível conectar ao servidor.',
      };
    }
  },

  async salvarFreteConfiguracoes({ freteTaxaPercentualPadrao, freteTransportadoraPadrao }) {
    if (!window.RezFireAPI || !window.RezFireAPI.fretes) {
      throw new Error('Cliente da API RezFire indisponível.');
    }
    return window.RezFireAPI.fretes.atualizarConfiguracoes({
      freteTaxaPercentualPadrao,
      freteTransportadoraPadrao: freteTransportadoraPadrao || null,
    });
  },
};
