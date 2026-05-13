# Extra Testing (deferred · post-launch)

> Tests + features explicitly deferred from `docs/UI_REAL_USER_TEST_PLAN.md`.
> Not blocking submission. Queued for post-mainnet / v1.1 work so the launch test plan stays focused on what users will actually hit on day one.

Status: every item below has an explicit "why deferred" reason captured at decision time (2026-05-13). When the deferral reason no longer applies, move the item back into the canonical test plan.

---

## DT-1 · Cross-browser sweep

**Scope:** Safari iOS, Firefox, Edge, mobile WebKit at 375×812.

**Why deferred:** If everything works in Chrome + mobile Chrome, the cross-browser bug surface is ~1% (known modern-web compatibility). The launch test plan stays focused on Chrome + mobile Chrome because that's where 95% of judges/users will land.

**When to revisit:** Before HK Festival in-person judging (judges in APAC often on iPhones — Safari iOS becomes a real surface). v1.1 milestone.

**Acceptance for re-promotion:** Test the same flows from `UI_REAL_USER_TEST_PLAN.md` Priority 0-12 in Safari iOS + Firefox + Edge. PASS criteria identical.

---

## DT-2 · Network failure injection

**Scope:** block Goldsky URL in DevTools network panel · throttle to slow 3G · block 0G RPC briefly · simulate Galileo halt · verify graceful degradation across all flows.

**Why deferred:** Launch test plan already covers the headline failure modes through normal flows (subgraph-down chain-fallback is in P5 Priority 13; demo-wallet OOF is in P2). The exhaustive sweep is a post-launch hardening exercise.

**When to revisit:** Post-launch (v1.1). The HackQuest judges won't intentionally throttle their network during a 3-minute live demo; the in-product fallback paths are tested in the launch plan.

**Acceptance for re-promotion:** Run the launch test plan with each failure mode injected (one per pass); document the user-visible behavior at every state.

---

## DT-3 · Full accessibility (Priority B per CLAUDE.md §17.10)

**Scope:** keyboard nav · focus rings on every interactive element · ARIA labels · WCAG AA contrast on every text surface · screen reader announces tx state changes · reduced-motion preference respected.

**Why deferred:** Accessibility is genuinely important but not a launch-feature, and the visual contract + brand tokens already enforce contrast at the design-system level. The full a11y sweep + screen-reader pass is a post-mainnet hardening cycle.

**When to revisit:** After mainnet deploy (Block K) — before the v1.1 push for broader-distribution launches (enterprise design partners, HackQuest follow-on).

**Acceptance for re-promotion:** Axe DevTools or Lighthouse Accessibility audit ≥ 95 on every priority-route in `UI_REAL_USER_TEST_PLAN.md`; manual screen-reader walkthrough of P3 Normal Run + P5 Marketplace happy-path.

---

## DT-4 · Browser back/forward + multi-tab

**Scope:** back button after form submit (no resubmission) · onboarding → dashboard → back (state preserved) · multi-tab same-wallet sync after a tx · multi-tab as different wallets staying independent · refresh during tx pending · close-and-reopen mid-flow.

**Why deferred:** Each one is a real edge case but each one is also rare. The launch test plan covers the highest-impact ones (reload mid-tx is in P0 Setup). Exhaustive back/forward × multi-tab × state-recovery matrix is queued for v1.1.

**When to revisit:** v1.1 hardening; specifically when adding mobile WalletConnect support (the multi-tab path becomes more load-bearing).

**Acceptance for re-promotion:** Matrix of {back, forward, refresh, close-reopen, multi-tab} × {form submit, tx pending, post-anchor, marketplace browse} — every cell PASS or documented as known-limitation.

---

## DT-5 · Wrong-network auto-suggest (build feature, not test)

**Scope:** when a user connects MetaMask on the wrong network, Studio should AUTOMATICALLY suggest "switch to Galileo testnet now" via the `wallet_switchEthereumChain` RPC — instead of just showing an inline error.

