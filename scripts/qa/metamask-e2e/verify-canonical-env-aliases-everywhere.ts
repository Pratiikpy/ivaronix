/**
 * Regression: every file that mentions a legacy env-var alias also
 * mentions the canonical IVARONIX_* form on the same line OR within
 * 3 lines (so the alias chain is documented, not assumed).
 *
 * Why this gate exists (sweep 107 finding · companion to sweeps 80,
 * 105, 106):
 *   `verify-agents-md-canonical-aliases.ts` (sweep 44-45) covered
 *   AGENTS.md files specifically. Sweeps 80, 105, 106 closed
 *   canonical-leading drift in 15 OTHER surfaces:
 *     - 8 Foundry deploy scripts (sweep 80)
 *     - openclaw-skill metadata + chain-smoke.yml (sweep 105)
 *     - npx-cli README, MAINNET_READINESS, openclaw-skill body,
 *       private-doc-review, README, USER_TODO (sweep 106)
 *
 *   That's 15 manual fixes across 3 sweeps. The third-occurrence rule
 *   (and beyond) says ship the gate. This regression generalizes
 *   verify-agents-md-canonical-aliases beyond AGENTS.md to every
 *   tracked file that mentions a legacy alias.
 *
 *   The legacy/canonical pairs come from packages/runtime/src/env.ts:
 *     IVARONIX_SIGNER_KEY ← OG_PRIVATE_KEY, EVM_PRIVATE_KEY
 *     IVARONIX_RPC_URL ← OG_RPC_URL
 *     IVARONIX_NETWORK ← OG_NETWORK
 *     IVARONIX_CHAIN_ID ← OG_CHAIN_ID
 *     IVARONIX_WALLET_ADDRESS ← EVM_WALLET_ADDRESS
 *     IVARONIX_ROUTER_KEY ← ZG_API_SECRET
 *     IVARONIX_ROUTER_URL ← ZG_SERVICE_URL
 *     IVARONIX_ROUTER_PROVIDER ← OG_COMPUTE_PROVIDER
 *     IVARONIX_DEFAULT_MODEL ← OG_DEFAULT_MODEL
 *     IVARONIX_READ_PROXY_KEY ← READ_PROXY_PRIVATE_KEY
 *
 * What we check:
 *   For every tracked file (excluding the canonical alias chain itself
 *   in env.ts, and archival/planning docs that describe the legacy
 *   forms as data):
 *     - Find every occurrence of a legacy alias.
 *     - Require the canonical IVARONIX_* counterpart appears on the
 *       SAME line, or within 3 lines (before or after).
 *     - Otherwise: flag.
 *
 * Allow-list:
 *   - `canonical-alias-allow:<reason>` inline marker.
 *   - File-level skip: the alias chain definitions in env.ts and
 *     wording-amnesty.json are exempt.
 *
 * Captures sweep 107's closure. Testnet-only — the regression IS the
 * durable record.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

// (legacy → canonical) pairs derived from packages/runtime/src/env.ts.
// Adding a new legacy alias to that file should add a row here too.
const ALIAS_PAIRS: Array<{ legacy: string; canonical: string }> = [
  { legacy: 'OG_PRIVATE_KEY', canonical: 'IVARONIX_SIGNER_KEY' },
  { legacy: 'EVM_PRIVATE_KEY', canonical: 'IVARONIX_SIGNER_KEY' },
  { legacy: 'OG_RPC_URL', canonical: 'IVARONIX_RPC_URL' },
  { legacy: 'OG_NETWORK', canonical: 'IVARONIX_NETWORK' },
  { legacy: 'OG_CHAIN_ID', canonical: 'IVARONIX_CHAIN_ID' },
  { legacy: 'EVM_WALLET_ADDRESS', canonical: 'IVARONIX_WALLET_ADDRESS' },
  { legacy: 'ZG_API_SECRET', canonical: 'IVARONIX_ROUTER_KEY' },
  { legacy: 'ZG_SERVICE_URL', canonical: 'IVARONIX_ROUTER_URL' },
  { legacy: 'OG_COMPUTE_PROVIDER', canonical: 'IVARONIX_ROUTER_PROVIDER' },
  { legacy: 'OG_DEFAULT_MODEL', canonical: 'IVARONIX_DEFAULT_MODEL' },
  { legacy: 'READ_PROXY_PRIVATE_KEY', canonical: 'IVARONIX_READ_PROXY_KEY' },
];

// Files that legitimately mention legacy names without canonical adjacency:
// the alias-chain definition itself, the lint's own pair table, and
// archival/planning docs.
const SKIP_PATHS = new Set([
  'packages/runtime/src/env.ts', // the alias-chain definition
  'scripts/wording-amnesty.json',
  'scripts/qa/metamask-e2e/verify-agents-md-canonical-aliases.ts',
  'scripts/qa/metamask-e2e/verify-canonical-env-aliases-everywhere.ts',
  'scripts/qa/metamask-e2e/canonical-alias-amnesty.json', // this gate's own amnesty data
  'scripts/qa/metamask-e2e/verify-no-direct-legacy-env-reads.ts', // sister gate · docstring shows ❌ counter-examples
]);

const SKIP_PREFIXES = [
  '_archive/',
  'seed-skills/imports/', // 150+ upstream-imported skills · their env names follow upstream convention
  'docs/planning-001.md',
  'docs/planning-002.md',
  'docs/planning-003.md',
  'docs/PASS77_',
  'docs/PLAN_pass76.md',
  'docs/PLAN_pass77_cli.md',
  'docs/QA_TEST_PROGRESS.md',
  'SESSION_FINAL.md',
  'wanderingthoughts.md',
  'wanderingflow.md',
  // Vendored
  'packages/opencode-',
  'CLI Open Source Project/',
  'oglabs resources/',
  'og-projects-showcase/',
  'entries/',
  'new-entries/',
  // The alias chain test itself uses legacy names as test data.
  'packages/runtime/src/env.test.ts',
  'apps/cli/src/lib/env.ts',
];

const VALID_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.md', '.sol', '.yml', '.yaml', '.json']);

interface Hit {
  file: string;
  line: number;
  legacy: string;
  canonical: string;
  text: string;
}

// Allow either the new tag OR the existing AGENTS.md tag from sweep 44-45.
// Per .claude/rules/skills.md the agents-alias:allow form was the canonical
// allow marker before this regression existed; preserve compatibility.
const ALLOW_TAG = /(canonical-alias-allow:|agents-alias:allow:)/;

function listTrackedFiles(): string[] {
  const stdout = execFileSync('git', ['ls-files'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout.split(/\r?\n/).filter((s) => {
    if (s.length === 0) return false;
    if (SKIP_PATHS.has(s)) return false;
    if (SKIP_PREFIXES.some((p) => s.startsWith(p))) return false;
    const dot = s.lastIndexOf('.');
    if (dot < 0) return false;
    return VALID_EXT.has(s.slice(dot));
  });
}

function scanFile(path: string): Hit[] {
  const full = resolve(REPO_ROOT, path);
  const content = readFileSync(full, 'utf8');
  const lines = content.split(/\r?\n/);
  const hits: Hit[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    if (ALLOW_TAG.test(text)) continue;
    for (const { legacy, canonical } of ALIAS_PAIRS) {
      // Word boundary: the legacy name must be a standalone token, not
      // a substring (e.g. EVM_PRIVATE_KEY is OK but EVM_PRIVATE_KEY_OLD
      // would be a separate name).
      const re = new RegExp(`\\b${legacy}\\b`);
      if (!re.test(text)) continue;
      // Look for canonical on same line or within 3 lines either side.
      const window = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4)).join('\n');
      if (new RegExp(`\\b${canonical}\\b`).test(window)) continue;
      hits.push({ file: path, line: i + 1, legacy, canonical, text: text.trim().slice(0, 140) });
    }
  }
  return hits;
}

console.log('Repo · canonical IVARONIX_* env-var aliases adjacent to legacy names\n');

const files = listTrackedFiles();
console.log(`  scanned ${files.length} tracked files`);

const allHits: Hit[] = [];
for (const f of files) allHits.push(...scanFile(f));

// Amnesty pattern (same shape as wording-amnesty + brand-amnesty):
// scan-time finds 248 pre-existing hits across many files; rather than
// force a 248-line refactor in one sweep, capture the snapshot in
// `canonical-alias-amnesty.json` and gate against NEW drift only. Each
// hit keyed by `<file>:<line>:<legacy>`. `--update-amnesty` regenerates
// the snapshot (use after a bulk cleanup).
const AMNESTY_PATH = resolve(HERE, 'canonical-alias-amnesty.json');
let amnesty: Set<string>;
try {
  amnesty = new Set(JSON.parse(readFileSync(AMNESTY_PATH, 'utf8')) as string[]);
} catch {
  amnesty = new Set();
}

const updateAmnesty = process.argv.includes('--update-amnesty');
if (updateAmnesty) {
  const entries = allHits.map((h) => `${h.file}:${h.line}:${h.legacy}`);
  // Sort for stable ordering on disk.
  entries.sort();
  writeFileSync(AMNESTY_PATH, JSON.stringify(Array.from(new Set(entries)), null, 2) + '\n');
  console.log(`  refreshed canonical-alias-amnesty.json · ${entries.length} entries`);
  process.exit(0);
}

const newHits = allHits.filter((h) => !amnesty.has(`${h.file}:${h.line}:${h.legacy}`));

if (newHits.length === 0) {
  console.log(`  PASS · ${allHits.length} amnestied · 0 new`);
  process.exit(0);
}

console.error(`  FAIL · ${newHits.length} NEW naked-legacy-alias mention(s) beyond the amnesty:\n`);
for (const h of newHits) {
  console.error(`    ${h.file}:${h.line}  [${h.legacy} without ${h.canonical}]`);
  console.error(`      ${h.text}`);
}
console.error('\n  fix: add the canonical counterpart on the same line or within 3 lines.');
console.error('       e.g. `IVARONIX_SIGNER_KEY (legacy: OG_PRIVATE_KEY)` or wrap the legacy');
console.error('       form with a `# ... legacy: <name>` comment that mentions both.');
console.error('       Allow-marker: `canonical-alias-allow:<reason>` for genuine exceptions.');
console.error('       After a bulk cleanup: `pnpm exec tsx ' + relative(REPO_ROOT, fileURLToPath(import.meta.url)).replace(/\\/g, '/') + ' --update-amnesty`');
process.exit(1);
