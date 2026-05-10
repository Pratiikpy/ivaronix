// Meta-regression: every verify-*.ts script under scripts/qa/metamask-e2e/
// must be referenced by at least one filter pattern in run-source-regressions.ts.
//
// Why this exists:
//   Sweep 51 noticed CI's regression-smokes job runs three filters
//   (studio + cli + contracts) and the pre-commit hook had to catch
//   up. The deeper question: what if a verify-*.ts script exists but
//   is referenced by NO filter? It would be dead-code — never run by
//   pre-commit, CI, or any developer command. The author thinks it's
//   gating something; reality is it's a no-op.
//
//   This regression closes the orphan class: every verify-*.ts under
//   scripts/qa/metamask-e2e/ must match at least one filter regex in
//   run-source-regressions.ts. If a contributor adds a new regression
//   without wiring it into a filter, this gate fails the build.
//
// Allow-list:
//   The verifier itself (this file) is excluded — it lives in the
//   same dir but isn't a "verify-*.ts" subject of the filter; it's
//   the meta-checker. Same for run-source-regressions.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

// ─── Collect every verify-*.ts file ────────────────────────────────────
const allFiles = readdirSync(HERE)
  .filter((f) => f.startsWith('verify-') && f.endsWith('.ts'))
  .sort();

ok(`found ${allFiles.length} verify-*.ts scripts under scripts/qa/metamask-e2e/`);

// ─── Extract filter regexes from run-source-regressions.ts ────────────
const runSrc = readFileSync(resolve(HERE, 'run-source-regressions.ts'), 'utf8');

// Extract regex literals from DOMAIN-SPECIFIC filter blocks. The `all`
// filter (with bare `/^verify-/` that matches every script) is
// trivially-satisfying — it would mask real orphans. We strip its
// block first, then extract regex literals from the rest.
//
// A real orphan is a script that appears nowhere in studio / studio-live
// / cli / contracts / live filters. Such a script runs only via the
// `all` filter (which nobody invokes regularly because it requires a
// running dev server for the live regs).
function stripAllFilter(src: string): string {
  // Match the `all: { ... }` block including its trailing comma.
  // Non-greedy match between `all: {` and the closing `},`.
  return src.replace(/\ball:\s*\{[\s\S]*?\},/, '');
}
const domainSrc = stripAllFilter(runSrc);

const FILTER_RE_LITERAL = /\/(\^verify-[A-Za-z0-9_*+()|.[\]{}\\?^$-]*)\//g;
const filterRegexes: RegExp[] = [];
for (const m of domainSrc.matchAll(FILTER_RE_LITERAL)) {
  try {
    filterRegexes.push(new RegExp(m[1]!));
  } catch {
    // skip invalid regex strings (defensive)
  }
}
ok(`extracted ${filterRegexes.length} domain-specific filter regex(es) (excluding the trivial all filter)`);

// ─── Match each file against the regex set ────────────────────────────
function isMatched(filename: string): boolean {
  // Strip .ts → match against the no-extension stem.
  const stem = filename.replace(/\.ts$/, '');
  for (const re of filterRegexes) {
    if (re.test(stem)) return true;
  }
  return false;
}

const orphans: string[] = [];
for (const f of allFiles) {
  if (!isMatched(f)) orphans.push(f);
}

if (orphans.length > 0) {
  console.error(`\nFAIL: ${orphans.length} orphan verify-*.ts script(s) — no filter covers them:`);
  for (const o of orphans) console.error(`  scripts/qa/metamask-e2e/${o}`);
  console.error('');
  console.error('Resolution:');
  console.error('  1. Add a filter regex pattern matching the file to');
  console.error('     run-source-regressions.ts (the relevant studio/cli/');
  console.error('     contracts filter). Pattern shape:');
  console.error('       /^verify-<file-stem-prefix>/');
  console.error('  2. Or delete the file if it was abandoned.');
  console.error('');
  console.error('Why this matters: an orphan regression runs nowhere — not in');
  console.error('pre-commit, not in CI. The author thinks it gates something');
  console.error('but it is dead code. Worse, future contributors copy-paste');
  console.error('the orphan as a template, perpetuating the pattern.');
  process.exit(1);
}

ok(`every verify-*.ts script is matched by at least one run-source-regressions filter`);
console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
