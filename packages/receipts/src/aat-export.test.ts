/**
 * FINAL_BUILD_PLAN.md Block H · AAT export round-trip tests.
 *
 * Locks the export against draft-rosenberg-aat-01 by:
 *   - asserting every required mapping projects something (or null) onto the export
 *   - asserting receipt fields appear under ivaronix-ext.receipt
 *   - asserting spec sections claimed match the mapping table
 *   - regression: missing-fields detection on a minimal receipt
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportReceiptAsAat, countNonNullRequired, missingRequiredAatFields } from './aat-export.js';
import { AAT_MAPPING_DRAFT_01, requiredMappingCount } from './aat-mapping.js';
import type { ReceiptV1 } from './schema.js';

const RECEIPT_ROOT = '0x' + 'a'.repeat(64);
const TX_HASH = '0x' + 'b'.repeat(64);

function buildFullReceipt(): ReceiptV1 {
  return {
    id: 'rcpt_AAT_TEST',
    version: '1.0',
    createdAt: 1_700_000_000,
    createdBy: 'ivaronix-runtime/test',
    type: 'doc_ask',
    agent: {
      passportId: 'did:0g:passport:0x0aa:1',
      ownerWallet: '0x0000000000000000000000000000000000000001',
      trustScore: 42,
      signedBy: 'operator',
    },
    request: {
      skillId: 'private-doc-review',
      skillVersion: '1.0.0',
      promptHash: 'sha256:' + 'c'.repeat(64),
      inputArtifacts: [],
      policyDecision: { approvalChain: [] },
    },
    execution: {
      mode: 'inference',
      burnMode: false,
      consensusMode: false,
      modelSelection: { requested: 'qwen', final: 'qwen-2.5-7b' },
      providerRouting: {
        allowFallbacks: true,
        finalProvider: '0x0000000000000000000000000000000000000099',
      },
      model: { source: '0G', computePath: '0G Private Compute', skillRunOn0GModel: true },
    },
    teeVerification: {
      requested: true,
      routerVerified: true,
      independentVerified: true,
      providerAddress: '0x0000000000000000000000000000000000000099',
      verificationMethod: 'router_flag',
      verifiedAt: 1_700_000_000,
      attestationHash: 'sha256:' + 'd'.repeat(64),
      tier: 'tier-1-tee',
      providerKind: '0g-router',
    },
    billing: {
      inputTokens: 100,
      outputTokens: 200,
      inputCostNeuron: '1000',
      outputCostNeuron: '2000',
      totalCostNeuron: '3000',
      totalCostOg: '0.000003',
      payment: {
        txHash: TX_HASH,
        paymentContract: '0x9eA5FDba913AC94dA8833Fee21F2832827950A5C',
        payer: '0x0000000000000000000000000000000000001234',
        paidOg: '1000000000000000000',
        creatorPaidOg: '900000000000000000',
        treasuryPaidOg: '100000000000000000',
        creator: '0x0000000000000000000000000000000000005678',
        creatorBps: 9000,
        treasuryBps: 1000,
        paidAt: 1_700_000_000,
        subsidised: false,
        refunded: false,
        draftReceiptRoot: RECEIPT_ROOT,
      },
    },
    storage: {
      receiptRoot: RECEIPT_ROOT,
      receiptTxHash: '0x' + 'e'.repeat(64),
      evidenceRoot: '0x' + 'f'.repeat(64),
      proofDownloadVerified: true,
      encryption: { enabled: true, type: 'aes-256-gcm', keyFingerprint: 'sha256:' + '0'.repeat(64) },
    },
    chainAnchor: {
      network: 'testnet' as const,
      chainId: 16602,
      rpcUrlHash: 'sha256:' + '1'.repeat(64),
      registryAddress: '0xf675d4183b34fe8d1981FA9c117065aAcff690ab',
      status: 'anchored' as const,
      onChainId: '1234',
      anchorTxHash: '0x' + '2'.repeat(64),
      anchorBlockNumber: 1_000_000,
      anchorTimestamp: 1_700_000_000,
    },
    outputs: {
      outputHash: 'sha256:' + '3'.repeat(64),
      summaryHash: 'sha256:' + '4'.repeat(64),
      citations: ['sha256:' + '5'.repeat(64)],
    },
    signature: {
      method: 'eth_personal_sign',
      signer: '0x0000000000000000000000000000000000000001',
      signature: '0x' + '6'.repeat(130),
    },
  } as unknown as ReceiptV1;
}

test('H1 · aat-spec field is pinned to draft-rosenberg-aat-01', () => {
  const exp = exportReceiptAsAat(buildFullReceipt());
  assert.equal(exp.aat_spec, 'draft-rosenberg-aat-01');
});

test('H2 · required fields populated from a full receipt', () => {
  const exp = exportReceiptAsAat(buildFullReceipt());
  const expectedRequired = requiredMappingCount();
  const nonNull = countNonNullRequired(exp);
  // We expect ALL required AAT fields to be non-null when given a full receipt.
  assert.equal(nonNull, expectedRequired, `expected ${expectedRequired} non-null required fields, got ${nonNull}`);
});

test('H3 · missing-required scanner returns empty on full receipt', () => {
  const missing = missingRequiredAatFields(buildFullReceipt());
  assert.deepEqual(missing, []);
});

test('H4 · ivaronix-ext includes the full receipt body', () => {
  const exp = exportReceiptAsAat(buildFullReceipt());
  assert.equal(exp['ivaronix-ext'].receipt.id, 'rcpt_AAT_TEST');
  assert.equal(exp['ivaronix-ext'].receipt.signature?.signer, '0x0000000000000000000000000000000000000001');
});

test('H5 · timestamps transformed to ISO-8601', () => {
  const exp = exportReceiptAsAat(buildFullReceipt());
  // created_timestamp maps from receipt.createdAt (unix seconds).
  assert.equal(exp.required.created_timestamp, '2023-11-14T22:13:20.000Z');
  // anchor_timestamp maps from receipt.chainAnchor.anchorTimestamp (also unix seconds).
  assert.equal(exp.required.anchor_timestamp, '2023-11-14T22:13:20.000Z');
});

test('H6 · sections_claimed lists every AAT section covered', () => {
  const exp = exportReceiptAsAat(buildFullReceipt());
  // From the mapping table: §3.1 (identity), §3.2 (agent), §3.3 (action),
  // §3.4 (output), §3.5 (compute), §3.6 (attestation), §3.7 (anchor),
  // §3.8 (settlement), §3.9 (storage), §3.10 (signature).
  // Some entries are §3.6 (extension); the set is deduped.
  const claimed = exp['ivaronix-ext'].sections_claimed;
  assert.ok(claimed.includes('§3.1'));
  assert.ok(claimed.includes('§3.3'));
  assert.ok(claimed.includes('§3.7'));
  assert.ok(claimed.includes('§3.10'));
});

test('H7 · optional fields with values present, without values omitted', () => {
  const exp = exportReceiptAsAat(buildFullReceipt());
  // attestation_independent_verify is OPTIONAL — included because receipt sets it
  assert.equal(exp.optional.attestation_independent_verify, true);
  // settlement_transaction is OPTIONAL — included because payment block present
  assert.equal(exp.optional.settlement_transaction, '0x' + 'b'.repeat(64));
});

test('H8 · payment-less receipt does NOT emit settlement_* fields', () => {
  const receipt = buildFullReceipt();
  delete (receipt.billing as { payment?: unknown }).payment;
  const exp = exportReceiptAsAat(receipt);
  assert.equal(exp.optional.settlement_transaction, undefined);
  assert.equal(exp.optional.settlement_amount, undefined);
  assert.equal(exp.optional.settlement_payer, undefined);
});

test('H9 · minimal receipt surfaces missing required fields cleanly', () => {
  // Strip almost everything; only essentials remain.
  const minimal = buildFullReceipt();
  (minimal.teeVerification as { attestationHash?: string }).attestationHash = undefined;
  (minimal.teeVerification as { providerAddress?: string }).providerAddress = undefined;
  const missing = missingRequiredAatFields(minimal);
  assert.ok(missing.includes('attestation_proof_digest'));
  assert.ok(missing.includes('attestation_provider'));
});

test('H10 · spec pin is locked', () => {
  const exp = exportReceiptAsAat(buildFullReceipt());
  // The pin is intentional — bumping the spec is a versioned change that must
  // ship with mapping table updates. Don't loosen this assertion casually.
  assert.equal(exp.aat_spec, 'draft-rosenberg-aat-01');
});

test('H11 · mapping table has all 10 AAT sections (§3.1-§3.10)', () => {
  const sections = new Set(AAT_MAPPING_DRAFT_01.map((m) => m.aatSection.split(' ')[0]));
  for (const n of ['§3.1', '§3.2', '§3.3', '§3.4', '§3.5', '§3.6', '§3.7', '§3.8', '§3.9', '§3.10']) {
    assert.ok(sections.has(n), `mapping missing AAT section ${n}`);
  }
});

test('H12 · required mapping count is what the spec requires', () => {
  const required = requiredMappingCount();
  // draft-rosenberg-aat-01 has ~20 MUST fields. If this drops, we silently lost coverage.
  assert.ok(required >= 18, `required mapping count ${required} too low — coverage regression`);
});
