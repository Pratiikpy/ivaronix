// AssemblyScript event handlers for ReceiptRegistryV3 contract.
// FINAL_BUILD_PLAN.md Block O · Goldsky subgraph.
//
// ReceiptRegistry V3 admits receipt-type slots 10-12 (doc_room_create,
// doc_room_read, memory_consolidation). The V1/V2 contracts emit the
// same event signature, so this handler covers all three versions when
// added to the subgraph manifest later.

import { BigInt } from '@graphprotocol/graph-ts';
import { ReceiptAnchored as ReceiptAnchoredEvent } from '../generated/ReceiptRegistryV3/ReceiptRegistry';
import { Receipt, GlobalStats } from '../generated/schema';

export function handleReceiptAnchored(event: ReceiptAnchoredEvent): void {
  // Receipt entity keyed by receiptRoot (canonical identifier across
  // V1/V2/V3 registries). Each anchor emits one entity; tampered
  // anchors are rejected upstream by the contract's EIP-712 recovery
  // so we don't re-check here.
  const receiptId = event.params.receiptRoot.toHex();
  const receipt = new Receipt(receiptId);
  receipt.agent = event.params.agentAddress;
  receipt.receiptType = event.params.receiptType;
  receipt.anchoredAt = event.params.timestamp;
  receipt.txHash = event.transaction.hash;
  receipt.registryVersion = 'V3';
  receipt.onChainId = event.params.id;
  receipt.save();

  // GlobalStats rollup — totalReceipts is the headline number on the
  // home page + thesis route. Subgraph reads stay fast even as the
  // receipt count grows past 10k.
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
  global.totalReceipts = global.totalReceipts + 1;
  global.save();
}
