/**
 * FINAL_BUILD_PLAN.md Block C · payment-confirmed pipeline run.
 *
 * Stage 2 of the 402-style payment flow (Stage 1 = /api/run/estimate).
 *
 *   POST /api/run/confirm
 *     body: { skillId, contentText, question, txHash, draftReceiptRoot,
 *             payer, bucketSeconds, ...(same run inputs as /api/run) }
 *     ↓ server re-verifies the payment tx with 5 checks (FINAL_BUILD_PLAN.md D-4):
 *         1. tx exists at txHash on the configured chain
 *         2. tx.to === paymentContract (KNOWN_PAYMENT_CONTRACTS gated)
 *         3. tx.from === payer (claimed payer matches actual sender)
 *         4. tx.value === amount (paidOg)
 *         5. decoded SkillRunPaid event's receiptRoot matches draftReceiptRoot
 *     ↓ all 5 pass → runPipeline(input) → receipt anchored with billing.payment
 *     ↓ any fail → 4XX with specific error message (5 distinct error codes)
 *
 * Refund queue: if inference fails AFTER the 5-check passes, the operator
 * receives an alert via the `/api/admin/refund-queue` endpoint to manually
 * trigger refundFailedRun on chain (the 24h timelock per D-15 still applies).
 *
 * Error states surfaced to the client (each has its own status + message):
 *   404 PAYMENT_TX_NOT_FOUND       — txHash doesn't exist on chain
 *   422 PAYMENT_TO_MISMATCH        — tx.to is not our SkillRunPayment
 *   422 PAYMENT_FROM_MISMATCH      — tx.from is not the claimed payer
 *   422 PAYMENT_VALUE_MISMATCH     — tx.value != amount
 *   422 PAYMENT_RECEIPT_ROOT_MISMATCH — event's receiptRoot != draftReceiptRoot
 *   500 PIPELINE_FAILED_POST_PAYMENT — inference failed; refund queued
 */
import { jsonSafe } from '@/lib/bigint-json';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runPipeline, createCaptureLogger } from '@ivaronix/runtime';
import { JsonRpcProvider, Interface } from 'ethers';
import { ensureEnv } from '@/lib/boot-env';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';
import { readSession, SESSION_COOKIE_NAME } from '@/lib/siwe-session';
import { sanitizeErrorMessage } from '@/lib/error-sanitize';
import { getStudioDeployedAddress as getDeployedAddress } from '@/lib/deployments-bundle';
import { KNOWN_PAYMENT_CONTRACTS, type Network } from '@ivaronix/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 300s ceiling so the post-payment inference step (consensus call to the
// 0G Router) doesn't get killed by the Vercel function timer. P5 auto run
// caught this — payment landed on chain, then runPipeline hit the 60s
// cap and the user saw PIPELINE_FAILED_POST_PAYMENT with no detail.
// Vercel free plan caps this at 60s; Pro/Enterprise honors the full 300s.
export const maxDuration = 300;

const ConfirmBodySchema = z.object({
  skillId: z.string().min(1).max(80),
  question: z.string().min(1).max(4_000),
  contentText: z.string().max(2 * 1024 * 1024),
  tier: z.enum(['quick', 'standard', 'high-stakes', 'audit']).optional(),
  policy: z.enum(['unanimous', 'majority', 'first-objection', 'weighted']).optional(),
  burn: z.boolean().optional(),
  userWallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  draftReceiptRoot: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  amount: z.string().regex(/^[0-9]+$/),
  paymentContract: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  payer: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  creator: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  creatorBps: z.number().int().min(5000).max(9500),
  treasuryBps: z.number().int().min(500).max(5000),
});

const SKILL_RUN_PAID_EVENT_ABI = [
  'event SkillRunPaid(bytes32 indexed receiptRoot, address indexed payer, address indexed creator, uint256 amount, uint256 creatorShare, uint256 treasuryShare, uint16 creatorBps, uint16 treasuryBps, uint64 timestamp)',
];

interface PaymentVerifyResult {
  pass: boolean;
  code?: string;
  detail?: string;
}

