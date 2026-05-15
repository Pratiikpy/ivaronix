import { JsonRpcProvider, Contract } from 'ethers';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';

async function main(): Promise<void> {
  dotenv.config({ path: resolve(process.cwd(), '.env.mainnet'), override: true });
  const provider = new JsonRpcProvider('https://evmrpc.0g.ai', { chainId: 16661, name: 'aristotle' });
  const passport = new Contract('0x5D724659A7d4B0B0917F5DAe9579423D2c85a6Ad', [
    'function agents(uint256) view returns (bytes32 metadataRoot, bytes32 memoryRoot, bytes32 skillManifestRoot, uint64 receiptCount, uint64 violationCount, int128 trustScore, uint64 mintedAt, uint64 lastEvolutionAt)',
    'function passportOf(address) view returns (uint256)',
  ], provider);
  const passportOf = passport['passportOf'] as ((a: string) => Promise<bigint>) | undefined;
  if (!passportOf) throw new Error('passportOf missing');
  const tokenId = await passportOf('0xaa954c33810029a3eFb0bf755FEF17863E8677Ce');
  console.log('Operator tokenId:', tokenId.toString());
  const agents = passport['agents'] as ((t: bigint) => Promise<{ metadataRoot: string; receiptCount: bigint; violationCount: bigint; trustScore: bigint; mintedAt: bigint }>) | undefined;
  if (!agents) throw new Error('agents missing');
  const a = await agents(tokenId);
  console.log('receiptCount:', a.receiptCount.toString());
  console.log('violationCount:', a.violationCount.toString());
  console.log('trustScore:', a.trustScore.toString());
  console.log('metadataRoot:', a.metadataRoot);
  console.log('mintedAt:', a.mintedAt.toString());
}
main().catch((e) => { console.error(e); process.exit(1); });
