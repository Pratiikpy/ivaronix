import { NextResponse } from 'next/server';
import { runPipeline, createCaptureLogger } from '@ivaronix/runtime';
import type { ConsensusTier } from '@ivaronix/core';
import { ensureEnv } from '@/lib/boot-env';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';
import { readSession, SESSION_COOKIE_NAME } from '@/lib/siwe-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: cap at 60s for hobby; 300s for pro

interface RunBody {
  skillId: string;
  question: string;
  contentText: string;
  tier?: ConsensusTier;
  /**
   * Aggregation-policy override per planning-003 §A.4.4 (zer0Gig
   * Efficiency Game). When unset, the skill manifest's
   * `og.consensus.policy` default applies. Values must match the
   * `ConsensusPolicy` enum exactly: `unanimous` / `majority` /
   * `first-objection` / `weighted`.
   */
  policy?: 'unanimous' | 'majority' | 'first-objection' | 'weighted';
  receipt?: boolean;
  burn?: boolean;
  /**
   * W9 · Connected user wallet (lowercase 0x…40-hex). When the client
   * is connected via wagmi, the browser sends the wallet address along
   * with the run request. The receipt body's `agent.ownerWallet` is set
   * to this address (instead of the operator's), AND a new
   * `signedBy: 'operator-on-behalf-of-user'` field records the trust
   * model honestly: the user authorised but did not sign, the operator
   * anchored on their behalf. End-state is full SIWE (browser signs
   * the receipt body before anchoring); queued in USER_TODO §B-V2.
   */
  userWallet?: string;
}

/**
 * Run a skill against an uploaded text payload. Returns the consensus output,
 * captured logs, and (when requested) anchored receipt metadata.
 *
 * Receipt-signing model (W9):
 *  - When `body.userWallet` is provided AND it's a valid 0x…40-hex address,
 *    the receipt's `agent.ownerWallet` is set to the user's wallet and
 *    `agent.signedBy = 'operator-on-behalf-of-user'`. The operator still
 *    signs the receipt body (the browser cannot sign server-side bytes),
 *    but the chain anchor records the user as the owning agent.
 *  - When unset OR malformed, the receipt's `agent.ownerWallet` is the
 *    operator's wallet (legacy path) with `agent.signedBy = 'operator'`.
 *
 * Either way, `/r/[id]` renders a clear chip indicating the trust tier.
 * The end-state is full SIWE: the browser signs the receipt body
 * directly and `signedBy = 'user-direct'` for fully self-sovereign
 * provenance. Queued in USER_TODO §B-V2.
 */
export async function POST(req: Request) {
  await ensureEnv();

  // K-8: per-IP rate limit always applies. Prevents anonymous wallet drain
  // by bounding /api/run to ~10 requests per minute per IP.
  const clientIp = readClientIp(req.headers);
  const ipLimit = checkRateLimit('ip', clientIp);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: `rate limit exceeded · ip · retry after ${Math.ceil((ipLimit.resetMs - Date.now()) / 1000)}s` },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }

  let body: RunBody;
  try {
    body = (await req.json()) as RunBody;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  if (!body.skillId || !body.question || typeof body.contentText !== 'string') {
    return NextResponse.json(
      { error: 'skillId, question, contentText are required' },
      { status: 400 },
    );
  }

  // K-8: when the body claims a userWallet, require an active SIWE session
  // matching that wallet. Without this gate the operator's key would anchor
  // receipts under arbitrary user identities. Anonymous receipts (no
  // userWallet claim) are allowed but capped by the per-IP bucket above.
  const sessionCookie = req.headers.get('cookie')?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
  const session = readSession(sessionCookie);

  let userWallet: `0x${string}` | undefined;
  if (body.userWallet) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(body.userWallet)) {
      return NextResponse.json({ error: 'malformed userWallet' }, { status: 400 });
    }
    const claimed = body.userWallet.toLowerCase() as `0x${string}`;
    if (!session) {
      return NextResponse.json(
        { error: 'userWallet claim requires active SIWE session — POST /api/auth/siwe/verify first' },
        { status: 401 },
      );
    }
    if (session.wallet !== claimed) {
      return NextResponse.json(
        { error: `session wallet ${session.wallet} does not match claimed userWallet ${claimed}` },
        { status: 403 },
      );
    }
    userWallet = claimed;

    // Per-wallet rate limit — additive on top of per-IP. An authenticated
    // wallet pays both buckets but gets a higher per-hour ceiling.
    const walletLimit = checkRateLimit('wallet', userWallet);
    if (!walletLimit.ok) {
      return NextResponse.json(
        { error: `rate limit exceeded · wallet · retry after ${Math.ceil((walletLimit.resetMs - Date.now()) / 1000)}s` },
        { status: 429, headers: rateLimitHeaders(walletLimit) },
      );
    }
  }

  const { logger, entries } = createCaptureLogger();
  try {
    const result = await runPipeline({
      skillId: body.skillId,
      context: body.contentText,
      userPrompt: body.question,
      tier: body.tier,
      // Policy override per planning-003 §A.4.4. Threaded into
      // runConsensus → applyPolicy so the receipt's
      // `execution.consensus.policyApplied` reflects what the user
      // chose (or the skill default when unset).
      ...(body.policy ? { policy: body.policy } : {}),
      receipt: !!body.receipt,
      burn: !!body.burn,
      receiptType: 'doc_ask',
      logger,
      ...(userWallet ? { delegatedOwnerWallet: userWallet } : {}),
    });

    return NextResponse.json({
      ok: true,
      finalText: result.finalText,
      consensusMs: result.consensusMs,
      inputTokens: result.consensus.billing.totalInputTokens,
      outputTokens: result.consensus.billing.totalOutputTokens,
      costOg: result.consensus.billing.estimatedCostOg,
      convergenceScore: result.consensus.convergence.score ?? null,
      receiptId: result.receiptId,
      receiptTxHash: result.receiptTxHash,
      receiptOnchainId: result.receiptOnchainId !== null ? result.receiptOnchainId.toString() : null,
      scan: result.scan
        ? {
            matches: result.scan.matches,
            registered: result.scan.registered,
            revoked: result.scan.revoked,
            creator: result.scan.creator,
            onchainManifestHash: result.scan.onchainManifestHash,
          }
        : null,
      skill: { id: result.skill.id, version: result.skill.manifest.version },
      // Storage evidence root (S-3 + future H-3): populated when /api/run
      // uploads the encrypted blob to 0G Storage. Today the Studio path does
      // not upload — RunPanel correctly leaves the Storage light pending when
      // this is null. H-3 will wire real upload and populate this with the
      // 0G Storage Merkle root.
      storage: { evidenceRoot: result.storageEvidenceRoot ?? null },
      logs: entries,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: (err as Error).message,
        logs: entries,
      },
      { status: 500 },
    );
  }
}
