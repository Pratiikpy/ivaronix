/**
 * iter-131 closure regression for Burn-Mode keyFingerprint ordering.
 *
 * The QA plan (`Ivaronix_User_QA_Test_Plan.md` line 1056) cites this
 * regression as the structural lock that enforces:
 *
 *   keyFingerprint = sha256(realKey)  MUST be computed BEFORE key.fill(0)
 *
 * The ordering matters because if `key.fill(0)` runs first, the
 * fingerprint becomes sha256(zeros) — useless as a later "I had the
 * key" claim verification. Per docs/CRYPTO_NOTES.md the fingerprint
 * is the load-bearing proof of key custody at encrypt time; flipping
 * the order silently breaks the privacy story.
 *
 * Pre-iter-131 the plan cited this regression as a source-file lock,
 * but the regression file didn't exist (caught iter-131's plan-path
 * audit). The burn.ts code itself has the correct ordering (line 42
 * fingerprint, line 54 fill); this regression locks that ordering
 * structurally against future refactors.
 *
 * Implementation: parse packages/og-storage/src/burn.ts, find the
 * line numbers of:
 *   - the `keyFingerprint` assignment that calls `createHash('sha256')`
 *   - the `key.fill(0)` zero-out call
 * Fail if zero-out appears at or before fingerprint computation.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const BURN_TS = resolve(REPO_ROOT, 'packages/og-storage/src/burn.ts');

let asserts = 0;
const ok = (label: string): void => {
  asserts += 1;
  console.log(`OK: ${label}`);
};
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

const src = readFileSync(BURN_TS, 'utf8');
const lines = src.split(/\r?\n/);

let fingerprintLine = -1;
let zeroOutLine = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!;
  if (fingerprintLine < 0 && /keyFingerprint\s*=/.test(line) && /sha256/i.test(lines.slice(i, i + 3).join('\n'))) {
    fingerprintLine = i + 1;
  }
  if (zeroOutLine < 0 && /\bkey\.fill\(\s*0\s*\)/.test(line)) {
    zeroOutLine = i + 1;
  }
}

if (fingerprintLine < 0) fail('could not locate keyFingerprint = sha256(...) computation in burn.ts');
if (zeroOutLine < 0) fail('could not locate key.fill(0) zero-out in burn.ts');

ok(`fingerprint computed at line ${fingerprintLine}, key zeroed at line ${zeroOutLine}`);

if (zeroOutLine <= fingerprintLine) {
  fail(
    `keyFingerprint must be computed BEFORE key.fill(0).\n` +
    `  fingerprint at line ${fingerprintLine}, zero-out at line ${zeroOutLine}.\n` +
    `  Flipping the order produces sha256(zeros) instead of sha256(realKey),\n` +
    `  silently breaking the privacy story per docs/CRYPTO_NOTES.md.`
  );
}

ok(`zero-out (line ${zeroOutLine}) follows fingerprint computation (line ${fingerprintLine})`);
console.log(`\n[verify-burn-keyfingerprint-before-zero] ${asserts}/2 assertions passed`);
