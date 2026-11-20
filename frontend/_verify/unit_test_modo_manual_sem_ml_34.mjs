/**
 * unit_test_modo_manual_sem_ml_34.mjs
 * Suíte de testes automatizados para a User Story #34:
 *  - Critério 1: Sem conta conectada, nenhum módulo (Estoque, Pedidos, Anúncios, Painel, Alertas e NF-e) exige integração; convite opcional não bloqueante.
 *  - Critério 2: No modo manual, o gestor cadastra e atualiza pedidos, status de anúncios e movimentações de estoque; alertas (#4, #8, #10, #13) e painel (#19) funcionam com esses dados.
 *  - Critério 3: Emissão de NF-e (#33) funciona ponta a ponta a partir de pedidos cadastrados manualmente sem conta ML conectada.
 *  - Critério 4: Cada pedido e cada anúncio registra a origem do dado (origem_dado: 'manual' ou 'mercado_livre').
 *  - Critério 5: Conectar a conta depois não apaga nem duplica os dados manuais; desconectar volta ao modo manual mantendo todo o histórico.
 *  - Critério 6: Com integração ativa, baixa automática (#31) vale só para pedidos de origem Mercado Livre; pedidos manuais seguem com baixa manual sem duplicidade.
 *  - Critério 7: O estado da integração (conectado, desconectado ou erro) fica visível e uma falha na integração não impede o trabalho manual.
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

function gerarPfxTeste({ cnpj, senha, razaoSocial }) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '340001';
  cert.validity.notBefore = new Date(Date.now() - 10 * 86400000);
  cert.validity.notAfter = new Date(Date.now() + 180 * 86400000);

  const attrs = [
    { name: 'commonName', value: `${razaoSocial}:${cnpj}` },
    { name: 'organizationName', value: razaoSocial },
    { name: 'countryName', value: 'BR' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer([
    { name: 'commonName', value: 'AC ICP-Brasil Homologacao 34' },
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

async function run() {
  console.log('🧪 Iniciando Testes Automatizados da Story #34 (Modo Manual sem Integração Mercado Livre)...\n');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'RezFireDB',
  });

  let emitenteOriginal = null;
  let conexaoOriginal = null;
  let produtoTesteId = null;
  const anunciosCriadosIds = [];
  const pedidosCriadosIds = [];
  const caminhosXmlCriados = [];

  try {
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

    const [emRows] = await conn.query(`SELECT * FROM emitente_fiscal LIMIT 1`);
    emitenteOriginal = emRows[0] || null;
    const [conRows] = await conn.query(
      `SELECT * FROM conexoes_mercado_livre WHERE id_usuario = ? ORDER BY id_conexao DESC LIMIT 1`,
      [gestorUser.id_usuario]
    );
    conexaoOriginal = conRows[0] || null;

    // ─────────────────────────────────────────────────────────────────────────
    // Passo 1: Critérios 1 e 7 — Desconectar conta ML e validar operação 100% livre de todos os módulos
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Passo 1: Desconectando Mercado Livre e validando acesso sem bloqueio a todos os módulos (Critérios 1 e 7)...');
    const descRes = await apiReq('/ml/desconectar', tokenGestor, { method: 'POST' });
    assert(descRes.status === 200 && descRes.data.sucesso === true, 'Conta Mercado Livre desconectada com sucesso');

    const statusDesc = await apiReq('/ml/status', tokenGestor);
    assert(
      statusDesc.status === 200 &&
        statusDesc.data.status === 'Desconectado' &&
        statusDesc.data.estado_integracao === 'desconectado' &&
        statusDesc.data.modo_operacao === 'manual' &&
        statusDesc.data.integracao_opcional === true &&
        statusDesc.data.bloqueia_uso_manual === false &&
        statusDesc.data.convite_conexao?.exibir === true,
      'Critérios 1 e 7: GET /ml/status expõe estado_integracao="desconectado", modo_operacao="manual" e convite opcional não bloqueante'
    );

    const [resEst, resPed, resAnu, resDash, resAlertas, resFiscal] = await Promise.all([
      apiReq('/estoque', tokenGestor),
      apiReq('/pedidos', tokenGestor),
      apiReq('/anuncios', tokenGestor),
      apiReq('/dashboard/kpis?dias=30', tokenGestor),
      apiReq('/alertas/central', tokenGestor),
      apiReq('/fiscal/emitente', tokenGestor),
    ]);
    assert(
      resEst.status === 200 &&
        resPed.status === 200 &&
        resAnu.status === 200 &&
        resDash.status === 200 &&
        resAlertas.status === 200 &&
        resFiscal.status === 200,
      'Critério 1: Todos os módulos (Estoque, Pedidos, Anúncios, Painel, Alertas e NF-e) respondem HTTP 200 sem conta ML conectada'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Passo 2: Critérios 2 e 4 — Cadastrar e atualizar produtos, estoque, lotes, anúncios e pedidos em modo manual + Alertas (#4, #8, #10, #13) no Painel (#19)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nPasso 2: Operando no Modo Manual (anúncios, pedidos, estoque, lotes e alertas #4/#8/#10/#13 em #19)...');
    const skuTeste = `EXT-34-${Date.now()}`;
    const prodRes = await apiReq('/produtos', tokenGestor, {
      method: 'POST',
      body: JSON.stringify({
        sku: skuTeste,
        nome: 'Extintor CO2 6kg Modo Manual 34',
        descricao: 'Produto criado para validar operacao sem ML',
        preco: 250.0,
        custo: 130.0,
        tipo: 'Simples',
        estoque_minimo: 10,
        ncm: '84241000',
        cfop: '5102',
        origem_mercadoria: '0',
        cst_csosn: '102',
        unidade_comercial: 'UN',
      }),
    });
    produtoTesteId = prodRes.data.produto?.id_produto;
    assert(prodRes.status === 201 && Boolean(produtoTesteId), 'Produto com dados fiscais cadastrado no catálogo');

    // Movimentação manual de entrada com lote próximo de vencer (200 dias -> alerta FEFO #8) e saldo = 8 (<= estoque_minimo 10 -> alerta estoque #4)
    const validade200d = new Date(Date.now() + 200 * 86400000).toISOString().split('T')[0];
    const fabricacaoHoje = new Date().toISOString().split('T')[0];
    const movEntradaRes = await apiReq('/movimentacoes', tokenGestor, {
      method: 'POST',
      body: JSON.stringify({
        id_produto: produtoTesteId,
        tipo: 'Entrada',
        quantidade: 8,
        motivo: 'Compra NF Manual #34',
        novo_lote: {
          numero_lote: `LOTE-34-${Date.now().toString().slice(-5)}`,
          numero_lacre_inmetro: 'INM-34001',
          data_fabricacao: fabricacaoHoje,
          data_validade: validade200d,
        },
      }),
    });
    assert(movEntradaRes.status === 201, 'Movimentação manual de entrada com lote FEFO registrada');

    // Cadastra anúncio em modo manual vinculado ao produto
    const codAnuncioManual = `MLB-34${Date.now().toString().slice(-7)}`;
    const anuManualRes = await apiReq('/anuncios', tokenGestor, {
      method: 'POST',
      body: JSON.stringify({
        ml_item_id: codAnuncioManual,
        titulo: 'Anúncio Manual Extintor CO2 6kg',
        preco: 250.0,
        status: 'Ativo',
        quantidade_disponivel: 8,
        quantidade_vendida: 2,
        id_produto: produtoTesteId,
      }),
    });
    const idAnuncioManual = anuManualRes.data.anuncio?.id_anuncio;
    if (idAnuncioManual) anunciosCriadosIds.push(idAnuncioManual);
    assert(
      anuManualRes.status === 201 &&
        anuManualRes.data.anuncio?.origem_dado === 'manual' &&
        anuManualRes.data.anuncio?.ml_item_id === codAnuncioManual,
      `Critérios 2 e 4: Anúncio cadastrado em modo manual com origem_dado="manual" (${codAnuncioManual})`
    );

    // Atualiza status do anúncio manualmente para "Pausado" (deve gerar histórico #14 e alerta #13 em #19)
    const statusAnuRes = await apiReq(`/anuncios/${idAnuncioManual}/status`, tokenGestor, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'Pausado',
        motivo_mudanca: 'Pausa manual preventiva para conferência de lote',
      }),
    });
    assert(
      statusAnuRes.status === 200 && statusAnuRes.data.anuncio?.status === 'Pausado',
      'Critério 2: Status do anúncio atualizado manualmente para "Pausado"'
    );

    // Cadastra pedido manual #1 (com prazo_despacho vencido há 3h para acionar alerta #10 em #19)
    const codPedidoManual1 = `PED-MAN-34A-${Date.now()}`;
    const codExternoConciliacao = `200034${Date.now().toString().slice(-6)}`;
    const prazoAtrasado = new Date(Date.now() - 3 * 3600000).toISOString();
    const pedManual1Res = await apiReq('/pedidos', tokenGestor, {
      method: 'POST',
      body: JSON.stringify({
        codigo_pedido: codPedidoManual1,
        cliente_nome: 'Comprador Manual 34 Ltda',
        origem: 'Venda Direta',
        codigo_externo_ml: codExternoConciliacao,
        prazo_despacho: prazoAtrasado,
        modalidade_envio: 'Logística Própria',
        destinatario_documento: '52998224725',
        destinatario_cep: '01001000',
        destinatario_logradouro: 'Praca da Se',
        destinatario_numero: '100',
        destinatario_bairro: 'Se',
        destinatario_municipio: 'Sao Paulo',
        destinatario_codigo_municipio_ibge: '3550308',
        destinatario_uf: 'SP',
        destinatario_email: 'manual34@rezfire.com.br',
        itens: [{ id_produto: produtoTesteId, quantidade: 1, preco_unitario: 250.0 }],
      }),
    });
    const idPedidoManual1 = pedManual1Res.data.pedido?.id_pedido;
    if (idPedidoManual1) pedidosCriadosIds.push(idPedidoManual1);
    assert(
      pedManual1Res.status === 201 &&
        pedManual1Res.data.pedido?.origem_dado === 'manual' &&
        pedManual1Res.data.pedido?.baixa_estoque_realizada === true,
      `Critérios 2 e 4: Pedido cadastrado manualmente com origem_dado="manual" (${codPedidoManual1})`
    );

    // Atualiza o pedido manualmente via PUT /api/pedidos/:id
    const updPedManualRes = await apiReq(`/pedidos/${idPedidoManual1}`, tokenGestor, {
      method: 'PUT',
      body: JSON.stringify({
        cliente_nome: 'Comprador Manual 34 Atualizado Ltda',
        modalidade_envio: 'Tradicional',
      }),
    });
    assert(
      updPedManualRes.status === 200 &&
        updPedManualRes.data.pedido?.cliente_nome === 'Comprador Manual 34 Atualizado Ltda' &&
        updPedManualRes.data.pedido?.modalidade_envio === 'Tradicional',
      'Critério 2: Pedido manual atualizado com sucesso via PUT /api/pedidos/:id'
    );

    // Verifica que a Central de Alertas (#19) reflete os 4 tipos de alertas (#4 estoque, #8 validade, #10 postagem, #13 anúncio) gerados pelos dados manuais
    const centralManual = await apiReq('/alertas/central', tokenGestor);
    const listaAlertas = centralManual.data.alertas || [];
    const temAlertaEstoque = listaAlertas.some(
      (a) => a.categoria === 'estoque' && a.dados_origem?.id_produto === produtoTesteId
    );
    const temAlertaValidade = listaAlertas.some(
      (a) => a.categoria === 'validade' && a.dados_origem?.sku === skuTeste
    );
    const temAlertaPostagem = listaAlertas.some(
      (a) => a.categoria === 'postagem' && a.dados_origem?.id_pedido === idPedidoManual1
    );
    const temAlertaAnuncio = listaAlertas.some(
      (a) => a.categoria === 'anuncio' && a.dados_origem?.id_anuncio === idAnuncioManual
    );
    assert(
      temAlertaEstoque && temAlertaValidade && temAlertaPostagem && temAlertaAnuncio,
      'Critério 2: Central de Alertas (#19) gera alertas de Estoque (#4), Validade FEFO (#8), Postagem (#10) e Anúncio (#13) a partir dos dados manuais'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Passo 3: Critério 3 — Emissão de NF-e (#33) a partir de pedido cadastrado manualmente (sem conta ML conectada)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nPasso 3: Emitindo NF-e (#33) a partir do pedido manual sem conta do Mercado Livre conectada (Critério 3)...');
    const cnpjEmitente = emitenteOriginal?.cnpj || '11222333000181';
    const pfxBuf = gerarPfxTeste({
      cnpj: cnpjEmitente,
      senha: 'SenhaCert34!',
      razaoSocial: 'RezFire Equipamentos Contra Incendio Ltda',
    });
    const fdCert = new FormData();
    fdCert.append('certificado', new Blob([pfxBuf], { type: 'application/x-pkcs12' }), 'cert-34.pfx');
    fdCert.append('senha', 'SenhaCert34!');
    const upCert = await apiReq('/fiscal/emitente/certificado', tokenGestor, {
      method: 'POST',
      body: fdCert,
    });
    assert(upCert.status === 200, 'Certificado A1 instalado para assinatura da NF-e do pedido manual');

    const prepNfeManual = await apiReq(`/fiscal/pedidos/${idPedidoManual1}/preparar-nfe`, tokenGestor, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(
      prepNfeManual.status === 201 && prepNfeManual.data.nota_fiscal?.status === 'assinada',
      'Critério 3: NF-e do pedido manual preparada e assinada digitalmente (status="assinada")'
    );

    const transNfeManual = await apiReq(`/fiscal/pedidos/${idPedidoManual1}/transmitir-nfe`, tokenGestor, {
      method: 'POST',
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    });
    const nfManual = transNfeManual.data.nota_fiscal;
    if (nfManual?.xml_autorizado_path) {
      caminhosXmlCriados.push(nfManual.xml_autorizado_path);
    }
    assert(
      transNfeManual.status === 200 &&
        transNfeManual.data.autorizada === true &&
        Boolean(nfManual?.protocolo_autorizacao),
      `Critério 3: NF-e do pedido manual autorizada pela SEFAZ (Protocolo ${nfManual?.protocolo_autorizacao})`
    );

    const danfeManual = await apiReq(`/fiscal/pedidos/${idPedidoManual1}/nfe/danfe`, tokenGestor);
    assert(
      danfeManual.status === 200 && danfeManual.text.includes(nfManual.protocolo_autorizacao),
      'Critério 3: DANFE gerado com sucesso a partir do pedido manual'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Passo 4: Critérios 5 e 6 — Conectar conta depois não apaga nem duplica dados manuais; baixa automática (#31) só para pedidos ML
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nPasso 4: Conectando conta ML posteriormente e validando preservação, não-duplicação e regra de baixa de estoque (Critérios 5 e 6)...');
    const cbRes = await apiReq('/ml/callback?code=MOCK_AUTH_34', tokenGestor);
    assert(cbRes.status === 200 && cbRes.data.sucesso === true, 'Conta Mercado Livre conectada via OAuth callback');

    // Verifica saldo antes da sincronização (8 de entrada - 1 do pedido manual #1 = 7 un.)
    const [estAntesRows] = await conn.query(
      `SELECT quantidade_atual FROM estoque WHERE id_produto = ?`,
      [produtoTesteId]
    );
    const saldoAntesSync = Number(estAntesRows[0]?.quantidade_atual ?? 0);
    assert(saldoAntesSync === 7, `Saldo físico antes da sincronização ML conferido (${saldoAntesSync} un.)`);

    // Sincroniza anúncios passando o mesmo código do anúncio manual (codAnuncioManual) + 1 anúncio novo vindo do ML
    const codAnuncioNovoML = `MLB-3499${Date.now().toString().slice(-5)}`;
    const syncAnuRes = await apiReq('/ml/anuncios/sincronizar-status', tokenGestor, {
      method: 'POST',
      body: JSON.stringify({
        novosAnunciosSimulados: [
          {
            ml_item_id: codAnuncioManual,
            titulo: 'Anúncio Manual Extintor CO2 6kg',
            preco: 250.0,
            status: 'Ativo',
            quantidade_disponivel: 7,
            quantidade_vendida: 3,
          },
          {
            ml_item_id: codAnuncioNovoML,
            titulo: 'Anúncio Oficial Importado da API ML',
            preco: 260.0,
            status: 'Ativo',
            quantidade_disponivel: 7,
            quantidade_vendida: 5,
          },
        ],
      }),
    });
    assert(syncAnuRes.status === 200 && syncAnuRes.data.sucesso === true, 'Sincronização de anúncios executada após conectar conta');

    const [anuCheckRows] = await conn.query(
      `SELECT id_anuncio, ml_item_id, origem_dado FROM anuncios_ml WHERE ml_item_id IN (?, ?)`,
      [codAnuncioManual, codAnuncioNovoML]
    );
    if (anuCheckRows.length > 0) {
      for (const r of anuCheckRows) {
        if (!anunciosCriadosIds.includes(r.id_anuncio)) anunciosCriadosIds.push(r.id_anuncio);
      }
    }
    const anuManualCount = anuCheckRows.filter((r) => r.ml_item_id === codAnuncioManual).length;
    const anuNovoML = anuCheckRows.find((r) => r.ml_item_id === codAnuncioNovoML);
    assert(
      anuManualCount === 1 && anuNovoML?.origem_dado === 'mercado_livre',
      'Critérios 4 e 5: Anúncio manual existente foi conciliado sem duplicação e novo anúncio ML recebeu origem_dado="mercado_livre"'
    );

    // Sincroniza pedidos do ML enviando:
    // 1) O mesmo pedido já cadastrado manualmente (id = codExternoConciliacao) -> NÃO deve duplicar nem baixar estoque de novo
    // 2) Um pedido com origem_dado = 'manual' -> deve ser ignorado pela baixa automática do ML
    // 3) Um pedido genuíno novo do Mercado Livre (id = novoOrderMlId, qtd = 2) -> DEVE importar com origem_dado='mercado_livre' e baixar 2 un.
    const novoOrderMlId = `3488${Date.now().toString().slice(-6)}`;
    const syncPedRes = await apiReq('/ml/pedidos/sincronizar', tokenGestor, {
      method: 'POST',
      body: JSON.stringify({
        pedidosSimulados: [
          {
            id: codExternoConciliacao,
            status: 'paid',
            buyer: { nickname: 'COMPRADOR_MANUAL_CONCILIADO' },
            order_items: [
              {
                item: { id: codAnuncioManual, title: 'Extintor CO2 6kg' },
                id_produto: produtoTesteId,
                quantity: 1,
                unit_price: 250.0,
              },
            ],
          },
          {
            id: `IGN-${Date.now()}`,
            status: 'paid',
            origem: 'Venda Direta',
            origem_dado: 'manual',
            buyer: { nickname: 'PEDIDO_MANUAL_NAO_BAIXAR_AUTO' },
            order_items: [
              {
                id_produto: produtoTesteId,
                quantity: 3,
                unit_price: 250.0,
              },
            ],
          },
          {
            id: novoOrderMlId,
            status: 'paid',
            buyer: { nickname: 'COMPRADOR_OFICIAL_ML_34' },
            order_items: [
              {
                item: { id: codAnuncioManual, title: 'Extintor CO2 6kg' },
                id_produto: produtoTesteId,
                quantity: 2,
                unit_price: 250.0,
              },
            ],
          },
        ],
      }),
    });

    const [pedNovoMlRows] = await conn.query(
      `SELECT id_pedido, codigo_pedido, origem_dado, baixa_estoque_realizada FROM pedidos WHERE codigo_pedido = ?`,
      [`MLB-${novoOrderMlId}`]
    );
    if (pedNovoMlRows[0]?.id_pedido) {
      pedidosCriadosIds.push(pedNovoMlRows[0].id_pedido);
    }

    const [estDepoisSyncRows] = await conn.query(
      `SELECT quantidade_atual FROM estoque WHERE id_produto = ?`,
      [produtoTesteId]
    );
    const saldoDepoisSync = Number(estDepoisSyncRows[0]?.quantidade_atual ?? 0);

    assert(
      syncPedRes.status === 200 &&
        syncPedRes.data.pedidos_importados === 1 &&
        pedNovoMlRows.length === 1 &&
        pedNovoMlRows[0].origem_dado === 'mercado_livre' &&
        saldoDepoisSync === 5,
      `Critérios 5 e 6: Sincronização ML importou apenas o pedido novo ML (origem_dado="mercado_livre", baixa de 2 un.: 7 -> ${saldoDepoisSync}), sem duplicar nem baixar novamente o pedido manual conciliado`
    );

    // Critério 6: Testa pedido manual criado com baixa manual posterior (baixar_estoque_agora: false) e proteção contra dupla baixa
    const pedManualDiferidoRes = await apiReq('/pedidos', tokenGestor, {
      method: 'POST',
      body: JSON.stringify({
        codigo_pedido: `PED-MAN-DIF-${Date.now()}`,
        cliente_nome: 'Cliente Baixa Manual Controlada',
        origem: 'Venda Direta',
        baixar_estoque_agora: false,
        itens: [{ id_produto: produtoTesteId, quantidade: 1, preco_unitario: 250.0 }],
      }),
    });
    const idPedDiferido = pedManualDiferidoRes.data.pedido?.id_pedido;
    if (idPedDiferido) pedidosCriadosIds.push(idPedDiferido);

    const [estAposCriarDiferido] = await conn.query(
      `SELECT quantidade_atual FROM estoque WHERE id_produto = ?`,
      [produtoTesteId]
    );
    assert(
      pedManualDiferidoRes.status === 201 &&
        pedManualDiferidoRes.data.pedido?.baixa_estoque_realizada === false &&
        Number(estAposCriarDiferido[0]?.quantidade_atual) === 5,
      'Critério 6: Pedido manual com baixar_estoque_agora=false aguarda a baixa manual sem debitar automaticamente'
    );

    const baixaManual1 = await apiReq(`/pedidos/${idPedDiferido}/baixar-estoque`, tokenGestor, {
      method: 'POST',
    });
    const [estAposBaixaManual] = await conn.query(
      `SELECT quantidade_atual FROM estoque WHERE id_produto = ?`,
      [produtoTesteId]
    );
    assert(
      baixaManual1.status === 200 &&
        baixaManual1.data.pedido?.baixa_estoque_realizada === true &&
        Number(estAposBaixaManual[0]?.quantidade_atual) === 4,
      'Critério 6: Baixa manual do pedido executada com sucesso (saldo 5 -> 4 un.)'
    );

    const baixaManualDuplicada = await apiReq(`/pedidos/${idPedDiferido}/baixar-estoque`, tokenGestor, {
      method: 'POST',
    });
    assert(
      baixaManualDuplicada.status === 409,
      'Critério 6: Tentativa de segunda baixa no mesmo pedido manual bloqueada com HTTP 409 (sem baixa em duplicidade)'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Passo 5: Critérios 5 e 7 — Falha na integração visível sem bloquear trabalho manual e desconexão preservando histórico
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nPasso 5: Simulando falha na integração ML e desconexão final com preservação de histórico (Critérios 5 e 7)...');
    const syncErroRes = await apiReq('/ml/pedidos/sincronizar', tokenGestor, {
      method: 'POST',
      body: JSON.stringify({ forcarErro: 'Timeout 503 na API do Mercado Livre' }),
    });
    assert(syncErroRes.status === 400, 'Falha simulada na integração ML registrada');

    const statusComErro = await apiReq('/ml/status', tokenGestor);
    assert(
      statusComErro.status === 200 &&
        statusComErro.data.estado_integracao === 'erro' &&
        statusComErro.data.bloqueia_uso_manual === false,
      'Critério 7: GET /ml/status exibe estado_integracao="erro" com bloqueia_uso_manual=false'
    );

    // Mesmo com a integração em estado de erro, atualizar anúncio manualmente funciona normalmente
    const updAnuDuranteErro = await apiReq(`/anuncios/${idAnuncioManual}/status`, tokenGestor, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'Ativo', motivo_mudanca: 'Reativado manualmente durante falha da API ML' }),
    });
    assert(
      updAnuDuranteErro.status === 200 && updAnuDuranteErro.data.anuncio?.status === 'Ativo',
      'Critério 7: Falha na integração ML não impede o trabalho manual (anúncio atualizado com HTTP 200)'
    );

    // Desconecta novamente e verifica que todo o histórico (pedidos manuais, pedidos ML, anúncios e NF-e) permanece intacto
    const descFinal = await apiReq('/ml/desconectar', tokenGestor, { method: 'POST' });
    const [pedPreservados] = await conn.query(
      `SELECT COUNT(*) AS total FROM pedidos WHERE id_pedido IN (?, ?, ?)`,
      [idPedidoManual1, pedNovoMlRows[0].id_pedido, idPedDiferido]
    );
    const [anuPreservados] = await conn.query(
      `SELECT COUNT(*) AS total FROM anuncios_ml WHERE id_anuncio IN (?, ?)`,
      [idAnuncioManual, anuNovoML.id_anuncio]
    );
    assert(
      descFinal.status === 200 &&
        Number(pedPreservados[0].total) === 3 &&
        Number(anuPreservados[0].total) === 2,
      'Critério 5: Desconectar volta ao modo manual mantendo 100% do histórico de pedidos e anúncios'
    );
  } catch (err) {
    console.error('❌ Erro inesperado durante o teste #34:', err);
    failed++;
  } finally {
    try {
      await conn.query(
        `DELETE FROM notificacoes WHERE titulo LIKE '%AnúncioManual%' OR mensagem LIKE '%Anúncio Manual Extintor CO2 6kg%'`
      );
      if (pedidosCriadosIds.length > 0) {
        const ph = pedidosCriadosIds.map(() => '?').join(',');
        await conn.query(`DELETE FROM notas_fiscais WHERE id_pedido IN (${ph})`, pedidosCriadosIds);
        await conn.query(`DELETE FROM itens_pedido WHERE id_pedido IN (${ph})`, pedidosCriadosIds);
        await conn.query(`DELETE FROM pedidos WHERE id_pedido IN (${ph})`, pedidosCriadosIds);
      }
      if (anunciosCriadosIds.length > 0) {
        const phA = anunciosCriadosIds.map(() => '?').join(',');
        await conn.query(`DELETE FROM produto_anuncio WHERE id_anuncio IN (${phA})`, anunciosCriadosIds);
        await conn.query(`DELETE FROM ocorrencias_anuncio WHERE id_anuncio IN (${phA})`, anunciosCriadosIds);
        await conn.query(`DELETE FROM anuncios_ml WHERE id_anuncio IN (${phA})`, anunciosCriadosIds);
      }
      if (produtoTesteId) {
        await conn.query(`DELETE FROM movimentacoes_estoque WHERE id_produto = ?`, [produtoTesteId]);
        await conn.query(`DELETE FROM lotes_estoque WHERE id_produto = ?`, [produtoTesteId]);
        await conn.query(`DELETE FROM estoque WHERE id_produto = ?`, [produtoTesteId]);
        await conn.query(`DELETE FROM produtos WHERE id_produto = ?`, [produtoTesteId]);
      }
      for (const rel of caminhosXmlCriados) {
        const abs = path.join(backendDir, 'uploads/fiscal-xmls', rel);
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
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
      if (conexaoOriginal) {
        await conn.query(
          `UPDATE conexoes_mercado_livre
           SET status = ?, ml_user_id = ?, access_token = ?, refresh_token = ?, expires_at = ?
           WHERE id_conexao = ?`,
          [
            conexaoOriginal.status,
            conexaoOriginal.ml_user_id,
            conexaoOriginal.access_token,
            conexaoOriginal.refresh_token,
            conexaoOriginal.expires_at,
            conexaoOriginal.id_conexao,
          ]
        );
      }
    } catch (cleanErr) {
      console.warn('Aviso na limpeza do teste #34:', cleanErr.message);
    }
    await conn.end();
  }

  console.log('\n========================================');
  console.log(`Resultado do Teste #34: ${passed} passaram, ${failed} falharam.`);
  console.log('========================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run();
