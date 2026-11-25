import {
  aplicarFreteMascaraCepComCursor,
  formatarFreteCep,
} from '../utils/formatarFreteCep.js';
import {
  formatarFreteNumeroInput,
  formatarFreteTaxaInput,
  parseFreteTaxaPercentual,
  parseFreteValorMonetario,
} from '../utils/formatarFreteMoeda.js';
import {
  FRETE_CUSTO_GASOLINA_PADRAO,
  FRETE_QUANTIDADE_UNIDADES_PADRAO,
  FRETE_TRANSPORTADORAS_OPCOES,
} from '../services/FreteCotacaoService.js';

/**
 * Controlador visual do formulário principal de cotação de fretes.
 * Mantém máscaras sem salto de cursor, navegação por teclado e mensagens de erro próximas aos campos.
 */
export class FreteFormulario {
  constructor(freteOpcoes) {
    this.freteOnAlterar = freteOpcoes.onAlterar;
    this.freteOnLimpar = freteOpcoes.onLimpar;
    this.freteCamposTocados = new Set();
    this.fretePodeEditarTaxa = true;
    this.freteTaxaGlobalPadrao = 4.5;
    this.freteTipoMensagem = 'padrao';

    this.freteEl = {
      form: document.getElementById('frete-form'),
      cep: document.getElementById('freteCepDestino'),
      valorOriginal: document.getElementById('freteValorOriginal'),
      prazo: document.getElementById('fretePrazoDiasUteis'),
      taxa: document.getElementById('freteTaxaPercentual'),
      taxaBadgeOverride: document.getElementById('frete-taxa-override-badge'),
      taxaBtnRestaurar: document.getElementById('frete-btn-restaurar-taxa'),
      taxaHint: document.getElementById('frete-taxa-hint'),
      gasolina: document.getElementById('freteCustoGasolina'),
      gasolinaAtalhos: document.querySelectorAll('[data-frete-gasolina]'),
      quantidade: document.getElementById('freteQuantidadeUnidades'),
      transportadoraSelect: document.getElementById('freteTransportadoraSelect'),
      transportadoraOutraWrap: document.getElementById('frete-transportadora-outra-wrap'),
      transportadoraOutra: document.getElementById('freteTransportadoraOutra'),
      transportadoraObrigatorio: document.getElementById('frete-transportadora-obrigatorio'),
      secaoDireta: document.getElementById('frete-secao-direta'),
      clienteNome: document.getElementById('freteClienteNome'),
      clienteEndereco: document.getElementById('freteClienteEndereco'),
      btnLimpar: document.getElementById('frete-btn-limpar'),
      erros: {
        freteCepDestino: document.getElementById('frete-erro-cep'),
        freteValorOriginal: document.getElementById('frete-erro-valor'),
        fretePrazoDiasUteis: document.getElementById('frete-erro-prazo'),
        freteTaxaPercentual: document.getElementById('frete-erro-taxa'),
        freteCustoGasolina: document.getElementById('frete-erro-gasolina'),
        freteQuantidadeUnidades: document.getElementById('frete-erro-quantidade'),
        freteTransportadora: document.getElementById('frete-erro-transportadora'),
        freteClienteEndereco: document.getElementById('frete-erro-endereco'),
      },
    };

    this.vincularFreteEventos();
  }

  sanitizarEntradaDecimalPreservandoCursor(freteInputEl, fretePermitirMilhar = true) {
    const freteAnterior = freteInputEl.value;
    const freteCursor = freteInputEl.selectionStart ?? freteAnterior.length;
    const freteRegex = fretePermitirMilhar ? /[^\d.,]/g : /[^\d.,]/g;
    const freteLimpo = freteAnterior.replace(freteRegex, '');

    if (freteLimpo !== freteAnterior) {
      const freteRemovidosAntes =
        freteAnterior.slice(0, freteCursor).length -
        freteAnterior.slice(0, freteCursor).replace(freteRegex, '').length;
      freteInputEl.value = freteLimpo;
      const fretePos = Math.max(0, freteCursor - freteRemovidosAntes);
      if (typeof freteInputEl.setSelectionRange === 'function') {
        freteInputEl.setSelectionRange(fretePos, fretePos);
      }
    }
  }

