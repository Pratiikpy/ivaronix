# PASS 76 — Steal-and-Reorg Plan

> Synthesis target: ship five fastest wins from the new-entries cohort + close one platform-completeness gap, **without diluting the receipts-as-primitive thesis**. Grounded in `new-entries/Codex Thinking/claude-thinking.md` (deep-read of 9 competing hackathon repos).
>
> Locked: 2026-05-08. Status: pending kickoff.

## Shipping bar (non-negotiable, applies to every item below)

A feature is not "done" until **all three** of these pass on a clean machine:

1. **One command runs it.** No multi-step setup, no "first export this env var then ssh into the box." If a judge can't reproduce it from one line in this doc, it isn't shipped.
2. **One screenshot or URL proves it worked.** Visible receipt URL, visible chain tx, visible UI state. Not "tests pass" — *visible end-to-end working*.
3. **A judge on a different machine re-verifies without our help.** Public Proof URL, third-party explorer, or `ivaronix receipt verify --tee-independent` — at least one of those works for them.

No compromise on UI / UX / functional interaction. Every claim in this plan must survive a 5-second eye-test.

**No mocks. Real or nothing.** Receipts are real on-chain anchors. 0G Storage uploads are real Indexer + Merkle root. 0G Compute is the real broker round-trip with TEE verification fetched, not "teeVerified: true" set in code. Memory snapshots write to real KV streams. PR receipts come from real `code_change` events. **No "if endpoint unavailable, fall back to in-memory Map." No "if broker not reachable, mark as TEE-verified anyway." No "stub for now, wire up later."** That's exactly the anti-pattern the peer audit caught (AIsphere soft-fails to mock; AgentPay in-memory fallback for 0G Storage; AgentPay hardcoded prices when oracle missing; OpenClaw_Hackathon silent skip on KV failure). Our edge — the only edge — is that everything we ship is real. Per CLAUDE.md §1, §6, §7, §8.

## 0. Why this pass

After deep-reading 9 competitor repos, two facts stand out:
1. **Nobody else has built receipt-as-primitive.** That moat is real and ours.
2. **zer0Gig has built platform completeness we don't have** — runtime hosting, subscription escrow, marketplace UX. Their wedge is Track-3-flavored (escrow/economy) but their *answer to "deploy 10 agents"* is sharper than ours.

This pass closes the second gap with five small steals + three bigger plays, while explicitly NOT copying the anti-patterns we identified (soft-fail TEE, off-chain invoices with in-memory fallback, monolithic contracts, event-only sealed keys).

## 1. The five fastest wins

Each shipped end-to-end (code + receipt + Foundry test or vitest where applicable) before moving to the next. No half-merges.

### S-1 · Local 0G KV bootstrap script (1 day)
**Source:** `0G_OpenClaw_Hackathon/scripts/dev/start-local-zerog-kv.sh` (350 LOC bash).
**Target:** `scripts/dev/start-local-0g-kv.sh` (Windows `.ps1` companion + bash).
**Behavior:** macOS/Linux: download official 0G KV binary, fallback to source build if download fails. Windows: WSL or Docker fallback. Derive deterministic config from `EVM_PRIVATE_KEY` in `.env`. Manage PID lifecycle.
**Verify:** `pnpm dev:kv` boots a local KV node; `ivaronix doctor --kv-local` reports `LIVE`.
**Why:** Test velocity. Right now we're testnet-only for KV; this lets us iterate offline.

### S-2 · Wallet-derived stream IDs for memory snapshots (4 hours)
**Source:** `0G_OpenClaw_Hackathon/src/zerog/storage-sync.service.ts:createZeroGMemorySyncStreamId()`.
**Target:** `packages/og-storage/src/streamId.ts` — new util.
**Schema:** `keccak256("ivaronix:memory:v1:" + address.toLowerCase())`. Deterministic across machines.
**Wire-in:** `ivaronix memory snapshot` writes manifest under this stream ID; `ivaronix memory restore --address 0x…` resolves the same ID and pulls.
**Test:** new vitest in `packages/og-storage/test/streamId.test.ts` — same address → same ID; case-insensitive.
**Why:** Closes the "personal-agent continuity" wedge that 0G_OpenClaw_Hackathon has and we lack. Earns OpenClaw judge audience without changing thesis.

