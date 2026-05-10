// Regression: every IVARONIX_* env var read by code must appear in at
// least one of the two operator-facing env templates (.env.example +
// apps/studio/.env.production.template), per CLAUDE.md §15 lookup
// table row "A new env var".
//
// Why this exists:
//   The templates get copy-pasted verbatim by operators on first-time
//   setup. A canonical IVARONIX_* var that only lives in code is
//   invisible to a fresh clone — operators don't know to set it.
//   Caught in cron-sweep 37: IVARONIX_KV_PORT, IVARONIX_SESSION_SECRET,
//   IVARONIX_STORAGE_INDEXER, IVARONIX_CHAIN_ID had partial template
//   coverage; one or both templates were missing them.
//
// Scope:
//   Code reads: grep packages/**, apps/**/*.ts for the literal
//   `IVARONIX_<UPPER_NAME>` token via:
//     - process.env.IVARONIX_X
//     - env.IVARONIX_X (when env is process.env or destructured)
//     - 'IVARONIX_X' string literal in alias arrays (env.ts shape)
//
//   Templates: read both env files, parse lines that start with
//   IVARONIX_X= or # IVARONIX_X= (commented), collect names.
//
// Allow-list:
//   IVARONIX_TG_TEST is a CI-only smoke flag (apps/telegram-bot/src/
//   smoke.ts sets it programmatically before invoking the bot). Not
//   meant for operator-set config. Excluded.
//
// Run: pnpm tsx scripts/qa/metamask-e2e/verify-env-template-completeness.ts
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

const ROOT_TEMPLATE = resolve(REPO_ROOT, '.env.example');
const STUDIO_TEMPLATE = resolve(REPO_ROOT, 'apps', 'studio', '.env.production.template');

// Allow-list of code-only IVARONIX_* vars (programmatic flags, not
// operator-set config).
const ALLOW_CODE_ONLY = new Set<string>([
  'IVARONIX_TG_TEST', // smoke-test internal flag
]);

// ─── Step 1: collect every IVARONIX_* token referenced in code ─────────
function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  const skipDirs = new Set([
    'node_modules', '.next', '.turbo', 'dist',
    'opencode-bin', 'opencode-sdk', 'opencode-core', 'opencode-plugin',
  ]);
  let entries;
  try { entries = readdirSync(dir); } catch { return []; }
  for (const entry of entries) {
    if (skipDirs.has(entry)) continue;
    const path = resolve(dir, entry);
    let stat;
    try { stat = statSync(path); } catch { continue; }
    if (stat.isDirectory()) {
      out.push(...listTsFiles(path));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(path);
    }
  }
  return out;
}

const codeFiles = [
  ...listTsFiles(resolve(REPO_ROOT, 'packages')),
  ...listTsFiles(resolve(REPO_ROOT, 'apps')),
];

// IVARONIX_<UPPER_LETTERS_AND_UNDERSCORES> — at least one extra char
// after the prefix to skip the bare prefix.
const TOKEN_RE = /\bIVARONIX_[A-Z][A-Z0-9_]*/g;
const codeTokens = new Set<string>();
for (const file of codeFiles) {
  const content = readFileSync(file, 'utf8');
  for (const m of content.matchAll(TOKEN_RE)) codeTokens.add(m[0]);
}
ok(`extracted ${codeTokens.size} IVARONIX_* tokens from ${codeFiles.length} TS/TSX files`);

// ─── Step 2: collect tokens defined in each template ──────────────────
function tokensInTemplate(path: string): Set<string> {
  const out = new Set<string>();
  let content;
  try { content = readFileSync(path, 'utf8'); } catch { return out; }
  for (const line of content.split(/\r?\n/)) {
    // Match either active (IVARONIX_X=) or commented (# IVARONIX_X=) lines.
    const m = line.match(/^\s*#?\s*(IVARONIX_[A-Z][A-Z0-9_]*)\s*=/);
    if (m) out.add(m[1]!);
  }
  return out;
}

const rootTokens = tokensInTemplate(ROOT_TEMPLATE);
const studioTokens = tokensInTemplate(STUDIO_TEMPLATE);
ok(`.env.example has ${rootTokens.size} IVARONIX_* entries`);
ok(`apps/studio/.env.production.template has ${studioTokens.size} IVARONIX_* entries`);

const inAtLeastOne = new Set<string>([...rootTokens, ...studioTokens]);

// ─── Step 3: find code tokens missing from BOTH templates ─────────────
const missing = [...codeTokens]
  .filter((t) => !ALLOW_CODE_ONLY.has(t))
  .filter((t) => !inAtLeastOne.has(t))
  .sort();

if (missing.length > 0) {
  console.error(`\nFAIL: ${missing.length} IVARONIX_* var(s) read by code but missing from BOTH env templates:`);
  for (const tok of missing) {
    // Find an example file where it's referenced.
    let example: string | null = null;
    for (const file of codeFiles) {
      const c = readFileSync(file, 'utf8');
      if (c.includes(tok)) {
        example = relative(REPO_ROOT, file).replace(/\\/g, '/');
        break;
      }
    }
    console.error(`  ${tok}${example ? `   (e.g. ${example})` : ''}`);
  }
  console.error('');
  console.error('Per CLAUDE.md §15 lookup table:');
  console.error('  "A new env var → both env templates (.env.example at repo root +');
  console.error('   apps/studio/.env.production.template), packages/runtime/src/env.ts');
  console.error('   alias chain..."');
  console.error('');
  console.error('Resolution:');
  console.error('  1. Add the var to .env.example with a comment explaining when needed');
  console.error('  2. Also add to apps/studio/.env.production.template if Studio reads it');
  console.error('  3. If genuinely code-only (CI flag, internal smoke), add to');
  console.error('     ALLOW_CODE_ONLY in this regression with a comment why');
  process.exit(1);
}
ok(`every IVARONIX_* var read by code appears in at least one env template`);

// ─── Step 4: warn on tokens defined ONLY in studio template that are also code-read ─
// (informational — both templates SHOULD cover the same canonical vars
// per CLAUDE.md §15.)
const studioOnlyButCodeRead = [...codeTokens].filter(
  (t) => !ALLOW_CODE_ONLY.has(t) && studioTokens.has(t) && !rootTokens.has(t),
);
const rootOnlyButCodeRead = [...codeTokens].filter(
  (t) => !ALLOW_CODE_ONLY.has(t) && rootTokens.has(t) && !studioTokens.has(t),
);
if (studioOnlyButCodeRead.length > 0) {
  console.log(`\nINFO: ${studioOnlyButCodeRead.length} var(s) in studio template only (consider adding to .env.example):`);
  for (const t of studioOnlyButCodeRead) console.log(`  ${t}`);
}
if (rootOnlyButCodeRead.length > 0) {
  console.log(`\nINFO: ${rootOnlyButCodeRead.length} var(s) in .env.example only (consider adding to studio template):`);
  for (const t of rootOnlyButCodeRead) console.log(`  ${t}`);
}

console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