  vincularFreteEventos() {
    const {
      form,
      cep,
      valorOriginal,
      prazo,
      taxa,
      taxaBtnRestaurar,
      gasolina,
      gasolinaAtalhos,
      quantidade,
      transportadoraSelect,
      transportadoraOutra,
      clienteNome,
      clienteEndereco,
      btnLimpar,
    } = this.freteEl;

    if (form) {
      form.addEventListener('submit', (freteEvt) => freteEvt.preventDefault());
    }

    if (cep) {
      cep.addEventListener('input', () => {
        aplicarFreteMascaraCepComCursor(cep);
        this.freteCamposTocados.add('freteCepDestino');
        this.notificarFreteAlteracao();
      });
      cep.addEventListener('blur', () => {
        cep.value = formatarFreteCep(cep.value);
        this.freteCamposTocados.add('freteCepDestino');
        this.notificarFreteAlteracao();
      });
    }

    if (valorOriginal) {
      valorOriginal.addEventListener('input', () => {
        this.sanitizarEntradaDecimalPreservandoCursor(valorOriginal);
        this.freteCamposTocados.add('freteValorOriginal');
        this.notificarFreteAlteracao();
      });
      valorOriginal.addEventListener('blur', () => {
        const freteNum = parseFreteValorMonetario(valorOriginal.value);
        if (Number.isFinite(freteNum) && freteNum > 0) {
          valorOriginal.value = formatarFreteNumeroInput(freteNum);
        }
        this.freteCamposTocados.add('freteValorOriginal');
        this.notificarFreteAlteracao();
      });
    }

    if (prazo) {
      prazo.addEventListener('input', () => {
        this.freteCamposTocados.add('fretePrazoDiasUteis');
        this.notificarFreteAlteracao();
      });
      prazo.addEventListener('blur', () => {
        this.freteCamposTocados.add('fretePrazoDiasUteis');
        this.notificarFreteAlteracao();
      });
    }

    if (taxa) {
      taxa.addEventListener('input', () => {
        if (!this.fretePodeEditarTaxa) return;
        this.sanitizarEntradaDecimalPreservandoCursor(taxa, false);
        this.freteCamposTocados.add('freteTaxaPercentual');
        this.atualizarIndicadorOverrideTaxa();
        this.notificarFreteAlteracao();
      });
      taxa.addEventListener('blur', () => {
        if (!this.fretePodeEditarTaxa) return;
        const freteTaxaNum = parseFreteTaxaPercentual(taxa.value);
        if (Number.isFinite(freteTaxaNum) && freteTaxaNum >= 0 && freteTaxaNum < 100) {
          taxa.value = formatarFreteTaxaInput(freteTaxaNum);
        }
        this.freteCamposTocados.add('freteTaxaPercentual');
        this.atualizarIndicadorOverrideTaxa();
        this.notificarFreteAlteracao();
      });
    }

    if (taxaBtnRestaurar) {
      taxaBtnRestaurar.addEventListener('click', () => {
        if (!this.fretePodeEditarTaxa) return;
        this.definirFreteTaxaLocal(this.freteTaxaGlobalPadrao);
        this.notificarFreteAlteracao();
      });
    }

    if (gasolina) {
      gasolina.addEventListener('input', () => {
        this.sanitizarEntradaDecimalPreservandoCursor(gasolina);
        this.freteCamposTocados.add('freteCustoGasolina');
        this.atualizarChipsGasolina();
        this.notificarFreteAlteracao();
      });
      gasolina.addEventListener('blur', () => {
        const freteRaw = String(gasolina.value ?? '').trim();
        if (!freteRaw) {
          gasolina.value = formatarFreteNumeroInput(FRETE_CUSTO_GASOLINA_PADRAO);
        } else {
          const freteNum = parseFreteValorMonetario(freteRaw);
          if (Number.isFinite(freteNum) && freteNum >= 0) {
            gasolina.value = formatarFreteNumeroInput(freteNum);
          }
        }
        this.freteCamposTocados.add('freteCustoGasolina');
        this.atualizarChipsGasolina();
        this.notificarFreteAlteracao();
      });
    }

    gasolinaAtalhos.forEach((freteBtn) => {
      freteBtn.addEventListener('click', () => {
        const freteValorAtalho = Number(freteBtn.dataset.freteGasolina);
        if (Number.isFinite(freteValorAtalho) && gasolina) {
          gasolina.value = formatarFreteNumeroInput(freteValorAtalho);
          this.freteCamposTocados.add('freteCustoGasolina');
          this.atualizarChipsGasolina();
          this.notificarFreteAlteracao();
        }
      });
    });

    if (quantidade) {
      quantidade.addEventListener('input', () => {
        this.freteCamposTocados.add('freteQuantidadeUnidades');
        this.notificarFreteAlteracao();
      });
      quantidade.addEventListener('blur', () => {
        const freteQtdRaw = String(quantidade.value ?? '').trim();
        if (!freteQtdRaw) {
          quantidade.value = String(FRETE_QUANTIDADE_UNIDADES_PADRAO);
        }
        this.freteCamposTocados.add('freteQuantidadeUnidades');
        this.notificarFreteAlteracao();
      });
    }

    if (transportadoraSelect) {
      transportadoraSelect.addEventListener('change', () => {
        this.atualizarVisibilidadeOutraTransportadora();
        this.freteCamposTocados.add('freteTransportadora');
        if (transportadoraSelect.value === 'Outra' && transportadoraOutra) {
          transportadoraOutra.focus();
        }
        this.notificarFreteAlteracao();
      });
    }

    if (transportadoraOutra) {
      transportadoraOutra.addEventListener('input', () => {
        this.freteCamposTocados.add('freteTransportadora');
        this.notificarFreteAlteracao();
      });
    }

    if (clienteNome) {
      clienteNome.addEventListener('input', () => {
        this.notificarFreteAlteracao();
      });
    }

    if (clienteEndereco) {
      clienteEndereco.addEventListener('input', () => {
        this.freteCamposTocados.add('freteClienteEndereco');
        this.notificarFreteAlteracao();
      });
    }

    if (btnLimpar) {
      btnLimpar.addEventListener('click', () => {
        this.limparFreteFormulario();
        if (typeof this.freteOnLimpar === 'function') {
          this.freteOnLimpar();
        }
      });
    }
  }

