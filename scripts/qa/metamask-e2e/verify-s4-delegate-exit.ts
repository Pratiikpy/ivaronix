/**
 * QA · S-4 · `delegate.ts` exit-code propagation.
 *
 * The previous code reset `process.exitCode = 0` inside the `finally` block
 * of the runOk try/catch. The reset defeated scripted callers checking `$?`:
 * a failed `delegate run` always returned 0.
 *
 * Asserts (source-file regression only — the live exit-code path needs a
 * fully-set-up delegate + grant + skill, which is out of scope for a
 * standalone QA run; the runtime's behavior is mechanically determined by
 * the source patterns enforced here):
 *
 *   1. The finally block in the runOk region does NOT contain
 *      `process.exitCode = 0`.
 *   2. The runOk-true branch sets `process.exitCode = 0`.
 *   3. The else branch sets `process.exitCode = 1`.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

(async () => {
  console.log('───────────────────────────────────────────────────────────────');
  console.log('S-4 · delegate.ts exit-code propagation');
  console.log('───────────────────────────────────────────────────────────────');

  const path = resolve(REPO, 'apps/cli/src/commands/delegate.ts');
  const src = readFileSync(path, 'utf8');

  const runOkIdx = src.indexOf('let runOk = false');
  assert.ok(runOkIdx >= 0, 'expected "let runOk = false" in delegate.ts');
  const region = src.slice(runOkIdx, runOkIdx + 2_000);

  const finallyMatch = /finally\s*\{([\s\S]*?)\}\s*\n/m.exec(region);
  assert.ok(finallyMatch, 'expected a finally block in the runOk region');
  const finallyBody = finallyMatch[1];
  assert.ok(
    !/process\.exitCode\s*=\s*0/.test(finallyBody),
    'delegate.ts: finally block must NOT reset process.exitCode = 0; that breaks scripted callers',
  );
  console.log('   ✓ finally block no longer resets process.exitCode = 0');

  assert.ok(
    /if\s*\(runOk\)\s*\{[\s\S]*?process\.exitCode\s*=\s*0/m.test(region),
    'delegate.ts: runOk-true branch must set process.exitCode = 0',
  );
  assert.ok(
    /\}\s*else\s*\{[\s\S]*?process\.exitCode\s*=\s*1/m.test(region),
    'delegate.ts: else branch must set process.exitCode = 1',
  );
  console.log('   ✓ exit code propagation explicit in post-finally branches');

  console.log('───────────────────────────────────────────────────────────────');
  console.log('✅ S-4 verified (source-file regression)');
  console.log('───────────────────────────────────────────────────────────────');
})().catch((err) => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
