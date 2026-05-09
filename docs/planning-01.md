# Ivaronix · Planning 01 — Parked Decisions

> Status: **PARKED**, not built.
> All items below are decisions we agreed on the strategy for. Full implementation plan, scope, and sequencing TBD next session. Captured here so we don't lose them.
>
> Each item has been ranked into one of three tiers based on win-probability lift vs the 8 OG showcase projects:
> - **Tier 1**: locked, ship first (hours, not days). Non-negotiable for the grant.
> - **Tier 2**: high-impact, week-scale. What gets us from finalist to top 3.
> - **Tier 3**: interesting, sequence later. What gets us to showcase placement post-grant.

---

## Tier 1 · Locked, ship first

### 1A. Privileged-document hero copy on home page → ✅ DONE

- **Headline shipped:** *"AI review for the documents you* **can't paste** *into ChatGPT."* (italic accent on `can't paste` via Instrument Serif). Picked candidate #1 because it names the substitution-blocker (ChatGPT) most concretely; per §12.5 genie rule, intent over letter — user said "go finish" without naming a headline, so I shipped the strongest concrete option. Trivial to swap to #2/#3/#4/#5 if requested (one-line edit in `apps/studio/src/app/page.tsx:113-115`).
- **Sub-headline shipped:** "Drop a contract, NDA, or term sheet covered by privilege or counterparty confidentiality. Burn Mode encrypts it; the session key is destroyed after the run. The audit ships an Action Receipt anchored on 0G Chain with the key fingerprint inside — **anyone can independently re-verify it from any machine**, even after the document is gone."
- **CTAs shipped:** primary "Run a private audit →" → `/onboard`. Secondary "See a sample receipt" → `/r/1004` (the FULLY VERIFIED TIER 1 receipt).
- **Page metadata:** `<title>` and `openGraph.title` both updated to match.
- **§11 e2e proof captured** (`screenshots/hero/`):
  - `01-studio-home-desktop.png` — disconnected state, 1440×900
  - `02-studio-home-connected.png` — connected via real MM popup, header chip `0xaa95…77Ce`
  - `03-studio-sample-receipt.png` — `/r/1004` lands cleanly from secondary CTA
  - `04-studio-onboard-from-cta.png` — `/onboard` lands cleanly from primary CTA
  - `05-studio-home-mobile.png` — 375×812 mobile, italic accent preserved
  - `06-brand-html-desktop.png` + `07-brand-html-mobile.png` — side-by-side reference
  - Plus `.webm` video recording of the full session.
- **Computed-style audit (§10 visual contract):** h1 fontSize 80px, fontFamily Outfit, body bg `rgb(250,250,247)` = `#FAFAF7` paper, body ink `rgb(10,10,10)` = `#0A0A0A`, header height 64px, header backdrop `saturate(1.5) blur(20px)`. All tokens match brand contract.
- **Verification script:** `scripts/qa/metamask-e2e/verify-hero.ts` — re-runnable end-to-end with real MM extension, both viewports, side-by-side capture.

### 1B. Confidential Data Room → ✅ DONE (full F build, multi-party)

- **Receipt schema extended:** new types `doc_room_create` (slot 10) and `doc_room_read` (slot 11) added to `RECEIPT_TYPES` (`packages/core/src/types.ts`) and `ReceiptTypeSchema` (`packages/receipts/src/schema.ts`). On-chain anchor uses semantically-equivalent existing slots (5 = skill_exec for create, 4 = memory_access for read) until `ReceiptRegistry` is redeployed with the new slots — the off-chain receipt body still records the canonical `doc_room_create` / `doc_room_read` type faithfully.
- **CLI shipped (`apps/cli/src/commands/room.ts`):**
  - `ivaronix room create --doc <file> --parties <addr,addr> [--ttl 7d] [--reads 50]` — Burn-Mode encrypts the doc (AES-256-GCM, key fingerprint captured + key zeroed), uploads ciphertext to 0G Storage (real upload, real txHash), issues `CapabilityRegistry.issueGrant` per non-creator party (real on-chain tx), persists manifest at `.ivaronix/rooms/<roomId>.json`, anchors a `doc_room_create` receipt on `ReceiptRegistry`. Self-grants skipped per contract rule (`CapabilityRegistry: self-grant disallowed`); creator gets implicit-owner sentinel grant.
  - `ivaronix room list` — lists local manifests with createdAt + party count + storage root.
  - `ivaronix room read <roomId>` — verifies caller's grant via `cap.isValid` (or accepts implicit-owner sentinel for creator), anchors a `doc_room_read` receipt on chain. Each read = a verifiable receipt.
