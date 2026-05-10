# Ivaronix · Operator Action List

> Single page of every action that needs **a real human (the operator)** to do something off-keyboard. Anything I (the agent) can do automatically is shipped or queued elsewhere — this list is the cleanup of items that depend on you.
>
> Updated 2026-05-09 · ordered by submission risk.

## A · Submission-blocking (do these before submitting)

### A-1 · Galileo testnet wallet · already funded (no action right now)
- **Status as of 2026-05-09:** balance ≈ **69 OG** on `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`. Each demo run costs ~0.0001 OG, so the current balance covers thousands of judge runs.
- **Top up only if needed:** the public faucet at `https://faucet.0g.ai` issues free testnet OG to any address. You do not pay anything; the faucet hands out tokens. Hit it again only if `ivaronix doctor balance` ever shows < 1 OG.
- **Verify any time:** `pnpm --filter @ivaronix/cli exec ivaronix doctor balance` — checks the live chain.

### A-2 · Fund the mainnet deployer wallet on Aristotle (chainId 16661)
- **Why it matters:** mainnet promotion is the only real difference between "demo on testnet" and a production-grade artefact. CLAUDE.md §1: "the only blocker is money." All six contracts compile + deploy + mainnet-readiness checklist is already 13/13 green.
- **Action:** send ~0.1 OG to the deployer wallet on chainId 16661 (Aristotle mainnet, `https://evmrpc.0g.ai`).
- **Verify:** `pnpm --filter @ivaronix/cli exec ivaronix doctor balance --network mainnet` should show > 0.1 OG.
- **Then run:** `pnpm --filter @ivaronix/cli exec ivaronix deploy --network mainnet` (script exists; will refuse if balance is short).

### A-3 · Submit the README + repo URL to the OG APAC submission portal
- **Why it matters:** documentation is a judging input.
- **Action:** copy `https://github.com/Pratiikpy/ivaronix` (or whatever the production repo URL is) into the submission form. Paste the README's "How it works" + "Built on 0G" + "Network reference" blocks as the project description.
- **Sanity check:** the README answers all six points the submission asks (project overview, architecture, modules used, how modules support the product, repro steps, test account / faucet / reviewer notes) without using a "compliance checklist" voice.

---

## A-V2 · HALF_BAKED Section N · contract V2 redeploys (operator-action gates)

These are code-complete in the repo. The chain deploy itself needs operator-side OG. Each block lists exactly one command sequence.

### A-V2-K1 · Deploy `AgentPassportINFTV2` to Galileo
- **Why:** closes K-1 (Critical) — the V1 `recordReceipt` accepts unbounded self-claimed trustScore from token owners. V2 requires `authorizedRecorders` only, cross-checks the receipt id on `ReceiptRegistry`, caps `trustScoreDelta` to `[-100, +100]`. Bundles K-4 (executor authorizations cleared on transfer via per-token version counter) and K-6 (mint reentrancy fix) into the same redeploy.
- **Status:** `contracts/src/AgentPassportINFTV2.sol` shipped; 16/16 Foundry tests pass; deploy script `contracts/script/DeployPassportV2.s.sol` ready.
- **Cost:** ~0.05 OG on Galileo (already funded, see A-1). No new funding required.
- **Run:**

  ```bash
  cd contracts
  export OG_PRIVATE_KEY=<your-deployer-key>           # already in your .env
  export PASSPORT_VERIFIER_ADDR=0x...                 # current Erc7857Verifier address
  export RECEIPT_REGISTRY_ADDR=0x...                  # current ReceiptRegistry address
  forge script script/DeployPassportV2.s.sol:DeployPassportV2 \
    --rpc-url https://evmrpc-testnet.0g.ai \
    --broadcast --legacy
  ```

  Both addresses are in `contracts/deployments/testnet.json` under `Erc7857Verifier` and `ReceiptRegistry`.

