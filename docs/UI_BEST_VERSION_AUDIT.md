# UI Best-Version Audit · 2026-05-14

> Companion to `docs/UI_HALF_BAKED_AUDIT.md`. That doc asks "is it LIVE?"
> This one asks "is it the BEST POSSIBLE version, fully implemented?"
>
> Triggered by operator directive: before testing phase, every shipped
> feature must be audited for best-version completeness, not just
> functionality.
>
> Method: read top of each route (50-250 lines) for layout + copy + state
> handling; cross-check against `docs/UI_REAL_USER_TEST_PLAN.md` §Priority
> 20 best-version requirements and CLAUDE.md §9 (banned words) + §10
> (visual contract).

## Summary

A: 4 surfaces · B: 7 surfaces · C: 3 surfaces · D: 0 surfaces.

Nothing classifies as `D` (placeholder) — every shipped surface has a real
implementation. The `C` cluster is where polish gaps would feel visible to
a first-time judge.

## Surfaces

### 1. Home page (`/`)

- **Grade: B**
- **What works**
  - Persona-first hero, real `RunPanel`/`DemoPanel` on the right, three
    live hero stats (receipts / passports / first-party skills) all read
    from chain — no hardcoded numbers (`page.tsx:88-119`).
  - 14-section flow is dense and varied: personas, landing loop, 14-card
    module grid, roadmap with named blockers, builder rail, before/after
    cards, big numbers, manifesto, animated four-light, sovereignty
    circle. Every module card has a LIVE chip and a real href.
  - Roadmap section is honest — names the real blocker for each gated
    item (`operator-funded deploy`, `BotFather token`, `UI required`).
- **What doesn't**
  - **Builder rail navigation is broken.** Cards link to `/docs#cli`,
    `/docs#sdk`, `/docs#mcp` (`page.tsx:1061,1067,1073`). `/docs` is a
    `redirect('/0g')` (`apps/studio/src/app/docs/page.tsx:12`). `/0g`
    has zero anchors named `cli`, `sdk`, or `mcp` (grep returned no
    matches). All three deep-links land on `/0g` and scroll to the top
    — silent navigation failure on the most-clicked builder surface.
  - The 14-module grid card called "Docs" (`page.tsx:605`) has the same
    bug — points at the redirected URL.
  - "BUILT FOR" persona quotes (`page.tsx:355,360,365,370`) read like
    framing copy but are typeset as if they were attributed testimonials
    (italic-display in quote marks). A first-time reader will look for
    the attribution. They are framing, not quotes — drop the quote marks
    or label them "What it looks like in practice:".
  - The hero stat row uses raw em-dashes (`var(--color-muted)` dash
    fallback at `page.tsx:285`) — a single em-dash slips past the §9
    wording rule. Replace with the canonical `·` separator the rest of
    the page uses.
