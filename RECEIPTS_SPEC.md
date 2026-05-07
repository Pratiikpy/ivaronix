# Ivaronix Action Receipt Specification — v1.0

> Canonical receipt schema for every Ivaronix AI action.
> **Single source of truth.** Every other doc (PRD, HLD, BUILD) references this one.
> Treat changes here as semver-breaking. Bump version on field add/remove.

---

## 0. Why a single spec

Receipts are the product. If different surfaces (CLI, web, MCP, API) emit different shapes, the wedge collapses. Lock the schema, lock the meaning, lock the verification rules.

---

## 1. Receipt Types

| Type | Code | When created |
|---|---|---|
| `doc_ask` | 0 | `ivaronix doc ask` completed |
| `audit` | 1 | `ivaronix audit repo` completed |
| `consensus` | 2 | Multi-agent consensus completed |
| `burn` | 3 | Burn-mode operation; child of another receipt |
| `memory_access` | 4 | Skill/agent read/wrote memory |
| `skill_exec` | 5 | A skill was executed end-to-end |
| `code_change` | 6 | `ivaronix code` produced a diff |
| `passport_update` | 7 | Agent passport mutated (skill install, key rotation) |
| `swarm` | 8 | Parent-of-workers swarm run completed |

A receipt may have a single `parentReceiptId` (e.g., a `burn` receipt is a child of `doc_ask`).

---

## 2. Canonical JSON Shape

This is the *only* shape Ivaronix emits. All fields are required unless marked `optional?`. Keys are camelCase, sorted lexicographically before hashing.

```jsonc
{
  "version": "1.0",
  "id": "rcpt_01HXYZ...",                      // ULID
  "type": "doc_ask",                            // see §1
  "parentReceiptId": null,                      // optional?

  "agent": {
    "passportId": "did:0g:passport:0x...:1",    // points to ERC-7857 token
    "ownerWallet": "0x...",
    "trustScoreAtTime": 42                      // signed int128 from passport at receipt time
  },

  "request": {
    "skillId": "private-doc-review",
    "skillVersion": "0.4.1",
    "skillManifestHash": "sha256:...",          // matches passport.skillManifestRoot entry
    "userPromptHash": "sha256:...",             // never store plaintext prompt
    "inputArtifacts": [                          // every doc/repo/file referenced
      { "kind": "doc", "storageRoot": "0x...", "encrypted": true }
    ],
    "policyDecision": "approved",                // approved|approved-with-flags|denied
    "approvalChain": [                           // who/what approved each gate
      { "gate": "wallet-access", "decision": "auto-allow", "actor": "policy:default-strict" }
    ]
  },

  "execution": {
    "mode": "doc_ask|audit|consensus|swarm",
    "burnMode": true,
    "consensusMode": true,
    "modelSelection": {
      "requested": "qwen/qwen-2.5-7b-instruct",
      "final": "qwen/qwen-2.5-7b-instruct"
    },
    "providerRouting": {
      "requestedSort": "latency",                // latency|price|null
      "requestedProvider": null,                 // optional? pinned address
      "allowFallbacks": true,
      "finalProvider": "0x..."
    },
    "consensus": {                               // optional? present when consensusMode=true
      "roles": ["analyst", "critic", "judge"],
      "convergenceScore": 0.81,                  // 0-1 semantic similarity
      "agreementSummary": "...",
      "disagreementSummary": "...",
      "individualAttestations": [                // one per role
        { "role": "analyst", "attestationHash": "0x...", "providerAddress": "0x..." }
      ]
    }
  },

  "routerTrace": {
    "requestId": "...",
    "zgResKey": "...",                            // captured ZG-Res-Key header — used for independent verify
    "x0gTrace": { /* opaque blob from Router */ },
    "rateLimit": {
      "limitRequests": null,
      "remainingRequests": null,
      "resetRequests": null
    }
  },

  "teeVerification": {
    "requested": true,
    "routerVerified": true,                       // x_0g_trace.tee_verified flag
    "independentVerified": null,                  // null=not yet, true/false=after broker.inference.processResponse
    "providerAddress": "0x...",
    "verificationMethod": "router_flag|compute_sdk_process_response",
    "verifiedAt": null,                           // unix ms
    "attestationHash": "0x..."
  },

  "billing": {
    "inputTokens": 1234,
    "outputTokens": 500,
    "inputCostNeuron": "61700000000000",
    "outputCostNeuron": "50000000000000",
    "totalCostNeuron": "111700000000000",
    "totalCostOg": "0.0001117"
  },

  "storage": {
    "receiptRoot": "0x...",                       // Merkle root of THIS receipt JSON itself, after canonicalization
    "receiptTxHash": "0x...",                     // 0G Storage upload tx
    "evidenceRoot": "0x...",                      // 0G Storage root of evidence.json (full pipeline output)
    "proofDownloadVerified": false,               // whether we re-downloaded + verified the Merkle proof
    "encryption": {
      "enabled": true,
      "type": "aes-256-gcm",
      "headerDetected": true,
      "keyFingerprint": "sha256:..."              // hash of session key BEFORE destruction
    }
  },

  "burn": {                                        // optional? present when burnMode=true
    "sessionKeyDestroyedAt": 1715000000123,
    "localCleanupStatus": "completed",
    "tempPathsZeroed": ["/tmp/ivaronix-xyz"],
    "wording": "Session key destroyed; ciphertext on 0G Storage now unreadable."
  },

  "chainAnchor": {
    "network": "mainnet",                         // mainnet|testnet
    "chainId": 16661,
    "rpcUrlHash": "sha256:...",                   // hash, not URL — privacy
    "registryAddress": "0x...",                   // ReceiptRegistry contract
    "anchorTxHash": "0x...",
    "anchorBlockNumber": 12345,
    "anchorTimestamp": 1715000000
  },

  "outputs": {
    "outputHash": "sha256:...",                   // hash of model output (never plaintext)
    "summaryHash": "sha256:...",                  // hash of human-readable summary
    "citations": ["sha256:..."],                  // hashes of source spans
    "riskLevel": "low|medium|high",
    "wording": {
      "headline": "Found 3 risk flags in contract.",
      "doNotSay": ["truth score", "deleted from blockchain"]
    }
  },

  "createdAt": 1715000000000,                     // unix ms
  "createdBy": "ivaronix-forge/0.1.0",
  "signature": {                                   // signed by agent's owner wallet
    "method": "eth_personal_sign",
    "signer": "0x...",
    "signature": "0x..."
  }
}
```