- **Post-deploy:**
  1. Add the new `AgentPassportINFTV2` address to `contracts/deployments/testnet.json` under a new `AgentPassportINFTV2` key. Leave the V1 `AgentPassportINFT` entry untouched — the four existing minted passports stay readable on V1.
  2. Authorize the operator wallet as a recorder (so future receipt anchors can write reputation):
     `cast send <V2-addr> "addAuthorizedRecorder(address)" <operator-wallet> --rpc-url https://evmrpc-testnet.0g.ai --private-key $OG_PRIVATE_KEY --legacy`
  3. Studio `/agents` will need a follow-up to read V2 first and fall back to V1 with a `LEGACY-PASSPORT` chip — already documented in HALF_BAKED.md K-1; agent picks it up post-deploy.

### A-V2-K15-Go · Install Go so the cron loop can ship the Go reference verifier
- **Why:** K-15 in HALF_BAKED.md ships the canonical-JSON reference verifier in three languages already (TS, Python, Rust). All three produce byte-identical output (29/29 vectors). Go is the fourth, queued because this machine has no `go` binary yet.
- **Status:** TS + Python + Rust shipped + 3-language cross-impl proof live. Go pending operator install.
- **Cost:** free.
- **Run:**

  ```bash
  ! winget install GoLang.Go
  # or on macOS / Linux:
  # ! brew install go
  # ! sudo apt install golang-go
  go version  # should print 1.21+
  ```

  After Go is installed, the next cron firing scaffolds `verifier-go/` mirroring the Rust shape, extends `scripts/verifier-py/cross_check.py` with `go run ./cmd/verifier-go`, and adds a Go job to `.github/workflows/jcs-roundtrip.yml`. No further operator action required after installing Go.

- **Optional `crates.io` publish (operator-action when ready):**

  ```bash
  ! cargo login                          # one-time, takes the API token from crates.io
  cd ivaronix-verifier-rs
  cargo publish --dry-run                # safety check
  cargo publish
  ```

  After publish, the Rust verifier is `cargo install ivaronix-verifier` for any third party.

### A-V2-L7 · Vercel-deploy Studio
- **Why:** L-7 in HALF_BAKED.md — the most embarrassing competitive gap. AIsphere, Provus, Aishi, MUSASHI, Trapezohe all ship live URLs; Ivaronix Studio is `pnpm --filter @ivaronix/studio dev` only. A judge who doesn't clone never sees Studio at all.
- **Status:** code-complete · `apps/studio/.env.production.template` shipped with the full env list (chain, compute, NIM, SIWE secret, Upstash, Sentry, Studio base URL); Studio + runtime + CLI typecheck clean.
- **Cost:** Vercel hobby tier is free. Domain `~$12/yr` (your call). Sentry + Upstash both have free tiers.
- **Run:**

  ```bash
  ! vercel login
  cd apps/studio
  cp .env.production.template .env.production
  # Fill .env.production with the real values (private key, ZG_API_SECRET, etc.)
  # Then push the env vars to Vercel:
  vercel env pull .env.local             # Sanity check: pulls back what's set
  vercel --prod                          # Deploys to your team's prod URL
  ```