- **Studio surface (`apps/studio/src/app/data-room/[id]/page.tsx`):** renders manifest card (roomId, manifest hash, blob bytes, blob root, ttl, reads cap, storage tx → clickable explorer, creator → clickable `/agent`), Burn Mode evidence-proof card (encryption type, key fingerprint, destroyed-at, cleanup), parties card with all party addresses + their grant ids + explorer links, and a verify-from-any-machine code block with the three-command CLI flow. `/agent/[handle]` already linked.
- **End-to-end live proof (real chain, real TEE-attested storage, real on-chain anchors):**
  - Room id: `01KR66C1GJVR57MHQPJCW1HQQY`
  - Storage upload tx: `0x2fc63b01eb78a79b0c657bdff930bd2c59cc284e57e1817eee019e2f69819051` · root `0xdffefba0e36f14ea4b59a0f990b07fbb22e1764d694763ea83b997f809fe2a68`
  - Capability grant to `0x021C…4325`: grantId `0x91dbba5d2644f2f3…`, tx `0xa7bd0e481200868a…`
  - `doc_room_create` receipt: `rcpt_01KR66CS1X0DN4DXMVFMQ0A0YG`, anchor tx `0x8be4b64f8f9eaa94…`, block 32380759
  - `doc_room_read` receipt: `rcpt_01KR66EYVHR7Q4TFC3NC1FZB4T`, anchor tx `0x80ef8a91de3441f76ce66c17102964a100fdd20a0c02b0bd0b6c0855c3bd906e`, block 32380907
  - Manifest hash `sha256:293ebd42391d48157de205d113a8a1b74d6823e1deffb354103d37c872cb149c`
- **§11 e2e visual proof captured** (`screenshots/data-room/`):
  - `01-data-room-desktop-top.png` — header chip connected, hero copy, manifest + burn-evidence cards side-by-side
  - `02-data-room-desktop-mid.png` — parties section starting
  - `03-data-room-desktop-bottom.png` — verify-from-any-machine CLI block + footer
  - `04-data-room-desktop-footer.png` — multi-column footer at very bottom
  - `05-data-room-mobile-top.png` + `06-data-room-mobile-mid.png` — mobile 375×812
  - `07-data-room-not-found.png` — invalid room id falls back to honest "Room not found" Section
  - `.webm` video recording of the full session
- **Verification script:** `scripts/qa/metamask-e2e/verify-room.ts` — re-runnable end-to-end with real MM extension, both viewports, +ve and -ve cases.

### 1C. 3-page narrative pitch document → ✅ DONE

- **Shipped at** `docs/PITCH.md`. Three pages with hard-stops:
  - **Page 1 — What · who · why now.** Lede paragraph names the persona (deal lawyer / founder / DD analyst). Substitution problem in three bullets (ChatGPT trains, VDRs control logs, local LLMs lose the audit trail). Numbers table with **1,165 receipts**, **6 contracts**, **5 first-party skills**, **155-skill catalog**, **61/61 Foundry tests**, **13/13 mainnet readiness**, **0 silent failures** — every number with a clickable chainscan or doc link. Track positioning: Track 1 + Track 3 + Track 5.
  - **Page 2 — The receipt is the spine.** Schema in 12 lines. Canonical hash in one paragraph. Tampering example from QA edge sweep (verbatim CLI output). Three-value `verificationMethod` switch. Independent re-verify CLI output for receipt #1004. Burn Mode evidence-proof example with real keyFingerprint + destroyedAt timestamp.
  - **Page 3 — Growth roadmap.** Year 1 (testnet → mainnet → 10 firms, undercut Datasite by 30%). Year 2 (live skill marketplace, embeddable verifier widget, cross-chain receipts). Year 3 (SOC2 + verticalize: clinical-trial, trade-secret, journalist-source data rooms). Explicit "what we will NOT build" section to surface discipline.
