/**
 * USER_TODO deploy markers must match contracts/deployments/testnet.json.
 *
 * Closes sweep 198's queue. The pattern: USER_TODO has §A-V2 entries
 * shaped `### A-V2-<KEY> · Deploy \`ContractName\` to ...` for
 * contract redeploys. If the contract exists in testnet.json, the
 * entry's header must include the ✅ DEPLOYED marker.
 *
 * Pre-sweep-197 three entries (A-V2-K1, A-V2-K2, A-V2-L7) were stale
 * "code-complete · awaiting deploy" status while the contracts had
 * been live for weeks. This regression catches that class.
 *
 * Skip pattern: inline `deploy-marker-allow:<reason>` for genuine
 * exceptions (e.g. mainnet-only deploys that show ✅ on testnet
 * mismatch reasoning).
 *
 * Pure source-file regression.
 */
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

// Source of truth: which contracts are deployed on testnet today.
interface DeploymentsJson { contracts: Record<string, { address: string }>; }
const deployments = JSON.parse(
  readFileSync(resolve(REPO_ROOT, 'contracts/deployments/testnet.json'), 'utf8'),
) as DeploymentsJson;
const deployedContracts = new Set(Object.keys(deployments.contracts));
ok(`testnet.json declares ${deployedContracts.size} deployed contracts`);

const userTodo = readFileSync(resolve(REPO_ROOT, 'docs/USER_TODO.md'), 'utf8');
const lines = userTodo.split(/\r?\n/);

// Match headers like:
//   ### A-V2-K1 · Deploy `AgentPassportINFTV2` to Galileo · ✅ DEPLOYED
//   ### A-V2-K2 · Deploy `ReceiptRegistryV2` to Galileo
// Extract the contract name in backticks AND check for ✅ DEPLOYED at line tail.
const deployHeaderRe = /^### A-V2-\w+ · Deploy `([A-Za-z][\w]*)`/;

const violations: Array<{ line: number; header: string; contract: string }> = [];

for (let i = 0; i < lines.length; i += 1) {
  const text = lines[i] ?? '';
  if (/deploy-marker-allow:/.test(text)) continue;
  const m = text.match(deployHeaderRe);
  if (!m) continue;
  const contract = m[1]!;
  if (!deployedContracts.has(contract)) continue; // not yet deployed; the entry's runbook is still operator-action
  // Contract IS deployed on testnet — the entry MUST carry ✅ DEPLOYED.
  if (!/✅\s*DEPLOYED\b/.test(text)) {
    violations.push({ line: i + 1, header: text.trim(), contract });
  }
}

if (violations.length > 0) {
  console.error('FAIL: USER_TODO §A-V2 entries are stale (contract is deployed but entry says otherwise):');
  for (const v of violations) {
    console.error(`  docs/USER_TODO.md:${v.line}  contract=${v.contract}`);
    console.error(`    ${v.header}`);
  }
  console.error('Fix: update each header to end with " · ✅ DEPLOYED" and the body bullet to reflect the live address from contracts/deployments/testnet.json.');
  console.error('Allow-marker: `deploy-marker-allow:<reason>` inline (e.g. mainnet-only deploy that should not mark deployed for testnet).');
  process.exit(1);
}

ok('every USER_TODO §A-V2 deploy entry matches testnet.json reality');
console.log(`\n[verify-user-todo-deploy-markers] ${asserts} assertions passed`);
