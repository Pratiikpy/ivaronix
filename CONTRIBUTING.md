# Contributing

Thanks for taking the time. Reading this before opening a PR saves a round trip.

## Local setup

```bash
git clone https://github.com/Pratiikpy/ivaronix.git
cd ivaronix
pnpm install
```

Prerequisites: Node 20+ or 22+, pnpm 9+ or 10+, Foundry (only if you touch contracts).

## Before you open a PR

Run locally. CI gates all of these.

```bash
pnpm -r typecheck                                  # every workspace package
pnpm --filter @ivaronix/core test                   # canonical-hash regressions
pnpm --filter @ivaronix/consensus test              # consensus gates and tiers
pnpm --filter @ivaronix/receipts test               # receipt builder and fee split
pnpm --filter @ivaronix/skills test                 # skill manifest schema
pnpm --filter @ivaronix/memory test                 # memory encryption
pnpm --filter qa-metamask-e2e run regressions:studio    # Studio source-file checks
pnpm --filter qa-metamask-e2e run regressions:cli       # CLI checks
pnpm --filter qa-metamask-e2e run regressions:contracts # contract V2 checks
pnpm docs:check                                    # numbers freshness gate
pnpm receipt-types:check                            # receipt-type enum vs spec
```

For contract changes, also run `cd contracts && forge test`.

## Commits

- Conventional commits: `feat(scope): subject`, `fix(scope): subject`, `chore(scope): subject`, `docs(scope): subject`. Subject 70 characters or fewer.
- Subject and body only — no co-author trailers.
- Do not bypass commit hooks (`--no-verify`, `--no-gpg-sign`, etc.). If a hook fails, fix the underlying issue.

## Tests

- Package unit tests live in `packages/<name>/src/*.test.ts` and run via `tsx --test`.
- Source-file regressions live in `scripts/qa/metamask-e2e/verify-*.ts`. Plain TypeScript scripts that exit 1 on failure.
- Contract tests live in `contracts/test/<Contract>.t.sol` and run via `forge test`. Test private keys must be deterministic hex-pattern fills; never use real keys.

## Solidity NatSpec

NatSpec compiles into permanent contract metadata.

- `@notice` and `@dev` describe what the contract does, not when it was written.
- Every security-sensitive contract opens with a `Threat model:` block — what it defends, what it does not defend, assumed attacker capabilities. See `contracts/src/CapabilityRegistry.sol` for the pattern.
- No upgradeability. A V2 contract is a new contract at a new address; V1 stays live for legacy state. Off-chain readers branch on `chainAnchor.registryAddress`.

## Brand assets

The MIT licence in `LICENSE` covers code. The `brand/` directory ships under a separate licence — see [BRAND.md](BRAND.md).

## Auto-rendered docs

Some files render from a source of truth. Refresh and commit the diff in the same PR.

```bash
pnpm receipt-types:render    # after editing packages/core/src/types.ts RECEIPT_TYPES
pnpm docs:render             # after bumping a value in docs/numbers.json
```

## Questions

Open an issue. Use the appropriate package label (`studio`, `cli`, `contracts`, `og-router`, `og-chain`, `og-storage`, `core`).
