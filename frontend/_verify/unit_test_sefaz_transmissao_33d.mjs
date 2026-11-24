/**
 * unit_test_sefaz_transmissao_33d.mjs
 * Teste automatizado de aceite da User Story 33d (Transmitir à SEFAZ e tratar o retorno).
 *
 * Critérios validados:
 * 1. Ambiente padrão é homologacao; modo simulado é bloqueado no ambiente producao.
 * 2. Retorno SEFAZ claro e persistido: autorizada (protocolo + XML nfeProc), rejeitada (cStat + xMotivo + msg amigável), denegada.
 * 3. Rejeitada pode ser corrigida e reenviada (mesma numeração por padrão, ou avançando número após 204/539).
 * 4. Anti-duplicidade em retorno demorado (em_processamento): consulta NFeConsultaProtocolo4 antes de reenviar; só reenvia se 217.
 * 5. Pedido retorna status_fiscal (sem_nota / rascunho / assinada / em_processamento / autorizada / rejeitada / denegada).
 * 6. SEFAZ indisponível retorna HTTP 503 sem corromper a nota assinada e permite nova tentativa em seguida.
 * 7. Toda tentativa de envio ou consulta é auditada na tabela notas_fiscais_transmissoes.
 */

import { createRequire } from 'module';
import bcrypt from '../../backend/node_modules/bcrypt/bcrypt.js';
import { AppDataSource } from '../../backend/dist/config/database.js';
import { Usuario } from '../../backend/dist/entities/Usuario.js';
import { EmitenteFiscal } from '../../backend/dist/entities/EmitenteFiscal.js';
import { Produto } from '../../backend/dist/entities/Produto.js';
import { Estoque } from '../../backend/dist/entities/Estoque.js';
import { Pedido } from '../../backend/dist/entities/Pedido.js';
import { MovimentacaoEstoque } from '../../backend/dist/entities/MovimentacaoEstoque.js';
import { NotaFiscal } from '../../backend/dist/entities/NotaFiscal.js';
import { NotaFiscalTransmissao } from '../../backend/dist/entities/NotaFiscalTransmissao.js';

const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const forge = require('node-forge');

const BASE_URL = 'http://localhost:3001/api';

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    console.log(`  ✅ [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${label}`);
    failed++;
  }
}

function gerarPkcs12Teste({ cnpj, razao, diasInicio, diasFim, senha }) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '09ABCDEF112233';
  const agora = Date.now();
  cert.validity.notBefore = new Date(agora + diasInicio * 86400000);
  cert.validity.notAfter = new Date(agora + diasFim * 86400000);

  const attrs = [
    { name: 'commonName', value: `${razao}:${cnpj}` },
    { name: 'countryName', value: 'BR' },
    { name: 'organizationName', value: 'ICP-Brasil Teste' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  const sanSeq = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer('2.16.76.1.3.3').getBytes()
      ),
      forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false, cnpj),
      ]),
    ]),
  ]);

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'subjectAltName', value: forge.asn1.toDer(sanSeq).getBytes() },
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], senha, {
    algorithm: '3des',
    friendlyName: 'RezFireTeste33dA1',
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, 'binary');
}

async function criarPedidoTeste(gestorHeaders, idProdutoTeste, sufixo) {
  const pedRes = await fetch(`${BASE_URL}/pedidos`, {
    method: 'POST',
    headers: gestorHeaders,
    body: JSON.stringify({
      codigo_pedido: `PED-33D-${sufixo}-${Date.now()}`,
      cliente_nome: `Empresa Destinatária 33d ${sufixo} Ltda`,
      origem: 'Venda Direta',
      modalidade_envio: 'Logística Própria',
      destinatario_documento: '45997418000153',
      destinatario_ie: '110042490114',
      destinatario_cep: '01310100',
      destinatario_logradouro: 'Av Paulista',
      destinatario_numero: '1000',
      destinatario_bairro: 'Bela Vista',
      destinatario_municipio: 'São Paulo',
      destinatario_codigo_municipio_ibge: '3550308',
      destinatario_uf: 'SP',
      destinatario_email: 'fiscal@cliente33d.com.br',
      itens: [{ id_produto: idProdutoTeste, quantidade: 2, preco_unitario: 380.0 }],
    }),
  });
  const pedData = await pedRes.json();
  if (!pedData?.pedido?.id_pedido) {
    throw new Error(`Falha ao criar pedido de teste (${sufixo}): ${JSON.stringify(pedData)}`);
  }
  return pedData.pedido;
}

