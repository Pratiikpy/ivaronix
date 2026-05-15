/**
 * Quick chain read · operator wallet creatorBalance on mainnet SkillRunPayment.
 * Determines whether the withdraw flow is exercisable today (balance > 0) or
 * requires upstream funding (buyer pays a creator skill first).
 */
import { JsonRpcProvider, Contract, formatEther } from 'ethers';

const provider = new JsonRpcProvider('https://evmrpc.0g.ai', { chainId: 16661, name: '0G Mainnet' });
const PAYMENT = '0xf8085B43a08e957Fea157394dbB0d3EB76A1cD6A';
const abi = [
  'function creatorBalance(address) view returns (uint256)',
  'function creatorLifetimeEarned(address) view returns (uint256)',
  'function treasuryBalance() view returns (uint256)',
];
const c = new Contract(PAYMENT, abi, provider);
const operator = '0xaa954c33810029a3eFb0bf755FEF17863E8677Ce';

const bal = await c.creatorBalance(operator) as bigint;
const lifetime = await c.creatorLifetimeEarned(operator) as bigint;
const treas = await c.treasuryBalance() as bigint;

console.log(`SkillRunPayment @ ${PAYMENT}`);
console.log(`---`);
console.log(`Operator creatorBalance:        ${formatEther(bal)} OG  (${bal.toString()} wei)`);
console.log(`Operator creatorLifetimeEarned: ${formatEther(lifetime)} OG  (${lifetime.toString()} wei)`);
console.log(`Protocol treasuryBalance:       ${formatEther(treas)} OG  (${treas.toString()} wei)`);
console.log(`---`);
console.log(bal > 0n ? `✓ withdraw exercisable now` : `✗ no balance to withdraw — need upstream buyer-pays-creator-skill flow first`);
