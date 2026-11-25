import {
  FreteCalculoResultado,
  FreteCotacaoEntrada,
  FreteMensagemResultado,
  FreteTrechoFinalAnalise,
} from '../types/FreteCotacao';
import { formatarFreteCep } from '../utils/formatarFreteCep';
import { formatarFreteMoeda } from '../utils/formatarFreteMoeda';

export const FRETE_LIMITE_CARACTERES_FINAL = 350;

export const FRETE_FRASE_INICIO_TRECHO_FINAL =
  'O pagamento do frete pode ser feito pelo Mercado Livre.';

export const FRETE_TRECHO_FINAL_PADRAO_DIRETA =
  'O pagamento do frete pode ser feito pelo Mercado Livre. Após a confirmação, emitiremos a nota fiscal, despacharemos o produto e enviaremos a nota fiscal e o código de rastreamento.\n\nPor gentileza, informe um telefone com DDD para contato da transportadora durante a entrega.';

/**
 * Formata o prazo respeitando o singular ("1 dia útil") e o plural ("X dias úteis").
 */
export function formatarFretePrazoDiasUteis(fretePrazoDiasUteis: number): string {
  return fretePrazoDiasUteis === 1
    ? '1 dia útil'
    : `${fretePrazoDiasUteis} dias úteis`;
}

/**
 * Extrai somente o primeiro nome do cliente com capitalização limpa, sem inventar dados.
 */
export function extrairFretePrimeiroNome(freteClienteNome?: string | null): string {
  const freteNomeLimpo = String(freteClienteNome ?? '').trim();
  if (!freteNomeLimpo) {
    return '';
  }
  const fretePrimeiroToken = freteNomeLimpo.split(/\s+/)[0] || '';
  if (!fretePrimeiroToken) {
    return '';
  }
  return (
    fretePrimeiroToken.charAt(0).toLocaleUpperCase('pt-BR') +
    fretePrimeiroToken.slice(1).toLocaleLowerCase('pt-BR')
  );
}

/**
 * Analisa o trecho final da Mensagem Direta a partir da frase
 * "O pagamento do frete pode ser feito pelo Mercado Livre." até o final,
 * verificando o limite obrigatório de 350 caracteres sem alterar o texto do usuário.
 */
export function analisarFreteTrechoFinal(freteMensagemTexto: string): FreteTrechoFinalAnalise {
  const freteTexto = String(freteMensagemTexto ?? '');
  const freteIndiceInicio = freteTexto.indexOf(FRETE_FRASE_INICIO_TRECHO_FINAL);

  if (freteIndiceInicio === -1) {
    return {
      freteTrechoEncontrado: false,
      freteCaracteresTrechoFinal: 0,
      freteLimiteCaracteresFinal: FRETE_LIMITE_CARACTERES_FINAL,
      freteExcedeuLimite: false,
      freteCaracteresExcedentes: 0,
      freteCaracteresRestantes: FRETE_LIMITE_CARACTERES_FINAL,
    };
  }

  const freteTrechoFinal = freteTexto.slice(freteIndiceInicio);
  const freteCaracteres = freteTrechoFinal.length;
  const freteExcedeu = freteCaracteres > FRETE_LIMITE_CARACTERES_FINAL;

  return {
    freteTrechoEncontrado: true,
    freteCaracteresTrechoFinal: freteCaracteres,
    freteLimiteCaracteresFinal: FRETE_LIMITE_CARACTERES_FINAL,
    freteExcedeuLimite: freteExcedeu,
    freteCaracteresExcedentes: freteExcedeu ? freteCaracteres - FRETE_LIMITE_CARACTERES_FINAL : 0,
    freteCaracteresRestantes: Math.max(0, FRETE_LIMITE_CARACTERES_FINAL - freteCaracteres),
  };
}

