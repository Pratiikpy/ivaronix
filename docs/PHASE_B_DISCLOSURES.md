# Phase B disclosures

> Per CLAUDE.md §1: "surface the half-baked, always." This doc enumerates every
> known half-baked surface in the Studio and CLI (snapshot baseline 2026-05-09,
> with closures landing through 2026-05-15 mainnet promotion) and how each is
> disclosed to a judge or user — so nothing is hidden behind a polished
> screenshot. Each item names the file, the current honest behaviour, and the
> Phase B fix.

## Closed in this commit

### A · Vanity agent handle copy (audit #2)
- **File:** `apps/studio/src/app/agent/[handle]/page.tsx`
- **Was:** "Handles arrive Day 17. For Day 13–16, pass a wallet address…" — internal sprint copy exposed publicly.
- **Now:** "Pass a wallet address to view this agent. Vanity handles are not yet anchored on the AgentPassport contract — when they are, they will resolve here automatically."

### B · Receipt type human label (audit #8)
- **Files:** `apps/studio/src/app/agent/[handle]/page.tsx`, `apps/studio/src/app/dashboard/page.tsx`, helper `apps/studio/src/lib/receipt-labels.ts`.
- **Was:** "type code 5" rendered with no human meaning.
- **Now:** `receiptTypeLabel(5) → "skill_exec"`, `receiptTypeLabel(11) → "doc_room_read"`, etc. Reverse-mapped from `RECEIPT_TYPES` in `@ivaronix/core` — single source of truth. New receipt types added to the enum surface here without further wiring.

### C · CLAIMED banner shown as success (audit #14)
- **Files:** `apps/cli/src/lib/ui.ts`, `apps/cli/src/commands/receipt.ts`.
- **Was:** `ui.banner(true, '→ CLAIMED (not yet anchored)')` rendered green — visually identical to ANCHORED ✓.
- **Now:** `ui.banner` accepts `'ok' | 'fail' | 'pending'` (boolean still supported for back-compat). Pending uses yellow. CLAIMED-but-unanchored messages now read "→ CLAIMED (not yet anchored — not verified)" in yellow.

### D · Hardcoded first-party skill count on /global (audit #13)
- **File:** `apps/studio/src/app/global/page.tsx`.
- **Was:** Stat literal `value="5"` for first-party skills, drifts silently.
- **Now:** `firstPartySkillCount: loadAllSkills().length` from the same `loadAllSkills()` already used by `/skills`. Add or remove a skill manifest, the number tracks.

### E · Agent profile receipts cap (audit #12)
- **File:** `apps/studio/src/app/agent/[handle]/page.tsx`.
- **Was:** `reg.findByAgent(decoded, 5)` — agent with hundreds of receipts shows 5.
- **Now:** Cap raised to 25 (visible window for an active agent) without paginating; full history remains via the dashboard / indexer for power users.

### F · MemoryAccessLog audit feed for THIS owner (audit #5)
- **File:** `apps/studio/src/components/MemoryPanel.tsx` — new `<AuditFeed>` block.
- **Was:** comment in source said "Day 18 polish adds the on-chain MemoryAccessLog audit feed for THIS owner" — never shipped.
- **Now:** Reads `MemoryAccessed` events directly from chain via viem `getLogs`, filtered by the connected owner's `listGrantsByOwner` set. Renders the most recent 12 events with access type, agent, timestamp, and tx link. Empty-state message says exactly what "no events" means so the absence is informative, not spooky.

### G · daemon native-host-stdio bridge honest help text (audit #6)
- **File:** `apps/cli/src/commands/daemon.ts`.
- **Was:** description "Internal: stdio bridge for browser native-messaging hosts" — implied a working bridge.
- **Now:** description carries the Phase B caveat inline: "(Phase B — no extension shipped yet; verb echoes for test-harness pairing only)". The verb stays so an extension, when shipped, can pair against this binary without redeployment.

## Open · documented honestly, no UI lies

