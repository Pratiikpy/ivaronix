/**
 * iter-122 closure regression for CapabilityRegistryV2-blindness in CLI + MCP.
 *
 * Same drift class as iter-121 (AgentPassportV2) one contract over.
 * CapabilityRegistryV2 (B-V2-15) closes the social-graph leak: V1's
 * `grantsByOwner[]` and `grantsByGrantee[]` mappings were public, letting
 * any attacker enumerate every grant ever issued to or from any wallet.
 * V2 gates reverse-index reads through `getGrantsByOwner` /
 * `getGrantsByGrantee` (access-controlled).
 *
 * Pre-iter-122: 12 CLI/MCP sites looked up `CapabilityRegistry` (V1) and
 * zero looked up `CapabilityRegistryV2`. The two ACTIVE writer bugs caught:
 *
 *   1. apps/cli/src/commands/memory.ts:511 (`ivaronix memory grant <grantee>`)
 *      Every new memory grant issued via CLI landed on V1, where its
 *      existence was publicly enumerable via the auto-generated
 *      `grantsByOwner(address, uint256)` getter. A random visitor could
 *      reconstruct the operator's full memory-access social graph.
 *
 *   2. apps/cli/src/commands/room.ts:159 (`ivaronix doc room create`)
 *      Same drift on the per-party grants issued for doc-room access.
 *      The full party list of every room was visible to any chain reader.
 *
 * Both fixed iter-122 to V2-first. issueGrant signature is identical V1↔V2,
 * so the existing V1 CapabilityRegistryClient works against V2's address
 * for the write path. Reads via `listGrantsByOwner` still need the V1
 * contract since V2 renamed it to `getGrantsByOwner`.
 *
 * This regression scans CLI + MCP for V1 lookups without V2 sibling.
 *
 * Allow-marker: `// v1-capability-allow:<reason>` opt-out for documented
 * V1-only callers (e.g. legacy-grant inspection, listGrantsByOwner reads
 * that genuinely need V1's unrestricted reverse-index getter).
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
ok(`scanned ${files.length} TypeScript source files across CLI + MCP + runtime + studio`);

const V1_LOOKUP_RE = /getDeployedAddress\([^)]*['"]CapabilityRegistry['"]\s*\)/;
const V2_LOOKUP_RE = /getDeployedAddress\([^)]*['"]CapabilityRegistryV2['"]\s*\)/;
const ALLOW_MARKER_RE = /v1-capability-allow:/;

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
  console.error(`\nFAIL: ${violations.length} file(s) look up CapabilityRegistry but not CapabilityRegistryV2:`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)}`);
  }
  console.error(`\nFix: add a sibling getDeployedAddress(network, 'CapabilityRegistryV2') lookup`);
  console.error(`     and use V2-first-V1-fallback for issueGrant/revokeGrant/consumeRead`);
  console.error(`     (signatures are identical V1↔V2 so the V1 client works against V2's address).`);
  console.error(`     Reference: apps/cli/src/commands/memory.ts (memory grant · post-iter-122).`);
  console.error(`     If the file needs V1-only behaviour (legacy listGrantsByOwner reads),`);
  console.error(`     add a comment: // v1-capability-allow:<reason>`);
  process.exit(1);
}

ok(`every file that looks up CapabilityRegistry also looks up CapabilityRegistryV2`);
console.log(`\n[verify-capability-registry-v2-coexists-with-v1] ${asserts}/2 assertions passed`);
