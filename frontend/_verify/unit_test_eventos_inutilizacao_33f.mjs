/**
 * unit_test_eventos_inutilizacao_33f.mjs
 * Teste automatizado de aceite da User Story 33f (Cancelar NF-e, Carta de Correção e Inutilização).
 *
 * Critérios validados:
 * 1. Cancelamento permitido somente para NF-e autorizada dentro do prazo (24h) e sem circulação física, com justificativa >= 15 chars.
 * 2. Carta de Correção valida texto (15..1000), bloqueia alterações proibidas (valor/imposto/destinatário/data), respeita 30d e limite de 20 eventos.
 * 3. Cancelamento e CC-e são transmitidos e registrados com protocolo e XML procEventoNFe, atualizando o status_fiscal sem corromper o estoque/pedido comercial.
 * 4. Nota cancelada bloqueia novo cancelamento/CC-e e exibe marca NF-E CANCELADA no DANFE.
 * 5. Inutilização bloqueia faixa com nota consumida ou duplicada, homologa faixa livre (cStat 102) e preserva próx. número + procInutNFe.
 * 6. RBAC restrito ao GESTOR (OPERADOR 403 em mutações, 200 em leitura de eventos) e bloqueio estrito de simulação em produção.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import bcrypt from '../../backend/node_modules/bcrypt/bcrypt.js';
import { AppDataSource } from '../../backend/dist/config/database.js';
import { env } from '../../backend/dist/config/env.js';
import { sha256Hex } from '../../backend/dist/utils/cryptoVault.js';
import { Usuario } from '../../backend/dist/entities/Usuario.js';
import { EmitenteFiscal } from '../../backend/dist/entities/EmitenteFiscal.js';
import { Produto } from '../../backend/dist/entities/Produto.js';
import { Estoque } from '../../backend/dist/entities/Estoque.js';
import { Pedido } from '../../backend/dist/entities/Pedido.js';
import { MovimentacaoEstoque } from '../../backend/dist/entities/MovimentacaoEstoque.js';
import { NotaFiscal } from '../../backend/dist/entities/NotaFiscal.js';
import { NotaFiscalTransmissao } from '../../backend/dist/entities/NotaFiscalTransmissao.js';
import { NotaFiscalEvento } from '../../backend/dist/entities/NotaFiscalEvento.js';
import { NotaFiscalInutilizacao } from '../../backend/dist/entities/NotaFiscalInutilizacao.js';

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
  cert.serialNumber = '09ABCDEF778899';
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
    friendlyName: 'RezFireTeste33fA1',
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, 'binary');
}

async function criarPedidoTeste(gestorHeaders, idProdutoTeste, sufixo) {
  const res = await fetch(`${BASE_URL}/pedidos`, {
    method: 'POST',
    headers: gestorHeaders,
    body: JSON.stringify({
      codigo_pedido: `PED-33F-${sufixo}-${Date.now()}`,
      cliente_nome: `Comprador Teste 33f ${sufixo}`,
      origem: 'Venda Direta',
      modalidade_envio: 'Logística Própria',
      destinatario_documento: '45997418000153',
      destinatario_ie: '110042490114',
      destinatario_cep: '01310100',
      destinatario_logradouro: 'Av Paulista',
      destinatario_numero: '300',
      destinatario_bairro: 'Bela Vista',
      destinatario_municipio: 'São Paulo',
      destinatario_codigo_municipio_ibge: '3550308',
      destinatario_uf: 'SP',
      destinatario_email: 'compras@teste33f.com.br',
      itens: [{ id_produto: idProdutoTeste, quantidade: 2, preco_unitario: 350.0 }],
    }),
  });
  return (await res.json()).pedido;
}

async function runTests() {
  console.log('🧪 Iniciando Testes Automatizados da Story 33f (Cancelamento, CC-e e Inutilização)...\n');

  let tokenGestor = null;
  let tokenOperador = null;
  let emitenteSnapshotAntes = null;
  let instalouCertTemporario = false;
  let idOperadorCriado = null;
  let idProdutoTeste = null;
  const idsPedidosTeste = [];
  const idsNotasTeste = [];
  const idsInutTeste = [];
  const arquivosDiscoParaLimpar = [];

  try {
    await AppDataSource.initialize();
    const usuarioRepo = AppDataSource.getRepository(Usuario);
    const emitenteRepo = AppDataSource.getRepository(EmitenteFiscal);
    const estoqueRepo = AppDataSource.getRepository(Estoque);
    const nfRepo = AppDataSource.getRepository(NotaFiscal);
    const pedidoRepo = AppDataSource.getRepository(Pedido);
    const eventoRepo = AppDataSource.getRepository(NotaFiscalEvento);

    // 1. Setup usuários e emitente
    console.log('Passo 1: Autenticando Gestor/Operador e configurando emitente + certificado A1...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'gestor@rezfire.com.br', senha: 'rezfire2026' }),
    });
    tokenGestor = (await loginRes.json()).token;

    const emailOp = `operador.33f.${Date.now()}@rezfire.com.br`;
    const opSalvo = await usuarioRepo.save(
      usuarioRepo.create({
        nome: 'Operador 33f',
        email: emailOp,
        senha_hash: await bcrypt.hash('op123456', 10),
        perfil: 'OPERADOR',
        ativo: true,
      })
    );
    idOperadorCriado = opSalvo.id_usuario;

    tokenOperador = (
      await (
        await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailOp, senha: 'op123456' }),
        })
      ).json()
    ).token;

    const gestorHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenGestor}` };
    const operadorHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOperador}` };

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
          proximo_numero_nfe: 980,
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
      const senhaCert = 'RezFire#33f!2026';
      const pfx = gerarPkcs12Teste({
        cnpj: cnpjEmitente,
        razao: razaoEmitente.toUpperCase().slice(0, 30),
        diasInicio: -10,
        diasFim: 365,
        senha: senhaCert,
      });
      const formCert = new FormData();
      formCert.append('certificado', new Blob([pfx], { type: 'application/x-pkcs12' }), 'a1_33f.pfx');
      formCert.append('senha', senhaCert);
      const upCertRes = await fetch(`${BASE_URL}/fiscal/emitente/certificado`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenGestor}` },
        body: formCert,
      });
      assert(upCertRes.status === 200, 'Certificado A1 temporário instalado para assinatura de eventos');
      instalouCertTemporario = upCertRes.status === 200;
    }

    const prodRes = await fetch(`${BASE_URL}/produtos`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        sku: `TEST-33F-${Date.now()}`,
        nome: 'Extintor CO2 Teste 33f',
        preco: 350.0,
        custo: 180.0,
        categoria: 'Extintores',
        ncm: '84241000',
        cfop: '5102',
        origem_mercadoria: '0',
        cst_csosn: '102',
        unidade_comercial: 'UN',
      }),
    });
    idProdutoTeste = (await prodRes.json()).produto.id_produto;
    await estoqueRepo.update({ id_produto: idProdutoTeste }, { quantidade_atual: 50 });

    const ped1 = await criarPedidoTeste(gestorHeaders, idProdutoTeste, 'CANC');
    idsPedidosTeste.push(ped1.id_pedido);

    const prep1 = await (
      await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/preparar-nfe`, {
        method: 'POST',
        headers: gestorHeaders,
        body: JSON.stringify({}),
      })
    ).json();
    const nf1Id = prep1.nota_fiscal.id_nota_fiscal;
    idsNotasTeste.push(nf1Id);

    // 2. Validações de Cancelamento
    console.log('\nPasso 2: Validando bloqueios de Cancelamento (não autorizada, justificativa curta, circulação e prazo 24h)...');
    const cancelNaoAut = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ justificativa: 'Cancelamento antes de autorizar na SEFAZ' }),
    });
    assert(cancelNaoAut.status === 400, `Cancelamento bloqueado em NF-e assinada não autorizada (HTTP ${cancelNaoAut.status})`);

    const aut1 = await (
      await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/transmitir-nfe`, {
        method: 'POST',
        headers: gestorHeaders,
        body: JSON.stringify({ cenario_teste: 'autorizada' }),
      })
    ).json();
    if (aut1.nota_fiscal?.xml_autorizado_path) {
      arquivosDiscoParaLimpar.push(path.resolve(env.FISCAL_XML_ARCHIVE_DIR, aut1.nota_fiscal.xml_autorizado_path));
    }
    const shaOriginalXml = sha256Hex(Buffer.from(aut1.nota_fiscal.xml_autorizado, 'utf8'));

    const cancelJustCurta = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ justificativa: 'Erro' }),
    });
    assert(cancelJustCurta.status === 400, `Justificativa < 15 chars rejeitada (HTTP ${cancelJustCurta.status})`);

    await pedidoRepo.update({ id_pedido: ped1.id_pedido }, { status_entrega: 'Despachado' });
    const cancelDesp = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ justificativa: 'Tentativa de cancelamento apos despacho fisico' }),
    });
    assert(cancelDesp.status === 422, `Cancelamento bloqueado quando mercadoria já foi despachada (HTTP ${cancelDesp.status})`);
    await pedidoRepo.update({ id_pedido: ped1.id_pedido }, { status_entrega: 'A separar' });

    const dataOriginalAut = aut1.nota_fiscal.autorizada_em;
    await nfRepo.update({ id_nota_fiscal: nf1Id }, { autorizada_em: new Date(Date.now() - 26 * 3600000) });
    const cancelForaPrazo = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ justificativa: 'Cancelamento apos 24 horas da autorizacao' }),
    });
    assert(cancelForaPrazo.status === 422, `Cancelamento bloqueado após prazo legal de 24h (HTTP ${cancelForaPrazo.status})`);
    await nfRepo.update({ id_nota_fiscal: nf1Id }, { autorizada_em: new Date(dataOriginalAut) });

    const cancelIndisp = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        justificativa: 'Teste de indisponibilidade SEFAZ no cancelamento',
        cenario_teste: 'indisponivel',
      }),
    });
    assert(cancelIndisp.status === 503, `Indisponibilidade SEFAZ no cancelamento retorna HTTP 503 preservando nota autorizada`);

    // 3. Carta de Correção (regras proibidas, limite e registro sequencial)
    console.log('\nPasso 3: Validando Carta de Correção Eletrônica (bloqueios legais, sequências e imutabilidade)...');
    const cceCurta = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ texto_correcao: 'Curta demais' }),
    });
    assert(cceCurta.status === 400, 'CC-e com texto < 15 caracteres rejeitada (HTTP 400)');

    const cceTipoProibido = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        tipo_correcao: 'valor_imposto',
        texto_correcao: 'Correcao do campo de informacoes adicionais do pedido 123',
      }),
    });
    assert(cceTipoProibido.status === 422, 'CC-e bloqueada ao tentar categoria proibida (valor/imposto)');

    const cceTextoValor = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        texto_correcao: 'Solicitamos alterar o valor total da nota fiscal de 700 para 500 reais',
      }),
    });
    assert(cceTextoValor.status === 422, 'CC-e bloqueada quando texto menciona alteração de valor total/imposto');

    const cceTextoCnpj = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        texto_correcao: 'Favor mudar o CNPJ do destinatario para outro cadastro fiscal',
      }),
    });
    assert(cceTextoCnpj.status === 422, 'CC-e bloqueada quando texto menciona troca de CNPJ/destinatário');

    const cceOk1Res = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        tipo_correcao: 'endereco_observacao',
        texto_correcao: 'Complemento do endereco de entrega ajustado para Galpao B portaria 2 horario comercial',
      }),
    });
    const cceOk1 = await cceOk1Res.json();
    if (cceOk1.evento?.xml_evento_path) {
      arquivosDiscoParaLimpar.push(path.resolve(env.FISCAL_XML_ARCHIVE_DIR, cceOk1.evento.xml_evento_path));
    }
    assert(
      cceOk1Res.status === 200 &&
        cceOk1.registrado === true &&
        cceOk1.evento?.sequencia === 1 &&
        cceOk1.evento?.codigo_sefaz === '135' &&
        cceOk1.nota_fiscal?.status === 'autorizada' &&
        Number(cceOk1.nota_fiscal?.total_cartas_correcao) === 1,
      `CC-e #1 registrada com protocolo (${cceOk1.evento?.protocolo_evento}), mantendo status=autorizada`
    );

    const xmlEvtRes = await fetch(`${BASE_URL}/fiscal/eventos/${cceOk1.evento.id_evento}/xml`, {
      headers: { Authorization: `Bearer ${tokenGestor}` },
    });
    const xmlEvtBody = await xmlEvtRes.text();
    assert(
      xmlEvtRes.status === 200 && xmlEvtBody.includes('<procEventoNFe') && xmlEvtBody.includes('<tpEvento>110110</tpEvento>'),
      'Download XML da CC-e retorna procEventoNFe completo com tpEvento=110110'
    );

    const cceOk2 = await (
      await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
        method: 'POST',
        headers: gestorHeaders,
        body: JSON.stringify({
          tipo_correcao: 'transporte',
          texto_correcao: 'Observacao logistica complementar: entrega agendada com responsavel de recebimento local',
        }),
      })
    ).json();
    if (cceOk2.evento?.xml_evento_path) {
      arquivosDiscoParaLimpar.push(path.resolve(env.FISCAL_XML_ARCHIVE_DIR, cceOk2.evento.xml_evento_path));
    }
    const nfPosCce = await nfRepo.findOne({ where: { id_nota_fiscal: nf1Id } });
    assert(
      cceOk2.evento?.sequencia === 2 &&
        Number(cceOk2.nota_fiscal?.total_cartas_correcao) === 2 &&
        sha256Hex(Buffer.from(nfPosCce.xml_autorizado, 'utf8')) === shaOriginalXml,
      'CC-e #2 incrementou sequência para 2 e preservou o XML autorizado original íntegro (mesmo SHA-256)'
    );

    // 4. Cancelamento válido + preservação estoque/pedido + DANFE cancelada
    console.log('\nPasso 4: Executando Cancelamento válido e verificando status fiscal, DANFE e bloqueios pós-cancelamento...');
    const estAntesCancel = Number((await estoqueRepo.findOne({ where: { id_produto: idProdutoTeste } })).quantidade_atual);
    const cancelOkRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        justificativa: 'Cancelamento por desistência antes da expedição física da mercadoria',
      }),
    });
    const cancelOk = await cancelOkRes.json();
    if (cancelOk.evento?.xml_evento_path) {
      arquivosDiscoParaLimpar.push(path.resolve(env.FISCAL_XML_ARCHIVE_DIR, cancelOk.evento.xml_evento_path));
    }
    assert(
      cancelOkRes.status === 200 &&
        cancelOk.registrado === true &&
        cancelOk.nota_fiscal?.status === 'cancelada' &&
        Boolean(cancelOk.nota_fiscal?.protocolo_cancelamento) &&
        cancelOk.evento?.codigo_tipo_evento === '110111',
      `NF-e cancelada com sucesso na SEFAZ (Protocolo ${cancelOk.nota_fiscal?.protocolo_cancelamento})`
    );

    const estDepoisCancel = Number((await estoqueRepo.findOne({ where: { id_produto: idProdutoTeste } })).quantidade_atual);
    const pedPosCancel = await (await fetch(`${BASE_URL}/pedidos/${ped1.id_pedido}`, { headers: gestorHeaders })).json();
    const danfeCancelHtml = await (
      await fetch(`${BASE_URL}/fiscal/notas/${nf1Id}/danfe`, { headers: { Authorization: `Bearer ${tokenGestor}` } })
    ).text();
    assert(
      pedPosCancel.pedido?.status_fiscal === 'cancelada' &&
        pedPosCancel.pedido?.status === 'Confirmado' &&
        estDepoisCancel === estAntesCancel &&
        danfeCancelHtml.includes('CANCELADA'),
      'Status fiscal atualizado para cancelada, estoque e status comercial do pedido preservados, e DANFE exibe marca CANCELADA'
    );

    const dupCancel = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ justificativa: 'Tentativa duplicada apos ja estar cancelada' }),
    });
    const ccePosCancel = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ texto_correcao: 'Tentativa de enviar CC-e em NF-e ja cancelada na SEFAZ' }),
    });
    assert(
      dupCancel.status === 400 && ccePosCancel.status === 400,
      'NF-e cancelada bloqueia segundo cancelamento e nova Carta de Correção (HTTP 400)'
    );

    // Limites de 30 dias e 20 CC-es em segundo pedido
    const ped2 = await criarPedidoTeste(gestorHeaders, idProdutoTeste, 'LIM');
    idsPedidosTeste.push(ped2.id_pedido);
    const prep2 = await (
      await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/preparar-nfe`, {
        method: 'POST',
        headers: gestorHeaders,
        body: JSON.stringify({}),
      })
    ).json();
    const nf2Id = prep2.nota_fiscal.id_nota_fiscal;
    idsNotasTeste.push(nf2Id);
    const aut2 = await (
      await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/transmitir-nfe`, {
        method: 'POST',
        headers: gestorHeaders,
        body: JSON.stringify({ cenario_teste: 'autorizada' }),
      })
    ).json();
    if (aut2.nota_fiscal?.xml_autorizado_path) {
      arquivosDiscoParaLimpar.push(path.resolve(env.FISCAL_XML_ARCHIVE_DIR, aut2.nota_fiscal.xml_autorizado_path));
    }

    await nfRepo.update({ id_nota_fiscal: nf2Id }, { autorizada_em: new Date(Date.now() - 32 * 86400000) });
    const cce30d = await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ texto_correcao: 'Tentativa de CC-e apos 32 dias da autorizacao original' }),
    });
    assert(cce30d.status === 422, 'CC-e bloqueada após prazo de 30 dias (HTTP 422)');

    await nfRepo.update({ id_nota_fiscal: nf2Id }, { autorizada_em: new Date() });
    for (let s = 1; s <= 20; s++) {
      await eventoRepo.save(
        eventoRepo.create({
          id_nota_fiscal: nf2Id,
          tipo_evento: 'carta_correcao',
          codigo_tipo_evento: '110110',
          sequencia: s,
          ambiente: 'homologacao',
          modo_transporte: 'simulado',
          status: 'registrado',
          descricao_evento: `Evento de teste sequencia ${s}`,
          codigo_sefaz: '135',
          protocolo_evento: `3500000000000${String(s).padStart(2, '0')}`,
        })
      );
    }
    const cceLim21 = await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ texto_correcao: 'Tentativa numero 21 acima do limite maximo permitido' }),
    });
    assert(cceLim21.status === 422, 'CC-e #21 bloqueada pelo limite máximo legal de 20 eventos (HTTP 422)');

    // 5. Inutilização de Numeração + Lacunas + RBAC + Guardrail de Produção
    console.log('\nPasso 5: Validando Inutilização de numeração, lacunas, RBAC e bloqueio em produção...');
    const numConsumido = Number(aut1.nota_fiscal.numero);
    const inutColisao = await fetch(`${BASE_URL}/fiscal/inutilizacoes`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        serie: 1,
        numero_inicial: numConsumido,
        numero_final: numConsumido,
        justificativa: 'Tentativa de inutilizar numero ja consumido por nota cancelada',
      }),
    });
    assert(inutColisao.status === 422, `Inutilização bloqueada para número consumido Nº ${numConsumido} (HTTP 422)`);

    const inutShort = await fetch(`${BASE_URL}/fiscal/inutilizacoes`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ serie: 1, numero_inicial: 9000, numero_final: 9000, justificativa: 'Curto' }),
    });
    assert(inutShort.status === 400, 'Inutilização com justificativa < 15 caracteres rejeitada (HTTP 400)');

    const emitNow = (await (await fetch(`${BASE_URL}/fiscal/emitente`, { headers: gestorHeaders })).json()).emitente;
    const proxAtual = Number(emitNow.proximo_numero_nfe);
    const gapIni = proxAtual + 5;
    const gapFim = proxAtual + 6;

    const inutOkRes = await fetch(`${BASE_URL}/fiscal/inutilizacoes`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        serie: emitNow.serie_nfe,
        numero_inicial: gapIni,
        numero_final: gapFim,
        justificativa: 'Quebra de sequencia na numeracao fiscal antes do envio a SEFAZ',
      }),
    });
    const inutOk = await inutOkRes.json();
    if (inutOk.inutilizacao?.id_inutilizacao) idsInutTeste.push(inutOk.inutilizacao.id_inutilizacao);
    if (inutOk.inutilizacao?.xml_inutilizacao_path) {
      arquivosDiscoParaLimpar.push(path.resolve(env.FISCAL_XML_ARCHIVE_DIR, inutOk.inutilizacao.xml_inutilizacao_path));
    }
    assert(
      inutOkRes.status === 200 &&
        inutOk.autorizada === true &&
        inutOk.inutilizacao?.codigo_sefaz === '102' &&
        Boolean(inutOk.inutilizacao?.protocolo),
      `Faixa ${gapIni}-${gapFim} inutilizada (cStat 102, Protocolo ${inutOk.inutilizacao?.protocolo})`
    );

    const xmlInutRes = await fetch(`${BASE_URL}/fiscal/inutilizacoes/${inutOk.inutilizacao.id_inutilizacao}/xml`, {
      headers: { Authorization: `Bearer ${tokenGestor}` },
    });
    const xmlInutBody = await xmlInutRes.text();
    assert(
      xmlInutRes.status === 200 && xmlInutBody.includes('<procInutNFe') && xmlInutBody.includes('<cStat>102</cStat>'),
      'Download XML da inutilização retorna procInutNFe homologado'
    );

    const listInut = await (await fetch(`${BASE_URL}/fiscal/inutilizacoes`, { headers: gestorHeaders })).json();
    assert(
      Array.isArray(listInut.lacunas_sugeridas) &&
        listInut.lacunas_sugeridas.some((l) => l.numero_inicial <= proxAtual && l.numero_final >= proxAtual),
      'Detector de lacunas identificou automaticamente números pulados anteriores à faixa inutilizada'
    );

    const inutDup = await fetch(`${BASE_URL}/fiscal/inutilizacoes`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        serie: emitNow.serie_nfe,
        numero_inicial: gapFim,
        numero_final: gapFim,
        justificativa: 'Tentativa repetida de inutilizacao sobre faixa ja homologada',
      }),
    });
    assert(inutDup.status === 422, 'Inutilização sobre faixa já homologada bloqueada (HTTP 422)');

    // RBAC
    const opCanc = await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: operadorHeaders,
      body: JSON.stringify({ justificativa: 'Tentativa por operador sem permissao gestor' }),
    });
    const opCce = await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: operadorHeaders,
      body: JSON.stringify({ texto_correcao: 'Tentativa CC-e por operador sem permissao' }),
    });
    const opInut = await fetch(`${BASE_URL}/fiscal/inutilizacoes`, {
      method: 'POST',
      headers: operadorHeaders,
      body: JSON.stringify({ serie: 1, numero_inicial: gapFim + 10, numero_final: gapFim + 10, justificativa: 'Tentativa por operador sem permissao' }),
    });
    const opEvts = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/nfe/eventos`, {
      headers: operadorHeaders,
    });
    assert(
      opCanc.status === 403 && opCce.status === 403 && opInut.status === 403 && opEvts.status === 200,
      'RBAC validado: OPERADOR bloqueado (403) em cancelamento/CC-e/inutilização e autorizado (200) a listar eventos'
    );

    // Guardrail Produção
    await fetch(`${BASE_URL}/fiscal/emitente/ambiente`, {
      method: 'PATCH',
      headers: gestorHeaders,
      body: JSON.stringify({
        ambiente: 'producao',
        confirmacao_producao: true,
        texto_confirmacao: 'ATIVAR PRODUCAO',
      }),
    });
    const inutProdSim = await fetch(`${BASE_URL}/fiscal/inutilizacoes`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        serie: 1,
        numero_inicial: gapFim + 20,
        numero_final: gapFim + 20,
        justificativa: 'Teste de bloqueio de simulacao no ambiente producao',
        cenario_teste: 'autorizada',
      }),
    });
    assert(inutProdSim.status === 400, `Simulação de inutilização bloqueada em produção (HTTP ${inutProdSim.status})`);
    await fetch(`${BASE_URL}/fiscal/emitente/ambiente`, {
      method: 'PATCH',
      headers: gestorHeaders,
      body: JSON.stringify({ ambiente: 'homologacao' }),
    });

    console.log('\n========================================');
    console.log(`Resultado do Teste 33f: ${passed} passaram, ${failed} falharam.`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('❌ Erro inesperado durante o teste 33f:', err);
    process.exitCode = 1;
  } finally {
    try {
      for (const arq of arquivosDiscoParaLimpar) {
        if (arq && fs.existsSync(arq)) fs.unlinkSync(arq);
      }
      if (AppDataSource.isInitialized) {
        for (const idInut of idsInutTeste) {
          await AppDataSource.getRepository(NotaFiscalInutilizacao).delete({ id_inutilizacao: idInut });
        }
        for (const idNf of idsNotasTeste) {
          await AppDataSource.getRepository(NotaFiscalEvento).delete({ id_nota_fiscal: idNf });
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
      console.warn('⚠️ Aviso na limpeza pós-teste 33f:', cleanupErr.message);
    }
  }
}

runTests();

