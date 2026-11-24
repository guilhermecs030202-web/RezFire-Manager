#!/usr/bin/env node
/**
 * setup-fiscal-producao.js
 * Configura automaticamente o arquivo backend/.env e os diretórios de armazenamento
 * para operação do módulo Fiscal & NF-e em Produção (Web Services SEFAZ-SP via mTLS/SOAP).
 *
 * Uso:
 *   npm run fiscal:setup-producao
 *   npm run fiscal:setup-producao -- --rotate-app-secrets   (também gera novos JWT_SECRET e COOKIE_SECRET)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const backendDir = path.resolve(__dirname, '..');
const envPath = path.join(backendDir, '.env');
const envExamplePath = path.join(backendDir, '.env.example');
const rotateAppSecrets = process.argv.includes('--rotate-app-secrets');

function setOrAppendEnv(content, key, value) {
  const rx = new RegExp(`^${key}=.*$`, 'm');
  if (rx.test(content)) {
    return content.replace(rx, `${key}=${value}`);
  }
  const suffix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
  return `${content}${suffix}${key}=${value}\n`;
}

function getEnvValue(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

let content = '';
if (fs.existsSync(envPath)) {
  content = fs.readFileSync(envPath, 'utf8');
} else if (fs.existsSync(envExamplePath)) {
  content = fs.readFileSync(envExamplePath, 'utf8');
  console.log('✓ Arquivo backend/.env criado a partir de backend/.env.example');
}

// 1. Chave do cofre AES-256-GCM do Certificado Digital A1
const existingFiscalKey = getEnvValue(content, 'FISCAL_ENCRYPTION_KEY');
let gerouNovaChaveFiscal = false;
if (!existingFiscalKey) {
  const strongKey = crypto.randomBytes(32).toString('hex');
  content = setOrAppendEnv(content, 'FISCAL_ENCRYPTION_KEY', strongKey);
  gerouNovaChaveFiscal = true;
}

// 2. Opcional: rotacionar JWT_SECRET e COOKIE_SECRET para produção
if (rotateAppSecrets) {
  content = setOrAppendEnv(content, 'JWT_SECRET', crypto.randomBytes(32).toString('hex'));
  content = setOrAppendEnv(content, 'COOKIE_SECRET', crypto.randomBytes(32).toString('hex'));
}

// 3. Diretórios fiscais e parâmetros SEFAZ-SP de produção
content = setOrAppendEnv(content, 'FISCAL_VAULT_DIR', './uploads/fiscal-vault');
content = setOrAppendEnv(content, 'FISCAL_XML_ARCHIVE_DIR', './uploads/fiscal-xmls');
content = setOrAppendEnv(content, 'SEFAZ_MODO_TRANSPORTE', 'sefaz_soap');
content = setOrAppendEnv(content, 'SEFAZ_TIMEOUT_MS', '20000');
content = setOrAppendEnv(content, 'SEFAZ_PRAZO_CANCELAMENTO_HORAS', '24');
content = setOrAppendEnv(content, 'SEFAZ_PRAZO_CANCELAMENTO_EXTEMPORANEO_HORAS', '480');
content = setOrAppendEnv(content, 'SEFAZ_PRAZO_CCE_DIAS', '30');
content = setOrAppendEnv(content, 'SEFAZ_PRAZO_CCE_HORAS', '720');
content = setOrAppendEnv(content, 'FISCAL_ALERTA_CERTIFICADO_DIAS', '30');

fs.writeFileSync(envPath, content.trimEnd() + '\n', 'utf8');

// 4. Garante diretórios locais para cofre do A1 e guarda legal de XMLs (5 anos)
const vaultDir = path.join(backendDir, 'uploads', 'fiscal-vault');
const xmlsDir = path.join(backendDir, 'uploads', 'fiscal-xmls');
fs.mkdirSync(vaultDir, { recursive: true });
fs.mkdirSync(xmlsDir, { recursive: true });

console.log('\n==============================================================');
console.log('RezFire Manager — Configuração Fiscal de Produção Concluída');
console.log('==============================================================');
console.log(`• Arquivo atualizado:      ${envPath}`);
console.log('• SEFAZ_MODO_TRANSPORTE:   sefaz_soap (comunicação real SEFAZ-SP)');
console.log(
  `• FISCAL_ENCRYPTION_KEY:   ${
    gerouNovaChaveFiscal
      ? 'gerada chave forte de 256 bits (oculta por segurança)'
      : 'já configurada (mantida)'
  }`
);
console.log(`• Cofre Certificado A1:    ${vaultDir}`);
console.log(`• Guarda Legal de XMLs:    ${xmlsDir}`);

const jwtVal = getEnvValue(content, 'JWT_SECRET');
if (jwtVal.includes('change_in_production') || jwtVal === '') {
  console.log('\n[AVISO] JWT_SECRET ainda usa o valor padrão de exemplo.');
  console.log('        Para publicar em servidor externo, rode também:');
  console.log('        npm run fiscal:setup-producao -- --rotate-app-secrets');
}

console.log('\nPróximos passos obrigatórios:');
console.log('1. Reinicie o servidor backend (npm run build && npm start).');
console.log('2. Acesse a aba Configuração Fiscal & NF-e (fiscal.html) como GESTOR.');
console.log('3. Cadastre o Emitente, instale o e-CNPJ A1 (.pfx/.p12) e teste a conexão SEFAZ.');
console.log('4. Ative o Ambiente de Produção confirmando "ATIVAR PRODUCAO".\n');

