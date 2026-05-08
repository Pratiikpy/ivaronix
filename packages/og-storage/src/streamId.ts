import { keccak256, toUtf8Bytes, getAddress } from 'ethers';

import type { Hex } from './index.js';

/**
 * Deterministic 0G KV stream identifier for an Ivaronix memory store.
 *
 * Pattern lifted from `0G_OpenClaw_Hackathon` (per docs/PLAN_pass76.md S-2)
 * and re-namespaced with `ivaronix:`. Used as the KV stream-ID under which
 * memory snapshot manifests are written, so a wallet's memory is restorable
 * on any machine that has the wallet's address — the stream-ID resolves the
 * same way everywhere.
 *
 * Schema is versioned (`v1`) so a future change to manifest layout can
 * cleanly migrate to `ivaronix:memory:v2:` without breaking v1 readers.
 *
 * Address is normalized to checksum form before lower-casing — invalid
 * addresses throw, so callers can't accidentally derive a different ID from
 * the same wallet via casing or 0x-prefix drift.
 */
export function memoryStreamId(address: string): Hex {
  // Normalize: validates the address shape, then lowercase the canonical form
  // so case variants ("0xAA...", "0xaa...") collapse to one ID per wallet.
  const normalized = getAddress(address).toLowerCase();
  return keccak256(toUtf8Bytes(`ivaronix:memory:v1:${normalized}`)) as Hex;
}

/** Stable namespace prefix — exposed for diagnostics / debug printers. */
export const MEMORY_STREAM_NAMESPACE = 'ivaronix:memory:v1' as const;
