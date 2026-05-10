# Ivaronix · Receipt Canonical Hash · Specification

> Updated 2026-05-10. Pinned to `packages/core/src/jcs.ts` (TS reference impl).
> Polyglot reference verifiers (Rust + Go + Python) tracked in HALF_BAKED.md K-15.

---

## 1 · Why this matters

Every Ivaronix receipt commits to a `receiptRoot` on chain. The headline product claim — *"anyone can re-verify the receipt from any machine"* — only holds if the canonical hash is reproducible from any language. The original `canonical.ts` impl uses Node's `JSON.stringify` directly on values; a Rust or Go verifier cannot replicate Node's number-formatting + Unicode behaviour without porting V8.

**The fix:** RFC-8785 (JSON Canonicalization Scheme) + keccak256. RFC-8785 pins every step explicitly so any compliant implementation in any language produces byte-identical output.

---

## 2 · The algorithm

```
canonicalRoot = keccak256( JCS( strip(receiptBody) ) )
```

Where:

- **`strip(...)`** removes the canonical-hash exclusion set (the `signature` field, `chainAnchor` mutables, etc.) before hashing. Same exclusion list as `canonicalHash` — the difference vs V1 is the JSON serialiser, not the field set.
- **`JCS(...)`** serialises the stripped value per RFC-8785 §3:
  - **Numbers:** ECMAScript Number-to-string semantics with explicit carve-outs:
    - `0` → `"0"`, `-0` → `"0"` (both serialize as `0`)
    - `NaN` → reject
    - `±Infinity` → reject
    - All other doubles use ECMAScript's `String(n)` representation, which is byte-identical to RFC-8785's prescribed format for the receipt body's numeric ranges
  - **Strings:** UTF-8 NFC normalisation, then minimal escaping per RFC §3.2.2.2:
    - `"` → `\"`
    - `\` → `\\`
    - control chars (`< U+0020`) → `\uXXXX`
    - `\b`, `\t`, `\n`, `\f`, `\r` use their short-form escapes
    - all other Unicode passes through as raw UTF-8
  - **Objects:** keys sorted by UTF-16 code-unit value (ASCII order extends naturally; supplementary-plane keys are not used in any receipt). Keys with `undefined` values are skipped (per existing `canonical.ts` behaviour).
  - **Arrays:** order preserved; each element recursed.
  - **null** → `null`. **Booleans** → `true` / `false`.
- **`keccak256(...)`** is Ethereum's variant (NOT NIST SHA-3). UTF-8 input bytes; 32-byte output rendered as `0x` + 64 hex.

---

## 3 · Test vectors

Every reference implementation in any language MUST reproduce these byte-for-byte. The TS reference at `packages/core/src/jcs.test.ts` exercises 17 cases; the canonical vector list:

| Input | Expected JCS output |
|---|---|
| `null` | `null` |
| `true` | `true` |
| `false` | `false` |
| `0` | `0` |
| `-0` | `0` |
| `1` | `1` |
| `-1` | `-1` |
| `1234567890` | `1234567890` |
| `1.5` | `1.5` |
| `0.1` | `0.1` |
| `NaN` | (reject) |
| `Infinity` | (reject) |
| `""` | `""` |
| `"hello"` | `"hello"` |
| `"a\"b"` | `"a\"b"` (JSON-escaped) |
| `"a\\b"` | `"a\\b"` |
| `"a\nb"` | `"a\nb"` |
| `"ab"` | `"ab"` |
| `"é"` (U+0065 + U+0301) | `"é"` (NFC: U+00E9) |
| `{}` | `{}` |
| `[]` | `[]` |
| `{ b: 1, a: 2 }` | `{"a":2,"b":1}` |
| `{ z: 1, A: 2 }` | `{"A":2,"z":1}` |
| `[1,2,3]` | `[1,2,3]` |
| `[{ b: 1, a: 2 }]` | `[{"a":2,"b":1}]` |
| Receipt-shaped object (see jcs.test.ts:74) | (sorted at every level) |

When a polyglot verifier ships, it must include the same vectors as a hard CI gate.

---

## 4 · `schemaVersion` migration

Receipts produced before 2026-05-10 use the V1 canonical hash (Node-`JSON.stringify`-based). Bumping every existing receipt would invalidate 1,330+ on-chain `receiptRoot` values. The migration is **forward-only via a `schemaVersion` field at the receipt root**:

- **`schemaVersion: '1.0'` (or absent)** → use `canonicalHash(...)` from `packages/core/src/canonical.ts`.
- **`schemaVersion: '2.0'`** → use `canonicalHashV2(...)` from `packages/core/src/canonical.ts` (which is `keccak256(jcs(strip(value)))`).

The verifier branches on `schemaVersion` so v1 + v2 receipts coexist forever. Existing receipts stay byte-perfect on chain.

**Activation gate:** schemaVersion `2.0` is NOT yet the default for new receipts. New receipts continue to use v1 canonical hash UNTIL the polyglot reference verifiers ship. Activating v2 too early would mean only JS clients could verify those receipts, which is worse than the current state (where any custom verifier port at least has the JS-specific canonical to copy).

---

## 5 · Polyglot reference verifiers (in flight)

K-15 in HALF_BAKED.md tracks the full migration. Status as of 2026-05-10:

| Lang | Path | Status |
|---|---|---|
| TypeScript | `packages/core/src/jcs.ts` + `jcs.test.ts` | ✅ shipped (17/17 tests green) |
| Python | `scripts/verifier-py/jcs.py` + `test_jcs.py` | ✅ shipped (14/14 tests green) |
| Rust | `ivaronix-verifier-rs/` | ✅ shipped (11/11 tests green) |
| TS ↔ Python ↔ Rust cross-impl | `scripts/verifier-py/cross_check.py` | ✅ shipped (29/29 byte-equal across all three) |
| CI cross-impl gate | `.github/workflows/jcs-roundtrip.yml` | ✅ shipped — runs all four self-suites + the cross-impl harness on every PR + push |
| Go | `verifier-go/` (planned) | queued — operator action: `winget install GoLang.Go` (or apt/brew/etc.) then the next cron firing extends `cross_check.py` with `go run ./cmd/verifier-go` and adds a Go job to the CI workflow |

Each language MUST implement:
1. The RFC-8785 JCS function over the test vectors above (§3).
2. `keccak256` over the JCS bytes (use the language's standard EVM-compatible keccak256, NOT NIST SHA-3).
3. ECDSA signer recovery to verify the `signature` field on the receipt body (the same surface as `verifyClaimed` in `packages/receipts/src/verify.ts`).
4. EIP-1186 JSON-RPC `eth_call` against `ReceiptRegistry.receipts(id)` to confirm the on-chain anchor matches the local body.

The cross-impl CI test runs all four languages over a fixed corpus of vectors AND a fresh fuzz of 100 randomly-generated objects, asserting byte-equality of the canonical output. Block merge on divergence.

---

## 6 · Operator-action gates (when polyglot lands)

- **`crates.io` publish:** `! cargo login` then `cargo publish` from `ivaronix-verifier-rs/`. The Rust crate will be public + reproducible.
- **Go module publish:** push the `verifier-go/` repo with the right module path (e.g. `github.com/ivaronix/verifier-go`); Go's module system pulls from the git tag.
- **Python script:** stays in repo (single file, no package). README documents the run command.

These are the only operator actions; the code work is mine.

---

## 7 · Honesty about the corner cases

The TS reference implementation handles every case the test vectors cover. The full RFC-8785 number formatter has additional edge cases around very small / very large doubles (e.g. `1e-308`-scale) that are not exercised by any current Ivaronix receipt. If a future receipt needs them, extend `serializeNumber` in `jcs.ts` AND add a vector to `jcs.test.ts` BEFORE pushing the change. The cross-impl CI test will catch any divergence against the polyglot impls.

For Unicode: NFC normalisation is applied to every string. Supplementary-plane characters (`> U+FFFF`) work correctly because JS strings are UTF-16; the impl iterates by `charCodeAt` for control-char detection but emits the original character's UTF-8 bytes through `TextEncoder`. The test vector `"é"` (U+0065 + U+0301 → NFC U+00E9) is the canonical proof.

---

## 8 · Cross-references

- `packages/core/src/jcs.ts` — TS reference implementation.
- `packages/core/src/jcs.test.ts` — RFC-8785 test vectors (17 cases).
- `packages/core/src/canonical.ts` — V1 canonical hash + the new `canonicalHashV2`.
- `packages/receipts/src/schema.ts` — receipt schema (the `schemaVersion` gate lands when polyglot ships).
- `packages/receipts/src/verify.ts` — receipt verifier (branch on schemaVersion lands when polyglot ships).
- `docs/HALF_BAKED.md` Section N · K-15 — execution plan + status for the full migration.
- `docs/USER_TODO.md` — operator-action gates for crates.io / Go publish.
- `RECEIPTS_SPEC.md` — receipt body shape + signing rules.
- `docs/CRYPTO_NOTES.md` — Ivaronix-wide crypto threat models.