async function runTests() {
  console.log('🧪 Iniciando Testes Automatizados da Story 33d (Transmissão SEFAZ & Retornos)...\n');

  let tokenGestor = null;
  let tokenOperador = null;
  let emitenteSnapshotAntes = null;
  let instalouCertTemporario = false;
  let idOperadorCriado = null;
  let idProdutoTeste = null;
  const idsPedidosTeste = [];
  const idsNotasTeste = [];

  try {
    await AppDataSource.initialize();
    const usuarioRepo = AppDataSource.getRepository(Usuario);
    const emitenteRepo = AppDataSource.getRepository(EmitenteFiscal);
    const estoqueRepo = AppDataSource.getRepository(Estoque);

    // 1. Login Gestor + criação temporária de Operador
    console.log('Passo 1: Autenticando Gestor/Operador e preparando emitente + certificado A1...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'gestor@rezfire.com.br', senha: 'rezfire2026' }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.token, 'Gestor autenticado com sucesso');
    tokenGestor = loginData.token;

    const emailOp = `operador.33d.${Date.now()}@rezfire.com.br`;
    const opSalvo = await usuarioRepo.save(
      usuarioRepo.create({
        nome: 'Operador Teste 33d',
        email: emailOp,
        senha_hash: await bcrypt.hash('op123456', 10),
        perfil: 'OPERADOR',
        ativo: true,
      })
    );
    idOperadorCriado = opSalvo.id_usuario;

    const loginOpRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailOp, senha: 'op123456' }),
    });
    tokenOperador = (await loginOpRes.json()).token;

    const gestorHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenGestor}`,
    };
    const operadorHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenOperador}`,
    };

    const emitenteAntes = await emitenteRepo.findOne({ where: {} });
    if (emitenteAntes) {
      emitenteSnapshotAntes = {
        id_emitente: emitenteAntes.id_emitente,
        ambiente: emitenteAntes.ambiente,
        proximo_numero_nfe: emitenteAntes.proximo_numero_nfe,
        hadCert: Boolean(emitenteAntes.certificado_titular),
      };
    }

    const cnpjEmitente = emitenteAntes?.cnpj || '11222333000181';
    const razaoEmitente = emitenteAntes?.razao_social || 'RezFire Equipamentos Contra Incendio Ltda';

    if (!emitenteAntes) {
      await fetch(`${BASE_URL}/fiscal/emitente`, {
        method: 'PUT',
        headers: gestorHeaders,
        body: JSON.stringify({
          razao_social: razaoEmitente,
          nome_fantasia: 'RezFire',
          cnpj: cnpjEmitente,
          inscricao_estadual: '110042490114',
          regime_tributario: '1',
          cep: '01001000',
          logradouro: 'Av Paulista',
          numero: '1500',
          bairro: 'Bela Vista',
          municipio: 'São Paulo',
          codigo_municipio_ibge: '3550308',
          uf: 'SP',
          serie_nfe: 1,
          proximo_numero_nfe: 900,
          modo_integracao: 'sefaz_direto',
        }),
      });
    } else if (emitenteAntes.ambiente !== 'homologacao') {
      await fetch(`${BASE_URL}/fiscal/emitente/ambiente`, {
        method: 'PATCH',
        headers: gestorHeaders,
        body: JSON.stringify({ ambiente: 'homologacao' }),
      });
    }

    if (!emitenteAntes?.certificado_titular) {
      const senhaCert = 'RezFire#33d!2026';
      const pfx = gerarPkcs12Teste({
        cnpj: cnpjEmitente,
        razao: razaoEmitente.toUpperCase().slice(0, 30),
        diasInicio: -10,
        diasFim: 365,
        senha: senhaCert,
      });
      const formCert = new FormData();
      formCert.append('certificado', new Blob([pfx], { type: 'application/x-pkcs12' }), 'a1_33d.pfx');
      formCert.append('senha', senhaCert);
      const upCertRes = await fetch(`${BASE_URL}/fiscal/emitente/certificado`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenGestor}` },
        body: formCert,
      });
      assert(upCertRes.status === 200, 'Certificado A1 temporário instalado para assinatura/transmissão 33d');
      instalouCertTemporario = upCertRes.status === 200;
    }

    // Cria produto apto para NF-e
    const prodRes = await fetch(`${BASE_URL}/produtos`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        sku: `TEST-33D-${Date.now()}`,
        nome: 'Extintor ABC 6kg Teste 33d',
        preco: 380.0,
        custo: 190.0,
        categoria: 'Extintores',
        ncm: '84241000',
        cfop: '5102',
        origem_mercadoria: '0',
        cst_csosn: '102',
        unidade_comercial: 'UN',
      }),
    });
    const prodData = await prodRes.json();
    idProdutoTeste = prodData.produto.id_produto;
    await estoqueRepo.update({ id_produto: idProdutoTeste }, { quantidade_atual: 100 });

    // 2. Critério 1: Ambiente padrão homologação + status SEFAZ + bloqueio estrito de simulação em produção
    console.log('\nPasso 2: Validando ambiente padrão Homologação e bloqueio de simulação em Produção (Critério 1)...');
    const emitCheck = await (await fetch(`${BASE_URL}/fiscal/emitente`, { headers: gestorHeaders })).json();
    assert(emitCheck.emitente?.ambiente === 'homologacao', 'Ambiente inicial confirmado em homologacao');

    const statusSefazRes = await fetch(`${BASE_URL}/fiscal/sefaz/status`, { headers: gestorHeaders });
    const statusSefazData = await statusSefazRes.json();
    assert(
      statusSefazRes.status === 200 && statusSefazData.codigo_sefaz === '107' && statusSefazData.ambiente === 'homologacao',
      'Consulta NFeStatusServico4 respondeu cStat 107 em homologacao'
    );

    // Verifica que pedido novo começa com status_fiscal = 'sem_nota'
    const pedProd = await criarPedidoTeste(gestorHeaders, idProdutoTeste, 'PROD');
    idsPedidosTeste.push(pedProd.id_pedido);
    const detSemNota = await (await fetch(`${BASE_URL}/pedidos/${pedProd.id_pedido}`, { headers: gestorHeaders })).json();
    assert(detSemNota.pedido?.status_fiscal === 'sem_nota', 'Pedido recém-criado apresenta status_fiscal = sem_nota (Critério 5)');

    // Ativa produção, assina nota de produção e tenta simular -> deve bloquear com HTTP 400
    const ativarProdRes = await fetch(`${BASE_URL}/fiscal/emitente/ambiente`, {
      method: 'PATCH',
      headers: gestorHeaders,
      body: JSON.stringify({
        ambiente: 'producao',
        confirmacao_producao: true,
        texto_confirmacao: 'ATIVAR PRODUCAO',
      }),
    });
    assert(ativarProdRes.status === 200, 'Ambiente alterado para producao temporariamente para testar guardrail');

    const prepProdRes = await fetch(`${BASE_URL}/fiscal/pedidos/${pedProd.id_pedido}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    });
    const prepProdData = await prepProdRes.json();
    if (prepProdData.nota_fiscal?.id_nota_fiscal) idsNotasTeste.push(prepProdData.nota_fiscal.id_nota_fiscal);
    assert(prepProdRes.status === 201 && prepProdData.nota_fiscal?.ambiente === 'producao', 'Nota assinada em producao gerada para validação de guardrail');

    const simProdRes = await fetch(`${BASE_URL}/fiscal/pedidos/${pedProd.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    });
    assert(
      simProdRes.status === 400,
      `Transmissão simulada em producao estritamente bloqueada (HTTP ${simProdRes.status})`
    );

    // Retorna para homologação
    await fetch(`${BASE_URL}/fiscal/emitente/ambiente`, {
      method: 'PATCH',
      headers: gestorHeaders,
      body: JSON.stringify({ ambiente: 'homologacao' }),
    });

    // 3. RBAC + Fluxo Autorizada completo (Critérios 2 e 5)
    console.log('\nPasso 3: Testando RBAC e transmissão AUTORIZADA com protocolo + nfeProc (Critérios 2 e 5)...');
    const ped1 = await criarPedidoTeste(gestorHeaders, idProdutoTeste, 'AUT');
    idsPedidosTeste.push(ped1.id_pedido);

    const prep1Res = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    });
    const prep1Data = await prep1Res.json();
    const nf1Id = prep1Data.nota_fiscal?.id_nota_fiscal;
    if (nf1Id) idsNotasTeste.push(nf1Id);
    assert(prep1Res.status === 201 && prep1Data.nota_fiscal?.status === 'assinada', 'NF-e preparada e assinada antes do envio');

    const opTransRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: operadorHeaders,
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    });
    assert(opTransRes.status === 403, `OPERADOR bloqueado (HTTP 403) ao tentar transmitir NF-e à SEFAZ`);

    const opStatusRes = await fetch(`${BASE_URL}/fiscal/sefaz/status`, { headers: operadorHeaders });
    assert(opStatusRes.status === 403, 'OPERADOR bloqueado (HTTP 403) ao consultar status SEFAZ');

    const autRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    });
    const autData = await autRes.json();
    assert(
      autRes.status === 200 &&
        autData.autorizada === true &&
        autData.nota_fiscal?.status === 'autorizada' &&
        /^\d{15}$/.test(String(autData.nota_fiscal?.protocolo_autorizacao || '')),
      `NF-e autorizada com protocolo SEFAZ (${autData.nota_fiscal?.protocolo_autorizacao})`
    );
    assert(
      String(autData.nota_fiscal?.xml_autorizado || '').includes('<nfeProc') &&
        String(autData.nota_fiscal?.xml_autorizado || '').includes('<protNFe'),
      'XML autorizado nfeProc completo armazenado no banco'
    );

    const xmlAutRes = await fetch(`${BASE_URL}/fiscal/notas/${nf1Id}/xml`, { headers: gestorHeaders });
    const xmlAutBody = await xmlAutRes.text();
    assert(
      xmlAutRes.status === 200 && xmlAutBody.includes('<nfeProc') && xmlAutBody.includes(autData.nota_fiscal.protocolo_autorizacao),
      'Download do XML retorna o nfeProc completo com protocolo após autorização'
    );

    const dupAutRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    });
    assert(dupAutRes.status === 400, 'Tentativa de retransmitir NF-e já autorizada bloqueada (HTTP 400)');

    // 4. Critério 3: Rejeitada -> Corrigir/Regerar (mesmo nº) + Duplicidade 539 -> Avançar nº -> Autorizada
    console.log('\nPasso 4: Testando rejeição SEFAZ, correção com mesmo nº e avanço de nº após cStat 539 (Critério 3)...');
    const ped2 = await criarPedidoTeste(gestorHeaders, idProdutoTeste, 'REJ');
    idsPedidosTeste.push(ped2.id_pedido);

    const prep2 = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    })).json();
    if (prep2.nota_fiscal?.id_nota_fiscal) idsNotasTeste.push(prep2.nota_fiscal.id_nota_fiscal);
    const numeroOriginal = Number(prep2.nota_fiscal?.numero);

    const rej1Res = await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'rejeitada', cstat_simulado: '778' }),
    });
    const rej1Data = await rej1Res.json();
    assert(
      rej1Res.status === 200 &&
        rej1Data.nota_fiscal?.status === 'rejeitada' &&
        rej1Data.nota_fiscal?.ultimo_codigo_sefaz === '778' &&
        String(rej1Data.nota_fiscal?.ultima_mensagem_amigavel || '').toLowerCase().includes('ncm'),
      'Rejeição cStat 778 gravada com xMotivo e mensagem amigável explicando correção de NCM'
    );

    const corr1Data = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ regerar: true }),
    })).json();
    assert(
      corr1Data.nota_fiscal?.status === 'assinada' && Number(corr1Data.nota_fiscal?.numero) === numeroOriginal,
      `Correção padrão preservou mesmo número NF-e (${numeroOriginal}) e retornou para assinada`
    );

    // Simula rejeição de duplicidade 539
    const rej2Data = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'rejeitada_duplicidade' }),
    })).json();
    assert(
      rej2Data.nota_fiscal?.status === 'rejeitada' &&
        rej2Data.nota_fiscal?.ultimo_codigo_sefaz === '539' &&
        rej2Data.interpretacao?.sugereAvancarNumero === true,
      'Rejeição cStat 539 sinalizou necessidade de avançar numeração'
    );

    const corr2Data = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ regerar: true, avancar_numero: true }),
    })).json();
    if (corr2Data.nota_fiscal?.id_nota_fiscal) idsNotasTeste.push(corr2Data.nota_fiscal.id_nota_fiscal);
    assert(
      corr2Data.criada === true && Number(corr2Data.nota_fiscal?.numero) > numeroOriginal,
      `Correção com avancar_numero gerou nova NF-e Nº ${corr2Data.nota_fiscal?.numero} > ${numeroOriginal}`
    );

    const aut2Data = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    })).json();
    assert(aut2Data.autorizada === true, 'NF-e corrigida e reenviada foi AUTORIZADA pela SEFAZ');

    // 5. Critério 4: Retorno demorado (em_processamento) + Anti-duplicidade via consulta prévia + fluxo 217 + denegada
    console.log('\nPasso 5: Testando anti-duplicidade em retorno demorado (103/105), 217 e denegada...');
    const ped3 = await criarPedidoTeste(gestorHeaders, idProdutoTeste, 'PROC');
    idsPedidosTeste.push(ped3.id_pedido);
    const prep3 = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped3.id_pedido}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    })).json();
    if (prep3.nota_fiscal?.id_nota_fiscal) idsNotasTeste.push(prep3.nota_fiscal.id_nota_fiscal);

    const procRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped3.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'processamento' }),
    });
    const procData = await procRes.json();
    assert(
      procData.nota_fiscal?.status === 'em_processamento' &&
        procData.nota_fiscal?.ultimo_codigo_sefaz === '103' &&
        Boolean(procData.nota_fiscal?.numero_recibo),
      `Lote entrou em em_processamento (cStat 103, recibo ${procData.nota_fiscal?.numero_recibo})`
    );

    // Tenta transmitir de novo: deve consultar primeiro e descobrir que já foi autorizada sem reenviar!
    const antiDupData = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped3.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    })).json();
    assert(
      antiDupData.consulta_previa_realizada === true &&
        antiDupData.reenvio_bloqueado_por_consulta === true &&
        antiDupData.autorizada === true &&
        antiDupData.transmissao?.tipo_operacao === 'consulta_protocolo',
      'Anti-duplicidade consultou NFeConsultaProtocolo4 antes de reenviar e confirmou autorização sem novo envio!'
    );

    // Agora testa caminho 217 (NF-e não consta na base -> seguro reenviar) + resultado Denegada (302)
    const ped4 = await criarPedidoTeste(gestorHeaders, idProdutoTeste, 'DEN');
    idsPedidosTeste.push(ped4.id_pedido);
    const prep4 = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped4.id_pedido}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    })).json();
    if (prep4.nota_fiscal?.id_nota_fiscal) idsNotasTeste.push(prep4.nota_fiscal.id_nota_fiscal);

    await fetch(`${BASE_URL}/fiscal/pedidos/${ped4.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'processamento' }),
    });

    const ret217DenData = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped4.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        cenario_consulta_previa: 'nao_consta',
        cenario_teste: 'denegada',
      }),
    })).json();
    assert(
      ret217DenData.consulta_previa_realizada === true &&
        ret217DenData.reenvio_bloqueado_por_consulta === false &&
        ret217DenData.nota_fiscal?.status === 'denegada' &&
        ret217DenData.nota_fiscal?.ultimo_codigo_sefaz === '302',
      'Após cStat 217 (NF-e não consta), reenvio ocorreu com segurança e tratou Uso Denegado (302)'
    );

    const denRetryRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped4.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    });
    assert(denRetryRes.status === 400, 'NF-e denegada bloqueia nova tentativa de envio (HTTP 400)');

    // 6. Critério 6 & 7: SEFAZ indisponível (503) preservando estado + Auditoria completa + Listagem de pedidos (Critério 5)
    console.log('\nPasso 6: Testando SEFAZ indisponível (HTTP 503), retentativa, status_fiscal nos pedidos e auditoria...');
    const ped5 = await criarPedidoTeste(gestorHeaders, idProdutoTeste, '503');
    idsPedidosTeste.push(ped5.id_pedido);
    const prep5 = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped5.id_pedido}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    })).json();
    const nf5Id = prep5.nota_fiscal?.id_nota_fiscal;
    if (nf5Id) idsNotasTeste.push(nf5Id);

    const indRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped5.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'indisponivel' }),
    });
    const indData = await indRes.json();
    assert(
      indRes.status === 503 &&
        indData.indisponivel === true &&
        indData.pode_tentar_novamente === true &&
        indData.nota_fiscal?.status === 'assinada' &&
        Number(indData.nota_fiscal?.tentativas_envio) === 1,
      'SEFAZ indisponível retorna HTTP 503 preservando nota assinada e incrementando tentativa_envio'
    );

    const retRetryData = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped5.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    })).json();
    assert(
      retRetryData.autorizada === true && Number(retRetryData.nota_fiscal?.tentativas_envio) === 2,
      'Nova tentativa após indisponibilidade conclui autorização (tentativas_envio = 2)'
    );

    const transListData = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped5.id_pedido}/nfe/transmissoes`, {
      headers: gestorHeaders,
    })).json();
    const rowsDb = await AppDataSource.getRepository(NotaFiscalTransmissao).find({
      where: { id_nota_fiscal: nf5Id },
    });
    assert(
      Array.isArray(transListData.transmissoes) &&
        transListData.transmissoes.length === 2 &&
        rowsDb.every((r) => Boolean(r.xml_requisicao) && r.duracao_ms !== null),
      `Auditoria persistiu as 2 tentativas em notas_fiscais_transmissoes (com XMLs e duracao_ms)`
    );

    const listPedData = await (await fetch(`${BASE_URL}/pedidos`, { headers: gestorHeaders })).json();
    const ped1NaLista = (listPedData.pedidos || []).find((p) => p.id_pedido === ped1.id_pedido);
    const ped4NaLista = (listPedData.pedidos || []).find((p) => p.id_pedido === ped4.id_pedido);
    assert(
      ped1NaLista?.status_fiscal === 'autorizada' &&
        ped4NaLista?.status_fiscal === 'denegada' &&
        Boolean(ped1NaLista?.nota_fiscal_resumo?.protocolo_autorizacao),
      'Listagem GET /pedidos retorna status_fiscal e protocolo_autorizacao corretamente (Critério 5)'
    );

    console.log('\n========================================');
    console.log(`Resultado do Teste 33d: ${passed} passaram, ${failed} falharam.`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('❌ Erro inesperado durante o teste 33d:', err);
    process.exitCode = 1;
  } finally {
    try {
      if (AppDataSource.isInitialized) {
        for (const idNf of idsNotasTeste) {
          await AppDataSource.getRepository(NotaFiscalTransmissao).delete({ id_nota_fiscal: idNf });
          await AppDataSource.getRepository(NotaFiscal).delete({ id_nota_fiscal: idNf });
        }
        for (const idPed of idsPedidosTeste) {
          await AppDataSource.getRepository(Pedido).delete({ id_pedido: idPed });
        }
        if (idProdutoTeste) {
          await AppDataSource.getRepository(MovimentacaoEstoque).delete({ id_produto: idProdutoTeste });
          await AppDataSource.getRepository(Estoque).delete({ id_produto: idProdutoTeste });
          await AppDataSource.getRepository(Produto).delete({ id_produto: idProdutoTeste });
        }
        if (idOperadorCriado) {
          await AppDataSource.getRepository(Usuario).delete({ id_usuario: idOperadorCriado });
        }

        if (emitenteSnapshotAntes) {
          if (instalouCertTemporario && tokenGestor) {
            await fetch(`${BASE_URL}/fiscal/emitente/certificado`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${tokenGestor}` },
            });
          }
          await AppDataSource.getRepository(EmitenteFiscal).update(
            { id_emitente: emitenteSnapshotAntes.id_emitente },
            {
              ambiente: emitenteSnapshotAntes.ambiente,
              proximo_numero_nfe: emitenteSnapshotAntes.proximo_numero_nfe,
            }
          );
        } else if (tokenGestor) {
          await fetch(`${BASE_URL}/fiscal/emitente/certificado`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tokenGestor}` },
          });
          await AppDataSource.query('DELETE FROM emitente_fiscal');
        }
        await AppDataSource.destroy();
      }
    } catch (cleanupErr) {
      console.warn('⚠️ Aviso na limpeza pós-teste:', cleanupErr.message);
    }
  }
}

runTests();