- **Voice check (§9):** zero banned words. One-clause sentences predominate. Real numbers replace adjectives ("1,165 receipts" not "extensively tested"; "$300/hour problem" not "expensive"). No "in today's fast-paced world" openers.
- **Closes Criterion 2.5 directly.** AIsphere ships 19 pages; this is 3 pages that point at `RECEIPT_SCHEMA.md` and `MAINNET_READINESS.md` for depth. A non-technical judge can read it in five minutes and grade. A technical judge follows the chainscan links and verifies the claims live.
- **Try-it section** at the end: two CLI commands (`ivaronix demo` then `receipt verify --tee-independent`), the entire pitch reduced to one minute of terminal time.
- **Note on §11 e2e for documentation:** a doc passes the test by being readable, accurate, and link-verified. Every chainscan URL in the pitch was generated from the live `deployments/testnet.json`; every CLI output block was captured from a real run; every claimed number is in `MAINNET_READINESS.md` or QA logs. The e2e proof for documentation is link integrity + claim integrity, not Playwright.

---

## Tier 2 · High-impact, week-scale

### 2A. TEE-Bound Delegated AI Agent → ✅ DONE (Phase A — operator-side custody, on-chain identity, on-chain capability revocation)

- **CLI shipped (`apps/cli/src/commands/delegate.ts`):**
  - `ivaronix delegate create --name "<name>" [--description] [--skills ids,...] [--funding 0.04]` — generates fresh keypair (mode 0600 in `.ivaronix/delegates/<id>/key.json`), funds it from the user's wallet, mints AgentPassportINFT in the delegate's name, persists manifest.
  - `ivaronix delegate grant <id> --skill <skillId> [--ttl 30d] [--reads 200]` — issues a CapabilityRegistry grant from user → delegate (real on-chain tx).
  - `ivaronix delegate run <id> <doc> --question "..." [--tier quick]` — env-overrides EVM_PRIVATE_KEY in-process and dispatches to `docCommand.parseAsync`. Receipt's `agent.ownerWallet` = delegate, NOT user. User's signing key never invoked.
  - `ivaronix delegate revoke <id> [--skill <id>]` — revokes the active grant on chain. Post-revoke runs fail at `cap.isValid` check.
  - `ivaronix delegate list` — local manifest summary.
- **Studio surface (`apps/studio/src/app/delegate/[id]/page.tsx`):** identity card (delegate id, name, wallet, passport tokenId, owner-user-wallet), custody disclosure card (Phase A vs Phase B explicit), active grants section with explorer links, revoked grants section (visually muted), verify-from-CLI block.
- **End-to-end live proof:**
  - Delegate id: `01KR67PT76V9AQTHN413PYWB1J`
  - Delegate wallet: `0x4B2147665818b823bdbDd3f92Aa006A08e4224e0` (passport tokenId 4)
  - Funding tx: `0xfd2dbe59729b707fe43b149fb31f93ba0209d70d69d41060575f5815e677e25f` block 32383562
  - Mint tx: `0xda58377becda436e4afa5cbc2a057c27ca4ee9151fb217f2633211f48ad4b4ec` block 32383586
  - Grant id: `0x803d2d634b00466b11f02fda81f6519dd8a3c3312f1fd6699258548cf8338e3d`, tx `0xc4dc2364fdc7c43b742dcb2a564184b39b7a9a0807e1c249cc122d3932c5f9ef` block 32383649
  - Receipt: `rcpt_01KR67SDCD9TA08C46MMYSNG7A` on-chain id **#1204**, anchor tx `0xedcc02624dab6e0de32ac26ff196cf3371641f954a18411672ae8d6b3803f6e6` block 32383734. Storage evidence root `0x236bf7f723a8b94a655bd16349cf46822ef18e80c1cd3f4aab820d132d1973d7`. Delegate's passport receiveCount=1, trustScore=1.
  - Revoke tx: `0x35ad2c0f2f8f420991628da06ec5ac2c92378b300f3c55a4d227dec5359a52bf` block 32383871
  - Negative test: post-revoke run failed cleanly with "no active capability grant for skill private-doc-review".
- **Phase B path (documented honestly, NOT shipped):** delegate's signing key generated *inside* a 0G Compute TEE on first mint, never extracted. On-chain identity model is unchanged. The Studio custody card explicitly states "Phase A · operator-side custody" with a yellow chip and a Phase-B target description.

See `docs/PHASE_B_DISCLOSURES.md` for the full half-baked audit (14 items, 7 closed in this commit, 7 documented honestly).

