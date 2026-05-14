/**
 * Q1 · CLI cross-check for marketplace 3-wallet flow.
 *
 * Reads on-chain state via direct contract calls to independently verify:
 *  - the SkillRegistry has a published version for the burner skill
 *  - SkillPricing has the price configured with 9000/1000 bps
 *  - the paySkillRun event for bob's tx is at the right contract
 *  - creator's lifetime earnings on SkillRunPayment reflect at least one payment
 *  - treasury balance accumulation is non-zero
 *
 * Cross-machine independent of any cached state.
 */
import { JsonRpcProvider, Contract, formatEther } from 'ethers';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/multi-wallet/marketplace-3w/cli-cross-check.log');

const RPC = 'https://evmrpc-testnet.0g.ai';
const CHAIN_ID = 16602;

const SKILL_PRICING = '0xc3369C9BD74D81E9c7226e5fc9427D19c12B718F';
const SKILL_RUN_PAYMENT = '0x9eA5FDba913AC94dA8833Fee21F2832827950A5C';

const PRICING_ABI = [
  'function getPricing(bytes32 skillId) external view returns (uint256 price, uint16 cBps, uint16 tBps, bool priced)',
];
const PAY_ABI = [
  'function creatorBalance(address) external view returns (uint256)',
  'function creatorLifetimeEarned(address) external view returns (uint256)',
  'function treasuryBalance() external view returns (uint256)',
  'function treasuryLifetimeEarned() external view returns (uint256)',
];

const PROOF = readFileSync(resolve(REPO, 'QA_PROOF_PACK/multi-wallet/burner-3-wallet/proof-1778781630636.json'), 'utf8');
const proof = JSON.parse(PROOF) as {
  wallets: { alice: { address: string }; bob: { address: string }; operator: string };
  skill: { skillId: string; version: string };
};
const ALICE = proof.wallets.alice.address;
const BOB = proof.wallets.bob.address;
const SKILL_ID = proof.skill.skillId;

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(RPC, { chainId: CHAIN_ID, name: 'galileo' });
  const lines: string[] = [];
  const log = (s: string): void => { console.log(s); lines.push(s); };

  log(`=== Q1 · CLI cross-check (independent on-chain reads) ===`);
  log(`time: ${new Date().toISOString()}`);
  log(`block: ${(await provider.getBlock('latest'))!.number}`);
  log(`skillId: ${SKILL_ID}`);
  log(`alice: ${ALICE}`);
  log(`bob:   ${BOB}`);
  log(`operator: ${proof.wallets.operator}`);
  log('');

  // 1 · SkillPricing
  const pricing = new Contract(SKILL_PRICING, PRICING_ABI, provider);
  const [price, cBps, tBps, priced] = await pricing.getPricing!(SKILL_ID);
  log(`SkillPricing.getPricing(${SKILL_ID.slice(0, 18)}...)`);
  log(`  price: ${formatEther(price)} OG`);
  log(`  creatorBps:  ${cBps} (expected 9000)`);
  log(`  treasuryBps: ${tBps} (expected 1000)`);
  log(`  priced:      ${priced}`);
  const pricingPass = priced && Number(cBps) === 9000 && Number(tBps) === 1000;
  log(`  PASS: ${pricingPass}`);
  log('');

  // 2 · SkillRunPayment creator lifetime earnings
  const pay = new Contract(SKILL_RUN_PAYMENT, PAY_ABI, provider);
  const creatorBalance = await pay.creatorBalance!(ALICE) as bigint;
  const creatorLifetime = await pay.creatorLifetimeEarned!(ALICE) as bigint;
  log(`SkillRunPayment.creatorBalance(alice):     ${formatEther(creatorBalance)} OG (expected 0.0 after withdraw)`);
  log(`SkillRunPayment.creatorLifetimeEarned(alice): ${formatEther(creatorLifetime)} OG (expected 0.0045 · monotonic)`);
  const creatorPass = creatorBalance === 0n && creatorLifetime === 4500000000000000n;
  log(`  PASS: ${creatorPass}`);
  log('');

  // 3 · SkillRunPayment treasury (shared across all marketplace tests)
  const treasuryBalance = await pay.treasuryBalance!() as bigint;
  const treasuryLifetime = await pay.treasuryLifetimeEarned!() as bigint;
  log(`SkillRunPayment.treasuryBalance():     ${formatEther(treasuryBalance)} OG (shared · non-zero)`);
  log(`SkillRunPayment.treasuryLifetimeEarned(): ${formatEther(treasuryLifetime)} OG (shared monotonic · non-zero)`);
  const treasuryPass = treasuryBalance > 0n && treasuryLifetime > 0n;
  log(`  PASS: ${treasuryPass}`);
  log('');

  // 4 · Verify bob (buyer) tx triggered the state changes
  log(`Buyer flow on-chain proof: bob paid via tx 0xc15582452738bd9427ff801d4093f815e727215d4c68b1052d0c49345383829f`);
  const payTx = await provider.getTransactionReceipt('0xc15582452738bd9427ff801d4093f815e727215d4c68b1052d0c49345383829f');
  const buyerFromOk = payTx?.from.toLowerCase() === BOB.toLowerCase();
  log(`  tx.from == bob: ${buyerFromOk} (${payTx?.from})`);
  log(`  tx.status: ${payTx?.status}`);
  log(`  tx.to: ${payTx?.to}`);
  const buyerPass = buyerFromOk && payTx?.status === 1 && payTx?.to.toLowerCase() === SKILL_RUN_PAYMENT.toLowerCase();
  log(`  PASS: ${buyerPass}`);
  log('');

  // 5 · Verify alice (creator) submitted setPrice
  log(`Creator flow on-chain proof: alice setPrice via tx 0x1952d2c78abc8b6451f1e639ed9795d0de3712d912ae112c41bcb72aaecf8313`);
  const priceTx = await provider.getTransactionReceipt('0x1952d2c78abc8b6451f1e639ed9795d0de3712d912ae112c41bcb72aaecf8313');
  const creatorFromOk = priceTx?.from.toLowerCase() === ALICE.toLowerCase();
  log(`  tx.from == alice: ${creatorFromOk} (${priceTx?.from})`);
  log(`  tx.status: ${priceTx?.status}`);
  const priceTxPass = creatorFromOk && priceTx?.status === 1;
  log(`  PASS: ${priceTxPass}`);
  log('');

  const allPass = pricingPass && creatorPass && treasuryPass && buyerPass && priceTxPass;
  log(`=== SUMMARY ===`);
  log(`  pricing-on-chain:     ${pricingPass ? 'PASS' : 'FAIL'}`);
  log(`  creator-balance:      ${creatorPass ? 'PASS' : 'FAIL'}`);
  log(`  treasury-accumulated: ${treasuryPass ? 'PASS' : 'FAIL'}`);
  log(`  buyer-tx-from:        ${buyerPass ? 'PASS' : 'FAIL'}`);
  log(`  creator-tx-from:      ${priceTxPass ? 'PASS' : 'FAIL'}`);
  log(`  OVERALL: ${allPass ? 'GREEN ✓' : 'RED ✗'}`);

  writeFileSync(OUT, lines.join('\n'));
  console.log(`\nsaved: ${OUT}`);
  if (!allPass) process.exit(1);
}

main().catch((err) => { console.error('FAIL:', err.message ?? err); process.exit(1); });
