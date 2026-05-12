/**
 * iter-113 finding · TEE verificationMethod must match routerVerified state.
 *
 * docs/RECEIPT_SCHEMA.md §35 (Tier marking) defines 3 verificationMethod
 * values + their honest semantics:
 *
 *   router_flag                   TIER 1 · TEE attestation flagged at Router
 *                                 submission time (cheap check). Implies
 *                                 the Router was invoked.
 *   compute_sdk_process_response  TIER 1 · broker.processResponse confirmed
 *                                 the attestation post-hoc.
 *   external-signed               TIER 2 · signed + chain-anchored but
 *                                 NOT TEE-verified. The Router was NOT
 *                                 invoked; no TEE involvement.
 *
 * iter-113 audit caught two `buildReceipt` call sites in apps/cli/src/
 * commands/room.ts where the receipt body had `routerVerified: false`
 * paired with `verificationMethod: 'router_flag'` — a contradiction
 * that would render as TIER 1 (green) on /r/<id> despite no TEE
 * involvement. Pure brand-overclaim.
 *
 * This regression scans `teeVerification: { ... }` blocks for that
 * contradiction:
 *   - `routerVerified: false` paired with `verificationMethod: 'router_flag'`
 *   - `routerVerified: false` paired with `verificationMethod: 'compute_sdk_process_response'`
 *
 * Either combo is dishonest. Honest receipts where the Router wasn't
 * invoked use `external-signed`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string): void => {
  asserts += 1;
  console.log(`OK: ${label}`);
};

const SCAN_DIRS = [
  resolve(REPO_ROOT, 'apps/cli/src'),
  resolve(REPO_ROOT, 'apps/studio/src'),
  resolve(REPO_ROOT, 'packages/runtime/src'),
];
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'out']);
const SKIP_SUFFIXES = ['.test.ts', '.spec.ts'];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = resolve(dir, entry);
    let stat;
    try { stat = statSync(path); } catch { continue; }
    if (stat.isDirectory()) {
      out.push(...listTsFiles(path));
    } else if (stat.isFile()) {
      if (SKIP_SUFFIXES.some((s) => entry.endsWith(s))) continue;
      if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(path);
    }
  }
  return out;
}

const files: string[] = [];
for (const d of SCAN_DIRS) files.push(...listTsFiles(d));
ok(`scanned ${files.length} TypeScript source files in apps/cli, apps/studio, packages/runtime`);

const violations: { file: string; line: number; reason: string }[] = [];

const TEE_BLOCK_RE = /teeVerification:\s*\{([\s\S]{0,800}?)\}/g;

for (const file of files) {
  let src: string;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }

  let m: RegExpExecArray | null;
  TEE_BLOCK_RE.lastIndex = 0;
  while ((m = TEE_BLOCK_RE.exec(src)) !== null) {
    const block = m[1] ?? '';
    const routerVerifiedFalse = /\brouterVerified:\s*false\b/.test(block);
    if (!routerVerifiedFalse) continue;

    const claimsTier1 =
      /\bverificationMethod:\s*'router_flag'/.test(block) ||
      /\bverificationMethod:\s*'compute_sdk_process_response'/.test(block);
    if (!claimsTier1) continue;

    const before = src.slice(0, m.index);
    const lineNum = before.split('\n').length;
    violations.push({
      file,
      line: lineNum,
      reason: 'routerVerified=false paired with TIER-1 verificationMethod (overclaim)',
    });
  }
}

if (violations.length > 0) {
  console.error(`\nFAIL: ${violations.length} TIER-1 overclaim(s) found (routerVerified=false but claims TIER-1 verificationMethod):`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)}:${v.line}  ·  ${v.reason}`);
  }
  console.error(`\nFix: when routerVerified=false (no Router call), use verificationMethod: 'external-signed'.`);
  console.error(`     Reserve 'router_flag' for runs that actually hit the 0G Compute Router.`);
  console.error(`     Reserve 'compute_sdk_process_response' for runs that re-verified via broker.processResponse.`);
  process.exit(1);
}

ok(`every teeVerification block with routerVerified=false uses honest 'external-signed' verificationMethod`);
console.log(`\n[verify-tee-verification-method-honesty] ${asserts}/2 assertions passed`);
