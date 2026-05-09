/**
 * QA · I-2 / K-16 · Studio Burn Mode runs real AES-256-GCM encryption.
 *
 * Asserts:
 *   1. pipeline.ts imports `burnEncrypt` from `@ivaronix/og-storage`.
 *   2. pipeline.ts calls `burnEncrypt(Buffer.from(activeContext, 'utf8'))`
 *      when burnEnabled — was `sha256("burn:" + skillId + ...)` (a fake
 *      fingerprint over a deterministic label, no real key, no real
 *      encryption).
 *   3. pipeline.ts source contains zero references to the old
 *      `await sha256HexAsync(\`burn:${skill.id}` pattern.
 *   4. Two runs with the same input produce DIFFERENT keyFingerprints
 *      (the old deterministic fingerprint would have been identical;
 *      randomBytes(32) makes them unique).
 *
 * The runtime path is exercised by the CLI test, not via /api/run live
 * here (a burn-mode /api/run requires SIWE + a Galileo-anchored run,
 * heavyweight for a single QA invocation).
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

(async () => {
  console.log('───────────────────────────────────────────────────────────────');
  console.log('I-2 / K-16 · Studio Burn Mode real AES-256-GCM encryption');
  console.log('───────────────────────────────────────────────────────────────');

  const path = resolve(REPO, 'packages/runtime/src/pipeline.ts');
  const src = readFileSync(path, 'utf8');

  assert.ok(
    /import\s*\{\s*burnEncrypt\s*\}\s*from\s*'@ivaronix\/og-storage'/m.test(src),
    'pipeline.ts must import burnEncrypt from @ivaronix/og-storage',
  );
  console.log('   pipeline.ts imports burnEncrypt');

  assert.ok(
    /burnEncrypt\(Buffer\.from\(activeContext,\s*'utf8'\)\)/m.test(src),
    'pipeline.ts must call burnEncrypt(Buffer.from(activeContext, "utf8")) when burnEnabled',
  );
  console.log('   pipeline.ts calls burnEncrypt with the run context');

  // The old code had `await sha256HexAsync(\`burn:${skill.id}:${userPromptHash}:${sessionKeyDestroyedAt}\`)`.
  // The fix removed it — assert that exact pattern is gone.
  assert.ok(
    !/sha256HexAsync\(\s*`burn:\$\{skill\.id\}/m.test(src),
    'pipeline.ts must NOT compute keyFingerprint from a deterministic burn-label hash — see HALF_BAKED.md I-2/K-16',
  );
  console.log('   old fake-fingerprint sha256("burn:..." + ...) pattern absent');

  // Quick functional check: two consecutive burnEncrypt calls on the same
  // plaintext produce different keyFingerprints. Exercises the underlying
  // primitive directly so the test does not need a live Galileo anchor.
  // Use relative import — the verify scripts are outside the workspace
  // dependency graph, so the workspace alias would not resolve.
  const ogStorageMod = await import(
    'file:///' + resolve(REPO, 'packages/og-storage/src/burn.ts').replace(/\\/g, '/')
  );
  const { burnEncrypt } = ogStorageMod as { burnEncrypt: (buf: Buffer) => { keyFingerprint: string; ciphertext: Uint8Array } };
  const a = burnEncrypt(Buffer.from('the same plaintext both times', 'utf8'));
  const b = burnEncrypt(Buffer.from('the same plaintext both times', 'utf8'));
  assert.notEqual(
    a.keyFingerprint,
    b.keyFingerprint,
    'burnEncrypt must produce different fingerprints on repeat calls (key randomness invariant)',
  );
  // And the ciphertexts must also differ (random IV).
  assert.notEqual(
    Buffer.from(a.ciphertext).toString('hex'),
    Buffer.from(b.ciphertext).toString('hex'),
  );
  console.log('   burnEncrypt round-trip: distinct fingerprints + distinct ciphertexts on repeat');

  console.log('───────────────────────────────────────────────────────────────');
  console.log('I-2 / K-16 verified');
  console.log('───────────────────────────────────────────────────────────────');
})().catch((err) => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
