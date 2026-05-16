# Ivaronix · Crypto Notes

> Threat models and design choices for every cryptographic primitive shipped in
> Ivaronix.

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

**Prior nonce-derivation flaw (closed).**

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

**Polyglot canonicalisation.** The TypeScript, Python, and Rust reference verifiers all agree on the receipt root via RFC-8785 (JCS) plus keccak256. Cross-language byte equality is enforced on every PR by `.github/workflows/jcs-roundtrip.yml`. Schema migration is forward-only via `schemaVersion: '1.0' | '2.0'` so existing receipts remain byte-identical on chain. Full details in `docs/HASH_FUNCTION.md`.

---

## 3 · Burn Mode session-key destruction

**Primitive.** AES-256-GCM with a session-only key. Key generated with `randomBytes(32)`; nonce with `randomBytes(12)`. Key reference overwritten with zeros after upload to 0G Storage.

**Source.** `packages/og-storage/src/burn.ts`.

**Threat model.** Burn Mode protects against **operator-side disclosure**:
- After the run, the operator no longer has the AES key. The ciphertext on 0G Storage is unreadable to anyone, including the operator.
- The receipt body's `storage.encryption.keyFingerprint` is `sha256(realKey)` so the receipt commits to which key was used; any later "I have the key" claim must produce a key whose fingerprint matches.

**Not in scope.** Local-machine compromise during the active run is out of scope (the key is in process memory while the encryption runs). For local-machine threat modelling, run the operator inside a TEE.

---

## 4 · Receipt signing

**Primitive.** ECDSA over secp256k1 via ethers' `Wallet.signMessage`. The signed payload is the receipt's `storage.receiptRoot` (a 32-byte hex string). Recovery via `verifyMessage` returns the signer address; the verifier checks `recovered == signature.signer` AND `signer == agent.ownerWallet`.

**Source.** `packages/receipts/src/builder.ts` (sign), `packages/receipts/src/verify.ts` (verify).

**Threat model.** A receipt with a forged signature fails the recover-and-compare check. A receipt with a valid signature whose signer differs from `agent.ownerWallet` also fails — the verifier requires the signer to be the agent on the receipt.

---

## 5 · Contract anchor signatures

**V1 (legacy).** `ReceiptRegistry.anchor()` writes `agentAddress = msg.sender` directly. No signature recovery. Any wallet can anchor any `receiptRoot` claiming any agent identity. Chain-only verifiers see the lie. The off-chain receipt body's signature is the only honest agent attribution on V1.

**V2 + V3 (canonical).** `ReceiptRegistryV2` and `ReceiptRegistryV3` recover `agentAddress` from an EIP-712 typed-data signature over `(receiptRoot, storageRoot, receiptType, attestationHash, agentAddress, chainId, address(this), nonce)`. Replay protection via per-agent nonces. The verifier branches on `chainAnchor.registryAddress` so legacy receipts remain valid on V1.

---

## 6 · Reputation contract access

**V1 (legacy).** `AgentPassportINFT.recordReceipt(tokenId, receiptRoot, type, delta)` was callable by either the token owner or an authorized recorder. The owner branch was unbounded — any token holder could self-claim any trustScore delta. Reputation on V1 is performative.

**V2 (canonical).** `AgentPassportINFTV2`:
- Drops the owner branch entirely. Only `authorizedRecorders` can write.
- Cross-checks that `receiptRoot` exists on `ReceiptRegistry` and the row's `agentAddress` matches the passport.
- Caps `delta` per call to `[-100, +100]`.
- TrustScore resets to 0 for new mints. Existing V1 mints stay readable on V1 with a `LEGACY-PASSPORT` chip in Studio.

---

## 7 · Capability grants

**Primitive.** `CapabilityRegistry` stores per-grant scope (skill, agent, expiry, reads cap). `consumeRead(grantId)` decrements `readsRemaining`.

**V1 threat model.** A grant is identified by `grantId`. V1's `consumeRead` did not check `msg.sender == grantee` — anyone reading the public `grantsByGrantee` mapping could call `consumeRead` repeatedly and exhaust a victim's caps (DoS).

**V2 fix.** `CapabilityRegistryV2.consumeRead` requires `msg.sender == g.grantee`. The grantee-only invariant is enforced at the contract boundary.

---

## 8 · ERC-7857 attestor signatures

**Primitive.** `Erc7857Verifier.sol` accepts attestor-signed integrity proofs. The signed payload is `keccak256(abi.encodePacked(recipient, metadataHash, nonce, address(this), block.chainid))` prefixed with `\x19Ethereum Signed Message:\n32`. Replay protection lives in `usedNonces` keyed on `keccak(recipient, metadataHash, nonce)`.

**EIP-712 migration.** Newer deploys use OpenZeppelin's `ECDSA.recover` (handles malleability and length checks) plus a full domain separator with deadline. The chainid and contract address are included in the domain so signatures cannot replay across networks or contracts.

---

## 9 · Cross-references

- `docs/RECEIPT_SCHEMA.md` — receipt body layout and which fields are signed.
- `docs/MAINNET_READINESS.md` — chain-deploy gates.
- `docs/HASH_FUNCTION.md` — RFC-8785 canonical hash and polyglot reference verifiers.
- `docs/PRIVACY_NOTES.md` — operator-side disclosure boundaries and TIER 1 vs TIER 2 marking.
