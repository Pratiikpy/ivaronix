# Ivaronix — Working Repository

> **Project:** Ivaronix — The 0G Agent Operating System.
> **Status:** **Phase A complete (testnet) · 2026-05-08** — all 22 Phase-A days closed with real on-chain artifacts. Phase B mainnet promotion (Day 23-30) next.
> **Submission target:** OG Labs grant.

## Run this in 30 seconds

```bash
git clone <this-repo> && cd oglabs
pnpm install
cp .env.example .env   # add your ZG_API_SECRET + EVM_PRIVATE_KEY
pnpm --filter @ivaronix/cli exec tsx apps/cli/src/bin/ivaronix.ts demo
```

`ivaronix demo` anchors one real receipt on 0G Galileo Testnet (~0.0001 OG, ~3 seconds) and prints three independent proof URLs:

- `/r/<id>` — Studio public proof page (start `pnpm --filter @ivaronix/studio dev` for the UI)
- `chainscan-galileo.0g.ai/tx/<hash>` — third-party explorer
- `ivaronix receipt verify <id> --tee-independent` — broker.processResponse re-check

Want a richer view? `demo --tier standard` runs 3-role consensus (analyst/critic/judge); `--tier high-stakes` runs 5 roles. Real disagreement surfaces; the judge synthesis is the receipt body. Drop a sensitive document into `ivaronix doc ask <file> "..." --burn --quick` for AES-256-GCM encrypted evidence + session-key destruction (TIER 1 burn-mode). The bare `ivaronix` invocation drops you into the Ink TUI chat with streaming, tool panels, slash palette, and 19 slash commands; `ivaronix chat-classic` is the readline fallback for SSH / piped workflows.

## Install one of the Ivaronix skills via OpenClaw

Every first-party skill ships with the OpenClaw `metadata.openclaw.install` block already populated. An OpenClaw user can install any of them in one command:

```bash
openclaw skills install Pratiikpy/ivaronix#seed-skills/private-doc-review
openclaw skills install Pratiikpy/ivaronix#seed-skills/0g-integration-auditor
openclaw skills install Pratiikpy/ivaronix#seed-skills/github-audit
openclaw skills install Pratiikpy/ivaronix#seed-skills/plan-step
openclaw skills install Pratiikpy/ivaronix#seed-skills/code-edit
```

The skill's `SKILL.md` declares the exact runtime requirement — `kind: node`, `package: @ivaronix/cli`, `bins: [ivaronix]` — and the env vars it needs (`EVM_PRIVATE_KEY`, `EVM_WALLET_ADDRESS`, `ZG_API_SECRET`). After install, every run produces an Action Receipt anchored on `ReceiptRegistry` (chainId 16602) with creator/treasury fee split per `og.creator.fee_split` (90/10 for `private-doc-review`).

To verify a receipt independently after a skill run:

```bash
ivaronix receipt verify <id> --tee-independent
```

