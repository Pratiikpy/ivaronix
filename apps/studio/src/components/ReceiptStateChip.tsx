/**
 * 4-state verification chip. Visual contract: CLAUDE.md §10 + brand/tokens.css.
 *
 * - PENDING  : receipt root computed but not yet anchored on chain
 * - ANCHORED : anchored on chain, but body JSON not available locally so
 *              hash + signature re-check can't run. Public proof URL
 *              re-derives the chip when the operator publishes the body.
 *              Chain anchor is the source of truth either way.
 * - VERIFIED : anchored on chain AND body JSON + signature + hash all pass
 * - MISMATCH : anchor present but body fails the hash or signature check
 *
 * Why split PENDING from ANCHORED (added 2026-05-14 · P5 receipt 28):
 * /r/28 was rendering "PENDING" amber because Vercel /tmp doesn't
 * persist the receipt body across requests. That label is misleading —
 * the receipt IS on chain, only the local hash-recheck is missing.
 * ANCHORED is honest: chain confirms it; full re-verify needs the body.
 */
export type ReceiptState = 'pending' | 'anchored' | 'verified' | 'mismatch';

export function ReceiptStateChip({ state, label }: { state: ReceiptState; label?: string }) {
  const className =
    state === 'verified' ? 'chip-verified'
    : state === 'anchored' ? 'chip-verified'   // green like verified — chain is truth
    : state === 'mismatch' ? 'chip-mismatch'
    : 'chip-pending';

  const text =
    label ??
    (state === 'verified' ? 'VERIFIED'
      : state === 'anchored' ? 'ANCHORED'
      : state === 'mismatch' ? 'MISMATCH'
      : 'PENDING');

  return <span className={className} role="status">{text}</span>;
}
