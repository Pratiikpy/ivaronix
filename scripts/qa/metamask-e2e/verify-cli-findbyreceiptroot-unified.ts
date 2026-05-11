/**
 * CLI findByReceiptRoot reads must be V2-aware.
 *
 * Third member of the V2-drift trifecta:
 *   - verify-cli-receipt-count-unified  (count style · sweep 179)
 *   - verify-cli-findbyagent-unified    (per-agent walk · sweep 181)
 *   - verify-cli-findbyreceiptroot-unified (this file · sweep 182)
 *
 * All three lock readers against drifting to V1-only after V2 deploy.
 * For findByReceiptRoot specifically:
 *   - serve.ts uses V2-first / V1-fallback for unknown root lookups
 *   - doc.ts / receipt.ts use the registry that was JUST USED to anchor
 *     (inside an `if (v2) ... else ...` branch), so the call IS V2-aware
 *     even when one branch uses ReceiptRegistryClient on a V2 address
 *
 * Contract: any apps/cli/src file calling .findByReceiptRoot() must be
 * V2-aware via either:
 *   - buildReadRegistries iterator
 *   - ReceiptRegistryV2Client import (the typed V2 client used in
 *     v2-first/v1-fallback or anchor-then-lookup-same-version patterns)
 *
 * Pure source-file regression.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const CLI_ROOT = resolve(REPO_ROOT, 'apps/cli/src');

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
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
}

const files: string[] = [];
walk(CLI_ROOT, files);
ok(`scanned ${files.length} CLI source files`);

const violations: Array<{ file: string; reason: string }> = [];
let aware = 0;
let skipped = 0;

for (const file of files) {
  const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf8');

  if (!/\.findByReceiptRoot\s*\(/.test(content)) {
    skipped++;
    continue;
  }

  const usesBuildReadRegistries = /buildReadRegistries\b/.test(content);
  const usesV2Client = /\bReceiptRegistryV2Client\b/.test(content);
  if (!usesBuildReadRegistries && !usesV2Client) {
    violations.push({
      file: rel,
      reason: 'calls .findByReceiptRoot() but does not iterate buildReadRegistries AND does not import ReceiptRegistryV2Client (V1-only read · misses post-K-2 anchors)',
    });
    continue;
  }
  aware++;
}

if (violations.length > 0) {
  console.error('FAIL: CLI files call findByReceiptRoot without V2-aware reading:');
  for (const v of violations) {
    console.error(`  ${v.file}  - ${v.reason}`);
  }
  console.error('Fix: V2-first / V1-fallback (serve.ts pattern), OR anchor-then-lookup-same-registry (doc.ts/receipt.ts pattern), OR iterate buildReadRegistries.');
  process.exit(1);
}

ok(`${aware} CLI files call findByReceiptRoot via V2-aware reads`);
ok(`${skipped} CLI files do not call findByReceiptRoot (no fix needed)`);
console.log(`\n[verify-cli-findbyreceiptroot-unified] ${asserts} assertions passed`);
