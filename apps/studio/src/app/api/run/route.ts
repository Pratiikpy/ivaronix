import { NextResponse } from 'next/server';
import { runPipeline, createCaptureLogger } from '@ivaronix/runtime';
import type { ConsensusTier } from '@ivaronix/core';
import { ensureEnv } from '@/lib/boot-env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: cap at 60s for hobby; 300s for pro

interface RunBody {
  skillId: string;
  question: string;
  contentText: string;
  tier?: ConsensusTier;
  receipt?: boolean;
  burn?: boolean;
  /**
   * W9 · Connected user wallet (lowercase 0x…40-hex). When the client
   * is connected via wagmi, the browser sends the wallet address along
   * with the run request. The receipt body's `agent.ownerWallet` is set
   * to this address (instead of the operator's), AND a new
   * `signedBy: 'operator-on-behalf-of-user'` field records the trust
   * model honestly: the user authorised but did not sign, the operator
   * anchored on their behalf. Phase B replaces this with full SIWE
   * (browser signs the receipt body before anchoring).
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
 * Phase B = SIWE: the browser signs the receipt body before anchor and
 * `signedBy = 'user-direct'` for fully self-sovereign provenance.
 */
export async function POST(req: Request) {
  await ensureEnv();
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

  const userWallet = body.userWallet && /^0x[0-9a-fA-F]{40}$/.test(body.userWallet)
    ? (body.userWallet.toLowerCase() as `0x${string}`)
    : undefined;

  const { logger, entries } = createCaptureLogger();
  try {
    const result = await runPipeline({
      skillId: body.skillId,
      context: body.contentText,
      userPrompt: body.question,
      tier: body.tier,
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