  configurarFretePermissaoTaxa(fretePodeEditarTaxa, freteTaxaGlobalPadrao) {
    this.fretePodeEditarTaxa = Boolean(fretePodeEditarTaxa);
    this.freteTaxaGlobalPadrao = freteTaxaGlobalPadrao;

    const { taxa, taxaHint } = this.freteEl;
    if (taxa) {
      taxa.readOnly = !this.fretePodeEditarTaxa;
      taxa.classList.toggle('frete-input-readonly', !this.fretePodeEditarTaxa);
      taxa.setAttribute('aria-readonly', String(!this.fretePodeEditarTaxa));
    }

    if (taxaHint) {
      taxaHint.textContent = this.fretePodeEditarTaxa
        ? 'Você pode alterar a taxa só para esta cotação sem mudar a configuração global.'
        : 'Taxa padrão vigente definida pelo Gestor (somente leitura para Operador).';
    }

    this.atualizarIndicadorOverrideTaxa();
  }

  definirFreteTaxaLocal(freteTaxaPercentual) {
    if (this.freteEl.taxa) {
      this.freteEl.taxa.value = formatarFreteTaxaInput(freteTaxaPercentual);
    }
    this.atualizarIndicadorOverrideTaxa();
  }

  estaUsandoFreteTaxaPersonalizada() {
    const freteAtual = parseFreteTaxaPercentual(this.freteEl.taxa?.value);
    if (!Number.isFinite(freteAtual)) return false;
    return Math.abs(freteAtual - this.freteTaxaGlobalPadrao) > 0.00001;
  }

