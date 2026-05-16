/**
 * iter-128 closure regression for QA plan PENDING-status drift.
 *
 * Catches a different drift class than iter-126/127: PENDING markers in
 * the QA plan that reference USER_TODO items already shipped and closed.
 *
 * Pre-iter-128 the plan's "Receipt Type Coverage" section had two stale
 * PENDING markers: slot 8 swarm pointed at B-V2-31 (SHIPPED iter-72),
 * slot 9 subscription pointed at B-V2-18 (SHIPPED 2026-05-12).
 *
 * This regression parses USER_TODO.md for all paragraph IDs of shape
 * B-V2-N with a closure marker on the header line, then scans the QA
 * plan for any "PENDING ... B-V2-N" mention. Drift fails CI.
 *
 * Allow-marker: `qa-plan-pending-allow:<reason>` on the same paragraph
 * if the QA plan legitimately keeps PENDING despite the USER_TODO
 * closure (e.g. code shipped but live verify gated on operator action).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const USER_TODO = resolve(REPO_ROOT, 'docs/USER_TODO.md');
const QA_PLAN = resolve(REPO_ROOT, 'Ivaronix_User_QA_Test_Plan.md');

// QA plan is intentionally local-only after the privacy-scrub commit
// (bc2c636). CI runners don't have it, so this regression is dev-only
// when the operator has the file on disk. Skip cleanly otherwise so CI
// doesn't fail on internal-doc absence.
if (!existsSync(QA_PLAN)) {
  console.log(`SKIP: ${QA_PLAN.split(/[\\/]/).pop()} not in working tree (private doc · scrubbed from public repo). Regression is dev-only.`);
  process.exit(0);
}

let asserts = 0;
const ok = (label: string): void => {
  asserts += 1;
  console.log(`OK: ${label}`);
};

const userTodoSrc = readFileSync(USER_TODO, 'utf8');

const CLOSED_MARKERS = ['SHIPPED', 'CLOSED', 'CODE-COMPLETE', 'DEPLOYED', 'FIXED', 'VERIFIED'];
const CLOSED_RE = new RegExp(`\\u2705\\s*(?:${CLOSED_MARKERS.join('|')})`, 'i');

const closedIds = new Set<string>();
const HEADER_RE = /^### (B-V2-[A-Z0-9-]+)([^\n]*)$/gm;
let m: RegExpExecArray | null;
while ((m = HEADER_RE.exec(userTodoSrc)) !== null) {
  const id = m[1]!;
  const rest = m[2] ?? '';
  if (CLOSED_RE.test(rest)) closedIds.add(id);
}
ok(`parsed ${closedIds.size} closed B-V2-N entries from USER_TODO.md`);

const qaSrc = readFileSync(QA_PLAN, 'utf8');

const violations: { id: string; line: number; snippet: string }[] = [];
const lines = qaSrc.split(/\r?\n/);

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!;
  const refMatches = [...line.matchAll(/(B-V2-[A-Z0-9-]+)/g)];
  if (refMatches.length === 0) continue;
  const window = `${lines[Math.max(0, i - 1)] ?? ''}\n${line}`;
  if (!/PENDING/i.test(window)) continue;
  const allowWindow = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join('\n');
  if (/qa-plan-pending-allow:/.test(allowWindow)) continue;
  for (const r of refMatches) {
    const id = r[1]!;
    if (!closedIds.has(id)) continue;
    violations.push({
      id,
      line: i + 1,
      snippet: line.slice(0, 160) + (line.length > 160 ? '...' : ''),
    });
  }
}

if (violations.length > 0) {
  console.error(`\nFAIL: ${violations.length} stale PENDING reference(s) to closed USER_TODO entries:`);
  for (const v of violations) {
    console.error(`  ${v.id} (line ${v.line}):`);
    console.error(`    ${v.snippet}`);
  }
  console.error(`\nFix: USER_TODO marks these as closed. Update the QA plan PENDING line to`);
  console.error(`     reflect the closure status, OR add a qa-plan-pending-allow:<reason>`);
  console.error(`     comment if PENDING is legitimately separate (e.g. code shipped but`);
  console.error(`     live verify gated on operator action).`);
  process.exit(1);
}

ok(`no QA plan PENDING references point at closed USER_TODO B-V2-N entries`);
console.log(`\n[verify-qa-plan-pending-vs-user-todo] ${asserts}/2 assertions passed`);
