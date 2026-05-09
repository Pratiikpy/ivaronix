# Ivaronix · Crypto Notes

> Threat models + design choices for every cryptographic primitive shipped in
> Ivaronix. Read once, refer when extending. Updated 2026-05-10.

---

## 1 · Memory-at-rest encryption

**Primitive.** AES-256-GCM. Key derived from the owner's private key via
`scryptSync` with `N=16384, r=8, p=1` and a fixed namespace salt
(`ivaronix-memory-v1`). Layout: `nonce || ciphertext || tag` where
`nonce` is 12 bytes and `tag` is 16 bytes.

**Source.** `packages/memory/src/encryption.ts`.

**Threat model.**
- **Attacker reads the encrypted blob.** Without the owner's private key, AES-256-GCM under a randomly-chosen 12-byte nonce is IND-CCA2 secure. Computational cost of recovery is brute-force over the 256-bit key.
- **Attacker tampers with the ciphertext.** GCM's GHASH authentication tag fails verification; `decryptObservation` throws.
- **Attacker observes many ciphertexts of related plaintexts.** Random nonces ensure each ciphertext's keystream is independent; no plaintext relationships leak.

**What broke (K-20, fixed 2026-05-10).**

Before the fix:
```ts
const nonce = createHash('sha256')
  .update(Buffer.from(plaintext, 'utf8'))
  .update(Date.now().toString())
  .digest()
  .subarray(0, NONCE_LEN);
```

The nonce was derived from `sha256(plaintext || Date.now())` truncated to 12 bytes. Two encryption calls in the same millisecond with the same plaintext under the same key produced the **same nonce**. AES-GCM nonce reuse with the same key is catastrophic:
1. The keystream `K = E_key(counter || nonce)` is reused. XOR of the two ciphertexts equals XOR of the two plaintexts; both leak.
2. The GHASH authentication is broken. An attacker who sees two ciphertexts under a reused nonce can forge tags for arbitrary new ciphertexts under the same key + nonce.

The plaintext-dependent nonce also leaked: identical plaintexts produced identical ciphertexts, so an attacker could detect repetition without decrypting.

**Fix.** `nonce = randomBytes(12)` per RFC 5116 §3.2 and NIST SP 800-38D §8.2.1. Three lines of code; existing encrypted blobs remain decryptable since the IV is stored alongside the ciphertext.

**Regression suite.** `packages/memory/src/encryption.test.ts` covers:
- Same-plaintext-same-key produces different ciphertexts (the nonce-uniqueness invariant).
- 10,000-iteration nonce-uniqueness fuzz.
- Round-trip (encrypt → decrypt) over ASCII, Unicode, large strings, empty string.
- Auth-tag failure on wrong key.
- Auth-tag failure on tampered ciphertext.
- Source-file regression guards: `createHash('sha256').update(plaintext)` and `Date.now().toString())` patterns are forbidden in `encryption.ts`.

---

## 2 · Receipt canonical hash

**Primitive.** `keccak256(canonical(receipt))` where `canonical` sorts keys alphabetically and applies a fixed exclusion list (e.g. the `signature` field itself is excluded so the hash binds to content and the signature binds to the hash).

**Source.** `packages/core/src/canonical.ts`.

**Known limitation (K-15, planned).** The current canonicalization uses Node's `JSON.stringify` directly on values — Number formatting follows ECMAScript semantics. A Rust or Go verifier cannot reproduce the same hash without replicating JS-specific behavior. The fix in flight: adopt RFC-8785 (JCS) strictly + ship Rust + Go + Python reference verifiers. Forward-only via `schemaVersion: '1.0' | '2.0'` so existing 1,330+ receipts remain byte-identical on chain.

---

## 3 · Burn Mode session-key destruction

**Primitive.** AES-256-GCM with a session-only key. Key generated with `randomBytes(32)`; nonce with `randomBytes(12)`. Key reference overwritten with zeros after upload to 0G Storage.

**Source.** `packages/og-storage/src/burn.ts`.

**Threat model.** Burn Mode protects against **operator-side disclosure**:
- After the run, the operator no longer has the AES key. The ciphertext on 0G Storage is unreadable to anyone, including the operator.
- The receipt body's `storage.encryption.keyFingerprint` is `sha256(realKey)` so the receipt commits to which key was used; any later "I have the key" claim must produce a key whose fingerprint matches.

**Not in scope.** Local-machine compromise during the active run is out of scope (the key is in process memory while the encryption runs). For local-machine threat modelling, run the operator inside a TEE.

**Studio surface gap (I-2 / K-16, fix in flight).** The Studio `/api/run` path currently writes a fake `keyFingerprint` for Burn Mode without performing real encryption. Honest behavior: omit `storage.encryption` entirely until the real burn pipeline lands in the Studio surface. The CLI doc-ask Burn Mode path (`apps/cli/src/commands/doc.ts`) is correct — it calls the real `burnEncrypt` in `packages/og-storage/src/burn.ts`.