  atualizarIndicadorOverrideTaxa() {
    const freteOverride = this.fretePodeEditarTaxa && this.estaUsandoFreteTaxaPersonalizada();
    if (this.freteEl.taxaBadgeOverride) {
      this.freteEl.taxaBadgeOverride.style.display = freteOverride ? 'inline-flex' : 'none';
    }
    if (this.freteEl.taxaBtnRestaurar) {
      this.freteEl.taxaBtnRestaurar.style.display = freteOverride ? 'inline-flex' : 'none';
    }
  }

  atualizarChipsGasolina() {
    const freteValorAtual = parseFreteValorMonetario(this.freteEl.gasolina?.value || '0');
    this.freteEl.gasolinaAtalhos.forEach((freteBtn) => {
      const freteChipVal = Number(freteBtn.dataset.freteGasolina);
      const freteAtivo =
        Number.isFinite(freteValorAtual) && Math.abs(freteValorAtual - freteChipVal) < 0.001;
      freteBtn.classList.toggle('is-active', freteAtivo);
    });
  }

  atualizarVisibilidadeOutraTransportadora() {
    const freteSelecionada = this.freteEl.transportadoraSelect?.value || '';
    if (this.freteEl.transportadoraOutraWrap) {
      this.freteEl.transportadoraOutraWrap.style.display =
        freteSelecionada === 'Outra' ? 'flex' : 'none';
    }
  }

  definirFreteTransportadora(freteTransportadora) {
    const { transportadoraSelect, transportadoraOutra } = this.freteEl;
    if (!transportadoraSelect) return;

    const freteLimpa = String(freteTransportadora ?? '').trim();
    if (!freteLimpa) {
      transportadoraSelect.value = '';
      if (transportadoraOutra) transportadoraOutra.value = '';
    } else if (FRETE_TRANSPORTADORAS_OPCOES.includes(freteLimpa)) {
      transportadoraSelect.value = freteLimpa;
      if (transportadoraOutra) transportadoraOutra.value = '';
    } else {
      transportadoraSelect.value = 'Outra';
      if (transportadoraOutra) transportadoraOutra.value = freteLimpa;
    }
    this.atualizarVisibilidadeOutraTransportadora();
  }

  definirFreteTipoMensagem(freteTipoMensagem) {
    this.freteTipoMensagem = freteTipoMensagem === 'direta' ? 'direta' : 'padrao';
    const freteEhDireta = this.freteTipoMensagem === 'direta';

    if (this.freteEl.secaoDireta) {
      this.freteEl.secaoDireta.style.display = freteEhDireta ? 'block' : 'none';
    }
    if (this.freteEl.transportadoraObrigatorio) {
      this.freteEl.transportadoraObrigatorio.style.display = freteEhDireta ? 'inline' : 'none';
    }
    this.notificarFreteAlteracao();
  }

  obterFreteDadosAtuais() {
    const freteCepDestino = String(this.freteEl.cep?.value ?? '').trim();
    const freteValorOriginal = parseFreteValorMonetario(this.freteEl.valorOriginal?.value);

    const fretePrazoRaw = String(this.freteEl.prazo?.value ?? '').trim();
    const fretePrazoDiasUteis = fretePrazoRaw === '' ? NaN : Number(fretePrazoRaw);

    const freteTaxaPercentual = this.fretePodeEditarTaxa
      ? parseFreteTaxaPercentual(this.freteEl.taxa?.value)
      : this.freteTaxaGlobalPadrao;

    const freteGasolinaRaw = String(this.freteEl.gasolina?.value ?? '').trim();
    const freteCustoGasolina =
      freteGasolinaRaw === ''
        ? FRETE_CUSTO_GASOLINA_PADRAO
        : parseFreteValorMonetario(freteGasolinaRaw);

    const freteQtdRaw = String(this.freteEl.quantidade?.value ?? '').trim();
    const freteQuantidadeUnidades =
      freteQtdRaw === '' ? FRETE_QUANTIDADE_UNIDADES_PADRAO : Number(freteQtdRaw);

    const freteSelectVal = this.freteEl.transportadoraSelect?.value || '';
    const freteTransportadora =
      freteSelectVal === 'Outra'
        ? String(this.freteEl.transportadoraOutra?.value ?? '').trim()
        : freteSelectVal;

    const freteClienteNome = String(this.freteEl.clienteNome?.value ?? '').trim();
    const freteClienteEndereco = String(this.freteEl.clienteEndereco?.value ?? '').trim();

    return {
      freteCepDestino,
      freteValorOriginal,
      fretePrazoDiasUteis,
      freteTaxaPercentual,
      freteCustoGasolina,
      freteQuantidadeUnidades,
      freteTransportadora: freteTransportadora || null,
      freteClienteNome: freteClienteNome || null,
      freteClienteEndereco: freteClienteEndereco || null,
      freteTipoMensagem: this.freteTipoMensagem,
    };
  }

