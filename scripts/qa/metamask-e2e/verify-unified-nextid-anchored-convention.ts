/**
 * Studio unifiedNextId.total convention regression · sweep 185.
 *
 * Locks sweep 184's off-by-N fix: `total` must be the ANCHORED COUNT
 * (sum of `nextId - 1` per registry, max 0), not raw nextId sum.
 *
 * Why: chain contracts use `id = nextId++` (post-increment), so
 * `nextId` is the value to be assigned to the NEXT receipt — not the
 * count of anchored receipts. The codebase convention across
 * numbers-refresh.ts + CLI's count headlines is:
 *
 *   anchored = max(0, nextId - 1)
 *
 * Pre-sweep-184 Studio returned `v2id + v1id` (raw sum) and over-
 * counted by 1 per deployed registry. This regression catches future
 * drift if the formula is rewritten incorrectly.
 *
 * Pure source-file regression.
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
// the same indentation. Simple heuristic: walk until we see `\n}` at
// column 0. The function ends with `}` on its own line.
const fnSlice = content.slice(fnIdx, content.indexOf('\n}\n', fnIdx) + 2);
if (fnSlice.length === 0) fail('could not extract unifiedNextId body');

// 1. The function MUST compute an anchored-count value before summing
//    into `total`. Heuristic: look for `- 1n` subtractions tied to v2/v1.
const subtractsOne = /-\s*1n/.test(fnSlice);
if (!subtractsOne) {
  fail('unifiedNextId body does not contain a `- 1n` subtraction. Raw nextId sum over-counts by 1 per registry. Expected: subtract 1 per registry before summing into total.');
}
ok('unifiedNextId subtracts 1 per registry (- 1n appears in body)');

// 2. The total must NOT be the bare raw sum `v2id + v1id`. That was
//    the pre-sweep-184 bug shape; explicitly forbid it.
const rawSumPattern = /total:\s*v2id\s*\+\s*v1id\b/;
if (rawSumPattern.test(fnSlice)) {
  fail('unifiedNextId returns `total: v2id + v1id` — that is the raw next-id sum, off by 1 per registry. Subtract 1 first per the convention in numbers-refresh.ts.');
}
ok('unifiedNextId does not return raw `v2id + v1id` sum');

// 3. The function's return shape must include all three fields.
if (!/\bv2\s*:/.test(fnSlice) || !/\bv1\s*:/.test(fnSlice) || !/\btotal\s*:/.test(fnSlice)) {
  fail('unifiedNextId must return { v2, v1, total } — at least one field is missing');
}
ok('unifiedNextId returns { v2, v1, total } shape');

console.log(`\n[verify-unified-nextid-anchored-convention] ${asserts} assertions passed`);
