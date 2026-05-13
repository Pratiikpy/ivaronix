/**
 * FINAL_BUILD_PLAN.md Block F · D-7 · chain-grant cross-check middleware.
 *
 * Every memory READ from the operator-hosted KV server must be gated by
 * CapabilityRegistryV2.hasGrant() on chain. The chain is the source of
 * truth for who can read what; the HTTP backend is a cache + access layer.
 *
 * When the user revokes a grant on chain, the next read fails — the
 * HTTP backend's local index is downstream of the chain state, not
 * authoritative.
 *
 *   reader  → wallet that wants to read memoryRootId
 *   grant   → CapabilityRegistryV2.hasGrant(reader, memoryRootId)
 *
 * Returns:
 *   { allowed: true }                   when chain confirms the grant
 *   { allowed: false, reason: '...'}    when grant is missing or revoked
 *
 * Cached for 1 block (~3s on Galileo) to avoid hammering RPC; revocations
 * become read failures within ~1 block.
 */
import { JsonRpcProvider, Contract } from 'ethers';
import { getStudioDeployedAddress as getDeployedAddress } from './deployments-bundle';
import type { Network } from '@ivaronix/core';

const CAPABILITY_REGISTRY_ABI = [
  'function hasGrant(address grantee, bytes32 capabilityId) view returns (bool)',
];

interface CacheEntry {
  result: boolean;
  cachedAt: number;
}

const CACHE_TTL_MS = 3_000; // ~1 Galileo block
const cache = new Map<string, CacheEntry>();

export interface GrantCheckResult {
  allowed: boolean;
  reason?: string;
  registryAddress?: string;
  network?: Network;
}

/**
 * Check whether `reader` has an active grant for `memoryRootId` per the
 * CapabilityRegistryV2 contract on the configured network.
 *
 * @param reader The wallet address requesting access.
 * @param memoryRootId The bytes32 grant id (capability id).
 */
export async function checkMemoryGrant(
  reader: string,
  memoryRootId: string,
): Promise<GrantCheckResult> {
  const cacheKey = `${reader.toLowerCase()}:${memoryRootId.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { allowed: cached.result };
  }

  const network: Network = (process.env.IVARONIX_NETWORK ?? 'testnet') as Network;
  const rpcUrl = process.env.IVARONIX_RPC_URL ?? (network === 'mainnet' ? 'https://evmrpc.0g.ai' : 'https://evmrpc-testnet.0g.ai');
  const chainId = network === 'mainnet' ? 16661 : 16602;
  const capRegV2 = getDeployedAddress(network, 'CapabilityRegistryV2');

  if (!capRegV2) {
    return {
      allowed: false,
      reason: 'CapabilityRegistryV2 not deployed on this network — no on-chain grants available',
      network,
    };
  }

  try {
    const provider = new JsonRpcProvider(rpcUrl, { chainId, name: network });
    const registry = new Contract(capRegV2, CAPABILITY_REGISTRY_ABI, provider);
    const result = (await registry.getFunction('hasGrant')(reader, memoryRootId)) as boolean;

    cache.set(cacheKey, { result, cachedAt: Date.now() });

    if (!result) {
      return {
        allowed: false,
        reason: `no active grant for ${reader.slice(0, 10)}… on capability ${memoryRootId.slice(0, 12)}…`,
        registryAddress: capRegV2,
        network,
      };
    }

    return { allowed: true, registryAddress: capRegV2, network };
  } catch (err) {
    return {
      allowed: false,
      reason: `chain check failed: ${(err as Error).message.split('\n')[0]}`,
      registryAddress: capRegV2,
      network,
    };
  }
}

/**
 * Convenience: throws a 403-style error if the grant check fails.
 * For use in Next.js Route Handlers where you want to short-circuit
 * with a NextResponse.json error.
 */
export async function assertMemoryGrant(
  reader: string,
  memoryRootId: string,
): Promise<void> {
  const result = await checkMemoryGrant(reader, memoryRootId);
  if (!result.allowed) {
    const err = new Error(result.reason ?? 'grant denied') as Error & { code?: string };
    err.code = 'GRANT_DENIED';
    throw err;
  }
}

/** Clear the cache — use in tests + when a grant change is known to have happened. */
export function clearGrantCache(): void {
  cache.clear();
}
