/**
 * iter-123 closure regression for SkillRegistryV2-blindness in CLI + runtime.
 *
 * Same drift class as iter-121 (AgentPassportV2) and iter-122
 * (CapabilityRegistryV2) one contract over. SkillRegistryV2 (B-V2-17)
 * closes the name-squatter risk: V1 is first-come-first-served, so any
 * wallet could publish `keccak256("skill:private-doc-review")` first and
 * lock the canonical name forever. V2 ships a reserved-name allow-list
 * (6 first-party skill IDs pre-reserved at deploy) plus owner-
 * arbitration for squatted names.
 *
 * Pre-iter-123: 5 CLI/runtime sites looked up `SkillRegistry` (V1), zero
 * looked up `SkillRegistryV2`. The active writer bug fixed iter-123:
 *
 *   apps/cli/src/commands/skill.ts:149 (`ivaronix skill publish <id>`)
 *      Every first-party skill published via CLI landed on V1, which
 *      has no reserved-name protection. A squatter could pre-publish
 *      `keccak256("skill:private-doc-review")` on V1 and lock the name
 *      indefinitely. V2's reserved list prevents this.
 *
 *      The `skill verify` command (line 210) was also V1-only — couldn't
 *      surface V2-published skills. Fixed to V2-first read with V1 fallback.
 *
 * publishVersion + revokeVersion + transferSkillOwnership signatures
 * are identical V1↔V2, so the existing V1 SkillRegistryClient works
 * against V2's address.
 *
 * Allow-marker: `// v1-skill-registry-allow:<reason>` opt-out for
 * documented V1-only callers (e.g. legacy-skill inspection, V1-specific
 * regression tests).
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

const V1_LOOKUP_RE = /getDeployedAddress\([^)]*['"]SkillRegistry['"]\s*\)/;
const V2_LOOKUP_RE = /getDeployedAddress\([^)]*['"]SkillRegistryV2['"]\s*\)/;
const ALLOW_MARKER_RE = /v1-skill-registry-allow:/;

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
  console.error(`\nFAIL: ${violations.length} file(s) look up SkillRegistry but not SkillRegistryV2:`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)}`);
  }
  console.error(`\nFix: add a sibling getDeployedAddress(network, 'SkillRegistryV2') lookup`);
  console.error(`     and use V2-first-V1-fallback. publishVersion/revokeVersion signatures`);
  console.error(`     are identical V1↔V2 so the existing client works against either address.`);
  console.error(`     Reference: apps/cli/src/commands/skill.ts (publish + verify · post-iter-123).`);
  console.error(`     If the file needs V1-only behaviour, add: // v1-skill-registry-allow:<reason>`);
  process.exit(1);
}

ok(`every file that looks up SkillRegistry also looks up SkillRegistryV2`);
console.log(`\n[verify-skill-registry-v2-coexists-with-v1] ${asserts}/2 assertions passed`);
