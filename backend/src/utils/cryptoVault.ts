import crypto from 'crypto';
import { env } from '../config/env';

const VAULT_HEADER = Buffer.from('RFV1', 'ascii');
const VAULT_SALT = 'rezfire-nfe-vault-salt-v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const secretSource = (env.FISCAL_ENCRYPTION_KEY || env.JWT_SECRET || '').trim();
  if (!secretSource) {
    throw new Error('Chave de criptografia fiscal não configurada no ambiente.');
  }
  return crypto.scryptSync(secretSource, VAULT_SALT, 32);
}

/**
 * Cifra um buffer binário (ex: certificado PKCS#12 .pfx/.p12) com AES-256-GCM.
 * Formato resultante: [4 bytes 'RFV1'][12 bytes IV][16 bytes AuthTag][ciphertext]
 */
export function encryptBuffer(plain: Buffer): Buffer {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([VAULT_HEADER, iv, authTag, encrypted]);
}

/**
 * Decifra um buffer previamente protegido por encryptBuffer.
 */
export function decryptBuffer(encrypted: Buffer): Buffer {
  const minLength = VAULT_HEADER.length + IV_LENGTH + AUTH_TAG_LENGTH;
  if (!encrypted || encrypted.length < minLength) {
    throw new Error('Arquivo do cofre fiscal inválido ou truncado.');
  }

  const header = encrypted.subarray(0, VAULT_HEADER.length);
  if (!header.equals(VAULT_HEADER)) {
    throw new Error('Formato do arquivo cifrado no cofre fiscal é inválido.');
  }

  const key = getMasterKey();
  const ivStart = VAULT_HEADER.length;
  const tagStart = ivStart + IV_LENGTH;
  const cipherStart = tagStart + AUTH_TAG_LENGTH;

  const iv = encrypted.subarray(ivStart, tagStart);
  const authTag = encrypted.subarray(tagStart, cipherStart);
  const ciphertext = encrypted.subarray(cipherStart);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Cifra uma string sensível (ex: senha do certificado A1) com AES-256-GCM.
 * Retorna no formato v1:<ivHex>:<tagHex>:<cipherHex>.
 */
export function encryptText(plain: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decifra uma string protegida por encryptText.
 */
export function decryptText(payload: string): string {
  if (!payload || typeof payload !== 'string') {
    throw new Error('Segredo cifrado inválido.');
  }
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Formato de segredo cifrado incompatível.');
  }

  const [, ivHex, tagHex, cipherHex] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export function sha256Hex(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

