# Receipt fixtures

These are real, mainnet-anchored receipt bodies bundled with the repo so
that `pnpm ivaronix receipt verify <id>` works on a fresh clone WITHOUT
needing 0G Storage credentials.

Without these fixtures, a stranger who clones the repo and runs the
README's headline command would hit "IVARONIX_SIGNER_KEY is required
because the 0G Storage indexer requires a signer for reads" — because
the verifier tries to download the body from 0G Storage.

With these fixtures, the verifier finds the body locally and the
schema/hash/signature/chain checks all pass without any auth. TEE
re-attestation (`--tee-independent`) still works because the broker
endpoint accepts unauthenticated `processResponse` queries.

## Bundled receipts

| ULID | On-chain id | Skill | Tier | Status |
|---|---|---|---|---|
| `rcpt_01KRR69YKYSACE5Y25PQWF2XEW` | 66 | private-doc-review | quick | FULLY VERIFIED ✓ |
| `rcpt_01KRR7X3BW8VJJ65KMQSQHT04H` | 68 | private-doc-review | high-stakes (5-role) | FULLY VERIFIED ✓ |
| `rcpt_01KRR8EP8QHSE5BRFD8GG9X9FR` | 70 | private-doc-review | audit (6-role) | FULLY VERIFIED ✓ |
| `rcpt_01KRV2M9DM0QY1D5N1DKR8JBWS` | 124 | legal-citation-verifier | high-stakes (5-role) | FULLY VERIFIED ✓ · Bug-72 proof |
| `rcpt_01KRV4ZAJHSRDJ0A0GY2QCVF2A` | 126 | term-sheet-risk-scanner | high-stakes (5-role) | FULLY VERIFIED ✓ · Bug-72 proof |
| `rcpt_01KRV5AHFAPFRX0MKQZAD6HSK2` | 129 | nda-triage-reviewer | standard (3-role) · PAID | anchored |
| `rcpt_01KRV5CY3YP1197J1Y6SH9GSM1` | 130 | contract-renewal-clause-detector | standard (3-role) · PAID | anchored |
| `rcpt_01KRV5EWQZSVAQGH4W9ARYQ395` | 131 | private-doc-review | quick · PAID | anchored |
| `rcpt_01KRV7E0D1PXCVT7TA8AACE7BF` | 134 | private-doc-review | quick · 🔒 Burn Mode (AES-256-GCM) | FULLY VERIFIED ✓ |

Try the README's quick start:

```bash
pnpm ivaronix receipt verify 66 --network mainnet
pnpm ivaronix receipt verify 68 --network mainnet --tee-independent
pnpm ivaronix receipt verify 70 --network mainnet --tee-independent
# Bug-72 keyring-rotation fix · 2026-05-17 · all 5 first-party skills proven:
pnpm ivaronix receipt verify 124 --network mainnet --tee-independent  # legal-citation 5-role
pnpm ivaronix receipt verify 126 --network mainnet --tee-independent  # term-sheet 5-role
pnpm ivaronix receipt verify 129 --network mainnet                    # nda-triage paid 3-role
pnpm ivaronix receipt verify 130 --network mainnet                    # contract-renewal paid 3-role
pnpm ivaronix receipt verify 131 --network mainnet                    # private-doc paid quick
pnpm ivaronix receipt verify 134 --network mainnet --tee-independent  # Burn Mode · key destroyed
```

All 9 should produce `FULLY VERIFIED ✓` or `ANCHORED ✓` on a fresh clone.

## Why bundle these?

The "anyone can verify on any machine, no account" claim is the
load-bearing trust statement of the product. If a stranger has to
acquire credentials before they can replay, the claim is materially
weaker. Bundled fixtures close that gap.
