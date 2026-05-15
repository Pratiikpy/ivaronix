import { JsonRpcProvider, Contract } from 'ethers';

async function main(): Promise<void> {
  const p = new JsonRpcProvider('https://evmrpc.0g.ai', { chainId: 16661, name: 'aristotle' });
  const v3 = new Contract('0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297', ['function nextId() view returns (uint256)'], p);
  const nextId = v3['nextId'] as (() => Promise<bigint>) | undefined;
  if (!nextId) throw new Error('nextId missing');
  console.log('V3 nextId =', (await nextId()).toString());
}
main().catch((e) => { console.error(e); process.exit(1); });
