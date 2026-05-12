/**
 * B-V2-17 · Deploy SkillRegistryV2 to Galileo testnet via ethers.
 *
 * Why this exists (not `forge script`): forge script rejects chainId
 * 16602 with "Chain 16602 not supported" even with --skip-simulation
 * and ETH_GAS_PRICE env vars. forge create handles it but trips on
 * array constructor args (the reserved list of 6 skill names + 6
 * owner addresses).
 *
 * Run:
 *   pnpm tsx scripts/diag/deploy-skill-registry-v2.ts
 *
 * Reads:
 *   EVM_PRIVATE_KEY (or canonical IVARONIX_SIGNER_KEY) from .env
 *   contracts/out/SkillRegistryV2.sol/SkillRegistryV2.json (forge artifact)
 *
 * Post-deploy: the script logs the address + tx hash; the operator
 * copies them into contracts/deployments/testnet.json + numbers.json
 * + USER_TODO.md per CLAUDE.md §15 bookkeeping discipline.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { JsonRpcProvider, Wallet, ContractFactory, keccak256, toUtf8Bytes } from 'ethers';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

loadEnv({ path: resolve(REPO_ROOT, '.env') });

const PK = process.env.IVARONIX_SIGNER_KEY ?? process.env.EVM_PRIVATE_KEY ?? process.env.OG_PRIVATE_KEY;
if (!PK) throw new Error('No signer key in env (tried IVARONIX_SIGNER_KEY, EVM_PRIVATE_KEY, OG_PRIVATE_KEY)');

const RPC = process.env.IVARONIX_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const CHAIN_ID = Number(process.env.IVARONIX_CHAIN_ID ?? 16602);

const artifactPath = resolve(REPO_ROOT, 'contracts/out/SkillRegistryV2.sol/SkillRegistryV2.json');
const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));

const provider = new JsonRpcProvider(RPC, { chainId: CHAIN_ID, name: '0g-galileo' });
const wallet = new Wallet(PK, provider);

console.log(`Deployer:  ${wallet.address}`);
console.log(`RPC:       ${RPC}`);
console.log(`Chain ID:  ${CHAIN_ID}`);

const reservedIds = [
  keccak256(toUtf8Bytes('skill:private-doc-review')),
  keccak256(toUtf8Bytes('skill:github-audit')),
  keccak256(toUtf8Bytes('skill:0g-integration-auditor')),
  keccak256(toUtf8Bytes('skill:code-edit')),
  keccak256(toUtf8Bytes('skill:plan-step')),
  keccak256(toUtf8Bytes('skill:content-pitch-review')),
];
const reservedOwners = Array(6).fill(wallet.address);

console.log(`Reserved:  6 first-party skill IDs to ${wallet.address}`);

async function main(): Promise<void> {
  const factory = new ContractFactory(artifact.abi, artifact.bytecode.object, wallet);
  const overrides = {
    gasPrice: 5_000_000_000n, // 5 Gwei legacy gas pricing for Galileo
  };
  console.log('Deploying SkillRegistryV2...');
  const contract = await factory.deploy(wallet.address, reservedIds, reservedOwners, overrides);
  const tx = contract.deploymentTransaction();
  console.log(`Deploy tx: ${tx?.hash}`);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`✅ SkillRegistryV2 deployed at: ${addr}`);
  console.log(`   tx hash: ${tx?.hash}`);
  console.log(`   chainscan: https://chainscan-galileo.0g.ai/address/${addr}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
