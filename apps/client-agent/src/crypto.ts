// ====================================================================
// NexusHub Client Agent: Cryptography Service (AES-256-GCM / SEAL_SIMULATED)
// ====================================================================

import * as crypto from 'crypto';

// 32-byte key derived from shared simulated secret
const MASTER_SECRET = process.env.SEAL_SECRET_KEY || 'nexushub-standard-splp-secret-key-2026';
const CIPHER_KEY = crypto.scryptSync(MASTER_SECRET, 'nexushub-salt', 32);

export interface EncryptionResult {
  ciphertext: string; // Base64
  algorithm: string;  // AES-256-GCM
  iv: string;         // Hex
  tag: string;        // Hex
}

/**
 * Encrypts arbitrary payload using AES-256-GCM
 */
export function encryptPayload(payload: any): EncryptionResult {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', CIPHER_KEY, iv);
  
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(payloadString, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    algorithm: 'AES-256-GCM',
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
}

/**
 * Decrypts AES-256-GCM encrypted payload
 */
export function decryptPayload(ciphertext: string, ivHex?: string, tagHex?: string): any {
  if (!ciphertext || !ivHex || !tagHex) {
    throw new Error('Missing ciphertext, iv, or auth tag for AES-256-GCM decryption');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', CIPHER_KEY, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final()
  ]);

  const rawString = decrypted.toString('utf8');
  try {
    return JSON.parse(rawString);
  } catch {
    return rawString;
  }
}

