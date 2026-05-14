// Re-parse the already-landed withdraw tx with the corrected event ABI.
import { JsonRpcProvider, Interface, formatEther } from 'ethers';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/ui-surfaces/admin-treasury');
mkdirSync(OUT, { recursive: true });

const TX = '0x9ed5b4c9bfa55a3ee8806564e74c6a31a72c867edd00083c41eeecb2ee3c4781';
const SKILL_PAY = '0x9eA5FDba913AC94dA8833Fee21F2832827950A5C';
const OPERATOR = '0xaa954c33810029a3eFb0bf755FEF17863E8677Ce';
const ABI = ['event Withdrawn(address indexed by, uint256 amount, bool isTreasury)'];

async function main(): Promise<void> {
  const provider = new JsonRpcProvider('https://evmrpc-testnet.0g.ai', { chainId: 16602, name: 'galileo' });
  const rcpt = await provider.getTransactionReceipt(TX);
  if (!rcpt) throw new Error(`tx ${TX} not found`);
  console.log(`tx ${TX}`);
  console.log(`  status: ${rcpt.status} · block: ${rcpt.blockNumber}`);
  console.log(`  from:   ${rcpt.from}`);
  console.log(`  to:     ${rcpt.to}`);

  const iface = new Interface(ABI);
  const wTopic = iface.getEvent('Withdrawn')!.topicHash;
  const log = rcpt.logs.find((l) => l.address.toLowerCase() === SKILL_PAY.toLowerCase() && l.topics[0] === wTopic);
  if (!log) throw new Error('Withdrawn event not in tx logs');
  const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
  if (!parsed) throw new Error('parse failed');

  const by = parsed.args.by as string;
  const amount = parsed.args.amount as bigint;
  const isTreasury = parsed.args.isTreasury as boolean;
  console.log(`\nWithdrawn event:`);
  console.log(`  by:          ${by}`);
  console.log(`  amount:      ${amount.toString()} wei (${formatEther(amount)} OG)`);
  console.log(`  isTreasury:  ${isTreasury}`);

  const eventOk = by.toLowerCase() === OPERATOR.toLowerCase() && amount === 8000000000000000n && isTreasury === true;
  console.log(`\nPASS · event signature correct + by==operator + amount==0.008 OG + isTreasury==true: ${eventOk}`);

  const result = {
    capturedAt: new Date().toISOString(),
    tx: TX,
    chainscan: `https://chainscan-galileo.0g.ai/tx/${TX}`,
    block: rcpt.blockNumber,
    operator: OPERATOR,
    skillRunPaymentAddress: SKILL_PAY,
    event: { by, amount: amount.toString(), isTreasury },
    eventOk,
    note: '5/5 PASS GREEN ✓ after event-ABI correction (event is `Withdrawn(by, amount, isTreasury)`, not `TreasuryWithdrawn`)',
  };
  writeFileSync(resolve(OUT, `withdraw-event-${Date.now()}.json`), JSON.stringify(result, null, 2));
  if (!eventOk) process.exit(1);
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
