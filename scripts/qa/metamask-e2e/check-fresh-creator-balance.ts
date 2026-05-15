import { JsonRpcProvider, Contract, formatEther } from 'ethers';
const p = new JsonRpcProvider('https://evmrpc-testnet.0g.ai', { chainId: 16602, name: 'galileo' });
const c = new Contract('0x9eA5FDba913AC94dA8833Fee21F2832827950A5C', ['function creatorBalance(address) view returns (uint256)', 'function creatorLifetimeEarned(address) view returns (uint256)'], p);
const W = '0x0ac0650f002625b2598213f951C956D48EBE1f3b';
const b = await c.creatorBalance(W) as bigint;
const l = await c.creatorLifetimeEarned(W) as bigint;
console.log(`Fresh wallet: ${formatEther(b)} OG balance · ${formatEther(l)} OG lifetime`);
