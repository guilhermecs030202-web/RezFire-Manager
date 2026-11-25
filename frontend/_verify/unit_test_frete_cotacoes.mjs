/**
 * unit_test_frete_cotacoes.mjs
 * Bateria completa de testes automatizados do módulo Gerador de Cotações de Frete (RezFire Manager).
 *
 * Valida:
 *  - Os 6 cenários obrigatórios da tabela de cálculo (Frontend + Backend TypeScript compilado)
 *  - Todos os 16 cenários complementares: taxa 0%, rejeição de 100%/negativa, centavos,
 *    valor inteiro exato (zero erro de ponto flutuante), 1 unidade vs múltiplas unidades,
 *    prazo singular ("1 dia útil") vs plural, CEP com/sem hífen e zeros à esquerda,
 *    primeiro nome, transportadoras, solicitação de telefone na Mensagem Direta,
 *    constante e limite de 350 caracteres no trecho final, cópia isolada da mensagem,
 *    edição manual + restauração, override local de taxa sem alterar global,
 *    controle RBAC (somente GESTOR altera a taxa) e persistência no MySQL/API.
 */

import assertNode from 'node:assert/strict';

// Imports do Frontend (ES Modules puros)
import { calcularFreteValorFinal as calcularFreteFront } from '../js/fretes/utils/calcularFreteValorFinal.js';
import {
  formatarFreteCep as formatarFreteCepFront,
  validarFreteCep as validarFreteCepFront,
} from '../js/fretes/utils/formatarFreteCep.js';
import { formatarFreteMoeda as formatarFreteMoedaFront } from '../js/fretes/utils/formatarFreteMoeda.js';
import { validarFreteFormulario as validarFreteFormularioFront } from '../js/fretes/utils/validarFreteFormulario.js';
import {
  FRETE_LIMITE_CARACTERES_FINAL as FRETE_LIMITE_FRONT,
  analisarFreteTrechoFinal as analisarFreteTrechoFinalFront,
  extrairFretePrimeiroNome as extrairFretePrimeiroNomeFront,
  gerarFreteMensagem as gerarFreteMensagemFront,
} from '../js/fretes/services/FreteMensagemService.js';
import { FreteMensagemPreview } from '../js/fretes/components/FreteMensagemPreview.js';
import { FreteFormulario } from '../js/fretes/components/FreteFormulario.js';

// Imports do Backend TypeScript compilado (backend/dist)
import { calcularFreteValorFinal as calcularFreteBack } from '../../backend/dist/fretes/utils/calcularFreteValorFinal.js';
import {
  FRETE_LIMITE_CARACTERES_FINAL as FRETE_LIMITE_BACK,
  analisarFreteTrechoFinal as analisarFreteTrechoFinalBack,
  gerarFreteMensagem as gerarFreteMensagemBack,
} from '../../backend/dist/fretes/services/FreteMensagemService.js';
import { validarFreteFormulario as validarFreteFormularioBack } from '../../backend/dist/fretes/utils/validarFreteFormulario.js';
import { AppDataSource } from '../../backend/dist/config/database.js';
import { FreteCotacaoService } from '../../backend/dist/services/freteCotacao.service.js';
import appModule from '../../backend/dist/app.js';
import jwtModule from '../../backend/node_modules/jsonwebtoken/index.js';
import { env } from '../../backend/dist/config/env.js';

const app = appModule.default || appModule;
const jwt = jwtModule.default || jwtModule;

let freteTotalPassou = 0;
let freteTotalFalhou = 0;

function verificar(freteCondicao, freteDescricao) {
  if (freteCondicao) {
    console.log(`  ✅ [PASS] ${freteDescricao}`);
    freteTotalPassou++;
  } else {
    console.error(`  ❌ [FAIL] ${freteDescricao}`);
    freteTotalFalhou++;
  }
}

