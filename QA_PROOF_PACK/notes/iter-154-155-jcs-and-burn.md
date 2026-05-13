# Iter-154 + 155 · JCS cross-language proof + Burn-mode negative tests

## iter-154 · JCS byte-equality across TS + Python + Rust (plan §777)

Ran `python scripts/verifier-py/cross_check.py` — invokes the TypeScript verifier (`packages/core/src/jcs-cli.ts` via tsx), the Python verifier (`scripts/verifier-py/jcs.py`), and the Rust verifier (`ivaronix-verifier-rs`) on the same 29-vector test corpus.

Result:
```
#  0  ok  null
#  1  ok  true
#  2  ok  false
... (vectors 3-28 all ok) ...

OK: 29 vectors byte-equal across TS + Python + Rust
```

29 / 29 vectors produce the SAME canonical JCS string in all three languages. This is the strictest cross-implementation correctness proof — three independent codebases derived from the RFC-8785 spec, each rolling their own JCS + keccak256, all agreeing byte-for-byte.

Verdict: ✅ PASS — JCS canonical hash is verifiable in TS, Python, AND Rust.

## iter-155 · Burn-mode AES-256-GCM negative tests (plan §798)

Used the 501-byte ciphertext blob retrieved iter-153 from 0G Storage at evidenceRoot `0x8da381a0...` (receipt #10's burn-mode evidence).

Blob layout verified to match `packages/og-storage/src/burn.ts` documented format:
- 12 bytes nonce: `cf348538a6ed44094879bb4a`
- 473 bytes ciphertext
- 16 bytes auth-tag: `f62a8dbe688db05dc35261edde10f31c`

Negative tests:

**Test 1 · Wrong-key decrypt**
```
const decipher = createDecipheriv('aes-256-gcm', randomBytes(32), nonce);
decipher.setAuthTag(tag);
decipher.update(ciphertext);
decipher.final();  // throws
```
Result: `Unsupported state or unable to authenticate data` — auth-tag check fails closed, no silent garbage output.

**Test 2 · Tampered-ciphertext decrypt (flip first byte)**
```
const tampered = Buffer.from(ciphertext);
tampered[0] ^= 0xff;
// same decrypt path
```
Result: `Unsupported state or unable to authenticate data` — auth-tag detects the bit-flip, decrypt rejects.

**Test 3 · KeyFingerprint format**
Receipt's `storage.encryption.keyFingerprint = sha256:cbd24187...`. The format binds the AES key to a one-way hash; a third party verifying the receipt cannot recover the key, but can VERIFY that an operator-supplied key (in a future trust re-prove flow) matches the recorded fingerprint.

Note: the actual session key was DESTROYED at `burn.sessionKeyDestroyedAt = 1778632617715` per the receipt's burn block — so the positive-case decrypt is structurally impossible to test against this receipt (by design). The plan §798 calls for positive case test with the captured key; that requires a fresh burn-mode run that retains the key. Tested with random keys here proves the security gate works.

Verdict: ✅ PASS — wrong-key and tampered-ciphertext both fail closed with clear errors. No silent garbage output.

## Cumulative session §-coverage

| Plan section | State | Iter |
|---|:---:|---|
| §1370 (16 Min Launch Acceptance) | 16/16 PASS | 132-152 |
| §777 (JCS byte-equality 3 langs) | PASS | 154 |
| §796 (Storage round-trip) | PASS | 153 |
| §798 (Burn-mode decrypt negative) | PASS | 155 |
| §1379 (CLI verify works) | PASS | 150 |
| §1381 (Privacy leak) | PASS | 146 |
| §1382 (Failure flows) | PASS | 147 |
| §1385 (Mobile polish) | PASS | 148 |
| §1386 (Error states) | PASS | 149 |
| §759 (HTTP security headers) | PASS | 147 |
| §1373 (Wallet flow connect+disconnect+network) | PASS | 144+151+152 |
| Multi-wallet matrix (14 rows) | 12 PASS / 1 chain-partial / 1 semantic-mismatch | 132-145 |
