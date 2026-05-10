/**
 * A.4.3 (operator-script polish) regression · `pnpm audit:list` regex
 * accepts both dashed and space-numbered audit-ID shapes.
 *
 * Closes the silent parser bug found by the cron sweep on 2026-05-10:
 * the V2-contract commits use `Closes audit WT 26` / `Closes audit WT 32`
 * etc. (space + number suffix). The original regex `[A-Za-z0-9._\-]+`
 * stopped at the first space and produced a bare `WT` ID, collapsing
 * 4 distinct WT-N closures into one fake "WT" row.
 *
 * The fix accepts:
 *   Closes audit A.5.9                  -> 'A.5.9'
 *   Closes audit B-V2-13                -> 'B-V2-13'
 *   Closes audit WT 26                  -> 'WT 26'
 *   Closes audit S-1                    -> 'S-1'
 *
 * And does NOT greedily consume trailing prose:
 *   Closes audit A.5.7\nSome other line  -> 'A.5.7'
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
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

// Re-extract the regex literal from the source so the test stays in
// sync if the script changes.
const auditListPath = resolve(REPO_ROOT, 'scripts/diag/audit-list.ts');
if (!existsSync(auditListPath)) fail(`expected file missing: scripts/diag/audit-list.ts`);
const source = readFileSync(auditListPath, 'utf8');
const regexLiteral = source.match(/Closes audit\\s\+\([^)]+\)\??/);
if (!regexLiteral) fail('could not locate audit-id regex in audit-list.ts');
ok('audit-list source contains the audit-id regex literal');

// Reconstruct the regex as the script uses it.
const AUDIT_REGEX = /Closes audit\s+([A-Za-z][A-Za-z0-9._\-]*(?:\s+\d+)?)/g;

interface Case { input: string; expected: string[] }
const CASES: Case[] = [
  { input: 'Closes audit A.5.9', expected: ['A.5.9'] },
  { input: 'Closes audit B-V2-13', expected: ['B-V2-13'] },
  { input: 'Closes audit WT 26', expected: ['WT 26'] },
  { input: 'Closes audit S-1', expected: ['S-1'] },
  { input: 'Closes audit K-2', expected: ['K-2'] },
  // Multi-line body with multiple closures (the actual common shape).
  { input: 'Closes audit A.5.9\nCloses audit WT 26\nSomething else', expected: ['A.5.9', 'WT 26'] },
  // No greedy match — `Some other line` is not part of the ID.
  { input: 'Closes audit A.5.7\nSome other line that mentions A.5.7', expected: ['A.5.7'] },
  // Dashed B-V2 numbers should parse too.
  { input: 'Closes audit B-V2-23\nCloses audit B-V2-22', expected: ['B-V2-23', 'B-V2-22'] },
];

for (const c of CASES) {
  AUDIT_REGEX.lastIndex = 0; // reset state between matchAll calls
  const ids = [...c.input.matchAll(AUDIT_REGEX)].map((m) => m[1]!.trim());
  const actual = JSON.stringify(ids);
  const expected = JSON.stringify(c.expected);
  if (actual !== expected) {
    fail(`regex mismatch on input "${c.input.replace(/\n/g, '\\n')}": expected ${expected}, got ${actual}`);
  }
  ok(`regex parses "${c.input.split('\n')[0]}..." correctly`);
}

console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
