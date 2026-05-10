/**
 * Regression: no file currently tracked by git matches a gitignore rule
 * (without an explicit re-include).
 *
 * Why this gate exists (sweep 86 finding · third occurrence of pattern):
 *   The cron has caught three instances of self-contradicting gitignores:
 *
 *     - Sweep 73 caught `_archive/` — line 22 ignored, line 102 comment
 *       said "do NOT gitignore" (8 files untracked but referenced
 *       everywhere). Resolution: untrack-the-rule, track-the-files.
 *     - Sweep 73 caught `new-entries/` — present locally, not in
 *       gitignore, untracked but unprotected from `git add -A`.
 *     - Sweep 85 caught `test-targets/dd-batch/` — blanket
 *       `test-targets/` rule, but 3 vendor-agreement fixtures tracked
 *       anyway. Resolution: re-include the dd-batch/ subdir.
 *
 *   The structural cause: git doesn't auto-untrack pre-existing files
 *   when a .gitignore rule is added. Files committed BEFORE the rule
 *   survive tracked, invisibly contradicting the rule. The
 *   contradiction sits hidden until `git check-ignore` is run against
 *   a specific path.
 *
 * What we check:
 *   - Walk `git ls-files` (every tracked file in the repo)
 *   - Run `git check-ignore --no-index` against each path
 *   - Any tracked file that would be ignored by current rules is a
 *     contradiction. The fix is one of:
 *       (a) untrack the file (`git rm --cached <path>`) if the rule
 *           is correct;
 *       (b) loosen the rule with a re-include pattern (`!subdir/`)
 *           if the file should stay tracked;
 *       (c) edit the rule to be more specific.
 *
 * Implementation note:
 *   `git check-ignore -v <path>` returns 0 if the path IS ignored,
 *   1 if not. We invert: tracked + ignored = bug. Calls are batched
 *   via `git check-ignore --stdin` for performance — running a
 *   subprocess per tracked file would be O(N) shell calls.
 *
 * Captures sweep 86's closure of the recurring pattern. Testnet-only.
 * The regression IS the durable record. Future contributors who add a
 * .gitignore rule that contradicts existing tracked content will fail
 * at pre-commit instead of leaving silent drift.
 */
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

console.log('Repo · no tracked file matches a gitignore rule\n');

let trackedFiles: string[];
try {
  const stdout = execFileSync('git', ['ls-files'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  trackedFiles = stdout.split(/\r?\n/).filter((s) => s.length > 0);
} catch (err) {
  console.error('  FAIL · could not list tracked files:', (err as Error).message);
  process.exit(1);
}

console.log(`  scanned ${trackedFiles.length} tracked files`);

// Run git check-ignore against ALL tracked files in one batch.
// `git check-ignore --stdin` reads paths from stdin, prints one line
// per IGNORED match (silent for non-matches). Exit 0 = at least one
// match, 1 = none, 128 = error. We use `-v` to see which rule matched.
let conflicts: string[] = [];
try {
  const stdin = trackedFiles.join('\n') + '\n';
  // execFileSync with input + an exit-1-not-rejected harness: when
  // git check-ignore prints zero matches it exits 1, which throws.
  // We catch and treat that as "all clear."
  const stdout = execFileSync(
    'git',
    ['check-ignore', '--no-index', '--stdin', '-v'],
    {
      cwd: REPO_ROOT,
      input: stdin,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  conflicts = stdout.split(/\r?\n/).filter((s) => s.length > 0);
} catch (err) {
  // Exit 1 = no matches found. That's the success case for THIS regression.
  const e = err as { status?: number; stdout?: string };
  if (e.status === 1) {
    conflicts = [];
  } else {
    console.error('  FAIL · git check-ignore error:', (err as Error).message);
    process.exit(1);
  }
}

// Filter out re-include matches. `git check-ignore -v` reports BOTH
// non-negated ignore matches AND negated re-include matches with the
// same exit code 0. Output format: `.gitignore:LINE:PATTERN\tPATH`.
// A re-include pattern starts with `!` (e.g. `!test-targets/dd-batch/**`).
// Those are NOT contradictions — they're the explicit "track this
// despite a broader ignore" declarations. Only non-negated matches
// represent the bug class this gate targets.
const realConflicts = conflicts.filter((line) => {
  // The "PATTERN" portion sits between the second `:` and the tab.
  const tabIdx = line.indexOf('\t');
  if (tabIdx < 0) return true; // unparseable — keep as suspect
  const ruleSpec = line.slice(0, tabIdx);
  const lastColon = ruleSpec.lastIndexOf(':');
  if (lastColon < 0) return true;
  const pattern = ruleSpec.slice(lastColon + 1);
  return !pattern.startsWith('!');
});

if (realConflicts.length === 0) {
  if (conflicts.length > 0) {
    console.log(`  ${conflicts.length} re-include match(es) seen (expected · not bugs)`);
  }
  console.log(`  PASS · zero tracked-but-ignored conflicts`);
  process.exit(0);
}

console.error(`  FAIL · ${realConflicts.length} tracked file(s) match a gitignore rule:\n`);
for (const c of realConflicts) {
  console.error(`    ${c}`);
}
console.error('\n  fix options:');
console.error('    (a) git rm --cached <path>   — if the rule is correct');
console.error('    (b) add a re-include `!<path>` to .gitignore — if the file should stay tracked');
console.error('    (c) tighten the .gitignore rule pattern');
process.exit(1);
