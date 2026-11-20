/**
 * unit_test_xml_danfe_33e.mjs
 * Teste automatizado de aceite da User Story 33e (Guardar XML autorizado e gerar DANFE).
 *
 * Critérios validados:
 * 1. XML autorizado nfeProc é arquivado em disco com SHA-256 e guarda legal de 5 anos, vinculado ao pedido, com download via nota e pedido.
 * 2. DANFE oficial HTML/A4 (com @media print) é gerado somente após autorização, bloqueando notas apenas assinadas.
 * 3. DANFE exibe Chave de Acesso formatada (44 dígitos), código de barras SVG Code-128C e Protocolo de Autorização SEFAZ.
 * 4. Imutabilidade: alterações posteriores no pedido, destinatário, produto ou cancelamento do pedido NÃO alteram XML nem DANFE emitidos.
 * 5. RBAC: OPERADOR consegue visualizar/imprimir DANFE para expedição, mas permanece bloqueado em listagem fiscal e download XML completo.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import bcrypt from '../../backend/node_modules/bcrypt/bcrypt.js';
import { AppDataSource } from '../../backend/dist/config/database.js';
import { env } from '../../backend/dist/config/env.js';
import { sha256Hex } from '../../backend/dist/utils/cryptoVault.js';
import { formatarChaveAcesso } from '../../backend/dist/utils/danfeGenerator.js';
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
  cert.serialNumber = '09ABCDEF445566';
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
    friendlyName: 'RezFireTeste33eA1',
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, 'binary');
}

async function runTests() {
  console.log('🧪 Iniciando Testes Automatizados da Story 33e (Arquivo XML Autorizado & DANFE)...\n');

  let tokenGestor = null;
  let tokenOperador = null;
  let emitenteSnapshotAntes = null;
  let instalouCertTemporario = false;
  let idOperadorCriado = null;
  let idProdutoTeste = null;
  let idPedidoTeste = null;
  let idNotaTeste = null;
  let caminhoXmlDiscoCriado = null;

  try {
    await AppDataSource.initialize();
    const usuarioRepo = AppDataSource.getRepository(Usuario);
    const emitenteRepo = AppDataSource.getRepository(EmitenteFiscal);
    const estoqueRepo = AppDataSource.getRepository(Estoque);

    console.log('Passo 1: Autenticando usuários e preparando emitente + certificado A1...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'gestor@rezfire.com.br', senha: 'rezfire2026' }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.token, 'Gestor autenticado com sucesso');
    tokenGestor = loginData.token;

    const emailOp = `operador.33e.${Date.now()}@rezfire.com.br`;
    const opSalvo = await usuarioRepo.save(
      usuarioRepo.create({
        nome: 'Operador Expedicao 33e',
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
          proximo_numero_nfe: 950,
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
      const senhaCert = 'RezFire#33e!2026';
      const pfx = gerarPkcs12Teste({
        cnpj: cnpjEmitente,
        razao: razaoEmitente.toUpperCase().slice(0, 30),
        diasInicio: -10,
        diasFim: 365,
        senha: senhaCert,
      });
      const formCert = new FormData();
      formCert.append('certificado', new Blob([pfx], { type: 'application/x-pkcs12' }), 'a1_33e.pfx');
      formCert.append('senha', senhaCert);
      const upCertRes = await fetch(`${BASE_URL}/fiscal/emitente/certificado`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenGestor}` },
        body: formCert,
      });
      assert(upCertRes.status === 200, 'Certificado A1 temporário instalado');
      instalouCertTemporario = upCertRes.status === 200;
    }

    // Cria produto e pedido originais
    const skuOriginal = `TEST-33E-${Date.now()}`;
    const nomeProdOriginal = 'Extintor CO2 6kg Original 33e';
    const prodRes = await fetch(`${BASE_URL}/produtos`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        sku: skuOriginal,
        nome: nomeProdOriginal,
        preco: 420.0,
        custo: 220.0,
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
    await estoqueRepo.update({ id_produto: idProdutoTeste }, { quantidade_atual: 50 });

    const codigoPedidoOriginal = `PED-33E-${Date.now()}`;
    const clienteOriginal = 'Cliente Original 33e Comercio Ltda';
    const pedRes = await fetch(`${BASE_URL}/pedidos`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        codigo_pedido: codigoPedidoOriginal,
        cliente_nome: clienteOriginal,
        origem: 'Venda Direta',
        modalidade_envio: 'Logística Própria',
        destinatario_documento: '45997418000153',
        destinatario_ie: '110042490114',
        destinatario_cep: '01310100',
        destinatario_logradouro: 'Av Paulista Original',
        destinatario_numero: '100',
        destinatario_bairro: 'Bela Vista',
        destinatario_municipio: 'São Paulo',
        destinatario_codigo_municipio_ibge: '3550308',
        destinatario_uf: 'SP',
        destinatario_email: 'compras@original33e.com.br',
        itens: [{ id_produto: idProdutoTeste, quantidade: 2, preco_unitario: 420.0 }],
      }),
    });
    const pedData = await pedRes.json();
    idPedidoTeste = pedData.pedido.id_pedido;

    // 2. Bloqueio de DANFE antes da autorização + Autorização com arquivamento em disco
    console.log('\nPasso 2: Validando guarda do XML autorizado em disco, SHA-256 e bloqueio pré-autorização...');
    const prepData = await (await fetch(`${BASE_URL}/fiscal/pedidos/${idPedidoTeste}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    })).json();
    idNotaTeste = prepData.nota_fiscal?.id_nota_fiscal;
    assert(Boolean(idNotaTeste), 'NF-e assinada preparada para transmissão');

    const danfeAntesRes = await fetch(`${BASE_URL}/fiscal/notas/${idNotaTeste}/danfe`, {
      headers: { Authorization: `Bearer ${tokenGestor}` },
    });
    assert(danfeAntesRes.status === 400, `Geração de DANFE bloqueada enquanto nota não autorizada (HTTP ${danfeAntesRes.status})`);

    const autRes = await fetch(`${BASE_URL}/fiscal/pedidos/${idPedidoTeste}/transmitir-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ cenario_teste: 'autorizada' }),
    });
    const autData = await autRes.json();
    const nfAut = autData.nota_fiscal;
    assert(
      autRes.status === 200 &&
        autData.autorizada === true &&
        Boolean(nfAut?.xml_autorizado_path) &&
        /^[a-f0-9]{64}$/.test(String(nfAut?.xml_autorizado_sha256 || '')) &&
        /^\d{4}-12-31$/.test(String(nfAut?.guarda_legal_ate || '')),
      `Autorização arquivou XML em disco (${nfAut?.xml_autorizado_path}) com SHA-256 e guarda legal (${nfAut?.guarda_legal_ate})`
    );

    caminhoXmlDiscoCriado = path.resolve(env.FISCAL_XML_ARCHIVE_DIR, nfAut.xml_autorizado_path);
    const arquivoExisteDisco = fs.existsSync(caminhoXmlDiscoCriado);
    const hashDisco = arquivoExisteDisco ? sha256Hex(fs.readFileSync(caminhoXmlDiscoCriado)) : '';
    assert(
      arquivoExisteDisco && hashDisco === nfAut.xml_autorizado_sha256,
      'Arquivo físico existe no disco e seu SHA-256 confere exatamente com o registro do banco'
    );

    const xmlNotaRes = await fetch(`${BASE_URL}/fiscal/notas/${idNotaTeste}/xml`, {
      headers: { Authorization: `Bearer ${tokenGestor}` },
    });
    const xmlNotaBody = await xmlNotaRes.text();
    const xmlPedRes = await fetch(`${BASE_URL}/fiscal/pedidos/${idPedidoTeste}/nfe/xml`, {
      headers: { Authorization: `Bearer ${tokenGestor}` },
    });
    const xmlPedBody = await xmlPedRes.text();
    assert(
      xmlNotaRes.status === 200 &&
        xmlPedRes.status === 200 &&
        xmlNotaRes.headers.get('x-nfe-sha256') === nfAut.xml_autorizado_sha256 &&
        xmlNotaBody === xmlPedBody &&
        xmlNotaBody.includes('<nfeProc') &&
        xmlNotaBody.includes(nfAut.protocolo_autorizacao),
      'Download do XML via nota e via pedido retornam o mesmo nfeProc íntegro com cabeçalho X-NFe-SHA256'
    );

    const listNotasData = await (await fetch(`${BASE_URL}/fiscal/notas?status=autorizada`, {
      headers: { Authorization: `Bearer ${tokenGestor}` },
    })).json();
    const notaListada = (listNotasData.notas || []).find((n) => n.id_nota_fiscal === idNotaTeste);
    assert(
      Boolean(notaListada) &&
        notaListada.tem_xml_autorizado === true &&
        notaListada.pode_gerar_danfe === true &&
        notaListada.codigo_pedido_snapshot === codigoPedidoOriginal,
      'GET /fiscal/notas lista a nota arquivada vinculada ao pedido'
    );

    // 3. DANFE oficial (Chave, Code-128C, Protocolo, Print CSS, RBAC)
    console.log('\nPasso 3: Validando geração do DANFE A4 com Code-128C SVG, protocolo e RBAC...');
    const danfeNotaRes = await fetch(`${BASE_URL}/fiscal/notas/${idNotaTeste}/danfe`, {
      headers: { Authorization: `Bearer ${tokenGestor}` },
    });
    const danfeHtml = await danfeNotaRes.text();
    const chaveFmt = formatarChaveAcesso(nfAut.chave_acesso);

    assert(
      danfeNotaRes.status === 200 &&
        danfeNotaRes.headers.get('content-type')?.includes('text/html') &&
        danfeHtml.includes('DANFE') &&
        danfeHtml.includes('@media print') &&
        danfeHtml.includes(chaveFmt) &&
        danfeHtml.includes('Code-128C') &&
        danfeHtml.includes('<svg') &&
        danfeHtml.includes(nfAut.protocolo_autorizacao) &&
        danfeHtml.includes('HOMOLOGAÇÃO') &&
        danfeHtml.includes(clienteOriginal) &&
        danfeHtml.includes(nomeProdOriginal) &&
        danfeHtml.includes('840,00'),
      'DANFE HTML contém layout A4, impressão, Code-128C SVG, chave formatada, protocolo, aviso homologação e snapshot do pedido'
    );

    const danfePedRes = await fetch(`${BASE_URL}/fiscal/pedidos/${idPedidoTeste}/nfe/danfe`, {
      headers: { Authorization: `Bearer ${tokenGestor}` },
    });
    assert(danfePedRes.status === 200, 'Atalho GET /fiscal/pedidos/:id/nfe/danfe responde com HTTP 200');

    // RBAC Operador
    const opDanfeRes = await fetch(`${BASE_URL}/fiscal/notas/${idNotaTeste}/danfe`, {
      headers: { Authorization: `Bearer ${tokenOperador}` },
    });
    const opNotasRes = await fetch(`${BASE_URL}/fiscal/notas`, {
      headers: { Authorization: `Bearer ${tokenOperador}` },
    });
    const opXmlRes = await fetch(`${BASE_URL}/fiscal/notas/${idNotaTeste}/xml`, {
      headers: { Authorization: `Bearer ${tokenOperador}` },
    });
    assert(
      opDanfeRes.status === 200 && opNotasRes.status === 403 && opXmlRes.status === 403,
      'RBAC validado: OPERADOR imprime DANFE para expedição (200), mas é bloqueado no arquivo/XML completo (403)'
    );

    // 4. Critério 4: Imutabilidade após alterações no pedido, destinatário, produto e cancelamento comercial
    console.log('\nPasso 4: Testando imutabilidade após alterações no pedido/produto e cancelamento do pedido (Critério 4)...');
    const alterDestRes = await fetch(`${BASE_URL}/pedidos/${idPedidoTeste}/destinatario`, {
      method: 'PATCH',
      headers: gestorHeaders,
      body: JSON.stringify({
        cliente_nome: 'Cliente Alterado Pos Emissao SA',
        destinatario_logradouro: 'Rua Modificada Depois',
        destinatario_numero: '9999',
      }),
    });
    assert(alterDestRes.status === 200, 'Destinatário do pedido alterado após emissão da NF-e');

    const alterProdRes = await fetch(`${BASE_URL}/produtos/${idProdutoTeste}`, {
      method: 'PUT',
      headers: gestorHeaders,
      body: JSON.stringify({
        nome: 'PRODUTO ALTERADO NO CATALOGO 999',
        preco: 999.99,
      }),
    });
    assert(alterProdRes.status === 200, 'Nome e preço do produto alterados no catálogo após emissão');

    const cancelPedRes = await fetch(`${BASE_URL}/pedidos/${idPedidoTeste}/status`, {
      method: 'PATCH',
      headers: gestorHeaders,
      body: JSON.stringify({
        status: 'Cancelado',
        motivo_devolucao: 'Outro',
        detalhe_devolucao: 'Cancelamento comercial simulado após NF-e autorizada',
      }),
    });
    assert(cancelPedRes.status === 200, 'Pedido alterado comercialmente para Cancelado');

    const pedDepois = await (await fetch(`${BASE_URL}/pedidos/${idPedidoTeste}`, { headers: gestorHeaders })).json();
    const xmlDepoisRes = await fetch(`${BASE_URL}/fiscal/pedidos/${idPedidoTeste}/nfe/xml`, {
      headers: { Authorization: `Bearer ${tokenGestor}` },
    });
    const xmlDepoisBody = await xmlDepoisRes.text();
    const danfeDepoisRes = await fetch(`${BASE_URL}/fiscal/pedidos/${idPedidoTeste}/nfe/danfe`, {
      headers: { Authorization: `Bearer ${tokenGestor}` },
    });
    const danfeDepoisHtml = await danfeDepoisRes.text();

    assert(
      pedDepois.pedido?.nota_fiscal_resumo?.id_nota_fiscal === idNotaTeste &&
        xmlDepoisRes.status === 200 &&
        sha256Hex(Buffer.from(xmlDepoisBody, 'utf8')) === nfAut.xml_autorizado_sha256 &&
        danfeDepoisRes.status === 200 &&
        danfeDepoisHtml.includes(clienteOriginal) &&
        danfeDepoisHtml.includes(nomeProdOriginal) &&
        danfeDepoisHtml.includes('840,00') &&
        !danfeDepoisHtml.includes('Cliente Alterado Pos Emissao SA') &&
        !danfeDepoisHtml.includes('PRODUTO ALTERADO NO CATALOGO 999') &&
        !danfeDepoisHtml.includes('999,99'),
      'Imutabilidade comprovada: XML (mesmo SHA-256) e DANFE mantêm dados originais após edição e cancelamento do pedido'
    );

    console.log('\n========================================');
    console.log(`Resultado do Teste 33e: ${passed} passaram, ${failed} falharam.`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('❌ Erro inesperado durante o teste 33e:', err);
    process.exitCode = 1;
  } finally {
    try {
      if (caminhoXmlDiscoCriado && fs.existsSync(caminhoXmlDiscoCriado)) {
        fs.unlinkSync(caminhoXmlDiscoCriado);
      }
      if (AppDataSource.isInitialized) {
        if (idNotaTeste) {
          await AppDataSource.getRepository(NotaFiscalTransmissao).delete({ id_nota_fiscal: idNotaTeste });
          await AppDataSource.getRepository(NotaFiscal).delete({ id_nota_fiscal: idNotaTeste });
        }
        if (idPedidoTeste) {
          await AppDataSource.getRepository(Pedido).delete({ id_pedido: idPedidoTeste });
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

