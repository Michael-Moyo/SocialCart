import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env['ENCRYPTION_KEY'];
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is required');
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be a 32-byte (64-char hex) string');
  return buf;
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns: iv:authTag:ciphertext (all base64)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

/**
 * Decrypt a string encrypted with encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');

  const [ivB64, authTagB64, encryptedB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

/**
 * Encrypt a JSON-serializable object
 */
export function encryptObject(obj: Record<string, unknown>): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt and parse a JSON object
 */
export function decryptObject<T = Record<string, unknown>>(ciphertext: string): T {
  return JSON.parse(decrypt(ciphertext)) as T;
}
