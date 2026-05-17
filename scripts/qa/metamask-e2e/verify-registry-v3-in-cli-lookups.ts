/**
 * Regression: every CLI registry-lookup chain must include V3.
 *
 * After Bug-36 (passport consolidate V3 missing) and Bug-42 (doc-bulk
 * aggregate on V2 instead of V3) this session, scan the CLI for the
 * lookup pattern that misses V3 and assert each file gets it right.
 *
 * The lookup pattern to flag:
 *   const registryAddrV2 = getDeployedAddress(..., 'ReceiptRegistryV2');
 *   const registryAddrV1 = getDeployedAddress(..., 'ReceiptRegistry');
 *   // ← V3 missing here
 *   const registryAddr = registryAddrV2 ?? registryAddrV1;
 *
 * If a file looks up V2 + V1 but not V3, error out and point to the
 * Bug-36/42 pattern. The fix is to add the V3 lookup and prefer it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const CLI_COMMANDS_DIR = resolve(import.meta.dirname, '..', '..', '..', 'apps', 'cli', 'src', 'commands');

interface Finding {
  file: string;
  line: number;
  pattern: string;
}

function scanFile(path: string): Finding[] {
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  const findings: Finding[] = [];

  // Honor opt-out annotation: '// v3-lookup-allow:' anywhere in the file
  // marks the file as intentionally grandfathered (writer emits slots 0-9
  // only, or a diagnostic-only reader). Bug-36 + Bug-42 fixed the genuine
  // miss cases; allow-annotated files keep their narrow V1/V2 scope.
  if (text.includes('v3-lookup-allow:')) return findings;

  // Pattern 1: file looks up ReceiptRegistryV2 but never V3.
  const hasReceiptRegistryV2 = lines.some((l) => /getDeployedAddress\([^)]*['"]ReceiptRegistryV2['"]/.test(l));
  const hasReceiptRegistryV3 = lines.some((l) => /getDeployedAddress\([^)]*['"]ReceiptRegistryV3['"]/.test(l));
  if (hasReceiptRegistryV2 && !hasReceiptRegistryV3) {
    const line = lines.findIndex((l) => /getDeployedAddress\([^)]*['"]ReceiptRegistryV2['"]/.test(l)) + 1;
    findings.push({
      file: path,
      line,
      pattern: 'ReceiptRegistryV2 looked up but not V3 — likely targets the older registry on mainnet (Bug-36/42 class). If intentional, add `// v3-lookup-allow: <reason>` near the top of the file.',
    });
  }

  return findings;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

const files = walk(CLI_COMMANDS_DIR);
const allFindings: Finding[] = [];
for (const file of files) {
  allFindings.push(...scanFile(file));
}

if (allFindings.length > 0) {
  console.error('verify-registry-v3-in-cli-lookups · FAIL');
  console.error('Files looking up ReceiptRegistryV2 but missing V3 (canonical mainnet registry):');
  for (const f of allFindings) {
    const rel = f.file.replace(resolve(import.meta.dirname, '..', '..', '..') + '\\', '').replace(/\\/g, '/');
    console.error(`  ${rel}:${f.line}  ${f.pattern}`);
  }
  console.error('');
  console.error('Fix: add getDeployedAddress(network, \'ReceiptRegistryV3\') alongside V2, and prefer it.');
  console.error('Pattern from passport-consolidate.ts (Bug-36 fix):');
  console.error('  const registryAddrV3 = getDeployedAddress(env.network, \'ReceiptRegistryV3\');');
  console.error('  const registryAddrV2 = getDeployedAddress(env.network, \'ReceiptRegistryV2\');');
  console.error('  const registryAddrV1 = getDeployedAddress(env.network, \'ReceiptRegistry\');');
  console.error('  const writeAddr = registryAddrV3 ?? registryAddrV2 ?? registryAddrV1;');
  process.exit(1);
}

console.log(`verify-registry-v3-in-cli-lookups · PASS (${files.length} CLI source files scanned, all V3-aware)`);
