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

### 1.1 · 0G DA integration
- **Current stance:** explicitly skipped. `docs/PHASE_B_DISCLOSURES.md` says "no public testnet endpoint."
- **What we need to verify:** does 0G DA exist on **mainnet** (chainId 16661 Aristotle)? What's the endpoint, what's the SDK package, what's the call shape? AIsphere claims all 6 0G primitives — we need to either match or honestly say why not.
- **Plan slot:** [pending subagent A — read `oglabs resources/`]
- **Testnet move:** if DA testnet endpoint exists, integrate now. If not, document the integration shape for mainnet so the code path is ready when we promote.
- **Mainnet move:** wire DA at the receipt-batching layer. Every N receipts batch into a DA blob; the blob's reference goes into the next receipt's storage root. Anchored receipts gain a `request.daBlobRef` field.

### 1.2 · 0G Persistent Memory
- **Current stance:** not integrated. The `og-kv-server` exists in `oglabs resources/` but we haven't wired it.
- **What we need to verify:** is og-kv-server the implementation of "Persistent Memory" (the docs say "coming soon for AI Agents")? What does it expose? Get/set/list/TTL/namespace?
- **Plan slot:** [pending subagent A]
- **Move:** if it's available, replace the local indexer SQLite with og-kv-server reads. Receipt indexing becomes part of the 0G stack instead of a sidecar SQLite.

### 1.3 · Other 0G primitives we may have missed
- Sealed Inference, AI Alignment Nodes, fine-tuning, agenticID, OpenClaw orchestration depth, x402 micropayments.
- **Plan slot:** [pending subagent A]

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

### 5.1 · Patterns from showcase we should match
- [pending subagent B]

### 5.2 · Competitor field — strongest threats
- [pending subagent C]

### 5.3 · The single move that beats #1 of the field
- [pending subagent C]

---

## §6 · Top-of-funnel + distribution moves I (the agent) can ship

> These don't need operator action — I can build them today.

- /changelog page (§2.4)
- Live receipt ticker on hero (§2.2)
- Skill catalog search (§2.3)
- /skill/[id] full version history (§2.5)
- Marketing first-party skill (§3.1)
- Receipt revision compare (§3.2)
- Zero-friction one-click "see it work" demo on home (§2.1)
- Chinese-language `/thesis-zh` page (CLAUDE.md §13 explicitly accepts CN)
- 0G DA integration if mainnet endpoint exists per subagent A

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

**Status:** NOT FINAL. Five criteria, four warnings. The plan converges when every row is ✅ (with explicit "blocked on operator" allowed for items the agent cannot ship).

---

## Iteration log

- **2026-05-09 v0** — scaffold seeded; 4 subagents launched; cron `b7b82b77` armed at 5-min cadence.
