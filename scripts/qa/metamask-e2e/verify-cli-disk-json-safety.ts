/**
 * CLI disk-as-truth gate. HALF_BAKED §J-3 CLI-half closure (sweep 206).
 *
 * Mirror of the Studio gate but with the CLI's prevailing pattern: the
 * CLI doesn't depend on Zod at runtime (footprint concern in published
 * npm builds), so the gating shape is "cast to `unknown` then narrow",
 * not a Zod safeParse. Both patterns achieve the same safety property —
 * a migration-stale disk file is rejected before its fields are read.
 *
 * Forbidden form:
 *   JSON.parse(readFileSync(...)) as <NamedType>          // direct cast
 *
 * Accepted forms:
 *   JSON.parse(readFileSync(...)) as unknown              // cast to unknown
 *   const raw: unknown = JSON.parse(readFileSync(...));   // typed-unknown
 *   parseConversationFile(JSON.parse(...), path)          // explicit validator
 *   const data: Partial<X> = ...                          // partial cast
 *
 * Pure source-file regression.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const CLI_SRC = resolve(REPO_ROOT, 'apps', 'cli', 'src');

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
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = resolve(dir, name);
    let stat;
    try { stat = statSync(full); }
    catch { continue; }
    if (stat.isDirectory()) walk(full, out);
    else if (/\.ts$/.test(name)) out.push(full);
  }
}

const files: string[] = [];
walk(CLI_SRC, files);
ok(`scanned ${files.length} TS files under apps/cli/src/`);

// Forbidden shape: `JSON.parse(readFileSync(...)) as <CamelCaseType>`
// where <CamelCaseType> is anything BUT `unknown` or a `Partial<>`
// wrapper. The acceptable "cast to unknown" + narrow pattern reads as
// the explicit "I am not trusting this yet" stance.
//
// Pattern decomposition:
//   JSON\.parse\s*\(\s*readFileSync   — the disk-read chain
//   ...\)\s*as\s+                     — terminal cast keyword
//   (?!unknown\b|Partial\b)           — NOT cast to unknown / Partial
//   [A-Z]\w*                          — a named TS type
const forbiddenRe = /JSON\.parse\s*\(\s*readFileSync[^)]*\)\s*as\s+(?!unknown\b|Partial\b)[A-Z]\w*/;

interface Violation { file: string; line: number; text: string; }
const violations: Violation[] = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!forbiddenRe.test(src)) continue;
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return; // skip comments
    if (forbiddenRe.test(line)) {
      violations.push({ file, line: i + 1, text: trimmed });
    }
  });
}

if (violations.length > 0) {
  console.error('');
  console.error(`FAIL: ${violations.length} CLI file(s) cast disk JSON straight to a typed shape:`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)}:${v.line}`);
    console.error(`    ${v.text}`);
  }
  console.error('');
  console.error('Fix: use the "cast to unknown then narrow" pattern.');
  console.error('  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));');
  console.error('  if (!raw || typeof raw !== "object") return null;');
  console.error('  // ... narrow field by field, or call a parse<Shape> validator');
  console.error('Or accept the lossy shape: `as Partial<X>` for files that may');
  console.error('omit fields (downstream optional-chaining handles missing data).');
  process.exit(1);
}

ok(`no CLI file casts disk JSON straight to a typed shape`);

console.log(`\n[verify-cli-disk-json-safety] ${asserts} assertions passed`);
