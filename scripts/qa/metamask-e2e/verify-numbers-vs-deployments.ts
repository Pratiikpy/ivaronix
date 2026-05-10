// Regression: docs/numbers.json contract claims must match the
// canonical contracts/deployments/testnet.json source-of-truth.
//
// Why this exists:
//   numbers.json is the auto-derived single source for numeric claims
//   in README.md, PITCH.md, JUDGE_GUIDE.md, MAINNET_READINESS.md. The
//   contracts.deployed count, contracts.list, and contracts.addresses
//   fields are read by judges + operators alongside chainscan links.
//   If numbers.json says ReceiptRegistry is at 0xABC and the actual
//   deployment file says 0xDEF, every receipt URL judges click is
//   either broken or points at the wrong contract.
//
//   This regression closes the drift class: every contract address +
//   every contract name in numbers.json must exactly match what's in
//   contracts/deployments/testnet.json.
//
// Scope:
//   - contracts.deployed (count) === keys in deployments.contracts
//   - contracts.list (string[]) === sorted keys in deployments.contracts
//   - contracts.addresses[name] === deployments.contracts[name].address
//     for every name in the intersection
//
// Run: pnpm tsx scripts/qa/metamask-e2e/verify-numbers-vs-deployments.ts
import { readFileSync } from 'node:fs';
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

interface NumbersFile {
  contracts: {
    deployed: number;
    list: string[];
    addresses: Record<string, string>;
  };
}

interface DeploymentsFile {
  contracts: Record<string, { address: string }>;
}

const numbers = JSON.parse(
  readFileSync(resolve(REPO_ROOT, 'docs', 'numbers.json'), 'utf8'),
) as NumbersFile;
const deployments = JSON.parse(
  readFileSync(resolve(REPO_ROOT, 'contracts', 'deployments', 'testnet.json'), 'utf8'),
) as DeploymentsFile;

ok(`loaded docs/numbers.json + contracts/deployments/testnet.json`);

// ─── Check 1: count parity ─────────────────────────────────────────────
const deploymentKeys = Object.keys(deployments.contracts);
if (numbers.contracts.deployed !== deploymentKeys.length) {
  fail(
    `contracts.deployed mismatch: numbers.json says ${numbers.contracts.deployed}, ` +
    `deployments.json has ${deploymentKeys.length} entries · ` +
    `run pnpm numbers:refresh`,
  );
}
ok(`contracts.deployed count matches: ${numbers.contracts.deployed}`);

// ─── Check 2: list parity ──────────────────────────────────────────────
const numbersListSorted = [...numbers.contracts.list].sort();
const deploymentsListSorted = [...deploymentKeys].sort();

const missingFromNumbers = deploymentsListSorted.filter((k) => !numbersListSorted.includes(k));
const extraInNumbers = numbersListSorted.filter((k) => !deploymentsListSorted.includes(k));

if (missingFromNumbers.length > 0) {
  fail(
    `contracts.list is missing ${missingFromNumbers.length} contract(s) ` +
    `from deployments.json: ${missingFromNumbers.join(', ')} · ` +
    `run pnpm numbers:refresh`,
  );
}
if (extraInNumbers.length > 0) {
  fail(
    `contracts.list has ${extraInNumbers.length} stale entry(ies) ` +
    `not in deployments.json: ${extraInNumbers.join(', ')} · ` +
    `(deployment removed? if intentional, remove from numbers.json)`,
  );
}
ok(`contracts.list matches deployment keys exactly (${numbersListSorted.length} entries)`);

// ─── Check 3: per-address parity ───────────────────────────────────────
const mismatches: { name: string; numbers: string; deployments: string }[] = [];
for (const name of deploymentKeys) {
  const expected = deployments.contracts[name]!.address;
  const actual = numbers.contracts.addresses[name];
  if (actual === undefined) {
    fail(
      `contracts.addresses.${name} is missing in numbers.json ` +
      `(deployments.json has it at ${expected}) · run pnpm numbers:refresh`,
    );
  }
  // Case-insensitive comparison: both files use mixed-case checksummed
  // addresses; if one path normalizes and the other doesn't, the strings
  // differ but the addresses are the same. Compare lowercase.
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    mismatches.push({ name, numbers: actual, deployments: expected });
  }
}
if (mismatches.length > 0) {
  console.error(`\nFAIL: ${mismatches.length} contract address mismatch(es):`);
  for (const m of mismatches) {
    console.error(`  ${m.name}`);
    console.error(`    numbers.json:     ${m.numbers}`);
    console.error(`    deployments.json: ${m.deployments}`);
  }
  console.error('');
  console.error('Resolution:');
  console.error('  contracts/deployments/testnet.json is the canonical source.');
  console.error('  Run pnpm numbers:refresh to regenerate numbers.json from it.');
  process.exit(1);
}
ok(`every contract address matches between numbers.json and deployments.json`);

// ─── Check 4: also verify numbers.json doesn't have extra address entries ──
const extraAddresses = Object.keys(numbers.contracts.addresses).filter(
  (k) => !deploymentKeys.includes(k),
);
if (extraAddresses.length > 0) {
  fail(
    `contracts.addresses has ${extraAddresses.length} stale address entry(ies) ` +
    `not in deployments.json: ${extraAddresses.join(', ')} · ` +
    `run pnpm numbers:refresh`,
  );
}
ok(`no orphan address entries in numbers.json`);

console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
