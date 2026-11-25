import { calcularFreteValorFinal } from './utils/calcularFreteValorFinal.js';
import { validarFreteFormulario } from './utils/validarFreteFormulario.js';
import { FreteMensagemService } from './services/FreteMensagemService.js';
import {
  FRETE_TAXA_PERCENTUAL_PADRAO,
  FreteCotacaoService,
} from './services/FreteCotacaoService.js';
import { FreteFormulario } from './components/FreteFormulario.js';
import { FreteResumoCalculo } from './components/FreteResumoCalculo.js';
import { FreteMensagemPreview } from './components/FreteMensagemPreview.js';
import { FreteConfiguracoes } from './components/FreteConfiguracoes.js';

/**
 * Orquestrador principal da página Gerador de Cotações de Frete.
 */
async function iniciarFretePagina() {
  if (window.RezFireLayout && typeof window.RezFireLayout.renderSidebar === 'function') {
    window.RezFireLayout.renderSidebar('fretes');
  }

  let freteConfigAtual = {
    freteTaxaPercentualPadrao: FRETE_TAXA_PERCENTUAL_PADRAO,
    freteTransportadoraPadrao: null,
  };
  let fretePodeEditarTaxa = true;

  const freteResumoComponente = new FreteResumoCalculo();
  const freteMensagemComponente = new FreteMensagemPreview();

  const processarFreteAtualizacao = (freteDados) => {
    const freteValidacao = validarFreteFormulario(freteDados);
    freteFormularioComponente.renderizarFreteErros(freteValidacao.freteErros, false);

    if (!freteValidacao.freteValido) {
      const fretePrimeiroMotivo =
        freteDados.freteTipoMensagem === 'direta' &&
        (freteValidacao.freteErros.freteClienteEndereco ||
          freteValidacao.freteErros.freteTransportadora)
          ? 'Preencha CEP, valor do frete, prazo, endereço completo e transportadora para gerar a Mensagem Direta.'
          : 'Preencha CEP de destino, valor original do frete e prazo em dias úteis para calcular automaticamente.';

      freteResumoComponente.renderizarFreteCalculo(null, 1, fretePrimeiroMotivo);
      freteMensagemComponente.atualizarFreteMensagemGerada(null);
      return;
    }

    try {
      const freteCalculo = calcularFreteValorFinal({
        freteValorOriginal: freteDados.freteValorOriginal,
        freteCustoGasolina: freteDados.freteCustoGasolina,
        freteTaxaPercentual: freteDados.freteTaxaPercentual,
      });

      freteResumoComponente.renderizarFreteCalculo(
        freteCalculo,
        freteDados.freteQuantidadeUnidades
      );

      const freteMensagemResultado = FreteMensagemService.gerarFreteMensagem(
        freteDados,
        freteCalculo
      );
      freteMensagemComponente.atualizarFreteMensagemGerada(freteMensagemResultado);
    } catch (freteErro) {
      freteResumoComponente.renderizarFreteCalculo(
        null,
        1,
        freteErro?.message || 'Verifique os dados informados.'
      );
      freteMensagemComponente.atualizarFreteMensagemGerada(null);
    }
  };

  const freteFormularioComponente = new FreteFormulario({
    onAlterar: processarFreteAtualizacao,
    onLimpar: () => {
      freteFormularioComponente.definirFreteTransportadora(
        freteConfigAtual.freteTransportadoraPadrao
      );
      processarFreteAtualizacao(freteFormularioComponente.obterFreteDadosAtuais());
    },
  });

  const freteConfiguracoesComponente = new FreteConfiguracoes({
    onSalvar: async (freteNovosParametros) => {
      const freteEstavaPersonalizada =
        freteFormularioComponente.estaUsandoFreteTaxaPersonalizada();

      const freteResposta = await FreteCotacaoService.salvarFreteConfiguracoes(freteNovosParametros);
      const freteSalva = freteResposta?.freteConfiguracao || freteNovosParametros;

      freteConfigAtual = {
        freteTaxaPercentualPadrao: Number(freteSalva.freteTaxaPercentualPadrao),
        freteTransportadoraPadrao: freteSalva.freteTransportadoraPadrao || null,
      };

      freteConfiguracoesComponente.renderizarFreteConfiguracoes(
        freteConfigAtual,
        fretePodeEditarTaxa
      );
      freteFormularioComponente.configurarFretePermissaoTaxa(
        fretePodeEditarTaxa,
        freteConfigAtual.freteTaxaPercentualPadrao
      );

      // Só atualiza o campo local se o usuário não estiver com taxa personalizada na cotação em aberto
      if (!freteEstavaPersonalizada) {
        freteFormularioComponente.definirFreteTaxaLocal(
          freteConfigAtual.freteTaxaPercentualPadrao
        );
      }

      processarFreteAtualizacao(freteFormularioComponente.obterFreteDadosAtuais());
    },
  });

  // Alternância entre Mensagem Padrão e Mensagem Direta
  const freteBotoesModo = document.querySelectorAll('[data-frete-modo]');
  const freteModoDescricao = document.getElementById('frete-modo-descricao');

  const ativarFreteModo = (freteModo) => {
    freteBotoesModo.forEach((freteBtn) => {
      const freteAtivo = freteBtn.dataset.freteModo === freteModo;
      freteBtn.classList.toggle('is-active', freteAtivo);
      freteBtn.setAttribute('aria-pressed', String(freteAtivo));
    });

    if (freteModoDescricao) {
      freteModoDescricao.textContent =
        freteModo === 'direta'
          ? 'Atendimento privado pós-compra: inclui saudação com primeiro nome, endereço, transportadora e solicitação de telefone com DDD (limite de 350 caracteres no trecho final).'
          : 'Atendimento em perguntas públicas de anúncios no Mercado Livre: mensagem direta com CEP, valor final e prazo em dias úteis.';
    }

    freteFormularioComponente.definirFreteTipoMensagem(freteModo);
  };

  freteBotoesModo.forEach((freteBtn) => {
    freteBtn.addEventListener('click', () => {
      ativarFreteModo(freteBtn.dataset.freteModo);
    });
  });

  // Carrega configurações persistidas do MySQL (ou fallback 4,5%)
  const freteCarregado = await FreteCotacaoService.carregarFreteConfiguracoes();
  freteConfigAtual = freteCarregado.freteConfiguracao;
  fretePodeEditarTaxa = freteCarregado.fretePodeEditarTaxa;

  freteConfiguracoesComponente.renderizarFreteConfiguracoes(
    freteConfigAtual,
    fretePodeEditarTaxa
  );
  freteFormularioComponente.configurarFretePermissaoTaxa(
    fretePodeEditarTaxa,
    freteConfigAtual.freteTaxaPercentualPadrao
  );
  freteFormularioComponente.definirFreteTaxaLocal(freteConfigAtual.freteTaxaPercentualPadrao);
  if (freteConfigAtual.freteTransportadoraPadrao) {
    freteFormularioComponente.definirFreteTransportadora(
      freteConfigAtual.freteTransportadoraPadrao
    );
  }
  freteFormularioComponente.atualizarChipsGasolina();

  ativarFreteModo('padrao');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarFretePagina);
} else {
  iniciarFretePagina();
}
