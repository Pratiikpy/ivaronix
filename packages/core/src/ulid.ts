import { ulid } from 'ulid';

/** Generates a receipt ID prefixed with `rcpt_` (per RECEIPTS_SPEC.md §2). */
export function newReceiptId(): string {
  return `rcpt_${ulid()}`;
}

/** Generates a generic ULID for non-receipt entities (skills, sessions, etc.). */
export function newId(prefix: string): string {
  return `${prefix}_${ulid()}`;
}

/** Re-export ulid for direct use. */
export { ulid };
