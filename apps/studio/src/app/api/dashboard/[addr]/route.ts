import { NextResponse } from 'next/server';
import { JsonRpcProvider, formatEther } from 'ethers';
import { getPassportClient, getReceiptRegistry, getNetwork } from '@/lib/chain';
import { NETWORKS } from '@ivaronix/core';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/<address> — returns the canonical dashboard payload
 * for an address: passport state + last 5 receipts + native OG balance.
 *
 * Read-only by design — every call comes from a connected wallet via the
 * client component, so we don't trust the address blindly; we just echo
 * back chain state that's already public.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ addr: string }> },
): Promise<NextResponse> {
  const { addr } = await params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  const network = getNetwork();
  const rpcUrl = NETWORKS[network].rpcUrl;
  const provider = new JsonRpcProvider(rpcUrl);

  const passportClient = getPassportClient();
  const registry = getReceiptRegistry();

  const [passport, balanceWei, recent] = await Promise.all([
    passportClient ? passportClient.getPassportByWallet(addr as `0x${string}`).catch(() => null) : null,
    provider.getBalance(addr).catch(() => 0n),
    registry ? registry.findByAgent(addr as `0x${string}`, 5).catch(() => []) : [],
  ]);

  return NextResponse.json({
    network,
    address: addr,
    balanceOg: formatEther(balanceWei),
    passport: passport
      ? {
          tokenId: passport.tokenId.toString(),
          metadataRoot: passport.metadataRoot,
          memoryRoot: passport.memoryRoot,
          trustScore: passport.trustScore.toString(),
          receiptCount: passport.receiptCount.toString(),
          violationCount: passport.violationCount.toString(),
          mintedAt: Number(passport.mintedAt),
          lastEvolutionAt: Number(passport.lastEvolutionAt),
        }
      : null,
    recentReceipts: recent.map((r) => ({
      id: r.id.toString(),
      receiptRoot: r.receiptRoot,
      receiptType: r.receiptType,
      timestamp: Number(r.timestamp),
    })),
  });
}
