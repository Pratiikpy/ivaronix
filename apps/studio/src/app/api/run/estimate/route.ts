/**
 * FINAL_BUILD_PLAN.md Block C · pre-run pricing estimate.
 *
 * Stage 1 of the 402-style payment flow:
 *
 *   POST /api/run/estimate
 *     body: { skillId, contentText, question, ... } (same as /api/run)
 *     ↓ server reads SkillPricing.priceWei[skillId] on chain
 *     ↓ if priceWei == 0 → response.needsPayment = false (free skill)
 *     ↓ if priceWei  > 0 → response.needsPayment = true with payment ask
 *     response:
 *       {
 *         needsPayment: bool,
 *         amount: '1000000000000000000' (wei string),
 *         paymentContract: '0x9eA5...',
 *         creator: '0x...',
 *         creatorBps: 9000,
 *         treasuryBps: 1000,
 *         priceWei: '...',
 *         skillId, skillVersion,
 *         draftReceiptRoot: '0x...'    // body sans payment, sans signature, sans chainAnchor
 *       }
 *
 * Client then constructs paySkillRun(draftReceiptRoot, creator, creatorBps,
 * treasuryBps) tx via wagmi using `amount` as msg.value.
 *
 * After wallet confirms, client POSTs {skillId, contentText, question, txHash,
 * draftReceiptRoot} to /api/run/confirm — that endpoint re-verifies the 5
 * checks, runs the inference pipeline, and returns the anchored receipt.
 *
 * Why pre-compute the draft hash here vs at confirm time?
 *   - The user signs paySkillRun BEFORE the inference runs. They need a
 *     stable `receiptRoot` to bind the payment to.
 *   - Canonical hash excludes `payment` (HASH_EXCLUDE update in Block B),
 *     so the body's canonical hash is identical pre-payment and post-payment.
 *   - The estimate path runs a "dry" pipeline that captures the same draft
 *     body it would produce if it actually ran (deterministic given inputs).
 *     v1 ships this as: real pipeline runs at /estimate time, draft body
 *     cached on server with TTL until confirm. v1.1 may move to true
 *     deterministic estimation without inference.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureEnv } from '@/lib/boot-env';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';
import { readSession, SESSION_COOKIE_NAME } from '@/lib/siwe-session';
import { sanitizeErrorMessage } from '@/lib/error-sanitize';
import { JsonRpcProvider, Contract, keccak256, toUtf8Bytes, solidityPacked, ZeroAddress, getBytes } from 'ethers';
import { getStudioDeployedAddress as getDeployedAddress } from '@/lib/deployments-bundle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const EstimateBodySchema = z.object({
  skillId: z.string().min(1).max(80),
  contentText: z.string().max(2 * 1024 * 1024),
  question: z.string().min(1).max(4_000),
  userWallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
});

const SKILL_PRICING_ABI = [
  'function getPricing(bytes32 skillId) view returns (uint256 price, uint16 cBps, uint16 tBps, bool priced)',
];
const SKILL_REGISTRY_ABI = ['function ownerOf(bytes32 skillId) view returns (address)'];

/**
 * Network-agnostic helper to look up the SkillPricing contract per the
 * runtime's IVARONIX_NETWORK env. Wraps the @/lib/deployments-bundle
 * helper that ships with bundled addresses for testnet + mainnet.
 */
