/**
 * IETF Agent Audit Trail (AAT) field mapping table.
 *
 * Spec: draft-rosenberg-aat-01 (pinned per FINAL_BUILD_PLAN.md D-8).
 *
 * Maps every Ivaronix receipt field that exposes information required by
 * the AAT spec to its AAT counterpart. Used by `aat-export.ts` (Block H)
 * to produce a compliant audit-trail JSON document from any Ivaronix
 * receipt without lossy projection.
 *
 * The mapping is intentionally one-way (Ivaronix → AAT). Ivaronix carries
 * strictly more information than AAT requires (TEE attestation paths,
 * Burn Mode encryption metadata, polyglot canonical hash, etc.); the
 * extra fields are surfaced as AAT extensions when AAT defines an
 * extension point, otherwise omitted.
 *
 * **Honesty rule:** if a field's AAT counterpart doesn't exist in the
 * draft, we DO NOT invent a mapping — the column is `null`. The CLI's
 * `--format aat` output validates against the draft schema and won't
 * include nullable mappings. v1.1 may add field mappings as new AAT
 * drafts land.
 *
 * @see docs/AAT_MAPPING.md (human-readable narrative of this table)
 * @see https://datatracker.ietf.org/doc/draft-rosenberg-aat-01 (the spec)
 */

import type { ReceiptV1 } from './schema.js';

/**
 * Each mapping describes:
 * - `ivaronixPath`: dotted path into the Ivaronix receipt body.
 * - `aatField`: the corresponding AAT field name per draft-rosenberg-aat-01.
 * - `aatSection`: spec section reference for traceability.
 * - `transform`: optional conversion (e.g., Unix seconds → ISO-8601, neuron → string).
 * - `required`: whether the AAT field is REQUIRED per the spec ("MUST" in RFC parlance).
 */
export interface AatFieldMapping {
  ivaronixPath: string;
  aatField: string | null;
  aatSection: string;
  required: boolean;
  description: string;
  transform?: (value: unknown) => unknown;
}

/**
 * The canonical mapping. Locked in v1; new drafts may extend.
 */