### 2B. Memory consolidation lifecycle on AgentPassport → ✅ DONE (the consolidation IS a receipt — no sidecar contract needed)

Strongest practical implementation per CLAUDE.md §1: instead of redeploying `AgentPassportINFT` with new fields or shipping a sidecar contract, we model the rollup as a new receipt type. The consolidation IS a receipt, signed by the agent's wallet, with the source ids it consumed in `request.priorReceiptIds`. Lineage is verifiable from the receipt body alone — no contract changes, full reuse of the existing chain anchor + passport infrastructure.

- **Schema:** new `RECEIPT_TYPES.memory_consolidation = 12` in `packages/core/src/types.ts`; matching `'memory_consolidation'` in `ReceiptTypeSchema` (`packages/receipts/src/schema.ts`); new optional `request.priorReceiptIds: string[]` to record the lineage. Studio mirror in `apps/studio/src/lib/receipt-labels.ts`. On-chain anchor uses semantically-equivalent slot 4 (memory_access) until ReceiptRegistry slot expansion — same Phase A constraint we used for doc_room_*.
- **CLI shipped (`apps/cli/src/commands/passport-consolidate.ts`, attached to `passport` parent):**
  - `ivaronix passport consolidate --day | --month | --year [--no-compute]`
  - Reads recent on-chain receipts via `ReceiptRegistryClient.findByAgent(agent, 100, lookbackBlocks)`, filters to the window's cutoff timestamp.
  - When `ZG_API_SECRET` is present (and `--no-compute` is not set), runs `runConsensus({ tier: 'quick' })` on 0G Compute for a real TEE-attested prose summary — `verificationMethod: 'router_flag'`, `--tee-independent` re-verifies via `broker.processResponse`.
  - Otherwise falls back to a deterministic local synthesis (counts + types + time range). The receipt body records `verificationMethod: 'external-signed'` honestly — no fake TEE claim.
  - Builds + signs + anchors a consolidation receipt; updates the agent's passport (the consolidation itself bumps `receiptCount` + `trustScore`).
- **Studio surface (`apps/studio/src/app/agent/[handle]/page.tsx`):** new "memory consolidations" card scans local `.ivaronix/receipts/anchored/*.json` for `type === 'memory_consolidation'` files owned by the displayed wallet. Renders newest-first (max 5) with: window label (Daily / Monthly / Yearly rollup), source receipt count, prose summary headline, ISO timestamp, honest tier badge (`TEE · TIER 1` green for `router_flag` / `LOCAL · TIER 2` muted for `external-signed`), and a `receipt #<id> ↗` link to the on-chain consolidation. Empty state honestly tells the operator the CLI command to run.
- **End-to-end live proof:**
  - Source window: 100 receipts in last day (operator wallet `0xaa95…77Ce`)
  - 0G Compute returned a real 415-char summary (1791 input + 112 output tokens) referencing actual receipt ids like #1223, #1224 — proof the LLM read the live log, not a synthesized stub.
  - Consolidation receipt id: `rcpt_01KR6BTR5YKM3VMVT3HHY6STWE` → on-chain id **#1252**
  - Anchor tx: `0x48520ba8bfa181505765d5346aebce3ab18a9b518dd50c69707c4347fcac980f` block 32392344
  - Passport updated: receiptCount = 1232, trustScore = 1232 (the consolidation itself counts).
- **§11 e2e visual proof captured** (`screenshots/2b-consolidation/`):
  - Desktop /agent/<operator>: top, recent activity (with new human receipt-type labels), consolidations card
  - Desktop /r/1252: top, mid, bottom of the consolidation receipt
  - Mobile: agent + consolidations + receipt
  - Brand HTML side-by-side
- **Verification script:** `scripts/qa/metamask-e2e/verify-2b.ts` — re-runnable, no MetaMask required.

### 2C. Cron-scheduled skill execution
- **Why:** 0GClaw (showcase) wins on "active INFT" — cron-scheduled autonomous execution + x402 micropayments. We currently fire on user trigger only.
- **What to add:**
  - `ivaronix skill schedule <id> --cron "0 9 * * MON" --input <file-or-prompt>` — registers a schedule on chain (or in a daemon).
  - On every fire: run the skill, anchor a receipt, settle the fee split automatically to the creator's passport.
  - Studio surface: a "Scheduled Runs" tab on `/dashboard` showing next-fire timestamps and recent receipts per schedule.