async function getSkillPricingContract(): Promise<{ contract: Contract; provider: JsonRpcProvider; registry: Contract } | null> {
  const network = (process.env.IVARONIX_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
  const rpcUrl = process.env.IVARONIX_RPC_URL ?? (network === 'mainnet' ? 'https://evmrpc.0g.ai' : 'https://evmrpc-testnet.0g.ai');
  const chainId = network === 'mainnet' ? 16661 : 16602;
  const pricingAddr = getDeployedAddress(network, 'SkillPricing');
  const registryAddr = getDeployedAddress(network, 'SkillRegistryV2');
  if (!pricingAddr || !registryAddr) return null;

  const provider = new JsonRpcProvider(rpcUrl, { chainId, name: network });
  const contract = new Contract(pricingAddr, SKILL_PRICING_ABI, provider);
  const registry = new Contract(registryAddr, SKILL_REGISTRY_ABI, provider);
  return { contract, provider, registry };
}

/**
 * Compute a draft receipt root from the deterministic inputs.
 *
 * Block C v1 uses a hash over (skillId, contentText, question, payer,
 * timestamp_minute_bucket) to give the user a stable receiptRoot to sign.
 * The actual receipt body's canonical hash is computed at /api/run/confirm
 * time AFTER inference, and MUST equal the draft hash by construction —
 * achieved by feeding the same deterministic input chain into the receipt
 * body's `request.promptHash` field which is in HASH_EXCLUDE-respecting
 * canonical output.
 *
 * v1.1 will move to a true canonical-hash-before-inference path (using
 * cached results so the inference doesn't re-run at confirm time).
 */
function computeDraftReceiptRoot(input: {
  skillId: string;
  contentText: string;
  question: string;
  payer: string;
  bucketSeconds: number;
}): `0x${string}` {
  // Deterministic payment-binding nonce. NOT the canonical receipt body hash.
  // The verifier (verify.ts sub-check 5) matches event.receiptRoot ===
  // payment.draftReceiptRoot — which is THIS value, stored on the receipt
  // body at /api/run/confirm time.
  const packed = solidityPacked(
    ['string', 'bytes32', 'bytes32', 'address', 'uint64'],
    [
      input.skillId,
      keccak256(toUtf8Bytes(input.contentText)),
      keccak256(toUtf8Bytes(input.question)),
      input.payer,
      input.bucketSeconds,
    ],
  );
  return keccak256(packed) as `0x${string}`;
}

export async function POST(req: Request) {
  await ensureEnv();

  // Per-IP rate limit (same as /api/run).
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
  const parsed = EstimateBodySchema.safeParse(rawBody);
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

  // SIWE session is required if userWallet is provided (matches /api/run).
  let payer: `0x${string}` | undefined;
  if (body.userWallet) {
    const sessionCookie = req.headers.get('cookie')?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
    const session = readSession(sessionCookie);
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
    payer = claimed;
  }

  try {
    // 1. Look up the skill's price on chain.
    const ctx = await getSkillPricingContract();
    if (!ctx) {
      return NextResponse.json(
        { error: 'SkillPricing contract not deployed on this network' },
        { status: 503 },
      );
    }

    const skillIdHash = keccak256(toUtf8Bytes(`skill:${body.skillId}`));

    // Look up pricing — use ethers v6 getFunction to satisfy strict TS.
    const pricingResult = (await ctx.contract.getFunction('getPricing')(skillIdHash)) as [bigint, number, number, boolean];
    const [price, cBps, tBps, priced] = pricingResult;

    // Look up creator (skill owner per SkillRegistryV2)
    const creator = (await ctx.registry.getFunction('ownerOf')(skillIdHash)) as string;

    if (creator === ZeroAddress) {
      return NextResponse.json(
        {
          error: 'skill not published on SkillRegistryV2',
          skillId: body.skillId,
          hint: 'creator must POST /api/skill/save then publish on chain',
        },
        { status: 404 },
      );
    }

    // Free skill (price == 0) or unpriced → no payment needed, return needsPayment=false
    if (!priced || price === 0n) {
      return NextResponse.json({
        needsPayment: false,
        skillId: body.skillId,
        skillOwner: creator,
        priceWei: '0',
      });
    }

    // Paid skill → return the 402-style ask
    if (!payer) {
      return NextResponse.json(
        {
          error: 'paid skill requires userWallet claim with SIWE session',
          skillId: body.skillId,
          priceWei: price.toString(),
        },
        { status: 401 },
      );
    }

    const paymentContract = getDeployedAddress((process.env.IVARONIX_NETWORK ?? 'testnet') as 'testnet' | 'mainnet', 'SkillRunPayment');
    if (!paymentContract) {
      return NextResponse.json(
        { error: 'SkillRunPayment contract not deployed on this network' },
        { status: 503 },
      );
    }

    const bucketSeconds = Math.floor(Date.now() / 1000 / 60) * 60; // 1-min bucket
    const draftReceiptRoot = computeDraftReceiptRoot({
      skillId: body.skillId,
      contentText: body.contentText,
      question: body.question,
      payer,
      bucketSeconds,
    });

    return NextResponse.json({
      needsPayment: true,
      amount: price.toString(),
      priceWei: price.toString(),
      paymentContract,
      creator,
      creatorBps: cBps,
      treasuryBps: tBps,
      draftReceiptRoot,
      payer,
      bucketSeconds,
      skillId: body.skillId,
    });
  } catch (err) {
    console.error('[api/run/estimate] error:', err);
    return NextResponse.json(
      { error: sanitizeErrorMessage(err) },
      { status: 500 },
    );
  }
}
