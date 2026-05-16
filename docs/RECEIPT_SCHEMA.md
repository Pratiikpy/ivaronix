# Ivaronix · Action Receipt — Schema, Hash, and Verification

> The receipt is the spine of Ivaronix. Every action ships one. This document
> explains the schema, the canonical hash derivation, and the two-tier
> verification model in detail. Pairs with the live receipts on 0G Galileo
> Testnet (chainId 16602) across three registry versions:
> - **V3 (canonical · 2026-05-12 →):** `0x7396D536594e2BE833070c7EB441A10906046257`
>   — admits all 13 receipt-type slots (0-12).
> - **V2 (active 2026-05-09 → 2026-05-12):** `0xf675d4183b34fe8d1981FA9c117065aAcff690ab`
>   — EIP-712 signature recovery; admits slots 0-9, coerces 10/11/12 to slot 4.
> - **V1 (legacy):** `0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c` — original deploy,
>   admits slots 0-9, sender-trust model.
>
> See §6 below for the slot-mapping table and the V3 chain-cap rationale.

---

## 1. Anatomy of a receipt

A receipt is a Zod-validated JSON object. Every field is required unless marked
optional. Schema source: `packages/receipts/src/schema.ts`.

### Top-level fields

| Field | Type | Purpose |
|---|---|---|
| `id` | ULID | local identifier, time-sortable, monotonic per process |
| `type` | `'doc_ask' \| 'audit' \| 'memory_access' \| ...` | what the agent did |
| `version` | `'1.0'` | schema version pin |
| `createdAt` | ISO-8601 string | wall-clock receipt creation time (UTC) |
| `agent` | object | passport id, owner wallet, trust score at time of run |
| `request` | object | skill id + version, prompt hash, input artifact list, policy decision |
| `execution` | object | mode, burnMode, consensusMode, model, provider routing, consensus block |
| `teeVerification` | object | requested, routerVerified, independentVerified, providerAddress, **verificationMethod** (the tier marker), tier, providerKind |
| `billing` | object | input/output tokens, cost in neuron + OG, **feeSplit** (creator/treasury BigInt-precise) |
| `storage` | object | receiptRoot, evidenceRoot, encryption block, proofDownloadVerified |
| `burn` | object (optional) | sessionKeyDestroyedAt timestamp, localCleanupStatus, tempPathsZeroed, wording |
| `chainAnchor` | object | network, chainId, rpcUrlHash, registryAddress, status, onChainId, anchorTxHash, anchorBlockNumber, anchorTimestamp |
| `outputs` | object | outputHash, citations, riskLevel, wording (headline + doNotSay list) |
| `parentReceiptId` | ULID (optional) | references a parent receipt when this run was triggered by another anchored action |
| `routerTrace` | object (optional) | per-role router call trace · provider address, model, latency, token counts |
| `signature` | `{ method, signer, signature }` | ECDSA signature object · `signature` field is the hex-string `secp256k1` signature over the canonical hash by `agent.ownerWallet`, with `method = 'eth_personal_sign'` and `signer` echoing the recovered address for fail-fast comparison |
| `createdBy` | string | the runtime that produced the receipt (`ivaronix-runtime/0.0.1`) |

### Tier marking — `teeVerification.verificationMethod`

This single field is the entire tier story. Three values:

- `'router_flag'` — TIER 1, routed through 0G Compute, provider's TEE attestation flagged at submission time.
- `'compute_sdk_process_response'` — TIER 1, broker.processResponse confirmed the attestation post-hoc.
- `'external-signed'` — TIER 2, ran on NVIDIA NIM / OpenAI / Ollama. Signed and chain-anchored, **not TEE-verified**. Renders amber on `/r/<id>`.

A page that displays a green TIER 1 chip MUST have one of the first two values.
A page displaying TIER 2 amber MUST have `'external-signed'`. Anything else is
a schema violation and the page refuses to render.

---

## 2. Canonical hash derivation

The receipt's `signature` is over a deterministic byte representation of the
receipt body. The path is:

1. Take the receipt object **minus `signature`, `id`, and `chainAnchor`**.
2. Sort all object keys recursively. Sets and arrays preserve order (arrays
   are content-defined; sets are not used in the schema).
3. Serialize to UTF-8 JSON with no whitespace and `\n` end-of-line.
4. Take `keccak256` of those bytes — that is the `receiptRoot`.
5. Sign `receiptRoot` with the wallet's ECDSA key. The output is `signature`.

