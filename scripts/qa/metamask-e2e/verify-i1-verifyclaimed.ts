/**
 * QA · I-1 · /r/[id] VERIFIED chip gated on real verifyClaimed.
 *
 * Asserts:
 *   1. apps/studio/src/app/r/[id]/page.tsx imports verifyClaimed from
 *      '@ivaronix/receipts'.
 *   2. The page calls verifyClaimed(local) server-side (not just
 *      `hasLocalBody ? 'verified' : 'pending'`).
 *   3. The page maps the verify result to the chip state:
 *        INVALID → mismatch (red, with failedCheck reason)
 *        CLAIMED → verified (green)
 *        absent  → pending
 *   4. /r/1004 still renders VERIFIED green (regression sanity — the
 *      receipt's schema/hash/signature pass; only Storage + TEE were
 *      pending under the new gating from S-2).
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO_BASE = process.env.IVARONIX_STUDIO_BASE ?? 'http://localhost:3300';

(async () => {
  console.log('───────────────────────────────────────────────────────────────');
  console.log('I-1 · /r/[id] VERIFIED chip gated on verifyClaimed');
  console.log('───────────────────────────────────────────────────────────────');

  const path = resolve(REPO, 'apps/studio/src/app/r/[id]/page.tsx');
  const src = readFileSync(path, 'utf8');

  assert.ok(
    /import\s*\{[^}]*verifyClaimed[^}]*\}\s*from\s*'@ivaronix\/receipts'/m.test(src),
    'page.tsx must import verifyClaimed from @ivaronix/receipts',
  );
  console.log('   import verifyClaimed from @ivaronix/receipts');

  assert.ok(
    /claimResult\s*=\s*verifyClaimed\(local\)/m.test(src),
    'page.tsx must call verifyClaimed(local) server-side',
  );
  console.log('   verifyClaimed(local) called server-side');

  assert.ok(
    /claimResult\.state\s*===\s*'INVALID'/m.test(src),
    'page.tsx must branch on claimResult.state === INVALID',
  );
  assert.ok(
    /claimResult\.state\s*===\s*'CLAIMED'/m.test(src),
    'page.tsx must branch on claimResult.state === CLAIMED',
  );
  console.log('   chip state branches on verifyClaimed result');

  // The old `hasLocalBody ? 'verified' : 'pending'` lie is gone.
  assert.ok(
    !/hasLocalBody\s*\?\s*'verified'\s*:\s*'pending'/m.test(src),
    'page.tsx must no longer gate overallState on hasLocalBody alone',
  );
  console.log('   old hasLocalBody-only gate removed');

  // Live check: /r/1004 still renders verified for the chip.
  const res = await fetch(`${STUDIO_BASE}/r/1004`);
  assert.equal(res.status, 200, `/r/1004 returned ${res.status}`);
  const html = await res.text();
  assert.ok(
    /chip-verified[^>]*>VERIFIED<\/span>/.test(html) || /chip-verified[^>]*role="status"[^>]*>VERIFIED/.test(html),
    'live: /r/1004 must still render chip-verified after the I-1 change (signature on #1004 is valid)',
  );
  console.log('   live: /r/1004 still renders VERIFIED chip');

  console.log('───────────────────────────────────────────────────────────────');
  console.log('I-1 verified');
  console.log('───────────────────────────────────────────────────────────────');
})().catch((err) => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