- **Custom domain (`ivaronix.app` recommended):**
  1. Buy at any registrar; point DNS at Vercel (CNAME or A record per Vercel's instructions).
  2. In Vercel project settings → Domains, add the domain.
  3. After SSL cert issues (~30 seconds), set `IVARONIX_STUDIO_BASE=https://ivaronix.app` in Vercel env.
- **Post-deploy smoke:**
  - Hit `https://<your-url>/r/1004` — chip should render VERIFIED, four-light row should show real evidence per S-2 + I-5.
  - Hit `https://<your-url>/api/auth/siwe/nonce` — must return 200 + `Set-Cookie: iv-siwe-nonce=...; HttpOnly; SameSite=Strict`.
  - Hit `POST https://<your-url>/api/skill/save` anonymous — must return 401.
  - Hit `POST https://<your-url>/api/run` anonymous 11 times in a minute — 11th must return 429.
- **Sentry signup (5 min, free):** create project, copy DSN, set `SENTRY_DSN` in Vercel env. Errors will surface in Sentry instead of disappearing into Vercel logs.
- **Upstash Redis (recommended for multi-instance):** set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` so rate-limit buckets are shared across Vercel function instances. Without this, each instance has its own in-memory bucket and an attacker can multiply their ceiling by spreading hits.

### A-V2-K2 · Deploy `ReceiptRegistryV2` to Galileo
- **Why:** closes K-2 (Critical) — V1's `anchor()` writes `agentAddress = msg.sender` with no signature recovery, so any wallet can anchor any receiptRoot claiming any agent identity. V2 recovers `agentAddress` from an EIP-712 typed-data signature; replay protection via per-agent monotonic nonces.
- **Status:** code-complete · `contracts/src/ReceiptRegistryV2.sol` ships; 15/15 V2 Foundry tests pass; deploy script `contracts/script/DeployReceiptRegistryV2.s.sol` ready.
- **Cost:** ~0.05 OG on Galileo (already funded, see A-1).
- **Run:**

  ```bash
  cd contracts
  export OG_PRIVATE_KEY=<your-deployer-key>           # already in your .env
  forge script script/DeployReceiptRegistryV2.s.sol:DeployReceiptRegistryV2 \
    --rpc-url https://evmrpc-testnet.0g.ai \
    --broadcast --legacy
  ```

- **Post-deploy:**
  1. Add the new `ReceiptRegistryV2` address to `contracts/deployments/testnet.json` under a new `ReceiptRegistryV2` key. Leave the V1 `ReceiptRegistry` entry untouched — the existing 1,330+ anchored receipts stay readable on V1.
  2. The TS clients (`packages/og-chain/src/contracts/ReceiptRegistry.ts`, `packages/runtime/src/pipeline.ts`) need a follow-up to sign the V2 EIP-712 typed data + call the new `anchor((root, storageRoot, type, attestationHash, agent, deadline), signature)` shape. Agent picks this up after the deploy lands.
  3. Studio receipt-loader follow-up: branch on `chainAnchor.registryAddress` so `/r/<id>` queries V2 first and falls back to V1; existing receipts get a `LEGACY-REGISTRY` chip.



> **Network targeting note:** B-1 through B-7 are **application-layer** items — they all apply to both testnet AND mainnet equally. B-1 can ship on testnet today (A-1 wallet is already funded); the mainnet deploy waits on A-2. B-2 → B-7 are network-agnostic code/UX changes — a single PR ships them everywhere at once.

### B-1 · Deploy IvaronixReceiptGuard.sol to chain (testnet first, then mainnet)
- **Source:** `contracts/src/IvaronixReceiptGuard.sol` — 5/5 Foundry tests green (full suite 90/90).
- **Why it matters:** turns Ivaronix from a *log* into a *gate*. Any external Safe / x402 contract / vendor approval flow can require a verifiable Ivaronix receipt before executing a tx.
- **Network targeting:** ship on **testnet first** (A-1 wallet is funded today, no funding wait), then **mainnet after A-2** funding. Two-step rollout = lower risk; same script, different `--rpc-url`.
- **Action:**
  - Step 1 (testnet, do whenever): `cd contracts && forge script script/DeployReceiptGuard.s.sol --rpc-url https://evmrpc-testnet.0g.ai --broadcast --private-key <deployer>` (script needs writing — straightforward template from existing deploy scripts).
  - Step 2 (mainnet, after A-2): same command with `--rpc-url https://evmrpc.0g.ai`.
  - After each: add the deployed address to `deployments/<testnet|mainnet>.json` under `IvaronixReceiptGuard`.
  - Update `apps/studio/src/app/docs/page.tsx` to link the new contract address from the 0G Chain card.

### B-2 · Wire SIWE (sign-in-with-ethereum) for Studio user-side anchoring
- **Why it matters:** today every Studio-anchored receipt is signed by the operator's `EVM_PRIVATE_KEY`, not the connected browser wallet. The receipt page is honest about this (the agent address is shown), but the model would be cleaner if the user's connected wallet signed.
- **Source:** `apps/studio/src/app/api/run/route.ts:24-25` flagged in `docs/PHASE_B_DISCLOSURES.md` item 1.
- **Action:** add SIWE middleware (Vercel guide: `https://docs.vercel.com/integrations/siwe`), expose a client-side wagmi sign-and-anchor path, tag every Studio-anchored receipt with `signedBy: 'user' | 'operator'`.

### B-3 · npm-publish `@ivaronix/widget`
- **Source:** `packages/widget/` — code-complete, README written, 0 deps beyond peer React.
- **Action:** `cd packages/widget && pnpm publish --access public`.
- **Verify:** `npm view @ivaronix/widget` returns the package metadata.
- **Effect:** any third-party React app can `import { ReceiptVerifier }` and surface our brand on their pages.

### B-3a · Spin up the 0G Persistent Memory sidecar (one-time per machine)
- **What it is:** the `0g-memory` sidecar service runs locally as a Docker-composed stack of MongoDB + Elasticsearch + Milvus + Redis + the `zgs_kv` 0G chain-sync binary. Adds the 6th 0G primitive to Ivaronix's claim — matches AIsphere's "all 6 primitives."
- **Source:** `oglabs resources/0g-memory/README.md` + `oglabs resources/0g-memory/docs/api_docs/memory_api.md`.
- **Action:**
  - `cd oglabs\ resources/0g-memory && bash install.sh` (one-time setup)
  - `bash start_service.sh` — sidecar listens on `http://localhost:1995`
  - Add to `.env`: `ZG_MEMORY_URL=http://localhost:1995`
  - That's it — the runtime auto-detects via `MemoryClient.fromEnv()` and starts populating `request.memoryQuery` on every receipt.
- **Verify:** run `ivaronix doc ask sample.txt "..." --skill private-doc-review` twice; the second receipt's `request.memoryQuery.retrievedCount` should be > 0 (the second run reads the first run's anchored memory back as context).
- **No mainnet equivalent yet.** The sidecar is wallet-keyed (encrypted with a key derived from `EVM_PRIVATE_KEY`) so it works against either testnet or mainnet receipts depending on which network the receipts were anchored on.

