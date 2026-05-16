import { loadSkillFromPath, manifestHashToBytes32 } from '@ivaronix/skills';
import { JsonRpcProvider, Contract, keccak256, toUtf8Bytes } from 'ethers';
import { resolve, dirname } from 'node:path';

const p = new JsonRpcProvider('https://evmrpc.0g.ai', { chainId: 16661, name: '0G' });
const REG = '0x080f87A9E93e9bd0a9e0eB94F97123bf333b1Dde';
const abi = [
  'function getVersion(bytes32 skillId, bytes32 versionId) view returns (tuple(address publisher, bytes32 manifestHash, uint64 timestamp))',
];
const reg = new Contract(REG, abi, p);

async function checkSkill(slug: string, version: string): Promise<void> {
  const skillId = keccak256(toUtf8Bytes(`skill:${slug}`));
  const versionId = keccak256(toUtf8Bytes(`v${version}`));
  const skill = loadSkillFromPath(resolve(process.cwd(), 'seed-skills', slug));
  const localHashBytes32 = manifestHashToBytes32(skill.manifestHash);
  const onChain = await reg.getVersion(skillId, versionId).catch((e: Error) => ({ error: e.message }));
  console.log(`\n=== ${slug}@${version} ===`);
  console.log(`  versionId      : ${versionId}`);
  console.log(`  local hash     : ${localHashBytes32}`);
  if ('error' in onChain) {
    console.log(`  on-chain       : ${onChain.error.slice(0, 80)}`);
  } else {
    console.log(`  on-chain hash  : ${onChain.manifestHash}`);
    console.log(`  publisher      : ${onChain.publisher}`);
    console.log(`  match          : ${localHashBytes32.toLowerCase() === onChain.manifestHash.toLowerCase()}`);
  }
}

async function main(): Promise<void> {
  await checkSkill('private-doc-review', '0.4.0');
  await checkSkill('contract-renewal-clause-detector', '0.1.1');
  await checkSkill('legal-citation-verifier', '0.1.3');
  await checkSkill('term-sheet-risk-scanner', '0.1.2');
}
main().catch((e: Error) => { console.error(e); process.exit(1); });
