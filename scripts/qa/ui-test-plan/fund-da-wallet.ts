/**
 * One-off: fund the DA disperser wallet on Galileo testnet.
 * Reads operator key from .env, sends 0.01 OG to the DA address.
 */
import { JsonRpcProvider, Wallet, parseEther, formatEther } from 'ethers';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const DA_ADDR = '0xeE07e769ca82617AA76a0631869bdde841bBdEC8';
const key = env.IVARONIX_SIGNER_KEY ?? env.EVM_PRIVATE_KEY;
if (!key) {
  console.error('FAIL: no IVARONIX_SIGNER_KEY or EVM_PRIVATE_KEY in .env');
  process.exit(1);
}

async function main(): Promise<void> {
  const provider = new JsonRpcProvider('https://evmrpc-testnet.0g.ai', { chainId: 16602, name: 'galileo' });
  const op = new Wallet(key, provider);

  const before = await provider.getBalance(DA_ADDR);
  console.log(`DA bal before: ${formatEther(before)} OG`);

  if (before < parseEther('0.005')) {
    console.log(`funding DA wallet with 0.01 OG from operator ${op.address}…`);
    const tx = await op.sendTransaction({
      to: DA_ADDR,
      value: parseEther('0.01'),
      gasPrice: 5_000_000_000n,
      gasLimit: 100_000n,
    });
    console.log(`fund tx: https://chainscan-galileo.0g.ai/tx/${tx.hash}`);
    const r = await tx.wait();
    console.log(`status: ${r?.status === 1 ? 'PASS' : 'FAIL'}`);
  } else {
    console.log('already funded above threshold');
  }

  const after = await provider.getBalance(DA_ADDR);
  console.log(`DA bal after: ${formatEther(after)} OG`);
}

main().catch((err) => { console.error('FAIL:', err); process.exit(1); });
