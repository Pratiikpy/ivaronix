/**
 * Verify that the inline base64 TTF round-trips to the source bytes
 * exactly. If this script fails, do not commit — the b64.ts is corrupt
 * and OG images on Vercel will render gibberish (or fail to render).
 *
 * Runs in CI via `pnpm tsx scripts/diag/verify-og-font-b64.ts`. Pair
 * with `regenerate-og-font-b64.ts` whenever the .ttf is updated.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTFIT_SEMIBOLD_B64 } from '../../apps/studio/src/lib/fonts/Outfit-SemiBold.b64.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TTF_PATH = resolve(HERE, '..', '..', 'apps/studio/src/lib/fonts/Outfit-SemiBold.ttf');

const decoded = Buffer.from(OUTFIT_SEMIBOLD_B64, 'base64');
const original = readFileSync(TTF_PATH);

const decodedHash = createHash('sha256').update(decoded).digest('hex');
const originalHash = createHash('sha256').update(original).digest('hex');

console.log('decoded bytes:', decoded.length);
console.log('original bytes:', original.length);
console.log('decoded sha256:', decodedHash);
console.log('original sha256:', originalHash);

const magic = Array.from(decoded.subarray(0, 4))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join(' ');
console.log('TTF magic bytes:', magic, '(expected: 00 01 00 00)');

const match = decodedHash === originalHash && decoded.length === original.length;
const magicOk = magic === '00 01 00 00';

if (!match) {
  console.error('FAIL · b64.ts round-trip does not match Outfit-SemiBold.ttf');
  console.error('  regenerate via: pnpm tsx scripts/diag/regenerate-og-font-b64.ts');
  process.exit(1);
}
if (!magicOk) {
  console.error('FAIL · decoded bytes are not a valid TTF (magic mismatch)');
  process.exit(1);
}

console.log('PASS · b64.ts round-trips to Outfit-SemiBold.ttf byte-exact');
