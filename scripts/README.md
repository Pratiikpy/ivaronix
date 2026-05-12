# `scripts/` — task launcher index

> Closes planning-003 §A.5.6. The 13 one-off TS scripts that previously sat at `scripts/*.ts` are now sorted into four subdirs by purpose. Two duplicate files (`smoke-storage.ts` + `storage-smoke.ts`) collapsed into the single canonical `smoke/smoke-storage.ts`.

## Layout

| Subdir | Purpose | When to add a script here |
|---|---|---|
| `ops/` | One-shot operations against live testnet/mainnet (anchor a receipt, batch-anchor every type, run end-to-end happy-path) | Operator runs this manually; produces real on-chain side effects; no CI gate |
| `migrations/` | Schema or data migrations against the repo or external systems | Code/data shape change that needs to land once, then never run again |
| `smoke/` | Smoke tests against live infrastructure (storage, router, chain) | Production-path verification; quick "is the integration alive" checks |
| `diag/` | Diagnostics + maintenance | Read-only inspection (router status, wallet balance, doc numbers refresh, fresh-wallet probe) |
| `dev/` | Local-dev infrastructure (KV node, etc.) | Things needed to run the codebase locally |
| `qa/` | QA harness + Playwright + verify-*.ts | End-to-end source-file regressions and live MetaMask flows |
| `verifier-py/` | Python receipt verifier (RFC-8785 polyglot) | Cross-language verifier for the Polyglot Receipt Receiver story |
| `wander-cycle/` | Autonomous receipt-anchoring agent (planning-003 §A.4.1) | The 5-min-cadence cycle that drives sustained receipt volume |

## Inventory (2026-05-10)

```
scripts/
├── ops/
│   ├── anchor-all-receipt-types.ts      # batch anchor one of each receipt type
│   ├── automate-receipts-testnet.ts     # bulk anchor pipeline for testnet
│   └── build-hello-receipt.ts           # smallest-possible receipt build path
├── migrations/
│   ├── migrate-openclaw-metadata.ts     # one-shot OpenClaw metadata migration
│   └── port-awesome-claude-skills.ts    # awesome-claude-skills → seed-skills/
├── smoke/
│   ├── chat-tools-smoke.ts              # router chat-tools surface
│   ├── cron-smoke.ts                    # cron-job smoke
│   ├── og-toolkit-smoke.ts              # @ivaronix/og-toolkit happy path
│   └── smoke-storage.ts                 # 0G Storage upload + burn-mode encryption
├── diag/
│   ├── audit-list.ts                    # walk `git log --grep "Closes audit"` (B-V2-13)
│   ├── debug-router.ts                  # router credential rotation/balance probe
│   ├── docs-render.ts                   # render `<!-- numbers:auto:KEY -->` markers (A.2.7)
│   ├── env-check.ts                     # canonical/legacy env-var diagnostic (B-V2-11)
│   ├── fresh-wallet-onboard.ts          # generate fresh wallet + run onboarding
│   ├── numbers-refresh.ts               # refresh docs/numbers.json from chain
│   └── render-receipt-types.ts          # RECEIPTS_SPEC §1 type table from RECEIPT_TYPES enum
├── dev/
│   ├── Dockerfile.kv-node               # local 0G KV node
│   └── start-local-0g-kv.ts             # bring it up
├── qa/
│   ├── code-interactive-test.ts
│   ├── fresh-wallet-mint.ts
│   ├── mcp-e2e-test.ts
│   ├── telegram-backend-test.ts
│   └── metamask-e2e/                    # Playwright + verify-*.ts source-file regressions
│       ├── capture-readme-shots.ts      # 6 README PNG stills (A.2.2)
│       ├── capture-readme-tour.ts       # 30s README .webm tour (A.2.2)
│       └── verify-a*.ts                 # 6 offline regressions (a11/a13/a22/a27/a44/a48)
├── verifier-py/                         # Python RFC-8785 cross-language receipt verifier
└── wander-cycle/                        # autonomous receipt-anchoring agent
    ├── README.md
    ├── cycle.ts
    ├── loop.ts
    └── synthetic-leases.ts
```

## Running

Most scripts are pnpm-script-shimmed. Diag aliases at the workspace root:

```bash
pnpm numbers:refresh         # refresh docs/numbers.json from chain
pnpm numbers:check           # CI gate · exit 1 if numbers.json >24h old
pnpm receipt-types:render    # regenerate RECEIPTS_SPEC §1 from source enum
pnpm receipt-types:check     # CI gate · exit 1 if doc out of sync
pnpm docs:render             # substitute `<!-- numbers:auto:KEY -->` markers
pnpm docs:check              # CI gate · drift OR >24h-stale numbers.json
pnpm audit:list              # rolling audit-closure ledger from git log
pnpm audit:list --grep A.5   # filter by audit ID substring
pnpm env:check               # canonical/legacy env-var diagnostic
pnpm og-font:regenerate      # regenerate Outfit-SemiBold.b64.ts from .ttf source
pnpm og-font:verify          # CI gate · exit 1 if b64.ts ↔ .ttf round-trip drifts
pnpm screenshots:refresh     # capture 6 README PNGs (needs Studio dev)
pnpm tour:refresh            # capture 30s README tour video (needs Studio dev)
```

Path migration note (planning-003 §A.5.6): the two scripts that moved from `scripts/*.ts` → `scripts/diag/*.ts` keep their workspace-root aliases unchanged:

```bash
pnpm numbers:refresh   # was scripts/numbers-refresh.ts → now scripts/diag/numbers-refresh.ts
pnpm numbers:check     # same path
```

Direct invocation:

```bash
pnpm tsx scripts/smoke/smoke-storage.ts
pnpm tsx scripts/diag/debug-router.ts
pnpm tsx scripts/ops/anchor-all-receipt-types.ts
```

Each script reads the operator wallet key from `IVARONIX_SIGNER_KEY` (or legacy `OG_PRIVATE_KEY` / `EVM_PRIVATE_KEY`) per `packages/runtime/src/env.ts`.

## See also

- `package.json` — pnpm-script aliases that wrap the most common scripts.
- `docs/CI_WALLET.md` — runbook for the scoped CI wallet that runs the chain-smoke workflow on PRs.
- `.github/workflows/chain-smoke.yml` — CI gate that drives the smoke set on label-trigger and nightly cron.
