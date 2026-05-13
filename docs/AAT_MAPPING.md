# IETF AAT Field Mapping · `draft-rosenberg-aat-01`

> Ivaronix receipt → IETF Agent Audit Trail (AAT) field mapping table.
> Spec version: **`draft-rosenberg-aat-01`** (pinned per FINAL_BUILD_PLAN.md D-8).
> Authoritative source-of-truth for this mapping: `packages/receipts/src/aat-mapping.ts`.
> Generated at: 2026-05-13 alongside Block H.

---

## Why this mapping exists

The IETF Agent Audit Trail draft (`draft-rosenberg-aat-01`) defines a standardized JSON format for AI-agent audit trails — what the EU AI Act Article 14 human-in-the-loop documentation requirements lean on, what ISO 42001 audit-pack consumers consume, what enterprise compliance teams ingest.

Ivaronix receipts already capture every field the AAT spec requires. This document maps each receipt field to its AAT counterpart so an enterprise auditor receiving an Ivaronix receipt can transform it to AAT format using `ivaronix receipt verify <id> --format aat` without losing data.

**Honesty rule**: where AAT defines no equivalent for an Ivaronix-specific field (e.g., polyglot canonical hash vectors, consensus role attestations, Burn Mode key fingerprint), we surface them under the `ivaronix-ext` vendor-extension namespace — AAT explicitly supports vendor extensions for higher-information-density audit trails.

---

## AAT spec sections and what each requires

The AAT spec defines 10 sections. Every Ivaronix receipt satisfies at least the first 7; sections 8–10 are partial depending on receipt type.

### §3.1 · Audit Trail Identity

| AAT field | Required | Ivaronix path | Transform |
|---|---|---|---|
| `audit_trail_id` | ✓ MUST | `id` | none (ULID passes-through) |
| `created_timestamp` | ✓ MUST | `createdAt` | Unix seconds → ISO-8601 UTC |
| `emitter_identity` | ✓ MUST | `createdBy` | none (`ivaronix-runtime/<version>`) |

### §3.2 · Agent Identity

| AAT field | Required | Ivaronix path | Transform |
|---|---|---|---|
| `agent_id` | ✓ MUST | `agent.passportId` | none (DID format passes-through) |
| `agent_principal` | ✓ MUST | `agent.ownerWallet` | none (0x40-hex address) |
| `agent_trust_score` (ext) | optional | `agent.trustScore` | surfaced under `ivaronix-ext` |

### §3.3 · Action Identity

| AAT field | Required | Ivaronix path | Transform |
|---|---|---|---|
| `action_type` | ✓ MUST | `type` | none (Ivaronix enum: doc_ask, audit, …) |
| `action_capability` | ✓ MUST | `request.skillId` | none (skill slug) |
| `capability_version` | ✓ MUST | `request.skillVersion` | none (semver) |
| `action_input_digest` | ✓ MUST | `request.promptHash` | none (`sha256:<hex>`) |

### §3.4 · Output Identity

| AAT field | Required | Ivaronix path | Transform |
|---|---|---|---|
| `action_output_digest` | ✓ MUST | `outputs.outputHash` | none |
| `action_summary_digest` | optional | `outputs.summaryHash` | none |
| `evidence_references` | optional | `outputs.citations` | array passthrough |

### §3.5 · Compute Provenance

| AAT field | Required | Ivaronix path | Transform |
|---|---|---|---|
| `compute_provider_model` | ✓ MUST | `execution.modelSelection.final` | none |
| `compute_provider_endpoint` | ✓ MUST | `execution.providerRouting.finalProvider` | none |
| `compute_provider_kind` | optional | `execution.model.source` | enum: `0G` / `NVIDIA` / `OpenAI` / `Ollama` |

### §3.6 · Attestation (core human-in-the-loop / TEE proof)

| AAT field | Required | Ivaronix path | Transform |
|---|---|---|---|
| `attestation_proof_digest` | ✓ MUST | `teeVerification.attestationHash` | none |
| `attestation_method` | ✓ MUST | `teeVerification.verificationMethod` | none |
| `attestation_provider` | ✓ MUST | `teeVerification.providerAddress` | none |
| `attestation_independent_verify` (ext) | optional | `teeVerification.independentVerified` | boolean |

### §3.7 · Chain Anchor

| AAT field | Required | Ivaronix path | Transform |
|---|---|---|---|
| `anchor_network` | ✓ MUST | `chainAnchor.network` | enum: `testnet` / `mainnet` |
| `anchor_registry` | ✓ MUST | `chainAnchor.registryAddress` | none |
| `anchor_transaction` | ✓ MUST | `chainAnchor.anchorTxHash` | none |
| `anchor_timestamp` | ✓ MUST | `chainAnchor.anchorTimestamp` | Unix seconds → ISO-8601 UTC |
| `anchor_record_id` | ✓ MUST | `chainAnchor.onChainId` | string passthrough (BigInt-safe) |

