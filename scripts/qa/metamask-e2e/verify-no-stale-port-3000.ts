/**
 * Regression: no `localhost:3000` references in first-party code or
 * docs.
 *
 * Why this gate exists (sweep 92 finding):
 *   Studio runs on port 3300 per `apps/studio/package.json` (`next dev
 *   --port 3300`). The :3000 default is the Next.js out-of-the-box
 *   port, not ours. Pre-sweep-92, `UI_UX_GUIDE.md:439` said "Run
 *   Playwright again on the real Studio at `localhost:3000`" — a
 *   contributor following the docs literally would hit a 404
 *   (nothing listening on :3000) and waste time figuring out the
 *   port mismatch.
 *
 *   The drift originated when Studio's port was changed early in
 *   development (3000 → 3300, sweep history pre-cron) but the docs
 *   weren't synced. UI_UX_GUIDE was the only surviving instance.
 *   Sweep 92 fixed the doc and ships this gate to prevent
 *   recurrence.
 *
 * Scope:
 *   First-party code + docs:
 *     apps/{cli,studio,mcp-server,telegram-bot,npx-cli,api,openclaw-skill}
 *     packages/* (excluding vendored opencode-*)
 *     scripts/
 *     docs/, README.md, CLAUDE.md, HLD.md, etc. (root markdown)
 *
 *   Pattern matched: `localhost:3000\b` (word boundary to avoid
 *   false-positives on port suffixes like 30001).
 *
 * Allow-list:
 *   `// stale-port-3000-allow:<reason>` inline marker. Use only when
 *   genuinely correct (e.g. documenting the Next.js DEFAULT port that
 *   we deliberately moved away from). None today.
 *
 * Captures sweep 92's closure as a permanent gate.
 */
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

const SKIP_PREFIXES = [
  // Vendored
  'packages/opencode-',
  // Reference material gitignored at repo root anyway, but defense-in-depth
  'CLI Open Source Project/', 'oglabs resources/', 'og-projects-showcase/',
  'entries/', 'new-entries/', '_archive/',
];

const VALID_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.md', '.yml', '.yaml', '.sh', '.json']);

interface Hit {
  file: string;
  line: number;
  text: string;
}

function listGitTrackedFiles(): string[] {
  const stdout = execFileSync('git', ['ls-files'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout.split(/\r?\n/).filter((s) => {
    if (s.length === 0) return false;
    if (SKIP_PREFIXES.some((p) => s.startsWith(p))) return false;
    const dot = s.lastIndexOf('.');
    if (dot < 0) return false;
    return VALID_EXT.has(s.slice(dot));
  }).map((s) => resolve(REPO_ROOT, s));
}

const ALLOW_TAG = /stale-port-3000-allow:/;
// Word-boundary on the digit side: 3000 must NOT be followed by another digit
// (so localhost:30001 doesn't false-positive).
const PORT_3000_RE = /localhost:3000(?!\d)/;

function scanFile(file: string): Hit[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const hits: Hit[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    if (ALLOW_TAG.test(text)) continue;
    if (PORT_3000_RE.test(text)) {
      hits.push({ file, line: i + 1, text: text.trim() });
    }
  }
  return hits;
}

console.log('Repo · no `localhost:3000` references (Studio runs on :3300)\n');

const allFiles = listGitTrackedFiles();

// Exempt this file itself — its docstring + regex literal + error message
// all reference `localhost:3000` to describe what's banned. A meta-rule
// can't fire on its own description without an infinite-allow-marker
// proliferation. Same shape used by wording-lint for its own banned-token
// list (cron-sweep 31 noted the meta-allow pattern).
const SELF_PATH = fileURLToPath(import.meta.url);
const filtered = allFiles.filter((f) => f !== SELF_PATH);

const allHits: Hit[] = [];
for (const f of filtered) allHits.push(...scanFile(f));

console.log(`  scanned ${filtered.length} files (excluding self)`);

if (allHits.length === 0) {
  console.log(`  PASS · zero stale localhost:3000 references`);
  process.exit(0);
}

console.error(`  FAIL · ${allHits.length} stale port reference(s):\n`);
for (const h of allHits) {
  const rel = relative(REPO_ROOT, h.file).replace(/\\/g, '/');
  console.error(`    ${rel}:${h.line}  ${h.text}`);
}
console.error('\n  fix: change to `localhost:3300` (Studio dev port). If genuinely needed,');
console.error('       add a `stale-port-3000-allow:<reason>` inline marker.');
process.exit(1);
