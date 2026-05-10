/**
 * Regression: monotone-down budget on `as any` casts in first-party code.
 *
 * Why this gate exists (sweep 84 finding · companion to sweep 83's
 * @ts-ignore gate):
 *   `as any` is the broader-class type-suppression sibling of
 *   `@ts-ignore`. It silently widens a typed value to `any`, defeating
 *   the type-system at one point. Three approved instances exist today:
 *
 *     1. packages/og-storage/src/index.ts:74 — `this.signer as any`
 *        per `.claude/rules/og-storage.md` ("the ONLY permitted `any`
 *        cast in this package"; reason: 0G Storage SDK uses ethers v5
 *        internals while we're ethers v6).
 *     2. packages/indexer/src/worker.ts:87 — `(log as any).args` per
 *        ethers v6 EventLog typing (ABI-supplied args by name vs index).
 *        eslint-disable-next-line comment present.
 *     3. packages/widget/src/index.tsx:66 — `(globalThis as any)?.process?.env`
 *        for build-time env access in a browser-targeted package.
 *
 *   The "monotone-down budget" pattern: we lock the current count
 *   (3 in first-party). New `as any` casts fail the gate. Removing
 *   any of the 3 approved instances also passes the gate (the budget
 *   shrinks but doesn't grow). This encourages cleanup over time
 *   without forcing an immediate purge.
 *
 *   Compared to a per-line amnesty (file:line:context), the count-based
 *   form is robust to mechanical refactoring — line numbers shift, but
 *   the count check still fires correctly.
 *
 * Scope:
 *   Same first-party roots as verify-no-ts-ignore-first-party.ts.
 *   Vendored opencode-* deliberately excluded.
 *
 * Captures sweep 84's closure. Testnet-only — the regression IS the
 * durable record. Future sweeps that drop instances can lower the
 * BUDGET constant.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

/** Maximum `as any` instances allowed in first-party code. Sweep 84 = 3. */
const BUDGET = 3;

const FIRST_PARTY_ROOTS = [
  'apps/cli/src',
  'apps/studio/src',
  'apps/mcp-server/src',
  'apps/telegram-bot/src',
  'apps/npx-cli',
  'packages/core/src',
  'packages/consensus/src',
  'packages/receipts/src',
  'packages/skills/src',
  'packages/memory/src',
  'packages/og-chain/src',
  'packages/og-router/src',
  'packages/og-storage/src',
  'packages/trust-layer/src',
  'packages/og-kv/src',
  'packages/og-da/src',
  'packages/indexer/src',
  'packages/runtime/src',
  'packages/widget/src',
  'packages/og-toolkit/src',
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', '.git']);
const VALID_EXT = new Set(['.ts', '.tsx', '.mjs']);

interface Hit {
  file: string;
  line: number;
  text: string;
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...listFiles(path));
    } else {
      const dot = entry.lastIndexOf('.');
      if (dot >= 0 && VALID_EXT.has(entry.slice(dot))) {
        out.push(path);
      }
    }
  }
  return out;
}

function scanFile(file: string): Hit[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const hits: Hit[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    // Skip comments — JSDoc and inline comments often use `as any` in
    // explanatory prose without it being a real cast.
    const trimmed = text.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    // The cast pattern: `as any` followed by a non-word boundary so we
    // catch `as any.x` (member access on cast), `as any)` (closing
    // paren), `as any;`, etc. — but not `as anyone` or `as anything`.
    if (/\bas\s+any\b/.test(text)) {
      hits.push({ file, line: i + 1, text: text.trim() });
    }
  }
  return hits;
}

console.log(`First-party · 'as any' budget (max ${BUDGET})\n`);

const allFiles: string[] = [];
for (const root of FIRST_PARTY_ROOTS) allFiles.push(...listFiles(resolve(REPO_ROOT, root)));

const allHits: Hit[] = [];
for (const f of allFiles) allHits.push(...scanFile(f));

console.log(`  scanned ${allFiles.length} files · found ${allHits.length} 'as any' cast(s)`);

if (allHits.length <= BUDGET) {
  // List the current ones so the BUDGET line in this file can be
  // tightened when one is removed.
  for (const h of allHits) {
    const rel = relative(REPO_ROOT, h.file).replace(/\\/g, '/');
    console.log(`    [approved · within budget] ${rel}:${h.line}`);
  }
  console.log(`  PASS · ${allHits.length} ≤ ${BUDGET}`);
  process.exit(0);
}

console.error(`  FAIL · ${allHits.length} 'as any' cast(s) exceeds budget of ${BUDGET}:\n`);
for (const h of allHits) {
  const rel = relative(REPO_ROOT, h.file).replace(/\\/g, '/');
  console.error(`    ${rel}:${h.line}`);
  console.error(`      ${h.text}`);
}
console.error('\n  fix: remove the new `as any` cast (preferred — there is almost always');
console.error('       a structural fix). If genuinely needed (interfacing with untyped');
console.error('       SDK internals, etc.), document the reason inline and lower one of');
console.error('       the existing approved casts in the same PR.');
process.exit(1);
