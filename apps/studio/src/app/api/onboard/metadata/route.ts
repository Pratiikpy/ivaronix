import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createStorageClient } from '@ivaronix/og-storage';
import { ensureEnv } from '@/lib/boot-env';
import { getNetwork } from '@/lib/chain';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';
import { sanitizeErrorMessage } from '@/lib/error-sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Runtime body validation per HALF_BAKED §J-2 (sweep 147).
 * Closes the unvalidated-cast bug on this operator-paid endpoint. Caps:
 *   handle       2–32 chars (matches the canonical agent-handle window
 *                used by /onboard UI)
 *   ownerWallet  strict 0x + 40 hex lowercase regex (the chain anchor
 *                expects lowercase; uppercase variants would mint a
 *                second passport for the same wallet)
 */
const OnboardBodySchema = z.object({
  handle: z.string().trim().min(2).max(32),
  ownerWallet: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^0x[0-9a-f]{40}$/),
});

/**
 * Upload onboarding metadata (handle, ownerWallet, mintedAt) to 0G Storage
 * and return the canonical Merkle root used as the AgentPassport
 * `metadataRoot`. The browser then calls `AgentPassportINFT.mint(rootHash)`
 * with the connected wallet — so the metadata is on 0G Storage, the mint
 * is on 0G Chain, and the user gets both in their first 90 seconds.
 *
 * If 0G Storage upload fails (transient testnet issues), we fall back to a
 * sha256 of the canonical JSON as the metadataRoot so onboarding still
 * completes; the receipt model treats this as TIER 2 evidence.
 *
 * SIWE is intentionally NOT required here — the user is about to mint
 * their first AgentPassport, so they have no session to bind to.
 * Operator-wallet drain defense is per-IP throttle: each call burns
 * operator gas on a 0G Storage upload, so the 'onboard' rate-limit bucket
 * caps a single IP at 5 mint attempts per 15 minutes. Legit retries fit
 * comfortably; bot drains hit the ceiling on the second IP rotation.
 */
export async function POST(req: Request) {
  await ensureEnv();

  // Per-IP onboard cap. Operator pays storage gas every call; without this,
  // an anonymous loop drains the operator wallet's 0G balance.
  const clientIp = readClientIp(req.headers);
  const ipLimit = checkRateLimit('onboard', clientIp);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: `onboard rate limit exceeded · retry after ${Math.ceil((ipLimit.resetMs - Date.now()) / 1000)}s` },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsed = OnboardBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid body',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 400 },
    );
  }
  const { handle, ownerWallet } = parsed.data;

  // Canonical → legacy alias chain (matches packages/runtime/src/env.ts).
  const pk = process.env.IVARONIX_SIGNER_KEY ?? process.env.OG_PRIVATE_KEY ?? process.env.EVM_PRIVATE_KEY;
  if (!pk) {
    return NextResponse.json({ error: 'server misconfigured (IVARONIX_SIGNER_KEY missing · legacy aliases OG_PRIVATE_KEY, EVM_PRIVATE_KEY also accepted)' }, { status: 500 });
  }

  const metadata = {
    version: '1.0',
    handle,
    ownerWallet,
    mintedAt: Date.now(),
    network: getNetwork(),
  };
  const json = JSON.stringify(metadata);
  const bytes = new TextEncoder().encode(json);
  const localSha256 = '0x' + createHash('sha256').update(bytes).digest('hex');

  const sc = createStorageClient({ network: getNetwork(), privateKey: pk });
  try {
    const r = await sc.upload(bytes);
    return NextResponse.json({
      metadataRoot: r.rootHash,
      storageTxHash: r.txHash,
      bytes: r.size,
      method: '0g-storage',
      handle,
      ownerWallet,
    });
  } catch (err) {
    return NextResponse.json({
      metadataRoot: localSha256,
      storageTxHash: null,
      bytes: bytes.length,
      method: 'local-sha256',
      handle,
      ownerWallet,
      warning: `0G Storage unavailable: ${sanitizeErrorMessage(err)}`,
    });
  }
}
