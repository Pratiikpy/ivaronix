/**
 * CLI getReceipt reads must be V2-aware.
 *
 * Fourth and final member of the V2-drift reader-pattern lockdown:
 *   - verify-cli-receipt-count-unified  (count · sweep 179)
 *   - verify-cli-findbyagent-unified    (per-agent walk · sweep 181)
 *   - verify-cli-findbyreceiptroot-unified (per-root · sweep 182)
 *   - verify-cli-getreceipt-unified     (per-id · sweep 183)
 *
 * Per-id getReceipt lookups also need the V2-first / V1-fallback OR
 * iterate-buildReadRegistries pattern. Today: debug.ts (V2-first +
 * V1-fallback), pr.ts (same), receipt.ts (buildReadRegistries
 * iterator).
 *
 * Contract: any apps/cli/src file calling .getReceipt() against a
 * ReceiptRegistry client must be V2-aware via either:
 *   - buildReadRegistries iterator
 *   - ReceiptRegistryV2Client import
 *
 * Filter out the SQLite `db.getReceipt(id)` calls — those query a
 * local indexer DB, not the chain. The discriminator: chain
 * getReceipt is preceded (in the same chain of method calls) by
 * `new ReceiptRegistryV?Client(...)` or `r.client.getReceipt`.
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

  // A chain-side getReceipt call always coexists with a
  // ReceiptRegistryClient OR ReceiptRegistryV2Client construction
  // in the same file (otherwise it's a local SQLite call).
  const hasChainClient = /\bReceiptRegistry(?:V2)?Client\b/.test(content);
  const callsGetReceipt = /\.getReceipt\s*\(/.test(content);
  if (!callsGetReceipt || !hasChainClient) {
    skipped++;
    continue;
  }

  const usesBuildReadRegistries = /buildReadRegistries\b/.test(content);
  const usesV2Client = /\bReceiptRegistryV2Client\b/.test(content);
  if (!usesBuildReadRegistries && !usesV2Client) {
    violations.push({
      file: rel,
      reason: 'calls chain .getReceipt() but does not iterate buildReadRegistries AND does not import ReceiptRegistryV2Client (V1-only read · misses post-K-2 anchors)',
    });
    continue;
  }
  aware++;
}

if (violations.length > 0) {
  console.error('FAIL: CLI files call chain getReceipt without V2-aware reading:');
  for (const v of violations) {
    console.error(`  ${v.file}  - ${v.reason}`);
  }
  console.error('Fix: V2-first / V1-fallback (debug.ts pattern), OR iterate buildReadRegistries (receipt.ts pattern).');
  process.exit(1);
}

ok(`${aware} CLI files call chain getReceipt via V2-aware reads`);
ok(`${skipped} CLI files do not call chain getReceipt (no fix needed)`);
console.log(`\n[verify-cli-getreceipt-unified] ${asserts} assertions passed`);
