import { createHash } from 'node:crypto';

/** SHA-256 hex digest of a UTF-8 string. Returns `sha256:<64-hex>`. */
export function sha256HexAsync(content: string | Uint8Array): `sha256:${string}` {
  const hash = createHash('sha256');
  hash.update(typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content));
  return `sha256:${hash.digest('hex')}` as `sha256:${string}`;
}
