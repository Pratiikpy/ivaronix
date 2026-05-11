/**
 * CLI findByAgent reads must include V2 · post-K-2 unified read.
 *
 * Companion to sweep 179's verify-cli-receipt-count-unified.ts. This
 * regression covers per-agent receipt walks (`findByAgent`) — sweep 180
 * fixed passport-consolidate's V1-only call. Future CLI sites that
 * call findByAgent must also be V2-aware.
 *
 * Contract: any apps/cli/src file that calls `.findByAgent(` must be
 * V2-aware via one of:
 *   - calls findByAgent on both V1 + V2 clients (regV1.findByAgent +
 *     regV2.findByAgent in same file)
 *   - iterates registries from `buildReadRegistries` (which returns
 *     both V1 + V2 entries)
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

  if (!/\.findByAgent\s*\(/.test(content)) {
    skipped++;
    continue;
  }

  // V2-aware via: iterates registries from buildReadRegistries
  // (which contains both V1 + V2 entries — see receipt.ts pattern),
  // OR uses ReceiptRegistryV2Client (the typed V2 client).
  const usesBuildReadRegistries = /buildReadRegistries\b/.test(content);
  const usesV2Client = /\bReceiptRegistryV2Client\b/.test(content);
  if (!usesBuildReadRegistries && !usesV2Client) {
    violations.push({
      file: rel,
      reason: 'calls .findByAgent() but does not iterate buildReadRegistries AND does not import ReceiptRegistryV2Client (V1-only read · misses post-K-2 anchors)',
    });
    continue;
  }
  aware++;
}

if (violations.length > 0) {
  console.error('FAIL: CLI files call findByAgent without V2-aware reading:');
  for (const v of violations) {
    console.error(`  ${v.file}  - ${v.reason}`);
  }
  console.error('Fix: read findByAgent from both V1 + V2 (Promise.all + merge + de-dupe by receiptRoot), OR use the buildReadRegistries iterator from receipt.ts.');
  process.exit(1);
}

ok(`${aware} CLI files call findByAgent via V2-aware reads`);
ok(`${skipped} CLI files do not call findByAgent (no fix needed)`);
console.log(`\n[verify-cli-findbyagent-unified] ${asserts} assertions passed`);