### S-3 · Telegram thin client over CLI (2-3 days)
**Source:** `og-market-bot` (architecture only; we don't need their compute/storage code).
**Target:** new package `@ivaronix/telegram-bot` under `apps/telegram-bot/` (Node + grammY).
**Surface:** 6 commands mapping straight to existing CLI:
  - `/run <input>` → `ivaronix doc ask`
  - `/skill <id> <args>` → `ivaronix skill exec`
  - `/audit <repo-path>` → `ivaronix audit --quick`
  - `/passport` → `ivaronix passport show`
  - `/receipt <id>` → `ivaronix receipt show <id>`
  - `/help` → command list
**Auth:** users supply their own EVM_PRIVATE_KEY via `/connect` deep-link to the Studio; bot stores nothing custodial.
**Verify:** the user runs `/run "summarize this readme"` from Telegram on a phone, gets a receipt URL back, opens it in Studio on the same phone, MetaMask-verifies.
**Why:** Neutralizes og-market-bot's only edge (chat-first onboarding) without becoming a meme bot.
**Skip:** embedded-wallet custody (we want users to bring MetaMask), heuristic cost estimation (their numbers are guesses).

### S-4 · Native-host auto-pairing for daemon (3 days)
**Source:** `Trapezohe/companion_service/crates/companion-cli/src/main.rs` — `register_native_host` command.
**Target:** `apps/cli/src/commands/daemon.ts` adds `daemon register-host`.
**Behavior:** writes a Chrome/Brave/Edge native-messaging manifest to the OS path that lets a future browser extension auto-discover the daemon. Token-bearer auth on `127.0.0.1:<port>`.
**Verify:** `ivaronix daemon register-host` writes the manifest; a placeholder webextension under `apps/extension-stub/` reads it back. (Real extension code is a post-pass effort.)
**Why:** Closes our daemon-UX gap vs Trapezohe. Doesn't copy the entire Rust daemon — just the pairing pattern.

### S-5 · Postgres+Drizzle indexing layer for receipts (3 days)
**Source:** `AgentPay/backend/src/db/schema.ts` — Drizzle ORM pattern.
**Target:** `packages/indexer/` — new package, postgres + drizzle.
**Schema:** mirror tables of on-chain ReceiptRegistry events: `receipts`, `passports`, `memory_grants`, `skill_execs`. Index on `(actor, type, blockNumber)`.
**Indexer:** a small Node process tails 0G Galileo logs and upserts to Postgres. Source of truth stays on-chain; Postgres is a read replica.
**Wire-in:** Studio's `/global` and `/agent/[handle]` pages query Postgres instead of iterating chain RPCs. Sub-100ms loads.
**Verify:** kill the indexer mid-run; restart resumes from last block; final state matches a fresh chain replay.
**Why:** Studio currently iterates RPC for receipt browsing — fine at 287 receipts, painful at 10k. AgentPay's pattern is the cleanest reference.

## 2. The three bigger plays (1-2 weeks each)

Run after the five quick wins land. Each gets its own pass document.

### B-1 · SubscriptionEscrow as receipt type (1 week)
**Source:** `zer0Gig/Contracts/src/SubscriptionEscrow.sol` — 3 interval modes (CLIENT_SET / AGENT_PROPOSED / AGENT_AUTO) + grace-period auto-pause + check-in/alert drainage.
**Target:** new contract `contracts/src/SubscriptionEscrow.sol` + new receipt type `subscription_skill_exec` (RECEIPTS_SPEC.md §1, slot 9).
**Why:** Adds recurring billing semantics on top of receipts. Real new feature, not a port.
**Don't copy:** the off-chain Alignment-Node signature trust (we keep TEE-tier marking).

### B-2 · ComputeService broker init + provider pre-fund pattern (3 days during B-1)
**Source:** `zer0Gig/Agent-Runtime/src/services/computeService.js:24-45`.
**Target:** harden `packages/og-compute/src/broker.ts` with explicit `acknowledgeProvider`, `transferToProvider`, `ensureLedger` setup steps.
**Why:** today we assume a pre-warm broker. zer0Gig's pattern handles cold-start cleanly.

### B-3 · Path A/B agent runtime hosting (2 weeks)
**Source:** `zer0Gig/Agent-Runtime/src/platform-index.js` + dispatcher.
**Target:** `apps/cli/src/commands/daemon.ts` gains `--hosted` mode + a `apps/runtime/` package that runs `N` agents per process with state-manager checkpoints.
**Verify:** `ivaronix daemon --hosted --agents 3` runs three distinct agent personas in parallel, each with its own AgentPassport, each emitting receipts independently. Single Railway deploy answers "deploy 10 agents."
**Why:** This is the platform-completeness gap. It's a bigger lift than the others, but it's the only one that turns "we have primitives" into "we have a platform."

## 3. What we deliberately DO NOT do this pass

Each is here to stay rejected:
1. **AIsphere's soft-fail-to-mock TEE.** CLAUDE.md §6 violation. Receipt tier honesty is a feature, not a polish item.
2. **AgentPay's off-chain invoices with in-memory fallback.** Our receipts are on-chain; no parallel off-chain truth.
3. **agentra-0G's monolithic single contract.** Our 6 modular contracts let us upgrade one without touching others.
4. **agentra-0G's cron-based oracle.** Centralization trap; zg compute isn't a 1-min cadence service.
5. **zer0Gig's event-only sealed keys.** Gas-optimization risk; AgentPassport stays a proper ERC-7857 INFT.
6. **Anything from moonnfun.** Different lane (DeFi launchpad, zero 0G integration).
7. **README-bait features.** No "upvoting" / "execution oracle" / "alignment node" until a Foundry test asserts they work end-to-end.

## 4. What stays uniquely ours (defend, don't dilute)

These seven are the moat. Every steal above has been checked against them — none compromise these:
- **ReceiptRegistry as primitive** — 287+ receipts on chain, schema-validated, canonical-hash-bound, signed, independently re-verifiable.
- **AgentPassport ERC-7857 INFT** — only proper INFT in the cohort.
- **MemoryAccessLog on-chain grant/revoke** — no peer has this.
- **TIER-1 / TIER-2 explicit honesty** — receipts are amber when external; nobody else marks tradeoffs.
- **155 OpenClaw spec-compliant skills** — biggest skill catalog in the cohort.
- **61/61 Foundry tests** — best test rigor in the cohort.
- **Editorial cream-on-black design language + canonical italic-i mark.**

## 5. Order, owners, exit criteria

| # | Item | Days | Owner | Exit criterion |
|---|------|------|-------|----------------|
| S-1 | Local KV bootstrap | 1 | infra | `pnpm dev:kv` works on Windows + macOS |
| S-2 | Wallet-derived stream IDs | 0.5 | core | `memory restore` works on a fresh machine |
| S-3 | Telegram thin client | 2-3 | apps | `/run` from a phone returns a Studio receipt URL |
| S-4 | Native-host auto-pairing | 3 | cli | manifest written, stub extension reads it |
| S-5 | Postgres receipt indexer | 3 | indexer | `/global` loads <100ms via DB |
| B-1 | SubscriptionEscrow receipt type | 7 | contracts | new receipt round-trips on testnet |
| B-2 | Broker pre-fund | 3 | compute | cold-start broker works without manual setup |
| B-3 | Path A/B hosting | 14 | runtime | 3-agent demo emits 3 receipts in parallel |

**Total estimated wall-clock to clear S-1..S-5:** ~2 weeks single-engineer. **+B-1..B-3:** another ~3-4 weeks.

Pre-flight (before S-1):
- run `pnpm -r typecheck` clean
- run `forge test` clean (61/61)
- branch from `main` as `pass76/<sub-id>` per item; merge back per S-N completion

## 6. Directory reorganization (this same pass)

Eighteen MD files were scattered at repo root. Verified by source-grep that **only four** of them are referenced directly from source comments and must stay in root:
- `RECEIPTS_SPEC.md` — referenced from `contracts/src/ReceiptRegistry.sol` and 6 packages
- `COMPONENTS.md` — referenced from `packages/core/src/types.ts`, `packages/og-storage/src/burn.ts`, `packages/consensus/src/prompts.ts`
- `UI_UX_GUIDE.md` — referenced from `apps/studio/src/app/globals.css` and `brand/*.svg`
- `PRD.md` — referenced from `packages/consensus/src/prompts.ts`

Plus four "always-loaded / judge-facing" files that earn root status:
- `CLAUDE.md` — agent contract (always-loaded)
- `README.md` — repo intro
- `SESSION_FINAL.md` — judge-ready one-pager
- `HLD.md` — high-level design (header doc most contributors land on first)

The remaining 9 move to `docs/` subfolders:

```
docs/
├── build/
│   ├── BUILD.md                  (was: /BUILD.md)
│   ├── BUILD_PROGRESS.md          (was: /BUILD_PROGRESS.md)
│   ├── TEST_REPORT.md             (was: /TEST_REPORT.md)
│   └── ENGINEERING_DEBUG_LOG.md   (was: /ENGINEERING_DEBUG_LOG.md)
├── reference/
│   ├── 0G_RESOURCES.md            (was: /0G_RESOURCES.md)
│   ├── 0G_TESTNET_NOTES.md        (was: /0G_TESTNET_NOTES.md)
│   ├── REFERENCE_PATTERNS.md      (was: /REFERENCE_PATTERNS.md)
│   └── NVIDIA_NIM.md              (already in /docs/)
├── pitch/
│   └── PITCH.md                   (was: /PITCH.md)
└── PLAN_pass76.md                 (this file)
```

After move, `README.md` and `SESSION_FINAL.md` link tables get updated to point at the new paths.

`_archive/` stays as-is (8 files). It already does its job.
