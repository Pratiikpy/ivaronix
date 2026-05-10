# Ivaronix — Component-by-Component Best-of Analysis

> **Status:** v1 (locked 2026-05-07).
> **Source:** deep cross-folder pass over `oglabs resources/`, `og-projects-showcase/`, `entries/`, `CLI Open Source Project/`. Every decision below cites concrete source files.
> **Companion docs:** `PRD.md` (what & why), `HLD.md` (architecture), `docs/build/BUILD.md` (operational plan), `RECEIPTS_SPEC.md`, `docs/reference/REFERENCE_PATTERNS.md`, `docs/pitch/PITCH.md`.
> **Rule:** this doc holds *user-facing UX decisions per component*. PRD/HLD/BUILD reference this doc for the "how should it actually look and feel?" answers.

---

## How to use this doc

Each section answers four questions for one component:
1. **What I looked at** — concrete files / repos that informed the decision.
2. **Best inspiration found** — the specific UX or pattern worth copying.
3. **Decision for Ivaronix** — what this component IS in our app.
4. **Why users will love it** — the visceral feeling, not a feature list.

When designing a screen or CLI surface, **read the matching section here first**, then implement.

---

## 1. Onboarding flow (wallet connect → mint passport → first action)

**What I looked at:**
- `og-projects-showcase/Aishi/app/src/app/aishi-mint/` — `WalletConnection.tsx`, `MintForm.tsx`, `MintStepper.tsx`, `MintStatus.tsx`, `PriceDisplay.tsx`. A staged stepper for wallet → name uniqueness check → 0.1 OG payment → mint, with explicit one-agent-per-wallet enforcement and live treasury/price display.
- `og-projects-showcase/Aishi/SHOWCASE_ANALYSIS.md` — establishes that one-companion-per-wallet plus unique-name check are part of the onboarding identity, not an afterthought.
- `entries/SealedMindMonoRepo/ANALYSIS.md` — SIWE auth + per-user MemoryEngine boot; CLI `login` mirrors web SIWE, so onboarding works the same in two surfaces.
- `entries/0G_OpenClaw_Hackathon/ANALYSIS.md` — `pnpm openclaw onboard` one-command, deterministic stream IDs derived from wallet — wallet *is* the agent.
- `oglabs resources/awesome-0g/README.md` — Galileo testnet faucet (`faucet.0g.ai`) and chainscan links are first-class, so onboarding can show "you got 0G, now sign" with a real hop.

**Best inspiration found:**
- Aishi's mint stepper: "WalletConnection → PriceDisplay → MintForm → MintStatus → TransactionStatus" as discrete components, each a visible row that lights up. Reduces "I clicked something and the page froze" anxiety.
- 0G OpenClaw's wallet-derived deterministic identity: same wallet = same agent on any device, no separate account creation.

