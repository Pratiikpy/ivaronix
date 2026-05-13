# P17 CLI test phase · notes · 2026-05-13

Per UI_REAL_USER_TEST_PLAN.md Part 2 / P17. Tests every shipped `pnpm ivaronix <cmd>` against Galileo testnet.

## A · System

| Command | Result |
|---|---|
| `pnpm ivaronix doctor` | ✅ ran · operator wallet balance reads correctly · all dependency checks pass |
| `pnpm ivaronix doctor balance` | ✅ prints operator wallet balance in OG |

## B · Skills

| Command | Result |
|---|---|
| `pnpm ivaronix skill list` | ✅ lists all 156 skills (first-party + imported community catalog · same count as `/skills` page · cross-tool consistency) |
| Visible: `private-doc-review v0.3.1` · tier=standard · 🔒 burn 🛡 tee | ✅ first-party shows full metadata |

## C · Passport

| Command | Result |
|---|---|
| `pnpm ivaronix passport show` | ✅ tokenId 1 · trustScore 0 · receiptCount 0 · violationCount 0 · minted 2026-05-12T11:08:18Z · Explorer link to 0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d (AgentPassportINFTV2) |

## D · Receipts

| Command | Receipt | Result |
|---|---|---|
| `receipt show 16` | rec_16 (P2 desktop demo · V2) | ✅ receiptRoot · storageRoot · attestationHash · agent · timestamp · type · registry |
| `receipt show 17` | rec_17 (P2 mobile demo · V2) | ✅ same shape |
| `receipt show 20` | rec_20 (P3 user-wallet · V2) | ✅ same shape · type=3 |
| `receipt show 1004` | canonical sample (V1 LEGACY) | ✅ shows V1 LEGACY badge · zero attestationHash (legacy unattested) |
| `receipt verify 1004 --tee-independent` | (V1 unattested) | ✅ schema PASS · hash PASS · signature PASS · CLAIMED · chain anchor PASS · ANCHORED · TEE check FAIL (broker:`getting signature error` — expected for unattested V1) · final status: ANCHORED (honest) |
| `receipt verify 20 --tee-independent` | (V2 with attestation) | ⚠ F4: "No receipt resolves '20'" — body not in local cache (was anchored on Vercel /tmp). |

## F4 follow-up: 0G Storage body-fetch on local cache miss

The verify path needs the body JSON to canonical-hash + signature-recover. For receipts anchored from the operator's local CLI, the body is at `.ivaronix/receipts/anchored/<id>.json`. For receipts anchored via Vercel-hosted Studio, the body went to `/tmp` (lambda-ephemeral) and is wiped before the next request.

Workaround for v1: anchor receipts via CLI for ones that need full re-verification on the same machine. Stranger-replay path via `/r/<id>` web page works regardless (the chain anchor + storageRoot are public).

v1.1: add `0G Storage` body-fetch to the verify resolver — pull body from `storageRoot` when local cache misses.

## E · Verification cross-tool consistency

For every receipt I `receipt show`'d, the receiptRoot matches what `/r/<id>` displays. UI ⇆ CLI byte-equality confirmed across receipts 16, 17, 20, 1004.

## P17 Status

PASS for:
- `doctor`, `doctor balance`
- `skill list`
- `passport show`
- `receipt show <id>` (all variants · V1 LEGACY · V2)
- `receipt verify <id> --tee-independent` for V1 LEGACY (honest TEE-fail handling)

DEFERRED (gated on F4 fix):
- `receipt verify <id> --tee-independent` for V2 receipts not in local cache

Not tested this run (covered elsewhere):
- `passport mint` (P7 UI · tested cap via reverted dup tx 0x04f7ac…)
- `skill publish` (P3 setup notes · 2 chain writes proven)
- `memory snapshot / recall / grant / revoke` (P6 UI · gated state proven · KV server self-host deferred)
- `demo --pay/--subsidise/--no-payment` (P2 demo flow · UI side proven)

## CLI evidence

Console output captured at: `QA_PROOF_PACK/cli/p17-cli-sweep.txt` + `p17-verify-1004.txt`.

All output cross-checks against on-chain state · all read paths work · all error paths fail honestly.
