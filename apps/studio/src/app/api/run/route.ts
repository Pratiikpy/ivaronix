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
}

/**
 * Run a skill against an uploaded text payload. Returns the consensus output,
 * captured logs, and (when requested) anchored receipt metadata.
 *
 * The wallet that signs receipts is the server's EVM_PRIVATE_KEY — the
 * connected browser wallet is informational at this layer (Day 17 wires
 * SIWE so the browser-attested user becomes the receipt issuer).
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
