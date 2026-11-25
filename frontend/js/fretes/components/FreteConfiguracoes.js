import {
  formatarFreteTaxaInput,
  formatarFreteTaxaPercentual,
  parseFreteTaxaPercentual,
} from '../utils/formatarFreteMoeda.js';
import { validarFreteTaxaPercentual } from '../utils/validarFreteFormulario.js';

/**
 * Componente da área de configurações globais do módulo de Fretes.
 * A alteração da taxa padrão no banco MySQL é restrita ao perfil GESTOR.
 */
export class FreteConfiguracoes {
  constructor(freteOpcoes) {
    this.freteOnSalvar = freteOpcoes.onSalvar;
    this.fretePodeEditarTaxa = false;

    this.freteEl = {
      form: document.getElementById('frete-config-form'),
      taxaPadraoInput: document.getElementById('freteTaxaPercentualPadrao'),
      transportadoraPadraoSelect: document.getElementById('freteTransportadoraPadrao'),
      btnSalvar: document.getElementById('frete-btn-salvar-config'),
      badgePermissao: document.getElementById('frete-config-badge-permissao'),
      avisoOperador: document.getElementById('frete-config-aviso-operador'),
      resumoTaxaAtual: document.getElementById('frete-config-taxa-resumo'),
      feedback: document.getElementById('frete-config-feedback'),
    };

    this.vincularFreteEventos();
  }

  vincularFreteEventos() {
    if (!this.freteEl.form) return;

    this.freteEl.form.addEventListener('submit', async (freteEvt) => {
      freteEvt.preventDefault();
      if (!this.fretePodeEditarTaxa) return;

      const freteTaxaNum = parseFreteTaxaPercentual(this.freteEl.taxaPadraoInput?.value);
      const freteErro = validarFreteTaxaPercentual(freteTaxaNum);
      if (freteErro) {
        this.exibirFreteFeedback(freteErro, true);
        return;
      }

      const freteTransportadoraPadrao =
        String(this.freteEl.transportadoraPadraoSelect?.value ?? '').trim() || null;

      if (this.freteEl.btnSalvar) {
        this.freteEl.btnSalvar.disabled = true;
        this.freteEl.btnSalvar.textContent = 'Salvando...';
      }

      try {
        await this.freteOnSalvar({
          freteTaxaPercentualPadrao: freteTaxaNum,
          freteTransportadoraPadrao,
        });
        this.exibirFreteFeedback('Configuração padrão salva no banco de dados.', false);
      } catch (freteErr) {
        this.exibirFreteFeedback(
          freteErr?.message || 'Não foi possível salvar a configuração padrão.',
          true
        );
      } finally {
        if (this.freteEl.btnSalvar) {
          this.freteEl.btnSalvar.disabled = false;
          this.freteEl.btnSalvar.textContent = 'Salvar configuração padrão';
        }
      }
    });
  }

  renderizarFreteConfiguracoes(freteConfig, fretePodeEditarTaxa) {
    this.fretePodeEditarTaxa = Boolean(fretePodeEditarTaxa);

    if (this.freteEl.taxaPadraoInput) {
      this.freteEl.taxaPadraoInput.value = formatarFreteTaxaInput(
        freteConfig.freteTaxaPercentualPadrao
      );
      this.freteEl.taxaPadraoInput.disabled = !this.fretePodeEditarTaxa;
    }

    if (this.freteEl.transportadoraPadraoSelect) {
      this.freteEl.transportadoraPadraoSelect.value = freteConfig.freteTransportadoraPadrao || '';
      this.freteEl.transportadoraPadraoSelect.disabled = !this.fretePodeEditarTaxa;
    }

    if (this.freteEl.btnSalvar) {
      this.freteEl.btnSalvar.style.display = this.fretePodeEditarTaxa ? 'inline-flex' : 'none';
    }

    if (this.freteEl.avisoOperador) {
      this.freteEl.avisoOperador.style.display = this.fretePodeEditarTaxa ? 'none' : 'block';
    }

    if (this.freteEl.badgePermissao) {
      this.freteEl.badgePermissao.textContent = this.fretePodeEditarTaxa
        ? 'Gestor'
        : 'Somente leitura';
      this.freteEl.badgePermissao.className = this.fretePodeEditarTaxa
        ? 'frete-perm-badge is-gestor'
        : 'frete-perm-badge is-readonly';
    }

    if (this.freteEl.resumoTaxaAtual) {
      this.freteEl.resumoTaxaAtual.textContent = formatarFreteTaxaPercentual(
        freteConfig.freteTaxaPercentualPadrao
      );
    }
  }

  exibirFreteFeedback(freteTexto, freteEhErro) {
    if (!this.freteEl.feedback) return;
    this.freteEl.feedback.textContent = freteTexto;
    this.freteEl.feedback.className = freteEhErro
      ? 'frete-config-feedback is-error'
      : 'frete-config-feedback is-success';
    this.freteEl.feedback.style.display = 'block';
  }
}
