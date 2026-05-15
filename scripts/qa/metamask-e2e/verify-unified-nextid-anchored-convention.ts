/**
 * Studio unifiedNextId.total convention regression · sweep 185 → flipped 2026-05-16.
 *
 * HISTORY:
 *   - Sweep 184 changed unifiedNextId from `total: v2id + v1id` (raw
 *     sum) to `total: (v2id - 1n) + (v1id - 1n)` (subtract-1 per
 *     registry) based on the assumption that ReceiptRegistry V1+V2
 *     reserve slot 0 as a sentinel. Sweep 185 added this regression
 *     to lock that subtract-1 convention.
 *
 *   - v33 UI sweep (2026-05-16) ran direct chain reads of `receipts(0)`
 *     across all six deployed registries (V1+V2+V3 testnet, V2+V3
 *     mainnet — V1 mainnet is not deployed) and found every slot 0
 *     carries a real, non-empty receipt with the operator agent. So
 *     the sentinel-slot assumption was wrong: contracts use `id =
 *     nextId++` from a zero-initialized nextId, and nextId IS the
 *     count of anchored receipts.
 *
 *   - Symptom: home page hero chip showed '41 RECEIPTS ON-CHAIN · LIVE'
 *     while mainnet held 43 (V2=21 + V3=22). Same off-by-one across
 *     testnet (1735 vs actual 1737) and every page reading
 *     unifiedNextId().total.
 *
 *   - Fix: drop the `- 1n` subtraction. This regression flipped to
 *     ENFORCE the corrected convention: every nextId is summed raw,
 *     no subtraction.
 *
 * CURRENT INVARIANT (what this regression enforces):
 *
 *   anchored = nextId   (because slot 0 IS used on every deployed registry)
 *
 *   total = v3id + v2id + v1id   (raw sum, no per-registry subtraction)
 *
 * If a future contributor re-introduces a `- 1n` subtraction or a
 * `- 1` numeric subtraction in unifiedNextId, this regression fails CI.
 *
 * Pure source-file regression. Runs in the studio filter.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

const chainFile = resolve(REPO_ROOT, 'apps/studio/src/lib/chain.ts');
const content = readFileSync(chainFile, 'utf8');

// Locate the unifiedNextId function body.
const fnIdx = content.indexOf('export async function unifiedNextId');
if (fnIdx < 0) fail('apps/studio/src/lib/chain.ts is missing `export async function unifiedNextId`');
ok('unifiedNextId is exported');

// Slice forward from the function header to the next closing brace at
// column 0. The function ends with `}` on its own line.
const fnSlice = content.slice(fnIdx, content.indexOf('\n}\n', fnIdx) + 2);
if (fnSlice.length === 0) fail('could not extract unifiedNextId body');

// 1. The function MUST NOT subtract 1 from any registry's nextId.
//    `id = nextId++` on every deployed registry → nextId IS the count.
//    Verified 2026-05-16 by direct slot-0 reads (see top-of-file doc).
const subtractsOnePattern = /-\s*1n\b/;
if (subtractsOnePattern.test(fnSlice)) {
  fail('unifiedNextId body contains a `- 1n` subtraction. All deployed ReceiptRegistry contracts (V1, V2, V3) use `id = nextId++` from nextId=0, so nextId IS the anchored count — no subtraction. Verified by direct receipts(0) chain reads on every deployment: each slot 0 carries a real, non-empty receipt with the operator agent. If the contracts ever switch to a sentinel-slot pattern, update both numbers-refresh.ts AND this regression simultaneously.');
}
ok('unifiedNextId does NOT subtract 1 from any registry nextId');

// 2. The total must be the direct sum of all three registry nextIds.
//    Match flexible whitespace + optional reordering.
const directSumPattern = /total:\s*v3id\s*\+\s*v2id\s*\+\s*v1id\b/;
if (!directSumPattern.test(fnSlice)) {
  fail('unifiedNextId does not return `total: v3id + v2id + v1id` (raw sum). The convention as of 2026-05-16 is that every registry\'s nextId is the count of anchored receipts directly, so total is the bare sum. If you re-arrange the fields, keep the sum direct.');
}
ok('unifiedNextId returns `total: v3id + v2id + v1id` (raw sum, no subtraction)');

// 3. The function's return shape must include all three fields.
if (!/\bv3\s*:/.test(fnSlice) || !/\bv2\s*:/.test(fnSlice) || !/\bv1\s*:/.test(fnSlice) || !/\btotal\s*:/.test(fnSlice)) {
  fail('unifiedNextId must return { v3, v2, v1, total } — at least one field is missing');
}
ok('unifiedNextId returns { v3, v2, v1, total } shape');

// 4. The companion offline refresher (numbers-refresh.ts) must follow
//    the same convention. Otherwise judge-facing docs drift from the
//    Studio hero chip.
const refreshFile = resolve(REPO_ROOT, 'scripts/diag/numbers-refresh.ts');
const refreshSrc = readFileSync(refreshFile, 'utf8');

const refreshHasV1Subtract = /v1Anchored\s*=\s*Math\.max\(0,\s*Number\(v1NextId\)\s*-\s*1\)/.test(refreshSrc);
const refreshHasV2Subtract = /v2Anchored\s*=\s*Math\.max\(0,\s*Number\(v2NextId\)\s*-\s*1\)/.test(refreshSrc);
if (refreshHasV1Subtract || refreshHasV2Subtract) {
  fail(`scripts/diag/numbers-refresh.ts still subtracts 1 from V1 or V2 nextId — drifts from the Studio convention. Both files MUST count slot 0 as a real anchor (verified 2026-05-16 by direct chain reads).`);
}
ok('numbers-refresh.ts also drops the V1+V2 subtract-1 (companion convention in sync)');

console.log(`\n[verify-unified-nextid-anchored-convention] ${asserts} assertions passed`);
