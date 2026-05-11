/**
 * `KNOWN_RECEIPT_REGISTRIES` in `@ivaronix/core` must match the
 * canonical `contracts/deployments/<network>.json` source of truth.
 *
 * HALF_BAKED §K-17 closure lock (sweep 219).
 *
 * The receipts schema's chainAnchor superRefine checks
 * `registryAddress` against this constant, so a stale or missing
 * entry would either reject legitimate receipts (if the constant lags
 * a new deploy) or accept a forged registry address (if the constant
 * stays after a deploy was rolled back). This regression keeps the
 * two in lockstep.
 *
 * Rule: for each network, the set of registry addresses declared in
 * `KNOWN_RECEIPT_REGISTRIES[network]` must equal the set of
 * `ReceiptRegistry` + `ReceiptRegistryV*` addresses in
 * `contracts/deployments/<network>.json`. Addresses compared
 * lowercase-insensitive.
 *
 * Pure source-file regression.
 */
import { readFileSync, existsSync } from 'node:fs';
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

// Parse the KNOWN_RECEIPT_REGISTRIES constant directly from the source
// file. Avoids a runtime dependency on @ivaronix/core inside the
// regression and survives any path-resolution quirk.
const corePath = resolve(REPO_ROOT, 'packages', 'core', 'src', 'types.ts');
const coreSrc = readFileSync(corePath, 'utf8');
ok(`loaded ${corePath}`);

// Extract the block between `KNOWN_RECEIPT_REGISTRIES` and the closing `};`
// then pull every 0x-hex address out of it.
const blockMatch = coreSrc.match(/KNOWN_RECEIPT_REGISTRIES[\s\S]*?\};/);
if (!blockMatch) fail('KNOWN_RECEIPT_REGISTRIES block not found in core/src/types.ts');
const block = blockMatch![0];

function extractNetworkAddresses(block: string, network: 'testnet' | 'mainnet'): Set<string> {
  // Find the network's array literal within the block.
  const re = new RegExp(`${network}:\\s*new Set<string>\\(\\[([^\\]]*)\\]\\)`);
  const m = block.match(re);
  if (!m) return new Set();
  const inner = m[1] ?? '';
  const addrs = inner.match(/0x[0-9a-fA-F]{40}/g) ?? [];
  return new Set(addrs.map((a) => a.toLowerCase()));
}

const constants = {
  testnet: extractNetworkAddresses(block, 'testnet'),
  mainnet: extractNetworkAddresses(block, 'mainnet'),
};
ok(`parsed KNOWN_RECEIPT_REGISTRIES: testnet=${constants.testnet.size}, mainnet=${constants.mainnet.size}`);

// Load each network's deployments file, extract ReceiptRegistry* addresses.
interface DeploymentsFile {
  contracts: Record<string, { address: string }>;
}

function loadDeployedRegistries(network: 'testnet' | 'mainnet'): Set<string> {
  const path = resolve(REPO_ROOT, 'contracts', 'deployments', `${network}.json`);
  if (!existsSync(path)) return new Set();
  const json = JSON.parse(readFileSync(path, 'utf8')) as DeploymentsFile;
  const addrs = new Set<string>();
  for (const [name, entry] of Object.entries(json.contracts)) {
    if (/^ReceiptRegistry(V\d+)?$/.test(name) && entry.address) {
      addrs.add(entry.address.toLowerCase());
    }
  }
  return addrs;
}

const deployed = {
  testnet: loadDeployedRegistries('testnet'),
  mainnet: loadDeployedRegistries('mainnet'),
};
ok(`parsed deployments: testnet=${deployed.testnet.size}, mainnet=${deployed.mainnet.size}`);

// Compare each network.
for (const network of ['testnet', 'mainnet'] as const) {
  const cset = constants[network];
  const dset = deployed[network];
  const missingFromConstant = [...dset].filter((a) => !cset.has(a));
  const extraInConstant = [...cset].filter((a) => !dset.has(a));
  if (missingFromConstant.length > 0 || extraInConstant.length > 0) {
    console.error('');
    console.error(`FAIL: KNOWN_RECEIPT_REGISTRIES.${network} drifted from contracts/deployments/${network}.json`);
    if (missingFromConstant.length > 0) {
      console.error('  Missing from constant (deployed but constant doesn\'t list):');
      for (const a of missingFromConstant) console.error(`    ${a}`);
    }
    if (extraInConstant.length > 0) {
      console.error('  Extra in constant (listed but not deployed — stale entry from a rolled-back deploy?):');
      for (const a of extraInConstant) console.error(`    ${a}`);
    }
    console.error('');
    console.error('Fix: edit packages/core/src/types.ts KNOWN_RECEIPT_REGISTRIES so it equals the deployments file.');
    console.error('Mainnet empty set is deliberate until first mainnet deploy — adding entries to mainnet without a deployment is wrong.');
    process.exit(1);
  }
  ok(`${network}: ${cset.size} registries match deployments exactly`);
}

console.log(`\n[verify-known-registries-vs-deployments] ${asserts} assertions passed`);
