/**
 * Any `§B-V2-N` cross-reference in code or docs must agree with that
 * entry's status in `docs/USER_TODO.md`.
 *
 * Sweep 228 closure of the drift class sweep 227 caught manually:
 * `packages/runtime/src/env.ts` cited "USER_TODO §B-V2-10" as "the
 * operator-action follow-up" — but B-V2-10 had been marked ✅ SHIPPED
 * weeks earlier. The reader sees a "queued" implication while the
 * actual work has long landed.
 *
 * Rule: when a code/doc line references `§B-V2-N` and the
 * corresponding USER_TODO entry's header carries `✅ SHIPPED` (the
 * marker the existing closure-citation convention uses), the
 * referencing line MUST itself either:
 *   - explicitly say `✅ SHIPPED` / `✅ shipped` near the reference
 *   - or be inside `docs/USER_TODO.md` itself (the source)
 *   - or carry an `b-v2-crossref-allow:<reason>` inline marker
 *
 * Without one of those, the prose reads as "this is queued" when in
 * fact the work has shipped — a credibility-surface drift.
 *
 * Pure source-file regression. No runtime.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
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

// Step 1: parse docs/USER_TODO.md, build a map of B-V2-N → shipped|open.
const userTodoPath = resolve(REPO_ROOT, 'docs', 'USER_TODO.md');
const userTodoSrc = readFileSync(userTodoPath, 'utf8');
const userTodoLines = userTodoSrc.split(/\r?\n/);

const statusByKey = new Map<string, 'shipped' | 'open'>();
const headerRe = /^### (B-V2-[\w-]+)\b/;
for (const line of userTodoLines) {
  const m = line.match(headerRe);
  if (!m) continue;
  const key = m[1]!;
  const shipped = /✅\s*SHIPPED\b/i.test(line);
  statusByKey.set(key, shipped ? 'shipped' : 'open');
}
ok(`parsed ${statusByKey.size} B-V2-N entries from docs/USER_TODO.md (${[...statusByKey.values()].filter((s) => s === 'shipped').length} shipped, ${[...statusByKey.values()].filter((s) => s === 'open').length} open)`);

// Step 2: walk packages + apps + docs (excluding USER_TODO.md itself)
// for references that include the §B-V2-N token.
const inScopeRoots = [
  resolve(REPO_ROOT, 'packages'),
  resolve(REPO_ROOT, 'apps'),
  resolve(REPO_ROOT, 'docs'),
];

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try { entries = readdirSync(dir); }
  catch { return; }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name === '.next' || name === '.turbo') continue;
    const full = resolve(dir, name);
    let stat;
    try { stat = statSync(full); }
    catch { continue; }
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|md|sol)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(full);
  }
}

const files: string[] = [];
for (const r of inScopeRoots) walk(r, files);
ok(`scanned ${files.length} in-scope files (packages + apps + docs excluding test files)`);

// Step 3: per-line scan for "§B-V2-N" references; classify.
const refRe = /§(B-V2-[\w-]+)/g;
interface Violation { file: string; line: number; key: string; text: string; }
const violations: Violation[] = [];

const userTodoAbs = userTodoPath;

for (const file of files) {
  if (resolve(file) === userTodoAbs) continue; // the source of truth itself
  const src = readFileSync(file, 'utf8');
  if (!src.includes('§B-V2-')) continue;
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/b-v2-crossref-allow:/i.test(line)) return;
    // Skip comment headers that simply declare a new B-V2 entry e.g.
    // inside another doc that mirrors the queue list.
    const matches = [...line.matchAll(refRe)];
    if (matches.length === 0) return;
    // If the same line explicitly states the shipped status, accept.
    const declaresShipped = /✅\s*SHIPPED\b|✅\s*shipped\b|\bshipped\b/i.test(line);
    for (const m of matches) {
      const key = m[1]!;
      const status = statusByKey.get(key);
      if (!status) {
        // Dangling reference — entry doesn't exist in USER_TODO.
        violations.push({ file, line: i + 1, key, text: line.trim() });
        continue;
      }
      if (status === 'shipped' && !declaresShipped) {
        violations.push({ file, line: i + 1, key, text: line.trim() });
      }
    }
  });
}

if (violations.length > 0) {
  console.error('');
  console.error(`FAIL: ${violations.length} B-V2-N cross-reference(s) disagree with USER_TODO.md status:`);
  for (const v of violations) {
    const status = statusByKey.get(v.key);
    const why = status ? `entry is ✅ SHIPPED but the line doesn't say so` : `entry doesn't exist in USER_TODO.md`;
    console.error(`  ${relative(REPO_ROOT, v.file)}:${v.line}  (${v.key} — ${why})`);
    console.error(`    ${v.text.slice(0, 140)}${v.text.length > 140 ? '...' : ''}`);
  }
  console.error('');
  console.error('Fix:');
  console.error('  - Edit the line to say "(✅ SHIPPED)" inline next to the reference, OR');
  console.error('  - Re-word to remove the implication that the work is queued, OR');
  console.error('  - Add `b-v2-crossref-allow:<reason>` inline if the historical reference is intentional');
  process.exit(1);
}

ok(`every §B-V2-N reference in code + docs agrees with its USER_TODO status`);

console.log(`\n[verify-b-v2-crossref-status] ${asserts} assertions passed`);
