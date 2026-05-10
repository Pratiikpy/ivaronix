import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createStorageClient } from '@ivaronix/og-storage';
import { ensureEnv } from '@/lib/boot-env';
import { getNetwork } from '@/lib/chain';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface OnboardMetadataBody {
  handle: string;
  ownerWallet: string;
}

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

  let body: OnboardMetadataBody;
  try {
    body = (await req.json()) as OnboardMetadataBody;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const handle = (body.handle ?? '').trim();
  const ownerWallet = (body.ownerWallet ?? '').trim().toLowerCase();
  if (!handle || handle.length < 2 || handle.length > 32) {
    return NextResponse.json({ error: 'handle must be 2–32 chars' }, { status: 400 });
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(ownerWallet)) {
    return NextResponse.json({ error: 'ownerWallet must be 0x + 40 hex' }, { status: 400 });
  }

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
      warning: `0G Storage unavailable: ${(err as Error).message.split('\n')[0]}`,
    });
  }
}
