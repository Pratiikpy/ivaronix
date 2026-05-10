/**
 * Regression: every contract under `contracts/src/*.sol` has a
 * `Threat model:` block in its top-of-file NatSpec.
 *
 * Why this gate exists (sweep 102 finding):
 *   .claude/rules/contracts.md says:
 *     "Threat-model NatSpec required on every security-sensitive
 *      contract: 'Threat model:' block listing what the contract
 *      defends + what it does NOT defend + assumed attacker
 *      capabilities."
 *
 *   Sweep 102 audit found 4 V1 contracts missing the block:
 *     - AgentPassportINFT.sol
 *     - ReceiptRegistry.sol
 *     - SkillRegistry.sol
 *     - SubscriptionEscrow.sol
 *
 *   V1 contracts are LEGACY but still security-relevant: they're in
 *   the V2-first read-fallback path (every Studio/CLI/MCP read tries
 *   V2 first, falls back to V1). Source-code readers (auditors,
 *   contributors) need the threat model documented. Sweep 102 added
 *   all 4 missing blocks; this regression captures that state as a
 *   permanent contract.
 *
 * What we check:
 *   For every `.sol` file under `contracts/src/` (excluding `contracts/
 *   lib/` which is vendored OpenZeppelin + forge-std):
 *     - The file's content contains `Threat model:` somewhere within
 *       the first 100 lines (top-of-file NatSpec, not buried in
 *       function-level comments).
 *     - If the contract has only `interface` or `library` declarations
 *       (no `contract` keyword), it's exempt — interfaces have no
 *       state to defend.
 *
 * Allow-list:
 *   `// threat-model-allow:<reason>` inline marker on the contract
 *   declaration line. Use only when the file is a thin pass-through
 *   (e.g., a constants-only contract). None today.
 *
 * Captures sweep 102's closure as a permanent gate. Testnet-only.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const CONTRACTS_DIR = resolve(REPO_ROOT, 'contracts', 'src');

interface Hit {
  file: string;
  reason: string;
}

const ALLOW_TAG = /threat-model-allow:/;

function listContracts(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sol'))
    .map((f) => resolve(dir, f));
}

console.log('Contracts · Threat model NatSpec coverage\n');

const files = listContracts(CONTRACTS_DIR);
const hits: Hit[] = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (ALLOW_TAG.test(src)) continue;

  // Skip if no `contract` declaration (interfaces + libraries are exempt).
  if (!/^contract\s+\w+/m.test(src)) continue;

  // Check first 100 lines for the threat-model marker. The block lives
  // in the contract's top-of-file NatSpec, not buried mid-file.
  const head = src.split('\n').slice(0, 100).join('\n');
  // Accept both `Threat model:` and `Threat model (qualifier):` shapes.
  // Erc7857Verifier uses the latter (`Threat model (planning-003 §A.3.2 · WT 66):`)
  // and MemoryAccessLog has the same form. Both are valid — the qualifier
  // is just a citation/sweep reference, the block content is what matters.
  if (!/Threat model[\s(:]/.test(head)) {
    hits.push({
      file,
      reason: 'no `Threat model:` block in top-of-file NatSpec',
    });
  }
}

console.log(`  scanned ${files.length} .sol files in contracts/src/`);

if (hits.length === 0) {
  console.log(`  PASS · every contract has a Threat model block`);
  process.exit(0);
}

console.error(`  FAIL · ${hits.length} contract(s) missing the threat model:\n`);
for (const h of hits) {
  const rel = relative(REPO_ROOT, h.file).replace(/\\/g, '/');
  console.error(`    ${rel}`);
  console.error(`      ${h.reason}`);
}
console.error('\n  fix: add a `Threat model:` block in the top-of-file NatSpec listing:');
console.error('       - what the contract defends against (with mechanisms)');
console.error('       - what it does NOT defend against (with mitigations)');
console.error('       - assumed attacker capabilities (multisig, owner-key, etc.)');
console.error('       See ReceiptRegistryV2.sol for the canonical shape.');
process.exit(1);
