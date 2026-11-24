/**
 * unit_test_carta_correcao_33f2.mjs
 * Teste automatizado de aceite da User Story 33f.2 (Corrigir NF-e por carta de correção).
 *
 * Critérios validados:
 * 1. Ação "Corrigir NF-e" só é permitida para notas autorizadas, nunca para notas canceladas (nem assinadas).
 * 2. Metadados e validações avisam os campos proibidos (valores, impostos, remetente, destinatário, datas)
 *    e orientam cancelar e reemitir uma nova NF-e quando o erro estiver nessa lista.
 * 3. Gestor envia texto da correção à SEFAZ e recebe resultado claro (rejeição ou aceite com protocolo).
 * 4. Múltiplas cartas na mesma nota com sequência (#1, #2, #3) e histórico visível no pedido (com responsável).
 * 5. Fora do prazo permitido (> 720h / 30 dias), sistema bloqueia com HTTP 422 e explica o motivo.
 * 6. XML procEventoNFe de cada carta fica arquivado em disco e baixável via API.
 * 7. (DoD) Funciona integralmente sem a conta do Mercado Livre conectada (modo manual, #34) + RBAC.
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
  cert.serialNumber = '09ABCDEF33F202';
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
    friendlyName: 'RezFireTeste33f2A1',
  });
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
}

async function criarPedidoTeste(gestorHeaders, idProdutoTeste, sufixo) {
  const res = await fetch(`${BASE_URL}/pedidos`, {
    method: 'POST',
    headers: gestorHeaders,
    body: JSON.stringify({
      codigo_pedido: `PED-33F2-${sufixo}-${Date.now()}`,
      cliente_nome: `Comprador Teste 33f.2 ${sufixo}`,
      origem: 'Venda Direta',
      modalidade_envio: 'Logística Própria',
      destinatario_documento: '45997418000153',
      destinatario_ie: '110042490114',
      destinatario_cep: '01310100',
      destinatario_logradouro: 'Av Paulista',
      destinatario_numero: '700',
      destinatario_bairro: 'Bela Vista',
      destinatario_municipio: 'São Paulo',
      destinatario_codigo_municipio_ibge: '3550308',
      destinatario_uf: 'SP',
      destinatario_email: 'compras@teste33f2.com.br',
      itens: [{ id_produto: idProdutoTeste, quantidade: 2, preco_unitario: 310.0 }],
    }),
  });
  return (await res.json()).pedido;
}

async function runTests() {
  console.log('\n====================================================================');
  console.log('🧪 TESTES AUTOMATIZADOS — STORY 33f.2 (Corrigir NF-e por CC-e)');
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

  const emailGestor = `gestor.33f2.${Date.now()}@rezfire.local`;
  const emailOp = `operador.33f2.${Date.now()}@rezfire.local`;
  const senhaLogin = 'Senha33f2#2026';
  const hash = await bcrypt.hash(senhaLogin, 10);

  let gestorCriado = null;
  let opCriado = null;
  let emitenteBackup = null;
  let emitenteCriado = false;
  let produtoCriado = null;
  const pedidosCriados = [];
  const arquivosXmlCriados = [];

  try {
    gestorCriado = await userRepo.save(
      userRepo.create({
        nome: 'Gestor CC-e 33f.2',
        email: emailGestor,
        senha_hash: hash,
        perfil: 'GESTOR',
        ativo: true,
      })
    );
    opCriado = await userRepo.save(
      userRepo.create({
        nome: 'Operador Teste 33f.2',
        email: emailOp,
        senha_hash: hash,
        perfil: 'OPERADOR',
        ativo: true,
      })
    );

    const tokenG = (
      await (
        await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailGestor, senha: senhaLogin }),
        })
      ).json()
    ).token;
    const gestorHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenG}` };

    const tokenO = (
      await (
        await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailOp, senha: senhaLogin }),
        })
      ).json()
    ).token;
    const opHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenO}` };

    // DoD #34: garantir modo manual (ML desconectado)
    await fetch(`${BASE_URL}/ml/desconectar`, { method: 'POST', headers: gestorHeaders }).catch(() => null);
    const mlStatus = await (await fetch(`${BASE_URL}/ml/status`, { headers: gestorHeaders })).json();
    assert(
      mlStatus.conectado === false || mlStatus.estado_integracao === 'desconectado' || mlStatus.modo_manual === true,
      '[DoD #34] Sistema em modo manual (Mercado Livre desconectado)'
    );

    emitenteBackup = await emitRepo
      .createQueryBuilder('e')
      .addSelect(['e.certificado_arquivo_enc', 'e.senha_certificado_enc'])
      .getOne();
    emitenteCriado = !emitenteBackup;

    const cnpjEmit = '11222333000181';
    const senhaPfx = 'RezFireA1#33f2';
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
        proximo_numero_nfe: 9600,
      }),
    });

    const form = new FormData();
    form.append('certificado', new Blob([pfxBuf], { type: 'application/x-pkcs12' }), 'teste33f2.pfx');
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
        sku: `EXT-33F2-${Date.now()}`,
        nome: 'Extintor PQS 6kg Teste 33f.2',
        descricao: 'Extintor para teste de Carta de Correção',
        preco: 310.0,
        custo: 160.0,
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

    // 1. Criar Pedido 1, preparar (assinada) e verificar que CC-e NÃO é aplicável antes da autorização
    const ped1 = await criarPedidoTeste(gestorHeaders, produtoCriado.id_produto, 'CCE');
    pedidosCriados.push(ped1.id_pedido);
    await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    });
    const getAssinada = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/nfe`, { headers: gestorHeaders })).json();
    assert(
      getAssinada.carta_correcao_info?.aplicavel === false && getAssinada.carta_correcao_info?.permitido === false,
      '[Critério 1] NF-e apenas assinada (não autorizada) não habilita Carta de Correção'
    );

    // Autorizar NF-e 1
    const tx1 = await (
      await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/transmitir-nfe`, {
        method: 'POST',
        headers: gestorHeaders,
        body: JSON.stringify({ cenario_teste: 'autorizada' }),
      })
    ).json();
    if (tx1.nota_fiscal?.xml_autorizado_path) {
      arquivosXmlCriados.push(path.join(env.FISCAL_XML_ARCHIVE_DIR, tx1.nota_fiscal.xml_autorizado_path));
    }
    assert(tx1.autorizada === true, 'NF-e 1 autorizada na SEFAZ');

    // Critérios 1 e 2: verificar metadados de CC-e (prazo 720h, campos proibidos, orientação cancelar/reemitir)
    const getAut1 = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/nfe`, { headers: gestorHeaders })).json();
    assert(
      getAut1.carta_correcao_info?.aplicavel === true &&
        getAut1.carta_correcao_info?.permitido === true &&
        getAut1.carta_correcao_info?.prazo_limite_horas === 720 &&
        getAut1.carta_correcao_info?.proxima_sequencia === 1 &&
        Array.isArray(getAut1.carta_correcao_info?.campos_proibidos) &&
        getAut1.carta_correcao_info.campos_proibidos.length >= 4 &&
        String(getAut1.carta_correcao_info?.orientacao_erro_proibido || '').toLowerCase().includes('cancele'),
      '[Critérios 1 e 2] GET /nfe retorna carta_correcao_info com prazo 720h, lista de campos proibidos e orientação para cancelar/reemitir'
    );

    // RBAC: OPERADOR bloqueado com 403
    const opCce = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: opHeaders,
      body: JSON.stringify({
        tipo_correcao: 'endereco_observacao',
        texto_correcao: 'Tentativa de registro de CC-e por perfil operador sem permissão.',
      }),
    });
    assert(opCce.status === 403, '[RBAC] Perfil OPERADOR recebe HTTP 403 ao tentar registrar CC-e');

    // Critério 2: bloqueio de campo proibido (valor/imposto/destinatário/data) com orientação cancelar e reemitir
    const blkTipo = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        tipo_correcao: 'valor_imposto',
        texto_correcao: 'Ajuste de observação complementar referente ao faturamento.',
      }),
    });
    const blkTipoJson = await blkTipo.json();
    assert(
      blkTipo.status === 422 &&
        blkTipoJson.codigo_bloqueio === 'CAMPO_PROIBIDO_CCE' &&
        String(blkTipoJson.mensagem || '').toLowerCase().includes('nova nota'),
      '[Critério 2] Tipo de correção proibido (valor/imposto) bloqueado com HTTP 422 e orientação de cancelar e reemitir'
    );

    const blkTexto = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        tipo_correcao: 'endereco_observacao',
        texto_correcao: 'Solicito alterar o valor total da nota fiscal e a data de emissão.',
      }),
    });
    const blkTextoJson = await blkTexto.json();
    assert(
      blkTexto.status === 422 &&
        blkTextoJson.codigo_bloqueio === 'CAMPO_PROIBIDO_CCE' &&
        String(blkTextoJson.mensagem || '').toLowerCase().includes('cancele'),
      '[Critério 2] Texto tentando alterar valor/data bloqueado com HTTP 422 e orientação de cancelar e reemitir'
    );

    // Critério 3: Rejeição simulada na SEFAZ informa motivo e não avança sequência
    const rejCce = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        tipo_correcao: 'endereco_observacao',
        texto_correcao: 'Complemento de endereço de entrega: Bloco B, Portaria 2.',
        cenario_teste: 'rejeicao',
        cstat_simulado: '594',
        xmotivo_simulado: 'Rejeicao: O numero de sequencia do evento informado e maior que o permitido',
      }),
    });
    const rejCceJson = await rejCce.json();
    assert(
      rejCce.status === 200 &&
        rejCceJson.registrado === false &&
        String(rejCceJson.mensagem || '').includes('594') &&
        rejCceJson.carta_correcao_info?.proxima_sequencia === 1,
      '[Critério 3] Rejeição SEFAZ informa motivo (cStat 594) e mantém próxima sequência em #1'
    );

    // Critérios 3, 4 e 6: Registrar 3 cartas de correção sequenciais (#1, #2, #3), verificar histórico e XMLs
    const textosCce = [
      'Complemento de endereço do destinatário: Condomínio Empresarial Bloco B, Sala 204.',
      'Dados de transporte: Transportadora Rápido Fogo LTDA, volume 2 caixas, peso bruto 14 kg.',
      'Observação adicional: entregar em horário comercial das 08h às 17h na doca principal.',
    ];
    const idsEventosCce = [];
    for (let i = 0; i < textosCce.length; i++) {
      const resCce = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
        method: 'POST',
        headers: gestorHeaders,
        body: JSON.stringify({
          tipo_correcao: i === 1 ? 'transporte' : 'endereco_observacao',
          texto_correcao: textosCce[i],
        }),
      });
      const jsonCce = await resCce.json();
      assert(
        resCce.status === 200 &&
          jsonCce.registrado === true &&
          jsonCce.evento?.sequencia === i + 1 &&
          jsonCce.evento?.usuario_nome === 'Gestor CC-e 33f.2' &&
          Boolean(jsonCce.evento?.protocolo_evento),
        `[Critérios 3 e 4] CC-e #${i + 1} registrada com protocolo e responsável (usuario_nome)`
      );
      idsEventosCce.push(jsonCce.evento.id_evento);
      const xmlPath = jsonCce.evento?.xml_evento_path;
      const absXml = xmlPath ? path.join(env.FISCAL_XML_ARCHIVE_DIR, xmlPath) : null;
      if (absXml) arquivosXmlCriados.push(absXml);
      assert(Boolean(absXml && fs.existsSync(absXml)), `[Critério 6] XML procEventoNFe da CC-e #${i + 1} arquivado em disco`);
    }

    // Download do XML da CC-e #2 e conferência do histórico completo no pedido
    const dlCce2 = await fetch(`${BASE_URL}/fiscal/eventos/${idsEventosCce[1]}/xml`, { headers: gestorHeaders });
    const dlCce2Text = await dlCce2.text();
    assert(
      dlCce2.status === 200 &&
        dlCce2Text.includes('procEventoNFe') &&
        dlCce2Text.includes('110110') &&
        dlCce2Text.includes('Transportadora'),
      '[Critério 6] Download XML da CC-e #2 retorna procEventoNFe válido com tpEvento 110110'
    );

    const getApos3 = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/nfe`, { headers: gestorHeaders })).json();
    const ccesRegistradas = (getApos3.cartas_correcao || []).filter((e) => e.status === 'registrado');
    assert(
      ccesRegistradas.length === 3 &&
        ccesRegistradas.map((e) => e.sequencia).sort((a, b) => a - b).join(',') === '1,2,3' &&
        getApos3.carta_correcao_info?.proxima_sequencia === 4,
      '[Critério 4] Histórico de CC-e no pedido lista sequências 1, 2 e 3 e aponta próxima sequência #4'
    );

    // Critério 5: Fora do prazo permitido (> 720h / 30 dias) bloqueia e explica o motivo
    await nfRepo.update(
      { id_nota_fiscal: tx1.nota_fiscal.id_nota_fiscal },
      { autorizada_em: new Date(Date.now() - 750 * 3600000) }
    );
    const getExp = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/nfe`, { headers: gestorHeaders })).json();
    assert(
      getExp.carta_correcao_info?.permitido === false &&
        getExp.carta_correcao_info?.codigo_bloqueio === 'PRAZO_CCE_EXPIRADO',
      '[Critério 5] GET /nfe sinaliza PRAZO_CCE_EXPIRADO quando excede 720h (30 dias)'
    );
    const blkExp = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        tipo_correcao: 'endereco_observacao',
        texto_correcao: 'Tentativa de carta de correção após expirar o prazo de 720 horas.',
      }),
    });
    const blkExpJson = await blkExp.json();
    assert(
      blkExp.status === 422 &&
        blkExpJson.codigo_bloqueio === 'PRAZO_CCE_EXPIRADO' &&
        String(blkExpJson.mensagem || '').includes('720h'),
      '[Critério 5] POST /carta-correcao bloqueia com HTTP 422 fora do prazo (720h) explicando o motivo'
    );

    // Critério 1 (nota cancelada): restaurar prazo, cancelar nota e confirmar que CC-e NUNCA aparece/funciona em cancelada
    await nfRepo.update({ id_nota_fiscal: tx1.nota_fiscal.id_nota_fiscal }, { autorizada_em: new Date() });
    const cancelRes = await (
      await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/cancelar-nfe`, {
        method: 'POST',
        headers: gestorHeaders,
        body: JSON.stringify({ justificativa: 'Cancelamento para validar bloqueio de CC-e em nota cancelada.' }),
      })
    ).json();
    if (cancelRes.evento?.xml_evento_path) {
      arquivosXmlCriados.push(path.join(env.FISCAL_XML_ARCHIVE_DIR, cancelRes.evento.xml_evento_path));
    }
    const getCanc = await (await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/nfe`, { headers: gestorHeaders })).json();
    assert(
      getCanc.status_fiscal === 'cancelada' &&
        getCanc.carta_correcao_info?.aplicavel === false &&
        getCanc.carta_correcao_info?.codigo_bloqueio === 'STATUS_CANCELADA',
      '[Critério 1] NF-e cancelada desabilita completamente a ação Corrigir NF-e (STATUS_CANCELADA)'
    );
    const cceEmCancelada = await fetch(`${BASE_URL}/fiscal/pedidos/${ped1.id_pedido}/carta-correcao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        tipo_correcao: 'endereco_observacao',
        texto_correcao: 'Tentativa indevida de enviar carta de correção para NF-e cancelada.',
      }),
    });
    assert(cceEmCancelada.status === 400, '[Critério 1] POST /carta-correcao rejeita NF-e cancelada com HTTP 400');
  } finally {
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
  console.log(`📊 RESULTADO STORY 33f.2: ${passed}/${passed + failed} testes passaram (${failed} falhas)`);
  console.log('====================================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Erro fatal nos testes 33f.2:', err);
  process.exit(1);
});

