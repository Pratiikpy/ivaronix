import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runPipeline, createCaptureLogger } from '@ivaronix/runtime';
import { ensureEnv } from '@/lib/boot-env';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';
import { readSession, SESSION_COOKIE_NAME } from '@/lib/siwe-session';
import { sanitizeErrorMessage } from '@/lib/error-sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: cap at 60s for hobby; 300s for pro

/**
 * Runtime-validated request body. Closes HALF_BAKED §J-2 — pre-sweep-145
 * the body was a TypeScript `as RunBody` cast with no runtime check,
 * letting attackers post `{ contentText: '<10MB string>' }` past the
 * rate-limit gate straight into runPipeline.
 *
 * Size caps are conservative for testnet operator-paid runs:
 *   skillId         ≤ 80 chars (matches @ivaronix/skills manifest)
 *   question        ≤ 4 KB    (the user prompt; 4 KB ≈ a long paragraph)
 *   contentText     ≤ 2 MB    (the document content; covers a 400-page
 *                              contract in plaintext)
 *   userWallet      0x + 40 hex (regex)
 *
 * W9 trust model: when userWallet is set, the receipt records
 * `agent.signedBy = 'operator-on-behalf-of-user'`; SIWE session must
 * match the claimed wallet or the request is rejected.
 */
const RunBodySchema = z.object({
  skillId: z.string().min(1).max(80),
  question: z.string().min(1).max(4_000),
  contentText: z.string().max(2 * 1024 * 1024),
  tier: z.enum(['quick', 'standard', 'high-stakes', 'audit']).optional(),
  policy: z.enum(['unanimous', 'majority', 'first-objection', 'weighted']).optional(),
  receipt: z.boolean().optional(),
  burn: z.boolean().optional(),
  userWallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
});
type RunBody = z.infer<typeof RunBodySchema>;

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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsed = RunBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid body',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 400 },
    );
  }
  const body: RunBody = parsed.data;

  // K-8: when the body claims a userWallet, require an active SIWE session
  // matching that wallet. Without this gate the operator's key would anchor
  // receipts under arbitrary user identities. Anonymous receipts (no
  // userWallet claim) are allowed but capped by the per-IP bucket above.
  const sessionCookie = req.headers.get('cookie')?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
  const session = readSession(sessionCookie);

  let userWallet: `0x${string}` | undefined;
  if (body.userWallet) {
    // Zod regex above guarantees shape; lowercase-normalize for chain comparison.
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
  // Same Vercel-tmp routing as /api/run/demo — read-only fs except /tmp.
  const receiptOutDir = process.env.VERCEL ? '/tmp/.ivaronix/receipts/anchored' : undefined;
  try {
    const result = await runPipeline({
      skillId: body.skillId,
      context: body.contentText,
      userPrompt: body.question,
      tier: body.tier,
      ...(receiptOutDir ? { outDir: receiptOutDir } : {}),
      // Policy override per planning-003 §A.4.4. Threaded into
      // runConsensus → applyPolicy so the receipt's
      // `execution.consensus.policyApplied` reflects what the user
      // chose (or the skill default when unset).
      ...(body.policy ? { policy: body.policy } : {}),
      receipt: !!body.receipt,
      burn: !!body.burn,
      // B-V2-35 slot 3 closure: burn-mode runs anchor as type 'burn'
      // (canonical slot 3). The CLI doc-ask path uses the same logic
      // (apps/cli/src/commands/doc.ts).
      receiptType: body.burn ? 'burn' : 'doc_ask',
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
      // Real TEE attestation aggregate per HALF_BAKED §I-4. RunPanel
      // gates its TEE light on this, NOT on scan.matches (which is a
      // skill-registry hash check, unrelated to TEE).
      teeRouterVerified: result.teeRouterVerified,
      // Storage evidence root. The run pipeline (`anchorReceipt`) uploads the
      // evidence blob to 0G Storage on every anchor — Burn-Mode ciphertext if
      // burn is on, the plaintext context bytes otherwise — and writes the
      // returned Merkle root onto the receipt's `storage.evidenceRoot`. Null
      // here only when the storage indexer was unreachable: the receipt
      // honestly omits the root rather than faking one, and RunPanel leaves
      // the Storage light pending in that case.
      storage: { evidenceRoot: result.storageEvidenceRoot ?? null },
      logs: entries,
    });
  } catch (err) {
    // HALF_BAKED §K-11 closure (sweep 212): sanitize before responding.
    // Full err + stack stays in server logs via console.error; client
    // only sees the high-level class with paths / addresses / env-var
    // names stripped.
    console.error('[api/run] pipeline error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(err),
        logs: entries,
      },
      { status: 500 },
    );
  }
}