### 1 · Studio-anchored receipt issuer is the operator wallet, not the user (audit #1)  ·  ✅ CLOSED sweep 245e017 + sweep 156
- **File:** `apps/studio/src/app/api/run/route.ts` + `packages/receipts/src/verify.ts`.
- **What shipped:** SIWE handshake landed in sweep 245e017 (K-8 + K-9 closure). `/api/run` now reads the `SESSION_COOKIE_NAME` cookie before accepting a `userWallet` claim — the SIWE-signed session is verified server-side and must match the wallet the body claims. The receipt schema's `agent.signedBy` field now distinguishes three trust tiers: `'operator'` (legacy default), `'operator-on-behalf-of-user'` (operator anchors a receipt attributing the action to a SIWE-authenticated user wallet), and `'user-direct'` (browser-side `signMessage` via wagmi — fully self-sovereign provenance, available behind opt-in). The verifier (`verify.ts:104-147`, sweep 156 closure for §I-3/K-14) branches on this field: equality between `signature.signer` and `agent.ownerWallet` is enforced for `'operator'` and `'user-direct'`; the inequality for `'operator-on-behalf-of-user'` is honest by design and recorded in the verifier output as `"delegated · signer X (operator) signed on behalf of Y (user)"`.
- **What the user sees today:** when the browser wallet authenticates via SIWE before the run, `/r/<id>` shows `agent.ownerWallet` as the user's wallet (not the operator). A judge inspecting the receipt sees the user-direct or operator-on-behalf-of-user attribution honestly; legacy operator-issued receipts stay tagged `'operator'`. The four-light row gates correctly on every variant.

### 2 · SubscriptionEscrow contract deployed, no CLI / Studio surface (audit #3)
- **Files:** `contracts/src/SubscriptionEscrow.sol`, receipt type slot 9 in `packages/core/src/types.ts`.
- **Reality:** The contract is on chain; no `ivaronix subscription` command exists; no Studio page exercises it.
- **Why it stays:** Track 3's Agent-as-a-Service marketplace is a directional bet. The contract is positioned for the recurring-billing wedge; without a billing flow we hide the receipt slot from the judge's feature list rather than ship a bare-stub command. The slot is reserved, not claimed.
- **Phase B fix:** ship `ivaronix subscription create / checkin / status` plus a `/subscriptions` Studio dashboard. Documented as the Track-3 follow-up; not on this submission's "shipped" list.

### 3 · /global "OG spent" reads only local filesystem (audit #4)
- **File:** `apps/studio/src/app/global/page.tsx:90`, `apps/studio/src/lib/local-receipts.ts`.
- **Reality:** The OG-spent stat is sourced from `.ivaronix/receipts/anchored/*.json` on the Studio process's disk. On a fresh deploy or any machine without the operator's local receipts, this shows `0.000000 OG`.
- **What the page says:** the label is `og spent (locally tracked)` — explicit about scope. Not pretending to be a global aggregate.
- **Phase B fix:** wire to the indexer's SQLite replica (`ivaronix indexer`) of all on-chain receipt events. The replica already exists and ships with the CLI; the Studio just needs to read it.

### 4 · /data-room/[id] reads only local manifest (audit #11)
- **File:** `apps/studio/src/app/data-room/[id]/page.tsx`.
- **Reality:** The data room manifest is stored under `.ivaronix/rooms/<id>.json` on the operator's machine. A judge browsing the deployed studio on a different host sees "Room not found".
- **What the page says today:** "The manifest for this room is not on the local filesystem of the Studio process. Either it was never created, or its operator has not synced it to this machine."
- **Phase B fix:** anchor the manifest hash on 0G Storage at room creation and fetch by storage root in the page. The encrypted blob is already on storage; the manifest needs the same treatment.

### 5 · fee_split recorded but no on-chain payout (audit #9)
- **File:** `packages/runtime/src/pipeline.ts` post-anchor hook.
- **Reality:** Every receipt records `feeSplit: { creatorBps, treasuryBps }`. No OG transfer to the creator wallet runs after anchor.
- **What the receipt page says:** the fee_split block is rendered with the bps values — accurate to what was recorded — without claiming a transfer occurred.
- **Phase B fix:** add an on-chain payout in the post-anchor hook, splitting `billing.estimatedCostOg` per the bps. Track 3 marketplace requires this to be real; today it is the receipt schema-truth without the cash leg.

### 6 · CLI commands without a Studio surface (audit #10)
- **Commands:** `swarm`, `session`, `pr`, `serve`, `openclaw`, `audit`, `code`, `daemon`, `plan`.
- **Reality:** these are CLI-first surfaces. Per CLAUDE.md §11.5, each must pass the UI-promotion gate.
- **Decision per command:**
  - `swarm`, `session`, `audit`, `code`, `plan` — **CLI-only by design**, documented in command help. The PMF wedge is private operator-side workflows; promoting to UI is wrong-direction polish for those.
  - `pr`, `openclaw`, `serve`, `daemon` — **Phase B UI candidates**. Each gets a Studio surface or is removed from the bin if PMF is unproven.

## Verification of every disclosure above

Every claim in this doc maps to an open file path. Every open Phase B item has a named file and a one-sentence fix. The doc is small enough to reread before submission and update each row.

The file is treated as part of the submission package: a judge reading it knows exactly where the half-baked edges are, instead of finding them themselves.
