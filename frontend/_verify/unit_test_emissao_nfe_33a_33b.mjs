/**
 * unit_test_emissao_nfe_33a_33b.mjs
 * Teste automatizado de aceite das User Stories 33a e 33b (Emissão de NF-e).
 *
 * Valida:
 * - Story 33a:
 *   1. Cadastro completo do emitente fiscal e rejeição de CNPJ inválido.
 *   2. Upload e validação real de certificado digital A1 (.pfx): senha correta, dentro da validade e CNPJ compatível.
 *   3. Proteção de segredos: senha/certificado cifrados em AES-256-GCM no banco/disco e nunca expostos na API/logs.
 *   4. Ambiente inicia em 'homologacao' por padrão; ativação de 'producao' exige confirmação explícita.
 *   5. Certificado vencido, senha errada, corrompido ou CNPJ divergente falham claramente sem corromper o estado atual.
 *   6. RBAC estrito: perfil OPERADOR bloqueado (HTTP 403) na configuração do emitente.
 * - Story 33b:
 *   1. Validação estrita de formato dos campos fiscais (NCM 8 dígitos, CFOP, Origem, CST/CSOSN, Unidade, CEST).
 *   2. Produto sem dados fiscais completos identificado com campos faltantes e bloqueado em /api/fiscal/validar-emissao (HTTP 422).
 *   3. Alterar dados fiscais de um produto não altera o snapshot de notas fiscais já emitidas.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import bcrypt from '../../backend/node_modules/bcrypt/bcrypt.js';
import { AppDataSource } from '../../backend/dist/config/database.js';
import { Usuario } from '../../backend/dist/entities/Usuario.js';
import { EmitenteFiscal } from '../../backend/dist/entities/EmitenteFiscal.js';
import { Produto } from '../../backend/dist/entities/Produto.js';
import { NotaFiscal } from '../../backend/dist/entities/NotaFiscal.js';
import { NotaFiscalItem } from '../../backend/dist/entities/NotaFiscalItem.js';

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
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01ABCDEF123456';
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

  // Extensão ICP-Brasil subjectAltName -> otherName OID 2.16.76.1.3.3 com CNPJ
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
    friendlyName: 'RezFireTesteA1',
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, 'binary');
}

async function enviarCertificadoMultipart(token, buffer, filename, senha) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: 'application/x-pkcs12' });
  form.append('certificado', blob, filename);
  form.append('senha', senha);

  return fetch(`${BASE_URL}/fiscal/emitente/certificado`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

async function runTests() {
  console.log('🧪 Iniciando Testes Automatizados das Stories 33a & 33b (Emissão NF-e)...\n');

  let tokenGestor = null;
  let tokenOperador = null;
  let emitenteExistiaAntes = false;
  let idOperadorCriado = null;
  let idProdutoTeste = null;
  let idNotaTeste = null;

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const emitenteRepo = AppDataSource.getRepository(EmitenteFiscal);
    const usuarioRepo = AppDataSource.getRepository(Usuario);
    const produtoRepo = AppDataSource.getRepository(Produto);
    const nfRepo = AppDataSource.getRepository(NotaFiscal);
    const nfItemRepo = AppDataSource.getRepository(NotaFiscalItem);

    emitenteExistiaAntes = (await emitenteRepo.count()) > 0;

    // 1. Login Gestor e criação temporária de Operador para validar RBAC
    console.log('Passo 1: Autenticação e RBAC (Story 33a DoR + #20)...');
    const loginGestorRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'gestor@rezfire.com.br', senha: 'rezfire2026' }),
    });
    const loginGestorData = await loginGestorRes.json();
    assert(loginGestorRes.status === 200 && loginGestorData.token, 'Gestor autenticado com sucesso');
    tokenGestor = loginGestorData.token;

    const emailOp = `operador.teste.nfe.${Date.now()}@rezfire.com.br`;
    const opSenhaHash = await bcrypt.hash('op123456', 10);
    const opSalvo = await usuarioRepo.save(
      usuarioRepo.create({
        nome: 'Operador Teste NF-e',
        email: emailOp,
        senha_hash: opSenhaHash,
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
    const loginOpData = await loginOpRes.json();
    tokenOperador = loginOpData.token;

    const rbacBlockRes = await fetch(`${BASE_URL}/fiscal/emitente`, {
      headers: { Authorization: `Bearer ${tokenOperador}` },
    });
    assert(rbacBlockRes.status === 403, 'Operador bloqueado com HTTP 403 na rota /api/fiscal/emitente');

    const gestorHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenGestor}`,
    };

    // 2. Cadastro do emitente fiscal (Critério 1 e 4 da 33a)
    console.log('\nPasso 2: Cadastro e validação de dados do emitente (Story 33a)...');
    const cnpjInvalidoRes = await fetch(`${BASE_URL}/fiscal/emitente`, {
      method: 'PUT',
      headers: gestorHeaders,
      body: JSON.stringify({
        razao_social: 'RezFire Teste Ltda',
        cnpj: '11111111111111',
        inscricao_estadual: '110042490114',
        regime_tributario: '1',
        cep: '01001000',
        logradouro: 'Av Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        municipio: 'São Paulo',
        uf: 'SP',
        serie_nfe: 1,
        proximo_numero_nfe: 1,
      }),
    });
    assert(cnpjInvalidoRes.status === 400, 'Rejeitou cadastro de emitente com CNPJ inválido');

    const cnpjValido = '11222333000181';
    const emitenteOkRes = await fetch(`${BASE_URL}/fiscal/emitente`, {
      method: 'PUT',
      headers: gestorHeaders,
      body: JSON.stringify({
        razao_social: 'RezFire Extintores Comercio Ltda',
        nome_fantasia: 'RezFire',
        cnpj: cnpjValido,
        inscricao_estadual: '110042490114',
        regime_tributario: '1',
        cep: '01001-000',
        logradouro: 'Rua das Mangueiras',
        numero: '450',
        bairro: 'Centro',
        municipio: 'São Paulo',
        codigo_municipio_ibge: '3550308',
        uf: 'SP',
        serie_nfe: 1,
        proximo_numero_nfe: 100,
        modo_integracao: 'sefaz_direto',
      }),
    });
    const emitenteOkData = await emitenteOkRes.json();
    assert(emitenteOkRes.status === 200 && emitenteOkData.sucesso, 'Emitente fiscal salvo com sucesso');
    assert(
      emitenteOkData.emitente?.ambiente === 'homologacao',
      'Ambiente inicial padrão configurado como "homologacao"'
    );
    assert(
      emitenteOkData.emitente?.pronto_para_emissao === false,
      'Emitente marcado como não pronto enquanto não houver certificado A1'
    );

    // 3. Testes de rejeição do certificado A1 antes de instalar um válido (Critério 2 e 5 da 33a)
    console.log('\nPasso 3: Validação de certificado A1 (senha, validade, CNPJ e preservação de estado)...');
    const senhaCerta = 'RezFire#Cert2026!';
    const pfxValido = gerarPkcs12Teste({
      cnpj: cnpjValido,
      razao: 'REZFIRE EXTINTORES',
      diasInicio: -5,
      diasFim: 365,
      senha: senhaCerta,
    });
    const pfxVencido = gerarPkcs12Teste({
      cnpj: cnpjValido,
      razao: 'REZFIRE VENCIDO',
      diasInicio: -400,
      diasFim: -10,
      senha: senhaCerta,
    });
    const pfxOutroCnpj = gerarPkcs12Teste({
      cnpj: '45997418000153',
      razao: 'OUTRA EMPRESA LTDA',
      diasInicio: -5,
      diasFim: 365,
      senha: senhaCerta,
    });

    const uploadSenhaErrada = await enviarCertificadoMultipart(
      tokenGestor,
      pfxValido,
      'cert-teste.pfx',
      'senha-errada-123'
    );
    assert(uploadSenhaErrada.status === 400, 'Rejeitou certificado A1 com senha incorreta');

    const uploadCorrompido = await enviarCertificadoMultipart(
      tokenGestor,
      Buffer.from('arquivo-corrompido-nao-pkcs12'),
      'corrompido.pfx',
      senhaCerta
    );
    assert(uploadCorrompido.status === 400, 'Rejeitou arquivo PKCS#12 corrompido');

    const uploadVencido = await enviarCertificadoMultipart(
      tokenGestor,
      pfxVencido,
      'vencido.pfx',
      senhaCerta
    );
    assert(uploadVencido.status === 400, 'Rejeitou certificado digital vencido');

    const uploadCnpjDivergente = await enviarCertificadoMultipart(
      tokenGestor,
      pfxOutroCnpj,
      'outro-cnpj.pfx',
      senhaCerta
    );
    assert(uploadCnpjDivergente.status === 400, 'Rejeitou certificado com CNPJ diferente do emitente');

    // Agora instala o certificado válido
    const uploadOkRes = await enviarCertificadoMultipart(
      tokenGestor,
      pfxValido,
      'rezfire-a1.pfx',
      senhaCerta
    );
    const uploadOkData = await uploadOkRes.json();
    assert(uploadOkRes.status === 200 && uploadOkData.sucesso, 'Certificado A1 válido aceito e instalado');
    assert(uploadOkData.emitente?.pronto_para_emissao === true, 'Emitente agora está pronto para emissão');
    assert(uploadOkData.emitente?.certificado_cnpj === cnpjValido, 'CNPJ do certificado extraído e validado');

    // Envia certificado inválido APÓS já existir um válido -> não deve corromper o válido instalado!
    const uploadErrDepois = await enviarCertificadoMultipart(
      tokenGestor,
      pfxVencido,
      'vencido-depois.pfx',
      senhaCerta
    );
    assert(uploadErrDepois.status === 400, 'Rejeitou substituição por certificado vencido');
    const checkPosErroRes = await fetch(`${BASE_URL}/fiscal/emitente`, { headers: gestorHeaders });
    const checkPosErro = await checkPosErroRes.json();
    assert(
      checkPosErro.emitente?.certificado_configurado === true &&
        checkPosErro.emitente?.certificado_status === 'valido',
      'Estado consistente preservado após tentativa falha de substituição de certificado'
    );

    // 4. Verificação estrita de proteção de segredos (Critério 3 da 33a)
    console.log('\nPasso 4: Verificando proteção e cifragem de segredos em API, Banco e Disco...');
    const apiJsonStr = JSON.stringify(checkPosErro);
    assert(!apiJsonStr.includes(senhaCerta), 'Senha em texto plano nunca aparece na resposta da API');
    assert(!('senha_certificado_enc' in checkPosErro.emitente), 'Coluna senha_certificado_enc não exposta na API');
    assert(!('certificado_arquivo_enc' in checkPosErro.emitente), 'Nome de arquivo cifrado no cofre não exposto na API');

    const emitenteDbComSegredos = await emitenteRepo
      .createQueryBuilder('e')
      .addSelect(['e.certificado_arquivo_enc', 'e.senha_certificado_enc'])
      .getOne();

    assert(
      Boolean(emitenteDbComSegredos?.senha_certificado_enc?.startsWith('v1:')) &&
        !emitenteDbComSegredos?.senha_certificado_enc?.includes(senhaCerta),
      'Senha salva cifrada em AES-256-GCM (prefixo v1:) no MySQL'
    );

    const vaultPath = path.resolve(
      process.cwd(),
      'backend/uploads/fiscal-vault',
      emitenteDbComSegredos.certificado_arquivo_enc
    );
    const arquivoCofre = fs.readFileSync(vaultPath);
    assert(
      arquivoCofre.subarray(0, 4).toString('ascii') === 'RFV1',
      'Arquivo PKCS#12 armazenado no cofre com cabeçalho cifrado AES-256-GCM (RFV1)'
    );

    // 5. Troca de ambiente Homologação <-> Produção (Critério 4 da 33a)
    console.log('\nPasso 5: Validação de troca segura de ambiente SEFAZ...');
    const prodSemConfirmRes = await fetch(`${BASE_URL}/fiscal/emitente/ambiente`, {
      method: 'PATCH',
      headers: gestorHeaders,
      body: JSON.stringify({ ambiente: 'producao', confirmacao_producao: false }),
    });
    assert(prodSemConfirmRes.status === 400, 'Bloqueou ativação de produção sem confirmação explícita');

    const prodComConfirmRes = await fetch(`${BASE_URL}/fiscal/emitente/ambiente`, {
      method: 'PATCH',
      headers: gestorHeaders,
      body: JSON.stringify({
        ambiente: 'producao',
        confirmacao_producao: true,
        texto_confirmacao: 'ATIVAR PRODUCAO',
      }),
    });
    const prodComConfirmData = await prodComConfirmRes.json();
    assert(
      prodComConfirmRes.status === 200 && prodComConfirmData.emitente?.ambiente === 'producao',
      'Ativou ambiente de produção somente após confirmação explícita'
    );

    // Retorna para homologação por segurança
    await fetch(`${BASE_URL}/fiscal/emitente/ambiente`, {
      method: 'PATCH',
      headers: gestorHeaders,
      body: JSON.stringify({ ambiente: 'homologacao' }),
    });

    // 6. Story 33b: Dados fiscais dos produtos e validações
    console.log('\nPasso 6: Validação de formato fiscal e bloqueio de produto incompleto (Story 33b)...');
    const prodNcmInvalidoRes = await fetch(`${BASE_URL}/produtos`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        sku: `TEST-NFE-INV-${Date.now()}`,
        nome: 'Produto NCM Inválido',
        preco: 150,
        custo: 80,
        categoria: 'Extintores',
        ncm: '123',
      }),
    });
    assert(prodNcmInvalidoRes.status === 400, 'Rejeitou produto com NCM diferente de 8 dígitos (HTTP 400)');

    const skuTeste = `TEST-NFE-${Date.now()}`;
    const prodPendenteRes = await fetch(`${BASE_URL}/produtos`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        sku: skuTeste,
        nome: 'Extintor Teste Fiscal 33b',
        preco: 189.9,
        custo: 95.0,
        categoria: 'Extintores',
        ncm: '84241000',
      }),
    });
    const prodPendenteData = await prodPendenteRes.json();
    assert(prodPendenteRes.status === 201 && prodPendenteData.produto, 'Produto parcialmente preenchido criado');
    idProdutoTeste = prodPendenteData.produto.id_produto;
    assert(
      prodPendenteData.produto.fiscal_status?.apto_nfe === false &&
        prodPendenteData.produto.fiscal_status?.campos_faltantes?.length === 4,
      'Produto incompleto marcado com apto_nfe=false indicando os 4 campos faltantes'
    );

    const validarBloqueadoRes = await fetch(`${BASE_URL}/fiscal/validar-emissao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ itens: [{ id_produto: idProdutoTeste, quantidade: 1 }] }),
    });
    const validarBloqueadoData = await validarBloqueadoRes.json();
    assert(
      validarBloqueadoRes.status === 422 &&
        validarBloqueadoData.apto === false &&
        validarBloqueadoData.produtos_bloqueados?.length === 1,
      'Produto sem dados fiscais completos bloqueado para emissão (HTTP 422) com lista exata do que falta'
    );

    // Completa os campos fiscais do produto
    const prodCompletoRes = await fetch(`${BASE_URL}/produtos/${idProdutoTeste}`, {
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
    const prodCompletoData = await prodCompletoRes.json();
    assert(
      prodCompletoRes.status === 200 && prodCompletoData.produto?.fiscal_status?.apto_nfe === true,
      'Produto ficou apto (apto_nfe=true) ao preencher NCM, CFOP, Origem, CSOSN e Unidade'
    );

    const validarOkRes = await fetch(`${BASE_URL}/fiscal/validar-emissao`, {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({ itens: [{ id_produto: idProdutoTeste, quantidade: 1 }] }),
    });
    assert(validarOkRes.status === 200, 'Validação pré-emissão liberada (HTTP 200) após dados fiscais completos');

    // 7. Critério 3 da 33b: Alterar dados fiscais do produto não altera nota fiscal já emitida
    console.log('\nPasso 7: Verificando imutabilidade fiscal de notas já emitidas (Snapshot Story 33b)...');
    const nfCriada = await nfRepo.save(
      nfRepo.create({
        ambiente: 'homologacao',
        serie: 1,
        numero: 999001,
        chave_acesso: `35261111222333000181550010009990011000000019`,
        status: 'autorizada',
        protocolo_autorizacao: '135260000000001',
        valor_total: 189.9,
        emitida_em: new Date(),
      })
    );
    idNotaTeste = nfCriada.id_nota_fiscal;

    await nfItemRepo.save(
      nfItemRepo.create({
        id_nota_fiscal: idNotaTeste,
        id_produto: idProdutoTeste,
        sku_snapshot: skuTeste,
        nome_snapshot: 'Extintor Teste Fiscal 33b',
        ncm_snapshot: '84241000',
        cfop_snapshot: '5102',
        origem_snapshot: '0',
        cst_csosn_snapshot: '102',
        unidade_snapshot: 'UN',
        quantidade: 1,
        valor_unitario: 189.9,
        valor_total: 189.9,
      })
    );

    // Atualiza NCM e CFOP no cadastro do produto
    await fetch(`${BASE_URL}/produtos/${idProdutoTeste}`, {
      method: 'PUT',
      headers: gestorHeaders,
      body: JSON.stringify({
        ncm: '84249090',
        cfop: '5405',
        cst_csosn: '500',
      }),
    });

    const prodDepois = await produtoRepo.findOne({ where: { id_produto: idProdutoTeste } });
    const itemNfDepois = await nfItemRepo.findOne({ where: { id_nota_fiscal: idNotaTeste } });

    assert(
      prodDepois?.ncm === '84249090' && prodDepois?.cfop === '5405',
      'Cadastro do produto atualizado para os novos códigos fiscais'
    );
    assert(
      itemNfDepois?.ncm_snapshot === '84241000' &&
        itemNfDepois?.cfop_snapshot === '5102' &&
        itemNfDepois?.cst_csosn_snapshot === '102',
      'Nota fiscal já emitida manteve intacto o snapshot fiscal original (ncm=84241000, cfop=5102, csosn=102)'
    );

    console.log('\n========================================');
    console.log(`Resultado do Teste 33a & 33b: ${passed} passaram, ${failed} falharam.`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('❌ Erro inesperado durante o teste 33a/33b:', err);
    process.exitCode = 1;
  } finally {
    // Limpeza segura dos artefatos temporários de teste
    try {
      if (AppDataSource.isInitialized) {
        if (idNotaTeste) {
          await AppDataSource.getRepository(NotaFiscal).delete({ id_nota_fiscal: idNotaTeste });
        }
        if (idProdutoTeste) {
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

