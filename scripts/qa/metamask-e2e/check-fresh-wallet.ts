import { JsonRpcProvider, HDNodeWallet, formatEther } from 'ethers';
import { readFileSync } from 'node:fs';
const persisted = JSON.parse(readFileSync('C:/Users/prate/Downloads/oglabs/QA_PROOF_PACK/submission-final/mm-prod-payouts-click-v28/fresh-wallet.json', 'utf8'));
const fresh = HDNodeWallet.fromPhrase(persisted.mnemonic);
console.log(`address: ${fresh.address}`);
const prov = new JsonRpcProvider('https://evmrpc-testnet.0g.ai', { chainId: 16602, name: 'galileo' });
const bal = await prov.getBalance(fresh.address);
console.log(`balance: ${formatEther(bal)} OG`);
