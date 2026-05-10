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
const regexLiteral = source.match(/\/\^\[ \\t\]\*Closes audit/);
if (!regexLiteral) fail('could not locate audit-id trailer regex (line-anchored shape) in audit-list.ts');
ok('audit-list source contains the line-anchored audit-id trailer regex');

// Reconstruct the regex as the script uses it (cron-sweep refinement
// 2026-05-10 · trailer must be on its own line, parenthetical context
// + trailing period allowed, mid-sentence prose disqualifies, the
// parenthetical may span multiple lines for wrapped commit messages).
const AUDIT_REGEX = /^[ \t]*Closes audit[ \t]+([A-Za-z][A-Za-z0-9._\-]*(?:[ \t]+\d+)?)[ \t]*(?:\([\s\S]*?\))?[ \t]*\.?[ \t]*$/gm;

interface Case { input: string; expected: string[]; label: string }
const CASES: Case[] = [
  { label: 'bare A.5 audit', input: 'Closes audit A.5.9', expected: ['A.5.9'] },
  { label: 'B-V2 dashed', input: 'Closes audit B-V2-13', expected: ['B-V2-13'] },
  { label: 'WT space-suffix', input: 'Closes audit WT 26', expected: ['WT 26'] },
  { label: 'S-1 short dashed', input: 'Closes audit S-1', expected: ['S-1'] },
  { label: 'K-2 short dashed', input: 'Closes audit K-2', expected: ['K-2'] },
  { label: 'parenthetical context allowed (own commit style)', input: 'Closes audit RULES-DRIFT-3 (og-storage test claim → reality).', expected: ['RULES-DRIFT-3'] },
  { label: 'parenthetical context without period', input: 'Closes audit ENV-PATH-1 (deployments-path doc/code drift)', expected: ['ENV-PATH-1'] },
  // Real commit shape: parenthetical wrapped across two lines.
  { label: 'multi-line parenthetical (wrapped commit message)', input: 'Closes audit RULES-DRIFT-1 (og-chain/og-router/og-storage/skills\nrules-vs-reality on tests).', expected: ['RULES-DRIFT-1'] },
  // Multi-line body: each line evaluated independently.
  { label: 'multiline two-closure body', input: 'Closes audit A.5.9\nCloses audit WT 26\nSomething else', expected: ['A.5.9', 'WT 26'] },
  // No greedy match — `Some other line` is not part of the ID.
  { label: 'multiline trailing prose ignored', input: 'Closes audit A.5.7\nSome other line that mentions A.5.7', expected: ['A.5.7'] },
  // Dashed B-V2 numbers should parse too.
  { label: 'multiline B-V2 closures', input: 'Closes audit B-V2-23\nCloses audit B-V2-22', expected: ['B-V2-23', 'B-V2-22'] },
  // FALSE-POSITIVE REGRESSION CASES (cron-sweep finding 2026-05-10):
  { label: 'mid-sentence "with Closes audit K-N trailer" rejected', input: '                              CHANGELOG with Closes audit K-N trailer', expected: [] },
  { label: 'mid-sentence "Closes audit trailer convention" rejected', input: '    - Conventional commits + Closes audit trailer convention', expected: [] },
  { label: 'docstring example "Closes audit S-1 -> S-1" rejected', input: "      Closes audit S-1          -> 'S-1'", expected: [] },
  // Multiline body where some lines are real and others are mid-prose.
  { label: 'mixed real + false-positive body', input: 'Closes audit A.5.9\n with Closes audit K-N trailer\nCloses audit WT 26', expected: ['A.5.9', 'WT 26'] },
];

for (const c of CASES) {
  AUDIT_REGEX.lastIndex = 0; // reset state between matchAll calls
  const ids = [...c.input.matchAll(AUDIT_REGEX)].map((m) => m[1]!.trim());
  const actual = JSON.stringify(ids);
  const expected = JSON.stringify(c.expected);
  if (actual !== expected) {
    fail(`regex mismatch [${c.label}]: input="${c.input.replace(/\n/g, '\\n')}" expected=${expected} got=${actual}`);
  }
  ok(`${c.label}`);
}

console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
