/**
 * Regression: no hardcoded 4-digit-or-greater numeric snapshots that
 * match a current numbers.json value, in tracked operational surfaces
 * (NatSpec, JSDoc, comments, spec docs, user-facing strings).
 *
 * Why this gate exists (sweep 94 finding · 4th occurrence pattern
 * closure):
 *   The cron has caught the same anti-pattern across many surfaces:
 *
 *     - Sweep 81: CLAUDE.md §2.2 ("1071 receipts" / "61 tests" / "14
 *       packages") — operational doc snapshot drift.
 *     - Sweep 87: .githooks/pre-commit ("23 gates" / "17 regressions")
 *       — shell-script snapshot drift.
 *     - Sweep 89: BUILD_PROGRESS.md ("17/17 packages" / "61/61 forge")
 *       — sprint-doc snapshot drift; fixed via archival header.
 *     - Sweep 90: CLAUDE.md §9 example ("61/61 tests") — didactic-
 *       example drift; rewrote to evergreen "every Foundry test green."
 *     - Sweep 93: 13 surfaces ("1,330+ receipts") — NatSpec, JSDoc,
 *       comments, spec docs, user-facing tooltip drift; rewrote to
 *       evergreen "existing receipts."
 *
 *   The recurring shape: a count gets hardcoded in prose at write
 *   time, the count grows over sweeps, the prose stays frozen,
 *   readers see a stale number. Each instance is a small drift; the
 *   accumulation is institutional credibility loss.
 *
 *   Render-target docs (README, PITCH, JUDGE_GUIDE, MAINNET_READINESS)
 *   already have `verify-no-bare-numbers-in-rendered-docs.ts` covering
 *   them. This gate covers the OTHER surfaces — NatSpec, JSDoc,
 *   comments, spec docs, user-facing strings — where hardcoded
 *   snapshots have been recurring.
 *
 * What we check:
 *   For every value V in numbers.json that's a "leaf integer" ≥ 100:
 *     For each tracked file under apps/, packages/, contracts/, scripts/,
 *     docs/, plus root markdown:
 *       - Find every occurrence of V (with or without comma separator,
 *         optionally followed by `+`).
 *       - Allow if:
 *         (a) inside a numbers:auto marker (the auto-render pipeline
 *             handles those)
 *         (b) inside a fenced code block or inline backtick span
 *             (likely sample data)
 *         (c) on a line containing `numbers-snapshot-allow:<reason>`
 *         (d) the file has an "ARCHIVAL" header (the archival pattern
 *             from planning-003 §A.5.4)
 *         (e) the file lives under _archive/ (legacy)
 *       - Otherwise: flag.
 *
 * Threshold rationale:
 *   "100" filters out trivial sequence numbers (e.g., line 7, page 12,
 *   issue #5) that wouldn't be in numbers.json anyway. The 4-digit
 *   counts that this gate targets (1,644 receipts, 167 tests, etc.)
 *   all clear that bar.
 *
 * Captures sweep 94's closure as a permanent gate.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

const SCAN_PREFIXES = [
  'apps/',
  'packages/',
  'contracts/',
  'scripts/',
  'docs/',
];

const ROOT_FILES = ['README.md', 'CLAUDE.md', 'HLD.md', 'PRD.md', 'CHANGELOG.md', 'UI_UX_GUIDE.md', 'COMPONENTS.md', 'BRAND.md', 'SECURITY.md'];

const RENDER_TARGET_DOCS = new Set([
  'README.md',
  'docs/PITCH.md',
  'docs/JUDGE_GUIDE.md',
  'docs/MAINNET_READINESS.md',
]);

const SKIP_PREFIXES = [
  'packages/opencode-',
  'contracts/lib/', // vendored OpenZeppelin + forge-std
  '_archive/',
  'docs/HALF_BAKED.md', // meta-table about drift; cites old numbers as data
  'docs/planning-001.md',
  'docs/planning-002.md',
  'docs/planning-003.md',
  'wanderingthoughts.md',
  'wanderingflow.md',
  'docs/PASS77_',
  'docs/PLAN_pass76.md',
  'docs/PLAN_pass77_cli.md',
  'docs/QA_TEST_PROGRESS.md',
  'SESSION_FINAL.md',
  'docs/build/BUILD_PROGRESS.md',
  'docs/build/ENGINEERING_DEBUG_LOG.md',
  'docs/build/TEST_REPORT.md',
  'docs/numbers.json', // the source itself
  // Sister regressions that legitimately reference snapshot values as data
  'scripts/qa/metamask-e2e/verify-no-bare-numbers-in-rendered-docs.ts',
  'scripts/qa/metamask-e2e/verify-no-stale-numeric-snapshots.ts',
  'scripts/diag/numbers-refresh.ts', // documents historical drift in JSDoc
  // Historical / meta-discussion docs — they cite OLD numbers as part of
  // describing past work or other-files' content. Sweep history matters.
  'CHANGELOG.md',
  'docs/USER_TODO.md', // sweep cleanup notes quote prior stale values as context
];

const VALID_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.md', '.sol', '.json']);

interface Hit {
  file: string;
  line: number;
  value: number;
  text: string;
}

const numbersJson = JSON.parse(readFileSync(resolve(REPO_ROOT, 'docs', 'numbers.json'), 'utf8')) as Record<string, unknown>;

function collectLeafIntegers(obj: unknown, out: Set<number>): void {
  if (typeof obj === 'number' && Number.isInteger(obj) && obj >= 100) {
    out.add(obj);
    return;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) collectLeafIntegers(v, out);
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) collectLeafIntegers(v, out);
  }
}

const liveValues = new Set<number>();
collectLeafIntegers(numbersJson, liveValues);

function listTrackedFiles(): string[] {
  const stdout = execFileSync('git', ['ls-files'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout.split(/\r?\n/).filter((s) => {
    if (s.length === 0) return false;
    if (SKIP_PREFIXES.some((p) => s.startsWith(p))) return false;
    if (RENDER_TARGET_DOCS.has(s)) return false;
    const inScope = SCAN_PREFIXES.some((p) => s.startsWith(p)) || ROOT_FILES.includes(s);
    if (!inScope) return false;
    const dot = s.lastIndexOf('.');
    if (dot < 0) return false;
    return VALID_EXT.has(s.slice(dot));
  });
}

const ALLOW_MARKER = /numbers-snapshot-allow:/;
const ARCHIVAL_HEADER = /\*\*ARCHIVAL/i;

// Strip fenced code blocks + inline code spans from a markdown/source
// string. Replace each char with a space EXCEPT newlines (so line
// numbers stay accurate). Same shape as scripts/wording-lint.ts.
function stripCodeSpans(content: string): string {
  const blank = (s: string): string => s.replace(/[^\r\n]/g, ' ');
  let stripped = content.replace(/```[\s\S]*?```/g, (m) => blank(m));
  stripped = stripped.replace(/`[^`\n]*`/g, (m) => blank(m));
  return stripped;
}

// Strip auto-render marker spans (the `<!-- numbers:auto:KEY -->VALUE
// <!-- /numbers:auto:KEY -->` shape). Anything between the markers is
// auto-derived; flagging it would be self-defeating.
function stripAutoMarkers(content: string): string {
  return content.replace(
    /<!--\s*numbers:auto:[^>]*-->[\s\S]*?<!--\s*\/numbers:auto:[^>]*-->/g,
    (m) => m.replace(/[^\r\n]/g, ' '),
  );
}

function isArchivalFile(content: string): boolean {
  // Check the first 30 lines for an ARCHIVAL header.
  const head = content.split('\n').slice(0, 30).join('\n');
  return ARCHIVAL_HEADER.test(head);
}

function scanFile(file: string): Hit[] {
  const path = resolve(REPO_ROOT, file);
  const raw = readFileSync(path, 'utf8');
  if (isArchivalFile(raw)) return [];

  // Strip code spans + auto markers before scanning.
  let content = stripAutoMarkers(raw);
  content = stripCodeSpans(content);

  const lines = content.split(/\r?\n/);
  const rawLines = raw.split(/\r?\n/);
  const hits: Hit[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    if (text.trim().length === 0) continue;
    if (ALLOW_MARKER.test(rawLines[i] ?? '')) continue;
    // Sweep 94 v2: tighten to require a UNIT WORD following the number.
    // Bare integers (test fixture IDs, EIP-150, percent-150, line numbers)
    // produce ~118 false positives across forge-std, OpenZeppelin tests,
    // CSS percentages, etc. Restricting to "<N> <unit>" patterns catches
    // the actual snapshot drift class — claims like "1,644 receipts" or
    // "167 tests" — without false-positiving on incidental integers.
    const UNIT_WORDS = '(receipts?|anchors?|tests?|packages?|gates?|skills?|vendored|catalog|deployed|contracts?|forge\\s+tests?|Foundry\\s+tests?)';
    // Capture group 2 is the optional `+` suffix. `150+ skills` reads as
    // "at least 150 skills" — open-ended, doesn't drift wrong as the
    // count grows. Only `150 skills` (no `+`) commits to an exact
    // snapshot. Skip the `+` form.
    const re = new RegExp(`\\b(\\d{1,3}(?:,\\d{3})+|\\d{3,})(\\+?)\\s+${UNIT_WORDS}\\b`, 'gi');
    for (const m of text.matchAll(re)) {
      const plus = m[2]!;
      if (plus === '+') continue; // open-ended claim, not a snapshot
      const numStr = m[1]!.replace(/,/g, '');
      const value = Number.parseInt(numStr, 10);
      if (!Number.isFinite(value)) continue;
      if (!liveValues.has(value)) continue;
      hits.push({ file, line: i + 1, value, text: (rawLines[i] ?? '').trim().slice(0, 160) });
    }
  }
  return hits;
}

console.log('Operational surfaces · no hardcoded numeric snapshots that match numbers.json\n');

const files = listTrackedFiles();
console.log(`  scanned ${files.length} tracked files · ${liveValues.size} numbers.json leaf values ≥ 100`);

const allHits: Hit[] = [];
for (const f of files) allHits.push(...scanFile(f));

if (allHits.length === 0) {
  console.log(`  PASS · zero stale numeric snapshots`);
  process.exit(0);
}

console.error(`  FAIL · ${allHits.length} hit(s) — value matches a numbers.json snapshot:\n`);
for (const h of allHits) {
  console.error(`    ${h.file}:${h.line}  [${h.value}]`);
  console.error(`      ${h.text}`);
}
console.error('\n  fix options:');
console.error('    (a) Wrap in numbers:auto markers (render-target docs only)');
console.error('    (b) Rewrite to evergreen prose (drop the count, keep the meaning)');
console.error('    (c) Add `numbers-snapshot-allow:<reason>` inline marker');
console.error('    (d) Add an `**ARCHIVAL**` header to the doc (frozen-snapshot pattern)');
process.exit(1);