### B-4 · Anchor data-room manifests on 0G Storage (not just local)
- **Why it matters:** today `apps/studio/src/app/data-room/[id]/page.tsx` reads only the local FS. A judge browsing the deployed Studio on a different host sees "Room not found" because the manifest was created on the operator's machine.
- **Action:** at room-creation time, also upload the manifest JSON to 0G Storage and store the storage root in the on-chain receipt's `storage.evidenceRoot`. Then make the page fetch by storage root, with local FS as fallback.

### B-5 · Wire on-chain payout for fee_split
- **Why it matters:** every receipt records `billing.feeSplit` (creatorBps + treasuryBps + creatorPassport). The bps values are accurate to what we agreed. The actual OG transfer to the creator's wallet is not yet executed — `packages/runtime/src/pipeline.ts:590` `post_anchor` hook is a documented TODO.
- **Action:** add an OG transfer in the post-anchor hook that splits `billing.estimatedCostOg` between creator and treasury wallets after the chain anchor confirms.

### B-6 · /global "OG spent" → wire to indexer
- **Source:** `apps/studio/src/app/global/page.tsx:90` — currently reads only `.ivaronix/receipts/anchored/` on the Studio process's disk. On a fresh deploy the stat shows 0.000000 OG.
- **Action:** point at `ivaronix indexer` SQLite (already exists, ships with the CLI).

### B-7 · SubscriptionEscrow CLI surface
- **Source:** `contracts/src/SubscriptionEscrow.sol` — deployed, but no CLI / Studio entry.
- **Action:** `ivaronix subscription create / checkin / status` + a `/subscriptions` Studio page. Track 3 follow-up.

---