Once `receiptRoot` is computed, it is added to `storage.receiptRoot`, and the
on-chain anchor in step 5 of section 3 stores **only the receiptRoot** plus
metadata (timestamp, agent, type code). The full body lives off-chain on
0G Storage. A judge with the receipt JSON can re-derive `receiptRoot` and
compare it against the on-chain registry without trust.

### Tampering is detected at verify time

`ivaronix receipt verify <path-or-id>` re-runs the same derivation:

```
schema     PASS
hash       FAIL  expected 0xa9aa…0a5ca0, computed 0xa9aa…0a5ca7
                                ^^                          ^^
                                stored on chain             freshly computed
```

In the QA edge sweep, flipping a single hex character of `storage.receiptRoot`
in a local copy produced exactly that error. The integrity check works.

---

## 3. TIER 1 verification flow — sequence

```
caller                   ivaronix CLI                0G Router          0G Compute        ReceiptRegistry
  |                            |                         |                   |                    |
  |---- ivaronix demo -------->|                         |                   |                    |
  |                            |---- chat (TEE flag) --->|                   |                    |
  |                            |                         |---- inference --->|                    |
  |                            |                         |<-- response + att-|                    |
  |                            |<-- response + att ------|                                        |
  |                            |  ── compute receiptRoot, sign ──                                 |
  |                            |---- anchor(receiptRoot, type, agent) ----------------------------->|
  |                            |<-- txHash, onchain id ----------------------------------------|---|
  |<-- /r/<id> + tx hash ------|                                                                    |
  |                                                                                                 |
  |---- receipt verify <id> --->|                                                                   |
  |                            |---- broker.processResponse(zgResKey) ->|                          |
  |                            |<-- tee:primary PASS / FAIL ------------|                          |
  |<-- FULLY VERIFIED ✓ -------|                                                                    |
```

**Independent re-verification** is the second arrow at the bottom. The CLI
calls `broker.processResponse` against the original 0G Compute provider. If
the attestation signature is still recoverable from the broker's records, the
chain returns PASS and the receipt status flips from `→ ANCHORED` to
`→ FULLY VERIFIED ✓`.

This was verified end-to-end on receipts **#994** (Studio burn-mode) and
**#1004** (CLI demo). Sample output:

```
schema                 PASS
hash                   PASS
signature              PASS
                    → CLAIMED
chain anchor          PASS  (id=1004 block≈1778309178)
                    → ANCHORED
initializing 0G Compute broker...
verifying 1 attestation via broker.processResponse...
tee:primary           PASS  (provider 0xa48f0128…)
                    → FULLY VERIFIED ✓
```

### Freshness window

`broker.processResponse` requires the original session record on the
provider. Sessions expire — receipts older than the broker's retention window
return `getting signature error`, not because the receipt is invalid but
because the broker has dropped the session. Receipt #945 hit this when
re-verified hours after issue.

The integrity-only checks (schema/hash/signature/chain-anchor) PASS on any
receipt regardless of broker freshness. Only the optional fifth check
(`tee:primary`) needs a warm session.

---

## 4. TIER 2 honest marking — why amber, not green

When `OG_PROVIDER=nvidia` is set (or any non-0G router), the pipeline:

1. Calls NVIDIA NIM directly with the same prompt, capturing input/output
   tokens.
2. Records `teeVerification.verificationMethod = 'external-signed'`.
3. Sets `teeVerification.routerVerified = false`.
4. Sets `execution.providerRouting.finalProvider = 0x000…000` (placeholder).
5. Records `execution.modelSelection.final` to the actually-used NVIDIA model
   name (e.g. `meta/llama-3.1-8b-instruct`), **not** the env default. (This
   was the honesty fix in commit `759361f` — earlier versions wrote the 0G
   default name even on NVIDIA runs, which mis-stated the provider.)

The receipt page `/r/<id>` reads `verificationMethod` and renders the chip:

- `router_flag` or `compute_sdk_process_response` → green TIER 1 chip
- `external-signed` → amber TIER 2 · EXTERNAL · NVIDIA-NIM chip

Receipt **#1014** and **#1056** both render amber correctly. The four-light
row also flips: STORAGE/CHAIN remain green (those steps did happen on 0G
infrastructure), TEE goes amber (no 0G TEE attestation).

The branding rationale — green for "we attested", amber for "external party
attested" — keeps the receipt page honest. The implementation is one
switch on `verificationMethod`.

---

## 5. Why this matters

A wide gap in the AI-agent-on-chain space is that most projects can prove they invoked an inference provider but cannot independently re-verify the response they received. The `broker.processResponse` re-check closes that gap — the receipt is not just *anchored*, it is *re-verifiable from any machine without trusting the original CLI run*.

The same architecture extends naturally to:

- **Burn Mode evidence proof** — `storage.encryption.keyFingerprint` +
  `burn.sessionKeyDestroyedAt` recorded per receipt (commit `6394220`).
- **Receipt-gated fee splits** — `billing.feeSplit.creatorNeuron` and
  `treasuryNeuron` accumulated only when the receipt anchors. Surfaced via
  `ivaronix skill earn-history` (commit `c87a018`).
- **Multi-provider tier marking** — TIER 2 amber shipped, ready for OpenAI /
  Ollama by adding new branches in the same `verificationMethod` switch.

A receipt is a single JSON file. A receipt anchored on chain plus the CLI
that re-verifies it is the entire trust model.

---

## 6. On-chain registry versions and slot mapping

Three `ReceiptRegistry*` contracts are live on 0G Galileo. The canonical
write target advances over time; older registries stay readable forever
because chain history is immutable. Off-chain readers query V3 first,
fall back to V2, fall back to V1 (`apps/studio/src/lib/chain.ts`
`unified*` helpers and `apps/cli/src/commands/receipt.ts`
`buildReadRegistries`).

### Receipt-type slot mapping

`packages/core/src/types.ts` `RECEIPT_TYPES` defines 13 canonical type
names (slots 0-12). Each registry version admits a different subset:

| Slot | Canonical name | V1 admits | V2 admits | V3 admits |
|---|---|---|---|---|
| 0 | `doc_ask` | ✓ | ✓ | ✓ |
| 1 | `audit` | ✓ | ✓ | ✓ |
| 2 | `consensus` | ✓ | ✓ | ✓ |
| 3 | `burn` | ✓ | ✓ | ✓ |
| 4 | `memory_access` | ✓ | ✓ | ✓ |
| 5 | `skill_exec` | ✓ | ✓ | ✓ |
| 6 | `code_change` | ✓ | ✓ | ✓ |
| 7 | `passport_update` | ✓ | ✓ | ✓ |
| 8 | `swarm` | ✓ | ✓ | ✓ |
| 9 | `subscription_skill_exec` | ✓ | ✓ | ✓ |
| 10 | `doc_room_create` | coerced → 5 | coerced → 5 | ✓ canonical |
| 11 | `doc_room_read` | coerced → 4 | coerced → 4 | ✓ canonical |
| 12 | `memory_consolidation` | coerced → 4 | coerced → 4 | ✓ canonical |

Source of truth: `packages/core/src/types.ts` `RECEIPT_TYPES` mapping
+ `packages/receipts/src/schema.ts` `ReceiptTypeSchema` enum (both
must list the same 13 names in the same order; the
`verify-receipt-types-three-way.ts` regression enforces parity).

### Why V3 was needed (2026-05-12)

`ReceiptRegistryV2.sol:135` required `p.receiptType <= TYPE_SUBSCRIPTION_SKILL_EXEC`
(= 9). The contract had constants for slots 0-9 only. New receipt types
shipped in code (`doc_room_create`, `doc_room_read`, `memory_consolidation`)
had no on-chain slot, so the CLI hardcoded a coercion: `room create` →
slot 5, `room read` + `memory_consolidation` → slot 4. The off-chain
receipt body always carried the canonical type name, but the on-chain
`receiptType` field was a known coercion. A chain reader filtering
`receiptType == 11` found zero results.

V3 (deployed 2026-05-12 at `0x7396D536594e2BE833070c7EB441A10906046257`)
adds the three missing constants (`TYPE_DOC_ROOM_CREATE = 10`,
`TYPE_DOC_ROOM_READ = 11`, `TYPE_MEMORY_CONSOLIDATION = 12`) and bumps
the type-cap to `TYPE_MEMORY_CONSOLIDATION`. EIP-712 domain version
bumped "2" → "3" so V2 signatures cannot replay on V3.

### Reading legacy V1+V2 receipts honestly

V1+V2 receipts anchored before 2026-05-12 keep their legacy slot
encoding (chain history is immutable). The off-chain receipt body —
the source of truth — always recorded the canonical name. Reverse-map
via `apps/studio/src/lib/chain.ts` `receiptTypeLabel(code)` which reads
from `@ivaronix/core` `RECEIPT_TYPES`; the CLI `ivaronix receipt verify`
honors `chainAnchor.registryAddress` to pick the right interpretation.

### Verification

```
forge test --root contracts                    # 173/173 PASS (V1+V2+V3)
ivaronix doctor                                # V3 listed in deployed contracts
ivaronix room create --doc <file> --parties <addr>  # anchors slot 10 on V3
ivaronix room read --id <onChainId>            # anchors slot 11 on V3
```