export const AAT_MAPPING_DRAFT_01: readonly AatFieldMapping[] = [
  // ─── Audit Trail Identity (AAT §3.1) ────────────────────────────────────
  {
    ivaronixPath: 'id',
    aatField: 'audit_trail_id',
    aatSection: '§3.1',
    required: true,
    description: 'Canonical audit-trail identifier (ULID).',
  },
  {
    ivaronixPath: 'createdAt',
    aatField: 'created_timestamp',
    aatSection: '§3.1',
    required: true,
    description: 'When the audit trail was emitted (ISO-8601 UTC).',
    // Receipt bodies historically carried createdAt as either Unix seconds (10
    // digits) or Unix milliseconds (13 digits). Detect by magnitude rather
    // than guessing — values < 1e12 (year ~33658 in ms) are treated as
    // seconds, larger values are already milliseconds.
    transform: (v) => (typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v).toISOString() : v),
  },
  {
    ivaronixPath: 'createdBy',
    aatField: 'emitter_identity',
    aatSection: '§3.1',
    required: true,
    description: 'The runtime that produced the audit trail.',
  },

  // ─── Agent Identity (AAT §3.2) ──────────────────────────────────────────
  {
    ivaronixPath: 'agent.passportId',
    aatField: 'agent_id',
    aatSection: '§3.2',
    required: true,
    description: 'Stable cryptographic identifier of the agent. (Ivaronix uses ERC-7857 passport id.)',
  },
  {
    ivaronixPath: 'agent.ownerWallet',
    aatField: 'agent_principal',
    aatSection: '§3.2',
    required: true,
    description: 'Wallet address that owns the agent passport.',
  },
  {
    ivaronixPath: 'agent.trustScore',
    aatField: null,
    aatSection: '§3.2 (extension)',
    required: false,
    description: 'Reputation score at run-time. AAT does not define this; surfaced as ivaronix-ext.',
  },

  // ─── Action Identity (AAT §3.3) ─────────────────────────────────────────
  {
    ivaronixPath: 'type',
    aatField: 'action_type',
    aatSection: '§3.3',
    required: true,
    description: 'What the agent did (Ivaronix receipt type enum).',
  },
  {
    ivaronixPath: 'request.skillId',
    aatField: 'action_capability',
    aatSection: '§3.3',
    required: true,
    description: 'Capability that produced the action (Ivaronix skill id).',
  },
  {
    ivaronixPath: 'request.skillVersion',
    aatField: 'capability_version',
    aatSection: '§3.3',
    required: true,
    description: 'Version of the capability invoked.',
  },
  {
    ivaronixPath: 'request.promptHash',
    aatField: 'action_input_digest',
    aatSection: '§3.3',
    required: true,
    description: 'Cryptographic digest of the action input.',
  },

  // ─── Output Identity (AAT §3.4) ─────────────────────────────────────────
  {
    ivaronixPath: 'outputs.outputHash',
    aatField: 'action_output_digest',
    aatSection: '§3.4',
    required: true,
    description: 'Cryptographic digest of the action output.',
  },
  {
    ivaronixPath: 'outputs.summaryHash',
    aatField: 'action_summary_digest',
    aatSection: '§3.4',
    required: false,
    description: 'Digest of a human-readable summary (when present).',
  },
  {
    ivaronixPath: 'outputs.citations',
    aatField: 'evidence_references',
    aatSection: '§3.4',
    required: false,
    description: 'Hashes of evidence that informed the output.',
  },

  // ─── Compute Provenance (AAT §3.5) ─────────────────────────────────────
  {
    ivaronixPath: 'execution.modelSelection.final',
    aatField: 'compute_provider_model',
    aatSection: '§3.5',
    required: true,
    description: 'The model that actually produced the output.',
  },
  {
    ivaronixPath: 'execution.providerRouting.finalProvider',
    aatField: 'compute_provider_endpoint',
    aatSection: '§3.5',
    required: true,
    description: 'The provider address that hosted the inference.',
  },
  {
    ivaronixPath: 'execution.model.source',
    aatField: 'compute_provider_kind',
    aatSection: '§3.5',
    required: false,
    description: 'Provider category (0G TEE / external API / local).',
  },

  // ─── Attestation (AAT §3.6 — the core human-in-the-loop / TEE proof) ────
  {
    ivaronixPath: 'teeVerification.attestationHash',
    aatField: 'attestation_proof_digest',
    aatSection: '§3.6',
    required: true,
    description: 'TEE attestation proof hash (load-bearing for Article 14 compliance).',
  },
  {
    ivaronixPath: 'teeVerification.verificationMethod',
    aatField: 'attestation_method',
    aatSection: '§3.6',
    required: true,
    description: 'How the attestation was produced (Ivaronix: router_flag / processResponse / external-signed).',
  },
  {
    ivaronixPath: 'teeVerification.providerAddress',
    aatField: 'attestation_provider',
    aatSection: '§3.6',
    required: true,
    description: 'Address of the attesting party.',
  },
  {
    ivaronixPath: 'teeVerification.independentVerified',
    aatField: 'attestation_independent_verify',
    aatSection: '§3.6 (extension)',
    required: false,
    description: 'Boolean: was the attestation re-verified independently (Ivaronix: --tee-independent CLI).',
  },

  // ─── Chain Anchor (AAT §3.7) ────────────────────────────────────────────
  {
    ivaronixPath: 'chainAnchor.network',
    aatField: 'anchor_network',
    aatSection: '§3.7',
    required: true,
    description: 'The chain network where the audit trail anchors.',
  },
  {
    ivaronixPath: 'chainAnchor.registryAddress',
    aatField: 'anchor_registry',
    aatSection: '§3.7',
    required: true,
    description: 'The on-chain registry contract address.',
  },
  {
    ivaronixPath: 'chainAnchor.anchorTxHash',
    aatField: 'anchor_transaction',
    aatSection: '§3.7',
    required: true,
    description: 'The transaction that anchored this audit trail.',
  },
  {
    ivaronixPath: 'chainAnchor.anchorTimestamp',
    aatField: 'anchor_timestamp',
    aatSection: '§3.7',
    required: true,
    description: 'Wall-clock timestamp of the anchor transaction.',
    // Same seconds-vs-milliseconds detection as createdAt above. Receipts
    // anchored on V3 carry block.timestamp (seconds); older paths sometimes
    // wrote Date.now() (ms). Detect by magnitude to avoid year-58344 drift.
    transform: (v) => (typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v).toISOString() : v),
  },
  {
    ivaronixPath: 'chainAnchor.onChainId',
    aatField: 'anchor_record_id',
    aatSection: '§3.7',
    required: true,
    description: 'The on-chain id assigned to this audit trail.',
  },

  // ─── Settlement / Payment (AAT §3.8 — economic accountability) ─────────
  {
    ivaronixPath: 'billing.payment.txHash',
    aatField: 'settlement_transaction',
    aatSection: '§3.8',
    required: false,
    description: 'On-chain settlement transaction for the action (Ivaronix: paySkillRun tx).',
  },
  {
    ivaronixPath: 'billing.payment.paidOg',
    aatField: 'settlement_amount',
    aatSection: '§3.8',
    required: false,
    description: 'Amount paid for the action (in chain-native units, wei).',
  },
  {
    ivaronixPath: 'billing.payment.payer',
    aatField: 'settlement_payer',
    aatSection: '§3.8',
    required: false,
    description: 'Wallet that paid for the action.',
  },

  // ─── Storage Provenance (AAT §3.9 — evidence persistence) ──────────────
  {
    ivaronixPath: 'storage.receiptRoot',
    aatField: 'integrity_digest',
    aatSection: '§3.9',
    required: true,
    description: 'Canonical hash of the audit trail (digest the signature signs).',
  },
  {
    ivaronixPath: 'storage.evidenceRoot',
    aatField: 'evidence_digest',
    aatSection: '§3.9',
    required: false,
    description: 'Cryptographic root of stored evidence (Ivaronix: 0G Storage Merkle root).',
  },
  {
    ivaronixPath: 'storage.encryption',
    aatField: 'evidence_encryption',
    aatSection: '§3.9',
    required: false,
    description: 'Encryption metadata for the evidence (Ivaronix: AES-256-GCM Burn Mode when enabled).',
  },

  // ─── Signature (AAT §3.10 — non-repudiation) ───────────────────────────
  {
    ivaronixPath: 'signature.signer',
    aatField: 'signer_address',
    aatSection: '§3.10',
    required: true,
    description: 'Recovered address of the signer.',
  },
  {
    ivaronixPath: 'signature.signature',
    aatField: 'signature_value',
    aatSection: '§3.10',
    required: true,
    description: 'The detached signature over the integrity digest.',
  },
  {
    ivaronixPath: 'signature.method',
    aatField: 'signature_algorithm',
    aatSection: '§3.10',
    required: true,
    description: 'The signing method (Ivaronix: eth_personal_sign over receiptRoot).',
  },
] as const;

/**
 * Get a value at a dotted path from a receipt object, or `undefined` if
 * any segment is missing. Used by aat-export.ts to project each mapping.
 */
export function getReceiptValue(receipt: ReceiptV1, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = receipt;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * Returns the count of REQUIRED AAT fields per draft-rosenberg-aat-01.
 * Used by tests to confirm every required field has an Ivaronix-side
 * source — if this count drops, a mapping was accidentally removed.
 */
export function requiredMappingCount(): number {
  return AAT_MAPPING_DRAFT_01.filter((m) => m.required).length;
}
