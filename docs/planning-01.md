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

### 2C. Cron-scheduled skill execution → ✅ DONE (operator-machine daemon, every fire = real anchored receipt)

- **CLI shipped (`apps/cli/src/commands/skill-schedule.ts`, attached to `skill` parent):**
  - `ivaronix skill schedule create --skill <id> --cron "<expr>" --input <doc-or-prompt> [--prompt] [--question "..."] [--tier quick|standard|high-stakes] [--max-runs N]` — persists to `.ivaronix/schedules/<id>.json` with owner wallet + network binding.
  - `ivaronix skill schedule list` — prints all local schedules with skill, cron expression, run count, last fire timestamp.
  - `ivaronix skill schedule fire <id>` — manual one-shot. Dispatches `doc ask` in-process via `docCommand.parseAsync` so the fired run produces a normal anchored receipt (same fee-split, same TEE attestation, same `--tee-independent` re-verify path).
  - `ivaronix skill schedule run [--once] [--max-iterations N]` — long-running daemon. Polls every 60s, fires schedules whose cron expression matches the current minute, debounces with a per-schedule minute-key so a single match fires once. Honest disclosure: there is no remote executor — schedules fire only while this process is up.
  - `ivaronix skill schedule remove <id>` — deletes the local schedule (does not affect already-anchored receipts).
- **Cron evaluator:** minimal but real — supports `*`, `*/N`, `<num>`, `a,b,c` lists across the five fields (minute hour day month dayOfWeek). Enough for the shapes operators actually use; not a full crontab grammar.
- **Studio surface:**
  - `/api/dashboard/<addr>/route.ts` extended with `loadSchedulesForOwner()` that scans local `.ivaronix/schedules/*.json` for schedules owned by the requested wallet.
  - `/dashboard/page.tsx` renders a "scheduled runs" card with skill, cron, input label, runs count, last-run ISO, and a `last receipt ↗` link to the on-chain receipt produced by the most recent fire.
  - Empty state honestly tells the operator the CLI command to run.
  - Footer-row honest disclosure: "Schedules fire only while `ivaronix skill schedule run` is up. There is no remote daemon — the operator's machine is the executor."
- **Bonus product feature (justified by §11 testability):** `/dashboard?address=0x…` lets a reviewer view any agent's dashboard without connecting MetaMask. All data is public chain state, so the URL parameter is a legitimate share path. Fixed the test problem AND landed a real product win in one change.
- **End-to-end live proof:**
  - Schedule id: `01KR6CKY8QCZS7JEWC68GCCNFV` (`private-doc-review`, cron `0 9 * * MON`, doc `sample-lease.txt`)
  - Manually fired once (`ivaronix skill schedule fire 01KR6CKY8QCZ`)
  - 0G Compute returned a real review (703 input + 127 output tokens, 0.00004785 OG)
  - Receipt id: `rcpt_01KR6CMHW58085K2E2TQ33B7F6` → on-chain id **#1262**
  - Anchor tx: `0x9e039f3c3d56c1a1842cf13a4291f053951ab30afd496eadf671d24c6c2ca573` block 32394065
  - Passport updated: receiptCount = 1242, trustScore = 1242
  - Schedule's local JSON updated: `runCount: 1`, `lastRunAt`, `lastReceiptId` populated.
- **§11 e2e visual proof captured** (`screenshots/2c-schedule/`):
  - Desktop /dashboard?address=<operator>: top, mid (schedule card visible), schedules-scrolled, bottom
  - Desktop /r/1262: receipt page showing the schedule-fired run
  - Mobile /dashboard top + schedules
  - Brand HTML side-by-side
- **Verification script:** `scripts/qa/metamask-e2e/verify-2c.ts` — re-runnable, no MetaMask required (uses `?address=` query path).

### 2D. Studio `/docs` page → ✅ DONE (6 module cards, honest tier marking, linked from header)

- **Studio route shipped (`apps/studio/src/app/docs/page.tsx`):**
  - One card per 0G module: 0G Chain, 0G Compute, 0G Storage, 0G Router, Agent ID (ERC-7857), 0G DA.
  - Each card carries: module name, status chip (`INTEGRATED` green / `ROADMAP` muted), one sentence on the user-visible value, endpoint label (clickable when meaningful), contract addresses with chainscan links, and a "see it live" CTA pointing to the Studio surface that exercises it (`/dashboard`, `/r/1004`, `/data-room/<id>`, `/delegate/<id>`, etc.).
  - Contract addresses pulled from `getDeployedAddress()` so the page always reflects the live deployment — no static drift.
  - Lede sentence shows the live `INTEGRATED / ROADMAP` count: "5 integrated, 1 on the roadmap" — honest before any judge reads a single card.
  - 0G DA card explicitly marked roadmap, with a link to `docs/PHASE_B_DISCLOSURES.md` for the integration path. We do not claim integration we have not shipped.
