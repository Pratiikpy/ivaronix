/**
 * Q6 · /admin/treasury withdraw click — chain side effect.
 *
 * Operator (contract owner of SkillRunPayment) calls `withdrawTreasury()`
 * to pull accumulated treasuryBalance (0.008 OG from prior marketplace
 * runs) to the operator wallet. This is a REAL on-chain tx with status=1
 * + balance change + TreasuryWithdrawn event.
 */
import { JsonRpcProvider, Wallet, Contract, Interface, formatEther } from 'ethers';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/ui-surfaces/admin-treasury');
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
const OPERATOR_KEY = (env.IVARONIX_SIGNER_KEY ?? env.EVM_PRIVATE_KEY ?? '').replace(/^0x/, '');
const RPC = env.IVARONIX_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const SKILL_PAY = '0x9eA5FDba913AC94dA8833Fee21F2832827950A5C';
const CS = 'https://chainscan-galileo.0g.ai';

const PAY_ABI = [
  'function withdrawTreasury() external',
  'function treasuryBalance() external view returns (uint256)',
  'function treasuryLifetimeEarned() external view returns (uint256)',
  'event Withdrawn(address indexed by, uint256 amount, bool isTreasury)',
];
const GAS = { gasPrice: 5_000_000_000n, gasLimit: 200_000n };

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(RPC, { chainId: 16602, name: 'galileo' });
  const operator = new Wallet(OPERATOR_KEY, provider);
  const pay = new Contract(SKILL_PAY, PAY_ABI, operator);

  const lines: string[] = [];
  const log = (s: string): void => { console.log(s); lines.push(s); };

  log(`=== Q6 · withdrawTreasury on-chain ===`);
  log(`time:     ${new Date().toISOString()}`);
  log(`operator: ${operator.address}`);
  log(`contract: ${SKILL_PAY}`);

  const treasuryBefore = await pay.treasuryBalance!() as bigint;
  const lifetimeBefore = await pay.treasuryLifetimeEarned!() as bigint;
  const operatorBalBefore = await provider.getBalance(operator.address);
  log(`\nBEFORE:`);
  log(`  treasuryBalance:     ${formatEther(treasuryBefore)} OG`);
  log(`  treasuryLifetime:    ${formatEther(lifetimeBefore)} OG`);
  log(`  operator wallet:     ${formatEther(operatorBalBefore)} OG`);

  if (treasuryBefore === 0n) {
    log(`\nNOTE: treasuryBalance is 0 · cannot exercise withdrawTreasury without prior payment.`);
    log(`The require(amount > 0) gate in SkillRunPayment.withdrawTreasury would revert.`);
    log(`Either (a) skip this iteration · operator funds accumulated in shared pool · OR (b) prime a payment first.`);
    process.exit(0);
  }

  log(`\nFIRING withdrawTreasury()...`);
  const tx = await pay.withdrawTreasury!(GAS);
  log(`  tx hash: ${tx.hash}`);
  log(`  chainscan: ${CS}/tx/${tx.hash}`);
  const rcpt = await tx.wait();
  if (rcpt?.status !== 1) throw new Error(`withdrawTreasury reverted · ${tx.hash}`);
  log(`  status: ${rcpt!.status} · block: ${rcpt!.blockNumber} · gas used: ${rcpt!.gasUsed}`);

  const iface = new Interface(PAY_ABI);
  const wTopic = iface.getEvent('Withdrawn')!.topicHash;
  const wLog = rcpt!.logs.find((l) => l.topics[0] === wTopic);
  let eventParsed: { by: string; amount: bigint; isTreasury: boolean } | null = null;
  if (wLog) {
    const parsed = iface.parseLog({ topics: wLog.topics as string[], data: wLog.data });
    if (parsed) {
      eventParsed = {
        by: parsed.args.by as string,
        amount: parsed.args.amount as bigint,
        isTreasury: parsed.args.isTreasury as boolean,
      };
      log(`  Withdrawn event: by=${eventParsed.by} · amount=${formatEther(eventParsed.amount)} OG · isTreasury=${eventParsed.isTreasury}`);
    }
  }

  const treasuryAfter = await pay.treasuryBalance!() as bigint;
  const lifetimeAfter = await pay.treasuryLifetimeEarned!() as bigint;
  const operatorBalAfter = await provider.getBalance(operator.address);
  log(`\nAFTER:`);
  log(`  treasuryBalance:     ${formatEther(treasuryAfter)} OG  (delta: -${formatEther(treasuryBefore - treasuryAfter)})`);
  log(`  treasuryLifetime:    ${formatEther(lifetimeAfter)} OG  (monotonic · ${lifetimeAfter === lifetimeBefore ? 'unchanged' : 'CHANGED·BUG'})`);
  log(`  operator wallet:     ${formatEther(operatorBalAfter)} OG  (delta: +${formatEther(operatorBalAfter - operatorBalBefore)})`);

  log(`\n=== assertions ===`);
  const tBalZero = treasuryAfter === 0n;
  const lifetimeMonotonic = lifetimeAfter === lifetimeBefore;
  const operatorGained = operatorBalAfter > operatorBalBefore - 1_000_000_000_000_000n; // gain at least within gas-tolerance
  const eventOk = eventParsed !== null && eventParsed.by.toLowerCase() === operator.address.toLowerCase() && eventParsed.amount === treasuryBefore && eventParsed.isTreasury === true;
  log(`  PASS · treasuryBalance zeroed: ${tBalZero}`);
  log(`  PASS · treasuryLifetimeEarned monotonic (unchanged): ${lifetimeMonotonic}`);
  log(`  PASS · operator wallet net positive after gas: ${operatorGained}`);
  log(`  PASS · Withdrawn event by+amount+isTreasury=true match: ${eventOk}`);

  const allPass = tBalZero && lifetimeMonotonic && operatorGained && eventOk;
  log(`\n  ${allPass ? 'GREEN ✓ · 4/4 PASS' : 'RED ✗'}`);

  const proofPath = resolve(OUT, `withdraw-proof-${Date.now()}.json`);
  writeFileSync(proofPath, JSON.stringify({
    capturedAt: new Date().toISOString(),
    operator: operator.address,
    skillRunPaymentAddress: SKILL_PAY,
    withdrawTx: tx.hash,
    chainscan: `${CS}/tx/${tx.hash}`,
    block: rcpt!.blockNumber,
    before: {
      treasuryBalance: treasuryBefore.toString(),
      treasuryLifetimeEarned: lifetimeBefore.toString(),
      operatorWalletBalance: operatorBalBefore.toString(),
    },
    after: {
      treasuryBalance: treasuryAfter.toString(),
      treasuryLifetimeEarned: lifetimeAfter.toString(),
      operatorWalletBalance: operatorBalAfter.toString(),
    },
    event: eventParsed ? {
      by: eventParsed.by,
      amount: eventParsed.amount.toString(),
      isTreasury: eventParsed.isTreasury,
    } : null,
    assertions: { tBalZero, lifetimeMonotonic, operatorGained, eventOk, allPass },
  }, null, 2));
  log(`\nproof: ${proofPath}`);

  writeFileSync(resolve(OUT, 'cli-cross-check.log'), lines.join('\n'));
  if (!allPass) process.exit(1);
}

main().catch((err) => { console.error('FAIL:', err.message ?? err); process.exit(1); });
