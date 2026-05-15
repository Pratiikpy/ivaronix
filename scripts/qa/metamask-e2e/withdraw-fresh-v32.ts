import { JsonRpcProvider, HDNodeWallet, Wallet, Contract, formatEther, parseUnits } from 'ethers';
import { readFileSync } from 'node:fs';
const persisted = JSON.parse(readFileSync('C:/Users/prate/Downloads/oglabs/QA_PROOF_PACK/submission-final/mm-prod-payouts-click-v28/fresh-wallet.json', 'utf8'));
const fresh = HDNodeWallet.fromPhrase(persisted.mnemonic);
const provider = new JsonRpcProvider('https://evmrpc-testnet.0g.ai', { chainId: 16602, name: 'galileo' });
const signer = new Wallet(fresh.privateKey, provider);
const PAY = '0x9eA5FDba913AC94dA8833Fee21F2832827950A5C';
const abi = ['function creatorBalance(address) view returns (uint256)', 'function withdrawCreator() external'];
const c = new Contract(PAY, abi, signer);
const pre = await (c as any).creatorBalance(fresh.address) as bigint;
console.log(`fresh wallet creatorBalance: ${formatEther(pre)} OG`);
if (pre === 0n) { console.log('nothing to withdraw'); process.exit(0); }
const tx = await (c as any).withdrawCreator({gasPrice: parseUnits('5','gwei'), gasLimit: 100_000});
console.log(`tx: ${tx.hash}`);
const r = await tx.wait();
console.log(`✓ block ${r.blockNumber}, gas ${r.gasUsed}`);
const post = await (c as any).creatorBalance(fresh.address) as bigint;
console.log(`post creatorBalance: ${formatEther(post)} OG`);
console.log(`chainscan: https://chainscan-galileo.0g.ai/tx/${tx.hash}`);
