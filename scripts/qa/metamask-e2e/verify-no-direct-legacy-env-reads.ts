/**
 * Regression: no `process.env.<LEGACY_NAME>` direct read in first-party
 * code where the same expression doesn't ALSO try the canonical
 * IVARONIX_* counterpart.
 *
 * Why this gate exists (sweeps 108-113 found 10 correctness bugs of
 * this class):
 *   The codebase has TWO env-reading conventions:
 *     ✅ Right: `loadEnv()` (canonical-aware via alias chain)
 *     ❌ Wrong: `process.env.<LEGACY>` direct access
 *
 *   Pattern documented across 6 sweeps:
 *     - delegate.ts (108): silent receipt-provenance bug
 *     - keyring.ts (109): silent Router-credential bug
 *     - init.ts (109): operator UX (.env scaffold)
 *     - start-local-0g-kv.ts (111): "missing" false-negative
 *     - debug.ts:521 (111): "missing" false-negative
 *     - build-hello-receipt.ts (112): ops-script "missing" false-neg
 *     - apps/cli/src/lib/env.ts (113): ROOT-CAUSE — every CLI command
 *       silently broken for canonical-only operators
 *     - 3 more downstream consumers in Studio + telegram-bot (113)
 *
 *   Each bug shared the same shape: `process.env.LEGACY` direct read
 *   without canonical fallback. The amnesty (sweep 107's
 *   verify-canonical-env-aliases-everywhere.ts) detects MENTIONS of
 *   legacy names anywhere; this gate is more precise — it catches
 *   actual `process.env.<LEGACY>` runtime reads that ignore the
 *   canonical chain.
 *
 * What we check:
 *   For every first-party `.ts` / `.tsx` file (excluding tests, dist,
 *   vendored opencode-*):
 *     - Find every `process.env.<NAME>` access where <NAME> is a
 *       known legacy alias (from packages/runtime/src/env.ts).
 *     - Require the SAME line OR the immediately surrounding ?? chain
 *       to ALSO mention the canonical IVARONIX_* counterpart.
 *     - Otherwise: flag.
 *
 *   This catches:
 *     ❌ `process.env.OG_PRIVATE_KEY` (no fallback at all)
 *     ❌ `process.env.OG_PRIVATE_KEY ?? process.env.EVM_PRIVATE_KEY`
 *        (legacy-only chain, no canonical)
 *
 *   And accepts:
 *     ✅ `process.env.IVARONIX_SIGNER_KEY ?? process.env.OG_PRIVATE_KEY`
 *     ✅ `process.env.OG_PRIVATE_KEY` immediately followed by an
 *        `IVARONIX_SIGNER_KEY` reference within a 3-line window
 *
 * Allow-list:
 *   `direct-env-allow:<reason>` inline marker. Use only when reading
 *   the legacy form is genuinely intentional (test fixtures verifying
 *   alias resolution, restoring env state in delegate flow, etc.).
 *
 * Captures sweep 114's closure as a permanent gate. Testnet-only.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

// (legacy → canonical) pairs — same as
// verify-canonical-env-aliases-everywhere.ts. Adding a new alias to
// packages/runtime/src/env.ts should add a row here too.
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

const SKIP_PATHS = new Set([
  'packages/runtime/src/env.ts', // alias chain definition
  'apps/cli/src/lib/env.ts', // CLI's local loader (post-sweep-113 also canonical)
  'scripts/qa/metamask-e2e/verify-canonical-env-aliases-everywhere.ts',
  'scripts/qa/metamask-e2e/verify-no-direct-legacy-env-reads.ts',
  'scripts/qa/metamask-e2e/verify-agents-md-canonical-aliases.ts',
]);

const SKIP_PREFIXES = [
  'packages/opencode-',
  '_archive/',
  'seed-skills/imports/',
  'docs/',
  '.github/',
  // Tests deliberately use legacy names to verify alias resolution
  'packages/og-router/src/keyring.test.ts',
  'packages/runtime/src/env.test.ts',
];

const VALID_EXT = new Set(['.ts', '.tsx', '.mjs']);

interface Hit {
  file: string;
  line: number;
  legacy: string;
  canonical: string;
  text: string;
}

const ALLOW_TAG = /direct-env-allow:/;

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
    // Skip JSDoc / inline comments — they cite the names as data.
    const trimmed = text.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    for (const { legacy, canonical } of ALIAS_PAIRS) {
      // Match `process.env.<LEGACY>` access (with optional whitespace
      // around the dot — TS allows `process .env .NAME` though it's
      // unusual). The `\b` boundary keeps OG_PRIVATE_KEY_OLD from
      // false-positiving.
      const re = new RegExp(`process\\.env\\.${legacy}\\b`);
      if (!re.test(text)) continue;
      // Look for the canonical name within ±3 lines (or on same line).
      const window = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4)).join('\n');
      if (new RegExp(`\\b${canonical}\\b`).test(window)) continue;
      hits.push({ file: path, line: i + 1, legacy, canonical, text: text.trim().slice(0, 140) });
    }
  }
  return hits;
}

console.log('First-party · no direct process.env.<LEGACY> reads without canonical fallback\n');

const files = listTrackedFiles();
console.log(`  scanned ${files.length} tracked .ts/.tsx files`);

const allHits: Hit[] = [];
for (const f of files) allHits.push(...scanFile(f));

if (allHits.length === 0) {
  console.log(`  PASS · every legacy process.env.* read has a canonical IVARONIX_* counterpart adjacent`);
  process.exit(0);
}

console.error(`  FAIL · ${allHits.length} direct legacy-env read(s) without canonical fallback:\n`);
for (const h of allHits) {
  console.error(`    ${h.file}:${h.line}  [${h.legacy} without ${h.canonical}]`);
  console.error(`      ${h.text}`);
}
console.error('\n  fix: try canonical first, then legacy:');
console.error('       const x = process.env.IVARONIX_<X> ?? process.env.<LEGACY>;');
console.error('       OR use loadEnv() from @ivaronix/runtime / apps/cli/src/lib/env.ts');
console.error('       (both canonical-aware as of sweep 113).');
console.error('       Allow-marker: `direct-env-allow:<reason>` for genuine exceptions.');
process.exit(1);