**Decision for Ivaronix:**
Single-page onboarding stepper at `/onboard` with five visible rows that flip from grey → spinner → green-check, in this order: (1) Connect wallet, (2) Auto-fund from faucet if balance < 0.05 OG (don't make user leave the app), (3) Pick handle (live uniqueness check), (4) Mint Agent Passport (ERC-7857) — show the mint tx hash as it confirms, (5) Run your first action — auto-loads a 200 KB sample PDF and runs `doc summarize`, finishing with the user's first Action Receipt. The whole flow targets <90 seconds end-to-end; the user's "first time" is also their first share-able receipt.

**Why users will love it:**
You don't end onboarding holding an empty profile — you end it holding a public proof URL of a real AI run with your name on it. The first artifact is the hook.

---

## 2. Drop-zone hero (Studio `/`)

**What I looked at:**
- `og-projects-showcase/Aishi/app/src/components/landing/HeroSection.tsx` plus `FaultyTerminal` background — Aishi commits to a single visceral hero element (Live2D + terminal) instead of a feature wall.
- `og-projects-showcase/dont-get-drained/frontend/components/ThinkingScreen.tsx` — animated three-dot status row "TEE Enclave · 0G Network · Analysis" with rotating phrase ("Checking token legitimacy...", "Consulting the oracle..."). Pure progress theater that *feels* like the system is working hard.
- `entries/provus-protocol/ANALYSIS.md` — live iteration counter, volatility gauge, ELO card all updating every 15s. Numbers that move are the strongest "this is real" signal.
- `entries/AlphaTrace/ANALYSIS.md` — minimal hero: live agent status, decision feed sliding in. Card-based, dark-themed.
- `oglabs resources/0g-storage-web-starter-kit` — drag-and-drop upload as the canonical 0G UX primitive.

**Best inspiration found:**
- Drained's `ThinkingScreen` rotating-message + tri-light row — it makes a 30-second wait feel like work happening at three layers simultaneously. Steal exactly.
- AlphaTrace's "decision card slides in, click View on 0G Explorer / Verify Storage" — the result IS the hero state once it lands.

**Decision for Ivaronix:**
Hero is a single full-bleed drop-zone with one input field above it (`Ask a question or just drop a file`). On drop/submit, the zone collapses to a left-rail status pane showing a **four-light row** — `0G Storage · 0G Compute · TEE Attest · 0G Chain` — each lighting green in sequence, with a rotating sub-line ("Hashing 1.2 MB…", "Routing to provider 0xd996…", "Awaiting TEE signature…", "Anchoring root 0x5e57…"). Result slides in from the right as the Audit Report (§3) plus a permanent-looking `/r/<id>` URL bar at top with copy button. **No carousel, no feature cards, no testimonials above the fold.**

**Why users will love it:**
The page does one thing and shows you the four 0G primitives doing real work in real time. After 8 seconds, you're holding a URL you can paste in Discord — that's the entire pitch in one motion.

---

## 3. Audit Report viewer

**What I looked at:**
- `entries/0g-buildproof/ANALYSIS.md` — evidence-bound JSON: every finding linked to source, score caps that visibly explain why a project couldn't exceed 75 ("No 0G Compute review: max 75"). Badges (Storage Verified, Chain Anchored, Compute Reviewed, Judge Ready) are a clean visual language.
- `og-projects-showcase/dont-get-drained/frontend/components/VerdictPanel.tsx` — multi-agent grid: per-agent card with PASS/FAIL chip, 3-line truncated notes, TEE/Sig footer; final banner shows `3/5 agents approved (majority)`.
- `entries/musashi/ANALYSIS.md` — STRIKE evidence bundle is a Merkle-rooted JSON, downloadable, reverifiable.
- `entries/ChainShield/ANALYSIS.md` — security audit report stored back to 0G Storage with report-hash linked to source-hash; full bidirectional anchor.
- `entries/aegis-vault/ANALYSIS.md` — `Sealed · TEE` chip and `TEE` badge pattern with explorer links per attested action.

**Best inspiration found:**
- BuildProof's score-cap mechanic — showing *why* the score is capped is more honest than a generic 73/100. Tells the user what to fix.
- Drained's per-agent verdict card grid — collapsible reasoning under a chip, not a wall of LLM text.
- Aegis's `Sealed · TEE` chip with explorer link — chip-as-receipt is the right primitive.

**Decision for Ivaronix:**
Three-stack layout:
- **Top** — Verdict banner with PASS/FAIL/REVIEW chip
- **Middle** — Badge row (`Storage Verified` / `Chain Anchored` / `TEE Attested` / `Consensus 0.92`), each a clickable chip linking to chainscan / storagescan / TEE proof JSON
- **Bottom** — Per-agent verdict cards in a 3-column grid, each card being chip + 3-line summary + collapsible "Show reasoning"

When consensus is run: scores ≥0.85 show solid green; 0.7–0.85 amber with disagreement summary; <0.7 red with the actual disagreeing claim quoted side-by-side. Add BuildProof-style cap explanations: `Score capped at 0.78 — only 2 of 3 reviewers attested`.

**Why users will love it:**
It looks like a court receipt, not a chat log. Every claim is a chip you can click and verify on a different surface — there's nowhere for the AI to hide hand-waving.

---

## 4. Skill Browser (`/skills`)

**What I looked at:**
- `CLI Open Source Project/awesome-claude-skills/README.md` — categorized index (Document Processing, Dev & Code, Data, Business, Communication, Creative, Productivity, Collaboration, Security, App Automation), each entry a one-line description with author handle. ~150 skills, one page, scannable. <!-- numbers-snapshot-allow:third-party-readme-approximation -->
- `og-projects-showcase/Agent0G/SHOWCASE_ANALYSIS.md` — agent marketplace with category browsing, agent cards, ratings, usage counters, price-per-use. The card *is* the contract.
- `entries/AgentHub/ANALYSIS.md` — permission-disclosure on cards (network access, secrets, scoped data). Trust info upfront, not hidden in a modal.
- `og-projects-showcase/dont-get-drained/frontend/app/marketplace/page.tsx` — small specialized agent marketplace with creator filter.
- `entries/musashi/ANALYSIS.md` — `openclaw skills install musashi` one-command install pattern.

**Best inspiration found:**
- awesome-claude-skills' single-page categorized list — no infinite scroll, no AI search box, just human-organized columns. Scales to 50–200 skills.
- AgentHub's permissions-on-card — show network/secrets/scope as colored pills before install. Builds trust at browse time, not install time.

**Decision for Ivaronix:**
Single-page browser with sticky left-rail categories (Document, Code, Data, Web, Crypto, Security, Comms, Creative). Each skill card: name, one-line description, author handle, install-count, **three permission pills** (Network / Files / Compute), and a `Use` button that runs the skill in a sandbox preview against a sample input — *no install required to try*. Search bar filters live as you type. **No AI-curated "recommended for you"** — that's noise; trust the categories.

**Why users will love it:**
You can try a skill in 4 seconds without installing or signing anything. Permission pills mean you never get surprised by a skill phoning home.

---

## 5. Skill Detail page (`/skill/<id>`)

**What I looked at:**
- `oglabs resources/0g-compute-skills/SKILL.md` — SKILL.md format with YAML frontmatter (name, description) + body. Anthropic open standard.
- `entries/musashi/ANALYSIS.md` — skill page shows agent INFT address, win rate, cumulative return, strike history with on-chain links. Reputation is not separate from the skill.
- `og-projects-showcase/Agent0G/SHOWCASE_ANALYSIS.md` — agent detail page with execution terminal preview, reviews, usage count, workflow hash on 0G Storage.

**Best inspiration found:**
- MUSASHI's "reputation is the skill page": win rate and cumulative return are first-class numbers next to the description, backed by chain links.
- Agent0G's execution terminal embedded in the detail page so you can watch a live run before installing.

**Decision for Ivaronix:**
Detail page sections in this order:
1. **Header** — name, author, install button, version, manifest hash linked to 0G Storage
2. **Live demo box** — pre-loaded input the user can edit and run for free
3. **Receipt feed** — last 20 public Action Receipts from this skill with PASS/FAIL/REVIEW chips
4. **Reputation row** — runs / pass-rate / avg-consensus / median-cost, all derived from on-chain receipts not self-reported
5. **SKILL.md rendered** as markdown below

No "related skills" section.

**Why users will love it:**
Every skill page is its own miniature proof-of-work — you don't trust the marketing copy, you read the last 20 receipts.

---

## 6. Public Proof URL (`/r/<id>`)

**What I looked at:**
- `og-projects-showcase/verifyhuman/SHOWCASE_ANALYSIS.md` — receipt page shows 0G proof, evidence root, chain receipt, 0G Galileo explorer link, on-chain verification match. Owner-only recording but publicly viewable.
- `entries/alphatrace/ANALYSIS.md` — every decision card has "View on 0G Explorer" and "Verify Storage" buttons that re-pull the JSON and check hash equality client-side.
- `entries/musashi/ANALYSIS.md` — `verify` CLI command downloads + verifies evidence with Merkle proof, anyone-can-verify is the brand promise.
- `entries/0g-buildproof/ANALYSIS.md` — judge-mode toggle: condensed view for evaluators, full evidence view for builders.

**Best inspiration found:**
- AlphaTrace's "Verify Storage" button that re-fetches and re-hashes client-side — turns verification from a backend trust claim into a visible cryptographic check.
- VerifyHuman's local-vs-on-chain comparison panel — backend verification hash vs. on-chain receipt hash, side-by-side.
- BuildProof's Judge Mode toggle.

**Decision for Ivaronix:**
URL is `ivaronix.app/r/<8-char-id>`. Page is print/share-friendly:
- **Top banner** — PASS/FAIL/REVIEW + consensus score
- **Left column** — input excerpt (with burn-mode "input not retained" notice if applicable)
- **Right column** — verdict and reasoning
- **Bottom row** — 4-tile receipt strip:
  - `0G Storage Root` (storagescan link + "Re-verify" button that re-downloads, re-hashes, animates a green check)
  - `0G Chain Anchor` (chainscan tx link)
  - `TEE Attestation` (provider address + signature link)
  - `Passport Signature` (agent passport profile link)

**No login required** to view. OG-image auto-generates the verdict banner so Twitter/Discord previews show the result.

**Why users will love it:**
You can post the URL anywhere and the recipient can verify the AI claim themselves in three clicks, with no Ivaronix account. It's a one-page contract.

---

## 7. Agent Passport profile (`/@<handle>`)

**What I looked at:**
- `entries/provus-protocol/ANALYSIS.md` — ELO 847 with K-factor 32, public reputation trajectory, 30K+ on-chain transactions visible, signal accuracy 79%. Reputation as a number that moves.
- `entries/AIsphere/ANALYSIS.md` — agent passport with INFT identity, decision audit trail, agent-soul state visible.
- `entries/musashi/ANALYSIS.md` — INFT agent identity with strike history, reputation, win-rate cached O(1).
- `entries/POD/ANALYSIS.md` — POD score ring (0–1000) with 4-category breakdown (Delivery, Satisfaction, On-Time, Diversity), percentile rank ("Top 39% globally"), score-history bar chart.
- `og-projects-showcase/Aishi/SHOWCASE_ANALYSIS.md` — personality traits chart (creativity, analytical, empathy, intuition, resilience, curiosity), milestone unlocks, evolution events.

**Best inspiration found:**
- POD's conic-gradient score ring + percentile rank — humans understand "Top 39% globally" instantly.
- Provus's ELO trajectory chart — chess-metaphor reputation is honest because losses bring it down.
- Aishi's milestone-unlock event log — turns reputation into a story, not a single number.

**Decision for Ivaronix:**
Profile is split:
- **Top** — handle, passport NFT thumbnail, total receipts, consensus pass-rate, ELO score with delta arrow
- **Mid** — receipt feed (paginated, filterable by skill, PASS/FAIL/REVIEW chips, public + private toggle)
- **Bottom-left** — 6-axis radar (Document, Code, Data, Web, Security, Comms) showing per-domain pass-rate
- **Bottom-right** — milestone log ("First 100 receipts", "First sealed run", "First 1.0 consensus")

All numbers derive from on-chain receipts; nothing is self-reported. Add a one-click "share my passport" that generates an OG-image.

**Why users will love it:**
It's a public, cryptographic resume. Brag-worthy without being LinkedIn-cringe because every number is provable.

---

## 8. Memory Permission Center (`/memory`)

**What I looked at:**
- `entries/SealedMindMonoRepo/ANALYSIS.md` — `CapabilityRegistry` contract with explicit grant/revoke for external app access, `MemoryAccessLog` records every read on-chain.
- `entries/0g-mindvault/ANALYSIS.md` — memory snapshots with on-chain root, encrypted config, conflict-resolution UI, memory browser page.
- `entries/AIsphere/ANALYSIS.md` — encrypted memory vault with AES-256-GCM, on-chain metadata hash, decryption only by owner.
- `entries/0G_OpenClaw_Hackathon/ANALYSIS.md` — local-first memory sync (uploads changes, not full dumps), wallet-derived stream IDs.

**Best inspiration found:**
- SealedMind's `CapabilityRegistry` model: "App X can read tag:work between dates A–B for N reads". Capabilities are time-bound and scoped.
- MindVault's memory-conflict UI ("supersede stale memories"): users see two facts that contradict and pick one.

**Decision for Ivaronix:**
Three tabs:
1. **Memories** — searchable list with tags (work, finance, personal, code), each entry shows storage root, last-accessed-by chip, encryption indicator, and a `Forget` button that records a tombstone receipt
2. **Permissions** — granted apps/skills with scope (which tags), expiry, read-count remaining, and one-click revoke
3. **Access Log** — on-chain record of every read with timestamp + caller + storage root, exportable CSV

The whole tab feels like a phone's app-permissions screen — that mental model already works.

**Why users will love it:**
"AI that remembers you" is a privacy minefield in every other product. Here, every read is on-chain, every permission has an expiry, and every forget is a receipt. The trust is structural, not promised.

---

## 9. Global stats dashboard (`/global`)

**What I looked at:**
- `entries/provus-protocol/ANALYSIS.md` — 30K+ TXs, 15K iterations, 247ms avg latency, 99.7% uptime, gas/cycle 0.008 OG, 79% accuracy. Numbers that anchor real load.
- `og-projects-showcase/ETH_Global_Cannes_2026/SHOWCASE_ANALYSIS.md` — landing page pulls real HCS + HTS stats live, not mock data.
- `entries/musashi/ANALYSIS.md` — `make status` gives global per-agent reputation; dashboard browses STRIKE history.
- `entries/aegis-vault/ANALYSIS.md` — $1M TVL, first sealed execution timestamp, "first public execution" event log.

**Best inspiration found:**
- AlphaDawg/Cannes pulling real Hedera Mirror Node stats live — no mock data on landing.
- Provus's loop-consistency metric (`15s ±200ms`) — odd-but-honest metrics convey "we know our system."

**Decision for Ivaronix:**
Sparse, honest dashboard: total receipts (counter ticking up live via SSE), total bytes anchored on 0G Storage, total TEE attestations, total skills installed, top 10 skills by 7-day usage, top 10 agents by ELO, current avg consensus score, latest 50 public receipts as a scrolling ticker. **No vanity numbers** (no "10M users"), no charts that go up and to the right. One section is "Live now" — receipts being minted in the last 60s, animated.

**Why users will love it:**
It feels like an exchange's volume tracker, not a marketing landing page. People who like watching real numbers move will stay there.

---

## 10. CLI TUI

**What I looked at:**
- `CLI Open Source Project/opencode/README.md` — Tab-switchable agents (build/plan), 100% open-source, provider-agnostic, client/server architecture.
- `CLI Open Source Project/hermes-agent/README.md` — multi-line editing, slash-command autocomplete, conversation history, interrupt-and-redirect, streaming tool output, gateway to TG/Discord/Slack/WhatsApp from a single process, cron, voice-memo transcription, `hermes claw migrate` shows respect for migrating users.
- `CLI Open Source Project/octogent/README.md` — `.octogent/tentacles/<id>/CONTEXT.md` + `todo.md` as durable agent state, parent/worker spawning, worktree isolation, local API on auto-port 8787.
- `og-projects-showcase/Aishi/app/src/terminal-xstate/components/` — `FullscreenTerminal`, `PremiumCommandBar`, `TerminalStatusLine`, `SiriOrb`, `MicrophoneButton` — terminal aesthetics inside a web UI, full XState command lifecycle.

**Best inspiration found:**
- OpenCode's Tab-key agent switch (build vs plan) — single keystroke mode change is the cleanest mode UX I've seen in a TUI.
- Hermes's slash-command autocomplete + multi-line edit + Ctrl+C interrupt-and-redirect — the proven primitives.
- Octogent's `.<tool>/` durable folder pattern (see §11).
- Aishi's `SiriOrb` showing inference state — borrow for status line.

**Decision for Ivaronix:**
`forge` CLI built on OpenCode's TUI shell pattern (Bubble Tea / `ink`), with:
- **Tab** to switch between **build** (writes receipts, costs OG) and **plan** (read-only, simulates)
- **`/` slash autocomplete** on every skill (`/doc`, `/code`, `/web`)
- **Ctrl+C** interrupts streaming inference and lets you redirect
- **Animated four-light status line** on the bottom row mirroring Studio (`storage · compute · attest · chain`)

One-shot mode `forge doc ask file.pdf --burn --consensus --receipt` outputs the receipt URL on stdout — the killer demo. `forge` with no args drops into TUI; `forge gateway start` runs the API+MCP+Telegram bot like Hermes.

**Why users will love it:**
It feels like Claude Code, but every output ends with a receipt URL you can paste in a PR or a Discord. Power users get the modes; new users get the one-shot.

---

## 11. `.ivaronix/` folder structure

**What I looked at:**
- `CLI Open Source Project/octogent/README.md` — `.octogent/tentacles/<id>/CONTEXT.md` + `todo.md` + scoped notes; `~/.octogent/projects/<id>/state/` for runtime; PTY sessions stale-marked on restart. Inspectable, durable, file-based.
- `CLI Open Source Project/hermes-agent/` — `~/.hermes/skills/`, `~/.openclaw` for migration. Skills as folders.
- `og-projects-showcase/ETH_Global_Cannes_2026/CLAUDE.md` — `.claude/rules/og-compute.md` auto-loaded for `src/og/**` paths. Path-scoped rules.
- `entries/0G_OpenClaw_Hackathon/ANALYSIS.md` — local-first sync; manifest pointer in 0G KV; restore reads pointer → manifest → files.

**Best inspiration found:**
- Octogent's two-folder split: project-scoped (`.octogent/`) for context, user-scoped (`~/.octogent/`) for state. Clean.
- Cannes's path-scoped rule loading — rules live next to the code they govern.

**Decision for Ivaronix:**

**Project-scoped `.ivaronix/`** contains:
- `passport.json` — handle, agent passport NFT, owner address
- `skills/<id>/SKILL.md` — installed skills, vendored
- `memories/` — encrypted local cache, mirror of 0G Storage
- `receipts/<yyyy-mm>/<id>.json` — local copy of each receipt for offline view
- `manifest.json` — pointer to 0G KV, last-sync timestamp

**User-scoped `~/.ivaronix/`** contains:
- `keys/` — encrypted wallet
- `state/` — TUI session state, transcripts
- `cache/` — provider/service catalogues with TTL

All files plain JSON or markdown — `cat`-able, `git diff`-able. **Nothing critical lives only in memory.**

**Why users will love it:**
You can `cd` into `.ivaronix/` and *see* what your agent knows. Power users will trust the system because they can audit the directory; teams will commit `skills/` and `passport.json` to share an agent.

---

## 12. Receipt verify UX (the 3-state surface)

**What I looked at:**
- `entries/alphatrace/ANALYSIS.md` — "Verify Storage" button does client-side hash compare; chain hash → 0G Storage fetch → match check.
- `og-projects-showcase/verifyhuman/SHOWCASE_ANALYSIS.md` — backend `taskStatus` route returns `chainId, contractAddress, explorerUrl, onChainVerificationMatch` boolean.
- `entries/musashi/ANALYSIS.md` — `verify` CLI: downloads evidence, recomputes Merkle, prints PASS/FAIL.
- `entries/aegis-vault/ANALYSIS.md` — `Sealed · TEE` chip + `TEE` badge with explorer link per attested action; three states naturally fall out (sealed, attested, executed).

**Best inspiration found:**
- AlphaTrace's client-side re-hash with green-check animation. The user *sees* the cryptographic verification happen.
- Musashi's CLI `verify` exit code 0/1 — scriptable verification.

**Decision for Ivaronix:**
Three explicit states everywhere a receipt is shown — chip color and label match exactly across CLI and Studio:

| State | Color | Meaning |
|---|---|---|
| **Pending** | amber, dashed border | root computed but not yet anchored / TEE sig not yet returned |
| **Verified** | solid green | storage root hash matches downloaded bytes AND chain anchor matches AND TEE signature recovers to expected provider |
| **Mismatch** | red, with diff panel | shows which of the three checks failed and the actual vs expected hashes side-by-side |

CLI: `forge receipt verify <id>` re-pulls all three, prints a 3-line status, exits 0 / 1 / 2. Studio: same three-row check with `Re-verify` button that re-runs client-side and animates the row turning green. Burn-mode receipts skip the input-hash row but still verify output + chain + TEE.

**Why users will love it:**
Verification is a 4-second action, not a vague trust claim. When it goes green, you watched it go green.

---

## 13. Skill format / manifest

**What I looked at:**
- `oglabs resources/0g-compute-skills/SKILL.md` — Anthropic-standard SKILL.md with YAML frontmatter (name, description) + markdown body, references in `references/`.
- `CLI Open Source Project/awesome-claude-skills/README.md` — confirms SKILL.md is the open standard now backed by Claude Code, Claude.ai, OpenAI Codex, Cursor, Gemini CLI, Antigravity, Windsurf.
- `entries/AgentHub/ANALYSIS.md` — `agent-compose` execution definition + permission/network/secrets declared upfront.
- `og-projects-showcase/Aishi/SHOWCASE_ANALYSIS.md` — domain-specific prompt modules (dream, conversation, monthly, yearly) instead of one monolithic prompt.
- `entries/musashi/ANALYSIS.md` — minimal `openclaw.json` for analysis-only mode + extended config for publishing mode (graceful escalation).

**Best inspiration found:**
- Anthropic SKILL.md format — adopt as-is; it's already the standard.
- AgentHub's `agent-compose` permissions block — declare network, files, secrets upfront.
- MUSASHI's two-tier config (analysis vs publishing) — most users never need the wallet-touching path.

**Decision for Ivaronix:**
Fully Anthropic-compatible SKILL.md with **one extension block — `og:` — that contains all 0G-native fields**. This `og:` block is **the real moat** (concern #3 fix): a vanilla SKILL.md fork can't carry it without rebuilding the entire 0G-native stack.

```yaml
# === Vanilla awesome-claude-skills SKILL.md frontmatter (compatible) ===
---
name: github-audit
description: Audits a public GitHub repo
license: Apache-2.0
---

# === Ivaronix og: extension (the moat) ===
og:
  permissions:
    memory_access: "project_only"
    network_access: ["github.com", "api.github.com"]
    wallet_access: false
    writes_files: false
    shell_access: "sandbox-only"
    receipt_required: true
    storage_quota_per_run: "5MB"        # 0G Storage write cap
    storage_namespace: "audits/"        # restricted namespace
    compute_tee_required: true          # must use sealed inference
    chain_gas_budget: "0.01 OG"         # max gas per run
    passport_min_trust: 0               # min trustScore to install
  reputation:
    on_pass: { trustScore: +1, receiptCount: +1 }
    on_fail: { trustScore: -2, violationCount: +1 }
    on_violation: { trustScore: -10, locked: true }
  consensus:
    required: false
    default_tier: "standard"            # quick | standard | high-stakes
  burn:
    auto_enable: false                  # auto-enable burn mode for sensitive skills
  creator:
    passport: "did:0g:passport:0x..."
    fee_split: { creator: 70, treasury: 30 }   # % of OG fees to creator
  scanner:
    last_scan_at: 1715000000
    score: 92                           # min 80 to publish
    warnings: []
  anchor:
    manifest_hash: "sha256:..."         # 0G Storage root of skill bundle
    registry_address: "0x..."           # SkillRegistry on chain
    token_id: 23
    tx_hash: "0x..."
```

Skill folder:
- `SKILL.md` — frontmatter + `og:` block + body (Anthropic standard + 0G extension)
- `references/` — load-on-demand context
- `scripts/` — executable helpers
- `manifest.json` — auto-generated, contains 0G Storage root of the skill bundle so installs are reproducible

`forge skill install <id>` resolves from the registry, fetches the bundle from 0G Storage by manifest hash, verifies the Merkle root, and pins the version. Authors run `forge skill publish` which uploads the bundle, anchors the root, and registers in the on-chain registry.

**Why this is a real moat (not transient):**
- A vanilla SKILL.md fork can't carry `og.reputation.on_pass` — there's no on-chain registry tracking it.
- Can't carry `og.creator.fee_split` — there's no payment router routing it.
- Can't carry `og.permissions.compute_tee_required` — there's no Router + broker integration enforcing it.
- Can't carry `og.anchor.manifest_hash` — there's no `SkillRegistry` contract anchoring it.
- To replicate the `og:` block, a competitor must rebuild the entire 0G-native stack underneath. **That's the moat.**

**Why users will love it:**
Existing Claude Skills work in Ivaronix unmodified — that's a 1000+ skill long-tail on day one. Skill authors get reproducible installs, on-chain provenance, automatic reputation tracking, and an opt-in revenue split — without writing a single line of 0G-specific code. The `og:` block fills itself in via `forge skill publish` defaults.

---

## 14. Burn Mode UX

**What I looked at:**
- `entries/aegis-vault/ANALYSIS.md` — sealed strategy: `keccak(intentHash, attestationReportHash)` pre-commit at block N, reveal at N+1, params never leave TEE. Sealed-mode is opt-in per vault, with a `Sealed · TEE` chip everywhere it applies.
- `entries/SealedMindMonoRepo/ANALYSIS.md` — TEE fact extraction runs *inside* the enclave, only attested output leaves.
- `entries/AIsphere/ANALYSIS.md` — TEE proof badge on every response.
- `entries/musashi/ANALYSIS.md` — `seal-intelligence` CLI command encrypts + uploads intelligence bundle.
- `og-projects-showcase/dont-get-drained/frontend/components/ThinkingScreen.tsx` — visible "TEE Enclave · 0G Network · Analysis" lights during inference.

**Best inspiration found:**
- Aegis's sealed-mode chip everywhere — burn mode must be visible at every receipt surface, not just at run time.
- Drained's TEE light blinking during inference — burn mode should *feel* different in the UI, not just be a metadata flag.

**Decision for Ivaronix:**
Burn-mode is a single toggle in the drop-zone hero (`--burn` in CLI). When on:
- Input hash is computed and shown but the bytes are **never** sent to the indexer
- Only output + TEE attestation + chain anchor are recorded
- The receipt page shows a red lock chip "Input not retained" and the storage row reads `n/a — burn mode` instead of a hash
- The four-light hero changes color: storage light goes purple instead of green, TEE light pulses faster
- CLI status line says `burn · tee-sealed`
- The receipt explicitly says "This run was sealed inside a TEE; the operator cannot reconstruct the input from any artifact" with a link to the verifier docs

**Why users will love it:**
For a finance/legal/medical user, burn-mode is the difference between "we tried to make this private" and "we cannot show you the input even if you sue us." The visual language reinforces the cryptographic reality.

**Honest scope (locked, surfaced in tooltip + receipt page footer):**
> Burn Mode protects against **operator-side disclosure**: the Ivaronix daemon, the 0G Router, and 0G Compute providers cannot reconstruct the input from any artifact stored on 0G Storage, because the AES-256-GCM session key is destroyed locally and the storage upload is encrypted ciphertext only. **Burn Mode does NOT protect against compromise of the user's local machine** — if a plaintext copy of the input was retained locally before encryption (for example in editor undo history, terminal scrollback, swap file, or browser cache), that copy remains under the user's control and responsibility. For end-to-end privacy, combine Burn Mode with: full-disk encryption, swap disabled, terminal/editor history disabled, browser private mode.

This footnote appears on the Studio Burn Mode tooltip, on every Public Proof URL receipt page when `burn=true`, and in the CLI when `--burn` is passed. **Honesty is the brand position** — auditors and security people respect "we know the boundary" more than "we promise everything."

---

## 15. Consensus output rendering (tiered, cost shown upfront)

**What I looked at:**
- `og-projects-showcase/dont-get-drained/frontend/components/VerdictPanel.tsx` — multi-agent grid, "3/5 agents approved (majority)", per-agent PASS/FAIL chip + 3-line note + TEE/Sig footer. Top banner is the aggregate.
- `og-projects-showcase/ETH_Global_Cannes_2026/CLAUDE.md` — Alpha → Risk → Executor adversarial debate, retry + HOLD fallback, JSON parsing with try/catch (7B malforms).
- `entries/musashi/ANALYSIS.md` — adversarial bull/bear debate, 3–4 convergence scores reach STRIKE; only convergence is the bar.
- `entries/aegis-vault/ANALYSIS.md` — policies: unanimous / majority / anyReject — the policy is part of the receipt.

**Best inspiration found:**
- Drained's 3-column verdict grid + aggregate banner — the cleanest multi-agent rendering I've seen.
- Aegis's named policy (unanimous/majority/anyReject) shown on the receipt — so the user knows *what rule* produced the verdict.

**Decision for Ivaronix:**

**Tier picker on the run config UI** with cost shown upfront — user explicitly opts into the level they want:

| Tier | Roles | Cost | When |
|---|---|---|---|
| Quick | 1 (single model) | ~$0.02 | drafts, low-stakes |
| **Standard (default for `--consensus`)** | 3 (analyst / critic / judge) | ~$0.10 | most audits, doc-asks, code reviews |
| High-Stakes (opt-in `--high-stakes`) | 5 (+ risk-reviewer + evidence-checker) | ~$0.25 | legal / contract / financial / medical |

**Run-result rendering** (same layout for all tiers, just more cards in higher tiers):
- **Top** — banner: `Consensus 0.87 · Tier: Standard · 3 reviewers · Cost: 0.018 OG`
- **Mid** — per-reviewer card grid showing model name, PASS/FAIL chip, 1-sentence summary, "Show reasoning" expand, and TEE-verified footer
- **Bottom** (only when consensus < 0.85) — a "Disagreement Summary" box that quotes the conflicting claims side-by-side: `Reviewer A: "Contract is safe." Reviewer C: "Reentrancy on line 142."` so the user sees exactly *what* the disagreement is, not just that there was one

CLI prints the banner + a one-line per reviewer + the disagreement quote if any.

**Why default to 3-role (not 5):**
- 5-role costs ~2.5× more per run; for an automation loop, that's the difference between $5/100-receipts and $25/100-receipts.
- Critic already does adversarial work; Judge already does synthesis with cycle memory.
- Risk Reviewer + Evidence Checker are *nice-to-have* legal-frame additions, not needed for most use cases.
- Honesty UX: the user picks their cost tier knowingly. Better than us auto-spending their OG.

**Why users will love it:**
You don't get an averaged-out lukewarm answer that hides which reviewer thought what. The disagreement summary is the most valuable part of the receipt — it tells you exactly where to look manually.

---

## Cross-component themes

These patterns must be applied consistently across every surface:

1. **The Action Receipt is the spine, not a feature.** Every surface (drop-zone, skill page, passport, CLI, /global) ends in or starts from a receipt. Aegis, Musashi, Provus, BuildProof, AlphaTrace, Drained — every strong project in this corpus made one cryptographic artifact the unifying primitive. Resist the temptation to add surfaces that don't produce or reference receipts.
2. **Status lights and chips beat progress bars and toasts.** Drained's tri-light row, Aegis's `Sealed · TEE` chip, AlphaTrace's "Verify Storage" button — the consistent pattern is that 0G's four primitives (Storage / Compute / TEE / Chain) need a *visual language*. **Adopt one chip-set and use it everywhere — CLI ANSI, Studio React, OG-image, Twitter card.**
3. **Permissions and policies must be visible on the artifact, not in a settings page.** SealedMind's capabilities, Aegis's policy name, BuildProof's score caps, AgentHub's permission pills — projects that surfaced their constraints upfront felt trustworthy; projects that hid them in modals felt evasive.
4. **Inspectable filesystem state beats opaque database state.** Octogent's `.octogent/`, Hermes's `~/.hermes/`, OpenClaw's local-first sync — all use plain folders. Power users adopt fastest when they can `ls` and `git diff` agent state.
5. **One-command everything.** `pnpm openclaw onboard`, `openclaw skills install musashi`, `npx claude-mem install`. The viral primitive is a single copy-paste line. Build for that from day one — make `forge install`, `forge skill install`, `forge passport mint` all one-liners.

---

## Things we will NOT copy (anti-patterns spotted)

- **Aishi's encyclopedic feature list as UX.** Aishi has memory weather, constellations, time capsules, milestone unlocks, intelligence growth, yearly reflections — and the UX challenge per its own analysis is "explaining the memory system without overwhelming users." Ivaronix should pick three persistent concepts (Receipt, Passport, Skill) and refuse to add a fourth surface concept until those three are universally understood.
- **Kuberna Labs' surface-area sprawl** (14 modules: escrow, intent, courses, workshops, disputes, certificates, treasury, fee manager, reputation, multisig, compliance, payments, agents, attestation). Broad scope masquerading as ambition — every module dilutes 0G-specific depth. Ivaronix's wedge is the receipt; everything else is a consequence.
- **ShadowFlow's "planned 0G archival" pattern** — building UI for features that aren't wired yet. Either ship a feature with a real receipt or hide it. **No "0G Storage integration coming soon" chips.**
- **AlphaDawg's environment-variable maze.** 25+ env vars across 0G/Hedera/Arc/Circle/x402/Telegram/Supabase/Prisma. Power-user config is fine, but the default install must be `forge` → wallet popup → first receipt. Anything more than that is friction the corpus has already proven users don't tolerate.

---

## How this doc relates to the others

| Doc | Holds | Reads from this doc when |
|---|---|---|
| `PRD.md` | Wedge, surfaces, layers, MVP scope | Describing Studio's user-facing flows (§3.1) |
| `HLD.md` | Architecture, monorepo, contracts | Specifying Studio component layout (§4) |
| `BUILD.md` | 30-day plan, deploy steps | Sequencing Studio build days (§1 Day 13-18) |
| `RECEIPTS_SPEC.md` | Receipt JSON canonical schema | Verifying receipt-verify-UX matches spec (§12) |
| `REFERENCE_PATTERNS.md` | Contract patterns | Linking UI patterns to underlying primitives |
| `PITCH.md` | Grant pitch | Drawing visceral demo descriptions |

**This doc is the canonical "what should it look and feel like?" source.** When other docs describe a screen or CLI surface, they should LINK here, not duplicate.

---

**End of COMPONENTS.md.**
