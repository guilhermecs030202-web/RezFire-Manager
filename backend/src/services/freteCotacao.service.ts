import { AppDataSource } from '../config/database';
import { FreteConfiguracao } from '../entities/FreteConfiguracao';
import {
  FRETE_TAXA_PERCENTUAL_PADRAO,
  FreteConfiguracaoAtualizarDTO,
  FreteConfiguracaoDados,
} from '../fretes/types/FreteConfiguracao';
import { FreteCotacaoEntrada } from '../fretes/types/FreteCotacao';
import { calcularFreteValorFinal } from '../fretes/utils/calcularFreteValorFinal';
import {
  validarFreteFormulario,
  validarFreteTaxaPercentual,
} from '../fretes/utils/validarFreteFormulario';
import { FreteMensagemService } from '../fretes/services/FreteMensagemService';

export class FreteCotacaoService {
  private readonly freteMensagemService = new FreteMensagemService();

  private get freteConfiguracaoRepo() {
    return AppDataSource.getRepository(FreteConfiguracao);
  }

  private mapearFreteConfiguracao(freteEntidade: FreteConfiguracao): FreteConfiguracaoDados {
    return {
      freteConfiguracaoId: freteEntidade.frete_configuracao_id,
      freteTaxaPercentualPadrao: Number(freteEntidade.frete_taxa_percentual_padrao),
      freteTransportadoraPadrao: freteEntidade.frete_transportadora_padrao || null,
      freteAtualizadoPorUsuarioId: freteEntidade.frete_atualizado_por_usuario_id ?? null,
      freteConfiguracaoCriadaEm: freteEntidade.frete_configuracao_criada_em,
      freteConfiguracaoAtualizadaEm: freteEntidade.frete_configuracao_atualizada_em,
    };
  }

  /**
   * Obtém a configuração global persistida no MySQL.
   * Caso ainda não exista registro, cria o padrão inicial (taxa 4,5%).
   */
  async obterFreteConfiguracao(): Promise<FreteConfiguracaoDados> {
    if (!AppDataSource.isInitialized) {
      return {
        freteTaxaPercentualPadrao: FRETE_TAXA_PERCENTUAL_PADRAO,
        freteTransportadoraPadrao: null,
        freteAtualizadoPorUsuarioId: null,
      };
    }

    const freteRegistros = await this.freteConfiguracaoRepo.find({
      order: { frete_configuracao_id: 'ASC' },
      take: 1,
    });

    if (freteRegistros.length > 0) {
      return this.mapearFreteConfiguracao(freteRegistros[0]);
    }

    const freteConfigInicial = this.freteConfiguracaoRepo.create({
      frete_taxa_percentual_padrao: FRETE_TAXA_PERCENTUAL_PADRAO,
      frete_transportadora_padrao: null,
      frete_atualizado_por_usuario_id: null,
    });

    const freteSalva = await this.freteConfiguracaoRepo.save(freteConfigInicial);
    return this.mapearFreteConfiguracao(freteSalva);
  }

  /**
   * Atualiza a configuração global padrão no MySQL (ação exclusiva do perfil GESTOR).
   */
  async atualizarFreteConfiguracao(
    freteDados: FreteConfiguracaoAtualizarDTO,
    freteUsuarioId?: number | null
  ): Promise<FreteConfiguracaoDados> {
    const freteErroTaxa = validarFreteTaxaPercentual(freteDados.freteTaxaPercentualPadrao);
    if (freteErroTaxa) {
      throw new Error(freteErroTaxa);
    }

    const freteTransportadoraNormalizada =
      freteDados.freteTransportadoraPadrao !== undefined
        ? String(freteDados.freteTransportadoraPadrao ?? '').trim() || null
        : undefined;

    if (freteTransportadoraNormalizada && freteTransportadoraNormalizada.length > 80) {
      throw new Error('O nome da transportadora padrão deve ter no máximo 80 caracteres.');
    }

    const freteRegistros = await this.freteConfiguracaoRepo.find({
      order: { frete_configuracao_id: 'ASC' },
      take: 1,
    });

    let freteEntidade: FreteConfiguracao;
    if (freteRegistros.length > 0) {
      freteEntidade = freteRegistros[0];
    } else {
      freteEntidade = this.freteConfiguracaoRepo.create({
        frete_taxa_percentual_padrao: FRETE_TAXA_PERCENTUAL_PADRAO,
        frete_transportadora_padrao: null,
      });
    }

    freteEntidade.frete_taxa_percentual_padrao = Number(
      freteDados.freteTaxaPercentualPadrao.toFixed(4)
    );
    if (freteTransportadoraNormalizada !== undefined) {
      freteEntidade.frete_transportadora_padrao = freteTransportadoraNormalizada;
    }
    freteEntidade.frete_atualizado_por_usuario_id = freteUsuarioId ?? null;

    const freteSalva = await this.freteConfiguracaoRepo.save(freteEntidade);
    return this.mapearFreteConfiguracao(freteSalva);
  }

  /**
   * Executa validação, cálculo e geração de mensagem em memória (stateless).
   * Não persiste cotações nem dados pessoais em banco ou logs.
   */
  simularFreteCotacao(freteEntrada: FreteCotacaoEntrada) {
    const freteValidacao = validarFreteFormulario(freteEntrada);
    if (!freteValidacao.freteValido) {
      const fretePrimeiroErro = Object.values(freteValidacao.freteErros)[0] || 'Dados inválidos.';
      const freteErro: any = new Error(fretePrimeiroErro);
      freteErro.statusCode = 400;
      freteErro.errors = freteValidacao.freteErros;
      throw freteErro;
    }

    const freteCalculo = calcularFreteValorFinal({
      freteValorOriginal: freteEntrada.freteValorOriginal,
      freteCustoGasolina: freteEntrada.freteCustoGasolina ?? 0,
      freteTaxaPercentual: freteEntrada.freteTaxaPercentual,
    });

    const freteMensagem = this.freteMensagemService.gerarFreteMensagem(
      freteEntrada,
      freteCalculo
    );

    return {
      freteCalculo,
      freteMensagem,
    };
  }
}
