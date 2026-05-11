/**
 * CLI receipt-count reads must include V2 · post-K-2 unified read.
 *
 * Closes sweep 178+179. Pre-sweeps, `ivaronix demo` and the chat-v2
 * TUI header both read ReceiptRegistry (V1) nextId() ONLY, missing
 * every V2 anchor (sweep 222 onward). The fix-pattern:
 *
 *   v2 = await ReceiptRegistryV2Client(v2Addr, ...).nextId();
 *   v1 = await ReceiptRegistryClient(v1Addr, ...).nextId();
 *   total = (v2-1) + (v1-1);
 *
 * Contract: any apps/cli/src file that computes an "anchored receipt
 * count" headline MUST read BOTH V1 and V2. Detection heuristic: a
 * file that imports ReceiptRegistryClient AND constructs/uses .nextId()
 * for a USER-FACING total (not for a per-receipt lookup) should also
 * import ReceiptRegistryV2Client.
 *
 * Skip pattern: files that already use ReceiptRegistryV2Client are
 * considered V2-aware. Files that don't read .nextId() at all are
 * skipped.
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
let unaware = 0;
let skipped = 0;

for (const file of files) {
  const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf8');

  // The regression's scope is "files that compute a user-facing
  // receipt-count headline." Heuristic: a file that constructs
  // ReceiptRegistryClient AND calls .nextId() on it. Per-receipt
  // file paths (buildReadRegistries, findByReceiptRoot) iterate
  // properly so they're fine.
  const usesV1Client = /\bnew ReceiptRegistryClient\b/.test(content);
  const callsNextId = /ReceiptRegistryClient[^;]*\)\.nextId\(\)|\.nextId\(\)/.test(content) && usesV1Client;
  // Files that use buildReadRegistries from receipt.ts already iterate
  // V2-first internally; skip them.
  const usesBuildReadRegistries = /buildReadRegistries\b/.test(content);
  if (usesBuildReadRegistries) {
    skipped++;
    continue;
  }
  if (!callsNextId) {
    skipped++;
    continue;
  }

  // A file is V2-aware if it either:
  //   - imports/uses ReceiptRegistryV2Client (the typed V2 client), OR
  //   - resolves the 'ReceiptRegistryV2' contract address via
  //     getDeployedAddress(...) — even when it then calls the V1 client
  //     class on that address (works because nextId() has the same
  //     signature on both contracts), OR
  //   - iterates loadDeployments(...) which surfaces both V1 + V2.
  // The first two are V2-aware in semantics; the third walks each
  // contract by name and reads nextId per row.
  const usesV2Client = /\bReceiptRegistryV2Client\b/.test(content);
  const reachesV2Address = /getDeployedAddress\([^)]+,\s*['"]ReceiptRegistryV2['"]/.test(content);
  const iteratesDeployments = /\bloadDeployments\b|deployments\.contracts\b/.test(content);
  if (!usesV2Client && !reachesV2Address && !iteratesDeployments) {
    violations.push({
      file: rel,
      reason: 'computes receipt count via ReceiptRegistryClient.nextId() but does not also read ReceiptRegistryV2 (no V2Client import, no V2 address lookup, no deployments iteration)',
    });
    continue;
  }
  aware++;
}

if (violations.length > 0) {
  console.error('FAIL: CLI files compute receipt count without unified V1+V2 read:');
  for (const v of violations) {
    console.error(`  ${v.file}  - ${v.reason}`);
  }
  console.error('Fix: add ReceiptRegistryV2Client to the import, sum (v1.nextId-1) + (v2.nextId-1) for the total.');
  process.exit(1);
}

ok(`${aware} CLI files read receipt count via unified V1+V2`);
ok(`${skipped} CLI files do not compute a user-facing receipt count (no fix needed)`);
console.log(`\n[verify-cli-receipt-count-unified] ${asserts} assertions passed`);