- **Strengthens Track 3:** creators earn passive income from scheduled skill execution, not just per-run.

### 2D. Studio `/docs` page — 0G modules + how they support the product
- **Why:** judges should see, at a glance, the breadth and depth of our 0G integration without grepping the codebase. The README has this list (per CLAUDE.md §13) but a judge who lands on the Studio first should find the same answer at `/docs` in two clicks.
- **What to add:**
  - One Studio route at `/docs` that mirrors README §3 + §4: each 0G module gets a card with (a) module name, (b) contract address or endpoint where applicable (clickable), (c) one sentence on the user-visible value, (d) a "see it live" link to a Studio surface that exercises it (e.g. 0G Storage → `/data-room/<id>`, 0G Compute → `/r/<id>` with TIER 1 chip, Agent ID → `/agent/<addr>`).
  - Editorial voice — no AI slop, no "delve / unlock / leverage / robust." One claim per sentence. Real addresses, real receipts.
  - Honest tier marking per CLAUDE.md §6: TIER 1 (TEE-attested) modules in green, TIER 2 (external-signed) in amber. Modules we do not integrate at all (e.g. 0G DA today) get an explicit "not yet integrated — Phase B" chip rather than being omitted.
  - Linked from the header nav (replacing or supplementing `Why`).
- **Closes:** Criterion 2.5 (Documentation) and partially 2.1 (Integration depth visibility) for any judge who does not read the README. Pairs 1:1 with the README so the on-page version cannot drift from the on-disk one.

---

## Tier 3 · Interesting, sequence later

### 3A. Memory DAG / prior-receipt context retrieval
- **Why:** AlphaDawg's memory loop (every reasoning cycle loads prior `priorCids` from 0G Storage as context) is what turns their bot from stateless into a learning agent. We anchor receipts but don't feed past receipts into the next run as context.
- **What to add:**
  - Before each skill run: load the agent's last N receipts of the same type from local indexer, summarize, prepend to system prompt as `--- PRIOR RUNS CONTEXT ---`.
  - Optional flag: `--memory-depth 5` (default 3, max 20).
  - Receipt records `request.priorReceiptIds: [...]` so the lineage is verifiable.
- **Effect:** "Adam the term-sheet hawk" gets sharper over time because he reads his own past receipts. Closes 2.1 deeper.

### 3B. Visual skill creation flow
- **Why:** Agent0G (showcase) ships a no-code workflow builder. Our skills require TypeScript module authoring — Track 3 onboarding bar is high.
- **What to add:**
  - Studio page `/skill/new` where a creator composes a skill from primitives without editing code: system prompt textarea + role config dropdown + fee split sliders + permission checkboxes + tier default selector.
  - Live preview of the resulting `SKILL.md` frontmatter as the creator edits.
  - One-click "Publish to SkillRegistry" that mints the skill on chain.
- **Lowers** the bar for non-dev creators dramatically.

### 3C. Receipt-as-firewall wiring
- **Why:** Don't Get Drained (showcase) is wired into Safe Guard execution path — receipts gate transactions, they don't just log them. We produce receipts but don't gate any external action.
- **What to add:**
  - Solidity helper: `IvaronixReceiptGuard.requireValidReceipt(receiptId, expectedAgent, expectedSkillId)` — reverts if the receipt isn't FULLY VERIFIED on `ReceiptRegistry`.
  - Any external dapp can require an Ivaronix TIER 1 receipt before executing a tx. We become a *gate*, not just a *log*.
  - Demo: a Safe wallet that requires a `private-doc-review` receipt before approving a vendor contract payment.

### 3D. Embeddable receipt-verifier widget
- **Why:** distribution moat. The `broker.processResponse` re-verify is currently CLI-only. If any external website can render "verify this Ivaronix receipt" inline, our brand surfaces beyond our own domain.
- **What to ship:**
  - `<ReceiptVerifier id="1004" />` React component, npm-published as `@ivaronix/widget`.
  - `<iframe src="https://ivaronix.studio/embed/r/1004">` fallback for non-React sites.
  - Renders the four-light row, TIER badge, and a "verify" button that calls our public `/v1/receipt/<id>` endpoint.