**Why deferred:** This is a UX polish FEATURE that landed in the test plan as a desired behavior. The current product surfaces a "wrong network" state but doesn't proactively call `wallet_switchEthereumChain`. The build pattern is straightforward:

```ts
// apps/studio/src/components/ConnectButton.tsx (or equivalent)
if (chainId !== 16602) {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x40DA' }], // 16602 in hex
    });
  } catch (err: any) {
    if (err.code === 4902) {
      // chain not added — fall through to wallet_addEthereumChain
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x40DA',
          chainName: '0G Galileo',
          rpcUrls: ['https://evmrpc-testnet.0g.ai'],
          nativeCurrency: { name: 'OG', symbol: 'OG', decimals: 18 },
          blockExplorerUrls: ['https://chainscan-galileo.0g.ai'],
        }],
      });
    }
  }
}
```

**When to revisit:** v1.1, after the launch test plan PASS — this is a smoothness improvement, not a launch blocker. The current "wrong network" inline state already prevents broken txs.

**Acceptance for re-promotion:** Connect MM on Ethereum mainnet → Studio popup asks for chain switch → user clicks Approve → MM switches to Galileo (or adds it if not present) → Studio resumes. No manual MetaMask menu trip.

---

## DT-6 · Cold-start performance budget (deeper than P14 baseline)

**Scope:** Lighthouse on every priority-route, not just landing · 4G + slow-3G + offline simulation · server-side rendering check on `/r/<id>` for SEO crawlers · bundle-size deep dive with `@next/bundle-analyzer`.

**Why deferred:** P14 (in the launch plan) captures the 5 headline numbers. The exhaustive per-route × network × tool matrix is post-launch.

**When to revisit:** v1.1 hardening before broader-audience launch.

---

## DT-7 · Sentry / Telemetry / Observability rollout

**Scope:** wire Sentry DSN, set up error alerting, dashboard for production errors, structured logging for `/api/*` routes, p95 latency tracking.

**Why deferred:** Block E ships local telemetry (`apps/studio/.ivaronix/telemetry/*.jsonl`). External observability platform (Sentry, Datadog, Grafana) is post-launch — for v1 we read local logs.

**When to revisit:** v1.1 when scaling beyond the operator's single deploy.

---

## DT-8 · MCP server testing (specific deferral)

**Scope:** full Claude Desktop + Cursor MCP integration test. Currently the MCP server (`packages/mcp-server/`) is shipped but the end-to-end test against Claude Desktop / Cursor UI is operator-action (genuinely external — needs the IDE installed).

**Why deferred:** MCP is the THIRD test phase per the user's locked order (UI → CLI → MCP). After UI + CLI prove out, MCP testing comes in. Until then, MCP stays in the codebase with stubbed tests.

**When to revisit:** After UI test plan complete AND CLI light cross-check complete.

---

## DT-9 · Internationalization / Unicode

**Scope:** CJK characters in document input, RTL languages, emoji in skill names, multi-byte handling end-to-end.

**Why deferred:** v1 is English-only by design. The product CAN handle Unicode in inputs (UTF-8 throughout) but the UI copy is English; the QA scope reflects that.

**When to revisit:** when adding non-English locale support (post-launch).

---

## DT-10 · JS-disabled `/r/<id>` fallback

**Scope:** receipt proof page renders meaningful content with JavaScript disabled — judges with strict no-JS browsers still see SOMETHING verifiable.

**Why deferred:** Receipt page is Next.js server-rendered today; the body content IS in the initial HTML. Full no-JS interactivity (verify button, chainscan links) is queued.

**When to revisit:** v1.1.

---

## How to promote an item back

When the deferral reason no longer holds:

1. Delete the item from this file.
2. Add it to the appropriate priority in `docs/UI_REAL_USER_TEST_PLAN.md` with explicit acceptance criteria.
3. If it's a build feature (DT-5 style), open a `feat(...)` branch and ship it as a normal block.
4. Commit message: `chore(testing): promote DT-N from extra-testing into UI test plan`.

---

*2026-05-13 · Deferred so the launch test plan stays focused. Nothing here is forgotten — every item has a re-promotion criterion.*
