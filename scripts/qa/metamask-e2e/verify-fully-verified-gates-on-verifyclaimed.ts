/**
 * FULLY VERIFIED chip / status MUST gate on verifyClaimed.
 *
 * Closes the I-1 mirror-cleanup that sweeps 175-176 walked: any
 * tamper-sensitive Studio surface that renders a FULLY VERIFIED state
 * from local receipt body flags (routerVerified, independentVerified)
 * must also call verifyClaimed() first. The local body is operator-
 * editable; flipping the flags to true in the JSON would lie green
 * unless verifyClaimed gates first by checking signature + canonical
 * hash + schema.
 *
 * Contract: any file under apps/studio/src/app/ that:
 *   - reads `routerVerified` AND `independentVerified` from a local
 *     receipt body, AND
 *   - uses the result to compute a `FULLY VERIFIED` / `isFullyVerified`
 *     identifier
 * MUST also import `verifyClaimed` from @ivaronix/receipts.
 *
 * Pure source-file regression.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const APP_ROOT = resolve(REPO_ROOT, 'apps/studio/src/app');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      out.push(full);
    }
  }
}

const files: string[] = [];
walk(APP_ROOT, files);
ok(`scanned ${files.length} Studio app files`);

const violations: Array<{ file: string; reason: string }> = [];
let gated = 0;
let benign = 0;

for (const file of files) {
  const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf8');

  const readsRouter = /\b(?:tee|teeVerification)\??\.routerVerified\b/.test(content);
  const readsIndep = /\b(?:tee|teeVerification)\??\.independentVerified\b/.test(content);
  const renderFully = /\bisFullyVerified\b|FULLY VERIFIED/.test(content);

  if (!(readsRouter && readsIndep && renderFully)) {
    benign++;
    continue;
  }

  const hasVerifyClaimedImport = /from\s+['"]@ivaronix\/receipts['"]/.test(content) && /\bverifyClaimed\b/.test(content);
  if (!hasVerifyClaimedImport) {
    violations.push({
      file: rel,
      reason: 'renders FULLY VERIFIED from local-body flags but does not call verifyClaimed() to gate the local body',
    });
    continue;
  }
  gated++;
}

if (violations.length > 0) {
  console.error('FAIL: Studio surfaces rendering FULLY VERIFIED without verifyClaimed gate:');
  for (const v of violations) {
    console.error(`  ${v.file}  - ${v.reason}`);
  }
  console.error('Fix: import verifyClaimed from @ivaronix/receipts; call it on the local body; require state === "CLAIMED" before honoring tee flags.');
  process.exit(1);
}

ok(`${gated} surfaces render FULLY VERIFIED via verifyClaimed-gated logic`);
ok(`${benign} files do not render FULLY VERIFIED (no gate needed)`);
console.log(`\n[verify-fully-verified-gates-on-verifyclaimed] ${asserts} assertions passed`);
