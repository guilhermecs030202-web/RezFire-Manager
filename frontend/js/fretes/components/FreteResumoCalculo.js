import {
  formatarFreteMoeda,
  formatarFreteTaxaPercentual,
} from '../utils/formatarFreteMoeda.js';

/**
 * Componente responsável por renderizar o resumo detalhado do cálculo interno de frete.
 * Nunca exibe valores calculados quando os campos obrigatórios estiverem inválidos.
 */
export class FreteResumoCalculo {
  constructor() {
    this.freteEl = {
      estadoVazio: document.getElementById('frete-resumo-vazio'),
      estadoVazioTexto: document.getElementById('frete-resumo-vazio-texto'),
      conteudo: document.getElementById('frete-resumo-conteudo'),
      valorOriginal: document.getElementById('frete-res-original'),
      custoGasolina: document.getElementById('frete-res-gasolina'),
      valorLiquido: document.getElementById('frete-res-liquido'),
      taxaAplicada: document.getElementById('frete-res-taxa'),
      valorComTaxa: document.getElementById('frete-res-com-taxa'),
      valorFinal: document.getElementById('frete-res-final'),
      notaQuantidade: document.getElementById('frete-res-nota-quantidade'),
    };
  }

  renderizarFreteCalculo(freteCalculo, freteQuantidadeUnidades = 1, freteMotivoPendente = '') {
    if (!freteCalculo) {
      if (this.freteEl.conteudo) this.freteEl.conteudo.style.display = 'none';
      if (this.freteEl.estadoVazio) this.freteEl.estadoVazio.style.display = 'block';
      if (this.freteEl.estadoVazioTexto) {
        this.freteEl.estadoVazioTexto.textContent =
          freteMotivoPendente ||
          'Preencha CEP de destino, valor original do frete e prazo em dias úteis para calcular automaticamente.';
      }
      return;
    }

    if (this.freteEl.estadoVazio) this.freteEl.estadoVazio.style.display = 'none';
    if (this.freteEl.conteudo) this.freteEl.conteudo.style.display = 'block';

    if (this.freteEl.valorOriginal) {
      this.freteEl.valorOriginal.textContent = formatarFreteMoeda(freteCalculo.freteValorOriginal);
    }
    if (this.freteEl.custoGasolina) {
      this.freteEl.custoGasolina.textContent = formatarFreteMoeda(freteCalculo.freteCustoGasolina);
    }
    if (this.freteEl.valorLiquido) {
      this.freteEl.valorLiquido.textContent = formatarFreteMoeda(
        freteCalculo.freteValorLiquidoNecessario
      );
    }
    if (this.freteEl.taxaAplicada) {
      this.freteEl.taxaAplicada.textContent = formatarFreteTaxaPercentual(
        freteCalculo.freteTaxaPercentual
      );
    }
    if (this.freteEl.valorComTaxa) {
      this.freteEl.valorComTaxa.textContent = formatarFreteMoeda(freteCalculo.freteValorComTaxa);
    }
    if (this.freteEl.valorFinal) {
      this.freteEl.valorFinal.textContent = formatarFreteMoeda(freteCalculo.freteValorFinal);
    }

    if (this.freteEl.notaQuantidade) {
      this.freteEl.notaQuantidade.textContent =
        freteQuantidadeUnidades > 1
          ? `Valor total da cotação para ${freteQuantidadeUnidades} unidades (não multiplicado automaticamente).`
          : 'Valor unitário da cotação (1 unidade).';
    }
  }
}
