// Regression: docs reference contracts/deployments/{testnet,mainnet}.json
// (not the legacy deployments/{testnet,mainnet}.json that lived at the
// repo root before the canonical-path move at fb3db59).
//
// Why this regression exists:
//   The path moved on 2026-05-10. ~22 doc references already pointed
//   at the new contracts/ subdir (because they were written aspirationally
//   before the move); 5 references still pointed at the legacy root path.
//   After the move, sweep 20 fixed the canonical refs but the bookkeeping
//   sweep that should have updated all docs (per CLAUDE.md §15) missed
//   6 references in operator-action runbooks. The next sweep caught
//   them; this regression prevents the next regression.
//
// Allow-list:
//   - "legacy" markers in narrative text that explicitly describe the
//     historical state (e.g. "the file used to live at deployments/...")
//   - inline allow marker: deployments-path:allow:<reason>
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
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

// Walk every .md and .ts file under repo (excluding node_modules,
// vendored dirs, the planning-historical narratives) for the legacy
// path pattern.
function listFiles(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  const skipDirs = new Set([
    'node_modules', '.next', '.turbo', 'dist', '.git',
    'opencode-bin', 'opencode-sdk', 'opencode-core', 'opencode-plugin',
    'new-entries', 'oglabs resources', 'og-projects-showcase',
    'CLI Open Source Project', 'entries', 'screenshots',
  ]);
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue;
    const path = resolve(dir, entry);
    let stat;
    try { stat = statSync(path); } catch { continue; }
    if (stat.isDirectory()) {
      out.push(...listFiles(path, extensions));
    } else if (extensions.some((e) => entry.endsWith(e))) {
      out.push(path);
    }
  }
  return out;
}

const files = listFiles(REPO_ROOT, ['.md', '.ts', '.tsx', '.sol']);
ok(`scanning ${files.length} doc + source files for legacy deployment path drift`);

// Allow these files to keep historical legacy-path mentions. They are
// frozen-in-time narratives describing what the code looked like at
// the planning sprint, NOT operator-actionable runbooks. The path drift
// in these doesn't break any reader who's trying to FOLLOW the path —
// they're describing history.
const HISTORICAL_FILES = new Set([
  'docs/planning-01.md',
  'docs/QA_LOOP_BRIEF.md',
]);

// The legacy pattern: `deployments/{testnet,mainnet}.json` (or backtick-
// wrapped variant) NOT preceded by `contracts/`. We check the 20 chars
// before each match to see if `contracts/` appears immediately prior.
// Match contexts: backtick-wrapped, plain text, code spans.
const LEGACY_RE = /deployments\/(testnet|mainnet)\.json/g;

interface Hit { file: string; line: number; text: string }
const hits: Hit[] = [];

for (const file of files) {
  const relPath = relative(REPO_ROOT, file).replace(/\\/g, '/');
  if (HISTORICAL_FILES.has(relPath)) continue;
  // Skip the canonical-path code itself — it has the canonical path
  // hard-coded which is correct.
  if (relPath === 'packages/og-chain/src/deployments.ts') continue;
  if (relPath === 'scripts/diag/numbers-refresh.ts') continue;
  // Skip this regression itself (we mention the legacy pattern in
  // comments here for documentation purposes).
  if (relPath === 'scripts/qa/metamask-e2e/verify-deployments-path-canonical.ts') continue;

  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.includes('deployments-path:allow:')) continue;
    LEGACY_RE.lastIndex = 0;
    for (const m of line.matchAll(LEGACY_RE)) {
      const start = Math.max(0, m.index! - 20);
      const lookbehind = line.slice(start, m.index!);
      // If `contracts/` appears immediately before, this IS the canonical
      // path — skip.
      if (/contracts\/$/.test(lookbehind)) continue;
      // If the line is talking about the move ("legacy", "moved from"),
      // skip — narrative text is OK.
      if (/legacy|moved from|previously at|used to live/i.test(line)) continue;
      hits.push({
        file: relPath,
        line: i + 1,
        text: line.trim().slice(0, 140),
      });
    }
  }
}

if (hits.length > 0) {
  console.error(`\nFAIL: ${hits.length} legacy deployments path reference(s) (expected: contracts/deployments/...):`);
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}`);
    console.error(`    ${h.text}`);
  }
  console.error('');
  console.error('Fix: prefix with `contracts/` so the path matches');
  console.error('     the canonical location. The deployments file moved');
  console.error('     to contracts/deployments/ in fb3db59.');
  console.error('');
  console.error('     OR add `deployments-path:allow:<reason>` on the line');
  console.error('     OR add the file to HISTORICAL_FILES if it is a');
  console.error('     frozen-in-time planning narrative.');
  process.exit(1);
}

ok('no stale deployments/ root-path references in operator docs or source');
console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
