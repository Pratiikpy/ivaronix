/**
 * Pull the receiptRoot + paidAt + creator + amount from a recent
 * paySkillRun tx, save to QA_PROOF_PACK/testnet/burner-gaps/refund-pending.json
 * so a future cron iteration can call refundFailedRun(receiptRoot) once
 * the 24h timelock has elapsed.
 */
import { JsonRpcProvider, Interface } from 'ethers';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/burner-gaps');
mkdirSync(OUT, { recursive: true });

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
const RPC = env.IVARONIX_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const PAY_TX = process.argv[2] ?? '0x3f82ca95e01c56ba91b63027da8d0fcb218fc95feb8a21dcd7e211deb8d73ded';
const SKILL_PAY = '0x9eA5FDba913AC94dA8833Fee21F2832827950A5C';

const PAY_ABI = [
  'event SkillRunPaid(bytes32 indexed receiptRoot, address indexed payer, address indexed creator, uint256 amount, uint256 creatorShare, uint256 treasuryShare, uint16 creatorBps, uint16 treasuryBps, uint64 timestamp)',
];

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(RPC, { chainId: 16602, name: 'galileo' });
  const rcpt = await provider.getTransactionReceipt(PAY_TX);
  if (!rcpt) throw new Error(`tx ${PAY_TX} not found`);
  if (rcpt.status !== 1) throw new Error(`tx ${PAY_TX} reverted`);

  const iface = new Interface(PAY_ABI);
  const paidTopic = iface.getEvent('SkillRunPaid')!.topicHash;

  const log = rcpt.logs.find(
    (l) => l.address.toLowerCase() === SKILL_PAY.toLowerCase() && l.topics[0] === paidTopic
  );
  if (!log) throw new Error('SkillRunPaid event not in tx logs');

  const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
  if (!parsed) throw new Error('failed to parse event');

  const receiptRoot = parsed.args.receiptRoot as string;
  const payer = parsed.args.payer as string;
  const creator = parsed.args.creator as string;
  const amount = parsed.args.amount as bigint;
  const paidAt = Number(parsed.args.timestamp);
  const unlockAt = paidAt + 24 * 3600;
  const unlockIso = new Date(unlockAt * 1000).toISOString();

  console.log(`paySkillRun tx: ${PAY_TX}`);
  console.log(`  receiptRoot:  ${receiptRoot}`);
  console.log(`  payer:        ${payer}`);
  console.log(`  creator:      ${creator}`);
  console.log(`  amount:       ${amount.toString()} wei`);
  console.log(`  paidAt:       ${paidAt} (${new Date(paidAt * 1000).toISOString()})`);
  console.log(`  unlockAt:     ${unlockAt} (${unlockIso})`);

  const refundPending = {
    capturedAt: new Date().toISOString(),
    network: 'galileo',
    chainId: 16602,
    skillPaymentAddress: SKILL_PAY,
    paySkillRunTx: PAY_TX,
    receiptRoot,
    payer,
    creator,
    amount: amount.toString(),
    paidAt,
    paidAtIso: new Date(paidAt * 1000).toISOString(),
    unlockAt,
    unlockAtIso: unlockIso,
    note: 'Phase-1 (pay) complete on-chain. Phase-2 (refund) is gated by SkillRunPayment.REFUND_TIMELOCK=24h. The cron should retry refundFailedRun(receiptRoot) after unlockAt elapses. Foundry test_A20_Refund_HappyPath_AfterTimelock proves the logic; this entry queues the real on-chain refund half.',
  };
  const outPath = resolve(OUT, 'refund-pending.json');
  writeFileSync(outPath, JSON.stringify(refundPending, null, 2));
  console.log(`\nsaved: ${outPath}`);
}

main().catch((err) => { console.error('FAIL:', err); process.exit(1); });
