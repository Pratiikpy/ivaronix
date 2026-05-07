import { createCipheriv, createDecipheriv, createHash, scryptSync } from 'node:crypto';

/**
 * Memory-at-rest encryption using AES-256-GCM with a key derived from the owner's
 * private key + a fixed namespace salt. The key is recomputed on demand and never
 * persisted; users with the private key (and no one else) can read their memory.
 *
 * Note: this is distinct from Burn Mode (Day 4), which destroys the session key.
 * For long-term memory the key MUST be recoverable so the user can re-read later.
 */

const SALT = Buffer.from('ivaronix-memory-v1', 'utf8');
const NONCE_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

/** Derive a 256-bit memory key from the owner's private key (deterministic). */
export function deriveMemoryKey(privateKey: string): Buffer {
  // Strip 0x prefix if present
  const keyHex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
  const seed = Buffer.from(keyHex, 'hex');
  // scrypt is intentionally slow; key derivation runs at most once per session
  // and the cost is dwarfed by Router/RPC latency. Parameters chosen for ~100ms target.
  return scryptSync(seed, SALT, KEY_LEN, { N: 16384, r: 8, p: 1 });
}

export function encryptObservation(plaintext: string, key: Buffer): Uint8Array {
  const nonce = createHash('sha256')
    .update(Buffer.from(plaintext, 'utf8'))
    .update(Date.now().toString())
    .digest()
    .subarray(0, NONCE_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: nonce || ciphertext || tag
  return new Uint8Array(Buffer.concat([nonce, ct, tag]));
}

export function decryptObservation(blob: Uint8Array, key: Buffer): string {
  if (blob.length < NONCE_LEN + TAG_LEN) throw new Error('decryptObservation: blob too short');
  const buf = Buffer.from(blob);
  const nonce = buf.subarray(0, NONCE_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ct = buf.subarray(NONCE_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
