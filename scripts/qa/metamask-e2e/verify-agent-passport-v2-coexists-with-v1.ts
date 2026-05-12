/**
 * iter-121 closure regression for AgentPassportINFTV2-blindness in CLI + runtime.
 *
 * iter-120 locked the V2/V3 ReceiptRegistry coexistence pattern. iter-121
 * cascade-grep extended the audit to other V2 contracts and found that
 * AgentPassportINFTV2 (deployed for K-1 multi-mint + K-4 trustScore
 * manipulation + K-6 memoryRoot poisoning fixes) was only queried in
 * 2 of 17+ caller sites. The active bugs caught:
 *
 *   1. apps/cli/src/commands/passport.ts (mint command) — every new
 *      CLI-minted passport went to V1, bypassing all three security
 *      fixes. Same wallet could mint a second passport on V2 (no
 *      cross-contract collision check).
 *
 *   2. apps/cli/src/commands/passport.ts (show command) — couldn't
 *      surface V2 passports at all.
 *
 *   3. packages/runtime/src/pipeline.ts (passport update + trust read)
 *      — recordReceipt always targeted V1, silently skipping V2-passport
 *      wallets. Trust score read was V1-only, downgrading V2-passport
 *      sandbox decisions to "no trust".
 *
 * The bug-class is the same iter-120 caught for ReceiptRegistry but one
 * contract layer out: V2 deployed, V1 stays for legacy, callers should
 * use V2-first-V1-fallback. This regression scans for any file looking
 * up AgentPassportINFT without a sibling AgentPassportINFTV2 lookup.
 *
 * Allow-marker: `// v1-passport-allow:<reason>` opt-out for documented
 * V1-only callers (e.g. legacy-tokenId restore commands, debug surfaces
 * that explicitly inspect V1 chain state).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

let asserts = 0;
const ok = (label: string): void => {
  asserts += 1;
  console.log(`OK: ${label}`);
};

const SCAN_DIRS = [
  resolve(REPO_ROOT, 'apps/cli/src'),
  resolve(REPO_ROOT, 'apps/mcp-server/src'),
  resolve(REPO_ROOT, 'apps/telegram-bot/src'),
  resolve(REPO_ROOT, 'packages/runtime/src'),
  resolve(REPO_ROOT, 'apps/studio/src'), // iter-125: extended scope to lock the Studio side of the V2 cascade
];
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'out']);
const SKIP_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts'];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = resolve(dir, entry);
    let stat;
    try { stat = statSync(path); } catch { continue; }
    if (stat.isDirectory()) {
      out.push(...listTsFiles(path));
    } else if (stat.isFile()) {
      if (SKIP_SUFFIXES.some((s) => entry.endsWith(s))) continue;
      if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(path);
    }
  }
  return out;
}

const files: string[] = [];
for (const dir of SCAN_DIRS) files.push(...listTsFiles(dir));
ok(`scanned ${files.length} TypeScript source files across CLI + MCP + telegram + runtime + studio`);

const V1_LOOKUP_RE = /getDeployedAddress\([^)]*['"]AgentPassportINFT['"]\s*\)/;
const V2_LOOKUP_RE = /getDeployedAddress\([^)]*['"]AgentPassportINFTV2['"]\s*\)/;
const ALLOW_MARKER_RE = /v1-passport-allow:/;

const violations: { file: string }[] = [];

for (const file of files) {
  let src: string;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }

  const hasV1 = V1_LOOKUP_RE.test(src);
  if (!hasV1) continue;

  const hasV2 = V2_LOOKUP_RE.test(src);
  if (hasV2) continue;

  if (ALLOW_MARKER_RE.test(src)) continue;

  violations.push({ file });
}

if (violations.length > 0) {
  console.error(`\nFAIL: ${violations.length} file(s) look up AgentPassportINFT but not AgentPassportINFTV2:`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)}`);
  }
  console.error(`\nFix: add a sibling getDeployedAddress(network, 'AgentPassportINFTV2') lookup`);
  console.error(`     and use the V2-first-V1-fallback pattern. Reference implementation:`);
  console.error(`     apps/cli/src/commands/passport.ts (mint + show commands · post-iter-121)`);
  console.error(`     packages/runtime/src/pipeline.ts (recordReceipt + trust read · post-iter-121)`);
  console.error(`     If the file genuinely needs V1-only behaviour (e.g. legacy-tokenId restore),`);
  console.error(`     add a comment: // v1-passport-allow:<reason>`);
  process.exit(1);
}

ok(`every file that looks up AgentPassportINFT also looks up AgentPassportINFTV2`);
console.log(`\n[verify-agent-passport-v2-coexists-with-v1] ${asserts}/2 assertions passed`);