This calls `broker.processResponse` against 0G Compute. If TEE verification passes, the receipt status flips to `→ FULLY VERIFIED ✓` (proven on receipts #994 and #1004). External-provider runs (NVIDIA NIM via `OG_PROVIDER=nvidia`) anchor as TIER 2 with `verificationMethod: external-signed` and render amber on `/r/<id>` per the brand contract — never green-washed.

---

## Phase A · Live testnet (Galileo, chainId 16602)

All five contracts deployed and feeding live data into Studio + CLI + MCP:

| Contract             | Address                                                                                                                                            |
|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `ReceiptRegistry`    | [`0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c`](https://chainscan-galileo.0g.ai/address/0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c)                  |
| `Erc7857Verifier`    | [`0xEAd66Cb90B681720f3aab52d86c289E21106d938`](https://chainscan-galileo.0g.ai/address/0xEAd66Cb90B681720f3aab52d86c289E21106d938)                  |
| `AgentPassportINFT`  | [`0x08d25653638c3ed40C3b82840fA20CAe9c94563E`](https://chainscan-galileo.0g.ai/address/0x08d25653638c3ed40C3b82840fA20CAe9c94563E)                  |
| `CapabilityRegistry` | [`0x3783f3c4834fCCBD553860e15c64C7E052646a8D`](https://chainscan-galileo.0g.ai/address/0x3783f3c4834fCCBD553860e15c64C7E052646a8D)                  |
| `MemoryAccessLog`    | [`0xEe1aDFe76785377C4430B1325d86E58A6eC92119`](https://chainscan-galileo.0g.ai/address/0xEe1aDFe76785377C4430B1325d86E58A6eC92119)                  |
| `SkillRegistry`      | [`0xf8894Ce4FFc7C594976d5Eaca38d8FE6DB4820a1`](https://chainscan-galileo.0g.ai/address/0xf8894Ce4FFc7C594976d5Eaca38d8FE6DB4820a1)                  |

Live data path:

- **Receipts anchored:** read live via `ReceiptRegistry.nextId()` — Studio `/global` + CLI `ivaronix receipt list`.
- **Passport profile:** `AgentPassportINFT.passportOf(wallet)` — `did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1` (tokenId 1, trustScore + receiptCount climbing per anchor).
- **Skill catalog:** 5 first-party skills + 75 awesome-claude-skills ports = **80 skills** discoverable via `ivaronix skill list` and Studio `/skills`.
- **First-party skills published on-chain via `SkillRegistry`:** `0g-integration-auditor`, `github-audit`, `private-doc-review` (v0.1.0 + v0.2.0), `plan-step`, `code-edit`. Each `verify` returns `MATCH` against the local manifestHash.

Run end-to-end on the **public testnet** today:

```bash
# CLI
ivaronix doc ask contract.pdf "find risky clauses" \
  --skill private-doc-review --consensus --burn

# Studio
pnpm --filter @ivaronix/studio dev
# → http://localhost:3300/  drop a file, pick a skill, click Run

# MCP server (Claude Desktop / Cursor / Codex)
pnpm --filter @ivaronix/mcp-server dev
# stdio: tools/list returns ivaronix_ask, verify_receipt, passport_show, …
```

---

## What is Ivaronix?

> **Catch the risks. Keep the receipts.**

The **0G Agent Operating System** — five surfaces (Studio, Forge CLI, API+MCP, Skill Registry, Trust Layer) sharing one spine: the **AI Action Receipt** anchored on 0G Chain (mainnet 16661), with encrypted artifacts on 0G Storage, independent TEE verification via 0G Compute, and an ERC-7857 Agent Passport that follows your wallet.

Plus `@ivaronix/og-toolkit` — clean DX wrappers around `@0gfoundation/0g-storage-ts-sdk` + `@0gfoundation/0g-compute-ts-sdk` + `@0glabs/0g-serving-broker`. New 0G builders will adopt it because it's nicer than raw SDKs *and* it defaults to producing receipts. Quiet long-term moat.

```bash
ivaronix doc ask contract.pdf "find risky clauses" \
  --burn --consensus --receipt
```

Or in Studio: drop file → click "Run" → see verifiable audit report → click "Share" → copy public Proof URL.

→ encrypted upload to 0G Storage
→ 5-role consensus (analyst / risk-reviewer / evidence-checker / red-team-critic / judge)
→ independent TEE verification per role
→ Burn Mode (session key destroyed)
→ Receipt JSON → 0G Storage → 0G Chain anchor
→ ERC-7857 Agent Passport trustScore updated
→ shareable public Proof Explorer URL

**Ships with 50+ skills out of the box** (ports of awesome-claude-skills + 3 first-party 0G-native skills).

---

## Doc Map

This folder is the **single source of truth** for Ivaronix planning. Read in order:

| # | Doc | Purpose | When to read |
|---|---|---|---|
| 1 | **[PRD.md](PRD.md)** | Wedge, 5 surfaces, 7 layers, MVP scope, monetization, success criteria | Start here |
| 2 | **[HLD.md](HLD.md)** | Architecture: monorepo, contracts, CLI, Studio, daemon, hybrid memory, lifecycle hooks | Before coding |
| 3 | **[BUILD.md](docs/build/BUILD.md)** | 30-day testnet-then-mainnet plan, network profiles, SDK quirks, deploy steps | During implementation |
| 4 | **[UI_UX_GUIDE.md](UI_UX_GUIDE.md)** | Visual source of truth: design tokens, typography, logo anatomy, layout rules, motion, a11y, Playwright workflow. Pairs with `brand/Ivaronix.html` mockup | Before any Studio / Hub / Proof Explorer code |
| 5 | **[COMPONENTS.md](COMPONENTS.md)** | Per-component UX decisions (Studio screens, CLI surfaces, visual language) sourced from cross-folder analysis | Before designing or building any UI surface |
| 6 | **[RECEIPTS_SPEC.md](RECEIPTS_SPEC.md)** | Canonical receipt JSON schema (RFC-style) with 9 types + 3-state verification | Before touching `packages/receipts` |
| 7 | **[REFERENCE_PATTERNS.md](docs/reference/REFERENCE_PATTERNS.md)** | Extracted contract + pipeline patterns from 0G showcase + entry winners | When designing contracts or pipelines |
| 8 | **[0G_RESOURCES.md](docs/reference/0G_RESOURCES.md)** | Full 0G Builder Hub catalog: URLs, repos, SDK names, CLI flow, addresses, conflicts | When integrating any 0G primitive |
| 9 | **[PITCH.md](docs/pitch/PITCH.md)** | Grant pitch + per-audience positioning + bounty mapping + 2-gate submission checklist | Before grant submission |

### Operational notes (kept alongside)

| Doc | Purpose |
|---|---|
| **[brand/Ivaronix.html](brand/Ivaronix.html)** | Bundled visual mockup — the design source of truth. Open in browser to see the rendered reference. Use Playwright to capture screenshots at 1440×900 / 1280×800 / 390×844. |
| **[brand/](brand/)** | Logo SVG assets: `ivaronix-mark.svg` (full), `ivaronix-icon.svg` (brackets-with-i), `ivaronix-dot.svg` (favicon), `ivaronix-wordmark.svg` (text). |
| **[0G_TESTNET_NOTES.md](docs/reference/0G_TESTNET_NOTES.md)** | Live testnet state: Wallet A `0xaa95...`, current Router pricing, confirmed inference endpoint. |
| **[entries.md](docs/reference/entries.md)** | Competitor scorecard for the 16 grant-track entries. Companion to `REFERENCE_PATTERNS.md`. |
| **[.env.example](.env.example)** | Template for credentials (real `.env` is gitignored). |

Single source of truth ordering (when docs disagree):
```
brand/Ivaronix.html (visual) > UI_UX_GUIDE > RECEIPTS_SPEC > docs/reference/REFERENCE_PATTERNS > COMPONENTS > docs/build/BUILD > HLD > PRD > docs/pitch/PITCH
```

For visual decisions specifically: `Ivaronix.html` (open in browser, screenshot via Playwright) wins, then `UI_UX_GUIDE.md` (the codified rules), then `COMPONENTS.md` (per-component UX).

When in doubt, **link, don't duplicate.**

**Component-level rule:** if a doc describes how a Studio screen, CLI surface, or visual chip should look, it MUST link to `COMPONENTS.md` rather than restate.

---

## Companion folders

| Folder | Holds |
|---|---|
| `oglabs resources/` | Official 0G docs, SDKs, agent-skills patterns, awesome-0g curated list |
| `og-projects-showcase/` | 8 projects featured by OG Labs team — winning patterns |
| `entries/` | 16 grant-track entries we are competing against |
| `CLI Open Source Project/` | 5 viral CLIs we synthesize from (OpenCode, HermesAgent, Octogent, claude-mem, awesome-claude-skills) |
| `_archive/` | Pre-v2 planning docs (kept for history; do not edit) |

---

## TL;DR Strategy

**Wedge:** AI Action Receipts on 0G — but framed as the **0G Agent Operating System** because the receipt is the spine, not the whole product.

**Five surfaces:** Studio (primary, web app) · Forge CLI · API+MCP · Skill Registry · Trust Layer (Phase 3).

**Strategy:** Testnet-complete first (FULL feature surface, no compromise), then mainnet promotion as a single deliberate event. **30-day plan, two phases:**
- **Phase A (Day 1-22):** build + test the FULL product on testnet 16602. Studio + 50-skill marketplace + 6 contracts + ≥100 testnet receipts.
- **Phase B (Day 23-30):** re-deploy contracts to mainnet 16661, anchor ≥100 mainnet receipts, ChainGPT audit applied for, submit grant.

**Differentiation (no other 0G project has):**
- Real Studio with drop-zone + 50+ skills + public Proof URLs
- Tiered Adjudicated Consensus (Quick / Standard 3-role / High-Stakes 5-role)
- Hybrid memory (vector + temporal graph + FTS + KV)
- 9 typed receipt types with 3-state verification UI
- ERC-7857 Agent Passport at MVP (most defer to Phase 4)
- Independent TEE verification via `broker.inference.processResponse()`
- 50+ skill marketplace seeded from awesome-claude-skills, **with a 0G-native `og:` manifest extension that is the real long-term moat (not the 50-count)**
- `@ivaronix/og-toolkit` clean SDK wrappers (every 0G app eventually adopts these)

**Avoid:** scope creep into team workspaces, agent economy, marketplace economics-as-business-model, voice/image/fine-tuning. **All Phase 3+.**

**Beat the bar:** Provus's playbook with full Nexus depth — mainnet contracts + verified addresses + live metrics + audit + ENGINEERING_DEBUG_LOG + Studio + 50 skills.

**Honest monetization:** Pro subscription (Phase 2) and Enterprise/Trust Layer (Phase 3) are the realistic revenue lines. Marketplace is a discovery moat, not a revenue line.

---

## Day-1 quickstart (when implementation begins)

```bash
# 1. Scaffold monorepo (pnpm + Turborepo)
pnpm create turbo@latest ivaronix
cd ivaronix && pnpm install

# 2. Add 0G SDKs + ethers v6 + foundry
pnpm add ethers@^6 @0gfoundation/0g-storage-ts-sdk @0gfoundation/0g-compute-ts-sdk
pnpm add @0glabs/0g-serving-broker
forge init contracts/

# 3. Wire up testnet env (docs/build/BUILD.md §2)
cp .env.example .env  # OG_CHAIN_ID=16602

# 4. Doctor
ivaronix doctor   # all green = ready for Day 2
```

Then walk through `docs/build/BUILD.md §1` Day 1 → Day 22 (testnet) → Day 23-30 (mainnet promotion).

---

## Locked Engineering Defaults (docs/build/BUILD.md §11)

- Chain client (daemon): **ethers v6**
- Wallet (browser): **viem + wagmi + walletconnect**
- Daemon HTTP: **Hono**
- Memory store: **better-sqlite3 + FTS5**
- Memory vector: **hnswlib-node + transformers.js (`all-MiniLM-L6-v2`)**
- Default model: **`qwen/qwen-2.5-7b-instruct`** with `--model` override
- Daemon lifecycle: **auto-start with transparent logs**
- Package manager: **pnpm + Turborepo**
- Solidity: **Foundry, 0.8.24, OZ v5, evmVersion `cancun`**
- Studio: **Next.js 15 + React 19 + Tailwind v4 + shadcn/ui** on Vercel

---

## Contact

(Personal project — single maintainer.)

Submit via the OG Labs grant form when `docs/pitch/PITCH.md §8` two-gate checklist is fully green.
