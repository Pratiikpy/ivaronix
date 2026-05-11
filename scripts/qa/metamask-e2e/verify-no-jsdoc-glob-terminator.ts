/**
 * No literal "ASTERISK SLASH" substring inside a JSDoc block comment.
 *
 * Recurring bug shape (sweeps 171, 207, 212): a regression file's
 * header JSDoc describes a glob pattern using slash-asterisk-asterisk
 * markers. The two-character "asterisk slash" terminates the JSDoc
 * block prematurely, leaving everything after parsed as TS — typically
 * "Expected semicolon" or "Unexpected dot" errors that look unrelated
 * to the comment.
 *
 * This regression scans verify-*.ts files for the forbidden token
 * inside any JSDoc block that opens with the standard SLASH-ASTERISK
 * opener and closes with the standard ASTERISK-SLASH closer. The
 * scan is line-by-line: any line starting with " *" or "/" that
 * contains the closer token outside the legitimate "end of comment"
 * position is flagged.
 *
 * Paraphrase to avoid: instead of writing a literal glob with the
 * forbidden token, describe the scope in prose:
 *   "every `route.ts` under apps/studio/src/app/api/ (recursive)"
 *   "any .ts file inside a packages/X/src tree"
 *
 * Pure source-file regression. Self-applies (this file's own JSDoc
 * carefully describes the forbidden token using two-word names
 * instead of the literal characters).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const QA_DIR = resolve(REPO_ROOT, 'scripts', 'qa', 'metamask-e2e');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

const files: string[] = [];
try {
  for (const name of readdirSync(QA_DIR)) {
    if (!/^verify-.*\.ts$/.test(name)) continue;
    const full = resolve(QA_DIR, name);
    let stat;
    try { stat = statSync(full); }
    catch { continue; }
    if (stat.isFile()) files.push(full);
  }
} catch { fail(`could not read ${QA_DIR}`); }
ok(`scanned ${files.length} verify-*.ts files`);

// Build the forbidden token at runtime from its two characters so
// THIS file's own JSDoc doesn't trigger.
const STAR = String.fromCharCode(0x2A);
const SLASH = String.fromCharCode(0x2F);
const TERMINATOR = STAR + SLASH; // ASTERISK then SOLIDUS

interface Violation { file: string; line: number; text: string; }
const violations: Violation[] = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  let inJsdoc = false;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // Single-line JSDoc (opener + closer on same line) is safe and
    // common (e.g. `/** one-liner. */`). Skip those entirely.
    const isOpener = /^\s*\/\*\*/.test(line);
    const closerCount = (line.match(new RegExp(TERMINATOR.replace(/\*/g, '\\*'), 'g')) ?? []).length;
    if (isOpener && closerCount >= 1) return; // single-line JSDoc

    if (!inJsdoc && isOpener) {
      inJsdoc = true;
      return;
    }
    if (!inJsdoc) return;
    // Inside a multi-line JSDoc.
    if (trimmed === TERMINATOR) {
      inJsdoc = false;
      return;
    }
    if (line.includes(TERMINATOR)) {
      violations.push({ file, line: i + 1, text: trimmed });
    }
  });
}

if (violations.length > 0) {
  console.error('');
  console.error(`FAIL: ${violations.length} verify-*.ts file(s) carry the JSDoc terminator inside a comment block:`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)}:${v.line}`);
    console.error(`    ${v.text}`);
  }
  console.error('');
  console.error('Fix: paraphrase the glob/pattern instead of writing the literal token.');
  console.error('  Bad:  "scan apps/studio/src/app/api/STAR-STAR/route.ts"   (terminates JSDoc)');
  console.error('  Good: "every `route.ts` under apps/studio/src/app/api/ (recursive)"');
  process.exit(1);
}

ok(`no verify-*.ts file has the JSDoc terminator mid-comment`);

console.log(`\n[verify-no-jsdoc-glob-terminator] ${asserts} assertions passed`);
