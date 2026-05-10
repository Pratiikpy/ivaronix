// CLAUDE.md section 9 enforcement: banned words + phrases in shipped writing.
//
// Why this exists:
//   PRD.md lists "wording-lint" as a CI matrix gate item (twice), and
//   package.json wires "pnpm wording-lint" → this script. Both promised
//   the lint. The script never shipped. Running "pnpm wording-lint"
//   today would fail with file-not-found.
//
//   Cron-sweep finding 2026-05-10: half-baked feature surfaced. Build
//   the lint AND the amnesty for existing hits, so the gate ships
//   today and existing drift queues for cleanup.
//
// Scope:
//   .md files at repo root and under docs/ (writing that "ships" per
//   CLAUDE.md section 9). Excludes vendored dirs, archives, and the
//   competitor-entry directories. Note: README.md is the single most
//   judge-facing surface; it carries the most leverage.
//
// Banned tokens (case-insensitive, word-boundary):
//   delve, unlock, unleash, robust, leverage, empower, seamless,
//   harness, streamline, cutting-edge, state-of-the-art, revolutionize
//
// Banned phrases:
//   "in today's fast-paced world" / "in the realm of" / "in the world of"
//
// Excluded contexts:
//   - Inside fenced code blocks (between ```...``` markers)
//   - Inside inline code spans (between single backticks)
//   - Lines containing "wording-lint:allow:<reason>" inline
//   - Lines that are link refs (e.g. [text](url))? Too fragile — keep
//     hits visible; reviewer marks intentional ones with allow markers.
//
// Amnesty file:
//   scripts/wording-amnesty.json captures existing hits at first-ship.
//   Future runs fail only on NEW hits outside the amnesty. Same shape
//   as scripts/qa/metamask-e2e/brand-amnesty.json (sweep 31).
//
// Modes:
//   pnpm wording-lint                 normal · fail on new drift
//   pnpm wording-lint -- --update     regenerate the amnesty snapshot
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

const BANNED_TOKENS: ReadonlyArray<string> = [
  'delve',
  'unlock',
  'unleash',
  'robust',
  'leverage',
  'empower',
  'seamless',
  'harness',
  'streamline',
  'cutting-edge',
  'state-of-the-art',
  'revolutionize',
];

const BANNED_PHRASES: ReadonlyArray<string> = [
  "in today's fast-paced world",
  'in the realm of',
  'in the world of',
];

// Build a single regex that matches any banned token at word boundaries.
// Multi-word tokens (cutting-edge, state-of-the-art) are kept as literals.
function buildTokenRegex(): RegExp {
  const parts = BANNED_TOKENS.map((t) =>
    t.replace(/-/g, '\\-').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  // \b doesn't work cleanly with hyphens; use lookarounds.
  return new RegExp(`(?<![A-Za-z0-9])(${parts.join('|')})(?![A-Za-z0-9])`, 'gi');
}
const TOKEN_RE = buildTokenRegex();

function buildPhraseRegex(): RegExp {
  const parts = BANNED_PHRASES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${parts.join('|')})`, 'gi');
}
const PHRASE_RE = buildPhraseRegex();

// Walk .md files under repo root and docs/, excluding vendored dirs.
function listMarkdownFiles(): string[] {
  const out: string[] = [];
  const skipDirs = new Set([
    'node_modules', '.next', '.turbo', 'dist', '.git',
    'opencode-bin', 'opencode-sdk', 'opencode-core', 'opencode-plugin',
    'new-entries', 'oglabs resources', 'og-projects-showcase',
    'CLI Open Source Project', 'entries', '_archive',
    'screenshots', 'contracts/lib', 'lib',
  ]);
  function walk(dir: string): void {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      if (skipDirs.has(entry)) continue;
      const path = resolve(dir, entry);
      let stat;
      try { stat = statSync(path); } catch { continue; }
      if (stat.isDirectory()) {
        walk(path);
      } else if (entry.endsWith('.md')) {
        out.push(path);
      }
    }
  }
  // Root-level .md files only at depth 1; then everything under docs/.
  for (const entry of readdirSync(REPO_ROOT)) {
    const path = resolve(REPO_ROOT, entry);
    let stat;
    try { stat = statSync(path); } catch { continue; }
    if (stat.isFile() && entry.endsWith('.md')) out.push(path);
  }
  walk(resolve(REPO_ROOT, 'docs'));
  return out;
}

// Strip fenced code blocks + inline code spans from a markdown string.
// We replace them with whitespace of equal length so line numbers and
// column offsets stay aligned for accurate violation reports.
//
// Critical: PRESERVE NEWLINES inside fenced blocks. A naive
// ' '.repeat(m.length) collapses multi-line code blocks into a single
// space-line, which shifts every subsequent line number by N. The
// reported line numbers in the failure messages then point at lines
// that don't even contain the banned word — hours of debugging-the-
// regression for any contributor who hits a real wording-lint hit.
// Caught in cron-sweep 46 against docs/USER_TODO.md (reported line
// 371 contained no banned word; the actual hit was at line 434).
function stripCode(content: string): string {
  // Helper: replace each char with a space EXCEPT '\n' / '\r' which
  // we preserve so line offsets stay accurate.
  const blank = (s: string): string =>
    s.replace(/[^\r\n]/g, ' ');
  // Fenced blocks (``` ... ```), with optional language tag.
  let stripped = content.replace(/```[\s\S]*?```/g, (m) => blank(m));
  // Inline code spans (single backticks · same line by construction).
  stripped = stripped.replace(/`[^`\n]*`/g, (m) => blank(m));
  return stripped;
}

