import {
  FRETE_LIMITE_CARACTERES_FINAL,
  analisarFreteTrechoFinal,
} from '../services/FreteMensagemService.js';

/**
 * Componente da área de mensagem pronta ao cliente.
 * Suporta edição manual sem alterar o cálculo, restauração do texto automático,
 * cópia isolada da mensagem e monitoramento discreto do limite de 350 caracteres no trecho final.
 */
export class FreteMensagemPreview {
  constructor() {
    this.freteMensagemAutomatica = '';
    this.freteEditadoManualmente = false;
    this.freteTipoMensagem = 'padrao';
    this.freteTimeoutFeedback = null;

    this.freteEl = {
      textarea: document.getElementById('freteMensagemGerada'),
      btnCopiar: document.getElementById('frete-btn-copiar'),
      btnRestaurar: document.getElementById('frete-btn-restaurar-mensagem'),
      badgeEditado: document.getElementById('frete-badge-editado'),
      feedbackCopia: document.getElementById('frete-feedback-copia'),
      contadorWrap: document.getElementById('frete-contador-final-wrap'),
      contadorTexto: document.getElementById('frete-contador-final-texto'),
      alertaLimite: document.getElementById('frete-alerta-limite-final'),
      estadoVazio: document.getElementById('frete-mensagem-vazia'),
      areaAtiva: document.getElementById('frete-mensagem-ativa'),
    };

    this.vincularFreteEventos();
  }

  vincularFreteEventos() {
    const { textarea, btnCopiar, btnRestaurar } = this.freteEl;

    if (textarea) {
      textarea.addEventListener('input', () => {
        this.freteEditadoManualmente = textarea.value !== this.freteMensagemAutomatica;
        this.atualizarEstadoEdicao();
        this.atualizarContadorTrechoFinal();
      });
    }

    if (btnRestaurar) {
      btnRestaurar.addEventListener('click', () => {
        this.restaurarFreteMensagemAutomatica();
      });
    }

    if (btnCopiar) {
      btnCopiar.addEventListener('click', () => {
        this.copiarFreteMensagem();
      });
    }
  }

  atualizarFreteMensagemGerada(freteMensagemResultado) {
    if (!freteMensagemResultado || !freteMensagemResultado.freteMensagemGerada) {
      this.freteMensagemAutomatica = '';
      this.freteEditadoManualmente = false;
      if (this.freteEl.textarea) this.freteEl.textarea.value = '';
      if (this.freteEl.areaAtiva) this.freteEl.areaAtiva.style.display = 'none';
      if (this.freteEl.estadoVazio) this.freteEl.estadoVazio.style.display = 'block';
      if (this.freteEl.btnCopiar) this.freteEl.btnCopiar.disabled = true;
      this.atualizarEstadoEdicao();
      return;
    }

    this.freteTipoMensagem = freteMensagemResultado.freteTipoMensagem;
    this.freteMensagemAutomatica = freteMensagemResultado.freteMensagemGerada;
    this.freteEditadoManualmente = false;

    if (this.freteEl.estadoVazio) this.freteEl.estadoVazio.style.display = 'none';
    if (this.freteEl.areaAtiva) this.freteEl.areaAtiva.style.display = 'block';
    if (this.freteEl.textarea) {
      this.freteEl.textarea.value = this.freteMensagemAutomatica;
    }
    if (this.freteEl.btnCopiar) {
      this.freteEl.btnCopiar.disabled = false;
    }

    this.atualizarEstadoEdicao();
    this.atualizarContadorTrechoFinal();
  }

  restaurarFreteMensagemAutomatica() {
    if (!this.freteEl.textarea) return;
    this.freteEl.textarea.value = this.freteMensagemAutomatica;
    this.freteEditadoManualmente = false;
    this.atualizarEstadoEdicao();
    this.atualizarContadorTrechoFinal();
  }

  atualizarEstadoEdicao() {
    if (this.freteEl.badgeEditado) {
      this.freteEl.badgeEditado.style.display = this.freteEditadoManualmente
        ? 'inline-flex'
        : 'none';
    }
    if (this.freteEl.btnRestaurar) {
      this.freteEl.btnRestaurar.style.display = this.freteEditadoManualmente
        ? 'inline-flex'
        : 'none';
    }
  }

