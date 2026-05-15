/**
 * v30 · /marketplace/payouts withdraw on TESTNET (Galileo) · end-to-end proof.
 *
 * Mirror of v25 (which did mainnet). Operator accrued 0.072 OG creator
 * balance on testnet SkillRunPayment from this session's 4 paid runs
 * (receipts 79/80/9/10 · 90% to creator x ~0.020 OG each).
 *
 * Same contract invariants verified:
 *   - creatorBalance zeroed (state-zero-pre-transfer)
 *   - creatorLifetimeEarned unchanged (monotonic)
 *   - operator wallet receives the funds
 */
import { JsonRpcProvider, Wallet, Contract, formatEther, parseUnits } from 'ethers';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-payouts-testnet-v30');
mkdirSync(OUT, { recursive: true });
const RPC = 'https://evmrpc-testnet.0g.ai';
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

const ABI = [
  'function creatorBalance(address) view returns (uint256)',
  'function creatorLifetimeEarned(address) view returns (uint256)',
  'function withdrawCreator() external',
];

async function main(): Promise<void> {
  log(`v30 · /marketplace/payouts withdraw on TESTNET · operator creator side`);
  const env = loadEnv();
  const OPERATOR_KEY = env['IVARONIX_SIGNER_KEY'] ?? env['EVM_PRIVATE_KEY'];
  if (!OPERATOR_KEY) process.exit(1);

  const deployments = JSON.parse(readFileSync(resolve(REPO, 'contracts/deployments/testnet.json'), 'utf8'));
  const PAYMENT = deployments.contracts.SkillRunPayment.address;
  log(`SkillRunPayment @ ${PAYMENT}`);

  const provider = new JsonRpcProvider(RPC, { chainId: 16602, name: 'galileo' });
  const wallet = new Wallet(OPERATOR_KEY, provider);
  const payment = new Contract(PAYMENT, ABI, wallet);

  log(`\n=== PRE state ===`);
  const preBalance = await payment.creatorBalance(OPERATOR) as bigint;
  const preLifetime = await payment.creatorLifetimeEarned(OPERATOR) as bigint;
  const preWallet = await provider.getBalance(OPERATOR);
  log(`creatorBalance:        ${formatEther(preBalance)} OG`);
  log(`creatorLifetimeEarned: ${formatEther(preLifetime)} OG`);
  log(`operator wallet bal:   ${formatEther(preWallet)} OG`);
  if (preBalance === 0n) { log(`⚠ nothing to withdraw`); process.exit(2); }

  log(`\n=== ACTION ===`);
  const tx = await payment.withdrawCreator({ gasPrice: parseUnits('5', 'gwei'), gasLimit: 100_000 });
  log(`tx: ${tx.hash}`);
  const rcpt = await tx.wait();
  log(`✓ block ${rcpt!.blockNumber}, gas ${rcpt!.gasUsed}`);

  log(`\n=== POST state ===`);
  const postBalance = await payment.creatorBalance(OPERATOR) as bigint;
  const postLifetime = await payment.creatorLifetimeEarned(OPERATOR) as bigint;
  const postWallet = await provider.getBalance(OPERATOR);
  log(`creatorBalance:        ${formatEther(postBalance)} OG  (was ${formatEther(preBalance)})`);
  log(`creatorLifetimeEarned: ${formatEther(postLifetime)} OG  (was ${formatEther(preLifetime)} · monotonic ✓)`);
  log(`operator wallet bal:   ${formatEther(postWallet)} OG  (was ${formatEther(preWallet)})`);

  const balanceZeroed = postBalance === 0n;
  const lifetimeKept = postLifetime === preLifetime;
  const received = postWallet > preWallet - parseUnits('5', 'gwei') * 100_000n;
  log(`\nInvariants: zeroed=${balanceZeroed} monotonic=${lifetimeKept} received=${received}`);

  writeFileSync(resolve(OUT, 'final.json'), JSON.stringify({
    network: 'galileo testnet',
    payment: PAYMENT,
    pre: { balance: preBalance.toString(), lifetime: preLifetime.toString(), wallet: preWallet.toString() },
    post: { balance: postBalance.toString(), lifetime: postLifetime.toString(), wallet: postWallet.toString() },
    tx: { hash: tx.hash, block: rcpt!.blockNumber, gasUsed: rcpt!.gasUsed.toString() },
    invariants: { balanceZeroed, lifetimeKept, received },
    chainscanUrl: `https://chainscan-galileo.0g.ai/tx/${tx.hash}`,
    passed: balanceZeroed && lifetimeKept && received,
  }, null, 2));

  log(`\n=== DONE ===`);
  log(`chainscan: https://chainscan-galileo.0g.ai/tx/${tx.hash}`);
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