  renderizarFreteErros(freteErros, freteExibirTodos = false) {
    Object.entries(this.freteEl.erros).forEach(([freteCampo, freteErroEl]) => {
      if (!freteErroEl) return;
      const freteMensagemErro = freteErros?.[freteCampo] || '';
      const freteMostrar =
        Boolean(freteMensagemErro) &&
        (freteExibirTodos || this.freteCamposTocados.has(freteCampo));
      freteErroEl.textContent = freteMostrar ? freteMensagemErro : '';
      freteErroEl.style.display = freteMostrar ? 'block' : 'none';

      const freteInputAssociado = this.obterFreteInputPorCampo(freteCampo);
      if (freteInputAssociado) {
        freteInputAssociado.classList.toggle('frete-input-invalid', freteMostrar);
        freteInputAssociado.setAttribute('aria-invalid', freteMostrar ? 'true' : 'false');
      }
    });
  }

  obterFreteInputPorCampo(freteCampo) {
    switch (freteCampo) {
      case 'freteCepDestino':
        return this.freteEl.cep;
      case 'freteValorOriginal':
        return this.freteEl.valorOriginal;
      case 'fretePrazoDiasUteis':
        return this.freteEl.prazo;
      case 'freteTaxaPercentual':
        return this.freteEl.taxa;
      case 'freteCustoGasolina':
        return this.freteEl.gasolina;
      case 'freteQuantidadeUnidades':
        return this.freteEl.quantidade;
      case 'freteTransportadora':
        return this.freteEl.transportadoraSelect?.value === 'Outra'
          ? this.freteEl.transportadoraOutra
          : this.freteEl.transportadoraSelect;
      case 'freteClienteEndereco':
        return this.freteEl.clienteEndereco;
      default:
        return null;
    }
  }

  limparFreteFormulario(freteTransportadoraPadrao = null) {
    this.freteCamposTocados.clear();
    if (this.freteEl.cep) this.freteEl.cep.value = '';
    if (this.freteEl.valorOriginal) this.freteEl.valorOriginal.value = '';
    if (this.freteEl.prazo) this.freteEl.prazo.value = '';
    if (this.freteEl.gasolina) {
      this.freteEl.gasolina.value = formatarFreteNumeroInput(FRETE_CUSTO_GASOLINA_PADRAO);
    }
    if (this.freteEl.quantidade) {
      this.freteEl.quantidade.value = String(FRETE_QUANTIDADE_UNIDADES_PADRAO);
    }
    if (this.freteEl.clienteNome) this.freteEl.clienteNome.value = '';
    if (this.freteEl.clienteEndereco) this.freteEl.clienteEndereco.value = '';

    this.definirFreteTaxaLocal(this.freteTaxaGlobalPadrao);
    this.definirFreteTransportadora(freteTransportadoraPadrao);
    this.atualizarChipsGasolina();
    this.renderizarFreteErros({}, false);
    this.notificarFreteAlteracao();
    this.freteEl.cep?.focus();
  }

  notificarFreteAlteracao() {
    if (typeof this.freteOnAlterar === 'function') {
      this.freteOnAlterar(this.obterFreteDadosAtuais());
    }
  }
}
