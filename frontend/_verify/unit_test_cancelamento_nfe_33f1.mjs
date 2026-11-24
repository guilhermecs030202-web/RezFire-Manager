/**
 * unit_test_cancelamento_nfe_33f1.mjs
 * Teste automatizado de aceite da User Story 33f.1 (Cancelar NF-e já emitida).
 *
 * Critérios validados:
 * 1. Ação "Cancelar NF-e" só é permitida para notas autorizadas e exibe prazo restante (24h) antes de confirmar.
 * 2. Justificativa obrigatória (15 a 255 caracteres).
 * 3. Envio à SEFAZ retorna aceite ou rejeição com motivo claro (sem cancelar em caso de rejeição).
 * 4. Após aceite, status fiscal do pedido passa a "cancelada" e XML procEventoNFe fica arquivado e baixável.
 * 5. Fora do prazo normal (>24h) ou mercadoria já saiu (Despachado/Entregue): bloqueia com HTTP 422,
 *    explica o motivo e orienta sobre cancelamento extemporâneo na SEFAZ-SP (até 480h / 20 dias, fora do sistema).
 * 6. Depois do cancelamento, o pedido pode receber uma nova NF-e sequencial, preservando histórico da cancelada.
 * 7. Auditoria completa: quem fez (usuario_nome/id_usuario), quando (data_evento) e justificativa.
 * 8. (DoD) Funciona integralmente sem conta do Mercado Livre conectada (modo manual, #34) + RBAC GESTOR/OPERADOR.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import bcrypt from '../../backend/node_modules/bcrypt/bcrypt.js';
import { AppDataSource } from '../../backend/dist/config/database.js';
import { env } from '../../backend/dist/config/env.js';
import { Usuario } from '../../backend/dist/entities/Usuario.js';
import { EmitenteFiscal } from '../../backend/dist/entities/EmitenteFiscal.js';
import { Produto } from '../../backend/dist/entities/Produto.js';
import { Estoque } from '../../backend/dist/entities/Estoque.js';
import { Pedido } from '../../backend/dist/entities/Pedido.js';
import { MovimentacaoEstoque } from '../../backend/dist/entities/MovimentacaoEstoque.js';
import { NotaFiscal } from '../../backend/dist/entities/NotaFiscal.js';
import { NotaFiscalTransmissao } from '../../backend/dist/entities/NotaFiscalTransmissao.js';
import { NotaFiscalEvento } from '../../backend/dist/entities/NotaFiscalEvento.js';

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
  cert.serialNumber = '09ABCDEF33F101';
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
    friendlyName: 'RezFireTeste33f1A1',
  });
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
}

async function criarPedidoTeste(gestorHeaders, idProdutoTeste, sufixo) {
  const res = await fetch(`${BASE_URL}/pedidos`, {
    method: 'POST',
    headers: gestorHeaders,
    body: JSON.stringify({
      codigo_pedido: `PED-33F1-${sufixo}-${Date.now()}`,
      cliente_nome: `Comprador Teste 33f.1 ${sufixo}`,
      origem: 'Venda Direta',
      modalidade_envio: 'Logística Própria',
      destinatario_documento: '45997418000153',
      destinatario_ie: '110042490114',
      destinatario_cep: '01310100',
      destinatario_logradouro: 'Av Paulista',
      destinatario_numero: '500',
      destinatario_bairro: 'Bela Vista',
      destinatario_municipio: 'São Paulo',
      destinatario_codigo_municipio_ibge: '3550308',
      destinatario_uf: 'SP',
      destinatario_email: 'compras@teste33f1.com.br',
      itens: [{ id_produto: idProdutoTeste, quantidade: 2, preco_unitario: 320.0 }],
    }),
  });
  return (await res.json()).pedido;
}

async function runTests() {
  console.log('\n====================================================================');
  console.log('🧪 TESTES AUTOMATIZADOS — STORY 33f.1 (Cancelar NF-e já emitida)');
  console.log('====================================================================\n');

  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(Usuario);
  const emitRepo = AppDataSource.getRepository(EmitenteFiscal);
  const prodRepo = AppDataSource.getRepository(Produto);
  const estRepo = AppDataSource.getRepository(Estoque);
  const pedRepo = AppDataSource.getRepository(Pedido);
  const movRepo = AppDataSource.getRepository(MovimentacaoEstoque);
  const nfRepo = AppDataSource.getRepository(NotaFiscal);
  const txRepo = AppDataSource.getRepository(NotaFiscalTransmissao);
  const evtRepo = AppDataSource.getRepository(NotaFiscalEvento);

  const emailGestor = `gestor.33f1.${Date.now()}@rezfire.local`;
  const emailOp = `operador.33f1.${Date.now()}@rezfire.local`;
  const senhaLogin = 'Senha33f1#2026';
  const hash = await bcrypt.hash(senhaLogin, 10);

  let gestorCriado = null;
  let opCriado = null;
  let emitenteBackup = null;
  let emitenteCriado = false;
  let produtoCriado = null;
  const pedidosCriados = [];
  const arquivosXmlCriados = [];

  try {
    // 1. Setup usuários, emitente, certificado A1 e produto fiscal
    gestorCriado = await userRepo.save(
      userRepo.create({
        nome: 'Gestor Auditoria 33f.1',
        email: emailGestor,
        senha_hash: hash,
        perfil: 'GESTOR',
        ativo: true,
      })
    );
    opCriado = await userRepo.save(
      userRepo.create({
        nome: 'Operador Teste 33f.1',
        email: emailOp,
        senha_hash: hash,
        perfil: 'OPERADOR',
        ativo: true,
      })
    );

    const loginG = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailGestor, senha: senhaLogin }),
    });
    const tokenG = (await loginG.json()).token;
    const gestorHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenG}`,
    };

    const loginO = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailOp, senha: senhaLogin }),
    });
    const tokenO = (await loginO.json()).token;
    const opHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenO}`,
    };

    // Garantir modo manual (ML desconectado — DoD #34)
    await fetch(`${BASE_URL}/ml/desconectar`, { method: 'POST', headers: gestorHeaders }).catch(() => null);
    const mlStatusRes = await fetch(`${BASE_URL}/ml/status`, { headers: gestorHeaders });
    const mlStatus = await mlStatusRes.json();
    assert(
      mlStatus.conectado === false ||
        mlStatus.estado_integracao === 'desconectado' ||
        mlStatus.modo_manual === true,
      '[DoD #34] Sistema em modo manual (Mercado Livre desconectado)'
    );

    // Backup emitente fiscal existente
    emitenteBackup = await emitRepo
      .createQueryBuilder('e')
      .addSelect(['e.certificado_arquivo_enc', 'e.senha_certificado_enc'])
      .getOne();
    emitenteCriado = !emitenteBackup;

    const cnpjEmit = '11222333000181';
    const senhaPfx = 'RezFireA1#33f1';
    const pfxBuf = gerarPkcs12Teste({
      cnpj: cnpjEmit,
      razao: 'REZFIRE EXTINTORES LTDA',
      diasInicio: -10,
      diasFim: 180,
      senha: senhaPfx,
    });

    await fetch(`${BASE_URL}/fiscal/emitente`, {
      method: 'PUT',
      headers: gestorHeaders,
      body: JSON.stringify({
        razao_social: 'REZFIRE EXTINTORES LTDA',
        nome_fantasia: 'RezFire',
        cnpj: cnpjEmit,
        inscricao_estadual: '110042490114',
        regime_tributario: '1',
        logradouro: 'Rua das Mangueiras',
        numero: '123',
        bairro: 'Centro',
        municipio: 'São Paulo',
        codigo_municipio_ibge: '3550308',
        uf: 'SP',
        cep: '01001000',
        ambiente: 'homologacao',
        serie_nfe: 1,
        proximo_numero_nfe: 9500,
      }),
    });

    const form = new FormData();
    form.append('certificado', new Blob([pfxBuf], { type: 'application/x-pkcs12' }), 'teste33f1.pfx');
    form.append('senha', senhaPfx);
    const upRes = await fetch(`${BASE_URL}/fiscal/emitente/certificado`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenG}` },
      body: form,
    });
    assert(upRes.status === 200, 'Certificado A1 de teste instalado com sucesso');

    const prodRes = await fetch(`${BASE_URL}/produtos`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        sku: `EXT-33F1-${Date.now()}`,
        nome: 'Extintor ABC 4kg Teste 33f.1',
        descricao: 'Extintor para teste de cancelamento NF-e',
        preco: 320.0,
        custo: 170.0,
        categoria: 'Extintores',
        ncm: '84241000',
        cfop: '5102',
        origem_mercadoria: '0',
        cst_csosn: '102',
        unidade_comercial: 'UN',
      }),
    });
    produtoCriado = (await prodRes.json()).produto;
    await estRepo.update({ id_produto: produtoCriado.id_produto }, { quantidade_atual: 50 });

    // 2. Criar Pedido 1, preparar (assinada) e verificar que cancelamento NÃO é permitido antes da autorização
    const ped1 = await criarPedidoTeste(gestorHeaders, produtoCriado.id_produto, 'P1');
    pedidosCriados.push(ped1.id_pedido);

    const prep1 = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    });
    const prep1Json = await prep1.json();
    assert(
      (prep1.status === 200 || prep1.status === 201) && prep1Json.nota_fiscal?.status === 'assinada',
      'Pedido 1 preparado com NF-e assinada'
    );

    const getAssinada = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/nfe`, { headers: gestorHeaders })).json();
    assert(
      getAssinada.cancelamento_info?.aplicavel === false && getAssinada.cancelamento_info?.permitido === false,
      '[Critério 1] NF-e apenas assinada (não autorizada) não habilita cancelamento'
    );

    // Autorizar NF-e 1
    const tx1 = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    });
    const tx1Json = await tx1.json();
    assert(tx1.status === 200 && tx1Json.autorizada === true, 'NF-e 1 autorizada na SEFAZ (homologação simulada)');
    if (tx1Json.nota_fiscal?.xml_autorizado_path) {
      arquivosXmlCriados.push(path.join(env.FISCAL_XML_ARCHIVE_DIR, tx1Json.nota_fiscal.xml_autorizado_path));
    }
    const numeroNf1 = Number(tx1Json.nota_fiscal.numero);

    // Critério 1: verificar prazo restante retornado antes de confirmar
    const getAut1 = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/nfe`, { headers: gestorHeaders })).json();
    assert(
      getAut1.cancelamento_info?.aplicavel === true &&
        getAut1.cancelamento_info?.permitido === true &&
        getAut1.cancelamento_info?.prazo_normal_horas === 24 &&
        getAut1.cancelamento_info?.horas_restantes >= 23 &&
        typeof getAut1.cancelamento_info?.prazo_restante_texto === 'string' &&
        getAut1.cancelamento_info.prazo_restante_texto.includes('Restam'),
      '[Critério 1] NF-e autorizada retorna prazo restante exato de cancelamento normal (24h) antes de confirmar'
    );

    // RBAC: OPERADOR bloqueado de cancelar
    const opCancelRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: opHeaders,
      body: JSON.stringify({ justificativa: 'Tentativa de cancelamento por operador sem permissão' }),
    });
    assert(opCancelRes.status === 403, '[RBAC] Perfil OPERADOR recebe HTTP 403 ao tentar cancelar NF-e');

    // Critério 2: Justificativa obrigatória (< 15 chars rejeitada)
    const justCurtaRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ justificativa: 'Curta demais' }),
    });
    assert(justCurtaRes.status === 400, '[Critério 2] Justificativa menor que 15 caracteres é rejeitada com HTTP 400');

    // Critério 3: Rejeição SEFAZ mantém NF-e autorizada e informa motivo
    const rejCancelRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        justificativa: 'Teste de rejeição simulada na SEFAZ antes do cancelamento efetivo',
        cenario_teste: 'rejeicao',
        cstat_simulado: '501',
        xmotivo_simulado: 'Rejeicao: Prazo de cancelamento superior ao previsto na Legislacao',
      }),
    });
    const rejCancelJson = await rejCancelRes.json();
    assert(
      rejCancelRes.status === 200 &&
        rejCancelJson.registrado === false &&
        rejCancelJson.nota_fiscal?.status === 'autorizada' &&
        String(rejCancelJson.mensagem || '').includes('501'),
      '[Critério 3] Rejeição SEFAZ informa motivo (cStat 501) e mantém NF-e com status autorizada'
    );

    // Critérios 3, 4 e 7: Cancelamento aceito na SEFAZ, XML guardado e auditoria completa (quem/quando/justificativa)
    const justificativaValida = 'Erro de digitação nos dados da operação antes da expedição do pedido.';
    const okCancelRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ justificativa: justificativaValida }),
    });
    const okCancelJson = await okCancelRes.json();
    assert(
      okCancelRes.status === 200 &&
        okCancelJson.registrado === true &&
        okCancelJson.nota_fiscal?.status === 'cancelada' &&
        Boolean(okCancelJson.nota_fiscal?.protocolo_cancelamento),
      '[Critérios 3 e 4] Cancelamento aceito pela SEFAZ atualiza status fiscal para "cancelada" com protocolo'
    );
    assert(
      okCancelJson.cancelamento_auditoria?.id_usuario === gestorCriado.id_usuario &&
        okCancelJson.cancelamento_auditoria?.usuario_nome === 'Gestor Auditoria 33f.1' &&
        Boolean(okCancelJson.cancelamento_auditoria?.data_evento) &&
        okCancelJson.cancelamento_auditoria?.justificativa === justificativaValida,
      '[Critério 7] Auditoria do cancelamento registra quem fez (usuario_nome), quando (data_evento) e justificativa'
    );

    const xmlEvtPath = okCancelJson.evento?.xml_evento_path;
    const absXmlEvt = xmlEvtPath ? path.join(env.FISCAL_XML_ARCHIVE_DIR, xmlEvtPath) : null;
    if (absXmlEvt) arquivosXmlCriados.push(absXmlEvt);
    assert(Boolean(absXmlEvt && fs.existsSync(absXmlEvt)), '[Critério 4] XML procEventoNFe arquivado em disco');

    const dlEvtRes = await fetch(`${BASE_URL}/fiscal/eventos/${okCancelJson.evento.id_evento}/xml`, {
      headers: gestorHeaders,
    });
    const dlEvtBody = await dlEvtRes.text();
    assert(
      dlEvtRes.status === 200 && dlEvtBody.includes('procEventoNFe') && dlEvtBody.includes('110111'),
      '[Critério 4] Download do XML do evento de cancelamento retorna procEventoNFe válido'
    );

    // Critério 6: Reemissão de uma nova NF-e no mesmo pedido após o cancelamento
    const reemRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ regerar: true }),
    });
    const reemJson = await reemRes.json();
    assert(
      (reemRes.status === 200 || reemRes.status === 201) &&
        reemJson.reemissao_apos_cancelamento === true &&
        reemJson.nota_fiscal?.status === 'assinada' &&
        Number(reemJson.nota_fiscal?.numero) > numeroNf1,
      '[Critério 6] Após cancelamento, pedido aceita nova NF-e com novo número sequencial preservando a cancelada'
    );

    const tx2 = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    });
    const tx2Json = await tx2.json();
    assert(tx2.status === 200 && tx2Json.autorizada === true, '[Critério 6] Nova NF-e do mesmo pedido autorizada na SEFAZ');
    if (tx2Json.nota_fiscal?.xml_autorizado_path) {
      arquivosXmlCriados.push(path.join(env.FISCAL_XML_ARCHIVE_DIR, tx2Json.nota_fiscal.xml_autorizado_path));
    }

    const getAposReem = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/nfe`, { headers: gestorHeaders })).json();
    assert(
      getAposReem.status_fiscal === 'autorizada' &&
        Array.isArray(getAposReem.historico_notas) &&
        getAposReem.historico_notas.length === 2 &&
        getAposReem.historico_notas.some((h) => h.status === 'cancelada') &&
        getAposReem.eventos.some((e) => e.tipo_evento === 'cancelamento' && e.usuario_nome === 'Gestor Auditoria 33f.1'),
      '[Critérios 6 e 7] Histórico do pedido preserva a NF-e cancelada e a auditoria (usuario_nome) após nova emissão'
    );

    // Critério 5a: Fora do prazo normal (> 24h, dentro das 480h da SEFAZ-SP)
    const ped2 = await criarPedidoTeste(gestorHeaders, produtoCriado.id_produto, 'PRAZO');
    pedidosCriados.push(ped2.id_pedido);
    await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    });
    const txP2 = await (
      await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/transmitir-nfe`, {
        method: 'POST',
        headers: gestorHeaders,
        body: JSON.stringify({ cenario_teste: 'autorizada' }),
      })
    ).json();
    if (txP2.nota_fiscal?.xml_autorizado_path) {
      arquivosXmlCriados.push(path.join(env.FISCAL_XML_ARCHIVE_DIR, txP2.nota_fiscal.xml_autorizado_path));
    }
    // Retroagir autorizada_em em 30 horas (fora das 24h normais, dentro das 480h extemporâneas)
    await nfRepo.update(
      { id_nota_fiscal: txP2.nota_fiscal.id_nota_fiscal },
      { autorizada_em: new Date(Date.now() - 30 * 3600000) }
    );

    const getPrazoExp = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/nfe`, { headers: gestorHeaders })).json();
    assert(
      getPrazoExp.cancelamento_info?.permitido === false &&
        getPrazoExp.cancelamento_info?.codigo_bloqueio === 'PRAZO_NORMAL_EXPIRADO' &&
        getPrazoExp.cancelamento_info?.dentro_prazo_extemporaneo === true &&
        String(getPrazoExp.cancelamento_info?.orientacao_extemporaneo || '').toLowerCase().includes('extemporâneo') &&
        String(getPrazoExp.cancelamento_info?.orientacao_extemporaneo || '').includes('480'),
      '[Critério 5] GET /nfe sinaliza prazo normal expirado e orienta cancelamento extemporâneo na SEFAZ-SP (480h, fora do sistema)'
    );

    const blkPrazoRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped2.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ justificativa: 'Tentativa de cancelamento após 30 horas da autorização' }),
    });
    const blkPrazoJson = await blkPrazoRes.json();
    assert(
      blkPrazoRes.status === 422 &&
        blkPrazoJson.codigo_bloqueio === 'PRAZO_NORMAL_EXPIRADO' &&
        String(blkPrazoJson.orientacao_extemporaneo || '').toLowerCase().includes('fora do sistema'),
      '[Critério 5] POST /cancelar-nfe bloqueia com HTTP 422 fora do prazo normal e retorna orientação de cancelamento extemporâneo'
    );

    // Critério 5b: Mercadoria já saiu (status_entrega = 'Despachado')
    const ped3 = await criarPedidoTeste(gestorHeaders, produtoCriado.id_produto, 'SAIU');
    pedidosCriados.push(ped3.id_pedido);
    await fetch(`${BASE_URL}/fiscal/pedidos/${ped3.id_pedido}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    });
    const txP3 = await (
      await fetch(`${BASE_URL}/fiscal/pedidos/${ped3.id_pedido}/transmitir-nfe`, {
        method: 'POST',
        headers: gestorHeaders,
        body: JSON.stringify({ cenario_teste: 'autorizada' }),
      })
    ).json();
    if (txP3.nota_fiscal?.xml_autorizado_path) {
      arquivosXmlCriados.push(path.join(env.FISCAL_XML_ARCHIVE_DIR, txP3.nota_fiscal.xml_autorizado_path));
    }
    await pedRepo.update({ id_pedido: ped3.id_pedido }, { status_entrega: 'Despachado' });

    const blkSaiuRes = await fetch(`${BASE_URL}/fiscal/pedidos/${ped3.id_pedido}/cancelar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ justificativa: 'Tentativa de cancelamento após despacho físico da mercadoria' }),
    });
    const blkSaiuJson = await blkSaiuRes.json();
    assert(
      blkSaiuRes.status === 422 &&
        blkSaiuJson.codigo_bloqueio === 'MERCADORIA_SAIU' &&
        String(blkSaiuJson.orientacao_extemporaneo || '').toLowerCase().includes('sefaz-sp'),
      '[Critério 5] POST /cancelar-nfe bloqueia com HTTP 422 quando mercadoria já saiu (Despachado) e orienta o gestor'
    );
  } finally {
    // Limpeza completa de dados e arquivos de teste
    for (const abs of arquivosXmlCriados) {
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {}
    }

    if (pedidosCriados.length > 0) {
      const nfs = await nfRepo
        .createQueryBuilder('nf')
        .where('nf.id_pedido IN (:...ids)', { ids: pedidosCriados })
        .getMany();
      const nfIds = nfs.map((n) => n.id_nota_fiscal);
      if (nfIds.length > 0) {
        await evtRepo.createQueryBuilder().delete().where('id_nota_fiscal IN (:...nfIds)', { nfIds }).execute();
        await txRepo.createQueryBuilder().delete().where('id_nota_fiscal IN (:...nfIds)', { nfIds }).execute();
        await nfRepo.createQueryBuilder().delete().where('id_nota_fiscal IN (:...nfIds)', { nfIds }).execute();
      }
      await pedRepo.createQueryBuilder().delete().where('id_pedido IN (:...ids)', { ids: pedidosCriados }).execute();
    }

    if (produtoCriado) {
      await movRepo.delete({ id_produto: produtoCriado.id_produto });
      await estRepo.delete({ id_produto: produtoCriado.id_produto });
      await prodRepo.delete({ id_produto: produtoCriado.id_produto });
    }

    if (emitenteCriado) {
      await emitRepo.createQueryBuilder().delete().execute();
    } else if (emitenteBackup) {
      await emitRepo.save(emitenteBackup);
    }

    if (gestorCriado) await userRepo.delete({ id_usuario: gestorCriado.id_usuario });
    if (opCriado) await userRepo.delete({ id_usuario: opCriado.id_usuario });

    await AppDataSource.destroy();
  }

  console.log('\n====================================================================');
  console.log(`📊 RESULTADO STORY 33f.1: ${passed}/${passed + failed} testes passaram (${failed} falhas)`);
  console.log('====================================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Erro fatal nos testes 33f.1:', err);
  process.exit(1);
});