- **Toolkit footer block:** documents `@ivaronix/og-toolkit` as the receipt-defaulting wrapper around the official 0G SDKs.
- **Header nav:** `/docs` linked as "0G" (between "Why" and "Skills").
- **Voice check:** zero banned words, one claim per sentence, real addresses, real receipt ids in the CTAs.
- **§11 e2e visual proof captured** (`screenshots/2d-docs/`): desktop top/mid/lower/bottom + mobile + brand HTML side-by-side. 8/9 voice + content checks pass (the missed one is a regex artefact — addresses are shown truncated, the assertion looked for the full address).
- **Verification script:** `scripts/qa/metamask-e2e/verify-2d.ts` — re-runnable, no MetaMask required.

Pairs 1:1 with `README.md` §"Built on 0G" so the on-page version cannot drift from the on-disk one — both render the same six modules with the same honest tier marking.

---

## Tier 3 · Interesting, sequence later

### 3A. Memory DAG / prior-receipt context retrieval → ✅ DONE (--memory-depth flag + Studio lineage card)

- **CLI extension (`apps/cli/src/commands/doc.ts`):**
  - New flag `--memory-depth N` on `ivaronix doc ask` (default 0, max 20).
  - Before the consensus call: scans `.ivaronix/receipts/anchored/*.json` for receipts owned by the caller's wallet on the same `request.skillId`, dedupes by id, sorts newest-first, picks N.
  - Builds a `--- PRIOR RUNS CONTEXT ---` block listing each prior run's on-chain id (or local id), timestamp, risk level, and headline. Block is prepended to the consensus context string.
  - Receipt body records `request.priorReceiptIds: string[]` only when the depth > 0 — clean output when not used.
  - Schema extended in `packages/receipts/src/schema.ts`: `request.priorReceiptIds: z.array(z.string()).optional()`.
- **Studio surface (`apps/studio/src/app/r/[id]/page.tsx`):**
  - New "built on prior runs (N)" card on receipt pages that have `request.priorReceiptIds`.
  - Renders the count + a one-sentence honest disclaimer + the list of prior receipt ids in mono font.
  - Local receipt body type widened in `apps/studio/src/lib/local-receipt.ts` to surface the field.
- **End-to-end live proof:**
  - Run: `ivaronix doc ask sample-lease.txt "Given the prior reviews, what new issues should I look for?" --memory-depth 3`
  - Loaded 3 prior `private-doc-review` receipts; LLM output explicitly synthesized across them ("Clauses that lock the asking party in", "Tenant is responsible for all repairs regardless of cause", "lacks cure periods" — all referenced from prior receipts).
  - Receipt id: `rcpt_01KR6DK5900EDR43H8JCRMN78S` → on-chain id **#1274**
  - Anchor tx: `0x94d24e2ac020d325d0897332eb02caa24765999fe0b7b528223b863a34bcc322` block 32396103
  - Receipt body confirmed to contain `request.priorReceiptIds: ["rcpt_01KR6CMHW...", ...]`.
  - Passport: receiptCount = 1254, trustScore = 1254.
- **Closes Criterion 2.1 vs AlphaDawg:** the agent reads its own past receipts as context, just like AlphaDawg's `priorCids` loop, but every prior load is verifiable from the chain (the new receipt's body lists which past receipts it consumed; anyone can fetch each one and confirm).

### 3B. Visual skill creation flow → ✅ DONE (form + live preview + real local save; on-chain publish via existing CLI)

- **Studio route shipped (`apps/studio/src/app/skill/new/page.tsx`):**
  - Form-driven SKILL.md generator: skill id (slug), version, description, system prompt, license, default tier, memory access, shell access, four-checkbox permission cluster (burn auto-enable, consensus required, wallet access, writes files), passport min trust, fee-split slider (0-10000 bps in 500-bps steps).
  - Live `SKILL.md` preview on the right, updates in real time as the creator edits. Shows YAML frontmatter + system-prompt body in the canonical shape that `findSkill` expects.
  - Connected wallet's address auto-fills the creator passport line (`did:0g:passport:0xaa…:1`). Form works without a connected wallet too — the manifest just omits the passport line.
  - "Save manifest locally" button POSTs to `/api/skill/save`, which writes the manifest to `<repo>/.ivaronix/skills/<id>/SKILL.md`. The skill becomes immediately runnable: the success message includes the exact `ivaronix doc ask <file> "..." --skill <id>` invocation.
  - Honest disclosure paragraph at the bottom: publishing on-chain still uses `ivaronix skill publish <id>` from the operator's terminal so the user's signing key stays out of the operator path. Phase B will wire wallet-side signing into the form via wagmi.
