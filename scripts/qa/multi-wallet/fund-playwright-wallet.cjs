const { Wallet, JsonRpcProvider, formatEther, parseEther } = require('ethers');

const RPC = 'https://evmrpc-testnet.0g.ai';
const OP_KEY = '0x83b8e454cc8d3cba6041c3bb471d9782cd0924ec8dd5f20b5ff706a4280903cb';
// Hardhat account 0 from seed "test test test ... junk" — used by the
// Playwright MM session as the default-imported wallet.
const TARGET = '0xf39Fd6e51aad88F6F4ce6aB8827279cfFFb92266';

(async () => {
  const provider = new JsonRpcProvider(RPC, { chainId: 16602, name: 'testnet' });
  const op = new Wallet(OP_KEY, provider);
  const bal = await provider.getBalance(TARGET);
  console.log('Playwright-MM wallet (hardhat acct 0):', TARGET);
  console.log('current balance:', formatEther(bal), 'OG');
  if (bal < parseEther('0.04')) {
    console.log('sending 0.05 OG from operator...');
    const tx = await op.sendTransaction({ to: TARGET, value: parseEther('0.05'), gasLimit: 21000 });
    console.log('tx hash:', tx.hash);
    const rec = await tx.wait();
    console.log('mined block:', rec.blockNumber);
    const newBal = await provider.getBalance(TARGET);
    console.log('NEW balance:', formatEther(newBal), 'OG');
    console.log('chainscan:', 'https://chainscan-galileo.0g.ai/tx/' + tx.hash);
  } else {
    console.log('already funded, skipping top-up');
  }
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