## B-V2 · plan-003 mainnet items (additional · captured 2026-05-10)

> Captured from `docs/planning-003.md` Section B. Each item is mainnet-only (testnet versions ship as part of Section A · already underway). Operator action lands these on Aristotle (chainID 16661).

### B-V2-1 · V2 marketplace contracts mainnet deploy
- **Source:** plan-003 §B.1.3
- **Depends on:** A.5.9 (SubscriptionEscrowV2) + A.5.10 (CapabilityRegistryV2) + A.5.11 (SkillRegistryV2) + A.5.12 (MemoryAccessLogV2) testnet versions verified first.
- **Why:** rolls the V2 marketplace + privacy + audit-trail contracts onto mainnet alongside K-1/K-2 V2 redeploys.
- **Cost:** ~0.05 OG total on mainnet.
- **Action:** after testnet versions are deployed and Foundry-verified, write `contracts/script/DeployV2Marketplace.s.sol` (mirrors existing DeployPassportV2 pattern) and run:

  ```bash
  cd contracts
  export OG_PRIVATE_KEY=<deployer-key>
  forge script script/DeployV2Marketplace.s.sol --rpc-url https://evmrpc.0g.ai --broadcast --legacy
  ```

  Add addresses to `contracts/deployments/mainnet.json` under each new V2 key.

### B-V2-2 · OG-image generation verified on production Studio
- **Source:** plan-003 §A.5.5 + §B.2.3
- **Depends on:** A.5.5 (OG-image route shipped) + A-V2-L7 (Vercel custom domain live).
- **Why:** every `/r/<id>` shared link must render Ivaronix-branded social-card image, not a default Vercel placeholder.
- **Action:** after Vercel custom domain lands, hit `https://<your-url>/r/1004/opengraph-image` and confirm 1200×630 PNG renders with receipt id + status chip + skill name. Run preview check via `https://cards-dev.twitter.com/validator`. Capture a screenshot.

### B-V2-3 · Mainnet autonomous wander-cycle
- **Source:** plan-003 §A.4.1 (testnet) → §B.3.1 (mainnet)
- **Depends on:** A-V2-K1 + A-V2-K2 + A.4.1 (testnet wander-cycle producing receipts cleanly) + mainnet OG funding.
- **Why:** Provus has 30K mainnet TXs from a 15s autonomous loop. Ivaronix matches with `private-doc-review` runs every 5min from a CI wallet. 8,640 receipts/month × 90 days = ~26K mainnet receipts. Headline becomes "1,332 manual + 26K autonomous = 27K+ mainnet receipts" before judging.
- **Cost:** ~2.6 OG over 90 days from operator wallet.
- **Action:** once testnet wander-cycle is shipping receipts (per A.4.1), set `WANDER_CYCLE_NETWORK=mainnet` in the CI wallet env. Same agent code, different RPC + V2 address.

### B-V2-4 · npm publish `@ivaronix/cli`
- **Source:** plan-003 §B.5.1
- **Depends on:** A-V2-L7 (Vercel custom domain so widget URLs in the package work) + `npm login` on operator's machine.
- **Action:** `cd apps/cli && pnpm publish --access public`.
- **Verify:** `npmjs.com/package/ivaronix` page live; `npx ivaronix receipt verify <id>` works on a clean machine.

### B-V2-5 · PyPI publish `ivaronix-verifier-py`
- **Source:** plan-003 §B.5.4
- **Depends on:** PyPI account configured in operator's `~/.pypirc` (free).
- **Action:**

  ```bash
  cd scripts/verifier-py
  python -m build
  twine upload dist/*
  ```

- **Verify:** `pip install ivaronix-verifier-py` works on a clean machine.

### B-V2-6 · Khalani cross-chain adapter (post-hackathon, optional)
- **Source:** plan-003 §B.6.1
- **Why:** Aegis Vault ships Khalani venue adapter for 0G-native intent settlement on Arbitrum without orchestrator custody. Same primitive applies to Ivaronix receipts — a 0G receipt could anchor to Arbitrum or Base via Khalani.
- **Effort:** ~1 week.
- **Decision:** post-hackathon. Not on critical path for judging.