---

## 3. Hashing & Signing Rules

1. **Canonicalize** the JSON: sorted keys (lexicographic, recursive), `signature` field excluded, no whitespace, UTF-8.
2. **Receipt hash** = `keccak256(canonical_bytes)` → stored as `storage.receiptRoot`.
3. **Sign** the receipt hash with the agent's owner wallet via `eth_personal_sign`. Place result in `signature`.
4. **Storage upload**: upload the *full canonical JSON including signature* to 0G Storage. Capture upload tx hash in `storage.receiptTxHash`.
5. **Chain anchor**: call `ReceiptRegistry.anchor(receiptRoot, storageRoot, type, attestationHash)` with the values from §2.

**Rule:** the receipt hash is computed BEFORE signing and BEFORE storage upload. The signature attests to the canonical content; the storage upload is proof-of-availability.

---

## 4. Verification Rules

A receipt is "fully verified" only when ALL of these pass:

| Check | How |
|---|---|
| **Schema valid** | JSON-schema validation against this spec |
| **Hash matches** | Recompute receipt hash from canonical content, compare to `storage.receiptRoot` |
| **Signature valid** | `ecrecover` the signature against `agent.ownerWallet` |
| **Storage exists** | `indexer.download(receiptTxHash, ..., true)` returns same canonical bytes (proof download) |
| **Chain anchor exists** | `ReceiptRegistry.receipts(id)` returns matching `(receiptRoot, storageRoot, agent, type, attestationHash)` |
| **TEE independently verified** | `broker.inference.processResponse(providerAddress, zgResKey)` returns `true` (when `teeVerification.requested`) |
| **Skill manifest matches** | `request.skillManifestHash` matches the hash recorded in passport's `skillManifestRoot` at receipt block height |

A receipt that passes only `Schema + Hash + Signature` is **claimed**, not **verified**.
A receipt that adds `Storage + Chain` is **anchored**.
A receipt that adds `TEE + Skill` is **fully verified**.

CLI verify command must output ALL three states clearly:

