/**
 * Source-file regression · SkillRunPayment deployment-address lock.
 *
 * Catches drift between three sources of truth for the SkillRunPayment
 * contract address:
 *   1. `contracts/deployments/{network}.json` (chain truth)
 *   2. `packages/core/src/types.ts` `KNOWN_PAYMENT_CONTRACTS` (verifier truth)
 *   3. README + MAINNET_READINESS.md "deployed contracts" tables
 *
 * Fails CI if any of these three disagree. FINAL_BUILD_PLAN.md Block A
 * acceptance criterion: "verify-skill-run-payment-deployed.ts locks
 * deployment address against deployments JSON."
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

let failures = 0;
let assertions = 0;

function ok(msg: string): void {
  assertions += 1;
  console.log(`OK: ${msg}`);
}
function fail(msg: string): void {
  assertions += 1;
  failures += 1;
  console.error(`FAIL: ${msg}`);
}

function readJSON<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

// 1. Read deployments JSON
interface DeploymentEntry {
  address: string;
}
interface DeploymentsFile {
  contracts: Record<string, DeploymentEntry>;
}

const testnetJson = readJSON<DeploymentsFile>(
  resolve(REPO, 'contracts/deployments/testnet.json'),
);
const mainnetPath = resolve(REPO, 'contracts/deployments/mainnet.json');
const mainnetJson: DeploymentsFile = existsSync(mainnetPath)
  ? readJSON<DeploymentsFile>(mainnetPath)
  : { contracts: {} };

const testnetDeployed = testnetJson.contracts['SkillRunPayment']?.address;
const mainnetDeployed = mainnetJson.contracts['SkillRunPayment']?.address;

if (!testnetDeployed) {
  fail('contracts/deployments/testnet.json missing SkillRunPayment.address — Block A not deployed on testnet?');
} else {
  ok(`testnet SkillRunPayment deployed at ${testnetDeployed}`);
}

// Mainnet is allowed to be missing pre-Block-K
if (mainnetDeployed) {
  ok(`mainnet SkillRunPayment deployed at ${mainnetDeployed}`);
}

// 2. Read KNOWN_PAYMENT_CONTRACTS from types.ts
const typesSrc = readFileSync(resolve(REPO, 'packages/core/src/types.ts'), 'utf8');

// Extract the testnet payment contract set
const testnetSetMatch = typesSrc.match(
  /KNOWN_PAYMENT_CONTRACTS[^}]*testnet:\s*new\s+Set<string>\(\[([\s\S]*?)\]\)/,
);
if (!testnetSetMatch) {
  fail('packages/core/src/types.ts missing KNOWN_PAYMENT_CONTRACTS.testnet block');
} else {
  const block = testnetSetMatch[1] ?? '';
  if (testnetDeployed && !block.toLowerCase().includes(testnetDeployed.toLowerCase())) {
    fail(
      `KNOWN_PAYMENT_CONTRACTS.testnet does NOT include the testnet-deployed address ${testnetDeployed}. ` +
        `Add it to packages/core/src/types.ts to keep the verifier in sync.`,
    );
  } else if (testnetDeployed) {
    ok(`KNOWN_PAYMENT_CONTRACTS.testnet includes ${testnetDeployed}`);
  }
}

// Same for mainnet — tolerate both `new Set<string>([])` and `new Set<string>()` shapes
const mainnetSetMatch =
  typesSrc.match(/KNOWN_PAYMENT_CONTRACTS[\s\S]*?mainnet:\s*new\s+Set<string>\(\[([\s\S]*?)\]\)/) ||
  typesSrc.match(/KNOWN_PAYMENT_CONTRACTS[\s\S]*?mainnet:\s*new\s+Set<string>\(\s*\)/);
if (!mainnetSetMatch) {
  fail('packages/core/src/types.ts missing KNOWN_PAYMENT_CONTRACTS.mainnet block');
} else if (mainnetDeployed) {
  const block = mainnetSetMatch[1] ?? '';
  if (!block.toLowerCase().includes(mainnetDeployed.toLowerCase())) {
    fail(
      `KNOWN_PAYMENT_CONTRACTS.mainnet does NOT include the mainnet-deployed address ${mainnetDeployed}. ` +
        `Add it to packages/core/src/types.ts.`,
    );
  } else {
    ok(`KNOWN_PAYMENT_CONTRACTS.mainnet includes ${mainnetDeployed}`);
  }
} else {
  ok('KNOWN_PAYMENT_CONTRACTS.mainnet present (empty pre-Block-K)');
}

// 3. README + MAINNET_READINESS — checked only that *if* they mention the address, it matches.
//    Auto-render via numbers.json keeps the canonical addresses in sync — this guards against
//    hand-edits that would drift.
const readme = readFileSync(resolve(REPO, 'README.md'), 'utf8');
const maint = readFileSync(resolve(REPO, 'docs/MAINNET_READINESS.md'), 'utf8');
if (readme.toLowerCase().includes('skillrunpayment')) {
  if (testnetDeployed && !readme.toLowerCase().includes(testnetDeployed.toLowerCase())) {
    fail(
      `README.md mentions SkillRunPayment but does NOT include the testnet address ${testnetDeployed}. ` +
        `Re-run pnpm docs:render after numbers refresh.`,
    );
  } else if (testnetDeployed) {
    ok('README.md includes testnet SkillRunPayment address');
  }
}

if (maint.toLowerCase().includes('skillrunpayment')) {
  if (testnetDeployed && !maint.toLowerCase().includes(testnetDeployed.toLowerCase())) {
    fail(
      `docs/MAINNET_READINESS.md mentions SkillRunPayment but does NOT include ${testnetDeployed}.`,
    );
  } else if (testnetDeployed) {
    ok('docs/MAINNET_READINESS.md includes testnet SkillRunPayment address');
  }
}

console.log(`\n${assertions - failures}/${assertions} assertions passed`);
if (failures > 0) {
  console.error(`${failures} assertion(s) failed.`);
  process.exit(1);
}
