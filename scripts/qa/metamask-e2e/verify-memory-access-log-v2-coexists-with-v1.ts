/**
 * iter-124 closure regression for MemoryAccessLogV2-blindness · completes
 * the V2-rollout audit cascade started iter-120.
 *
 * Same drift class as iter-121 (AgentPassportV2), iter-122
 * (CapabilityRegistryV2), iter-123 (SkillRegistryV2). MemoryAccessLogV2
 * (B-V2-16) closes the log-spoofing vector: V1 let any wallet emit a
 * `MemoryAccessed(agent=X, grantId=Y, ...)` event for ~$0.001 of gas,
 * polluting X's audit trail with attacker-fabricated entries. V2
 * enforces:
 *   1. Self-log only (msg.sender == agent), OR
 *   2. Grant-backed log (msg.sender holds a valid CapabilityRegistry
 *      grant where grantee == msg.sender + scope/grantId match).
 *
 * Pre-iter-124: 6 CLI/MCP sites looked up `MemoryAccessLog` (V1), zero
 * looked up `MemoryAccessLogV2`. The active reader bug fixed iter-124:
 *
 *   apps/cli/src/commands/memory.ts:767 (`ivaronix memory log`)
 *      V1-only read — couldn't surface V2-anchored audit events.
 *      Fix: merge V1 + V2 event scans, tag each row by source.
 *
 * Both contracts emit `MemoryAccessed` with identical shape, so the
 * existing V1 `MemoryAccessLogClient` decodes either contract's events.
 *
 * Allow-marker: `// v1-memory-access-log-allow:<reason>` opt-out for
 * documented V1-only callers — notably the `memory log-emit` demo tool
 * (which deliberately emits arbitrary events that V2 would reject as
 * spoofing) and the MemoryEngine wire-up at memory.ts:80 (V2-aware
 * engine refactor tracked in USER_TODO §B-V2-41).
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
ok(`scanned ${files.length} TypeScript source files across CLI + MCP + runtime`);

const V1_LOOKUP_RE = /getDeployedAddress\([^)]*['"]MemoryAccessLog['"]\s*\)/;
const V2_LOOKUP_RE = /getDeployedAddress\([^)]*['"]MemoryAccessLogV2['"]\s*\)/;
const ALLOW_MARKER_RE = /v1-memory-access-log-allow:/;

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
  console.error(`\nFAIL: ${violations.length} file(s) look up MemoryAccessLog but not MemoryAccessLogV2:`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)}`);
  }
  console.error(`\nFix: add a sibling getDeployedAddress(network, 'MemoryAccessLogV2') lookup.`);
  console.error(`     For readers: merge V1 + V2 event scans (matching the iter-124 fix in`);
  console.error(`     apps/cli/src/commands/memory.ts \`memory log\` command).`);
  console.error(`     For writers: V2 rejects spoofed logs by design — if you're emitting`);
  console.error(`     audit events on someone else's behalf for demo, that needs V1.`);
  console.error(`     Add a comment: // v1-memory-access-log-allow:<reason>`);
  process.exit(1);
}

ok(`every file that looks up MemoryAccessLog also looks up MemoryAccessLogV2`);
console.log(`\n[verify-memory-access-log-v2-coexists-with-v1] ${asserts}/2 assertions passed`);
