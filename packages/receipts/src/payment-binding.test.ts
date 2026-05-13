/**
 * FINAL_BUILD_PLAN.md Block B · 5-check payment-tx binding verifier tests.
 *
 * Uses mocked ethers Provider (`getTransaction` + `getTransactionReceipt`)
 * to validate every sub-check WITHOUT live RPC calls. The binding logic
 * lives in verify.ts; this suite covers:
 *
 *   1. paymentContract not in KNOWN_PAYMENT_CONTRACTS → fail
 *   2. tx not found → fail
 *   3. tx.to != paymentContract → fail
 *   4. tx.from != payer → fail
 *   5. tx.value != paidOg → fail
 *   6. tx receipt has no SkillRunPaid event → fail
 *   7. event receiptRoot != receipt.storage.receiptRoot → fail
 *   8. all 5 sub-checks pass → PASS
 *   9. no payment block (legacy receipt) → PASS (n/a)
 *
 * Plus the verifyAnchoredAndPaid wrapper state transitions.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import type { ReceiptV1 } from './schema.js';
import { verifyPaymentBinding, verifyAnchoredAndPaid } from './verify.js';

const KNOWN_PAYMENT_TESTNET = '0x9eA5FDba913AC94dA8833Fee21F2832827950A5C';
const PAYER = '0x0000000000000000000000000000000000001234';
const CREATOR = '0x0000000000000000000000000000000000005678';
const RECEIPT_ROOT = '0x' + 'a'.repeat(64);
const TX_HASH = '0x' + 'b'.repeat(64);
const PAID_OG = '1000000000000000000'; // 1 OG in wei
const CREATOR_PAID = '900000000000000000';
const TREASURY_PAID = '100000000000000000';

const EVENT_INTERFACE = new Interface([
  'event SkillRunPaid(bytes32 indexed receiptRoot, address indexed payer, address indexed creator, uint256 amount, uint256 creatorShare, uint256 treasuryShare, uint16 creatorBps, uint16 treasuryBps, uint64 timestamp)',
]);

function buildReceipt(overrides: Partial<ReceiptV1['billing']['payment']> = {}): ReceiptV1 {
  return {
    id: 'rcpt_TEST',
    version: '1.0',
    createdAt: 1_700_000_000,
    createdBy: 'ivaronix-runtime/test',
    type: 'doc_ask',
    agent: {
      passportId: 'did:0g:passport:0x0:1',
      ownerWallet: '0x0000000000000000000000000000000000000001',
      trustScore: 0,
      signedBy: 'operator',
    },
    request: {
      skillId: 'test',
      skillVersion: '1.0',
      promptHash: 'sha256:' + 'c'.repeat(64),
      inputArtifacts: [],
      policyDecision: { approvalChain: [] },
    },
    execution: {
      mode: 'inference',
      burnMode: false,
      consensusMode: false,
      modelSelection: { requested: 'x', final: 'x' },
      providerRouting: {
        allowFallbacks: false,
        finalProvider: '0x0000000000000000000000000000000000000099',
      },
    },
    teeVerification: {
      requested: false,
      routerVerified: false,
      independentVerified: null,
      verificationMethod: 'router_flag',
      verifiedAt: null,
    },
    billing: {
      inputTokens: 10,
      outputTokens: 20,
      inputCostNeuron: '0',
      outputCostNeuron: '0',
      totalCostNeuron: '0',
      totalCostOg: '0',
      payment: {
        txHash: TX_HASH,
        paymentContract: KNOWN_PAYMENT_TESTNET,
        payer: PAYER,
        paidOg: PAID_OG,
        creatorPaidOg: CREATOR_PAID,
        treasuryPaidOg: TREASURY_PAID,
        creator: CREATOR,
        creatorBps: 9000,
        treasuryBps: 1000,
        paidAt: 1_700_000_000,
        subsidised: false,
        refunded: false,
        draftReceiptRoot: RECEIPT_ROOT,
        ...overrides,
      },
    },
    storage: {
      receiptRoot: RECEIPT_ROOT,
      proofDownloadVerified: false,
      encryption: { enabled: false, type: 'none' as const },
    },
    chainAnchor: {
      network: 'testnet' as const,
      chainId: 16602,
      rpcUrlHash: 'sha256:' + 'd'.repeat(64),
      registryAddress: '0xf675d4183b34fe8d1981FA9c117065aAcff690ab',
      status: 'anchored' as const,
      onChainId: '1',
      anchorTxHash: '0x' + 'e'.repeat(64),
      anchorBlockNumber: 1,
      anchorTimestamp: 1_700_000_000,
    },
    outputs: {
      outputHash: 'sha256:' + 'f'.repeat(64),
      citations: [],
    },
    signature: {
      method: 'eth_personal_sign',
      signer: '0x0000000000000000000000000000000000000001',
      signature: '0x' + '1'.repeat(130),
    },
  } as unknown as ReceiptV1;
}

function encodeSkillRunPaidLog(opts: {
  receiptRoot?: string;
  payer?: string;
  creator?: string;
  amount?: string;
  emitter?: string;
}): { address: string; topics: string[]; data: string } {
  const fragment = EVENT_INTERFACE.getEvent('SkillRunPaid')!;
  const topic = fragment.topicHash;
  const padTopic = (addrOrHash: string) => {
    if (addrOrHash.length === 66) return addrOrHash; // already 32-byte
    return '0x' + addrOrHash.slice(2).padStart(64, '0');
  };
  return {
    address: opts.emitter ?? KNOWN_PAYMENT_TESTNET,
    topics: [
      topic,
      padTopic(opts.receiptRoot ?? RECEIPT_ROOT),
      padTopic(opts.payer ?? PAYER),
      padTopic(opts.creator ?? CREATOR),
    ],
    data: EVENT_INTERFACE.encodeEventLog('SkillRunPaid', [
      opts.receiptRoot ?? RECEIPT_ROOT,
      opts.payer ?? PAYER,
      opts.creator ?? CREATOR,
      BigInt(opts.amount ?? PAID_OG),
      BigInt(CREATOR_PAID),
      BigInt(TREASURY_PAID),
      9000,
      1000,
      1_700_000_000,
    ]).data,
  };
}

function makeMockProvider(opts: {
  txExists?: boolean;
  txTo?: string;
  txFrom?: string;
  txValue?: string;
  receiptExists?: boolean;
  logs?: Array<{ address: string; topics: string[]; data: string }>;
}): any {
  return {
    async getTransaction(_hash: string) {
      if (!opts.txExists) return null;
      return {
        to: opts.txTo ?? KNOWN_PAYMENT_TESTNET,
        from: opts.txFrom ?? PAYER,
        value: BigInt(opts.txValue ?? PAID_OG),
      };
    },
    async getTransactionReceipt(_hash: string) {
      if (!opts.receiptExists) return null;
      return {
        logs: opts.logs ?? [encodeSkillRunPaidLog({})],
      };
    },
  };
}

// ────────────────────────────────────────────────────────────────────────

test('B1 · paymentContract not in KNOWN_PAYMENT_CONTRACTS fails', async () => {
  const receipt = buildReceipt({
    paymentContract: '0x0000000000000000000000000000000000000999' as `0x${string}`,
  });
  const result = await verifyPaymentBinding(receipt, makeMockProvider({ txExists: true, receiptExists: true }));
  assert.equal(result.pass, false);
  assert.match(result.detail ?? '', /KNOWN_PAYMENT_CONTRACTS/);
});

test('B2 · tx not found fails', async () => {
  const receipt = buildReceipt();
  const result = await verifyPaymentBinding(receipt, makeMockProvider({ txExists: false }));
  assert.equal(result.pass, false);
  assert.match(result.detail ?? '', /not found/);
});

test('B3 · tx.to mismatch fails', async () => {
  const receipt = buildReceipt();
  const result = await verifyPaymentBinding(
    receipt,
    makeMockProvider({ txExists: true, txTo: '0x0000000000000000000000000000000000000aaa', receiptExists: true }),
  );
  assert.equal(result.pass, false);
  assert.match(result.detail ?? '', /tx\.to/);
});

test('B4 · tx.from mismatch fails', async () => {
  const receipt = buildReceipt();
  const result = await verifyPaymentBinding(
    receipt,
    makeMockProvider({ txExists: true, txFrom: '0x0000000000000000000000000000000000000bbb', receiptExists: true }),
  );
  assert.equal(result.pass, false);
  assert.match(result.detail ?? '', /tx\.from/);
});

test('B5 · tx.value mismatch fails', async () => {
  const receipt = buildReceipt();
  const result = await verifyPaymentBinding(
    receipt,
    makeMockProvider({ txExists: true, txValue: '500000000000000000', receiptExists: true }),
  );
  assert.equal(result.pass, false);
  assert.match(result.detail ?? '', /tx\.value/);
});

test('B6 · tx receipt missing fails', async () => {
  const receipt = buildReceipt();
  const result = await verifyPaymentBinding(
    receipt,
    makeMockProvider({ txExists: true, receiptExists: false }),
  );
  assert.equal(result.pass, false);
  assert.match(result.detail ?? '', /tx receipt/);
});

test('B7 · no SkillRunPaid event in logs fails', async () => {
  const receipt = buildReceipt();
  const result = await verifyPaymentBinding(
    receipt,
    makeMockProvider({ txExists: true, receiptExists: true, logs: [] }),
  );
  assert.equal(result.pass, false);
  assert.match(result.detail ?? '', /no SkillRunPaid event/);
});

test('B8 · event receiptRoot mismatch fails', async () => {
  const receipt = buildReceipt();
  const wrongRoot = '0x' + 'd'.repeat(64);
  const result = await verifyPaymentBinding(
    receipt,
    makeMockProvider({
      txExists: true,
      receiptExists: true,
      logs: [encodeSkillRunPaidLog({ receiptRoot: wrongRoot })],
    }),
  );
  assert.equal(result.pass, false);
  assert.match(result.detail ?? '', /receiptRoot/);
});

test('B9 · all 5 sub-checks pass returns pass=true', async () => {
  const receipt = buildReceipt();
  const result = await verifyPaymentBinding(receipt, makeMockProvider({ txExists: true, receiptExists: true }));
  assert.equal(result.pass, true);
  assert.match(result.detail ?? '', /5\/5/);
});

test('B10 · no payment block returns pass=true (legacy/free receipt)', async () => {
  const receipt = buildReceipt();
  // Strip payment block to simulate a legacy receipt (pre-Block-B).
  const billing = receipt.billing as { payment?: unknown };
  delete billing.payment;
  const result = await verifyPaymentBinding(receipt, makeMockProvider({ txExists: false }));
  assert.equal(result.pass, true);
  assert.match(result.detail ?? '', /no payment block/);
});

test('B11 · verifyAnchoredAndPaid returns PAID on pass', async () => {
  const receipt = buildReceipt();
  const r = await verifyAnchoredAndPaid(receipt, makeMockProvider({ txExists: true, receiptExists: true }));
  assert.equal(r.state, 'PAID');
  assert.equal(r.paymentCheck.pass, true);
});

test('B12 · verifyAnchoredAndPaid returns ANCHORED on fail', async () => {
  const receipt = buildReceipt();
  const r = await verifyAnchoredAndPaid(receipt, makeMockProvider({ txExists: false }));
  assert.equal(r.state, 'ANCHORED');
  assert.equal(r.paymentCheck.pass, false);
});