function criarMockDomMinimo() {
  const freteElementos = {};
  const criarElemento = (freteId = '') => {
    const freteEl = {
      id: freteId,
      value: '',
      textContent: '',
      disabled: false,
      readOnly: false,
      style: {},
      dataset: {},
      attributes: {},
      listeners: {},
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        contains(c) { return this._set.has(c); },
        toggle(c, force) {
          if (force === undefined) {
            if (this._set.has(c)) this._set.delete(c);
            else this._set.add(c);
          } else if (force) {
            this._set.add(c);
          } else {
            this._set.delete(c);
          }
        },
      },
      addEventListener(evt, fn) {
        if (!this.listeners[evt]) this.listeners[evt] = [];
        this.listeners[evt].push(fn);
      },
      dispatch(evt) {
        (this.listeners[evt] || []).forEach((fn) => fn({ target: this, preventDefault: () => {} }));
      },
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k] ?? null; },
      select() {},
      focus() {},
      setSelectionRange() {},
    };
    return freteEl;
  };

  const getEl = (id) => {
    if (!freteElementos[id]) freteElementos[id] = criarElemento(id);
    return freteElementos[id];
  };

  globalThis.document = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    createElement: (tag) => criarElemento(tag),
    body: {
      appendChild() {},
      removeChild() {},
    },
    execCommand: () => true,
  };

  return { getEl };
}