### §3.8 · Settlement / Payment (economic accountability)

| AAT field | Required | Ivaronix path | Transform |
|---|---|---|---|
| `settlement_transaction` | optional | `billing.payment.txHash` | none |
| `settlement_amount` | optional | `billing.payment.paidOg` | wei string passthrough |
| `settlement_payer` | optional | `billing.payment.payer` | none |

> All three optional when the run was free (no payment block). When present,
> the receipt's payment leg satisfies AAT's economic-accountability requirement.

### §3.9 · Storage Provenance

| AAT field | Required | Ivaronix path | Transform |
|---|---|---|---|
| `integrity_digest` | ✓ MUST | `storage.receiptRoot` | canonical hash of receipt body |
| `evidence_digest` | optional | `storage.evidenceRoot` | 0G Storage Merkle root |
| `evidence_encryption` | optional | `storage.encryption` | object passthrough (Burn Mode metadata) |

### §3.10 · Signature (non-repudiation)

| AAT field | Required | Ivaronix path | Transform |
|---|---|---|---|
| `signer_address` | ✓ MUST | `signature.signer` | none |
| `signature_value` | ✓ MUST | `signature.signature` | none |
| `signature_algorithm` | ✓ MUST | `signature.method` | enum: `eth_personal_sign` |

---

## Field count summary

| Section | Total AAT fields mapped | Required | Optional |
|---|---:|---:|---:|
| §3.1 · Identity | 3 | 3 | 0 |
| §3.2 · Agent | 3 | 2 | 1 (ext) |
| §3.3 · Action | 4 | 4 | 0 |
| §3.4 · Output | 3 | 1 | 2 |
| §3.5 · Compute | 3 | 2 | 1 |
| §3.6 · Attestation | 4 | 3 | 1 (ext) |
| §3.7 · Anchor | 5 | 5 | 0 |
| §3.8 · Settlement | 3 | 0 | 3 |
| §3.9 · Storage | 3 | 1 | 2 |
| §3.10 · Signature | 3 | 3 | 0 |
| **Total** | **34** | **24** | **10** |

---

## Vendor extensions (`ivaronix-ext` namespace)

Receipt fields without an AAT counterpart are surfaced under the `ivaronix-ext` namespace. Enterprise auditors who consume AAT documents see the standard 24-required-fields envelope plus an extension block that adds higher information density without breaking AAT-spec validators.

Fields in `ivaronix-ext.receipt`:

- The full receipt body (24+ top-level fields including consensus details, polyglot hash, Burn Mode key fingerprint, etc.)
- The `ivaronix-ext.sections_claimed` array lists which AAT sections this export claims to satisfy — auditors use this as a compliance checklist.

---

## Validation

The CLI invocation:

```bash
pnpm ivaronix receipt verify <id> --format aat | jq
```

…produces valid JSON that an enterprise validator can ingest. The test suite at `packages/receipts/src/aat-export.test.ts` asserts:

- Spec pin (`draft-rosenberg-aat-01`)
- Required-field coverage (≥18 required fields populated)
- Optional-field correctness (settlement_* present iff payment block exists)
- Section enumeration (all 10 AAT sections covered)
- Timestamp transforms (Unix seconds → ISO-8601)

Regression: if a future schema change removes a mapped field, `aat-export.test.ts:H3` (missing-required scanner on full receipt) fails — CI blocks the merge.

---

## EU AI Act Article 14 alignment

The AAT draft is the IETF-side companion to the EU AI Act's Article 14 human-in-the-loop documentation requirement (deadline: 2026-08-01). Article 14 mandates that high-risk AI systems maintain "appropriate human-machine interface tools" allowing oversight, with documentation traceable to the actual run.

Ivaronix receipts satisfy Article 14 directly via:

1. **Attestation chain** (`teeVerification`) — proves the inference ran on attested hardware
2. **Anchor on chain** (`chainAnchor`) — provides tamper-evident timestamp + record id
3. **Signature recovery** (`signature.signer`) — non-repudiation of the human/agent who approved
4. **Independent re-verification** (`--tee-independent`) — third-party auditor can replay the proof

The AAT format is the standardized envelope that makes these proofs portable to enterprise compliance teams who consume AAT-format documents from multiple AI vendors.

---

## v1.1 backlog

- Track newer AAT drafts (`draft-rosenberg-aat-02` etc.) when finalized; bump pin
- Add reverse-direction import (`ivaronix receipt import <aat-doc>`) for cross-vendor verification
- Wire AAT export to a published AAT receiver / registry once IETF publishes one
- ISO 42001 audit-pack overlay (subset of AAT plus additional fields)

---

*— Block H · 2026-05-13. Mapping source-of-truth: `packages/receipts/src/aat-mapping.ts`.*