/**
 * Gera a mensagem padronizada do cliente para Mensagem Padrão ou Mensagem Direta.
 * Nunca inclui taxa percentual, custo de gasolina, emojis, Markdown ou dados fictícios.
 */
export function gerarFreteMensagem(
  freteEntrada: FreteCotacaoEntrada,
  freteCalculo: FreteCalculoResultado
): FreteMensagemResultado {
  const freteCepFormatado = formatarFreteCep(freteEntrada.freteCepDestino);
  const freteValorFinalFormatado = formatarFreteMoeda(freteCalculo.freteValorFinal);
  const fretePrazoFormatado = formatarFretePrazoDiasUteis(freteEntrada.fretePrazoDiasUteis);
  const freteQuantidade = freteEntrada.freteQuantidadeUnidades ?? 1;
  const freteTransportadoraLimpa = String(freteEntrada.freteTransportadora ?? '').trim();

  if (freteEntrada.freteTipoMensagem === 'direta') {
    const fretePrimeiroNome = extrairFretePrimeiroNome(freteEntrada.freteClienteNome);
    const freteSaudacao = fretePrimeiroNome
      ? `Olá, ${fretePrimeiroNome}! Tudo bem?`
      : 'Olá! Tudo bem?';

    const freteEnderecoLimpo = String(freteEntrada.freteClienteEndereco ?? '')
      .trim()
      .replace(/[.,;\s]+$/, '');

    const freteFraseValor =
      freteQuantidade > 1
        ? `o valor total do frete para as ${freteQuantidade} unidades ficou em ${freteValorFinalFormatado}`
        : `o valor do frete ficou em ${freteValorFinalFormatado}`;

    const freteParagrafoEndereco = `Para o endereço cadastrado em sua conta do Mercado Livre, ${freteEnderecoLimpo}, ${freteFraseValor}, com prazo de entrega de ${fretePrazoFormatado}.`;
    const freteParagrafoTransportadora = `A entrega será realizada de forma terceirizada pela transportadora ${freteTransportadoraLimpa}.`;

    const freteMensagemGerada = [
      freteSaudacao,
      freteParagrafoEndereco,
      freteParagrafoTransportadora,
      FRETE_TRECHO_FINAL_PADRAO_DIRETA,
    ].join('\n\n');

    return {
      freteTipoMensagem: 'direta',
      freteMensagemGerada,
      freteTrechoFinalAnalise: analisarFreteTrechoFinal(freteMensagemGerada),
    };
  }

  // Modo 1 — Mensagem Padrão
  const freteComplementoTransportadora = freteTransportadoraLimpa
    ? ` pela transportadora ${freteTransportadoraLimpa}`
    : '';

  const freteMensagemGerada =
    freteQuantidade > 1
      ? `Olá, enviamos sim! O valor total do frete para as ${freteQuantidade} unidades, com destino ao CEP ${freteCepFormatado}, é de ${freteValorFinalFormatado}, com prazo de entrega de ${fretePrazoFormatado}${freteComplementoTransportadora}.`
      : `Olá, enviamos sim! O valor do frete para o seu CEP (${freteCepFormatado}) é ${freteValorFinalFormatado} por unidade, com prazo de entrega de ${fretePrazoFormatado}${freteComplementoTransportadora}.`;

  return {
    freteTipoMensagem: 'padrao',
    freteMensagemGerada,
    freteTrechoFinalAnalise: null,
  };
}

export class FreteMensagemService {
  readonly freteLimiteCaracteresFinal = FRETE_LIMITE_CARACTERES_FINAL;

  gerarFreteMensagem(
    freteEntrada: FreteCotacaoEntrada,
    freteCalculo: FreteCalculoResultado
  ): FreteMensagemResultado {
    return gerarFreteMensagem(freteEntrada, freteCalculo);
  }

  analisarFreteTrechoFinal(freteMensagemTexto: string): FreteTrechoFinalAnalise {
    return analisarFreteTrechoFinal(freteMensagemTexto);
  }
}
