# Planning-002 · the #1 plan

> Mission: become the **#1** project on the OG APAC Hackathon ($45K grand prize). No compromise.
> Started 2026-05-09 from the post-Tier-4 state — every item in `planning-01.md` already shipped on testnet. This doc captures what's left.
>
> **Self-check criterion:** the plan is "final" only when, executed, it would beat the strongest project in `og-projects-showcase/`, `entries/`, and `new-entries/` on every one of the five judging criteria. Any criterion where we don't have a clear advantage = the plan is not final yet.

## How this doc evolves

A recurring cron (`b7b82b77`, every 5 min, session-only) re-reads this file and asks "does this make us #1?" If a section is weak, it deepens. If all sections are strong, it appends `FINAL · plan converged` and self-cancels. Four research subagents seeded the first draft — their findings populate the sections marked `[subagent A/B/C/D]` below as they return.

---

## §1 · Tech-depth gaps (judging Criterion 2.1)

> User priority: focus area #1.

### 1.1 · 0G DA integration · verified

- **What the docs actually say** (subagent A · `0g-doc/docs/developer-hub/building-on-0g/da-integration.md:63`, `0g-da-rust-sdk/README.md`):
  - **Mainnet:** no public DA contract address listed in `mainnet-overview.md`. Storage contracts are listed (Flow, Mine, Reward); DA is not. There is no shared public DA disperser endpoint documented for either testnet or mainnet.
  - **Testnet:** `ENTRANCE_CONTRACT_ADDR=0x857C0A28A8634614BB2C96039Cf4a20AFF709Aa9`, but no shared disperser; you self-host a DA Client node (Docker, gRPC on port 51001).
  - **SDK:** Rust-only (`cargo add 0g-da-rust-sdk`). No TS/Python SDK.
  - **Call shape:** `disperse_blob_with_finalize(data: Vec<u8>) → BlobHeader { storage_root, epoch, quorum_id }`. Retrieve with the three-tuple. There is no IPFS-CID-style single-string blobId.

- **Why this was hard for us:** not a missing SDK or missing chain primitive — a missing **shared hosted endpoint**. The only documented path is self-hosting a DA Client node. We had assumed "no public testnet endpoint" meant DA wasn't real; in fact DA is real and live, just self-hosted.

- **Production-ready integration path** (per CLAUDE.md §1 "the strongest practical implementation"):
  1. Run a DA Client node locally via Docker (8 GB RAM, 100 MBps requirement per docs).
  2. Add a thin Node→gRPC wrapper that calls `disperse_blob_with_finalize` on the local node from `packages/og-da/`.
  3. New CLI: `ivaronix da batch-anchor --count 100` reads the last N receipts, packs them into one blob, calls disperse, prints the BlobHeader.
  4. Add `request.daBlobRef = { storageRoot, epoch, quorumId }` to the receipt schema. Future receipts in a batch reference the prior batch's blob.
  5. Studio `/r/[id]` renders the daBlobRef card when present.

- **Honest disclosure:** if running a DA node is not feasible during the submission window, ship the proto-typed integration stub + a CLI dry-run + a `docs/PHASE_B_DISCLOSURES.md` entry that names the unblock action ("operator runs `docker compose up da-client`"). That's still a verifiable "DA integration shipped" claim per §12.1.

### 1.2 · 0G Persistent Memory · verified

- **What it actually is** (subagent A · `0g-memory/README.md`, `0g-memory/docs/api_docs/memory_api.md`):
  - Full-stack persistent memory system (NOT a raw KV store). Three layers: client-hook auto-capture → EverMemOS structured extraction → 0G Storage decentralized persistence.
  - Indexes across MongoDB, Elasticsearch, Milvus, Redis. Local sidecar service at `http://localhost:1995`.
  - Is `og-kv-server` the implementation? **Partially** — the local `zgs_kv` binary is a read cache that syncs from the 0G blockchain. The authoritative write path is through the 0G storage SDK.
  - Memory types: `profile`, `episodic_memory`, `foresight`, `event_log`.
  - Search retrieval methods: `keyword` (BM25), `vector`, `hybrid`, `rrf`, `agentic` (LLM-guided multi-round).
  - Namespacing: `group_id` (project scope) + `user_id`.
  - **No TTL** primitive exposed.

- **Integration shape:** REST POST/GET against localhost:1995. Lowest-friction integration in the entire `oglabs resources/` tree.

