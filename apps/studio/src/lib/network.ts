/**
 * Client-safe network helpers — no `@ivaronix/og-chain` import here, so
 * webpack can bundle this file into a 'use client' component without
 * hitting the `node:fs`/`node:path` modules used by og-chain's
 * deployments.ts (which only works on the server).
 *
 * lib/chain.ts re-exports both helpers so existing server-side imports
 * keep working. New 'use client' code MUST import from '@/lib/network'.
 */

// Import via the /types subpath, NOT the barrel — the barrel pulls in
// hash.ts which uses node:crypto, which webpack can't bundle for the
// client. /types is pure type + constant definitions.
import { NETWORKS, type Network } from '@ivaronix/core/types';

export function getNetwork(): Network {
  return (process.env.NEXT_PUBLIC_OG_NETWORK as Network) ?? 'testnet';
}

/**
 * Canonical chainId for the active deployment. Use this for every
 * wagmi writeContract/writeContractAsync call so MM cannot submit a
 * tx on Ethereum (chainId 1) or another network when the user has
 * mis-selected the network. wagmi v2 throws ChainMismatchError when
 * the connected wallet's chainId differs from this value.
 *
 * Mainnet build → 16661 (Aristotle). Testnet build → 16602 (Galileo).
 *
 * Return type is the literal union wagmi infers from lib/wagmi.ts.
 * Generic `number` would fail typecheck because wagmi's
 * writeContract.chainId is typed as `16602 | 16661 | undefined`.
 */
export function getChainId(): 16602 | 16661 {
  return NETWORKS[getNetwork()].chainId as 16602 | 16661;
}
