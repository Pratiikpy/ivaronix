/**
 * Studio passport-count convention regression · sweep 188.
 *
 * Locks the sweep 184 + 186 + 187 off-by-N fix arc. Any Studio app file
 * that reads passport.nextTokenId() must do so through the shared
 * livePassportCount() helper from @/lib/chain. Direct nextTokenId()
 * reads risk reintroducing the off-by-1 drift the helper exists to
 * prevent.
 *
 * Skip patterns:
 *   - apps/studio/src/lib/chain.ts (the helper itself reads nextTokenId)
 *   - apps/studio/src/lib/dashboard.ts (per-passport tokenId render,
 *     unrelated to count math — uses passport.tokenId, not nextTokenId)
 *   - inline `nextTokenId-allow:<reason>` marker for any future
 *     special-case
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

// Confirm the helper exists in chain.ts. If the helper itself is
// missing or renamed, the regression's premise breaks.
const chainContent = readFileSync(resolve(REPO_ROOT, 'apps/studio/src/lib/chain.ts'), 'utf8');
if (!/export async function livePassportCount\b/.test(chainContent)) {
  fail('apps/studio/src/lib/chain.ts is missing `export async function livePassportCount`');
}
ok('livePassportCount helper exists in apps/studio/src/lib/chain.ts');

const violations: Array<{ file: string; line: number; text: string }> = [];
let consumers = 0;
let benign = 0;

for (const file of files) {
  const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  let hadHit = false;
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    if (!/\.nextTokenId\s*\(/.test(text)) continue;
    if (/nextTokenId-allow:/.test(text)) continue;
    // Skip per-passport tokenId-printing call sites that aren't count
    // computations. The discriminating heuristic: a count call appears
    // alone or chained, while a per-passport call reads
    // `passport.tokenId` not `passport.nextTokenId`. This regression
    // only flags `.nextTokenId()` calls, which is always a count op.
    hadHit = true;
    violations.push({ file: rel, line: i + 1, text: text.trim().slice(0, 140) });
  }
  if (hadHit) {
    // Counted in violations; don't double-count under consumers.
  } else if (/\blivePassportCount\b/.test(content)) {
    consumers++;
  } else {
    benign++;
  }
}

if (violations.length > 0) {
  console.error('FAIL: Studio app files read passport.nextTokenId() directly:');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.text}`);
  }
  console.error('Fix: import livePassportCount from "@/lib/chain" and use the helper instead. Direct nextTokenId reads risk the off-by-1 drift the helper exists to prevent.');
  console.error('Allow-marker: `nextTokenId-allow:<reason>` inline for genuine exceptions.');
  process.exit(1);
}

ok(`${consumers} Studio app files use livePassportCount helper`);
ok(`${benign} Studio app files do not touch passport counts`);
console.log(`\n[verify-studio-passport-count-helper] ${asserts} assertions passed`);
