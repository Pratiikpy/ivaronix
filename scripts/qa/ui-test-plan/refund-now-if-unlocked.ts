/**
 * Cron-callable phase-2 closer for PRE-QUEUE-1 refundFailedRun.
 *
 * Reads QA_PROOF_PACK/testnet/burner-gaps/refund-pending.json (written by
 * extract-paid-receipt-root.ts). If chain.timestamp >= unlockAt, fires
 * refundFailedRun(receiptRoot) from the operator wallet (contract owner) and
 * captures the Refunded event + balance delta + chainscan link. If still locked,
 * exits cleanly with the remaining lock duration printed.
 *
 * Idempotent: once the refund tx lands, the script appends to a 'closed' marker
 * file and exits 0 on subsequent runs (does not re-attempt).
 */
import { JsonRpcProvider, Wallet, Contract, Interface, formatEther } from 'ethers';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PENDING = resolve(REPO, 'QA_PROOF_PACK/testnet/burner-gaps/refund-pending.json');
const CLOSED = resolve(REPO, 'QA_PROOF_PACK/testnet/burner-gaps/refund-closed.json');
const OUT_DIR = dirname(CLOSED);
mkdirSync(OUT_DIR, { recursive: true });

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const text = readFileSync(resolve(REPO, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
  return env;
}
const env = loadEnv();
const OPERATOR_KEY = (env.IVARONIX_SIGNER_KEY ?? env.EVM_PRIVATE_KEY ?? '').replace(/^0x/, '');
const RPC = env.IVARONIX_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const CHAIN_ID = 16602;
const CS = 'https://chainscan-galileo.0g.ai';
const PAY_ABI = [
  'function refundFailedRun(bytes32 receiptRoot) external',
  'function paidRuns(bytes32) external view returns (address payer, address creator, uint128 amount, uint128 creatorShare, uint128 treasuryShare, uint64 paidAt, bool refunded)',
  'function refundUnlockAt(bytes32) external view returns (uint64)',
  'function isPaid(bytes32) external view returns (bool)',
  'event Refunded(bytes32 indexed receiptRoot, address indexed payer, uint256 amount, uint64 timestamp)',
];
const GAS = { gasPrice: 5_000_000_000n, gasLimit: 400_000n };

async function main(): Promise<void> {
  if (existsSync(CLOSED)) {
    console.log(`already closed · ${CLOSED}`);
    return;
  }
  if (!existsSync(PENDING)) {
    console.log(`no refund-pending.json · nothing to do`);
    return;
  }
  const pending = JSON.parse(readFileSync(PENDING, 'utf8')) as {
    skillPaymentAddress: string;
    receiptRoot: string;
    payer: string;
    amount: string;
    unlockAt: number;
  };

  const provider = new JsonRpcProvider(RPC, { chainId: CHAIN_ID, name: 'galileo' });
  const operator = new Wallet(OPERATOR_KEY, provider);
  const pay = new Contract(pending.skillPaymentAddress, PAY_ABI, operator);

  const run = await pay.paidRuns!(pending.receiptRoot);
  const alreadyRefunded = run.refunded as boolean;
  if (alreadyRefunded) {
    console.log(`already refunded · marking closed without new tx`);
    writeFileSync(CLOSED, JSON.stringify({
      ...pending,
      refundedOnChain: true,
      refundTxHash: 'pre-existing · refunded flag already true',
      closedAt: new Date().toISOString(),
    }, null, 2));
    return;
  }

  const block = await provider.getBlock('latest');
  const chainNow = block!.timestamp;
  const delta = pending.unlockAt - chainNow;
  console.log(`chain.timestamp: ${chainNow} · unlockAt: ${pending.unlockAt} · delta: ${delta}s (${(delta / 3600).toFixed(2)}h)`);

  if (delta > 0) {
    console.log(`STILL LOCKED · cron retry in ~${Math.ceil(delta / 60)} min · this iteration exits clean`);
    return;
  }

  console.log(`UNLOCKED · firing refundFailedRun(${pending.receiptRoot})`);
  const bobBefore = await provider.getBalance(pending.payer);
  const refundTx = await pay.refundFailedRun!(pending.receiptRoot, GAS);
  const rcpt = await refundTx.wait();
  if (rcpt?.status !== 1) throw new Error(`refund tx reverted · ${refundTx.hash}`);
  const bobAfter = await provider.getBalance(pending.payer);

  const iface = new Interface(PAY_ABI);
  const refundTopic = iface.getEvent('Refunded')!.topicHash;
  const refundLog = rcpt!.logs.find((l) => l.topics[0] === refundTopic);
  const parsed = refundLog ? iface.parseLog({ topics: refundLog.topics as string[], data: refundLog.data }) : null;

  const closed = {
    ...pending,
    refundedOnChain: true,
    refundTxHash: refundTx.hash,
    refundChainscan: `${CS}/tx/${refundTx.hash}`,
    refundBlock: rcpt!.blockNumber,
    refundEvent: parsed ? {
      receiptRoot: parsed.args.receiptRoot,
      payer: parsed.args.payer,
      amount: (parsed.args.amount as bigint).toString(),
      timestamp: Number(parsed.args.timestamp),
    } : null,
    payerBalanceDeltaEth: formatEther(bobAfter - bobBefore),
    closedAt: new Date().toISOString(),
  };
  writeFileSync(CLOSED, JSON.stringify(closed, null, 2));
  console.log(`refunded · ${refundTx.hash}`);
  console.log(`saved: ${CLOSED}`);
}

main().catch((err) => { console.error('FAIL:', err.message); process.exit(1); });