- **Effect:** judges see Ivaronix everywhere on the open web, not just on our own site.

---

## §3 · TEE-Bound Delegated AI Agent (full spec)

**On TEE_HEE specifically:** it is performance art. "AI that owns its own Twitter" wins press, not OG showcase. OG showcase rewards depth on 0G primitives + a real user pull — that's why Aishi ranks #1 (full-stack 0G companion architecture), not "first autonomous AI." Don't fork it.

**One idea worth stealing from that whole list:** TEE-bound identity for the agent itself. Not "user signs from their wallet, runs an AI, gets a receipt." Instead: the AI has its own AgentPassportINFT, its own signing key that never leaves 0G Compute TEE, and the user grants/revokes capabilities via CapabilityRegistry. Every action the AI takes is signed by a key only the TEE controls — re-verifiable via `broker.processResponse`.

**That maps Ivaronix to:** *"I want an AI specialist to handle my contract reviews / data room access / repo audits. The AI has its own identity. Every action it takes is signed by the TEE, not by me or the operator. I can revoke at any time."*

**This uses every primitive we have at depth:** AgentPassportINFT (AI identity), CapabilityRegistry (user grants/revokes), 0G Compute (TEE-bound key + inference), ReceiptRegistry (signed actions), Burn Mode (confidential I/O), MemoryAccessLog (audit trail). Closes Criterion 2.1 hard. No competitor in 24 entries combines all six on one product.

**Phase positioning:** Phase B headline feature. Not before the data room ships — without the data room as a user pull, this becomes a tech feature with no story.

---

## §2 · Confidential Data Room — The Marketplace We're Building (full spec)

**The pick:** F (Confidential Data Room with Burn-Mode-receipt-gated multi-party access). Beat all other marketplace shapes (skill marketplace, skill-bounty board, audited-doc one-shot, compute-attested data, receipt-as-proof) after factoring in `entries/` + `og-projects-showcase/` + `new-entries/`. Three new-entries (Agentra, Trapezohe Ghast Skills Store, zer0Gig) already crowd skill marketplace — that lane is saturated.

**Persona:** deal lawyer / corporate finance associate / due-diligence partner sharing a confidential information memo or term sheet across two-or-three counterparties under NDA. Each counterparty's wallet is a named party in the room manifest.

**Pain:** existing VDRs (Datasite, Intralinks, Dropbox) produce vendor-controlled access logs; any AI summary leaks the document to a third-party server. One breach or one discovery subpoena and the privilege defense collapses.

**Counterparty:** the buy-side firm pays per data room or per GB-month. Seller's counsel is the deployer; buyer's counsel is the reader.

**Why F beats the field:** 10x more receipt volume per session than B (one-shot review) — every read is a receipt, every AI summary is a receipt, every grant change is a receipt. Uses **Chain + Storage + Compute + DA** in one user action, closes the 0G DA gap CLAUDE.md §2.1 flagged. Pulls **Track 5 (Privacy & Sovereign Infrastructure)** alongside locked Track 1 + Track 3 — none of the 24 competitors claim Track 5 with this product depth.

**Rough dev scope (TBD):**
- One Studio page (`/data-room/[id]`)
- One CLI command (`ivaronix room create --doc <file> --parties <addr,addr>`)
- One new receipt type (`doc-room-read`)
- No new contracts (capability grants reuse existing `CapabilityRegistry`)

**Fallback if multi-party UI runs long:** ship B (one-shot Burn Mode review) — same receipts, single doc, single buyer, ships in a day.

---

## Build order (decided, not yet planned)

1. **Privileged-document hero copy** on home page — pick a headline from the 5 sent, wire it, screenshot side-by-side against `brand/Ivaronix.html`. Estimated 15 min.
2. **Confidential Data Room** (item 2 above) — full implementation pass.
3. **TEE-Bound Delegated AI Agent** (item 1 above) — Phase B headline, after #2 ships.

---

## Open questions for next session

- Final hero headline (5 candidates, all editorial-voice compatible).
- Data room: B-fallback now, or commit to F directly?
- TEE-bound delegated agent: do we redeploy `AgentPassportINFT` with TEE-attestation on mint, or layer an `AgentTeeBinding` contract on top?
- Named reviewer personas (Adam the term-sheet hawk, Rhea the privacy-paranoid counsel) — wire as part of #2 default selector, or separate Phase B item?
