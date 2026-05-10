import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

/**
 * Burn Mode — AES-256-GCM session key encryption with explicit key destruction.
 *
 * Per RECEIPTS_SPEC.md §5 and COMPONENTS.md §14:
 * - Generate random 256-bit session key
 * - Encrypt payload with AES-256-GCM
 * - Capture key fingerprint (sha256 of key bytes) BEFORE destruction
 * - Zero the key buffer
 * - Caller is responsible for vacuuming any tmp paths that held plaintext
 *
 * Honest scope (per COMPONENTS.md §14): Burn Mode protects against operator-side
 * disclosure. It does NOT protect against compromise of the user's local machine.
 */

const ALGO = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const NONCE_LENGTH = 12; // GCM standard
const TAG_LENGTH = 16;

export interface BurnEncryptResult {
  /** Ciphertext blob: nonce (12) + ciphertext + auth-tag (16). Self-contained. */
  ciphertext: Uint8Array;
  /** SHA-256 fingerprint of the key BEFORE destruction. */
  keyFingerprint: `sha256:${string}`;
  /** Algorithm tag for the receipt. */
  encryptionType: 'aes-256-gcm';
  /** Wall-clock ms when the key was zeroed. */
  destroyedAt: number;
}

/**
 * Encrypt plaintext under a freshly-generated session key, then zero the key.
 * Returns the ciphertext blob + key fingerprint. The key is unrecoverable after this returns.
 */
export function burnEncrypt(plaintext: Uint8Array | Buffer): BurnEncryptResult {
  const key = randomBytes(KEY_LENGTH);
  const nonce = randomBytes(NONCE_LENGTH);

  // Capture fingerprint BEFORE destroying the key
  const keyFingerprint =
    `sha256:${createHash('sha256').update(key).digest('hex')}` as `sha256:${string}`;

  // Encrypt
  const cipher = createCipheriv(ALGO, key, nonce);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Compose self-contained blob: nonce || ciphertext || tag
  const ciphertext = Buffer.concat([nonce, ct, tag]);

  // Destroy the key — overwrite buffer with zeros
  key.fill(0);
  const destroyedAt = Date.now();

  return {
    ciphertext: new Uint8Array(ciphertext),
    keyFingerprint,
    encryptionType: 'aes-256-gcm',
    destroyedAt,
  };
}

/**
 * Decrypt ciphertext given a known key.
 * Note: Burn Mode receipts CANNOT be decrypted — the key is gone. This function
 * is only useful for callers who held the key separately (e.g., wallet-mode
 * encryption — queued in USER_TODO §B-V2; not implemented today).
 */
export function decryptWithKey(blob: Uint8Array, key: Uint8Array): Uint8Array {
  if (key.length !== KEY_LENGTH) throw new Error('decryptWithKey: key must be 32 bytes');
  if (blob.length < NONCE_LENGTH + TAG_LENGTH) throw new Error('decryptWithKey: blob too short');

  const buf = Buffer.from(blob);
  const nonce = buf.subarray(0, NONCE_LENGTH);
  const tag = buf.subarray(buf.length - TAG_LENGTH);
  const ct = buf.subarray(NONCE_LENGTH, buf.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGO, Buffer.from(key), nonce);
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(ct), decipher.final()]));
}