interface Hit { file: string; line: number; col: number; token: string; context: string }

// Sweep 68: context-aware allow for `harness` when used as a technical-
// jargon noun ("test harness", "cross-impl harness", etc.). The CLAUDE.md
// §9 ban targets the marketing-verb form ("harness the power of X"); the
// technical-noun form is a legitimate engineering term. A leading
// adjective/noun-modifier from this allow-list disambiguates the form
// before the ban fires.
const HARNESS_NOUN_MODIFIERS = new Set([
  'test',
  'tests',
  'cross-impl',
  'crossimpl',
  'smoke',
  'regression',
  'regressions',
  'playwright',
  'e2e',
  'mock',
  'live-smoke',
  'integration',
  'live',
  'unit',
  'backend',
  'frontend',
  'browser',
  'qa',
  'metamask',
  'mm',
]);

/** True iff a `harness` match at [matchIdx] is preceded by a recognized
 *  technical-noun modifier ("test harness", "regression harness", etc.).
 *  Looks back up to 30 chars on the same line. */
function isTechnicalHarness(line: string, matchIdx: number): boolean {
  const before = line.slice(Math.max(0, matchIdx - 30), matchIdx);
  // Last whitespace-separated word before the match.
  const m = before.match(/([A-Za-z][A-Za-z0-9-]*)\s+$/);
  if (!m) return false;
  return HARNESS_NOUN_MODIFIERS.has(m[1]!.toLowerCase());
}

function findHits(file: string, content: string): Hit[] {
  const stripped = stripCode(content);
  const hits: Hit[] = [];
  const lines = stripped.split(/\r?\n/);
  const rawLines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const rawLine = rawLines[i]!;
    if (rawLine.includes('wording-lint:allow:')) continue;

    TOKEN_RE.lastIndex = 0;
    for (const m of line.matchAll(TOKEN_RE)) {
      const token = m[1]!.toLowerCase();
      const matchIdx = m.index ?? 0;
      // Context-aware: 'harness' preceded by a technical-noun modifier
      // is allowed (engineering jargon, not marketing verb).
      if (token === 'harness' && isTechnicalHarness(line, matchIdx)) {
        continue;
      }
      hits.push({
        file: relative(REPO_ROOT, file).replace(/\\/g, '/'),
        line: i + 1,
        col: matchIdx + 1,
        token,
        context: rawLine.trim().slice(0, 140),
      });
    }
    PHRASE_RE.lastIndex = 0;
    for (const m of line.matchAll(PHRASE_RE)) {
      hits.push({
        file: relative(REPO_ROOT, file).replace(/\\/g, '/'),
        line: i + 1,
        col: (m.index ?? 0) + 1,
        token: m[1]!.toLowerCase(),
        context: rawLine.trim().slice(0, 140),
      });
    }
  }
  return hits;
}

const files = listMarkdownFiles();
ok(`scanning ${files.length} markdown files`);

const allHits: Hit[] = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  allHits.push(...findHits(file, content));
}

// Amnesty: file:line:token tuples that existed at first-ship.
const AMNESTY_PATH = resolve(HERE, 'wording-amnesty.json');
let amnesty: Set<string>;
try {
  amnesty = new Set(JSON.parse(readFileSync(AMNESTY_PATH, 'utf8')) as string[]);
  ok(`loaded ${amnesty.size} amnesty entries from wording-amnesty.json`);
} catch {
  amnesty = new Set();
  ok('no wording-amnesty.json found · running with empty amnesty');
}

const updateMode = process.argv.includes('--update');

if (updateMode) {
  const tuples = allHits.map((h) => `${h.file}:${h.line}:${h.token}`).sort();
  // Dedupe (same line + same token may appear twice if the line has it twice).
  const unique = Array.from(new Set(tuples));
  writeFileSync(AMNESTY_PATH, JSON.stringify(unique, null, 2) + '\n');
  console.log(`updated wording-amnesty.json with ${unique.length} entries`);
  process.exit(0);
}

const newHits = allHits.filter((h) => !amnesty.has(`${h.file}:${h.line}:${h.token}`));

if (newHits.length > 0) {
  console.error(`\nFAIL: ${newHits.length} new banned-word/phrase hit(s):`);
  for (const h of newHits) {
    console.error(`  ${h.file}:${h.line}:${h.col} · "${h.token}"`);
    console.error(`    ${h.context}`);
  }
  console.error('');
  console.error('Why this fails (CLAUDE.md section 9):');
  console.error('  These tokens mark a paragraph as machine-written or marketing-soft');
  console.error('  on sight. Replace with a concrete claim or a number, or rewrite');
  console.error('  the sentence so the meaning survives without the token.');
  console.error('');
  console.error('Resolution:');
  console.error('  1. Rewrite the sentence (preferred — most produce stronger prose)');
  console.error('  2. Add `wording-lint:allow:<reason>` on the line for an');
  console.error('     intentional, documented exception');
  console.error('  3. After a bulk cleanup that legitimately changed which hits');
  console.error('     remain, run `pnpm wording-lint -- --update` to regenerate');
  console.error('     scripts/wording-amnesty.json');
  process.exit(1);
}

ok(`no new banned-word/phrase hits beyond the amnesty (${allHits.length} total · ${amnesty.size} amnestied)`);
console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
