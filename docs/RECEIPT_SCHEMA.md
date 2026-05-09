# Ivaronix · Action Receipt — Schema, Hash, and Verification

> The receipt is the spine of Ivaronix. Every action ships one. This document
> explains the schema, the canonical hash derivation, and the two-tier
> verification model in detail. Pairs with the live receipts at
> `https://chainscan-galileo.0g.ai/address/0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c`
> (ReceiptRegistry on 0G Galileo Testnet, chainId 16602).

---

## 1. Anatomy of a receipt

A receipt is a Zod-validated JSON object. Every field is required unless marked
optional. Schema source: `packages/receipts/src/schema.ts`.

### Top-level fields

| Field | Type | Purpose |
|---|---|---|
| `id` | ULID | local identifier, time-sortable, monotonic per process |
| `type` | `'doc_ask' \| 'audit' \| 'memory_access' \| ...` | what the agent did |
| `version` | `'1.0.0'` | schema version pin |
| `agent` | object | passport id, owner wallet, trust score at time of run |
| `request` | object | skill id + version, prompt hash, input artifact list, policy decision |
| `execution` | object | mode, burnMode, consensusMode, model, provider routing, consensus block |
| `teeVerification` | object | requested, routerVerified, independentVerified, providerAddress, **verificationMethod** (the tier marker) |
| `billing` | object | input/output tokens, cost in neuron + OG, **feeSplit** (creator/treasury BigInt-precise) |
| `storage` | object | receiptRoot, evidenceRoot, encryption block, proofDownloadVerified |
| `burn` | object (optional) | sessionKeyDestroyedAt timestamp, localCleanupStatus, tempPathsZeroed, wording |
| `chainAnchor` | object | network, chainId, rpcUrlHash, registryAddress, anchorTxHash, anchorBlockNumber, anchorTimestamp |
| `outputs` | object | outputHash, citations, riskLevel, wording (headline + doNotSay list) |
| `signature` | hex string | ECDSA signature over the canonical hash by `agent.ownerWallet` |
| `createdBy` | string | the runtime that produced the receipt (`ivaronix-runtime/0.0.1`) |

### Tier marking — `teeVerification.verificationMethod`

This single field is the entire tier story. Three values:

- `'router_flag'` — TIER 1, routed through 0G Compute, provider's TEE attestation flagged at submission time.
- `'compute_sdk_process_response'` — TIER 1, broker.processResponse confirmed the attestation post-hoc.
- `'external-signed'` — TIER 2, ran on NVIDIA NIM / OpenAI / Ollama. Signed and chain-anchored, **not TEE-verified**. Renders amber on `/r/<id>`. Honest > flattering (CLAUDE.md §6).

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
attested" — is one paragraph in CLAUDE.md §6: *"Honest > flattering."* The
implementation is one switch on `verificationMethod`.

---

## 5. Why this matters for the judge

The 0G ecosystem analysis surfaced one universal weakness in the field:
**most projects can prove they invoked 0G Compute, but cannot independently
re-verify the response they received.** That is the gap the
`broker.processResponse` re-check closes — the receipt is not just *anchored*,
it is *re-verifiable from any machine without trusting the original CLI run*.

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
