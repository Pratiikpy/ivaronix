/**
 * iter-131 closure regression for QA plan dead-path drift.
 *
 * The QA plan cites file paths inside backticks throughout — code
 * paths, doc paths, regression script paths. iter-131 caught two
 * dead references via a manual filesystem sweep:
 *
 *   1. `QA_FIX_LOG.md` (referenced 4 times) — file didn't exist.
 *      Created iter-131 with the structure described in plan §331.
 *   2. `verify-burn-keyfingerprint-before-zero.ts` (referenced once
 *      as a source-file regression) — file didn't exist. Created
 *      iter-131 to enforce the ordering described in plan §1056.
 *
 * This regression scans the plan for backtick-wrapped path-like
 * strings and fails if any cited path doesn't resolve on disk.
 *
 * Scope: paths that look like real repo paths — start with a
 * recognised top-level directory (`apps/`, `packages/`, `docs/`,
 * `contracts/`, `scripts/`, `seed-skills/`, `tests/`,
 * `brand/`, `apps/openclaw-skill/`) OR live at repo root with a
 * recognised extension.
 *
 * Allow-marker: `qa-plan-path-allow:<reason>` on the same line if
 * the path is intentional (e.g. documenting a path that WILL be
 * created on a specific deploy day, or referring to a third-party
 * file outside this repo).
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const QA_PLAN = resolve(REPO_ROOT, 'Ivaronix_User_QA_Test_Plan.md');

// QA plan is local-only after privacy scrub (bc2c636). Skip on CI.
if (!existsSync(QA_PLAN)) {
  console.log(`SKIP: ${QA_PLAN.split(/[\\/]/).pop()} not in working tree (private doc).`);
  process.exit(0);
}

let asserts = 0;
const ok = (label: string): void => {
  asserts += 1;
  console.log(`OK: ${label}`);
};

// Recognised top-level prefixes for repo paths.
const REPO_PREFIXES = [
  'apps/', 'packages/', 'docs/', 'contracts/', 'scripts/',
  'seed-skills/', 'tests/', 'brand/', '.github/', '.claude/',
];

// Repo-root files: only specific known root-level docs count.
// Plan often uses bare filenames as prose shorthand (e.g. "encryption.ts"
// to mean the file inside packages/og-storage/src/) — those bare names
// aren't dead refs, they're shorthand. Restricting to specific known
// root-level files avoids over-matching.
const ROOT_DOC_NAMES = new Set([
  'README.md',
  'CLAUDE.md',
  'CHANGELOG.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'QA_TEST_PROGRESS.md',
  'QA_FIX_LOG.md',
  'Ivaronix_User_QA_Test_Plan.md',
]);

// File-extension pattern for the path matcher.
const PATH_RE = /`([a-zA-Z_.][a-zA-Z0-9_./-]+\.(?:ts|tsx|md|sol|json|yaml|yml|toml|sh|py|mjs))`/g;

const qaSrc = readFileSync(QA_PLAN, 'utf8');
const lines = qaSrc.split(/\r?\n/);

let scanned = 0;
const violations: { line: number; path: string; snippet: string }[] = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!;
  if (/qa-plan-path-allow:/.test(line)) continue;
  const matches = [...line.matchAll(PATH_RE)];
  for (const mm of matches) {
    const refPath = mm[1]!;
    // Only check paths that look like repo paths (full path with a
    // recognised prefix, OR a root-level file with a recognised ext).
    const hasPrefix = REPO_PREFIXES.some((p) => refPath.startsWith(p));
    const isRoot = !refPath.includes('/') && ROOT_DOC_NAMES.has(refPath);
    if (!hasPrefix && !isRoot) continue;
    scanned += 1;
    const abs = resolve(REPO_ROOT, refPath);
    if (existsSync(abs)) {
      try {
        const s = statSync(abs);
        if (s.isFile()) continue;
      } catch { /* fall through to violation */ }
    }
    violations.push({
      line: i + 1,
      path: refPath,
      snippet: line.slice(0, 160) + (line.length > 160 ? '...' : ''),
    });
  }
}

ok(`scanned ${scanned} repo-path references in QA plan`);

if (violations.length > 0) {
  const seen = new Set<string>();
  const unique: typeof violations = [];
  for (const v of violations) {
    const id = `${v.path}@${v.line}`;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(v);
  }
  console.error(`\nFAIL: ${unique.length} dead path reference(s) in QA plan:`);
  for (const v of unique) {
    console.error(`  line ${v.line}: ${v.path}`);
    console.error(`    ${v.snippet}`);
  }
  console.error(`\nFix: either create the cited file, OR update the QA plan to remove the`);
  console.error(`reference, OR add qa-plan-path-allow:<reason> on the same line if the path`);
  console.error(`is intentional (e.g. external file or path that will exist on deploy day).`);
  process.exit(1);
}

ok(`every cited repo path resolves to a real file`);
console.log(`\n[verify-qa-plan-paths-exist] ${asserts}/2 assertions passed`);
