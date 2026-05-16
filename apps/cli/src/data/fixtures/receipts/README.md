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

| ULID | On-chain id | Tier | Status |
|---|---|---|---|
| `rcpt_01KRR69YKYSACE5Y25PQWF2XEW` | 66 | quick | FULLY VERIFIED ✓ |
| `rcpt_01KRR7X3BW8VJJ65KMQSQHT04H` | 68 | high-stakes (5-role) | FULLY VERIFIED ✓ |
| `rcpt_01KRR8EP8QHSE5BRFD8GG9X9FR` | 70 | audit (6-role) | FULLY VERIFIED ✓ |

Try the README's quick start:

```bash
pnpm ivaronix receipt verify 66 --network mainnet
pnpm ivaronix receipt verify 68 --network mainnet --tee-independent
pnpm ivaronix receipt verify 70 --network mainnet --tee-independent
```

All three should produce `FULLY VERIFIED ✓` on a fresh clone.

## Why bundle these?

The "anyone can verify on any machine, no account" claim is the
load-bearing trust statement of the product. If a stranger has to
acquire credentials before they can replay, the claim is materially
weaker. Bundled fixtures close that gap.
