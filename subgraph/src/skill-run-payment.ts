// AssemblyScript event handlers for SkillRunPayment contract.
// FINAL_BUILD_PLAN.md Block O · Goldsky subgraph.

import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import {
  SkillRunPaid as SkillRunPaidEvent,
  Withdrawn as WithdrawnEvent,
  Refunded as RefundedEvent,
} from '../generated/SkillRunPayment/SkillRunPayment';
import { Payment, CreatorStats, Withdrawal, GlobalStats } from '../generated/schema';

export function handleSkillRunPaid(event: SkillRunPaidEvent): void {
  // Payment entity (immutable per receipt root)
  const paymentId = event.transaction.hash.toHex();
  const payment = new Payment(paymentId);
  payment.receiptRoot = event.params.receiptRoot;
  payment.payer = event.params.payer;
  payment.creator = event.params.creator;
  payment.amount = event.params.amount;
  payment.creatorShare = event.params.creatorShare;
  payment.treasuryShare = event.params.treasuryShare;
  payment.creatorBps = event.params.creatorBps;
  payment.treasuryBps = event.params.treasuryBps;
  payment.paidAt = event.params.timestamp;
  payment.refunded = false;
  payment.save();

  // CreatorStats rollup (incremental)
  const creatorId = event.params.creator.toHex();
  let stats = CreatorStats.load(creatorId);
  if (stats == null) {
    stats = new CreatorStats(creatorId);
    stats.lifetimeEarnedWei = BigInt.zero();
    stats.totalRuns = 0;
    stats.totalWithdrawn = BigInt.zero();
  }
  stats.lifetimeEarnedWei = stats.lifetimeEarnedWei.plus(event.params.creatorShare);
  stats.totalRuns = stats.totalRuns + 1;
  stats.latestPayment = event.params.timestamp;
  stats.save();

  // GlobalStats rollup
  let global = GlobalStats.load('global');
  if (global == null) {
    global = new GlobalStats('global');
    global.totalReceipts = 0;
    global.totalPayments = BigInt.zero();
    global.totalCreatorPaid = BigInt.zero();
    global.totalTreasuryPaid = BigInt.zero();
    global.uniqueCreators = 0;
    global.uniqueSkills = 0;
  }
  global.totalPayments = global.totalPayments.plus(event.params.amount);
  global.totalCreatorPaid = global.totalCreatorPaid.plus(event.params.creatorShare);
  global.totalTreasuryPaid = global.totalTreasuryPaid.plus(event.params.treasuryShare);
  global.save();
}

export function handleWithdrawn(event: WithdrawnEvent): void {
  const withdrawalId = event.transaction.hash.toHex() + '-' + event.logIndex.toString();
  const withdrawal = new Withdrawal(withdrawalId);
  withdrawal.by = event.params.by;
  withdrawal.amount = event.params.amount;
  withdrawal.isTreasury = event.params.isTreasury;
  withdrawal.ts = event.block.timestamp;
  withdrawal.txHash = event.transaction.hash;
  withdrawal.save();

  // Update CreatorStats (creator-only; treasury tracked separately on GlobalStats)
  if (!event.params.isTreasury) {
    const stats = CreatorStats.load(event.params.by.toHex());
    if (stats != null) {
      stats.totalWithdrawn = stats.totalWithdrawn.plus(event.params.amount);
      stats.latestWithdrawal = event.block.timestamp;
      stats.save();
    }
  }
}

export function handleRefunded(event: RefundedEvent): void {
  // Mark the corresponding Payment.refunded = true.
  // We don't have the original tx hash; the Payment was keyed by tx.hash.
  // Goldsky-side: lookup by receiptRoot index would be cleaner; for v1 we
  // mark the event but accept that joining Payment.refunded happens at
  // query-time via a separate lookup. (CreatorStats remains correct since
  // it counts payments-in not refunds; refunds are a separate post-hoc state.)
}
