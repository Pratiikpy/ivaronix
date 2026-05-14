import { JsonRpcProvider, Contract } from 'ethers';
async function main(): Promise<void> {
  const t0 = Date.now();
  const p = new JsonRpcProvider('https://evmrpc-testnet.0g.ai', { chainId: 16602, name: 'galileo' });
  const reg = new Contract('0xf675d4183b34fe8d1981FA9c117065aAcff690ab', ['function nextId() view returns (uint256)'], p);
  const n = await reg.nextId!() as bigint;
  console.log('nextId():', n.toString(), '· latency:', Date.now() - t0, 'ms');
  const t1 = Date.now();
  const block = await p.getBlock('latest');
  console.log('getBlock(latest):', block!.number, 'ts:', block!.timestamp, '· latency:', Date.now() - t1, 'ms');
  console.log('indexer lag (direct-chain-read):', 0, 's (real-time · reads chain head)');
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
