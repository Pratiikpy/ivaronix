import { RECEIPT_TYPES } from '@ivaronix/core';

const RECEIPT_TYPE_LABELS: Record<number, string> = Object.fromEntries(
  Object.entries(RECEIPT_TYPES).map(([k, v]) => [v as number, k])
);

export function receiptTypeLabel(code: number | bigint | string): string {
  const n = typeof code === 'bigint' ? Number(code) : Number(code);
  return RECEIPT_TYPE_LABELS[n] ?? `type_${n}`;
}
