// Regression: AGENTS.md files must lead with the canonical IVARONIX_*
// env-var form on any line that mentions a legacy alias documented in
// packages/runtime/src/env.ts. Per CLAUDE.md section 15:
//
//   "Lead with the canonical IVARONIX_* form in the templates;
//    document the legacy alias as a deprecated fallback in a comment."
//
// Why this exists:
//   Sweep 44 caught apps/cli/AGENTS.md and apps/studio/AGENTS.md leading
//   with ZG_API_SECRET / ZG_SERVICE_URL / OG_COMPUTE_PROVIDER /
//   EVM_WALLET_ADDRESS for Router credentials — the legacy aliases.
//   Both files were written before sweep 18 added the canonical
//   IVARONIX_* alias chain in env.ts. The §15 bookkeeping rule should
//   have updated the AGENTS.md files at the same time but missed them.
//
//   This regression closes the drift class: a line in any AGENTS.md
//   that mentions a legacy alias must ALSO mention the canonical form,
//   AND the canonical form must appear first.
//
// Scope:
//   {apps,packages}/**\/AGENTS.md + contracts/AGENTS.md + seed-skills/
//   AGENTS.md
//
// Rules:
//   For each legacy alias listed in env.ts (e.g. ZG_API_SECRET):
//     - If a line in any AGENTS.md mentions the legacy token but does
//       NOT also mention its canonical IVARONIX_* counterpart on the
//       same line, fail.
//     - If both appear but the legacy precedes the canonical, fail.
//
// Allow-list:
//   Inline marker `agents-alias:allow:<reason>` skips the line.
import { readdirSync, readFileSync, statSync } from 'node:fs';
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

// Canonical IVARONIX_* -> legacy aliases mapping. Extracted from
// packages/runtime/src/env.ts SIGNER_KEY_ALIASES, ROUTER_KEY_ALIASES,
// etc. The first entry in each array IS the canonical; the rest are
// legacy.
//
// Source: packages/runtime/src/env.ts lines 41-50 (sweep 18). When
// new aliases are added to env.ts, also add them here.
const ALIAS_PAIRS: ReadonlyArray<{ canonical: string; legacy: ReadonlyArray<string> }> = [
  { canonical: 'IVARONIX_SIGNER_KEY', legacy: ['OG_PRIVATE_KEY', 'EVM_PRIVATE_KEY'] },
  { canonical: 'IVARONIX_READ_PROXY_KEY', legacy: ['READ_PROXY_PRIVATE_KEY'] },
  { canonical: 'IVARONIX_RPC_URL', legacy: ['OG_RPC_URL'] },
  { canonical: 'IVARONIX_NETWORK', legacy: ['OG_NETWORK'] },
  { canonical: 'IVARONIX_CHAIN_ID', legacy: ['OG_CHAIN_ID'] },
  { canonical: 'IVARONIX_WALLET_ADDRESS', legacy: ['EVM_WALLET_ADDRESS'] },
  { canonical: 'IVARONIX_ROUTER_KEY', legacy: ['ZG_API_SECRET'] },
  { canonical: 'IVARONIX_ROUTER_URL', legacy: ['ZG_SERVICE_URL'] },
  { canonical: 'IVARONIX_ROUTER_PROVIDER', legacy: ['OG_COMPUTE_PROVIDER'] },
  { canonical: 'IVARONIX_DEFAULT_MODEL', legacy: ['OG_DEFAULT_MODEL'] },
];

// Find all AGENTS.md files in scope.
function listAgentsMd(dir: string, depth = 0): string[] {
  const out: string[] = [];
  const skipDirs = new Set([
    'node_modules', '.next', '.turbo', 'dist', '.git',
    'opencode-bin', 'opencode-sdk', 'opencode-core', 'opencode-plugin',
    'new-entries', 'oglabs resources', 'og-projects-showcase',
    'CLI Open Source Project', 'entries', '_archive',
  ]);
  if (depth > 4) return out;
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    if (skipDirs.has(entry)) continue;
    const path = resolve(dir, entry);
    let stat;
    try { stat = statSync(path); } catch { continue; }
    if (stat.isDirectory()) {
      out.push(...listAgentsMd(path, depth + 1));
    } else if (entry === 'AGENTS.md') {
      out.push(path);
    }
  }
  return out;
}

const agentsFiles = listAgentsMd(REPO_ROOT);
ok(`found ${agentsFiles.length} AGENTS.md files in scope`);

interface Hit { file: string; line: number; reason: string; context: string }
const hits: Hit[] = [];

for (const file of agentsFiles) {
  const relPath = file.slice(REPO_ROOT.length + 1).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.includes('agents-alias:allow:')) continue;

    for (const { canonical, legacy } of ALIAS_PAIRS) {
      for (const legacyToken of legacy) {
        // Match the legacy token at a word boundary. Simple regex —
        // legacy tokens are uppercase + underscores, no overlap with
        // canonical IVARONIX_* form.
        const legacyRe = new RegExp(`\\b${legacyToken}\\b`);
        const legacyMatch = line.match(legacyRe);
        if (!legacyMatch) continue;
        const canonicalMatch = line.indexOf(canonical);
        const legacyPos = legacyMatch.index ?? 0;
        if (canonicalMatch < 0) {
          hits.push({
            file: relPath,
            line: i + 1,
            reason: `legacy '${legacyToken}' mentioned without canonical '${canonical}' on the same line`,
            context: line.trim().slice(0, 140),
          });
        } else if (canonicalMatch > legacyPos) {
          hits.push({
            file: relPath,
            line: i + 1,
            reason: `legacy '${legacyToken}' precedes canonical '${canonical}' on the same line`,
            context: line.trim().slice(0, 140),
          });
        }
      }
    }
  }
}

if (hits.length > 0) {
  console.error(`\nFAIL: ${hits.length} AGENTS.md alias-ordering violation(s):`);
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line} · ${h.reason}`);
    console.error(`    ${h.context}`);
  }
  console.error('');
  console.error('Per CLAUDE.md section 15 lookup table:');
  console.error('  "Lead with the canonical IVARONIX_* form in the templates;');
  console.error('   document the legacy alias as a deprecated fallback in a comment."');
  console.error('');
  console.error('Resolution:');
  console.error('  1. Rewrite the line so the canonical form appears first,');
  console.error('     followed by the legacy alias in a parenthetical or comment.');
  console.error('     Bad:  "ZG_API_SECRET — Router credentials"');
  console.error('     Good: "IVARONIX_ROUTER_KEY (legacy alias: ZG_API_SECRET) — Router credentials"');
  console.error('  2. Add `agents-alias:allow:<reason>` on the line for an');
  console.error('     intentional, documented exception (rare).');
  process.exit(1);
}

ok(`every AGENTS.md line that mentions a legacy alias also leads with the canonical IVARONIX_*`);
console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
