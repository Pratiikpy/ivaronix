/**
 * No `console.log` / `console.debug` in library packages.
 *
 * HALF_BAKED §J-11 named three lint rules ESLint would catch:
 *   1. no-explicit-any        → gated by verify-as-any-budget.ts
 *   2. no-non-null-assertion  → gated by tsconfig strict + noUncheckedIndexedAccess
 *   3. no-console in libs     → gated by THIS regression (sweep 207)
 *
 * Scope of this gate:
 *   - apps/ — out of scope. CLI commands use console output (or a ui
 *     helper that wraps console). Studio renders to a browser.
 *   - packages/_design/ — out of workspace (design-only stubs).
 *   - packages/opencode-* — upstream-bundled, not first-party.
 *   - any .test.ts under packages/ — tests may print on failure.
 *
 *   Targets: every other .ts file inside any packages/X/src tree.
 *
 * Allowed: console.warn, console.error, console.info — these are
 * legitimate operator-facing signals (deprecation warnings, fallback
 * notices, error escalation). The 6 existing call sites across
 * `og-chain/deployments.ts`, `runtime/env.ts`, `skills/loader.ts`,
 * `consensus/index.ts`, `memory/vector.ts` (×2) are intentional and
 * stay.
 *
 * Forbidden: console.log, console.debug — debug-only output that
 * leaks into published code.
 *
 * Skip pattern: inline `console-log-allow:<reason>` comment.
 *
 * Pure source-file regression.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const PACKAGES_DIR = resolve(REPO_ROOT, 'packages');

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
  let entries: string[];
  try { entries = readdirSync(dir); }
  catch { return; }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name === '.turbo') continue;
    const full = resolve(dir, name);
    let stat;
    try { stat = statSync(full); }
    catch { continue; }
    if (stat.isDirectory()) walk(full, out);
    else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) out.push(full);
  }
}

// In-scope: every packages/<name>/src/ subtree where <name> is NOT
// _design and not an opencode-* upstream-bundled package.
const targetFiles: string[] = [];
let pkgEntries: string[] = [];
try { pkgEntries = readdirSync(PACKAGES_DIR); }
catch { fail(`could not read ${PACKAGES_DIR}`); }
for (const entry of pkgEntries) {
  if (entry === '_design' || entry.startsWith('opencode-')) continue;
  const srcDir = resolve(PACKAGES_DIR, entry, 'src');
  let stat;
  try { stat = statSync(srcDir); }
  catch { continue; }
  if (!stat.isDirectory()) continue;
  walk(srcDir, targetFiles);
}
ok(`scanned ${targetFiles.length} first-party library .ts files (test files excluded)`);

// Forbidden: console.log( or console.debug( at a real call site.
// We require an opening paren so JSDoc mentions (`* console.log(...)`)
// remain harmless — comments are also skipped via the per-line trim
// check below.
const forbiddenRe = /\bconsole\.(?:log|debug)\s*\(/;

interface Violation { file: string; line: number; text: string; }
const violations: Violation[] = [];
for (const file of targetFiles) {
  const src = readFileSync(file, 'utf8');
  if (!forbiddenRe.test(src)) continue;
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return; // skip comments
    if (/console-log-allow:/.test(line)) return; // inline allow marker
    if (forbiddenRe.test(line)) {
      violations.push({ file, line: i + 1, text: trimmed });
    }
  });
}

if (violations.length > 0) {
  console.error('');
  console.error(`FAIL: ${violations.length} console.log / console.debug call(s) in library packages:`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)}:${v.line}`);
    console.error(`    ${v.text}`);
  }
  console.error('');
  console.error('Fix: library packages are imported by apps and (eventually) published to npm.');
  console.error('  Debug output via console.log leaks into consumer terminals + browser DevTools.');
  console.error('  - For operator-facing signals (deprecation, fallback, error escalation),');
  console.error('    use console.warn or console.error — allowed by this gate.');
  console.error('  - For runtime telemetry hooks, accept a logger argument.');
  console.error('  - For temporary debug during dev, add `// console-log-allow:<reason>` inline.');
  process.exit(1);
}

ok(`no console.log / console.debug in any first-party library .ts file`);

console.log(`\n[verify-no-console-log-in-libs] ${asserts} assertions passed`);