```text
$ ivaronix receipt verify rcpt_01HXYZ...
Schema:               PASS
Hash:                 PASS
Signature:            PASS    → CLAIMED
Storage availability: PASS    (root 0x... matches)
Chain anchor:         PASS    (block 12345, tx 0x...)
                                       → ANCHORED
TEE independent:      PASS    (provider 0x... attested)
Skill manifest:       PASS    (matches passport at block 12345)
                                       → FULLY VERIFIED
```

---

## 5. Privacy Rules (non-negotiable)

A receipt MUST NEVER contain:
- plaintext prompts or doc content (only hashes)
- plaintext model output (only hash + sanitized headline)
- raw API keys, wallet keys, session keys (only `keyFingerprint` after destruction)
- raw RPC URLs (only `rpcUrlHash`)
- file paths beyond `/tmp/...`-style placeholders

A receipt MAY contain:
- decrypted summary HEADLINE if `riskLevel` warrants it (max 200 chars)
- citations as content-addressed hashes that point to inputs

**Wording lock — NEVER use these phrases in receipts or proof explorer:**
- "truth score" → use "agreement score"
- "verified by AI" → use "verified by Router-flag" or "independently verified via TEE"
- "deleted from blockchain" → use "session key destroyed; ciphertext now unreadable"
- "burnt off-chain" → use "session key destroyed locally; storage ciphertext remains"
- "guaranteed safe" → use "scanned, sandboxed, and labeled"
- "fully private" / "100% private" → use "operator-side private" with the scope footnote below

**Burn Mode honest scope (must surface in receipt page footer + Studio tooltip + CLI when `--burn` is passed):**

> Burn Mode protects against operator-side disclosure: the Ivaronix daemon, the 0G Router, and 0G Compute providers cannot reconstruct the input from any artifact stored on 0G Storage, because the AES-256-GCM session key is destroyed locally and the storage upload is encrypted ciphertext only. **Burn Mode does NOT protect against compromise of the user's local machine** — if a plaintext copy of the input was retained locally before encryption (editor undo history, terminal scrollback, swap file, browser cache), that copy remains under the user's control and responsibility. For end-to-end privacy: combine Burn Mode with full-disk encryption, swap disabled, terminal/editor history disabled, browser private mode.

This is the official position. **Honesty > marketing.**

---

## 6. Receipt Lifecycle

```
draft → claimed → anchored → fully-verified → outcome-resolved
```

| State | Trigger |
|---|---|
| `draft` | created in memory before signing |
| `claimed` | signed locally by owner wallet |
| `anchored` | uploaded to 0G Storage AND anchored on 0G Chain |
| `fully-verified` | TEE independent verification + skill manifest checks complete |
| `outcome-resolved` | optional, post-hoc — was the audit accurate? was the doc summary correct? recorded as a delta to passport's `trustScore` |

`outcome-resolved` is what closes the reputation loop. Implement post-grant (Phase 3).

---

## 7. Storage / Chain Cost Targets

Per receipt, MVP target:

| Cost | Budget | Why |
|---|---|---|
| 0G Storage upload | < 0.001 OG | full JSON ~3-5 KB |
| 0G Chain anchor | < 0.005 OG | one tx, packed struct |
| Total per receipt | < 0.01 OG (~$0.05 at $5/OG) | sustainable for 100s/day demos |

**Rule:** if a receipt costs >0.02 OG, the schema is too fat. Trim before adding features.

---

## 8. JSON Schema (for tooling)

A formal JSON schema lives at `packages/forge/schemas/receipt-v1.json` (to be created in BUILD phase). The CLI MUST validate against it before signing. Reject draft receipts that fail schema.

---

## 9. Backwards-Compatibility Policy

- v1.x → only additive fields, must default-true to `null`
- v2.0 → breaking changes; ship `--accept-v1-receipts` flag in verifier for grace period

Receipts always self-describe via `version` field. Verifiers MUST refuse unknown major versions.

---

## 10. Open questions (TBD before MVP lock)

- Should consensus role attestations be signed by *each role's* provider, or only the orchestrator? (Provus uses orchestrator-only; SealedMind suggests per-role.)
- `outputs.summaryHash` — what canonicalization for natural-language strings? (Proposed: NFC + trim + lowercase a-z + utf8 bytes.)
- Do we record the model's randomness seed for reproducibility? (Trade-off: privacy vs. replay.)

---

**Schema authority:** this file. If `PRD.md` or `BUILD.md` contradicts it, this file wins.
