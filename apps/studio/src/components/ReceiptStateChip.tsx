/**
 * 3-state verification chip — pending (grey), verified (green),
 * mismatch (amber). The single canonical place receipt verification
 * status renders; every Studio surface that shows a receipt state
 * goes through this component. Visual contract: CLAUDE.md §10 +
 * `brand/tokens.css`.
 *
 * - PENDING  : root computed but not yet anchored (or not found on chain)
 * - VERIFIED : anchored on chain AND signature/hash check passes
 * - MISMATCH : anchor present but signature/hash check fails
 */
export type ReceiptState = 'pending' | 'verified' | 'mismatch';

export function ReceiptStateChip({ state, label }: { state: ReceiptState; label?: string }) {
  const className =
    state === 'verified' ? 'chip-verified'
    : state === 'mismatch' ? 'chip-mismatch'
    : 'chip-pending';

  const text =
    label ??
    (state === 'verified' ? 'VERIFIED' : state === 'mismatch' ? 'MISMATCH' : 'PENDING');

  return <span className={className} role="status">{text}</span>;
}
