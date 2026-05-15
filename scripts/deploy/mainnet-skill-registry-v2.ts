// Direct ethers deploy for SkillRegistryV2 on 0G Aristotle mainnet (chainId
// 16661). Foundry `forge script` rejects this chain ("Chain 16661 not
// supported"); `forge create` only supports primitive constructor args
// (not bytes32[] + address[] arrays). This deployer reads compiled
// artifacts from `contracts/out/<Contract>.sol/<Contract>.json` and
// deploys via ethers v6.

import { ethers } from 'ethers';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RPC = 'https://evmrpc.0g.ai';
const KEY = process.env.IVARONIX_SIGNER_KEY ?? process.env.EVM_PRIVATE_KEY;
if (!KEY) throw new Error('IVARONIX_SIGNER_KEY or EVM_PRIVATE_KEY required');

const provider = new ethers.JsonRpcProvider(RPC, { chainId: 16661, name: 'aristotle' });
const wallet = new ethers.Wallet(KEY, provider);

const artifactPath = resolve('contracts/out/SkillRegistryV2.sol/SkillRegistryV2.json');
const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));

const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, wallet);

const reservedSlugs = [
  'skill:private-doc-review',
  'skill:github-audit',
  'skill:0g-integration-auditor',
  'skill:code-edit',
  'skill:plan-step',
  'skill:content-pitch-review',
];
const reservedIds = reservedSlugs.map((s) => ethers.keccak256(ethers.toUtf8Bytes(s)));
const reservedOwners = reservedIds.map(() => wallet.address);

async function main(): Promise<void> {
  console.log('Deployer:', wallet.address);
  console.log('Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'OG');
  console.log('Gas price:', ethers.formatUnits(await provider.getFeeData().then((f) => f.gasPrice!), 'gwei'), 'Gwei');

  const contract = await factory.deploy(wallet.address, reservedIds, reservedOwners, {
    gasPrice: 5_000_000_000n,
  });
  const tx = contract.deploymentTransaction()!;
  console.log('Tx hash:', tx.hash);
  console.log('Waiting for confirmation...');
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log('SkillRegistryV2 deployed at:', addr);

  const receipt = await provider.getTransactionReceipt(tx.hash);
  console.log('Status:', receipt?.status);
  console.log('Gas used:', receipt?.gasUsed.toString());
  console.log('Effective gas price:', receipt?.gasPrice.toString());
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