async function verifyPaymentTx(input: {
  txHash: string;
  paymentContract: string;
  expectedPayer: string;
  expectedAmount: string;
  expectedReceiptRoot: string;
  network: Network;
}): Promise<PaymentVerifyResult> {
  // Sub-check 0: paymentContract must be a known SkillRunPayment.
  const known = KNOWN_PAYMENT_CONTRACTS[input.network];
  if (!known.has(input.paymentContract.toLowerCase())) {
    return {
      pass: false,
      code: 'PAYMENT_CONTRACT_UNKNOWN',
      detail: `paymentContract ${input.paymentContract} not in KNOWN_PAYMENT_CONTRACTS for ${input.network}`,
    };
  }

  const rpcUrl = process.env.IVARONIX_RPC_URL ?? (input.network === 'mainnet' ? 'https://evmrpc.0g.ai' : 'https://evmrpc-testnet.0g.ai');
  const chainId = input.network === 'mainnet' ? 16661 : 16602;
  const provider = new JsonRpcProvider(rpcUrl, { chainId, name: input.network });

  // Sub-check 1: tx exists.
  const tx = await provider.getTransaction(input.txHash);
  if (!tx) {
    return {
      pass: false,
      code: 'PAYMENT_TX_NOT_FOUND',
      detail: `tx ${input.txHash} not found on ${input.network}`,
    };
  }

  // Sub-check 2: tx.to === paymentContract
  if (!tx.to || tx.to.toLowerCase() !== input.paymentContract.toLowerCase()) {
    return {
      pass: false,
      code: 'PAYMENT_TO_MISMATCH',
      detail: `tx.to ${tx.to} != paymentContract ${input.paymentContract}`,
    };
  }

  // Sub-check 3: tx.from === payer
  if (!tx.from || tx.from.toLowerCase() !== input.expectedPayer.toLowerCase()) {
    return {
      pass: false,
      code: 'PAYMENT_FROM_MISMATCH',
      detail: `tx.from ${tx.from} != claimed payer ${input.expectedPayer}`,
    };
  }

  // Sub-check 4: tx.value === amount
  if (tx.value.toString() !== input.expectedAmount) {
    return {
      pass: false,
      code: 'PAYMENT_VALUE_MISMATCH',
      detail: `tx.value ${tx.value.toString()} != amount ${input.expectedAmount}`,
    };
  }

  // Sub-check 5: decoded SkillRunPaid event's receiptRoot matches draftReceiptRoot.
  const txReceipt = await provider.getTransactionReceipt(input.txHash);
  if (!txReceipt) {
    return {
      pass: false,
      code: 'PAYMENT_TX_RECEIPT_NOT_FOUND',
      detail: 'tx receipt not yet indexed; retry in a moment',
    };
  }
  const iface = new Interface(SKILL_RUN_PAID_EVENT_ABI);
  const fragment = iface.getEvent('SkillRunPaid');
  if (!fragment) {
    return { pass: false, code: 'INTERNAL_EVENT_LOOKUP', detail: 'event fragment lookup failed' };
  }
  const topic = fragment.topicHash;
  const log = txReceipt.logs.find(
    (l) => l.address.toLowerCase() === input.paymentContract.toLowerCase() && l.topics[0] === topic,
  );
  if (!log) {
    return {
      pass: false,
      code: 'PAYMENT_NO_EVENT',
      detail: `no SkillRunPaid event in tx ${input.txHash} from ${input.paymentContract}`,
    };
  }
  const decoded = iface.decodeEventLog('SkillRunPaid', log.data, log.topics);
  const eventReceiptRoot = (decoded.receiptRoot as string).toLowerCase();
  if (eventReceiptRoot !== input.expectedReceiptRoot.toLowerCase()) {
    return {
      pass: false,
      code: 'PAYMENT_RECEIPT_ROOT_MISMATCH',
      detail: `event receiptRoot ${eventReceiptRoot} != draftReceiptRoot ${input.expectedReceiptRoot}`,
    };
  }

  return { pass: true };
}

