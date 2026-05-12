/**
 * iter-119 closure regression for iter-114's V3-blindness bug.
 *
 * iter-114 found that apps/studio/src/app/r/[id]/page.tsx destructured
 * getRegistries() as `const { v1, v2 } = getRegistries()` — silently
 * dropping V3. Result: 5 V3 anchors were invisible on Studio's
 * /r/<id> page; users hitting /r/0 saw V1's legacy receipt at id 0,
 * not the V3 memory_consolidation I had actually written.
 *
 * getRegistries() returns { v3, v2, v1 } per
 * apps/studio/src/lib/chain.ts (post-iter-79 V3-first wiring).
 * Any caller that destructures only a subset is silently dropping
 * the others.
 *
 * This regression scans apps/studio/src for getRegistries() usage
 * and fails CI if any caller destructures less than {v3, v2, v1}.
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

const SCAN_DIR = resolve(REPO_ROOT, 'apps/studio/src');
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'out']);
const SKIP_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts'];

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

const files = listTsFiles(SCAN_DIR);
ok(`scanned ${files.length} TypeScript source files under apps/studio/src`);

const DESTRUCTURE_RE = /const\s*\{\s*([^}]+?)\s*\}\s*=\s*(?:await\s+)?getRegistries\(\)/g;

const violations: { file: string; line: number; missing: string[]; raw: string }[] = [];

for (const file of files) {
  if (file.endsWith('apps/studio/src/lib/chain.ts') || file.endsWith('apps\\studio\\src\\lib\\chain.ts')) continue;

  let src: string;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }

  let m: RegExpExecArray | null;
  DESTRUCTURE_RE.lastIndex = 0;
  while ((m = DESTRUCTURE_RE.exec(src)) !== null) {
    const inner = m[1] ?? '';
    const names = inner
      .split(',')
      .map((s) => s.trim().split(':')[0]?.trim() ?? '')
      .filter((s) => s.length > 0);
    const has = new Set(names);
    const missing: string[] = [];
    if (!has.has('v3')) missing.push('v3');
    if (!has.has('v2')) missing.push('v2');
    if (!has.has('v1')) missing.push('v1');
    if (missing.length > 0) {
      const before = src.slice(0, m.index);
      const lineNum = before.split('\n').length;
      const lineIdx = lineNum - 1;
      const lines = src.split(/\r?\n/);
      const checkLines = lines.slice(Math.max(0, lineIdx - 2), Math.min(lines.length, lineIdx + 2));
      const allowed = checkLines.some((l) => /v3-destructure-allow:/.test(l));
      if (allowed) continue;
      violations.push({
        file,
        line: lineNum,
        missing,
        raw: m[0]!.slice(0, 80),
      });
    }
  }
}

if (violations.length > 0) {
  console.error(`\nFAIL: ${violations.length} getRegistries() destructure(s) silently drop one or more registry versions:`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)}:${v.line}`);
    console.error(`    destructured: ${v.raw}`);
    console.error(`    missing:      ${v.missing.join(', ')}`);
  }
  console.error(`\nFix: destructure the full set: const { v3, v2, v1 } = getRegistries();`);
  console.error(`     If you genuinely need a subset, add an inline comment:`);
  console.error(`     // v3-destructure-allow:<reason explaining why this caller is narrow>`);
  process.exit(1);
}

ok(`every getRegistries() caller destructures the full {v3, v2, v1} set`);
console.log(`\n[verify-v3-aware-registry-destructure] ${asserts}/2 assertions passed`);
