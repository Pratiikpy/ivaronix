/**
 * 3-state verification chip per UI_UX_GUIDE §6 (locked).
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