export async function POST(req: Request) {
  await ensureEnv();

  // Per-IP rate limit.
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
  const parsed = ConfirmBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid body',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // SIWE session must match claimed payer.
  if (body.userWallet) {
    const sessionCookie = req.headers.get('cookie')?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
    const session = readSession(sessionCookie);
    if (!session) {
      return NextResponse.json({ error: 'SIWE session required for paid run' }, { status: 401 });
    }
    if (session.wallet !== body.userWallet.toLowerCase()) {
      return NextResponse.json(
        { error: `session wallet ${session.wallet} != userWallet ${body.userWallet}` },
        { status: 403 },
      );
    }
    const walletLimit = checkRateLimit('wallet', body.userWallet.toLowerCase());
    if (!walletLimit.ok) {
      return NextResponse.json(
        { error: `rate limit exceeded · wallet · retry after ${Math.ceil((walletLimit.resetMs - Date.now()) / 1000)}s` },
        { status: 429, headers: rateLimitHeaders(walletLimit) },
      );
    }
  }

  const network = ((process.env.IVARONIX_NETWORK ?? 'testnet') as Network);

  // Verify the 5-check payment binding BEFORE running inference.
  const verifyResult = await verifyPaymentTx({
    txHash: body.txHash,
    paymentContract: body.paymentContract,
    expectedPayer: body.payer,
    expectedAmount: body.amount,
    expectedReceiptRoot: body.draftReceiptRoot,
    network,
  });

  if (!verifyResult.pass) {
    return NextResponse.json(
      {
        error: 'payment verification failed',
        code: verifyResult.code,
        detail: verifyResult.detail,
      },
      { status: verifyResult.code === 'PAYMENT_TX_NOT_FOUND' ? 404 : 422 },
    );
  }

  // 5 checks pass — proceed to run the pipeline.
  const { logger, entries } = createCaptureLogger();
  // Vercel-tmp routing — read-only fs except /tmp on serverless.
  const receiptOutDir = process.env.VERCEL ? '/tmp/.ivaronix/receipts/anchored' : undefined;
  // Hex → slug reverse lookup. /marketplace/<hex> routes pass the
  // already-hashed skillId; runPipeline's findSkill expects a slug to
  // resolve SKILL.md on disk. Centralised in lib/first-party-skills.ts
  // so the slug set stays in sync across the 4 consumer surfaces
  // (estimate, confirm, /skill/<hex>, home page first-party filter).
  const { resolveSkillSlug } = await import('@/lib/first-party-skills');
  const skillIdForPipeline = await resolveSkillSlug(body.skillId);
  try {
    const result = await runPipeline({
      skillId: skillIdForPipeline,
      context: body.contentText,
      userPrompt: body.question,
      tier: body.tier,
      ...(body.policy ? { policy: body.policy } : {}),
      ...(receiptOutDir ? { outDir: receiptOutDir } : {}),
      receipt: true,
      burn: !!body.burn,
      receiptType: body.burn ? 'burn' : 'doc_ask',
      logger,
      delegatedOwnerWallet: body.userWallet?.toLowerCase() as `0x${string}` | undefined,
    });

    // Post-anchor patch: splice billing.payment into the receipt JSON on disk.
    // The receipt's storage.receiptRoot is the canonical hash of the body
    // content (computed before this patch, and unaffected by it because
    // `payment` is in HASH_EXCLUDE — Block B builder.ts change).
    // The draftReceiptRoot in the payment block is the on-chain payment
    // binding nonce that the user signed at paySkillRun time.
    if (result.receiptPath) {
      try {
        const { readFileSync, writeFileSync } = await import('node:fs');
        const receiptObj = JSON.parse(readFileSync(result.receiptPath, 'utf8')) as Record<string, unknown>;
        const billing = receiptObj.billing as Record<string, unknown>;
        billing.payment = {
          txHash: body.txHash,
          paymentContract: body.paymentContract,
          payer: body.payer,
          paidOg: body.amount,
          creatorPaidOg: ((BigInt(body.amount) * BigInt(body.creatorBps)) / 10000n).toString(),
          treasuryPaidOg: ((BigInt(body.amount) * BigInt(body.treasuryBps)) / 10000n).toString(),
          creator: body.creator,
          creatorBps: body.creatorBps,
          treasuryBps: body.treasuryBps,
          paidAt: Math.floor(Date.now() / 1000),
          subsidised: false,
          refunded: false,
          draftReceiptRoot: body.draftReceiptRoot,
        };
        writeFileSync(result.receiptPath, JSON.stringify(receiptObj, null, 2));
      } catch (patchErr) {
        console.warn('[api/run/confirm] failed to patch payment onto receipt JSON:', patchErr);
      }
    }

    return NextResponse.json(jsonSafe({
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
      teeRouterVerified: result.teeRouterVerified,
      storage: { evidenceRoot: result.storageEvidenceRoot ?? null },
      payment: {
        txHash: body.txHash,
        paymentContract: body.paymentContract,
        paidOg: body.amount,
        creator: body.creator,
        creatorBps: body.creatorBps,
        treasuryBps: body.treasuryBps,
      },
      logs: entries,
    }));
  } catch (err) {
    console.error('[api/run/confirm] pipeline error AFTER payment:', err);
    // CRITICAL: refund queue. Operator must manually call refundFailedRun
    // after 24h timelock if the inference failed post-payment.
    // v1 logs to stderr; v1.1 writes to a queue file the admin path drains.
    return NextResponse.json(
      {
        ok: false,
        code: 'PIPELINE_FAILED_POST_PAYMENT',
        error: sanitizeErrorMessage(err),
        refundQueued: true,
        txHash: body.txHash,
        message: 'Payment was confirmed but inference failed. A refund can be claimed after 24h via /api/admin/refund-queue.',
        logs: entries,
      },
      { status: 500 },
    );
  }
}
