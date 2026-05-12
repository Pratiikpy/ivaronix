/**
 * iter-120 closure regression for V3-blindness in CLI writers/readers.
 *
 * iter-120 found three bugs in CLI commands that look up V2 but not V3:
 *
 *   1. apps/cli/src/commands/receipt.ts anchor command (line 512 pre-fix)
 *      could not target ReceiptRegistryV3 — slot 10/11/12 receipts handed
 *      to `ivaronix receipt anchor <path>` would have hit V2's contract
 *      revert ("type not admitted").
 *
 *   2. apps/cli/src/commands/receipt.ts list command (line 715 pre-fix)
 *      tagged V3 receipts as "V1 LEGACY" because the ternary
 *      `r.registryVersion === 'v2' ? 'V2' : 'V1'` had no V3 case.
 *
 *   3. apps/cli/src/commands/stats.ts (line 53-85 pre-fix) undercounted
 *      total receipts by skipping V3 entirely — even though README.md,
 *      MAINNET_READINESS.md, and PITCH.md all claim "V1 + V2 + V3" totals
 *      as the canonical number.
 *
 * The bug-class: any file that does V2 lookup but not V3 lookup is
 * V3-blind by drift. For writers, this manifests as contract reverts
 * when slot 10/11/12 receipts are routed wrong. For readers, this
 * manifests as undercount / mis-tagging.
 *
 * This regression scans apps/cli/src + apps/mcp-server/src +
 * packages/runtime/src for files that look up ReceiptRegistryV2 and
 * fails if those files don't also look up ReceiptRegistryV3.
 *
 * Allow-marker: `// v3-lookup-allow:<reason>` anywhere in the file
 * documents an intentional V2-only or V1-only scope (e.g. a test that
 * is explicitly checking V2 behaviour, or a deprecated command path).
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
ok(`scanned ${files.length} TypeScript source files across CLI + MCP server + runtime`);

const V2_LOOKUP_RE = /getDeployedAddress\([^)]*['"]ReceiptRegistryV2['"]\s*\)/;
const V3_LOOKUP_RE = /getDeployedAddress\([^)]*['"]ReceiptRegistryV3['"]\s*\)/;
const ALLOW_MARKER_RE = /v3-lookup-allow:/;

const violations: { file: string }[] = [];

for (const file of files) {
  let src: string;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }

  const hasV2 = V2_LOOKUP_RE.test(src);
  if (!hasV2) continue;

  const hasV3 = V3_LOOKUP_RE.test(src);
  if (hasV3) continue;

  if (ALLOW_MARKER_RE.test(src)) continue;

  violations.push({ file });
}

if (violations.length > 0) {
  console.error(`\nFAIL: ${violations.length} file(s) look up ReceiptRegistryV2 but not ReceiptRegistryV3:`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)}`);
  }
  console.error(`\nFix: add a sibling getDeployedAddress(network, 'ReceiptRegistryV3') lookup.`);
  console.error(`     For writers that anchor receipts: match the type-aware routing pattern`);
  console.error(`     in packages/runtime/src/pipeline.ts (SLOTS_REQUIRING_V3 set).`);
  console.error(`     If the file is intentionally V2-only (e.g. a V2-specific regression test),`);
  console.error(`     add a comment: // v3-lookup-allow:<reason>`);
  process.exit(1);
}

ok(`every file that looks up ReceiptRegistryV2 also looks up ReceiptRegistryV3`);
console.log(`\n[verify-v3-lookup-coexists-with-v2] ${asserts}/2 assertions passed`);