### B-V2-9 · Brand-token drift lint (`pnpm brand:check`)
- **Source:** plan-003 §A.3.3 follow-up · `brand/tokens.css` + `brand/tokens.json` shipped today.
- **Why:** the canonical palette is now in `brand/tokens.*`. Without a lint, future PRs can re-introduce hardcoded hex values that drift from the canonical set.
- **Action:** ship `pnpm brand:check` script that greps `apps/studio/src/**/*.{ts,tsx,css}` + `UI_UX_GUIDE.md` + `CLAUDE.md` for hex literals NOT present in `brand/tokens.json`. Fail CI on any drift.
- **Effort:** ~30min.

### B-V2-10 · Migrate Foundry deploy scripts to `IVARONIX_SIGNER_KEY`
- **Source:** plan-003 §A.3.4 follow-up · `packages/runtime/src/env.ts` already supports the canonical name with legacy aliases.
- **Why:** today every `forge script script/Deploy*.s.sol` reads `OG_PRIVATE_KEY` directly via `vm.envString("OG_PRIVATE_KEY")`. Operators bridging from CLI (which now prefers `IVARONIX_SIGNER_KEY`) hit a "missing OG_PRIVATE_KEY" error mid-deploy.
- **Action:** in every `contracts/script/Deploy*.s.sol`, replace `vm.envString("OG_PRIVATE_KEY")` with `vm.envOr("IVARONIX_SIGNER_KEY", vm.envString("OG_PRIVATE_KEY"))` so the canonical name is preferred but the legacy alias still works.
- **Effort:** ~30min · 8 scripts · zero functional change.

### B-V2-13 · `pnpm audit:list` script
- **Source:** plan-003 §A.4.3 · CHANGELOG.md + commit-trailer convention shipped today.
- **Why:** every closing commit carries `Closes audit <ID>`. A one-shot `git log --grep` makes the audit lifecycle queryable without scanning the file.
- **Action:** add `pnpm audit:list` to root package.json scripts. Implementation: `tsx scripts/audit-list.ts` (new, ~30 lines) — runs `git log --grep "Closes audit" --pretty=format:"%h %s"`, parses out the IDs from each commit body, prints a table grouped by ID with the closing commit hash + date.
- **Effort:** ~30min.

### B-V2-12 · Per-package tsconfig migration to extend `tsconfig.base.json`
- **Source:** plan-003 §A.3.5 follow-up · `tsconfig.base.json` shipped today at repo root with canonical strict settings.
- **Why:** today each of the 14 workspace packages has its own `tsconfig.json` that may drift on `strict`, `target`, `moduleResolution`. Without a shared base, "14 packages typecheck-clean" claims uneven type-safety guarantees across the workspace. The base file is shipped; the per-package extends migration is the follow-up.
- **Action:**
  1. For each `<package>/tsconfig.json`, add `"extends": "../../tsconfig.base.json"` (or correct relative path) at the top of `compilerOptions`.
  2. Strip duplicated settings (target, module, strict, etc.) from per-package configs — they inherit from base.
  3. Per-package overrides ONLY when the package legitimately needs them (e.g. apps/studio adds `"jsx": "preserve"` for Next.js, packages add their own `"outDir"` for build output).
  4. Run `pnpm -r typecheck` after; any package that breaks under the canonical settings reveals a hidden type-safety gap. Fix or document.
- **Effort:** ~1.5h including fixing newly-surfaced typecheck failures.

### B-V2-11 · `pnpm env:check` script
- **Source:** plan-003 §A.3.4 · `envCheckReport()` exported from `packages/runtime/src/env.ts`.
- **Why:** operators copy-paste `.env` files and hit "missing env var" errors. A one-shot diagnostic prints which canonical name resolved to which alias.
- **Action:** add `pnpm env:check` script that calls `envCheckReport()` and prints a table: canonical name | used alias | value-set status. Highlight legacy aliases in yellow.
- **Effort:** ~15min.

