/**
 * unit_test_nfe_preparacao_assinatura_33c.mjs
 * Teste automatizado de aceite da User Story 33c (Montar, validar e assinar NF-e a partir de um pedido).
 *
 * Critérios validados:
 * 1. Ação "Preparar NF-e" no pedido monta a nota com emitente, destinatário, itens, impostos, frete e totais.
 * 2. Sistema valida os dados antes da assinatura e mostra erros indicando campo e motivo.
 * 3. Nota é assinada digitalmente (XMLDSig RSA-SHA1 + SHA-1) com o certificado A1 do emitente.
 * 4. Pedido sem dados obrigatórios (destinatário ou dados fiscais do produto) é bloqueado (HTTP 422) com lista do que falta.
 * 5. Numeração é sequencial e não se repete mesmo sob chamadas concorrentes.
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
import { verificarAssinaturaXmlNFe } from '../../backend/dist/utils/nfeSigner.js';
import { calcularDigitoVerificadorChaveNFe } from '../../backend/dist/utils/nfeBuilder.js';

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
  cert.serialNumber = '09ABCDEF987654';
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
    friendlyName: 'RezFireTeste33cA1',
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, 'binary');
}

async function runTests() {
  console.log('🧪 Iniciando Testes Automatizados da Story 33c (Montar, Validar e Assinar NF-e)...\n');

  let tokenGestor = null;
  let tokenOperador = null;
  let emitenteExistiaAntes = false;
  let idOperadorCriado = null;
  let idProdutoTeste = null;
  const idsPedidosTeste = [];
  const idsNotasTeste = [];

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const emitenteRepo = AppDataSource.getRepository(EmitenteFiscal);
    const usuarioRepo = AppDataSource.getRepository(Usuario);
    const produtoRepo = AppDataSource.getRepository(Produto);
    const estoqueRepo = AppDataSource.getRepository(Estoque);
    const pedidoRepo = AppDataSource.getRepository(Pedido);
    const movRepo = AppDataSource.getRepository(MovimentacaoEstoque);
    const nfRepo = AppDataSource.getRepository(NotaFiscal);

    emitenteExistiaAntes = (await emitenteRepo.count()) > 0;

    // 1. Setup de Gestor, Operador (RBAC), Emitente + Certificado A1
    console.log('Passo 1: Setup de Emitente Fiscal, Certificado A1 e Autenticação...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'gestor@rezfire.com.br', senha: 'rezfire2026' }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.token, 'Gestor autenticado com sucesso');
    tokenGestor = loginData.token;

    const emailOp = `operador.33c.${Date.now()}@rezfire.com.br`;
    const opSalvo = await usuarioRepo.save(
      usuarioRepo.create({
        nome: 'Operador Teste 33c',
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

    const cnpjEmitente = '11222333000181';
    const senhaCert = 'RezFire#33c!2026';
    const numeroInicial = 500;

    if (!emitenteExistiaAntes) {
      await fetch(`${BASE_URL}/fiscal/emitente`, {
        method: 'PUT',
        headers: gestorHeaders,
        body: JSON.stringify({
          razao_social: 'RezFire Equipamentos Contra Incendio Ltda',
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
          proximo_numero_nfe: numeroInicial,
          modo_integracao: 'sefaz_direto',
        }),
      });
      const pfx = gerarPkcs12Teste({
        cnpj: cnpjEmitente,
        razao: 'REZFIRE EQUIPAMENTOS',
        diasInicio: -10,
        diasFim: 365,
        senha: senhaCert,
      });
      const formCert = new FormData();
      formCert.append('certificado', new Blob([pfx], { type: 'application/x-pkcs12' }), 'a1.pfx');
      formCert.append('senha', senhaCert);
      const upCertRes = await fetch(`${BASE_URL}/fiscal/emitente/certificado`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenGestor}` },
        body: formCert,
      });
      assert(upCertRes.status === 200, 'Certificado A1 instalado para assinatura XMLDSig');
    }

    const emitenteAtual = (await (await fetch(`${BASE_URL}/fiscal/emitente`, { headers: gestorHeaders })).json()).emitente;
    const proxNumeroAntes = Number(emitenteAtual.proximo_numero_nfe);

    // 2. Cria produto sem dados fiscais completos e pedido sem destinatário
    console.log('\nPasso 2: Testando bloqueio e diagnóstico detalhado de erros (Critérios 2 e 4)...');
    const prodRes = await fetch(`${BASE_URL}/produtos`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        sku: `TEST-33C-${Date.now()}`,
        nome: 'Extintor CO2 6kg Teste 33c',
        preco: 459.0,
        custo: 240.0,
        categoria: 'Extintores',
      }),
    });
    const prodData = await prodRes.json();
    idProdutoTeste = prodData.produto.id_produto;
    await estoqueRepo.update({ id_produto: idProdutoTeste }, { quantidade_atual: 50 });

    const pedRes1 = await fetch(`${BASE_URL}/pedidos`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        cliente_nome: 'Cliente Sem Endereco Fiscal',
        origem: 'Mercado Livre',
        modalidade_envio: 'Coleta',
        itens: [{ id_produto: idProdutoTeste, quantidade: 2, preco_unitario: 459.0 }],
      }),
    });
    const pedData1 = await pedRes1.json();
    assert(pedRes1.status === 201 && pedData1.pedido, 'Pedido #1 criado sem destinatário fiscal');
    const idPed1 = pedData1.pedido.id_pedido;
    idsPedidosTeste.push(idPed1);

    // Operador bloqueado
    const rbacRes = await fetch(`${BASE_URL}/fiscal/pedidos/${idPed1}/preparar-nfe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOperador}` },
    });
    assert(rbacRes.status === 403, 'Operador bloqueado com HTTP 403 ao tentar preparar/assinar NF-e');

    // Bloqueio 422 listando campo + motivo de destinatário e produto
    const prepBloqRes = await fetch(`${BASE_URL}/fiscal/pedidos/${idPed1}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    });
    const prepBloqData = await prepBloqRes.json();
    assert(
      prepBloqRes.status === 422 &&
        prepBloqData.bloqueado === true &&
        Array.isArray(prepBloqData.erros_validacao) &&
        prepBloqData.erros_validacao.some((e) => e.secao === 'destinatario' && e.campo && e.motivo) &&
        prepBloqData.erros_validacao.some((e) => e.secao === 'item' && e.campo && e.motivo),
      'Preparação bloqueada (HTTP 422) apontando campo e motivo de destinatário e produto faltantes'
    );

    const emitenteAposBloqueio = (await (await fetch(`${BASE_URL}/fiscal/emitente`, { headers: gestorHeaders })).json()).emitente;
    assert(
      Number(emitenteAposBloqueio.proximo_numero_nfe) === proxNumeroAntes,
      'Bloqueio de validação não consumiu numeração sequencial do emitente'
    );

    // 3. Completa dados fiscais do produto e destinatário (rejeita CPF inválido antes)
    console.log('\nPasso 3: Completando dados fiscais do produto e destinatário do pedido...');
    await fetch(`${BASE_URL}/produtos/${idProdutoTeste}`, {
      method: 'PUT',
      headers: gestorHeaders,
      body: JSON.stringify({
        ncm: '84241000',
        cfop: '5102',
        origem_mercadoria: '0',
        cst_csosn: '102',
        unidade_comercial: 'UN',
      }),
    });

    const cpfInvalidoRes = await fetch(`${BASE_URL}/pedidos/${idPed1}/destinatario`, {
      method: 'PATCH',
      headers: gestorHeaders,
      body: JSON.stringify({
        destinatario_documento: '11111111111',
        destinatario_cep: '01310100',
        destinatario_logradouro: 'Av Paulista',
        destinatario_numero: '100',
        destinatario_bairro: 'Bela Vista',
        destinatario_municipio: 'São Paulo',
        destinatario_uf: 'SP',
      }),
    });
    assert(cpfInvalidoRes.status === 400, 'Rejeitou CPF de destinatário inválido (HTTP 400)');

    const destOkRes = await fetch(`${BASE_URL}/pedidos/${idPed1}/destinatario`, {
      method: 'PATCH',
      headers: gestorHeaders,
      body: JSON.stringify({
        cliente_nome: 'Padaria Bella Vista Ltda',
        destinatario_documento: '45997418000153',
        destinatario_ie: 'ISENTO',
        destinatario_cep: '01310-100',
        destinatario_logradouro: 'Avenida Paulista',
        destinatario_numero: '200',
        destinatario_bairro: 'Bela Vista',
        destinatario_municipio: 'São Paulo',
        destinatario_codigo_municipio_ibge: '3550308',
        destinatario_uf: 'SP',
        destinatario_email: 'compras@bellavista.com.br',
        valor_desconto: 18.0,
      }),
    });
    assert(destOkRes.status === 200, 'Destinatário fiscal salvo no pedido #1 com sucesso');

    // 4. Prepara e assina NF-e (Critérios 1 e 3)
    console.log('\nPasso 4: Montando XML NF-e v4.00 e assinando digitalmente com A1...');
    const prepOkRes = await fetch(`${BASE_URL}/fiscal/pedidos/${idPed1}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    });
    const prepOkData = await prepOkRes.json();
    assert(prepOkRes.status === 201 && prepOkData.sucesso && prepOkData.nota_fiscal, 'NF-e preparada e assinada com HTTP 201');
    const nf1 = prepOkData.nota_fiscal;
    idsNotasTeste.push(nf1.id_nota_fiscal);

    assert(nf1.status === 'assinada' && nf1.assinatura_valida === true, 'Status persistido como "assinada" com assinatura_valida=true');
    assert(Number(nf1.numero) === proxNumeroAntes, `Número sequencial atribuído corretamente (${nf1.numero})`);

    // Verifica chave de acesso 44 dígitos + DV módulo 11
    const chave = String(nf1.chave_acesso || '');
    const dvCalculado = /^\d{44}$/.test(chave) ? calcularDigitoVerificadorChaveNFe(chave.slice(0, 43)) : '';
    assert(/^\d{44}$/.test(chave) && chave[43] === dvCalculado, 'Chave de acesso de 44 dígitos possui DV Módulo 11 válido');

    // Verifica conteúdo do XML (emitente, destinatário, itens, impostos, frete, totais, Signature)
    const xml = String(nf1.xml_assinado || '');
    assert(
      xml.includes('<NFe xmlns="http://www.portalfiscal.inf.br/nfe">') &&
        xml.includes(`<nNF>${nf1.numero}</nNF>`) &&
        xml.includes('<emit>') &&
        xml.includes('<dest>') &&
        xml.includes('<det nItem="1">') &&
        xml.includes('<NCM>84241000</NCM>') &&
        xml.includes('<vProd>918.00</vProd>') &&
        xml.includes('<vFrete>26.00</vFrete>') &&
        xml.includes('<vDesc>18.00</vDesc>') &&
        xml.includes('<vNF>926.00</vNF>') &&
        xml.includes('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">'),
      'XML NF-e v4.00 contém emitente, destinatário, itens, impostos, frete (26.00), desconto (18.00), total (926.00) e Signature'
    );

    // Verificação criptográfica real da assinatura XMLDSig
    const verifValida = verificarAssinaturaXmlNFe(xml);
    assert(verifValida.valida === true, 'Verificação criptográfica RSA-SHA1 + DigestValue SHA-1 do XML assinado aprovada');

    // Simula adulteração no XML e verifica detecção de fraude
    const xmlAdulterado = xml.replace('<vNF>926.00</vNF>', '<vNF>925.00</vNF>');
    const verifAdulterada = verificarAssinaturaXmlNFe(xmlAdulterado);
    assert(verifAdulterada.valida === false, 'Verificação detecta adulteração em 1 centavo no XML assinado');

    // Testa download XML via rota dedicada
    const xmlDownloadRes = await fetch(`${BASE_URL}/fiscal/notas/${nf1.id_nota_fiscal}/xml`, {
      headers: { Authorization: `Bearer ${tokenGestor}` },
    });
    const xmlDownloadText = await xmlDownloadRes.text();
    assert(
      xmlDownloadRes.status === 200 &&
        xmlDownloadRes.headers.get('content-type')?.includes('application/xml') &&
        xmlDownloadText === xml,
      'Endpoint GET /api/fiscal/notas/:id/xml serve o XML assinado idêntico'
    );

    // Testa idempotência ao preparar novamente o mesmo pedido
    const prepIdempRes = await fetch(`${BASE_URL}/fiscal/pedidos/${idPed1}/preparar-nfe`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({}),
    });
    const prepIdempData = await prepIdempRes.json();
    assert(
      prepIdempRes.status === 200 &&
        prepIdempData.ja_preparada === true &&
        Number(prepIdempData.nota_fiscal?.numero) === Number(nf1.numero),
      'Chamada repetida no mesmo pedido retorna a NF-e já preparada sem consumir novo número'
    );

    // 5. Teste de concorrência para garantir numeração sequencial sem repetições (Critério 5)
    console.log('\nPasso 5: Validando numeração sequencial sob chamadas concorrentes...');
    const payloadPedidoConcorrente = (nome) => ({
      cliente_nome: nome,
      origem: 'Venda Direta',
      modalidade_envio: 'Logística Própria',
      destinatario_documento: '39053344705',
      destinatario_cep: '22041001',
      destinatario_logradouro: 'Av Atlantica',
      destinatario_numero: '500',
      destinatario_bairro: 'Copacabana',
      destinatario_municipio: 'Rio de Janeiro',
      destinatario_uf: 'RJ',
      itens: [{ id_produto: idProdutoTeste, quantidade: 1, preco_unitario: 459.0 }],
    });

    const pedRes2 = await fetch(`${BASE_URL}/pedidos`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify(payloadPedidoConcorrente('Comprador Concorrente A')),
    });
    const pedRes3 = await fetch(`${BASE_URL}/pedidos`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify(payloadPedidoConcorrente('Comprador Concorrente B')),
    });
    const idPed2 = (await pedRes2.json()).pedido.id_pedido;
    const idPed3 = (await pedRes3.json()).pedido.id_pedido;
    idsPedidosTeste.push(idPed2, idPed3);

    const [concA, concB] = await Promise.all([
      fetch(`${BASE_URL}/fiscal/pedidos/${idPed2}/preparar-nfe`, {
        method: 'POST',
        headers: gestorHeaders,
        body: JSON.stringify({}),
      }).then((r) => r.json()),
      fetch(`${BASE_URL}/fiscal/pedidos/${idPed3}/preparar-nfe`, {
        method: 'POST',
        headers: gestorHeaders,
        body: JSON.stringify({}),
      }).then((r) => r.json()),
    ]);

    if (concA.nota_fiscal?.id_nota_fiscal) idsNotasTeste.push(concA.nota_fiscal.id_nota_fiscal);
    if (concB.nota_fiscal?.id_nota_fiscal) idsNotasTeste.push(concB.nota_fiscal.id_nota_fiscal);

    const nums = [Number(concA.nota_fiscal?.numero), Number(concB.nota_fiscal?.numero)].sort((a, b) => a - b);
    assert(
      nums[0] === Number(nf1.numero) + 1 && nums[1] === Number(nf1.numero) + 2,
      `Numeração sequencial estrita garantida sob concorrência (${nf1.numero} -> ${nums[0]} -> ${nums[1]})`
    );

    // Verifica que para pedido interestadual (SP -> RJ), o CFOP ajustou automaticamente para 6102
    const xmlConcA = String(concA.nota_fiscal?.xml_assinado || '');
    assert(
      xmlConcA.includes('<idDest>2</idDest>') && xmlConcA.includes('<CFOP>6102</CFOP>'),
      'Operação interestadual (SP -> RJ) ajustou automaticamente idDest=2 e CFOP=6102'
    );

    console.log('\n========================================');
    console.log(`Resultado do Teste 33c: ${passed} passaram, ${failed} falharam.`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('❌ Erro inesperado durante o teste 33c:', err);
    process.exitCode = 1;
  } finally {
    try {
      if (AppDataSource.isInitialized) {
        for (const idNf of idsNotasTeste) {
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
        if (!emitenteExistiaAntes && tokenGestor) {
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

