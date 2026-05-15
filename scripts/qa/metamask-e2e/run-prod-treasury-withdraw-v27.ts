/**
 * v27 · /admin/treasury withdraw · end-to-end proof.
 *
 * Mirrors v25 (creator withdraw). Operator (= Ownable owner) claims
 * the protocol's 10% treasury accumulated balance. The /admin/treasury
 * UI exists at apps/studio/src/app/admin/treasury/page.tsx and reads
 * the same treasuryBalance from chain.
 */
import { JsonRpcProvider, Wallet, Contract, formatEther, parseUnits } from 'ethers';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-treasury-withdraw-v27');
mkdirSync(OUT, { recursive: true });
const RPC = 'https://evmrpc.0g.ai';
const PAYMENT = '0xf8085B43a08e957Fea157394dbB0d3EB76A1cD6A';
const OPERATOR = '0xaa954c33810029a3eFb0bf755FEF17863E8677Ce';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const text = readFileSync(resolve(REPO, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('='); if (eq < 0) continue;
      env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
  return env;
}

function log(m: string): void { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }

const PAYMENT_ABI = [
  'function treasuryBalance() view returns (uint256)',
  'function owner() view returns (address)',
  'function withdrawTreasury() external',
];

async function main(): Promise<void> {
  log(`v27 · /admin/treasury withdraw · end-to-end`);
  const env = loadEnv();
  const OPERATOR_KEY = env['IVARONIX_SIGNER_KEY'] ?? env['EVM_PRIVATE_KEY'];
  if (!OPERATOR_KEY) { log(`✗ no IVARONIX_SIGNER_KEY in .env`); process.exit(1); }

  const provider = new JsonRpcProvider(RPC, { chainId: 16661, name: 'aristotle' });
  const wallet = new Wallet(OPERATOR_KEY, provider);
  const payment = new Contract(PAYMENT, PAYMENT_ABI, wallet);

  // Verify owner gate
  const owner = await payment.owner() as string;
  log(`contract owner: ${owner}`);
  log(`signing wallet: ${wallet.address}`);
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    log(`✗ owner mismatch — withdrawTreasury would revert with onlyOwner`); process.exit(1);
  }
  log(`✓ owner gate matches`);

  // PRE state
  log(`\n=== PRE state ===`);
  const preTreasury = await payment.treasuryBalance() as bigint;
  const preWalletBal = await provider.getBalance(OPERATOR);
  log(`treasuryBalance:     ${formatEther(preTreasury)} OG`);
  log(`operator wallet bal: ${formatEther(preWalletBal)} OG`);

  if (preTreasury === 0n) { log(`⚠ treasuryBalance is 0 — withdraw would revert`); process.exit(2); }

  // ACTION
  log(`\n=== ACTION: withdrawTreasury() ===`);
  const tx = await payment.withdrawTreasury({
    gasPrice: parseUnits('10', 'gwei'),
    gasLimit: 100_000,
  });
  log(`tx hash: ${tx.hash}`);
  const rcpt = await tx.wait();
  log(`✓ confirmed in block ${rcpt!.blockNumber}, gas used ${rcpt!.gasUsed}`);

  // POST state
  log(`\n=== POST state ===`);
  const postTreasury = await payment.treasuryBalance() as bigint;
  const postWalletBal = await provider.getBalance(OPERATOR);
  log(`treasuryBalance:     ${formatEther(postTreasury)} OG  (was ${formatEther(preTreasury)})`);
  log(`operator wallet bal: ${formatEther(postWalletBal)} OG  (was ${formatEther(preWalletBal)})`);

  const balanceZeroed = postTreasury === 0n;
  const walletReceived = postWalletBal > preWalletBal - parseUnits('1', 'gwei') * 100_000n;
  log(`\n=== Invariants ===`);
  log(`treasury zeroed:       ${balanceZeroed ? '✓' : '✗'}`);
  log(`wallet received funds: ${walletReceived ? '✓' : '✗'}`);

  writeFileSync(resolve(OUT, 'final.json'), JSON.stringify({
    owner, signingWallet: wallet.address, payment: PAYMENT,
    pre: { treasury: preTreasury.toString(), walletBal: preWalletBal.toString() },
    post: { treasury: postTreasury.toString(), walletBal: postWalletBal.toString() },
    tx: { hash: tx.hash, block: rcpt!.blockNumber, gasUsed: rcpt!.gasUsed.toString() },
    invariants: { balanceZeroed, walletReceived },
    chainscanUrl: `https://chainscan.0g.ai/tx/${tx.hash}`,
    passed: balanceZeroed && walletReceived,
  }, null, 2));

  log(`\n=== DONE ===`);
  log(`chainscan: https://chainscan.0g.ai/tx/${tx.hash}`);
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
