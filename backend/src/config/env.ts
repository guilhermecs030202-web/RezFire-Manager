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
};