- **Move to A**
  1. Fix builder-rail hrefs: either build `/docs#cli`, `/docs#sdk`,
     `/docs#mcp` anchors on `/0g` (preferred — match the redirect
     target's actual content) OR change hrefs to `https://github.com/Pratiikpy/ivaronix/tree/main/apps/cli` style real targets.
  2. Re-label or de-quote persona quotes (`apps/studio/src/app/page.tsx:355-370`).
  3. Replace the lone em-dash in the hero stats row with `·`.

### 2. Receipt page (`/r/<id>`)

- **Grade: A**
- **What works**
  - Hero leads with `AI FINDINGS` block + signer + skill + model +
    convergence (`r/[id]/page.tsx:309-381`), exactly per §1.6 Day 1-3.
  - Three honest fallback states: `summary` present, older schema (no
    summary, body exists), or `body cold` (with a `Retry body fetch →`
    and a CLI cross-check command shown).
  - TIER badge (TEE green vs EXTERNAL amber) + 0GM badge are both
    real-evidence-gated (`r/[id]/page.tsx:139-200`); titles explain the
    tier delta on hover.
  - The four-light row evidence is gated on real signals (storage
    `evidenceRoot`/`storageRoot`, consensus attestations, router
    `routerVerified`, chain anchor) — not on body-exists alone.
- **What doesn't** (the one thing keeping this from a "perfect-A")
  - The cold-body retry button (`r/[id]/page.tsx:339-345`) is a plain
    anchor that re-navigates to the same URL. It's labelled "Retry body
    fetch" but actually just re-renders the page; the 0G Storage fetch
    fallback is Day 13-17 build queued per the half-baked audit row 4.
    Today's copy is honest about that ("wait for the 0G Storage fetch
    (Day 13-17 build)"), so it's not a lie — just a still-pending
    polish surface.
- **Move to A** — already A. (Receipt page is the canonical
  best-version surface; everything else can aim for this bar.)

### 3. Marketplace (`/marketplace`)

- **Grade: B**
- **What works**
  - Skill cards show name (or `0xhash…` if unresolved), price in OG,
    creator address, bps split, total receipts, total settled OG, and
    "Free" vs "X.XXXX OG" pricing chip (`marketplace/page.tsx:106-168`).
  - Data-source chip honestly says `Goldsky subgraph (live-indexed)`
    vs `direct chain reads (set SUBGRAPH_URL for faster queries)` —
    transparent about which path served the data.
  - "How it works" 5-step block below the grid explains the buy → run
    → payout loop in plain language.
- **What doesn't**
  - **Empty state is thin.** When zero priced skills exist, the page
    shows `No priced skills found. Creators: visit /marketplace/new` in
    a single grey card (`marketplace/page.tsx:77-84`). A first-time
    judge with no test data sees a near-empty page. Empty state should
    list the 6 first-party slugs with `Free` chips even if none are
    priced yet, so the page never reads as broken.
  - **Card title for unresolved skills shows `0xa1b2…` truncated hex**
    (`marketplace/page.tsx:133-135`). For first-party skills this is
    fine because `resolvedSlug` resolves the hash. For community-priced
    skills it reads as gibberish. Add a fallback name lookup against
    the `SkillRegistry` `name` field, or label the card "Custom skill
    by 0x…" so the user knows it's not broken.
  - **No filter or sort UI.** Priority 5 of the test plan asks for
    "Filter / sort controls (price / popularity / recent / trust)" —
    not built today. `sortBy: 'recent'` is hard-coded
    (`marketplace/page.tsx:30`).
- **Move to A**
  1. Smarter empty state that always lists the 6 first-party skills
     with a `FREE` chip if not on-chain priced (don't show "no skills"
     when 6 are loadable from `seed-skills/`).
  2. Fallback display name for unresolved skill ids (lookup
     `SkillRegistry.getVersion().name`).
  3. Add a sort dropdown (recent / price ↑ / price ↓ / most-run) —
     even client-side reordering of the already-fetched array would
     close the gap.

### 4. Memory (`/memory`)

- **Grade: B**
- **What works**
  - Two stacked sections: §01 Quick Capture (per-wallet sandbox) + §02
    Permission Center (on-chain grants + audit log) — clearly separated
    by `Section` labels (`memory/page.tsx:42-58`).
  - V2-first contract lookup with V1 fallback (`page.tsx:33-38`) so
    grants land on the right registry post-K-2.
  - Description in §01 honestly discloses the trade-off ("Studio writes
    plaintext for demoability; CLI gives you the same surface with
    end-to-end encrypted persistence").
- **What doesn't**
  - **The page is only 61 lines because all the surface is inside the
    two client components** (`MemoryNotesPanel` + `MemoryPanel`). I
    didn't read those, but the page-level shell offers no
    `What does a memory grant do?` explainer above the panels. A
    first-time visitor lands on two complex client panels with no
    framing. Add a 2-3 sentence "memory grants are on-chain capability
    tokens — Wallet A authorises Wallet B to read scope X" block
    between the section header and the form.
  - **No empty-state preview.** If a user has zero grants and zero
    notes, they see two empty panels. Show one example grant in a
    "What this looks like" preview card so the user knows what to
    expect.
- **Move to A**
  1. Add a 2-3 sentence explainer block before each `Section` panel
     (above `<MemoryNotesPanel />` and above `<MemoryPanel />`).
  2. Empty-state example grant + example memory note rendered in a
     dimmed preview when the real lists are empty.

### 5. Agents (`/agents`)

- **Grade: A**
- **What works**
  - Six-column table (rank, agent address+short, tier chip, trust,
    recorded-receipts, mint date) sorted by trust score
    (`agents/page.tsx:96-118`).
  - **Tier system is real and well-explained**: Council ≥ 200,
    Veteran ≥ 50, Trusted ≥ 20, Verified ≥ 5, Newcomer < 5
    (`page.tsx:56-62`). Each tier has its own chip palette.
  - **Honest description** about the recorded-receipts column: "Trust
    + recorded-receipts only increment when an authorized recorder
    calls `recordReceipt()` — the on-chain receipt log can be larger
    than the per-passport counter shown here" (`page.tsx:87`).
  - Honest empty state ("No passports minted on this network yet.
    Run `ivaronix passport mint` to be the first.").
- **What doesn't** — nothing material. The table is dense, the chips
  are clear, the tier explanation is good, the empty state is honest.

### 6. Dashboard (`/dashboard`)

- **Grade: B**
- **What works**
  - Server-component-by-default with a `DashboardClient` island that
    pushes the connected wallet into `?address=`
    (`dashboard/page.tsx:43-63`) — clean architecture.
  - Four data tiles: passport (with tier label), balance, scheduled
    runs, recent receipts (`page.tsx:90-222`).
  - **Empty-state labelling is honest**: "receipts (passport-recorded ·
    anchored runs not yet recorded here)" (`page.tsx:109-110`)
    explicitly calls out the gap between anchored count and passport
    recorder count.
  - No-passport state offers a clear `Onboard →` CTA.
- **What doesn't**
  - **Scheduled runs is CLI-only with no UI surface to create them.**
    The empty state instructs the user to run a 90-character CLI
    command (`page.tsx:152-153`). For a feature that ships in the
    dashboard, the user should at least see a "Create from CLI" button
    that opens the docs OR a `Coming to UI` honest pill. Today it reads
    as "this feature exists but you can't actually use it from this
    page."
  - **`?address=` URL share UX is not promoted.** The "share your
    dashboard URL with `?address=`" copy (`page.tsx:77-79`) is buried
    in the connect-wallet hero. Once connected, there's no `Copy
    shareable URL` button. Add a small `Share this dashboard ↗` button
    near the wallet address so users can actually share.
  - **`balance` tile** shows OG balance but doesn't show how that
    translates to runs. "Each receipt anchor costs ≈0.0001 OG" is
    there (`page.tsx:141-142`) but the math is implicit. Show
    "≈ {balance/0.0001} more runs at this balance" so the user
    immediately knows runway.
- **Move to A**
  1. Add a `Schedule a run` CTA on the scheduled-runs empty state that
     either deep-links to `/skill/<id>?schedule=true` or honestly says
     "Schedule creation is CLI-only today (UI roadmap)".
  2. Add a `Copy URL` button next to the wallet-address line when
     `?address=` is set.
  3. Render runway math (`≈ N more runs at this balance`) in the
     balance tile.

### 7. Skills (`/skills`)

- **Grade: A**
- **What works**
  - **Manifest-hash registry chips are honest**: `REGISTRY MATCH` /
    `MISMATCH` / `LOCAL ONLY` / no chip for `unknown`
    (`skills/page.tsx:140-145`). Sort order puts MATCH first then
    alphabetical (`page.tsx:80-86`).
  - Chunked + retried RPC loader (`page.tsx:35-56`) so the full
    imported catalogue doesn't overwhelm Galileo and end up in the "unknown" bucket — caught a
    silent-drop bug in a previous iteration.
  - Honest count breakdown in the description: "X skills total · ~Y
    anchored on SkillRegistry · ~Z imported from upstream (not yet
    anchored)" (`page.tsx:99`). No "First-party skills: 156" lie that
    a prior version shipped.
  - Per-card pills for `tier`, `burn auto`, and `PermissionPills` give
    a quick capability snapshot.
- **What doesn't** — nothing meaningful. The MATCH / MISMATCH /
  LOCAL ONLY chips are the canonical honest-status pattern; this page
  sets the bar for everything else.

### 8. `/0g`

- **Grade: A**
- **What works**
  - Six module cards: Chain / Compute / Storage / Router / Agent ID /
    DA (`0g/page.tsx:44-96`).
  - **DA status honestly marked `roadmap`** with body text "On the
    integration roadmap. We do not claim integration we have not
    shipped" (`page.tsx:88-95`). This is exactly the §2.1
    judging-criterion requirement.
  - Contract address list auto-derives from the deployments manifest
    (`page.tsx:33-43`) — new V2/V3 ships there and this page updates
    without code touch (CLAUDE.md §15 bookkeeping rule satisfied).
  - Each card has a `seeItLive` real-route link (e.g. Compute → /r/1004
    FULLY VERIFIED; Storage → /data-room/{ulid}) — every claim has a
    proof button.
- **What doesn't**
  - Minor: the page is judge-facing but its title in the 14-module
    grid is "0G Stack Proof" and the route is `/0g`. The card body
    says "honest DA status" but a casual reader might think
    "honest DA" is a feature name. Cosmetic only.

### 9. `/learn`

- **Grade: B**
- **What works**
  - Seven explainers with anchor nav at the top (`learn/page.tsx:71-107`)
    — four-light, sovereignty, trust gradient, receipt anatomy,
    consensus, burn, FAQ-glossary.
  - Tier cards (`page.tsx:455-512`) lay out `verificationMethod`,
    provider, plaintext-visible-to, replay path side-by-side — a real
    teaching surface, not marketing.
  - Receipt-anatomy section auto-reads `RECEIPT_TYPES` (`page.tsx:525`)
    so all 13 slots show up automatically when new ones land.
- **What doesn't**
  - **`/learn` and `/faq` overlap heavily.** Section 7 on `/learn` is
    "FAQ and glossary" but `/faq` is also a top-level route with 12
    questions. A first-time user sees both in the home grid + footer
    and wonders which one to read. Either (a) collapse `/learn` §7
    into a "Read the full FAQ →" deep-link, or (b) rename `/learn` §7
    to "Glossary" only and move the FAQ content out.
  - **The `Section index` nav box** (`page.tsx:60-108`) is good but
    static — no `back-to-top` button, and the seven section headers
    don't have a sticky reader chip on long scroll. For a 1220-line
    page, a sticky section-tracker would help a lot.
  - **Section length is uneven.** Receipt-anatomy and four-light feel
    heavy (table + diagrams). Burn-mode and consensus feel comparatively
    thin (no visual diagram). Add at least one small visual to each
    section so the seven feel paced.
- **Move to A**
  1. Resolve `/learn` §7 vs `/faq` overlap — either redirect §7 to
     `/faq` or strip §7 down to a glossary-only block.
  2. Add sticky section-tracker chip on long scroll.
  3. Add a small visual (chip row, code block, or 2-3-row table) to
     burn-mode and consensus sections so all seven feel evenly weighted.

### 10. `/faq`

- **Grade: B**
- **What works**
  - 12 questions cover the real judge/user objections: trust,
    chatgpt-comparison, downtime, why-chain, operator-read, tiers,
    cost, own-provider, independent, pending, mainnet, source
    (`faq/page.tsx:82-373`).
  - Each FAQ has a short answer + a longer body — the short answer
    alone is enough for a skimmer; the body gives the receipts-and-
    citations evidence to a deeper reader.
  - Voice is on-brand: "The receipt does not claim the answer is
    correct. It claims four things about the run that produced the
    answer." (`page.tsx:88-91`) — terse, technical, honest.
- **What doesn't**
  - **Missing the most obvious newcomer question**: "What is a 0G
    Compute TEE and why should I trust it?" The `trust` and `tiers`
    FAQs answer the *outcome* of TEE attestation; neither defines
    what a TEE is. Add a 13th FAQ between `tiers` and `cost`:
    "What's a TEE — and what does 'TEE-attested' mean?"
  - **Missing the marketplace question**: "Can I make money on
    Ivaronix?" / "How do creator payouts work?" — the only mention of
    paid skills is the home page and `/marketplace`. The FAQ should
    have one row for the §3 Track 3 economics.
  - **Missing the privacy-breach question**: "What happens if the 0G
    Compute provider is compromised?" — half-answered by `operator-read`
    but framed as Ivaronix operator-side, not provider-side.
  - **No search / filter.** 12 questions render as a single column
    accordion. Add a search box (client-side fuzzy match on `q` +
    `short`) so users can jump.
- **Move to A**
  1. Add 3 missing FAQs (TEE definition, marketplace earnings,
     provider-compromise threat model).
  2. Add client-side search box on the page.
  3. Add anchor links so each FAQ has a `#trust`, `#chatgpt` etc URL
     (already has the `id` fields — just need a copy-anchor button
     per row).

### 11. `/onboard`

- **Grade: C**
- **What works**
  - V2-first passport address resolution with V1 fallback
    (`onboard/page.tsx:14-16`).
  - Hero copy is clear: "From wallet to your first receipt. You leave
    this page holding a public Proof URL of a real AI run signed by
    your wallet and anchored on 0G Galileo Testnet."
    (`page.tsx:31-37`).
- **What doesn't**
  - **The page is only 43 lines** — everything below the hero is
    inside `<OnboardClient />`. I cannot judge the actual 5-step UX
    without reading that component. The eyebrow says "§ ONBOARD · 5
    STEPS · < 90 s" but for a busy judge: is the page actually a
    polished 5-step wizard, or is it a single form with 5 fields? The
    test plan §11 (5-gated-steps friction) flagged this as the
    primary "judges who want 60-second proof get blocked" gap. Until
    `OnboardClient.tsx` is audited, this is C-grade by default.
  - **No "Skip to demo" escape hatch.** A judge with no wallet
    can't progress past step 1. The home page has `?demo=true` for
    this — but the `/onboard` page doesn't link there. Add a
    "Want to skip wallet setup? Try the operator-subsidised demo →"
    link in the hero.
  - **Time estimate `< 90 s` is unverified.** If the user actually
    has to install MM, fund a wallet from Galileo faucet, sign two
    txs, the real time is 5-10 minutes for a first-timer. Either
    soften the claim ("Most steps complete in under 90s once your
    wallet is funded") or make `< 90 s` real (e.g. an iframe demo).
- **Move to A**
  1. Audit `OnboardClient.tsx` for the actual 5-step UX (out of scope
     for this audit — flag for follow-up).
  2. Add a "Skip to one-click demo" CTA in the hero linking to
     `/?demo=true`.
  3. Either soften the `< 90 s` time-to-receipt claim or add a
     visible per-step ETA so the user knows what they're committing
     to.

### 12. `/docs`

- **Grade: C**
- **What works**
  - The redirect itself is the right pattern for a renamed route —
    permanent so old social shares and bookmarks resolve
    (`docs/page.tsx:1-14`).
- **What doesn't**
  - **The redirect target (`/0g`) is NOT the same shape as a docs
    page.** `/0g` is the 0G primitive integration showcase; it has
    six module cards and zero CLI/SDK/MCP/embed content. A user who
    clicks "Docs" in the home grid expecting CLI commands instead
    gets a primitive depth proof page. This is a navigation lie.
  - **`/docs#cli`, `/docs#sdk`, `/docs#mcp` are dead anchors** on the
    `/0g` redirect target (no IDs match — confirmed via grep). The
    builder rail's three deep-links silently land at the top of
    `/0g`. This is the single most visible broken-UI seam in the
    product right now.
  - The 14-module grid card "Docs" body says "CLI · MCP · SDK ·
    embed widget · independent verify" — none of which exist on
    `/0g`. A user clicks expecting one thing, gets another.
  - There is no actual docs surface for the 33-command CLI and
    21-package SDK; the README in the repo serves that role today,
    but a Studio visitor never sees it unless they click through to
    GitHub.
- **Move to A**
  1. **Build a real `/docs` page** (don't redirect). Four sections
     with anchor ids: `#cli` (33 commands · quick reference + one
     example per command), `#sdk` (21 packages · install + 3
     copy-paste snippets), `#mcp` (Claude Desktop / Cursor config
     JSON + screenshots), `#embed` (iframe widget + props + 2
     real-receipt examples). This is the C → A fix for the entire
     builder-experience surface.
  2. If shipping a full `/docs` page is out of scope this cron, at
     minimum: (a) replace the builder-rail hrefs with
     `https://github.com/.../tree/main/apps/cli` style real targets,
     and (b) replace the 14-module grid `Docs` href with
     `https://github.com/Pratiikpy/ivaronix` (or remove the card).
  3. Decide whether `/docs` (as a name) or `/0g` (as a name) wins —
     today both are claimed in different copy. Pick one and update
     the 14-card grid + builder rail consistently.

### 13. `/thesis`

- **Grade: A**
- **What works**
  - Personal-narrative hero ("Some documents are too sensitive to
    show anyone.") — matches the persona-driven framing on the home
    page (`thesis/page.tsx:35-53`).
  - **Three-choice problem framing** (paste into ChatGPT / vendor
    data room / local model) — each option named, each flaw spelled
    out (`page.tsx:58-72`). This is the honest comparison §9 calls
    for: no competitor-bashing, just describe their tradeoffs.
  - **Five-step "how it works"** maps 1:1 to the receipt schema's
    real moving parts (encrypt → store → TEE → sign → anchor)
    (`page.tsx:78-99`).
  - Live numbers from chain via `unifiedNextId()` / `livePassportCount()`
    (`page.tsx:13-22`) with `numbers.json` fallback — the page never
    shows stale prose.
- **What doesn't** — nothing material. This is the strongest long-form
  story surface in the product.

### 14. `/brand`

- **Grade: B**
- **What works**
  - Seven section page: Cover · Logo · Color · Type · Voice ·
    Components · Tokens (`brand/page.tsx:45-58`).
  - Cover renders the brand kit cleanly with a 320px logo plate, four
    meta-cells (Brand / Tagline / System / Status), corner-bracket
    decorations — feels like a real brand kit, not a placeholder.
  - All tokens declared inline at the top (`page.tsx:20-38`) so the
    page is self-consistent even if `globals.css` drifts.
- **What doesn't**
  - **The page is in the public 14-module grid but is internal-use.**
    A judge or potential user clicks "Brand" expecting product
    information and gets a designer reference. Either (a) move
    `/brand` off the public nav and into a `/admin/brand` route, OR
    (b) reframe the page as a "Visual language" surface that explains
    *why* the design looks the way it does (editorial, off-white,
    receipts-as-evidence) — turn the internal artifact into a
    brand-story page.
  - The first H1 ("A quiet operating system for noisy agents")
    contradicts the home H1 ("Private AI work. Public proof."). Two
    different brand voices live on adjacent pages. Pick one.
  - "0G Agent OS" framing here doesn't match the persona-driven
    framing on `/thesis` and `/`. Brand page reads as developer-infra
    positioning; home reads as consumer-utility positioning.
- **Move to A**
  1. Decide whether `/brand` is a public surface or an internal one.
     If public, reframe the H1 + tagline to align with home's
     persona-first voice. If internal, drop it from the 14-module
     grid.
  2. Align the "0G Agent OS" vs "Private AI work. Public proof."
     voices — same product, same headline tone everywhere.

## Top 5 actionable upgrades

Ranked by user-impact-per-effort. The first two are non-negotiable
launch blockers — silent navigation failures on the builder surface
will look amateur in front of any judge with a developer in the room.

1. **Fix or rebuild `/docs`** (Surface 12) — the redirect-to-`/0g`
   pattern combined with the dead `#cli`, `#sdk`, `#mcp` anchors in
   the builder rail is the single most visible broken seam. Either
   build a real `/docs` page with the four anchors, or rewrite the
   builder-rail hrefs to point at GitHub. **Highest priority.**

2. **Fix the home builder-rail hrefs** (Surface 1) — same root cause
   as #1 but visible from the landing page itself. Until `/docs` is
   real, point the builder rail at real shipped surfaces:
   `https://github.com/Pratiikpy/ivaronix/tree/main/apps/cli` (CLI),
   `https://www.npmjs.com/package/@ivaronix/runtime` or the SDK
   README (SDK), `https://github.com/Pratiikpy/ivaronix/blob/main/docs/MCP_SERVER.md` (MCP). Embed already works.

3. **Smarter marketplace empty state + sort UI** (Surface 3) —
   today a fresh testnet visitor sees a near-empty marketplace.
   Pre-list the 6 first-party skills with `FREE` chips when nothing
   is on-chain priced; add a `Sort by: recent / price / popularity`
   dropdown. Closes the "marketplace looks dead on first paint"
   judging risk.

4. **Add 3 missing FAQs** (Surface 10) — define TEE, explain
   marketplace earnings, address provider-compromise threat model.
   Three short rows in `apps/studio/src/app/faq/page.tsx` close the
   "FAQ doesn't answer the obvious newcomer question" gap.

5. **Resolve `/learn` §7 vs `/faq` overlap + add /onboard demo
   escape hatch** (Surfaces 9 + 11) — collapse `/learn` §7 into a
   `Read the full FAQ →` deep-link, and add a "Skip to one-click
   demo" CTA on `/onboard` that links to `/?demo=true`. Both are
   low-effort, both close a "judges navigate in circles" risk.

## What's already A-grade

Leave these alone — they're the surfaces that set the bar:

- **Receipt page (`/r/<id>`)** — hero, four-light row, tier badges,
  honest fallback states. The canonical "best-version" surface;
  every other page can aspire to this.
- **Agents (`/agents`)** — tier system, honest column labelling,
  good empty state. The chip/table pattern here is the right
  template for other catalog surfaces.
- **Skills (`/skills`)** — manifest-hash MATCH / MISMATCH /
  LOCAL ONLY chips are the canonical honest-status pattern. Auto-
  derived counts in the section description close the §15
  bookkeeping rule.
- **`/0g`** — DA-as-roadmap honesty + auto-derived contract address
  list + per-card `seeItLive` proof links. Judge-facing
  best-in-class.
- **`/thesis`** — strongest long-form story. Three-choice problem
  framing + five-step how-it-works narrative. No banned words, no
  competitor-bashing, live numbers from chain.

---

## Audit method + caveats

- Read top 50-250 lines of each route's `page.tsx`. Did NOT read
  every client-side component (`OnboardClient`, `MemoryPanel`,
  `MemoryNotesPanel`, `DashboardClient`, `RunPanel`, `DemoPanel`,
  `SovereigntyCircle`). Where a page is mostly a shell around a
  client component, grade reflects only the server shell.
- Did NOT load any page in a browser. No screenshots, no visual
  inspection per CLAUDE.md §17.7. This is a code-level audit only —
  visual inspection is a follow-up task once the structural fixes
  ship.
- `/onboard` C-grade is largely a "couldn't audit the actual 5-step
  flow" placeholder. The client component is the real surface; that
  audit should run before launch.
- Surfaces NOT in scope of this audit but worth a follow-up pass:
  `/global` (live feed), `/embed/r/[id]` (iframe widget),
  `/marketplace/[skillId]` (per-skill buy page), `/data-room/[id]`,
  `/delegate/[id]`, `/admin/treasury`, `/marketplace/payouts`,
  `/marketplace/new`, `/skill/new`, `/skill/[id]`, `/agent/[addr]`,
  `/r/[id]/print`, `/privacy`, `/terms`. The 14 surfaces above are
  the operator's named scope.

## Last refresh

2026-05-14 · pre-launch best-version audit · 14 surfaces graded ·
3 surfaces flagged for builder-experience navigation fix.