async function executarTestesFrete() {
  console.log('🧪 Iniciando Testes Automatizados — Módulo Gerador de Cotações de Frete RezFire\n');

  // =========================================================================
  // 1. TABELA OBRIGATÓRIA DE CÁLCULOS (Frontend + Backend)
  // =========================================================================
  console.log('--- 1. Tabela Obrigatória de Cálculos (Frontend e Backend) ---');
  const freteCenariosObrigatorios = [
    { frete: 34.23, gasolina: 0.0, taxa: 4.5, esperado: 36.0 },
    { frete: 45.74, gasolina: 10.0, taxa: 4.5, esperado: 59.0 },
    { frete: 90.08, gasolina: 10.0, taxa: 4.5, esperado: 105.0, liquido: 100.08, comTaxa: 104.8 },
    { frete: 133.5, gasolina: 0.0, taxa: 4.5, esperado: 140.0 },
    { frete: 229.07, gasolina: 10.0, taxa: 4.5, esperado: 251.0 },
    { frete: 299.83, gasolina: 0.0, taxa: 4.5, esperado: 314.0 },
  ];

  for (const freteCaso of freteCenariosObrigatorios) {
    const freteResFront = calcularFreteFront({
      freteValorOriginal: freteCaso.frete,
      freteCustoGasolina: freteCaso.gasolina,
      freteTaxaPercentual: freteCaso.taxa,
    });
    const freteResBack = calcularFreteBack({
      freteValorOriginal: freteCaso.frete,
      freteCustoGasolina: freteCaso.gasolina,
      freteTaxaPercentual: freteCaso.taxa,
    });

    verificar(
      freteResFront.freteValorFinal === freteCaso.esperado &&
        freteResBack.freteValorFinal === freteCaso.esperado,
      `Frete ${formatarFreteMoedaFront(freteCaso.frete)} + Gasolina ${formatarFreteMoedaFront(
        freteCaso.gasolina
      )} (${freteCaso.taxa}%) -> Final ${formatarFreteMoedaFront(freteResFront.freteValorFinal)} (esperado ${formatarFreteMoedaFront(
        freteCaso.esperado
      )})`
    );

    if (freteCaso.liquido !== undefined) {
      verificar(
        freteResFront.freteValorLiquidoNecessario === freteCaso.liquido &&
          freteResFront.freteValorComTaxa === freteCaso.comTaxa &&
          freteResBack.freteValorLiquidoNecessario === freteCaso.liquido &&
          freteResBack.freteValorComTaxa === freteCaso.comTaxa,
        `Detalhamento intermediário R$ 90,08 + R$ 10,00: líquido=${freteResFront.freteValorLiquidoNecessario} (100.08), comTaxa=${freteResFront.freteValorComTaxa} (104.80)`
      );
    }
  }

  // =========================================================================
  // 2. CASOS DE BORDA DE TAXA E ARREDONDAMENTO (Cenários 1 a 4)
  // =========================================================================
  console.log('\n--- 2. Taxas (0%, 100%, negativa), Centavos e Valores Inteiros Exatos ---');

  // Cenário 1: Taxa 0%
  const freteTaxaZeroInteiro = calcularFreteFront({
    freteValorOriginal: 50.0,
    freteCustoGasolina: 0,
    freteTaxaPercentual: 0,
  });
  verificar(
    freteTaxaZeroInteiro.freteValorFinal === 50 && freteTaxaZeroInteiro.freteValorComTaxa === 50,
    'Taxa 0% com R$ 50,00 exatos retorna R$ 50,00 sem somar R$ 1,00.'
  );

  // Cenário 2: Taxa 100%, > 100% e negativa rejeitadas
  let freteRejeitou100Front = false;
  try {
    calcularFreteFront({ freteValorOriginal: 100, freteCustoGasolina: 0, freteTaxaPercentual: 100 });
  } catch {
    freteRejeitou100Front = true;
  }
  let freteRejeitou100Back = false;
  try {
    calcularFreteBack({ freteValorOriginal: 100, freteCustoGasolina: 0, freteTaxaPercentual: 100 });
  } catch {
    freteRejeitou100Back = true;
  }
  let freteRejeitouNegativa = false;
  try {
    calcularFreteFront({ freteValorOriginal: 100, freteCustoGasolina: 0, freteTaxaPercentual: -1 });
  } catch {
    freteRejeitouNegativa = true;
  }
  verificar(
    freteRejeitou100Front && freteRejeitou100Back && freteRejeitouNegativa,
    'Rejeita taxa de 100% (divisão por zero) e taxas negativas no Frontend e Backend.'
  );

  // Cenário 3: Valores com centavos (exemplos do enunciado: 57,63 -> 58; 100,43 -> 101; 139,27 -> 140)
  verificar(
    calcularFreteFront({ freteValorOriginal: 57.63, freteTaxaPercentual: 0 }).freteValorFinal === 58 &&
      calcularFreteFront({ freteValorOriginal: 100.43, freteTaxaPercentual: 0 }).freteValorFinal === 101 &&
      calcularFreteFront({ freteValorOriginal: 139.27, freteTaxaPercentual: 0 }).freteValorFinal === 140,
    'Arredondamento para cima com centavos: 57,63->58, 100,43->101, 139,27->140.'
  );

  // Cenário 4: Valor já inteiro exato mesmo após divisão por taxa (95,50 / 0,955 = 100,00 exato; 19,10 / 0,955 = 20,00 exato)
  const freteExatoComTaxa1 = calcularFreteFront({
    freteValorOriginal: 95.5,
    freteCustoGasolina: 0,
    freteTaxaPercentual: 4.5,
  });
  const freteExatoComTaxa2 = calcularFreteBack({
    freteValorOriginal: 19.1,
    freteCustoGasolina: 0,
    freteTaxaPercentual: 4.5,
  });
  verificar(
    freteExatoComTaxa1.freteValorFinal === 100 && freteExatoComTaxa2.freteValorFinal === 20,
    'Aritmética decimal exata (BigInt): 95,50/0,955=R$ 100,00 e 19,10/0,955=R$ 20,00 sem erro IEEE-754.'
  );

  // =========================================================================
  // 3. QUANTIDADE, PRAZO SINGULAR/PLURAL, CEP E MENSAGEM PADRÃO (Cenários 5, 6, 7, 9)
  // =========================================================================
  console.log('\n--- 3. Mensagem Padrão, Quantidades, Prazo Singular/Plural e CEP ---');

  // Cenário 7: CEP com e sem hífen + zeros à esquerda
  verificar(
    formatarFreteCepFront('01001000') === '01001-000' &&
      formatarFreteCepFront('57310-540') === '57310-540' &&
      validarFreteCepFront('01001000') === true &&
      validarFreteCepFront('57310-540') === true &&
      validarFreteCepFront('01001-00') === false,
    'CEP preserva zeros à esquerda, aceita com/sem hífen e rejeita CEP incompleto.'
  );

  // Cenário 5: 1 unidade + prazo singular ("1 dia útil")
  const freteCalc1Un = calcularFreteFront({
    freteValorOriginal: 34.23,
    freteCustoGasolina: 0,
    freteTaxaPercentual: 4.5,
  });
  const freteMsg1Un = gerarFreteMensagemFront(
    {
      freteCepDestino: '01001000',
      freteValorOriginal: 34.23,
      fretePrazoDiasUteis: 1,
      freteTaxaPercentual: 4.5,
      freteQuantidadeUnidades: 1,
      freteTipoMensagem: 'padrao',
    },
    freteCalc1Un
  );
  verificar(
    freteMsg1Un.freteMensagemGerada ===
      'Olá, enviamos sim! O valor do frete para o seu CEP (01001-000) é R$ 36,00 por unidade, com prazo de entrega de 1 dia útil.',
    'Mensagem Padrão (1 unidade, prazo 1 dia útil no singular, sem transportadora) gerada corretamente.'
  );

  // Cenário 6: Múltiplas unidades (3 unidades -> NÃO multiplicar R$ 251,00 por 3)
  const freteCalc3Un = calcularFreteFront({
    freteValorOriginal: 229.07,
    freteCustoGasolina: 10.0,
    freteTaxaPercentual: 4.5,
  });
  const freteMsg3Un = gerarFreteMensagemFront(
    {
      freteCepDestino: '57310-540',
      freteValorOriginal: 229.07,
      freteCustoGasolina: 10.0,
      fretePrazoDiasUteis: 7,
      freteTaxaPercentual: 4.5,
      freteQuantidadeUnidades: 3,
      freteTransportadora: 'JadLog',
      freteTipoMensagem: 'padrao',
    },
    freteCalc3Un
  );
  verificar(
    freteMsg3Un.freteMensagemGerada ===
      'Olá, enviamos sim! O valor total do frete para as 3 unidades, com destino ao CEP 57310-540, é de R$ 251,00, com prazo de entrega de 7 dias úteis pela transportadora JadLog.',
    'Mensagem Padrão (3 unidades, sem multiplicar valor, com JadLog) gerada corretamente.'
  );

  verificar(
    !freteMsg3Un.freteMensagemGerada.includes('4,5') &&
      !freteMsg3Un.freteMensagemGerada.toLowerCase().includes('gasolina') &&
      !freteMsg3Un.freteMensagemGerada.includes('**'),
    'Mensagem Padrão não contém taxa percentual, gasolina, Markdown ou emojis.'
  );

  // =========================================================================
  // 4. MENSAGEM DIRETA, PRIMEIRO NOME, TRANSPORTADORAS, TELEFONE E LIMITE 350 (Cenários 8, 9, 10, 11)
  // =========================================================================
  console.log('\n--- 4. Mensagem Direta, Primeiro Nome, Transportadoras e Limite de 350 Caracteres ---');

  // Cenário 8: Primeiro nome
  verificar(
    extrairFretePrimeiroNomeFront('Joao Cicero Do Espirito Santo') === 'Joao' &&
      extrairFretePrimeiroNomeFront('JOÃO PEDRO ALMEIDA') === 'João' &&
      extrairFretePrimeiroNomeFront('   ') === '',
    'Extração de primeiro nome funciona com nome completo, maiúsculas e campo vazio.'
  );

  // Cenários 9, 10 e 11: Mensagem Direta completa + solicitação de telefone + limite 350
  const freteCalcDireta = calcularFreteFront({
    freteValorOriginal: 90.08,
    freteCustoGasolina: 10.0,
    freteTaxaPercentual: 4.5,
  });
  const freteEntradaDireta = {
    freteCepDestino: '57310540',
    freteValorOriginal: 90.08,
    freteCustoGasolina: 10.0,
    fretePrazoDiasUteis: 6,
    freteTaxaPercentual: 4.5,
    freteQuantidadeUnidades: 1,
    freteClienteNome: 'João Cicero Do Espirito Santo',
    freteClienteEndereco: 'Rua Benjamim Freire de Amorim, 1930, CEP: 57310-540, Arapiraca/AL',
    freteTransportadora: 'Loggi',
    freteTipoMensagem: 'direta',
  };
  const freteMsgDiretaFront = gerarFreteMensagemFront(freteEntradaDireta, freteCalcDireta);
  const freteMsgDiretaBack = gerarFreteMensagemBack(freteEntradaDireta, freteCalcDireta);

  assertNode.equal(freteMsgDiretaFront.freteMensagemGerada, freteMsgDiretaBack.freteMensagemGerada);
  verificar(
    freteMsgDiretaFront.freteMensagemGerada === freteMsgDiretaBack.freteMensagemGerada,
    'Mensagem Direta é idêntica entre Frontend e Backend.'
  );
  verificar(
    freteMsgDiretaFront.freteMensagemGerada.startsWith('Olá, João! Tudo bem?'),
    'Mensagem Direta inicia com saudação usando somente o primeiro nome.'
  );
  verificar(
    freteMsgDiretaFront.freteMensagemGerada.includes('pela transportadora Loggi.') &&
      freteMsgDiretaFront.freteMensagemGerada.includes(
        'Por gentileza, informe um telefone com DDD para contato da transportadora durante a entrega.'
      ) &&
      !freteMsgDiretaFront.freteMensagemGerada.toLowerCase().includes('cpf'),
    'Mensagem Direta inclui transportadora correta, solicita telefone com DDD e não menciona CPF.'
  );

  // Nome vazio na Mensagem Direta
  const freteMsgSemNome = gerarFreteMensagemFront(
    { ...freteEntradaDireta, freteClienteNome: '', freteTransportadora: 'Buslog' },
    freteCalcDireta
  );
  verificar(
    freteMsgSemNome.freteMensagemGerada.startsWith('Olá! Tudo bem?') &&
      freteMsgSemNome.freteMensagemGerada.includes('pela transportadora Buslog.'),
    'Mensagem Direta sem nome usa "Olá! Tudo bem?" e adapta transportadora (Buslog).'
  );

  // Validação obrigatória de transportadora e endereço no Modo Direta
  const freteValidacaoDiretaIncompleta = validarFreteFormularioFront({
    freteCepDestino: '57310-540',
    freteValorOriginal: 90.08,
    fretePrazoDiasUteis: 5,
    freteTaxaPercentual: 4.5,
    freteTipoMensagem: 'direta',
    freteClienteEndereco: '',
    freteTransportadora: '',
  });
  const freteValidacaoDiretaBack = validarFreteFormularioBack({
    freteCepDestino: '57310-540',
    freteValorOriginal: 90.08,
    fretePrazoDiasUteis: 5,
    freteTaxaPercentual: 4.5,
    freteTipoMensagem: 'direta',
    freteClienteEndereco: '',
    freteTransportadora: '',
  });
  verificar(
    !freteValidacaoDiretaIncompleta.freteValido &&
      Boolean(freteValidacaoDiretaIncompleta.freteErros.freteTransportadora) &&
      Boolean(freteValidacaoDiretaIncompleta.freteErros.freteClienteEndereco) &&
      !freteValidacaoDiretaBack.freteValido,
    'Modo Direta exige transportadora e endereço completo no Frontend e Backend.'
  );

  // Cenário 11: Constante FRETE_LIMITE_CARACTERES_FINAL = 350 e contagem do trecho final
  verificar(
    FRETE_LIMITE_FRONT === 350 &&
      FRETE_LIMITE_BACK === 350 &&
      freteMsgDiretaFront.freteTrechoFinalAnalise.freteTrechoEncontrado === true &&
      freteMsgDiretaFront.freteTrechoFinalAnalise.freteCaracteresTrechoFinal <= 350 &&
      freteMsgDiretaFront.freteTrechoFinalAnalise.freteExcedeuLimite === false,
    `Trecho final padrão respeita FRETE_LIMITE_CARACTERES_FINAL=350 (${freteMsgDiretaFront.freteTrechoFinalAnalise.freteCaracteresTrechoFinal}/350 caracteres).`
  );

  const freteTextoExcedente =
    freteMsgDiretaFront.freteMensagemGerada + ' ' + 'X'.repeat(120);
  const freteAnaliseExcedente = analisarFreteTrechoFinalFront(freteTextoExcedente);
  const freteAnaliseExcedenteBack = analisarFreteTrechoFinalBack(freteTextoExcedente);
  verificar(
    freteAnaliseExcedente.freteExcedeuLimite === true &&
      freteAnaliseExcedente.freteCaracteresTrechoFinal > 350 &&
      freteAnaliseExcedente.freteCaracteresExcedentes ===
        freteAnaliseExcedenteBack.freteCaracteresExcedentes,
    `Edição acima de 350 caracteres detectada corretamente (${freteAnaliseExcedente.freteCaracteresTrechoFinal}/350, excesso: ${freteAnaliseExcedente.freteCaracteresExcedentes}).`
  );

  // =========================================================================
  // 5. COMPONENTES DE UI: CÓPIA, EDIÇÃO MANUAL + RESTAURAÇÃO E OVERRIDE LOCAL (Cenários 12, 13, 14)
  // =========================================================================
  console.log('\n--- 5. UI: Cópia Isolada, Edição Manual + Restauração e Taxa Local vs Global ---');

  const { getEl } = criarMockDomMinimo();
  let freteTextoCopiadoClipboard = '';
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        async writeText(texto) {
          freteTextoCopiadoClipboard = texto;
        },
      },
    },
  });

  const fretePreview = new FreteMensagemPreview();
  fretePreview.atualizarFreteMensagemGerada(freteMsgDiretaFront);

  // Cenário 12: Cópia da mensagem (somente o texto do cliente, sem resumo de cálculo)
  const freteCopiou = await fretePreview.copiarFreteMensagem();
  verificar(
    freteCopiou === true &&
      freteTextoCopiadoClipboard === freteMsgDiretaFront.freteMensagemGerada &&
      !freteTextoCopiadoClipboard.includes('Valor líquido necessário') &&
      !freteTextoCopiadoClipboard.includes('4,5%'),
    'Botão copiar transfere somente a mensagem do cliente, sem incluir resumo interno.'
  );

  // Cenário 13: Edição manual e restauração do texto gerado automaticamente
  const freteTextarea = getEl('freteMensagemGerada');
  const freteTextoEditado = freteMsgDiretaFront.freteMensagemGerada + '\nObservação comercial adicional.';
  freteTextarea.value = freteTextoEditado;
  freteTextarea.dispatch('input');
  verificar(
    fretePreview.freteEditadoManualmente === true &&
      getEl('frete-btn-restaurar-mensagem').style.display === 'inline-flex',
    'Edição manual da mensagem ativa estado de edição e exibe botão de restauração sem alterar o cálculo.'
  );

  fretePreview.restaurarFreteMensagemAutomatica();
  verificar(
    fretePreview.freteEditadoManualmente === false &&
      freteTextarea.value === freteMsgDiretaFront.freteMensagemGerada,
    'Restauração recupera integralmente o texto gerado automaticamente.'
  );

  // Cenário 14: Override local da taxa (GESTOR) sem alterar global + bloqueio para OPERADOR
  const freteForm = new FreteFormulario({ onAlterar: () => {} });
  freteForm.configurarFretePermissaoTaxa(true, 4.5);
  freteForm.definirFreteTaxaLocal(6.0);
  verificar(
    freteForm.estaUsandoFreteTaxaPersonalizada() === true &&
      freteForm.freteTaxaGlobalPadrao === 4.5 &&
      getEl('freteTaxaPercentual').readOnly === false,
    'GESTOR consegue alterar a taxa localmente (6%) sem modificar a configuração global (4,5%).'
  );

  freteForm.configurarFretePermissaoTaxa(false, 4.5);
  freteForm.definirFreteTaxaLocal(4.5);
  verificar(
    getEl('freteTaxaPercentual').readOnly === true &&
      freteForm.obterFreteDadosAtuais().freteTaxaPercentual === 4.5,
    'OPERADOR tem campo de taxa em modo somente leitura utilizando a taxa padrão definida pelo Gestor.'
  );

  // =========================================================================
  // 6. PERSISTÊNCIA DA TAXA PADRÃO + RBAC NA API HTTP (Cenário 15)
  // =========================================================================
  console.log('\n--- 6. API HTTP, RBAC (somente GESTOR altera taxa) e Persistência MySQL ---');

  let freteMysqlAtivo = false;
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      await AppDataSource.runMigrations();
    }
    freteMysqlAtivo = true;
  } catch (freteDbErr) {
    console.log(`  ⚠️  MySQL local indisponível (${freteDbErr.message}). Validando RBAC HTTP + camada de serviço em modo resiliente.`);
  }

  const freteServer = app.listen(0);
  const fretePorta = freteServer.address().port;
  const freteBaseUrl = `http://127.0.0.1:${fretePorta}/api/fretes`;

  let usuarioGestorId = 1;
  let usuarioOperadorId = 2;
  if (freteMysqlAtivo) {
    try {
      const repoUsuario = AppDataSource.getRepository('Usuario');
      const gestorReal = await repoUsuario.findOne({ where: { perfil: 'GESTOR' } });
      if (gestorReal) usuarioGestorId = gestorReal.id_usuario;
      const opReal = await repoUsuario.findOne({ where: { perfil: 'OPERADOR' } });
      if (opReal) usuarioOperadorId = opReal.id_usuario;
    } catch (_) {}
  }

  const freteTokenGestor = jwt.sign(
    { id_usuario: usuarioGestorId, email: 'gestor@rezfire.com.br', nome: 'Gestor Teste', perfil: 'GESTOR' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const freteTokenOperador = jwt.sign(
    { id_usuario: usuarioOperadorId, email: 'operador@rezfire.com.br', nome: 'Operador Teste', perfil: 'OPERADOR' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  try {
    // Sem autenticação -> 401
    const freteRespSemAuth = await fetch(`${freteBaseUrl}/configuracoes`);
    verificar(
      freteRespSemAuth.status === 401,
      'GET /api/fretes/configuracoes bloqueia acesso não autenticado (HTTP 401).'
    );

    // OPERADOR tenta alterar taxa padrão -> 403
    const freteRespOpPut = await fetch(`${freteBaseUrl}/configuracoes`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${freteTokenOperador}`,
      },
      body: JSON.stringify({ freteTaxaPercentualPadrao: 5.0 }),
    });
    verificar(
      freteRespOpPut.status === 403,
      'PUT /api/fretes/configuracoes bloqueia perfil OPERADOR (HTTP 403 — somente GESTOR altera a taxa).'
    );

    // OPERADOR lê configurações -> 200 com fretePodeEditarTaxa = false
    const freteRespOpGet = await fetch(`${freteBaseUrl}/configuracoes`, {
      headers: { Authorization: `Bearer ${freteTokenOperador}` },
    });
    const freteJsonOpGet = await freteRespOpGet.json();
    verificar(
      freteRespOpGet.status === 200 &&
        freteJsonOpGet.sucesso === true &&
        freteJsonOpGet.fretePodeEditarTaxa === false,
      'GET /api/fretes/configuracoes permite leitura para OPERADOR com fretePodeEditarTaxa=false.'
    );

    // GESTOR tenta enviar taxa 100% -> 400
    const freteRespTaxa100 = await fetch(`${freteBaseUrl}/configuracoes`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${freteTokenGestor}`,
      },
      body: JSON.stringify({ freteTaxaPercentualPadrao: 100 }),
    });
    verificar(
      freteRespTaxa100.status === 400,
      'PUT /api/fretes/configuracoes rejeita taxa de 100% no backend (HTTP 400).'
    );

    if (freteMysqlAtivo) {
      const freteService = new FreteCotacaoService();
      const freteConfigOriginal = await freteService.obterFreteConfiguracao();

      // GESTOR atualiza taxa padrão para 5.25% via API e verifica persistência no MySQL
      const freteRespGestorPut = await fetch(`${freteBaseUrl}/configuracoes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freteTokenGestor}`,
        },
        body: JSON.stringify({
          freteTaxaPercentualPadrao: 5.25,
          freteTransportadoraPadrao: 'JadLog',
        }),
      });
      const freteJsonGestorPut = await freteRespGestorPut.json();
      const freteConfigPersistida = await freteService.obterFreteConfiguracao();

      verificar(
        freteRespGestorPut.status === 200 &&
          freteJsonGestorPut.sucesso === true &&
          freteConfigPersistida.freteTaxaPercentualPadrao === 5.25 &&
          freteConfigPersistida.freteTransportadoraPadrao === 'JadLog',
        'Persistência no MySQL validada: taxa 5,25% e transportadora padrão salvas e recarregadas com sucesso.'
      );

      // Restaura valor original para não sujar o banco
      await freteService.atualizarFreteConfiguracao({
        freteTaxaPercentualPadrao: freteConfigOriginal.freteTaxaPercentualPadrao,
        freteTransportadoraPadrao: freteConfigOriginal.freteTransportadoraPadrao,
      });
    } else {
      // Quando MySQL está offline no ambiente, valida toda a lógica de persistência via repositório TypeORM em memória + HTTP PUT GESTOR
      const freteMemoriaTabela = [
        {
          frete_configuracao_id: 1,
          frete_taxa_percentual_padrao: 4.5,
          frete_transportadora_padrao: null,
          frete_atualizado_por_usuario_id: null,
          frete_configuracao_criada_em: new Date(),
          frete_configuracao_atualizada_em: new Date(),
        },
      ];
      const freteRepoStub = {
        async find() {
          return [...freteMemoriaTabela];
        },
        create(dados) {
          return { frete_configuracao_id: 1, ...dados };
        },
        async save(entidade) {
          entidade.frete_configuracao_atualizada_em = new Date();
          freteMemoriaTabela[0] = { ...entidade };
          return freteMemoriaTabela[0];
        },
      };
      const freteGetRepoOriginal = AppDataSource.getRepository.bind(AppDataSource);
      const freteIsInitDesc = Object.getOwnPropertyDescriptor(AppDataSource, 'isInitialized');
      Object.defineProperty(AppDataSource, 'isInitialized', { configurable: true, get: () => true });
      AppDataSource.getRepository = () => freteRepoStub;

      try {
        const freteRespGestorPut = await fetch(`${freteBaseUrl}/configuracoes`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${freteTokenGestor}`,
          },
          body: JSON.stringify({
            freteTaxaPercentualPadrao: 5.25,
            freteTransportadoraPadrao: 'JadLog',
          }),
        });
        const freteJsonGestorPut = await freteRespGestorPut.json();

        const freteRespGetAposPut = await fetch(`${freteBaseUrl}/configuracoes`, {
          headers: { Authorization: `Bearer ${freteTokenGestor}` },
        });
        const freteJsonGetAposPut = await freteRespGetAposPut.json();

        verificar(
          freteRespGestorPut.status === 200 &&
            freteJsonGestorPut.sucesso === true &&
            freteJsonGetAposPut.freteConfiguracao.freteTaxaPercentualPadrao === 5.25 &&
            freteJsonGetAposPut.freteConfiguracao.freteTransportadoraPadrao === 'JadLog' &&
            freteJsonGetAposPut.fretePodeEditarTaxa === true,
          'Fluxo completo PUT/GET /api/fretes/configuracoes (GESTOR) persiste taxa 5,25% e transportadora padrão (validado com repositório em memória; migration 1700000000016 pronta para MySQL).'
        );

        // Valida também que OPERADOR no endpoint stateless /calcular não consegue sobrescrever a taxa padrão
        const freteRespCalcOp = await fetch(`${freteBaseUrl}/calcular`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${freteTokenOperador}`,
          },
          body: JSON.stringify({
            freteCepDestino: '57310-540',
            freteValorOriginal: 90.08,
            freteCustoGasolina: 10,
            fretePrazoDiasUteis: 5,
            freteTaxaPercentual: 0, // Operador tentando zerar taxa
            freteTipoMensagem: 'padrao',
          }),
        });
        const freteJsonCalcOp = await freteRespCalcOp.json();
        verificar(
          freteRespCalcOp.status === 200 &&
            freteJsonCalcOp.freteCalculo.freteTaxaPercentual === 5.25,
          'POST /api/fretes/calcular ignora tentativa de override de taxa por OPERADOR e aplica a taxa padrão do GESTOR (5,25%).'
        );
      } finally {
        AppDataSource.getRepository = freteGetRepoOriginal;
        if (freteIsInitDesc) {
          Object.defineProperty(AppDataSource, 'isInitialized', freteIsInitDesc);
        } else {
          Object.defineProperty(AppDataSource, 'isInitialized', {
            configurable: true,
            value: false,
            writable: true,
          });
        }
      }
    }
  } finally {
    if (fretePreview.freteTimeoutFeedback) {
      clearTimeout(fretePreview.freteTimeoutFeedback);
    }
    if (typeof freteServer.closeAllConnections === 'function') {
      freteServer.closeAllConnections();
    }
    await new Promise((freteResolve) => freteServer.close(freteResolve));
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }

  console.log('\n===============================================================');
  console.log(`Resumo: ${freteTotalPassou} aprovado(s) | ${freteTotalFalhou} falha(s)`);
  if (freteTotalFalhou === 0) {
    console.log('🎉 TODOS OS TESTES DO MÓDULO GERADOR DE COTAÇÕES DE FRETE FORAM APROVADOS!');
  } else {
    console.error('❌ EXISTEM FALHAS NOS TESTES DO MÓDULO DE FRETES.');
  }
  console.log('===============================================================\n');

  process.exitCode = freteTotalFalhou === 0 ? 0 : 1;
}

executarTestesFrete().catch((freteErr) => {
  console.error('Erro fatal na execução dos testes de frete:', freteErr);
  process.exit(1);
});