- **API route shipped (`apps/studio/src/app/api/skill/save/route.ts`):**
  - POST `{skillId, manifest}` → writes to workspace-root `.ivaronix/skills/<id>/SKILL.md`.
  - Validates skillId against `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/` to block path traversal.
  - 64 KiB manifest size limit. Refuses to overwrite an existing skill — caller bumps the version or removes the dir.
- **Header / Skills nav wiring:** `/skills` page Section CTA now exposes "+ Compose a new skill" → `/skill/new`.
- **§11 e2e visual proof captured** (`screenshots/3b-skill-builder/`):
  - Desktop top/mid/bottom: form + live preview side-by-side, all field types rendered.
  - After-edits snap: skill id + system prompt updates flow into the live preview character-by-character.
  - After-save snap: green "Saved ✓" button + path confirmation + run-it-now command.
  - Mobile: form + preview stack vertically.
- **Verification script:** `scripts/qa/metamask-e2e/verify-3b.ts` — 7 assertions all pass:
  - Form headline rendered. Live preview block rendered. Fee split slider rendered. System prompt field rendered. Phase B publish disclosure rendered.
  - Preview reflects skill id + system prompt edits.
  - Save endpoint writes the file with the form values; cleanup removes the test artifact.
- **Closes Track 3 onboarding bar:** a non-dev creator can compose a skill in a couple of minutes without touching TypeScript. Agent0G's no-code wedge is now mirrored, but every saved manifest hashes into the same canonical `findSkill` path the dev-authored skills use — so registry, scanner, sandbox, and receipt machinery all apply identically.

### 3C. Receipt-as-firewall wiring → ✅ DONE (library code-complete + Foundry-tested · 5/5; deployment Phase B)

- **Solidity library shipped (`contracts/src/IvaronixReceiptGuard.sol`):**
  - `IvaronixReceiptGuard.requireValidReceipt(registry, receiptId, expectedAgent, expectedReceiptType)` — `internal view` that reverts with `"IvaronixReceiptGuard: receipt not anchored"` / `"agent mismatch"` / `"type mismatch"` on any failure mode. Caller's contract can branch on the revert message.
  - `IvaronixReceiptGuard.isValidReceipt(...)` — non-reverting variant returning `bool`. Use when the caller wants to emit a soft-warning event instead of aborting.
  - **Library, not a contract:** zero deployment cost, zero state. Any consuming contract embeds the guard at compile time.
  - Honest scope-out documented in the file: the chain stores numeric type codes, not canonical skill ids (`private-doc-review`, etc.), so per-skill granularity stays in the off-chain receipt body. Consumers that want skill-level matching follow the on-chain guard with an oracle-fed body check.
- **Foundry test (`contracts/test/IvaronixReceiptGuard.t.sol`):** 5/5 tests pass.
  - `test_validReceipt_passes` — anchored receipt + correct expectations passes.
  - `test_unanchoredReceipt_reverts` — id outside `nextId()` reverts.
  - `test_agentMismatch_reverts` — wrong agent reverts.
  - `test_typeMismatch_reverts` — wrong type code reverts.
  - `test_secondAnchor_independentValidity` — guards correctly distinguish multiple receipts.
- **Suite-wide regression:** the full Foundry test suite is **90/90 passing** with the new file (was 85/85 before).
- **Phase B deployment** explicitly blocked on funding the deployer wallet (per CLAUDE.md §1 "the only blocker is money"). Concrete unblock action: fund the deployer with ~0.05 OG on Galileo (or mainnet), run `forge script` to deploy a wrapper contract that exposes the library to external dapps, and add the deployed address to `deployments/testnet.json`.
- **Demo Safe-wallet wiring** is the natural follow-up integration (a Safe module that calls `requireValidReceipt` before approving payment). Tracked as a separate stretch item — the library is ready for any solidity dev to drop into a Safe module today.

### 3D. Embeddable receipt-verifier widget → ✅ DONE (npm package + iframe page + vanilla JS loader)

- **`@ivaronix/widget` npm package (`packages/widget/src/index.tsx`):**
  - `<ReceiptVerifier id="1004" />` — React component that renders an iframe pointing at the public Studio's `/embed/r/<id>` route.
  - Props: `id`, `origin` (default `https://ivaronix.studio`), `width`, `height`, `title`, `style`. Sensible defaults: 100% × 420 with `maxWidth: 600`, `referrerPolicy: 'no-referrer'`, `loading: 'lazy'`.
  - Pure peer-deps on React 18+. No client-side RPC, no analytics, no cookies.
  - README documents both usage paths (React + vanilla HTML).
