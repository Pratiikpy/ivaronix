/**
 * Reverse-map of RECEIPT_TYPES → human label for client surfaces.
 *
 * Mirrors `packages/core/src/types.ts:RECEIPT_TYPES` exactly. Hardcoded
 * here (not imported) because the upstream package transitively pulls
 * `node:crypto` via its hash helper, which Next.js client bundling
 * rejects. This file ships pure data; if a new receipt type lands in
 * `@ivaronix/core`, add it here in the same commit. The CLI surface
 * (`apps/studio/src/lib/chain.ts`) imports the live constant directly,
 * so the server-side label always tracks the source of truth.
 */
const RECEIPT_TYPE_LABELS: Record<number, string> = {
  0: 'doc_ask',
  1: 'audit',
  2: 'consensus',
  3: 'burn',
  4: 'memory_access',
  5: 'skill_exec',
  6: 'code_change',
  7: 'passport_update',
  8: 'swarm',
  9: 'subscription_skill_exec',
  10: 'doc_room_create',
  11: 'doc_room_read',
};

export function receiptTypeLabel(code: number | bigint | string): string {
  const n = typeof code === 'bigint' ? Number(code) : Number(code);
  return RECEIPT_TYPE_LABELS[n] ?? `type_${n}`;
}