### B-V2-14 · Daemonise the wander-cycle agent on the CI wallet
- **Source:** plan-003 §A.4.1 · `scripts/wander-cycle/` shipped with `pnpm wander:cycle` (one iteration) + `pnpm wander:loop` (continuous).
- **Why:** the autonomous cycle is the path to "30K+ mainnet TXs" parity with Provus. Script is shipped + dry-run-verified. Daemonising produces ~8,640 receipts/month testnet, ~26K over 90 days mainnet.
- **Cost on testnet:** 0.86 OG/month from CI wallet (USER_TODO §B-V2-7, 1 OG covers ~1.1 months).
- **Cost on mainnet:** ~3 OG / 90 days estimated. Allocate after mainnet promotion (USER_TODO §A-V2-K1 + §A-V2-K2).
- **Action (testnet · run today):** follow `scripts/wander-cycle/README.md` for systemd / Docker / Windows Task Scheduler. Default cadence 5 min via `pnpm wander:loop`.
- **Action (mainnet · post-A-V2):** set `IVARONIX_NETWORK=mainnet` in the wander-cycle env. CLI's V2-first read pattern routes anchors to `ReceiptRegistryV2` mainnet automatically.
- **Effort:** ~30min daemon setup · ~3 months runtime to hit headline.

### B-V2-15 · Deploy CapabilityRegistryV2 (social-graph leak fix)
- **Source:** plan-003 §A.5.10 · code-complete today (`contracts/src/CapabilityRegistryV2.sol` + 10/10 Foundry tests pass).
- **Why:** V1's `mapping(address => bytes32[]) public grantsByOwner` + `grantsByGrantee` auto-generated public getters; anyone could enumerate every grant ever issued for any wallet. V2 makes both reverse indexes `internal` with privacy-gated reads (caller is owner/grantee themselves OR an `authorizedReader` indexer). Closes the social-graph leak.
- **Status:** contract + deploy script + Foundry tests (10/10 PASS) shipped. Mainnet deploy waits on operator funding (USER_TODO §A-2).
- **Cost:** ~0.05 OG on testnet (already funded · §A-1) · ~0.05 OG on mainnet.
- **Run (testnet):**

  ```bash
  cd contracts
  export OG_PRIVATE_KEY=<deployer-key>
  forge script script/DeployCapabilityRegistryV2.s.sol:DeployCapabilityRegistryV2 \
    --rpc-url https://evmrpc-testnet.0g.ai --broadcast --legacy
  ```

- **Run (mainnet · post-§A-2):** swap RPC URL to `https://evmrpc.0g.ai`.
- **Post-deploy:** add the address to `contracts/deployments/<network>.json` under `CapabilityRegistryV2`. Leave V1 entry untouched (legacy grants stay readable). Studio + CLI grant-management surfaces query V2 first via the V2-first read pattern (planning-003 §A.1.3).

### B-V2-8 · Auto-render pipeline for `docs/numbers.json` substitution
- **Source:** plan-003 §A.2.7 first cut shipped (`docs/numbers.json` + `pnpm numbers:refresh` against live chain). The render-time substitution + CI 24h-staleness gate are still queued.
- **Why:** today every numeric claim in README, PITCH.md, JUDGE_GUIDE.md, MAINNET_READINESS.md is hand-typed against `docs/numbers.json`. As receipts/skills/contracts change, those numbers drift. The auto-render fixes this permanently.
- **Action:**
  1. Add `<!-- numbers:auto:KEY -->` markers to README + PITCH.md + JUDGE_GUIDE.md + MAINNET_READINESS.md wherever a numeric claim appears (e.g. `<!-- numbers:auto:receipts.total --> 1,644+`).
  2. Write `pnpm docs:render` script that reads `docs/numbers.json` + does the substitution in-place.
  3. Add a CI gate via `pnpm numbers:check` that fails if `docs/numbers.json` is more than 24h older than the latest receipt anchored on chain (= the docs are demonstrably stale).