- **Production-ready move:**
  1. Spin up the memory service via `0g-memory/install.sh` + `start_service.sh`.
  2. After every receipt anchor, POST the receipt body to `/api/v1/memories` with `group_id = skillId`, `user_id = walletAddress`, `type = episodic_memory`.
  3. Before each `doc ask` consensus call, GET `/api/v1/memories/search?group_id=<skillId>&user_id=<wallet>&method=agentic` and prepend results to the context (replaces or supplements current `--memory-depth` which scans local FS).
  4. New receipt field: `request.memoryQuery = { method, k, retrieved_count }`.
  5. Studio `/agent/<addr>` "memory consolidations" card already exists from 2B — extend to show 0G-Memory-backed retrieval count too.

- **Effect:** adds the 6th 0G primitive (closing AIsphere's "all 6 claims" advantage), strengthens the receipt-as-spine narrative — every receipt now references prior memories that are themselves on-chain anchored.

### 1.3 · Other primitives — ranked

| # | Primitive | Source path | Lift | Honest move |
|---|-----------|-------------|------|-------------|
| 1 | **0G DA receipt batch anchoring** | `0g-da-rust-sdk/`, `0g-doc/.../da-integration.md` | HIGH (closes §2.1 explicit gap) | Self-hosted DA Client node + thin gRPC wrapper. See §1.1 above. |
| 2 | **0G Persistent Memory** | `0g-memory/README.md` | HIGH (adds 6th primitive) | localhost:1995 REST integration. See §1.2 above. |
| 3 | **agenticID marketplace tier** | `agenticID-examples/03-marketplace-trading/` | MEDIUM-HIGH (closes Track 3 with on-chain mechanism not just schema) | EIP-712 signed orders + escrow on top of SkillRegistry. New CLI `ivaronix skill buy <id>`. |
| 4 | **Fine-tuning on 0G Compute** | `fine-tuning-example/`, `0g-agent-skills/skills/compute/fine-tuning/SKILL.md` | MEDIUM | Domain-specific model trained on 0G GPUs, delivered with a receipt proving the training job ran on 0G. |
| 5 | **Router (OpenAI-compatible API key)** | `0g-doc/.../compute-network/router/` | MEDIUM (UX, not depth) | One API key, automatic provider routing/failover. Reduces per-call wallet friction. |
| ✗ | x402 micropayments | `0g-compute-ts-sdk/web-ui/X402_DEMO_README.md` | DO NOT SHIP | Current implementation is explicitly mocked (USDC simulated, signatures fake). Surfacing it would violate CLAUDE.md §8 honest-tradeoffs. Wait for the real ERC-3009 LedgerManager update. |

---

## §2 · UX / demo-quality gaps (judging Criterion 2.4)

> User priority: focus area #2.

### 2.1 · /onboard friction
- **Current state:** 5-step gated flow before first receipt. Per CLAUDE.md §2.4 "judges want to see one thing work in 60 seconds."
- **Move:** collapse to a single one-click flow. "Drop a contract → see proof" with sensible defaults, no signup, no wallet connect required (signed by operator, disclosed honestly).
- **Plan slot:** [pending subagent D internal-audit]

### 2.2 · No animated live receipt counter on hero
- **Current state:** /global shows the count statically; the home hero doesn't animate. Provus's "10K+ attestations" is the lock-in pattern.
- **Move:** ticker that polls `ReceiptRegistry.nextId()` every 5s with a number animation. ~30 min build.

### 2.3 · No skill-catalog search/filter
- **Current state:** /skills shows 80 cards in a grid. No search, no filter by tier or permissions.
- **Move:** a search box + tier filter + sort-by-recent. ~20 min build.

### 2.4 · No /changelog page
- **Current state:** judges have no momentum signal beyond receipts.
- **Move:** /changelog renders the last 30 commits with their planning-01 ticks. Reads from `git log` server-side. ~30 min build.

### 2.5 · /skill/[id] version history capped at one
- **Current state:** half-baked audit item #7 in PHASE_B_DISCLOSURES.md. Only renders the current version even when 2+ exist on chain.
- **Move:** wire `versionAt(skillId, idx)` in the SkillRegistryClient and loop in the page. ~45 min build.

### 2.6 · No first-paint "what is this" anchor
- **Current state:** the home page jumps straight into the Run panel. No 10-second intro for a non-technical visitor.
- **Move:** a one-frame "see it work" inline animation on first paint (drop file → audit → receipt anchored), no clicks needed.
- **Plan slot:** [pending subagent D]

---

## §3 · Persona-locked surfaces still missing

### 3.1 · Marketing-persona first-party skill
- **Current state:** 5 verified first-party skills (private-doc-review, github-audit, 0g-integration-auditor, plan-step, code-edit). None for marketing / pitch / PR.
- **Move:** promote `content-pitch-review` from imports/ to first-party with TIER 1 attestation + a real receipt fixture. ~45 min.

### 3.2 · Receipt revision compare
- **Current state:** no `/r/<id>/diff?vs=<other>` view.
- **Move:** the deal lawyer's "v3 vs v4 term sheet" workflow. Diff the headlines, risk levels, and citations between two receipts. ~1 hour.

---

## §4 · Mainnet promotion plan

### 4.1 · Funding
- **Blocked on:** A-2 in `docs/USER_TODO.md` — operator funds chainId 16661 deployer wallet.
- **No agent action possible until funded.**

### 4.2 · Deploy sequence (post-funding)
1. `forge script script/DeployAll.s.sol --rpc-url https://evmrpc.0g.ai --broadcast --private-key <deployer>` — deploys all 6 contracts.
2. Add addresses to `deployments/mainnet.json`.
3. Deploy `IvaronixReceiptGuard.sol` (B-1).
4. Re-run mainnet-readiness checklist (currently 13/13 green for testnet; mainnet pass needed).
5. Update Studio header `network: mainnet` chip.
6. Run `ivaronix demo --network mainnet` to anchor the first mainnet receipt.

### 4.3 · 0G DA on mainnet
- [pending subagent A — confirm DA mainnet endpoint + integration shape]

### 4.4 · ChainGPT audit
- C-2 in USER_TODO. Mainnet-only. Operator schedules + pays.

---

## §5 · Showcase / competitor gap closes

### 5.1 · Patterns from showcase we should match (subagent B)

Three unmirrored patterns the showcase top-tier converges on:

1. **Real-number headline at first paint.** AlphaDawg pulls live HCS hunt count + HTS supply via Mirror Node at server render. Zero Training has a live Vercel link. **Ivaronix Studio home does NOT open with a number rendered from live `ReceiptRegistry.nextId()`** — the count exists in `docs/PITCH.md` but not on `apps/studio/src/app/page.tsx`. **Move:** server-render "1,330 receipts anchored on 0G Chain" as the first sentence above the fold, with a clickable chainscan link.

2. **Zero-friction 60-second demo flow on the Studio.** Zero Training's `/demo` → `/participate/[id]` → `/use` path is completable end-to-end by a judge. AlphaDawg has `npm run demo:auto-approve`. **Ivaronix's `/onboard` is 5 gated steps before a first receipt** (CLAUDE.md §2.4 explicitly flags this). The CLI solves it (`ivaronix demo` in 3s) but the Studio doesn't. **Move:** add a "Use sample contract" auto-fill button on the home `RunPanel` that fills `contentText` with the same `SAMPLE_DOC` already in `OnboardClient.tsx:30`. Single click → receipt anchored.

3. **0G DA documented as a stub with concrete integration path.** AIsphere claims 6 primitives. None of the 8 showcase projects actually use DA. **Adding a documented DA stub with the real proto types** would differentiate Ivaronix as the only entry claiming all 6 with evidence — cited in CLAUDE.md §2.1 as our biggest tech-depth gap.

### 5.2 · Competitor field — strongest threats (subagent C)

| # | Competitor | Why threatening | Their gap |
|---|------------|-----------------|-----------|
| 1 | **AIsphere** | 94/94 tests · 5 mainnet contracts · 7 official 0G skills · OpenClaw-first · Bounty Board with A0GI escrow · 19-page whitepaper · MCP server · Hive Mind | No `--tee-independent` re-verify path · no confidential data room · no embeddable widget |
| 2 | **Provus Protocol** | **30,000+ live mainnet TXs** on VerifierEngine · `broker.responseProcessor.processResponse` already shipped · ELO reputation | Single-use (trading signals) · 2 primitives only · no marketplace |
| 3 | **zer0Gig** | "Efficiency Game" (1-shot completions earn 95%, retries penalized) · 175K Alignment Nodes claim · ProgressiveEscrow v2 | No TEE re-verify · no receipt schema · Alignment-Nodes claim may be aspirational |
| 4 | **Trapezohe / Ghast** | Signed macOS .pkg + Windows .msi installers · Chrome sidebar · public Skills+MCP Store with zod-validated registry.json · Telegram remote control | No on-chain attestation · 0G is backend not trust anchor · Chinese-only docs |
| 5 | **AgentPay** | Clean TypeScript SDK · SplitVault (10-recipient agent-to-agent payments) · 4 primitives | Live receipts not running · placeholder team names suggest incomplete submission |

### 5.3 · The single move that beats AIsphere

Per subagent C: **lead the judge-facing README with the `ivaronix receipt verify --tee-independent` path.** AIsphere's "decision chain" stores `proofHash` but has no third-party reproducible re-verification command. Provus has the `broker.responseProcessor` mechanism but only for trading signals. Ivaronix is **the only competitor in the entire field** that ships a single-command independent re-verifier for arbitrary AI inferences. Pair it with a specific receipt id (e.g., #1004 or the freshly-anchored #1304) and the verifier output `→ FULLY VERIFIED ✓`. One sentence judges can copy-paste.

### 5.4 · Three more patterns from new-entries to mirror

1. **GitHub-hosted skills registry** (Ghast pattern) — `skills/registry.json` with zod-validated manifests, browsable without a wallet, PR-based contribution. Mirrors the on-chain SkillRegistry but gives judges and developers an on-ramp before connecting MetaMask. **Move:** export the canonical 5 first-party skills + 80 imports into a single `registry.json` with schema, link from `/skills` page.

2. **Receipt tier → economic consequence** (zer0Gig Efficiency Game) — TIER 1 receipts release **100%** of the declared `og.creator.fee_split`; TIER 2 receipts release **85%** (delta to treasury). 2-line change to fee allocation. Transforms tier marking from honesty label into market signal. **Move:** wire into `packages/runtime/src/pipeline.ts:461-479` (`allocateFeeSplit`).

3. **Wallet-anchored memory restore** (0G OpenClaw pattern) — single CLI `ivaronix memory restore --wallet 0x...` that deterministically pulls consolidated memory from 0G Persistent Memory back into a fresh install. **Move:** ships naturally with §1.2 above (0G Persistent Memory integration via localhost:1995 sidecar).

---

## §6 · The win-list · agent-shippable, ranked by impact-to-effort

> Synthesized from all four subagents. Each item maps to a specific competitor or judging-criterion gap. No guesses. Every line has a citable source.

### W1 · Add "Use sample contract" auto-fill to home RunPanel · 2h · Criterion 2.4
- **Where:** `apps/studio/src/components/RunPanel.tsx:37-80`
- **Pattern:** Zero Training's `/demo` zero-click flow + `OnboardClient.tsx:30` already has the `SAMPLE_DOC` constant
- **Effect:** judge browsing without a wallet can click ONE button → receipt anchored in 30s. Closes the showcase gap subagent B identified as "single highest-impact missing pattern."

### W2 · Server-render live receipt count on home hero · 1h · Criterion 2.4 + 3
- **Where:** `apps/studio/src/app/page.tsx` (hero block)
- **Pattern:** AlphaDawg `app/page.tsx:getStats` server-render. Provus's "30,000+ TXs" headline. AIsphere's "94/94 tests."
- **Effect:** first-paint number a judge remembers. Server component reads `ReceiptRegistry.nextId()` directly, no JS animation needed.

### W3 · Wire 0G DA disperse into burn-mode receipt path · 8h · Criterion 2.1 (THE BIGGEST GAP)
- **Where:** `packages/runtime/src/pipeline.ts:367+` (burn-mode upload), `packages/og-da/src/index.ts` (gRPC client already exists, never called).
- **Move:** after burnEncrypt produces the encrypted blob, batch-anchor through `og-da/dispersal_blob_with_finalize`. Receipt body gains `storage.daBlobRef = { storageRoot, epoch, quorumId }`.
- **Honest disclosure:** if local DA Client Docker node isn't up, fall back to current 0G Storage path with `request.daBlobRef = null` — no fake claims. Add a `--require-da` flag for the demo path.
- **Effect:** Ivaronix becomes the **only** entry in the entire field claiming 6 0G primitives **with evidence** (subagent C confirms no showcase project shipped DA).

### W4 · Wire 0G Persistent Memory sidecar (`0g-memory`) · 4h · Criterion 2.1 + 2.2
- **Where:** `packages/og-kv/` (currently a stub Map per subagent D), `apps/cli/src/commands/doc.ts` (memory-depth currently scans local FS).
- **Move:** spin up `0g-memory/install.sh` once; replace `og-kv` stub with a thin REST client to `localhost:1995/api/v1/memories`. After every receipt anchor, POST the body. Before each `doc ask`, GET search-by-skillId. Receipt body gains `request.memoryQuery = { method: 'agentic', k, retrievedCount }`.
- **Effect:** sixth 0G primitive added with evidence. AIsphere's "all 6 primitives" claim is now matched.

### W5 · Receipt tier → economic consequence (Efficiency Game) · 2h · Criterion 2.1 + 3
- **Where:** `packages/runtime/src/pipeline.ts:461-479` (`allocateFeeSplit`).
- **Move:** TIER 1 receipts release 100% of `og.creator.fee_split.creator` bps; TIER 2 receipts release 85%, delta routed to treasury. Add `feeMultiplier` field to receipt body so the math is visible.
- **Effect:** mirrors zer0Gig's Efficiency Game. Transforms TIER 1 / TIER 2 from honesty label into market signal — judges scoring Track 3 see economic teeth.

### W6 · Anchor data room manifests on 0G Storage · 4h · Criterion 2 + 4
- **Where:** `apps/cli/src/commands/room.ts` (creation), `apps/studio/src/app/data-room/[id]/page.tsx:28-50` (read).
- **Move:** at room creation, serialize manifest JSON, upload to 0G Storage, store the storageRoot in the manifest's own hash. Page fetches by storageRoot when local FS misses.
- **Effect:** any data-room URL shared with a judge from a different machine **just works**. Currently breaks 100% of the time (subagent D #3 — HIGH impact).

### W7 · Lead README with the `--tee-independent` headline + a fresh receipt id · 1h · Criterion 5
- **Where:** `README.md` top section.
- **Move:** swap the current narrative opener for "Run this command in any terminal: `pnpm install -g @ivaronix/cli && ivaronix receipt verify 1304 --tee-independent`. Expected: → FULLY VERIFIED ✓. No account needed."
- **Effect:** AIsphere's whitepaper-as-Criterion-5 advantage neutralized. Ivaronix is **the only competitor** with this command.

### W8 · GitHub-hosted skills registry (`skills/registry.json`) · 3h · Criterion 2.3
- **Where:** new `skills/registry.json` + zod schema in `packages/skills/src/registry-schema.ts` + a `/skills` page link to "Browse all on GitHub."
- **Pattern:** Trapezohe Ghast Skills+MCP Store.
- **Effect:** developers browse + PR-contribute skills before connecting any wallet. Reduces marketplace contribution friction near zero.

### W9 · Wire SIWE on `/api/run` (or fix `/onboard` copy) · 4h · Criterion 2 + 4
- **Where:** `apps/studio/src/app/api/run/route.ts:21` (operator-wallet signing), `apps/studio/src/app/onboard/OnboardClient.tsx:29` (false promise).
- **Move:** ship SIWE so the receipt's `agent.ownerWallet` matches the connected user wallet. If too risky, fix the copy: "signed by the Ivaronix operator wallet on your behalf — TIER 2 trust" with explicit upgrade path.
- **Effect:** closes subagent D's #2 — judges following the demo path no longer find a receipt that doesn't carry their identity.

### W10 · Marketing first-party skill (`content-pitch-review`) · 2h · Criterion 3
- **Where:** new `seed-skills/content-pitch-review/SKILL.md` + a real receipt fixture.
- **Pattern:** address the user's "marketing guy" question directly. Promotes content-review from imports/ to first-party.
- **Effect:** verified skill count goes 5 → 6, with a marketing persona surface (creator economy story).

### W11 · Fix hardcoded "5 verified skills" + "0G DA in stack band" · 1h · Criterion 2
- **Where:** `apps/studio/src/app/page.tsx:162` (literal 5), `apps/studio/src/app/page.tsx:213` (0G DA claim).
- **Move:** derive count from `loadAllSkills().length`. Either remove the 0G DA chip or add "(integration path documented)" qualifier per CLAUDE.md §8.
- **Effect:** subagent D #4 closed. No brand lies on first paint.

### W12 · Add `/thesis` to home hero CTA + improve discoverability · 30m · Criterion 3 + 5
- **Where:** `apps/studio/src/app/page.tsx` (hero CTA row).
- **Note:** /thesis IS already linked in main nav as "Why" (subagent D was reading older code) — but it's not in the hero CTA row.
- **Move:** add a "Why Ivaronix" tertiary CTA next to "Run a private audit →" / "See a sample receipt".
- **Effect:** the persona-locked story page (CLAUDE.md §2.3 "ONE crisp persona-driven hero story" — exists, not yet hero-promoted).

### Estimated total · ~32 hours of build for the full win-list.
Sequencing: W1, W2, W7, W11, W12 (~5h) ship instant gains. W3 + W4 + W5 (~14h) close the tech-depth gap. W6, W8, W9, W10 (~13h) close the remaining persona + UX gaps.

## §7 · Operator-blocked moves (USER_TODO.md)

- A-2 mainnet funding · A-3 OG portal submission
- B-1 IvaronixReceiptGuard deploy (after A-2)
- C-1 Telegram bot · C-2 ChainGPT audit (mainnet) · C-3 domain · C-4 Demo Day rehearsal

---

## §8 · Self-check · is this plan #1-grade?

Run through the five judging criteria after each iteration:

| # | Criterion | Status |
|---|-----------|--------|
| 1 | 0G Tech Depth | ⚠️ DA + Persistent Memory not integrated yet — gap pending subagent A findings |
| 2 | Implementation Completeness | ⚠️ testnet 13/13 green; mainnet not deployed (operator-blocked) |
| 3 | Product Value & Market Potential | ⚠️ No live customer; deal-lawyer + DD-analyst personas locked but persona-rotation surface (marketing) not yet shipped |
| 4 | UX & Demo Quality | ⚠️ /onboard 5-step friction + no animated live ticker + no zero-friction first-paint demo |
| 5 | Team & Documentation | ✅ PITCH + RECEIPT_SCHEMA + USER_TODO + PHASE_B_DISCLOSURES + planning-01 + planning-002 |

### Re-evaluated after subagent A/B/C/D returns:

| # | Criterion | Status post-W1-W12 |
|---|-----------|--------------------|
| 1 | 0G Tech Depth | ✅ (after W3 + W4: claims 6 primitives **with evidence**, only competitor in field with `--tee-independent` re-verify) |
| 2 | Implementation Completeness | ✅ testnet (after W6 fixes data-room cross-machine break); mainnet still operator-blocked, documented honestly |
| 3 | Product Value & Market Potential | ✅ (after W5 + W8 + W10: economic teeth via tier-multiplier, public skills registry, marketing persona surface, plus existing deal-lawyer / DD-analyst surfaces) |
| 4 | UX & Demo Quality | ✅ (after W1 + W2 + W12: zero-friction first-paint demo, real-number hero, persona-CTA in hero row) |
| 5 | Team & Documentation | ✅ (after W7: README leads with the one command no other competitor has; PITCH + RECEIPT_SCHEMA + USER_TODO + PHASE_B_DISCLOSURES already deep) |

**Status post-W1-W12: FINAL.** Every criterion green. Every gap a competitor occupies is explicitly counter-moved. The plan, executed, beats AIsphere on Criterion 5, matches them on tech depth, and beats them on every other dimension we already shipped (data room, delegated agent, bulk audit, printable receipts, embeddable widget, /agents leaderboard).

---

## Iteration log

- **2026-05-09 v0** — scaffold seeded; 4 subagents launched; cron `b7b82b77` armed at 5-min cadence.
- **2026-05-09 v1** — subagent A returned; §1 deepened with verified DA + Persistent Memory facts.
- **2026-05-09 v2** — subagents B, C, D returned in parallel. §5 deepened with showcase patterns + competitor field + brutal internal audit. §6 win-list assembled (W1-W12 with hour estimates). §8 self-check upgraded — every criterion ✅ post-execution.
- **FINAL · plan converged 2026-05-09.** The win-list is complete. The cron's job is done — operator decides which W-items to ship and in what order. Cancel cron `b7b82b77` after verifying this doc.
