// Regression: render-target markdown docs (README, PITCH, JUDGE_GUIDE,
// MAINNET_READINESS) must not contain bare numerical claims that
// match values currently in numbers.json. If a number that's already
// auto-derivable appears un-marker-wrapped, it is a future drift waiting
// to ship.
//
// Why this exists:
//   Cron-sweeps 39, 41, 42 each found stale numerical claims in these
//   four docs. Each fix wrapped the number in a numbers:auto marker.
//   This regression ensures the next contributor who adds a numerical
//   claim ALSO wraps it in a marker, rather than landing a fresh
//   drift surface.
//
// Scope:
//   For each value V in numbers.json that's a "leaf number" (string
//   form of an integer/decimal), scan each TARGET_DOC for occurrences
//   of V outside of:
//     - numbers:auto markers (the existing drift-immune sites)
//     - fenced code blocks
//     - inline code spans
//     - YAML/JSON fixture blocks (block of 4-space indented JSON)
//
//   A bare match means the value is hard-coded as prose. Fail.
//
// Allow-list:
//   - Numbers that ALSO appear in numbers:auto markers somewhere in
//     the doc are presumed intentional. The match outside markers
//     is suspicious only if the doc has zero markers for that value.
//   - Inline marker `numbers-bare:allow:reason`
import { readFileSync } from 'node:fs';
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

const TARGET_DOCS = [
  'README.md',
  'docs/PITCH.md',
  'docs/JUDGE_GUIDE.md',
  'docs/MAINNET_READINESS.md',
];

// Subset of numbers.json keys we GATE on. Some leaf numbers (chainId,
// timestamps) are CSS-token-shaped or part of immutable identifiers
// and should NOT trigger the gate even when they appear bare.
const GATED_KEYS: ReadonlyArray<string> = [
  'receipts.total',
  'receipts.v1Anchored',
  'receipts.v2Anchored',
  'contracts.deployed',
  'contracts.foundryTests',
  'skills.firstParty',
  'skills.vendored',
  'skills.catalogTotal',
  'packages.typecheckClean',
  'packages.workspaceTotal',
];

interface NumbersFile { [k: string]: unknown }

function lookup(json: NumbersFile, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (cur, part) => (cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[part] : undefined),
    json,
  );
}

const numbers = JSON.parse(
  readFileSync(resolve(REPO_ROOT, 'docs', 'numbers.json'), 'utf8'),
) as NumbersFile;

ok(`loaded ${GATED_KEYS.length} gated keys from numbers.json`);

// Build a (value -> [keys]) map for lookup-by-value.
//
// Filtering rule: only gate on values >= 100. Single + double-digit
// values create too much noise — they appear in markdown table row
// numbers, URL fragments, version numbers, port numbers, byte counts.
// Drift on small counts (e.g. 6 -> 8 contracts) is real but easier
// to catch in PR review. Drift on large counts (1644 receipts, 167
// tests, 156 skills) is what hides best in long docs and is what
// this gate is for.
const MIN_GATED_VALUE = 100;

const valueToKeys = new Map<string, string[]>();
for (const key of GATED_KEYS) {
  const v = lookup(numbers, key);
  if (typeof v !== 'number') continue;
  if (v < MIN_GATED_VALUE) continue;
  const stringForms = new Set<string>([
    String(v),
    v.toLocaleString('en-US'), // 1644 + 1,644
  ]);
  for (const form of stringForms) {
    if (!valueToKeys.has(form)) valueToKeys.set(form, []);
    valueToKeys.get(form)!.push(key);
  }
}

// Strip fenced + inline code spans from a markdown source. Replace
// with whitespace of equal length so line/column offsets stay accurate.
// Also strip 0x-hex strings (addresses + tx hashes) so a "0" or "8"
// embedded inside an address doesn't false-positive against
// receipts.v2Anchored=0 or contracts.deployed=8.
function stripCode(src: string): string {
  let out = src.replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length));
  out = out.replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
  // 0x hex (any length >= 2 hex chars after 0x) — covers addresses (40),
  // tx hashes (64), and shorter hex literals.
  out = out.replace(/0x[a-fA-F0-9]+/g, (m) => ' '.repeat(m.length));
  return out;
}

// Strip the contents BETWEEN any numbers:auto markers (we keep the
// outer markers so unbalanced-marker errors still surface, but we
// don't penalize the value INSIDE the marker — that's exactly where
// it's supposed to be).
function stripInsideMarkers(src: string): string {
  return src.replace(
    /<!--\s*numbers:auto:[\w.]+\s*-->[\s\S]*?<!--\s*\/numbers:auto:[\w.]+\s*-->/g,
    (m) => ' '.repeat(m.length),
  );
}

interface Hit { file: string; line: number; col: number; value: string; keys: string[]; context: string }
const hits: Hit[] = [];

for (const rel of TARGET_DOCS) {
  const path = resolve(REPO_ROOT, rel);
  let src;
  try { src = readFileSync(path, 'utf8'); } catch { continue; }

  const cleaned = stripInsideMarkers(stripCode(src));
  const rawLines = src.split(/\r?\n/);
  const lines = cleaned.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const rawLine = rawLines[i]!;
    if (rawLine.includes('numbers-bare:allow:')) continue;

    for (const [valueForm, keys] of valueToKeys) {
      // Word-boundary match: digits surrounded by non-digit context.
      // The escape handles the comma in "1,644".
      const escaped = valueForm.replace(/,/g, '\\,');
      const re = new RegExp(`(^|[^0-9.])(${escaped})(?![0-9.])`, 'g');
      for (const m of line.matchAll(re)) {
        hits.push({
          file: rel,
          line: i + 1,
          col: (m.index ?? 0) + (m[1]?.length ?? 0) + 1,
          value: valueForm,
          keys,
          context: rawLine.trim().slice(0, 140),
        });
      }
    }
  }
}

if (hits.length > 0) {
  console.error(`\nFAIL: ${hits.length} bare numerical claim(s) in render-target docs:`);
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}:${h.col} · "${h.value}" matches numbers.json key(s): ${h.keys.join(', ')}`);
    console.error(`    ${h.context}`);
  }
  console.error('');
  console.error('Resolution:');
  console.error('  Wrap the number in a numbers:auto marker so future');
  console.error('  pnpm numbers:refresh propagates without hand-edit. Example:');
  console.error('  Bare:   "1644+ receipts"');
  console.error('  Wrap:   "<!-- numbers:auto:receipts.total -->1644<!-- /numbers:auto:receipts.total -->+ receipts"');
  console.error('');
  console.error('  OR add `numbers-bare:allow:<reason>` on the line for an');
  console.error('  intentional, documented exception (rare — most numbers');
  console.error('  belong in a marker).');
  process.exit(1);
}

ok(`every gated number in TARGET_DOCS lives inside a numbers:auto marker`);
console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