- **Effort:** ~1.5h. Useful but not blocking; the manual-refresh pattern works for the submission window.

### B-V2-7 · Set up scoped CI wallet for chain-smoke workflow
- **Source:** plan-003 §A.1.5 + `.github/workflows/chain-smoke.yml`
- **Why:** the V2 anchor smoke workflow needs a scoped EVM key to anchor a synthetic receipt on Galileo on PR (label `run-chain-smoke`) + nightly cron. Using the operator's main signing key would leak the operator wallet address into GitHub Actions logs.
- **Cost:** 0.5 OG one-time allocation from the operator's testnet wallet (~69 OG balance). Each smoke run costs ~0.0005 OG; 0.5 OG covers ~1000 runs.
- **Action:** follow `docs/CI_WALLET.md` runbook end-to-end:
  1. Generate a fresh wallet via `node -e 'const {Wallet}=require("ethers"); const w=Wallet.createRandom(); console.log(w.address); console.log(w.privateKey);'`
  2. Send 0.5 OG to the new address on Galileo (chainID 16602).
  3. Add the private key to GitHub repo secrets as `IVARONIX_CI_WALLET_KEY`.
  4. Trigger the workflow manually once to verify it can read the secret + anchor a receipt.
  5. Add the funded address to `contracts/deployments/testnet.json` under a `ci_wallet` key.

---

## C · Distribution + outreach (operator-only by nature)

> **Network targeting note:** C-1, C-3, C-4 are **network-agnostic** (they apply whether the user is on testnet or mainnet). C-2 (ChainGPT audit) is **mainnet-only** — you audit *before* mainnet, not before testnet.

### C-1 · Telegram bot live · network-agnostic
- Documented as Phase B in earlier QA passes. Needs a BotFather token. Strictly external to the codebase. The bot would expose receipt verification + skill discovery commands; same surface on testnet and mainnet.

### C-2 · ChainGPT audit booking · mainnet-only
- The mainnet-readiness checklist mentions a ChainGPT audit. Requires booking + payment. **Schedule before mainnet promotion (A-2)**, not before testnet — testnet contracts have already been live and exercised by 1300+ receipts without incident, which is its own kind of soak-testing.

### C-3 · Domain config (ivaronix.studio) · network-agnostic
- The widget defaults to `https://ivaronix.studio`. The actual production domain needs DNS + HTTPS provisioning. One config covers both networks (the network is a runtime variable, not a deploy-time one).

### C-4 · Demo Day prep · network-agnostic
- The Hong Kong Web3 Festival Mini Demo Day is referenced in the judging criteria. Live performance is "a key reference." Demo on whichever network is current at the time (testnet today, mainnet if A-2 lands first).

---

## D · Reference (not actions, just reminders)

- **Faucet:** `https://faucet.0g.ai` (Galileo only; mainnet has no faucet).
- **Network params:** chainId 16602 (Galileo) / 16661 (Aristotle mainnet) · RPC `evmrpc-testnet.0g.ai` / `evmrpc.0g.ai` · explorer `chainscan-galileo.0g.ai` / `chainscan.0g.ai`.
- **Operator wallet:** `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` (current testnet deployer).
- **Half-baked items list** (auto-tracked): `docs/PHASE_B_DISCLOSURES.md`. Anything in there that I (the agent) cannot ship is also listed in section B above.

---

## E · Things I will NOT bother you about

- Bug fixes, typecheck failures, test regressions — I handle these myself per CLAUDE.md §11.
- Adding new features that pass the PMF filter and don't need money — I ship them and tick `docs/planning-01.md`.
- Documentation updates — I append to the right `docs/*.md` file as I go.
- Receipt verification, voice checks, brand-HTML diffs — pre-flight every time.
- Anything in `og-projects-showcase` / `entries` / `new-entries` that closes a judging-criterion gap and that I can build without funding — I build.
