/**
 * unit_test_certificado_vencimento_33g.mjs
 * Suíte de testes automatizados para a User Story 33g:
 *  - Identificação da data de validade e dias restantes do Certificado Digital A1
 *  - Alerta com antecedência definida (padrão 30 dias) integrado à Central de Alertas (#19) e Notificações (#32)
 *  - Bloqueio claro de emissão, transmissão e eventos de NF-e quando o certificado está vencido
 *  - Substituição do certificado A1 sem apagar o histórico de notas emitidas (XMLs, DANFE e protocolos preservados)
 */

import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirnameURLToPath
  ? path.dirname(path.dirnameURLToPath(import.meta.url))
  : path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../../backend');
const requireBackend = createRequire(path.join(backendDir, 'package.json'));
const forge = requireBackend('node-forge');
const mysql = requireBackend('mysql2/promise');
const jwt = requireBackend('jsonwebtoken');
const dotenv = requireBackend('dotenv');

dotenv.config({ path: path.join(backendDir, '.env') });

const API_URL = `http://localhost:${process.env.PORT || 3001}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'rezfire_default_secret_key_2026';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${msg}`);
    failed++;
  }
}

function gerarPfxTeste({ cnpj, senha, razaoSocial, notBefore, notAfter, serialHex }) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = serialHex || '330701';
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;

  const attrs = [
    { name: 'commonName', value: `${razaoSocial}:${cnpj}` },
    { name: 'organizationName', value: razaoSocial },
    { name: 'countryName', value: 'BR' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer([
    { name: 'commonName', value: 'AC ICP-Brasil Homologacao 33g' },
    { name: 'organizationName', value: 'ICP-Brasil' },
    { name: 'countryName', value: 'BR' },
  ]);
  cert.setExtensions([{ name: 'basicConstraints', cA: false }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], senha, {
    algorithm: '3des',
    friendlyName: 'RezFire e-CNPJ A1',
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, 'binary');
}

async function apiReq(endpoint, token, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const resp = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const text = await resp.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: resp.status, headers: resp.headers, data, text };
}

async function enviarPfx(token, pfxBuf, senha, filename = 'cert-33g.pfx') {
  const fd = new FormData();
  fd.append('certificado', new Blob([pfxBuf], { type: 'application/x-pkcs12' }), filename);
  fd.append('senha', senha);
  return apiReq('/fiscal/emitente/certificado', token, {
    method: 'POST',
    body: fd,
  });
}

async function run() {
  console.log('🧪 Iniciando Testes Automatizados da Story 33g (Alerta de Vencimento do Certificado Digital A1)...\n');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'RezFireDB',
  });

  let emitenteOriginal = null;
  let produtoTesteId = null;
  const pedidosCriadosIds = [];
  const caminhosXmlCriados = [];

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // Passo 1: Autenticação e snapshot do emitente original
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Passo 1: Preparando tokens RBAC e snapshot do emitente fiscal...');
    const [users] = await conn.query(
      `SELECT id_usuario, nome, email, perfil FROM usuarios WHERE ativo = 1 ORDER BY id_usuario ASC`
    );
    const gestorUser = users.find((u) => u.perfil === 'GESTOR') || {
      id_usuario: 1,
      nome: 'Gestor Teste',
      email: 'admin@rezfire.com',
      perfil: 'GESTOR',
    };
    const tokenGestor = jwt.sign(
      {
        id_usuario: gestorUser.id_usuario,
        nome: gestorUser.nome,
        email: gestorUser.email,
        perfil: 'GESTOR',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const tokenOperador = jwt.sign(
      {
        id_usuario: 9999,
        nome: 'Operador Teste',
        email: 'operador@rezfire.com',
        perfil: 'OPERADOR',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const [emRows] = await conn.query(`SELECT * FROM emitente_fiscal LIMIT 1`);
    emitenteOriginal = emRows[0] || null;

    const cnpjEmitente = emitenteOriginal?.cnpj || '11222333000181';
    if (!emitenteOriginal) {
      await apiReq('/fiscal/emitente', tokenGestor, {
        method: 'PUT',
        body: JSON.stringify({
          razao_social: 'RezFire Equipamentos Contra Incendio Ltda',
          nome_fantasia: 'RezFire',
          cnpj: cnpjEmitente,
          inscricao_estadual: '110042490114',
          regime_tributario: '1',
          cep: '01001000',
          logradouro: 'Praca da Se',
          numero: '100',
          bairro: 'Se',
          municipio: 'Sao Paulo',
          codigo_municipio_ibge: '3550308',
          uf: 'SP',
          serie_nfe: 1,
          proximo_numero_nfe: 1,
          ambiente: 'homologacao',
        }),
      });
    } else if (emitenteOriginal.ambiente !== 'homologacao') {
      await conn.query(
        `UPDATE emitente_fiscal SET ambiente = 'homologacao' WHERE id_emitente = ?`,
        [emitenteOriginal.id_emitente]
      );
    }

    // RBAC em /api/fiscal/certificado/status
    const rbacRes = await apiReq('/fiscal/certificado/status', tokenOperador);
    assert(rbacRes.status === 403, 'RBAC: OPERADOR bloqueado (HTTP 403) ao consultar /api/fiscal/certificado/status');

    // ─────────────────────────────────────────────────────────────────────────
    // Passo 2: Critério 1 — Instalar certificado com validade ampla (120 dias) e emitir 1 NF-e histórica
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nPasso 2: Instalando certificado A1 válido (120 dias) e emitindo NF-e para compor o histórico...');
    const agora = Date.now();
    const pfx120d = gerarPfxTeste({
      cnpj: cnpjEmitente,
      senha: 'SenhaCert120d!',
      razaoSocial: 'RezFire Equipamentos Contra Incendio Ltda',
      notBefore: new Date(agora - 10 * 86400000),
      notAfter: new Date(agora + 120 * 86400000),
      serialHex: '3307120a',
    });

    const up120 = await enviarPfx(tokenGestor, pfx120d, 'SenhaCert120d!', 'cert-120d.pfx');
    assert(up120.status === 200 && up120.data.sucesso === true, 'Certificado A1 (120 dias) instalado com sucesso');

    const status120 = await apiReq('/fiscal/certificado/status', tokenGestor);
    assert(
      status120.status === 200 &&
        status120.data.configurado === true &&
        status120.data.status === 'valido' &&
        status120.data.alerta_ativo === false &&
        status120.data.bloqueia_emissao === false &&
        status120.data.dias_restantes >= 119 &&
        Boolean(status120.data.valido_ate),
      `Critério 1: Sistema identifica validade do certificado (${status120.data.dias_restantes} dias restantes, status=valido)`
    );

    const central120 = await apiReq('/alertas/central', tokenGestor);
    assert(
      central120.status === 200 &&
        central120.data.resumo?.por_categoria?.fiscal === 0 &&
        !central120.data.alertas.some((a) => a.categoria === 'fiscal'),
      'Com certificado válido (> 30 dias), nenhum alerta fiscal aparece na Central de Alertas (#19)'
    );

    // Cria produto e pedido #1 para emitir NF-e histórica assinada pelo certificado serial 3307120a
    const [prodInsert] = await conn.query(
      `INSERT INTO produtos (sku, nome, descricao, preco, custo, tipo, ncm, cfop, origem_mercadoria, cst_csosn, unidade_comercial, ativo)
       VALUES (?, ?, 'Extintor teste 33g', 180.00, 95.00, 'Simples', '84241000', '5102', '0', '102', 'UN', 1)`,
      [`EXT-33G-${Date.now()}`, 'Extintor ABC 4kg Teste 33g']
    );
    produtoTesteId = prodInsert.insertId;

    const [ped1Insert] = await conn.query(
      `INSERT INTO pedidos (
        codigo_pedido, origem, status, status_entrega, data_pedido, valor_total,
        cliente_nome, destinatario_documento, destinatario_cep, destinatario_logradouro,
        destinatario_numero, destinatario_bairro, destinatario_municipio, destinatario_codigo_municipio_ibge, destinatario_uf
      ) VALUES (?, 'Venda Direta', 'Confirmado', 'A separar', NOW(), 180.00,
        'Cliente Historico 33g', '52998224725', '01001000', 'Praca da Se', '50', 'Se', 'Sao Paulo', '3550308', 'SP')`,
      [`PED-33G-HIST-${Date.now()}`]
    );
    const pedido1Id = ped1Insert.insertId;
    pedidosCriadosIds.push(pedido1Id);

    await conn.query(
      `INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_unitario, subtotal)
       VALUES (?, ?, 1, 180.00, 180.00)`,
      [pedido1Id, produtoTesteId]
    );

    const prep1 = await apiReq(`/fiscal/pedidos/${pedido1Id}/preparar-nfe`, tokenGestor, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(prep1.status === 201 && prep1.data.sucesso === true, 'NF-e histórica #1 preparada e assinada com certificado inicial');

    const trans1 = await apiReq(`/fiscal/pedidos/${pedido1Id}/transmitir-nfe`, tokenGestor, {
      method: 'POST',
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    });
    assert(
      trans1.status === 200 && trans1.data.autorizada === true,
      `NF-e histórica #1 autorizada na SEFAZ (Protocolo ${trans1.data.nota_fiscal?.protocolo_autorizacao})`
    );
    const nfHistorica = trans1.data.nota_fiscal;
    if (nfHistorica?.xml_autorizado_path) {
      caminhosXmlCriados.push(nfHistorica.xml_autorizado_path);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Passo 3: Critério 2 — Certificado próximo do vencimento (15 dias <= 30 dias) gera alerta no painel (#19) e notificação (#32)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nPasso 3: Testando alerta preventivo de vencimento (15 dias restantes) na Central (#19) e Notificações (#32)...');
    const pfx15d = gerarPfxTeste({
      cnpj: cnpjEmitente,
      senha: 'SenhaCert15d!',
      razaoSocial: 'RezFire Equipamentos Contra Incendio Ltda',
      notBefore: new Date(agora - 350 * 86400000),
      notAfter: new Date(agora + 15 * 86400000),
      serialHex: '3307015b',
    });

    const up15 = await enviarPfx(tokenGestor, pfx15d, 'SenhaCert15d!', 'cert-15d.pfx');
    assert(
      up15.status === 200 &&
        up15.data.emitente?.certificado_status === 'vencendo' &&
        up15.data.emitente?.certificado_alerta_ativo === true &&
        up15.data.emitente?.pronto_para_emissao === true,
      `Critério 2: Certificado com 15 dias restantes entra em status "vencendo" com alerta ativo sem bloquear emissão`
    );

    const central15 = await apiReq('/alertas/central', tokenGestor);
    const alertaVencendo = (central15.data.alertas || []).find(
      (a) => a.categoria === 'fiscal' && a.id.startsWith('fiscal-certificado-vencendo-')
    );
    assert(
      central15.status === 200 &&
        central15.data.resumo?.por_categoria?.fiscal === 1 &&
        Boolean(alertaVencendo) &&
        alertaVencendo.criticidade === 'atencao' &&
        alertaVencendo.acao_url === 'fiscal.html',
      `Critério 2: Alerta preventivo aparece na Central de Alertas (#19) com categoria="fiscal" e criticidade="atencao"`
    );

    const notifRes15 = await apiReq('/notificacoes', tokenGestor);
    const notifVencendo = (notifRes15.data.notificacoes || []).filter(
      (n) => n.tipo === 'CERTIFICADO_VENCENDO' && n.dados_origem?.serial === '3307015b'
    );
    assert(
      notifRes15.status === 200 && notifVencendo.length === 1,
      'DoR #32: Notificação CERTIFICADO_VENCENDO registrada para o gestor'
    );

    // Verifica antirruído (segunda chamada à central não duplica notificação)
    await apiReq('/alertas/central', tokenGestor);
    const notifRes15Dup = await apiReq('/notificacoes', tokenGestor);
    const notifVencendoDup = (notifRes15Dup.data.notificacoes || []).filter(
      (n) => n.tipo === 'CERTIFICADO_VENCENDO' && n.dados_origem?.serial === '3307015b'
    );
    assert(
      notifVencendoDup.length === 1,
      'Antirruído #32: Consulta repetida não duplica a notificação do mesmo certificado'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Passo 4: Critério 3 — Com o certificado vencido, a emissão é bloqueada com mensagem clara
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nPasso 4: Simulando expiração do certificado A1 e verificando bloqueio claro de emissão/transmissão...');
    // Primeiro cria um pedido #2 e prepara a nota enquanto o certificado ainda está válido (para testar também bloqueio na transmissão pós-vencimento)
    const [ped2Insert] = await conn.query(
      `INSERT INTO pedidos (
        codigo_pedido, origem, status, status_entrega, data_pedido, valor_total,
        cliente_nome, destinatario_documento, destinatario_cep, destinatario_logradouro,
        destinatario_numero, destinatario_bairro, destinatario_municipio, destinatario_codigo_municipio_ibge, destinatario_uf
      ) VALUES (?, 'Venda Direta', 'Confirmado', 'A separar', NOW(), 180.00,
        'Cliente Bloqueio 33g', '52998224725', '01001000', 'Praca da Se', '51', 'Se', 'Sao Paulo', '3550308', 'SP')`,
      [`PED-33G-BLQ-${Date.now()}`]
    );
    const pedido2Id = ped2Insert.insertId;
    pedidosCriadosIds.push(pedido2Id);

    await conn.query(
      `INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_unitario, subtotal)
       VALUES (?, ?, 1, 180.00, 180.00)`,
      [pedido2Id, produtoTesteId]
    );

    // Agora expira o certificado cadastrado no banco (vencido há 3 dias)
    const dataVencida3d = new Date(agora - 3 * 86400000);
    await conn.query(
      `UPDATE emitente_fiscal SET certificado_valido_ate = ?, certificado_serial = '3307dead'`,
      [dataVencida3d]
    );

    const statusVencido = await apiReq('/fiscal/certificado/status', tokenGestor);
    assert(
      statusVencido.status === 200 &&
        statusVencido.data.status === 'vencido' &&
        statusVencido.data.bloqueia_emissao === true &&
        statusVencido.data.dias_restantes < 0 &&
        statusVencido.data.mensagem.includes('VENCIDO'),
      `Critério 1 & 3: Status do certificado identifica expiração (${statusVencido.data.dias_restantes}d) e bloqueia_emissao=true`
    );

    const centralVencido = await apiReq('/alertas/central', tokenGestor);
    const alertaVencido = (centralVencido.data.alertas || []).find(
      (a) => a.categoria === 'fiscal' && a.id.startsWith('fiscal-certificado-vencido-')
    );
    assert(
      Boolean(alertaVencido) && alertaVencido.criticidade === 'critico',
      'Critério 2: Certificado vencido gera alerta CRÍTICO na Central de Alertas (#19)'
    );

    const valEmissaoVenc = await apiReq('/fiscal/validar-emissao', tokenGestor, {
      method: 'POST',
      body: JSON.stringify({ id_pedido: pedido2Id }),
    });
    assert(
      valEmissaoVenc.status === 422 &&
        valEmissaoVenc.data.apto === false &&
        valEmissaoVenc.data.bloqueios_emitente.some((m) => m.toLowerCase().includes('vencido')),
      'Critério 3: POST /fiscal/validar-emissao bloqueia com HTTP 422 e mensagem explícita de certificado vencido'
    );

    const prepBloqueada = await apiReq(`/fiscal/pedidos/${pedido2Id}/preparar-nfe`, tokenGestor, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(
      prepBloqueada.status === 422 &&
        prepBloqueada.data.bloqueado === true &&
        prepBloqueada.data.bloqueado_certificado === true &&
        String(prepBloqueada.data.mensagem || '').toLowerCase().includes('venceu em'),
      `Critério 3: POST /fiscal/pedidos/:id/preparar-nfe bloqueado com mensagem clara: "${prepBloqueada.data.mensagem}"`
    );

    const transBloqueada = await apiReq(`/fiscal/pedidos/${pedido2Id}/transmitir-nfe`, tokenGestor, {
      method: 'POST',
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    });
    assert(
      transBloqueada.status === 422 &&
        String(transBloqueada.data.mensagem || '').toLowerCase().includes('venceu em'),
      'Critério 3: POST /fiscal/pedidos/:id/transmitir-nfe bloqueado com HTTP 422 quando certificado está vencido'
    );

    const cceBloqueada = await apiReq(`/fiscal/pedidos/${pedido1Id}/carta-correcao`, tokenGestor, {
      method: 'POST',
      body: JSON.stringify({
        texto_correcao: 'Correcao de dados adicionais do volume transportado.',
      }),
    });
    assert(
      cceBloqueada.status === 422 &&
        String(cceBloqueada.data.mensagem || '').toLowerCase().includes('venceu em'),
      'Critério 3: POST /fiscal/pedidos/:id/carta-correcao também bloqueado com certificado vencido'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Passo 5: Critério 4 — Substituir o certificado não apaga o histórico de notas emitidas
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nPasso 5: Substituindo certificado vencido por um novo certificado A1 válido (365 dias) e verificando histórico...');
    const pfxNovo365d = gerarPfxTeste({
      cnpj: cnpjEmitente,
      senha: 'SenhaCertNovo365d!',
      razaoSocial: 'RezFire Equipamentos Contra Incendio Ltda',
      notBefore: new Date(agora - 1 * 86400000),
      notAfter: new Date(agora + 365 * 86400000),
      serialHex: '3307999f',
    });

    const upNovo = await enviarPfx(tokenGestor, pfxNovo365d, 'SenhaCertNovo365d!', 'cert-novo-365d.pfx');
    assert(
      upNovo.status === 200 &&
        upNovo.data.sucesso === true &&
        upNovo.data.substituicao_certificado === true &&
        upNovo.data.certificado_anterior_serial === '3307dead' &&
        upNovo.data.total_notas_historico_preservadas >= 1 &&
        upNovo.data.emitente?.certificado_serial === '3307999f' &&
        upNovo.data.emitente?.certificado_status === 'valido',
      `Critério 4: Substituição do certificado concluída (novo serial 3307999f) reportando ${upNovo.data.total_notas_historico_preservadas} nota(s) histórica(s) preservada(s)`
    );

    // Verifica que a NF-e histórica #1 continua autorizada, listada, com mesmo protocolo, serial antigo registrado, XML e DANFE íntegros
    const nfe1After = await apiReq(`/fiscal/pedidos/${pedido1Id}/nfe`, tokenGestor);
    assert(
      nfe1After.status === 200 &&
        nfe1After.data.status_fiscal === 'autorizada' &&
        nfe1After.data.nota_fiscal?.id_nota_fiscal === nfHistorica.id_nota_fiscal &&
        nfe1After.data.nota_fiscal?.chave_acesso === nfHistorica.chave_acesso &&
        nfe1After.data.nota_fiscal?.protocolo_autorizacao === nfHistorica.protocolo_autorizacao &&
        nfe1After.data.nota_fiscal?.assinada_por_certificado_serial === '3307120a',
      'Critério 4: NF-e histórica #1 permanece intacta com protocolo e serial do certificado original (3307120a)'
    );

    const xml1After = await apiReq(`/fiscal/notas/${nfHistorica.id_nota_fiscal}/xml`, tokenGestor);
    const danfe1After = await apiReq(`/fiscal/notas/${nfHistorica.id_nota_fiscal}/danfe`, tokenGestor);
    assert(
      xml1After.status === 200 &&
        xml1After.text.includes('<nfeProc') &&
        xml1After.headers.get('x-nfe-sha256') === nfHistorica.xml_autorizado_sha256 &&
        danfe1After.status === 200 &&
        danfe1After.text.includes(nfHistorica.protocolo_autorizacao),
      'Critério 4: Download do XML autorizado (mesmo SHA-256) e geração do DANFE da nota histórica funcionam normalmente após troca do certificado'
    );

    // Verifica que a emissão do pedido #2 agora está desbloqueada e assina com o novo certificado (3307999f)
    const prep2Desbloqueada = await apiReq(`/fiscal/pedidos/${pedido2Id}/preparar-nfe`, tokenGestor, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(
      prep2Desbloqueada.status === 201 &&
        prep2Desbloqueada.data.sucesso === true &&
        prep2Desbloqueada.data.nota_fiscal?.assinada_por_certificado_serial === '3307999f',
      'Critério 4: Novo pedido #2 é preparado e assinado com o novo certificado digital (serial 3307999f)'
    );
  } catch (err) {
    console.error('❌ Erro inesperado durante o teste 33g:', err);
    failed++;
  } finally {
    // Limpeza dos registros de teste e restauração do emitente original
    try {
      await conn.query(
        `DELETE FROM notificacoes WHERE tipo IN ('CERTIFICADO_VENCENDO', 'CERTIFICADO_VENCIDO')`
      );
      if (pedidosCriadosIds.length > 0) {
        const placeholders = pedidosCriadosIds.map(() => '?').join(',');
        await conn.query(
          `DELETE FROM notas_fiscais WHERE id_pedido IN (${placeholders})`,
          pedidosCriadosIds
        );
        await conn.query(
          `DELETE FROM itens_pedido WHERE id_pedido IN (${placeholders})`,
          pedidosCriadosIds
        );
        await conn.query(
          `DELETE FROM pedidos WHERE id_pedido IN (${placeholders})`,
          pedidosCriadosIds
        );
      }
      if (produtoTesteId) {
        await conn.query(`DELETE FROM produtos WHERE id_produto = ?`, [produtoTesteId]);
      }
      for (const rel of caminhosXmlCriados) {
        const abs = path.join(backendDir, 'uploads/fiscal-xmls', rel);
        if (fs.existsSync(abs)) {
          fs.unlinkSync(abs);
        }
      }

      if (emitenteOriginal) {
        await conn.query(
          `UPDATE emitente_fiscal
           SET ambiente = ?, serie_nfe = ?, proximo_numero_nfe = ?,
               certificado_arquivo_enc = ?, senha_certificado_enc = ?, certificado_hash_sha256 = ?,
               certificado_titular = ?, certificado_emissor = ?, certificado_cnpj = ?,
               certificado_serial = ?, certificado_valido_de = ?, certificado_valido_ate = ?,
               certificado_atualizado_em = ?
           WHERE id_emitente = ?`,
          [
            emitenteOriginal.ambiente,
            emitenteOriginal.serie_nfe,
            emitenteOriginal.proximo_numero_nfe,
            emitenteOriginal.certificado_arquivo_enc,
            emitenteOriginal.senha_certificado_enc,
            emitenteOriginal.certificado_hash_sha256,
            emitenteOriginal.certificado_titular,
            emitenteOriginal.certificado_emissor,
            emitenteOriginal.certificado_cnpj,
            emitenteOriginal.certificado_serial,
            emitenteOriginal.certificado_valido_de,
            emitenteOriginal.certificado_valido_ate,
            emitenteOriginal.certificado_atualizado_em,
            emitenteOriginal.id_emitente,
          ]
        );
      }
    } catch (cleanErr) {
      console.warn('Aviso na limpeza do teste 33g:', cleanErr.message);
    }
    await conn.end();
  }

  console.log('\n========================================');
  console.log(`Resultado do Teste 33g: ${passed} passaram, ${failed} falharam.`);
  console.log('========================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run();