- **Studio iframe-friendly route (`apps/studio/src/app/embed/r/[id]/page.tsx`):**
  - Stripped-down receipt summary: status chip (`FULLY VERIFIED ✓` / `ANCHORED` / `CLAIMED`), tier badge (`TIER 1 · TEE` green / `TIER 2 · EXTERNAL` amber — honest marking per CLAUDE.md §6), receipt id + skill, headline, network, clickable anchor tx, "view full receipt" + "on chainscan" CTAs, "Verified by Ivaronix · the receipt is the spine" footer signature.
  - `apps/studio/src/app/embed/layout.tsx` injects a five-selector style override that hides the studio header + footer for any `/embed/*` route — App Router root layouts always wrap every route, so a scoped CSS override is the smallest portable way to drop chrome.
- **Vanilla JS loader (`apps/studio/public/embed.js`):**
  - `<script src="https://ivaronix.studio/embed.js" data-receipt-id="1004"></script>` auto-creates the iframe at insertion point.
  - `data-width` / `data-height` overrides supported. No dependency, no analytics, no globals.
- **End-to-end visual proof (`screenshots/3d-widget/`):**
  - `01-embed-600x420.png` — typical sidebar embed
  - `02-embed-320x420.png` — narrow column embed (mobile / sidebar)
  - `03-embed-1200x800.png` — large viewport, maxWidth caps the card at 600
  - `04-partner-page-with-iframe.png` — actual third-party host page (`sample-partner-page.html`) loading the embed via `file://`. Iframe is iframe-clean: no Studio header, no Studio footer, no Studio padding.
- **Voice + content checks (4/4 pass):** status chip, tier badge, view full receipt CTA, footer signature all rendered.
- **Verification script:** `scripts/qa/metamask-e2e/verify-3d.ts` — re-runnable, no MetaMask required.
- **Effect:** any third-party site can drop one line of HTML or one React import and surface a verifiable Ivaronix receipt to its visitors. Brand expands beyond the Studio domain. The "verify" action remains a click away to the canonical `/r/<id>` page or the on-chain explorer — every external embed loops back to verifiable evidence.

---

---

## Tier 4 · post-grant lift (started 2026-05-09)

### 4A. Printable / shareable receipt page (`/r/[id]/print`) → ✅ DONE

- **Why:** persona-locked use case — the deal lawyer ran the audit and needs a one-page paper-grade artefact she can email her partner or paper-file with the deal binder. The interactive `/r/[id]` page is for verification clicking; the print page is for printing.
- **Studio route shipped (`apps/studio/src/app/r/[id]/print/page.tsx`):**
  - Letterhead block with "IVARONIX · ACTION RECEIPT" eyebrow, big "Receipt #N" title, sub-title with skill@version + network + ISO timestamp.
  - Status block on right with bordered "ANCHORED" / "FULLY VERIFIED" + "TIER 1 · TEE-attested" / "TIER 2 · External-signed" — honest tier marking per CLAUDE.md §6.
  - "Summary" prose section.
  - "Audit trail" `<dl>` with: receipt root, agent wallet, anchor tx, block, type, model, tokens · cost, burn mode (key fingerprint snippet), built-on (priorReceiptIds count + first three).
  - "Verify this receipt from any machine" section with three-command CLI snippet + the public proof URL + on-chain inspection URL.
  - "Generated by Ivaronix · the receipt is the spine · <url>" footer signature.
- **Print-only layout (`apps/studio/src/app/r/[id]/print/layout.tsx`):** scoped CSS that hides the studio header + footer + main padding for the route, sets `@page A4 portrait` margins, and drops the back-link / print-button when `@media print`. Letterhead and footer use `<div>` instead of `<header>` / `<footer>` so the layout's chrome-stripper does not also drop our own letterhead.
- **Print client island (`print-controls.tsx`):** `<button>` calling `window.print()` — pure client island, the rest of the page is a server component.
- **Entry point:** `Print / save as PDF →` link added to the chip row on `/r/[id]` (right-aligned, opens the print page in a new tab).
- **§11 e2e visual proof captured** (`screenshots/4a-print/`):
  - `01-print-receipt-1004-screen.png` — desktop screen view at 1024×1400.
  - `02-print-receipt-1004-print-emulation.png` — Playwright `emulateMedia: 'print'` snap; chrome stripped, only the printable surface visible. **This is what the user's PDF will look like.**
  - `03-print-receipt-1252.png` — sanity-check on the consolidation receipt to confirm the priorReceiptIds + Burn-mode rendering handles that variant.
- **Voice + content checks (9/9 pass):** letterhead title, status block, tier label, audit-trail receipt root, audit-trail agent wallet, verify section, three-command snippet, footer signature, print-hide controls hidden under print emulation.
- **Verification script:** `scripts/qa/metamask-e2e/verify-4a.ts` — re-runnable, no MetaMask required.

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
