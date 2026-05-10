/**
 * CLAUDE.md §9 regression · NO sprint-language in contract NatSpec.
 *
 * NatSpec compiles into permanent on-chain contract metadata. Sprint
 * shorthand like `K-1 fix`, `Day-3`, `Phase B`, `MVP`, `killer demo`,
 * `Track 2 headline`, `sprint` fossilize against contracts that may
 * outlive the team's memory of what those tokens meant. CLAUDE.md §9
 * mandates capability-statement framing or threat-model framing
 * instead.
 *
 * Explicit exception (per CLAUDE.md §9 last sentence): traceability
 * links like `planning-003 §A.5.X` and `WT 31` MAY appear in NatSpec
 * because they map a comment to a specific audit closure that lives
 * forever in the docs. Test files use `test_K1_*` names — those are
 * NOT NatSpec, they're test identifiers, also explicitly allowed.
 *
 * This regression scans `contracts/src/**.sol` only. Test files
 * (`contracts/test/**.t.sol`) are excluded.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const CONTRACTS_SRC = resolve(REPO_ROOT, 'contracts', 'src');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

// Patterns CLAUDE.md §9 explicitly bans in NatSpec.
// Each pattern is paired with a human-readable label for the failure
// message + a short explanation of why it's banned.
const BANNED: { regex: RegExp; label: string }[] = [
  { regex: /\bDay-\d+\b/, label: 'Day-N (sprint shorthand)' },
  { regex: /\bPhase [A-C]\b/, label: 'Phase A/B/C (sprint shorthand)' },
  { regex: /\bK-\d+ fix\b/, label: 'K-N fix (sprint shorthand)' },
  { regex: /\bK-\d+ reentrancy\b/, label: 'K-N reentrancy (sprint shorthand)' },
  { regex: /\(K-\d+\)/, label: '(K-N) parenthetical (sprint shorthand)' },
  { regex: /\bMVP\b/, label: 'MVP (marketing shorthand)' },
  { regex: /killer demo/i, label: 'killer demo (marketing language)' },
  { regex: /\bTrack \d+ headline\b/, label: 'Track N headline (marketing shorthand)' },
  { regex: /\bsprint\b/i, label: 'sprint (process shorthand)' },
];

// Allowed traceability shapes (CLAUDE.md §9 last-sentence exception).
// If a banned-pattern hit ALSO matches one of these allow-shapes, it's
// a false positive and we skip it.
const ALLOWED_TRACEABILITY: RegExp[] = [
  /planning-\d+\s*§/,
  /\bWT\s+\d+\b/,
];

function listSolFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...listSolFiles(path));
    } else if (entry.endsWith('.sol')) {
      out.push(path);
    }
  }
  return out;
}

function isComment(line: string): boolean {
  // Strip leading whitespace; check for // or /* or * (multi-line continuation).
  const trimmed = line.trimStart();
  return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
}

const files = listSolFiles(CONTRACTS_SRC);
ok(`scanned ${files.length} .sol files under contracts/src/`);

const violations: { file: string; line: number; text: string; reason: string }[] = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!isComment(line)) continue;
    for (const { regex, label } of BANNED) {
      if (!regex.test(line)) continue;
      // Allow-list check: if the comment also has an explicit
      // traceability marker, skip the banned-pattern hit.
      if (ALLOWED_TRACEABILITY.some((r) => r.test(line))) continue;
      violations.push({
        file: file.replace(REPO_ROOT, ''),
        line: i + 1,
        text: line.trim(),
        reason: label,
      });
      break; // one violation per line is enough
    }
  }
}

if (violations.length > 0) {
  for (const v of violations) {
    console.error(`FAIL: ${v.file}:${v.line} · ${v.reason}`);
    console.error(`      ${v.text}`);
  }
  fail(
    `${violations.length} CLAUDE.md §9 violation(s) in contract NatSpec. ` +
    'Rewrite using capability-statement or threat-model framing.',
  );
}

ok('no banned sprint-language tokens in any contract NatSpec');

console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
