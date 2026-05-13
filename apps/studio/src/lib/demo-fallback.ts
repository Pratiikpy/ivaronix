/**
 * FINAL_BUILD_PLAN.md Block M · D-12 · pre-anchored fallback receipts.
 *
 * Galileo testnet halts 1-3 days at a time historically (Discord
 * ground-truth · §1 of the build plan). For demo / judge-replay paths
 * that depend on a live anchor, the rehearsal-window operator pre-
 * anchors 2 receipts the day before submission and records their IDs
 * here.
 *
 * Use cases:
 *   - `?demo=true` when the demo wallet is in funds but Galileo is
 *     halted (anchor fails) → fall through to one of these IDs.
 *   - JUDGE_REPLAY.md Path A (zero-install browser verify) works
 *     against these pre-anchored receipts even if the chain is down,
 *     because the receipt body + signature live in 0G Storage and the
 *     anchor entry is already on-chain (archived pre-halt).
 *   - The demo script in FINAL_BUILD_PLAN.md §7 falls back to the
 *     keyboard-shortcut URL switch if Galileo halts mid-live-demo.
 *
 * The receipts are real Ivaronix receipts produced by the operator
 * via `pnpm ivaronix demo --pay private-doc-review` on the pre-
 * submission rehearsal day. Their TEE attestation re-verifies the
 * same as a live-anchored receipt.
 *
 * To refresh:
 *   1. The day before submission, run `pnpm ivaronix demo --pay
 *      private-doc-review` twice on Galileo.
 *   2. Confirm both verify with `--tee-independent` →
 *      FULLY VERIFIED ✓.
 *   3. Update the FALLBACK_IDS array below with the two receipt IDs.
 *   4. Commit; the next deploy carries the fresh IDs.
 */

/**
 * Two pre-anchored receipts (the FALLBACK_IDS) plus the canonical
 * always-pinned sample receipt (1004, the iter-160 canonical FULLY
 * VERIFIED ✓ that the README + JUDGE_REPLAY.md anchor on). Order in
 * the FALLBACK_IDS array is by recency — entry [0] is the freshest.
 */
export const FALLBACK_IDS: ReadonlyArray<number> = [
  // Populated by the rehearsal-window operator run; until then, fall
  // back to the canonical iter-160 sample. The numbers:auto block in
  // README.md tracks the live total receipt count; the absolute IDs
  // below only change on a rehearsal-window refresh.
  1004,
  994,
];

/**
 * Canonical sample receipt — the one JUDGE_REPLAY.md Path A points at
 * and the README "See a sample receipt" CTA links to. Stable across
 * rehearsal-window refreshes (re-anchored only if the verifier reports
 * a regression — see HALF_BAKED.md for the audit chain).
 */
export const CANONICAL_SAMPLE_ID = 1004 as const;

/**
 * Public proof-URL helper. Used by the demo banner when falling back
 * during a chain halt — the banner shows the URL the visitor can open
 * in their own browser to verify the pre-anchored receipt themselves.
 */
export function publicProofUrl(id: number, base = 'https://ivaronix.vercel.app'): string {
  return `${base.replace(/\/$/, '')}/r/${id}`;
}

/**
 * Convenience: returns the freshest fallback ID, or the canonical
 * sample if no rehearsal-window refresh has shipped.
 */
export function freshestFallbackId(): number {
  return FALLBACK_IDS[0] ?? CANONICAL_SAMPLE_ID;
}
