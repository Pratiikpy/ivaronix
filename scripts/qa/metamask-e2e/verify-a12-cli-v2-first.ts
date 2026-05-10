/**
 * A.1.2 regression · CLI receipt commands query ReceiptRegistryV2 first
 * with V1 fallback across all read paths (verify, show, list,
 * resolveReceiptInput numeric-id branch).
 *
 * Closes WT 88 from wanderingthoughts.md. Without this, the gold-standard
 * `ivaronix receipt verify <id>` command would have returned "not found"
 * for every V2 receipt anchored after the K-2 mainnet redeploy.
 *
 * Source-file regression assertions only — runs offline. The companion
 * live smoke (`verify-v2-anchor-live.ts` + a follow-up CLI verify call)
 * exercises the actual V2 verify path against Galileo testnet.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const RECEIPT_TS = resolve(REPO_ROOT, 'apps/cli/src/commands/receipt.ts');

let failures = 0;
function check(label: string, pass: boolean, detail = ''): void {
  if (pass) {
    console.log(`  PASS · ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL · ${label}${detail ? ` · ${detail}` : ''}`);
  }
}

console.log('A.1.2 · CLI receipt commands V2-first regression\n');

check('receipt.ts exists', existsSync(RECEIPT_TS), RECEIPT_TS);
const src = existsSync(RECEIPT_TS) ? readFileSync(RECEIPT_TS, 'utf8') : '';

// 1. Imports include both clients.
check(
  'imports ReceiptRegistryV2Client from @ivaronix/og-chain',
  /import\s*\{[\s\S]*?\bReceiptRegistryV2Client\b[\s\S]*?\}\s*from\s*['"]@ivaronix\/og-chain['"]/.test(src),
);
check(
  'imports ReceiptRegistryClient (V1) from @ivaronix/og-chain',
  /import\s*\{[\s\S]*?\bReceiptRegistryClient\b[\s\S]*?\}\s*from\s*['"]@ivaronix\/og-chain['"]/.test(src),
);

// 2. The V2-first helper exists.
check(
  'declares buildReadRegistries(network, runner) helper',
  /function\s+buildReadRegistries\s*\(/.test(src),
);

// 3. Helper returns V2 first when both are deployed.
//    Match against the body where V2 is pushed before V1.
const v2BeforeV1 = /v2Addr[\s\S]{0,200}?out\.push\([\s\S]{0,200}?'v2'[\s\S]{0,400}?v1Addr[\s\S]{0,200}?out\.push\([\s\S]{0,200}?'v1'/m;
check('helper pushes V2 before V1', v2BeforeV1.test(src));

// 4. Each read path uses the helper, not the V1 client directly.
const helperCalls = (src.match(/buildReadRegistries\(/g) ?? []).length;
check('buildReadRegistries called at least 4 times (resolveReceiptInput, verify, show, list)', helperCalls >= 4, `got ${helperCalls}`);

// 5. The legacy direct V1 fetch pattern outside the helper is gone.
//    We grep for `new ReceiptRegistryClient(` calls. The helper itself has
//    one. Anchor (write) path keeps one because V2 anchor needs a different
//    EIP-712 flow (separate scope). Total expected occurrences: 2 (helper +
//    anchor write path).
const v1Constructions = (src.match(/new\s+ReceiptRegistryClient\(/g) ?? []).length;
check(
  'no leftover direct ReceiptRegistryClient construction in read paths (only helper + anchor write expected)',
  v1Constructions <= 2,
  `expected ≤ 2, got ${v1Constructions}`,
);

// 6. Verify path renders the registry version on the chain-anchor row.
check(
  'verify output renders V1 LEGACY chip on V1 anchors',
  /V1 LEGACY/.test(src),
);
check(
  'verify output renders V2 chip on V2 anchors',
  /\bV2\b/.test(src),
);

// 7. List command merges results from V1 + V2 with version tag.
check(
  'list command tags rows with registryVersion',
  /registryVersion/.test(src),
);

console.log();
if (failures > 0) {
  console.error(`A.1.2 · ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('A.1.2 · all assertions passed · CLI read paths are V2-first');
