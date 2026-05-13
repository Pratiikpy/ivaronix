/**
 * FINAL_BUILD_PLAN.md Block E · operator-subsidised demo run.
 *
 * Used by /?demo=true and the marketplace "try this skill" path when no
 * user wallet is connected. The demo wallet (server-side DEMO_WALLET_KEY
 * or IVARONIX_SIGNER_KEY fallback) pays for the inference. The resulting
 * receipt carries `billing.payment.subsidised = true` so the UI surfaces
 * "Demo run · operator-subsidised" honestly.
 *
 * Rate-limited per-IP (the demo wallet is a shared resource).
 * Falls back to "demo paused" 503 when the demo wallet is out of funds.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runPipeline, createCaptureLogger } from '@ivaronix/runtime';
import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes, solidityPacked, formatUnits } from 'ethers';
import { ensureEnv } from '@/lib/boot-env';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';
import { sanitizeErrorMessage } from '@/lib/error-sanitize';
import { getStudioDeployedAddress as getDeployedAddress } from '@/lib/deployments-bundle';
import { isDemoModeActive, getDemoSampleDocument, DEMO_SKILL_ID } from '@/lib/demo-mode';
import type { Network } from '@ivaronix/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DemoBodySchema = z.object({
  skillId: z.string().min(1).max(80).optional(),
  contentText: z.string().max(2 * 1024 * 1024).optional(),
  question: z.string().min(1).max(4_000).optional(),
});

const SKILL_PRICING_ABI = [
  'function getPricing(bytes32 skillId) view returns (uint256 price, uint16 cBps, uint16 tBps, bool priced)',
];
const SKILL_REGISTRY_ABI = ['function ownerOf(bytes32 skillId) view returns (address)'];
const SKILL_RUN_PAYMENT_ABI = [
  'function paySkillRun(bytes32 receiptRoot, address creator, uint16 creatorBps, uint16 treasuryBps) payable',
];

export async function POST(req: Request) {
  await ensureEnv();

  // Tighter per-IP rate limit on the demo endpoint (shared subsidy).
  const clientIp = readClientIp(req.headers);
  const ipLimit = checkRateLimit('ip', clientIp);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: `rate limit exceeded · ip · retry after ${Math.ceil((ipLimit.resetMs - Date.now()) / 1000)}s` },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }

  // Out-of-funds gate
  if (!isDemoModeActive()) {
    return NextResponse.json(
      {
        error: 'demo paused — demo wallet out of funds. Connect your own wallet at / to run on your own document.',
        code: 'DEMO_OUT_OF_FUNDS',
      },
      { status: 503 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    rawBody = {};
  }
  const parsed = DemoBodySchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const body = parsed.data;

  const skillId = body.skillId ?? DEMO_SKILL_ID;
  const sample = getDemoSampleDocument();
  const contentText = body.contentText ?? sample.text;
  const question = body.question ?? sample.question;

  const network: Network = (process.env.IVARONIX_NETWORK ?? 'testnet') as Network;
  const rpcUrl = process.env.IVARONIX_RPC_URL ?? (network === 'mainnet' ? 'https://evmrpc.0g.ai' : 'https://evmrpc-testnet.0g.ai');
  const chainId = network === 'mainnet' ? 16661 : 16602;
  const demoKey = process.env.DEMO_WALLET_KEY ?? process.env.IVARONIX_SIGNER_KEY ?? process.env.EVM_PRIVATE_KEY;
  if (!demoKey) {
    return NextResponse.json({ error: 'demo wallet key not configured' }, { status: 503 });
  }

  const provider = new JsonRpcProvider(rpcUrl, { chainId, name: network });
  const demoWallet = new Wallet(demoKey.startsWith('0x') ? demoKey : '0x' + demoKey, provider);

  // 1. Quote the skill
  const pricingAddr = getDeployedAddress(network, 'SkillPricing');
  const registryAddr = getDeployedAddress(network, 'SkillRegistryV2');
  const paymentAddr = getDeployedAddress(network, 'SkillRunPayment');

  const skillIdHash = keccak256(toUtf8Bytes(`skill:${skillId}`));
  const { logger, entries } = createCaptureLogger();

  let paymentBlock: Record<string, unknown> | null = null;

  if (pricingAddr && registryAddr && paymentAddr) {
    try {
      const pricing = new Contract(pricingAddr, SKILL_PRICING_ABI, provider);
      const registry = new Contract(registryAddr, SKILL_REGISTRY_ABI, provider);
      const [price, cBps, tBps, priced] = (await pricing.getFunction('getPricing')(skillIdHash)) as [bigint, number, number, boolean];
      const creator = (await registry.getFunction('ownerOf')(skillIdHash)) as string;

      if (priced && price > 0n && creator !== '0x0000000000000000000000000000000000000000') {
        // 2. Pay via demo wallet
        const bucketSeconds = Math.floor(Date.now() / 1000 / 60) * 60;
        const draftReceiptRoot = keccak256(
          solidityPacked(
            ['string', 'bytes32', 'bytes32', 'address', 'uint64'],
            [skillId, keccak256(toUtf8Bytes(contentText)), keccak256(toUtf8Bytes(question)), demoWallet.address, bucketSeconds],
          ),
        );
        const payment = new Contract(paymentAddr, SKILL_RUN_PAYMENT_ABI, demoWallet);
        const tx = await payment.getFunction('paySkillRun')(
          draftReceiptRoot,
          creator,
          cBps,
          tBps,
          { value: price, gasPrice: 5_000_000_000n },
        );
        await tx.wait(1);

        paymentBlock = {
          txHash: tx.hash,
          paymentContract: paymentAddr,
          payer: demoWallet.address,
          paidOg: price.toString(),
          creatorPaidOg: ((price * BigInt(cBps)) / 10000n).toString(),
          treasuryPaidOg: ((price * BigInt(tBps)) / 10000n).toString(),
          creator,
          creatorBps: cBps,
          treasuryBps: tBps,
          paidAt: Math.floor(Date.now() / 1000),
          subsidised: true,
          refunded: false,
          draftReceiptRoot,
        };
      }
    } catch (err) {
      console.warn('[api/run/demo] skill pricing/payment skipped:', (err as Error).message.split('\n')[0]);
    }
  }

  // 3. Run pipeline + anchor receipt
  // On Vercel the serverless filesystem is read-only except /tmp, so route
  // the receipt write there (the lambda dies after the response and /tmp
  // is wiped, but the receipt is already anchored on-chain by then). Locally
  // the runtime default `.ivaronix/receipts/anchored` works fine. Caught by
  // P2 UI test on 2026-05-13: mkdir <path> ENOENT against process.cwd()-
  // relative path that was the apps/studio/ dir on Vercel.
  const receiptOutDir = process.env.VERCEL
    ? '/tmp/.ivaronix/receipts/anchored'
    : undefined;
  try {
    const result = await runPipeline({
      skillId,
      context: contentText,
      userPrompt: question,
      receipt: true,
      outDir: receiptOutDir,
      logger,
    });

    // 4. Post-anchor patch billing.payment block when payment was made
    if (paymentBlock && result.receiptPath) {
      try {
        const { readFileSync, writeFileSync } = await import('node:fs');
        const receiptObj = JSON.parse(readFileSync(result.receiptPath, 'utf8')) as Record<string, unknown>;
        const billing = receiptObj.billing as Record<string, unknown>;
        billing.payment = paymentBlock;
        writeFileSync(result.receiptPath, JSON.stringify(receiptObj, null, 2));
      } catch (err) {
        console.warn('[api/run/demo] failed to patch payment:', (err as Error).message);
      }
    }

    // Refresh balance + check if demo wallet is running low
    const balanceWei = await provider.getBalance(demoWallet.address).catch(() => null);
    const balanceOg = balanceWei != null ? parseFloat(formatUnits(balanceWei, 18)) : null;

    return NextResponse.json({
      ok: true,
      subsidised: true,
      demoWallet: demoWallet.address,
      demoWalletBalanceOg: balanceOg?.toFixed(6),
      finalText: result.finalText,
      receiptId: result.receiptId,
      receiptTxHash: result.receiptTxHash,
      receiptOnchainId: result.receiptOnchainId !== null ? result.receiptOnchainId.toString() : null,
      storage: { evidenceRoot: result.storageEvidenceRoot ?? null },
      payment: paymentBlock,
      logs: entries,
    });
  } catch (err) {
    console.error('[api/run/demo] pipeline error:', err);
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