  atualizarContadorTrechoFinal() {
    const { contadorWrap, contadorTexto, alertaLimite, textarea } = this.freteEl;
    if (!contadorWrap) return;

    if (this.freteTipoMensagem !== 'direta') {
      contadorWrap.style.display = 'none';
      if (alertaLimite) alertaLimite.style.display = 'none';
      return;
    }

    contadorWrap.style.display = 'flex';
    const freteAnalise = analisarFreteTrechoFinal(textarea?.value || '');

    if (!freteAnalise.freteTrechoEncontrado) {
      if (contadorTexto) {
        contadorTexto.textContent = `Trecho de pagamento/telefone não localizado (limite: ${FRETE_LIMITE_CARACTERES_FINAL} caracteres).`;
        contadorTexto.className = 'frete-contador-texto is-warning';
      }
      if (alertaLimite) {
        alertaLimite.style.display = 'block';
        alertaLimite.textContent =
          'A frase inicial de pagamento foi alterada ou removida. Verifique se a solicitação de telefone com DDD permanece na mensagem.';
      }
      return;
    }

    if (contadorTexto) {
      contadorTexto.textContent = `Trecho final: ${freteAnalise.freteCaracteresTrechoFinal} / ${freteAnalise.freteLimiteCaracteresFinal} caracteres`;
      contadorTexto.className = freteAnalise.freteExcedeuLimite
        ? 'frete-contador-texto is-danger'
        : 'frete-contador-texto';
    }

    if (alertaLimite) {
      if (freteAnalise.freteExcedeuLimite) {
        alertaLimite.style.display = 'block';
        alertaLimite.textContent = `O trecho final ultrapassou o limite de ${FRETE_LIMITE_CARACTERES_FINAL} caracteres em ${freteAnalise.freteCaracteresExcedentes} caractere(s). Reduza o texto antes de enviar no Mercado Livre.`;
      } else {
        alertaLimite.style.display = 'none';
        alertaLimite.textContent = '';
      }
    }
  }

  obterFreteTextoAtualParaCopia() {
    return String(this.freteEl.textarea?.value ?? '');
  }

  async copiarFreteMensagem() {
    const freteTexto = this.obterFreteTextoAtualParaCopia();
    if (!freteTexto.trim()) return false;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(freteTexto);
      } else {
        this.copiarFreteViaFallback(freteTexto);
      }
      this.exibirFreteFeedbackCopia('Mensagem copiada para a área de transferência.', false);
      return true;
    } catch {
      try {
        this.copiarFreteViaFallback(freteTexto);
        this.exibirFreteFeedbackCopia('Mensagem copiada para a área de transferência.', false);
        return true;
      } catch {
        this.exibirFreteFeedbackCopia(
          'Não foi possível copiar automaticamente. Selecione o texto e pressione Ctrl+C.',
          true
        );
        return false;
      }
    }
  }

  copiarFreteViaFallback(freteTexto) {
    const freteTemp = document.createElement('textarea');
    freteTemp.value = freteTexto;
    freteTemp.setAttribute('readonly', '');
    freteTemp.style.position = 'fixed';
    freteTemp.style.left = '-9999px';
    document.body.appendChild(freteTemp);
    freteTemp.select();
    document.execCommand('copy');
    document.body.removeChild(freteTemp);
  }

  exibirFreteFeedbackCopia(freteTexto, freteEhErro) {
    const { feedbackCopia } = this.freteEl;
    if (!feedbackCopia) return;
    feedbackCopia.textContent = freteTexto;
    feedbackCopia.className = freteEhErro
      ? 'frete-feedback-copia is-error'
      : 'frete-feedback-copia is-success';
    feedbackCopia.style.display = 'inline-flex';

    if (this.freteTimeoutFeedback) {
      clearTimeout(this.freteTimeoutFeedback);
    }
    this.freteTimeoutFeedback = setTimeout(() => {
      feedbackCopia.style.display = 'none';
    }, 3200);
  }
}
