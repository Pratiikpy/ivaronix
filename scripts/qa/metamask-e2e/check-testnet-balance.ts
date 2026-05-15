import { JsonRpcProvider, Contract, formatEther } from 'ethers';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const provider = new JsonRpcProvider('https://evmrpc-testnet.0g.ai', { chainId: 16602, name: '0G Galileo' });
const deployments = JSON.parse(readFileSync(resolve('C:/Users/prate/Downloads/oglabs/contracts/deployments/testnet.json'), 'utf8'));
const PAYMENT = deployments.contracts.SkillRunPayment?.address;
console.log(`SkillRunPayment @ ${PAYMENT}`);
if (!PAYMENT) { console.log('Not deployed on testnet'); process.exit(0); }
const abi = ['function creatorBalance(address) view returns (uint256)', 'function creatorLifetimeEarned(address) view returns (uint256)', 'function treasuryBalance() view returns (uint256)'];
const c = new Contract(PAYMENT, abi, provider);
const OP = '0xaa954c33810029a3eFb0bf755FEF17863E8677Ce';
const bal = await c.creatorBalance(OP) as bigint;
const life = await c.creatorLifetimeEarned(OP) as bigint;
const treas = await c.treasuryBalance() as bigint;
console.log(`Operator creatorBalance:        ${formatEther(bal)} OG`);
console.log(`Operator creatorLifetimeEarned: ${formatEther(life)} OG`);
console.log(`Protocol treasuryBalance:       ${formatEther(treas)} OG`);
