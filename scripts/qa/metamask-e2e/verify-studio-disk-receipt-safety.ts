/**
 * Studio disk-as-truth gate. HALF_BAKED §J-3 closure lock (sweep 205).
 *
 * Class this gates against: any Studio code path that reads a
 * receipt-shaped JSON file from disk and accesses fields on the
 * parsed value without first running the minimum-shape Zod validator
 * exported from `apps/studio/src/lib/local-receipt.ts`
 * (`safeReadReceiptBody`).
 *
 * Pre-fix shape (the bug):
 *   const body = JSON.parse(readFileSync(file, 'utf8')) as ReceiptBody;
 *   ... body.storage?.receiptRoot ... // crashes on migration-stale JSON
 *
 * Required shape:
 *   const body = safeReadReceiptBody(file);
 *   if (!body) continue; // shape check failed, skip the file
 *   ... body.storage?.receiptRoot ... // safe — Zod enforced id+type
 *
 * Rule: no first-party file under `apps/studio/src/` may write the
 * literal `JSON.parse(readFileSync(...)) as ReceiptBody` shape.
 * Exception: `lib/local-receipt.ts` itself, where `safeReadReceiptBody`
 * is defined and JSON.parse happens INSIDE the validator. That file
 * is the canonical entry point.
 *
 * Pure source-file regression.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const STUDIO_SRC = resolve(REPO_ROOT, 'apps', 'studio', 'src');
const ALLOWED_FILE = resolve(STUDIO_SRC, 'lib', 'local-receipt.ts');

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
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
}

const files: string[] = [];
walk(STUDIO_SRC, files);
ok(`scanned ${files.length} TS/TSX files under apps/studio/src/`);

// Forbidden form: a JSON.parse(readFileSync(...)) chain on the SAME
// line cast to `ReceiptBody` (with or without intersection types).
// We match the cast token specifically — generic JSON.parse usage for
// non-receipt shapes is out of scope here.
const forbiddenRe = /JSON\.parse\s*\(\s*readFileSync[^)]*\)\s*as\s+ReceiptBody/;
// Multi-line form: readFileSync on one line, JSON.parse on next, cast
// on a third. We're conservative — only the single-line pattern is
// gated. Multi-line writers can sidestep by reformatting; the verify
// regression is the recipe, not the cop.

const violations: { file: string; line: number; text: string }[] = [];
for (const file of files) {
  if (resolve(file) === ALLOWED_FILE) continue; // canonical validator location
  const src = readFileSync(file, 'utf8');
  if (!forbiddenRe.test(src)) continue;
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // Skip comments — the pre-fix shape appears verbatim in closure
    // citations like the one in local-receipts.ts:66.
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    if (forbiddenRe.test(line)) {
      violations.push({ file, line: i + 1, text: line.trim() });
    }
  });
}

if (violations.length > 0) {
  console.error('');
  console.error(`FAIL: ${violations.length} Studio file(s) cast disk JSON straight to ReceiptBody:`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)}:${v.line}`);
    console.error(`    ${v.text}`);
  }
  console.error('');
  console.error('Fix: import { safeReadReceiptBody } from "./local-receipt"');
  console.error('     const body = safeReadReceiptBody(file);');
  console.error('     if (!body) continue; // shape-check failed, skip');
  process.exit(1);
}

ok(`no first-party Studio file casts disk JSON straight to ReceiptBody`);

// Sanity: confirm the canonical validator is actually exported from
// the allowed location. If someone deletes safeReadReceiptBody but
// leaves the rule citation, the regression should still flag it.
const canon = readFileSync(ALLOWED_FILE, 'utf8');
if (!/export\s+\{\s*safeReadReceiptBody\s*\}|export\s+function\s+safeReadReceiptBody/.test(canon)) {
  fail('apps/studio/src/lib/local-receipt.ts must export safeReadReceiptBody (sweep 205 wiring)');
}
ok('safeReadReceiptBody exported from local-receipt.ts');

if (!/LocalReceiptShape\s*=\s*z\.object/.test(canon)) {
  fail('apps/studio/src/lib/local-receipt.ts must declare LocalReceiptShape Zod schema (sweep 205 wiring)');
}
ok('LocalReceiptShape Zod schema declared in local-receipt.ts');

console.log(`\n[verify-studio-disk-receipt-safety] ${asserts} assertions passed`);
