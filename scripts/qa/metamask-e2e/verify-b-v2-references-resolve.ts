/**
 * iter-132 closure regression for invalid B-V2-N references.
 *
 * iter-128 caught literal-PENDING references to CLOSED B-V2-N entries.
 * iter-132 catches a different drift: B-V2-N references that point at
 * IDs which don't exist in USER_TODO at all.
 *
 * The drift caught + fixed iter-132: both the QA plan and
 * apps/studio/next.config.ts:117 referenced a bare "B-V2" with no
 * specific N. USER_TODO had no such section header. Created B-V2-42
 * for CSP and pointed both references at it.
 *
 * Scope: scan the QA plan + apps/studio/src + apps/cli/src +
 * apps/mcp-server/src + packages/runtime/src for B-V2-N references.
 * Fail if any doesn't resolve to a USER_TODO header.
 *
 * Allow-marker: b-v2-ref-allow:<reason> on the same line. Placeholder
 * IDs (B-V2-N, B-V2-X, B-V2-NN, B-V2-XX) are skipped automatically.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const USER_TODO = resolve(REPO_ROOT, 'docs/USER_TODO.md');
const QA_PLAN = resolve(REPO_ROOT, 'Ivaronix_User_QA_Test_Plan.md');
const SCAN_DIRS = [
  resolve(REPO_ROOT, 'apps/studio/src'),
  resolve(REPO_ROOT, 'apps/cli/src'),
  resolve(REPO_ROOT, 'apps/mcp-server/src'),
  resolve(REPO_ROOT, 'packages/runtime/src'),
];
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'out']);

let asserts = 0;
const ok = (label: string): void => {
  asserts += 1;
  console.log(`OK: ${label}`);
};

// USER_TODO.md is an internal sprint queue and not always tracked. Skip
// cleanly when absent so CI does not fail on a fresh checkout.
if (!existsSync(USER_TODO)) {
  console.log('SKIP: docs/USER_TODO.md not in working tree (internal doc).');
  process.exit(0);
}
const userTodoSrc = readFileSync(USER_TODO, 'utf8');
const validIds = new Set<string>();
const HEADER_RE = /^### (B-V2-[A-Z0-9-]+)/gm;
let m: RegExpExecArray | null;
while ((m = HEADER_RE.exec(userTodoSrc)) !== null) {
  validIds.add(m[1]!);
}
ok(`parsed ${validIds.size} valid B-V2-N IDs from USER_TODO.md headers`);

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
    } else if (stat.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
      out.push(path);
    }
  }
  return out;
}

const filesToScan: { path: string; rel: string }[] = [
  { path: QA_PLAN, rel: relative(REPO_ROOT, QA_PLAN) },
];
for (const dir of SCAN_DIRS) {
  for (const f of listTsFiles(dir)) {
    filesToScan.push({ path: f, rel: relative(REPO_ROOT, f) });
  }
}

const REF_RE = /\bB-V2-([A-Z0-9-]+)/g;
const PLACEHOLDERS = new Set(['N', 'X', 'NN', 'XX']);

const violations: { rel: string; line: number; ref: string }[] = [];

for (const f of filesToScan) {
  let src: string;
  try { src = readFileSync(f.path, 'utf8'); } catch { continue; }
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/b-v2-ref-allow:/.test(line)) continue;
    REF_RE.lastIndex = 0;
    let mm: RegExpExecArray | null;
    while ((mm = REF_RE.exec(line)) !== null) {
      const suffix = mm[1]!;
      if (PLACEHOLDERS.has(suffix)) continue;
      const id = `B-V2-${suffix}`;
      if (validIds.has(id)) continue;
      violations.push({ rel: f.rel, line: i + 1, ref: id });
    }
  }
}

if (violations.length > 0) {
  console.error(`\nFAIL: ${violations.length} reference(s) to non-existent B-V2-N entries:`);
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line} -> ${v.ref}`);
  }
  console.error(`\nFix: either create the missing entry in USER_TODO.md, OR update the`);
  console.error(`reference to a valid ID, OR add b-v2-ref-allow:<reason> on the same line.`);
  process.exit(1);
}

ok(`every B-V2-N reference in scanned files resolves to a real USER_TODO entry`);
console.log(`\n[verify-b-v2-references-resolve] ${asserts}/2 assertions passed`);
