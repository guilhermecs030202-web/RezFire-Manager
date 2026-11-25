import { formatarFreteCep } from '../utils/formatarFreteCep.js';
import { formatarFreteMoeda } from '../utils/formatarFreteMoeda.js';

export const FRETE_LIMITE_CARACTERES_FINAL = 350;

export const FRETE_FRASE_INICIO_TRECHO_FINAL =
  'O pagamento do frete pode ser feito pelo Mercado Livre.';

export const FRETE_TRECHO_FINAL_PADRAO_DIRETA =
  'O pagamento do frete pode ser feito pelo Mercado Livre. Após a confirmação, emitiremos a nota fiscal, despacharemos o produto e enviaremos a nota fiscal e o código de rastreamento.\n\nPor gentileza, informe um telefone com DDD para contato da transportadora durante a entrega.';

/**
 * Formata o prazo mantendo "1 dia útil" no singular e "X dias úteis" no plural.
 */
export function formatarFretePrazoDiasUteis(fretePrazoDiasUteis) {
  return fretePrazoDiasUteis === 1
    ? '1 dia útil'
    : `${fretePrazoDiasUteis} dias úteis`;
}

/**
 * Extrai apenas o primeiro nome do cliente com capitalização limpa, sem inventar dados.
 */
export function extrairFretePrimeiroNome(freteClienteNome) {
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
 * Analisa o trecho final da Mensagem Direta a partir da frase âncora até o final,
 * conferindo o limite de 350 caracteres sem alterar o texto automaticamente.
 */
export function analisarFreteTrechoFinal(freteMensagemTexto) {
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
 * Gera a mensagem padronizada para o cliente (Modo Padrão ou Modo Direta).
 * Não inclui taxa percentual, gasolina, emojis, Markdown ou dados fictícios.
 */
export function gerarFreteMensagem(freteEntrada, freteCalculo) {
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

export const FreteMensagemService = {
  FRETE_LIMITE_CARACTERES_FINAL,
  FRETE_FRASE_INICIO_TRECHO_FINAL,
  FRETE_TRECHO_FINAL_PADRAO_DIRETA,
  formatarFretePrazoDiasUteis,
  extrairFretePrimeiroNome,
  analisarFreteTrechoFinal,
  gerarFreteMensagem,
};
