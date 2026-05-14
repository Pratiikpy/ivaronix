import { JsonRpcProvider } from 'ethers';
async function main(): Promise<void> {
  const p = new JsonRpcProvider('https://evmrpc-testnet.0g.ai', { chainId: 16602, name: 'galileo' });
  const b = await p.getBlock('latest');
  const now = b!.timestamp;
  const unlock = 1778870401;
  const delta = unlock - now;
  console.log('chain.timestamp:', now, '·', new Date(now * 1000).toISOString());
  console.log('unlock at:     ', unlock, '·', new Date(unlock * 1000).toISOString());
  console.log('delta (seconds):', delta, '· hours:', (delta / 3600).toFixed(2));
  console.log(delta > 0 ? 'STATUS: still locked · cron retry in ' + Math.ceil(delta / 60) + ' min' : 'STATUS: UNLOCKED · refund tx eligible NOW');
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