---

## 4 · Receipt signing

**Primitive.** ECDSA over secp256k1 via ethers' `Wallet.signMessage`. The signed payload is the receipt's `storage.receiptRoot` (a 32-byte hex string). Recovery via `verifyMessage` returns the signer address; the verifier checks `recovered == signature.signer` AND `signer == agent.ownerWallet`.

**Source.** `packages/receipts/src/builder.ts` (sign), `packages/receipts/src/verify.ts` (verify).

**Threat model.** A receipt with a forged signature fails the recover-and-compare check. A receipt with a valid signature whose signer differs from `agent.ownerWallet` also fails — the verifier requires the signer to be the agent on the receipt.

**Known issue (I-3 / K-14, fix in flight).** The Studio `/api/run` "operator-on-behalf-of-user" (W9) path sets `agent.ownerWallet = userWallet` but signs with the operator's key. The verifier rejects every such receipt as INVALID by its own rules. Honest fix: ship full SIWE so the browser signs `receiptRoot` itself (`signedBy = 'user-direct'`).

---

## 5 · Contract anchor signatures

**Primitive (current).** `ReceiptRegistry.anchor()` writes `agentAddress = msg.sender` directly. No signature recovery.

**Threat model.** Any wallet can anchor any `receiptRoot` claiming any agent identity. Chain-only verifiers see the lie. The off-chain receipt body's signature is the only honest agent attribution today.

**Fix in flight (K-2).** `ReceiptRegistryV2` recovers `agentAddress` from an EIP-712 typed-data signature over `(receiptRoot, storageRoot, receiptType, attestationHash, agentAddress, chainId, address(this), nonce)`. Replay protection via per-agent nonces. Verifier branches on `chainAnchor.registryAddress` so 1,330+ legacy receipts remain valid on V1.

---

## 6 · Reputation contract access

**Primitive (current).** `AgentPassportINFT.recordReceipt(tokenId, receiptRoot, type, delta)` is callable by either the token owner OR an authorized recorder. The owner branch is unbounded — any token holder can self-claim any trustScore delta.

**Threat model.** Every dashboard reading `trustScore` reads a number the wallet itself wrote. Reputation is performative.

**Fix in flight (K-1).** `AgentPassportINFTV2`:
- Drop the owner branch entirely. Only `authorizedRecorders` can write.
- Cross-check that `receiptRoot` exists on `ReceiptRegistry` and the row's `agentAddress` matches the passport.
- Cap `delta` per call to `[-100, +100]`.
- Migration: V2 redeploy, trustScore reset to 0 for new mints (existing 4 mints stay readable on V1 with a `LEGACY-PASSPORT` chip in Studio).

---

## 7 · Capability grants

**Primitive.** `CapabilityRegistry` stores per-grant scope (skill, agent, expiry, reads cap). `consumeRead(grantId)` decrements `readsRemaining`.

**Threat model.** A grant is identified by `grantId`. The current `consumeRead` does not check `msg.sender == grantee` — anyone reading the public `grantsByGrantee` mapping can call `consumeRead` repeatedly and exhaust a victim's caps (DoS).

**Fix in flight (K-22).** Add `require(msg.sender == g.grantee, "CapabilityRegistry: not grantee")` at the top of `consumeRead`. Two-line patch.

---

## 8 · ERC-7857 attestor signatures

**Primitive (current).** `Erc7857Verifier.sol` accepts attestor-signed integrity proofs. Signed payload is `keccak256(abi.encodePacked(recipient, metadataHash, nonce, address(this), block.chainid))` prefixed with `\x19Ethereum Signed Message:\n32`. Replay protection via `usedNonces` keyed on `keccak(recipient, metadataHash, nonce)`.

**Threat model.** Without a domain separator that includes `address(this)` and `chainid` in EIP-712 form, a future V2 deployment lets V1 signatures replay against V2 if the same `(recipient, metadataHash, nonce)` tuple recurs. Signature malleability is also possible since `_recover` accepts `s` values in the upper half of the curve.

**Fix in flight (K-5).** Migrate to EIP-712 typed data with full domain separator + deadline. Switch to OZ `ECDSA.recover` (handles malleability + length checks).

---

## 9 · Cross-references

- `docs/RECEIPT_SCHEMA.md` — receipt body layout + which fields are signed.
- `docs/MAINNET_READINESS.md` — chain-deploy gates.
- `docs/HALF_BAKED.md` Section K — every security finding in a single audit list.
- `docs/HALF_BAKED.md` Section N — execution plan + status for each fix.
- `CLAUDE.md §6` — TIER 1 vs TIER 2 receipt marking discipline.
