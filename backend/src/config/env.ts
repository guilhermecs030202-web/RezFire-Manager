import dotenv from 'dotenv';
import path from 'path';

// Carrega o arquivo .env da raiz do backend
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: Number(process.env.PORT) || 3001,
  
  // Banco de Dados MySQL
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'RezFireDB',

  // Segurança e Autenticação
  JWT_SECRET: process.env.JWT_SECRET || 'rezfire_default_secret_key_2026',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'rezfire_cookie_secret_2026',

  // Mercado Livre OAuth
  ML_CLIENT_ID: process.env.ML_CLIENT_ID || '',
  ML_CLIENT_SECRET: process.env.ML_CLIENT_SECRET || '',
  ML_REDIRECT_URI: process.env.ML_REDIRECT_URI || 'http://localhost:3001/api/ml/callback',

  // Armazenamento
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads/certificados'),
  FISCAL_ENCRYPTION_KEY: process.env.FISCAL_ENCRYPTION_KEY || '',
  FISCAL_VAULT_DIR: process.env.FISCAL_VAULT_DIR || path.resolve(__dirname, '../../uploads/fiscal-vault'),
  FISCAL_XML_ARCHIVE_DIR:
    process.env.FISCAL_XML_ARCHIVE_DIR || path.resolve(__dirname, '../../uploads/fiscal-xmls'),

  // Comunicação SEFAZ NF-e v4.00 (Stories 33d / 33f / 33g)
  SEFAZ_MODO_TRANSPORTE: (process.env.SEFAZ_MODO_TRANSPORTE || 'simulado') as 'simulado' | 'sefaz_soap',
  SEFAZ_TIMEOUT_MS: parseInt(process.env.SEFAZ_TIMEOUT_MS || '15000', 10),
  SEFAZ_PRAZO_CANCELAMENTO_HORAS: parseInt(process.env.SEFAZ_PRAZO_CANCELAMENTO_HORAS || '24', 10),
  SEFAZ_PRAZO_CANCELAMENTO_EXTEMPORANEO_HORAS: parseInt(
    process.env.SEFAZ_PRAZO_CANCELAMENTO_EXTEMPORANEO_HORAS || '480',
    10
  ),
  SEFAZ_PRAZO_CCE_DIAS: parseInt(process.env.SEFAZ_PRAZO_CCE_DIAS || '30', 10),
  FISCAL_ALERTA_CERTIFICADO_DIAS: parseInt(process.env.FISCAL_ALERTA_CERTIFICADO_DIAS || '30', 10),
};

