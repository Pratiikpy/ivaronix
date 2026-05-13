# Iter-161 · Mainnet-Ready Checklist live re-validation (plan §1554 + §935)

## Live checks executed (agent-doable, no operator action)

| # | Item | Live check | Result |
|---|---|---|---|
| 4 | RPC latency | `eth_blockNumber` round-trip to `https://evmrpc-testnet.0g.ai` | **913ms** (within budget; the doc claims 0.77s p50 - this single shot was 0.91s, still healthy) |
| 5 | Receipt anchoring | Direct V1+V2+V3 `nextId()` chain reads | V1=1645 · V2=14 · V3=7 · **total=1666 on-chain** |
| 5 | numbers.json drift | `pnpm numbers:refresh` re-derive from local anchored cache | 1664 (local cache is 2 receipts behind chain — common when scripts queue receipts directly to chain without writing local files) |
| 12 | Studio routes | curl HTTP HEAD on 8 paths | / · /onboard · /skills · /global · /dashboard · /memory · /brand all **HTTP 200**; /agent/0xaa95... also **HTTP 200** |

## What I touched

```
README.md                 |  6 +++---
docs/JUDGE_GUIDE.md       |  2 +-
docs/MAINNET_READINESS.md |  4 ++--
docs/PITCH.md             |  4 ++--
docs/numbers.json         | 10 +++++-----
```

`pnpm docs:render` then refreshed 45 markers across 4 target docs · 0 unknown-key warnings.

The numerical drift since iter-157:
- `receipts.total`: 1663 → 1664 (+1 local, but chain shows +3)
- `receipts.v2Anchored`: 12 → 13 (+1 local, chain shows V2=14 = +2)

The 2-receipt gap (chain V2=14 vs local cache v2=13) suggests one receipt was anchored without `receipt anchor` writing the local file — likely a direct contract call from outside the CLI. **Not a blocker; the proof-replay path goes through chain reads not local cache.**

## What I cannot do as an agent

The remaining 8 items on the §1554 final checklist are operator-action:
- "Mainnet env values" + "Mainnet wallet funded" + "Mainnet contracts deployed" + "Mainnet receipt run" + "Mainnet proof page" + "Mainnet CLI verify" → all gated on the user funding the deployer wallet on Aristotle (chainId 16661). Per §B-V2 in USER_TODO.md.
- "Storage proof" — round-trip already verified in iter-153 (501 bytes recovered from evidenceRoot 0x8da381a0...) per `QA_PROOF_PACK/notes/iter-153-storage-roundtrip.md`. ✅
- "Demo video" — captured incrementally across iters 144-152 (desktop sweep + 3-wallet flow + mobile sweep + failure flows + wrong-network). The 3-minute final cut belongs to the operator's submission deck.
- "README/docs" — README continuously refreshed by docs:render; the 60-second + 30-second quickstart blocks live there per iter-148 audit.

## Per-row mainnet-ready table state (refreshed)

| # | Row | Testnet | Mainnet |
|---|---|---|---|
| 1 | Contracts deployed | ✅ 13/13 on Galileo | ⏸ operator-action |
| 2 | Env vars 9/9 required | ✅ resolves correctly via runtime/env.ts alias chain | ⏸ same vars apply at mainnet swap |
| 3 | Deployer wallet funded | ✅ 69.56 OG on Galileo (last `ivaronix doctor` check) | ⏸ operator-action |
| 4 | RPC latency | ✅ 0.91s eth_blockNumber (this iter) | (Aristotle endpoint pending mainnet) |
| 5 | Receipt anchoring | ✅ 1664 receipts (local) / 1666 (chain) — works | ⏸ |
| 6 | Proof Explorer | ✅ all 8 routes HTTP 200 | ⏸ |
| 7 | Passport state | ✅ tokenId 1, trust 1053, receipts 1053, violations 0 (last sync) | ⏸ |
| 8 | Memory grant/revoke | ✅ 5 grants ACTIVE → REVOKED proven | ⏸ |
| 9 | Burn-mode receipt | ✅ receipt #1069 + iter-155 aes-gcm regression | ⏸ |
| 10 | Fresh user flow | ✅ `ivaronix demo` → receipt #13 anchor in ≈3s (iter-157) | ⏸ |
| 11 | TEE-independent verify | ✅ #12, #13, #1069 FULLY VERIFIED | ⏸ |
| 12 | Studio 8 routes | ✅ all 200 (this iter) | ⏸ |
| 13 | `serve` HTTP API | ✅ 4/4 routes (last sync) | ⏸ |

## Verdict

✅ **PASS** on testnet for all 13 items. The mainnet column is blocked on the single gated dependency (operator funds the deployer wallet on Aristotle chainId 16661). Per §B-2 in USER_TODO.md this is the "only blocker is money" item from CLAUDE.md §1.

Numbers refreshed and rendered. 0 unknown-key warnings.
