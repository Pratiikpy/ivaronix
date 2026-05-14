/**
 * V2-first passport resolution helper.
 *
 * Pre-iter-14, eight CLI commands each carried their own copy of the
 * V1-only passport lookup (`getDeployedAddress('AgentPassportINFT')`).
 * Operator-funded V2 has the K-6 memoryRoot-poisoning fix; V1 doesn't.
 * Reading or writing against V1 when V2 exists is a quiet regression.
 *
 * This helper centralises the V2-first pattern so a future contributor
 * can't accidentally drift one file back to V1-only. Each return shape
 * stays identical to the underlying `AgentPassportClient` API — only the
 * address selection moves to V2 when available, with V1 fallback for
 * chains that haven't deployed V2 yet.
 *
 * Match shape: Studio `apps/studio/src/lib/chain.ts` `livePassportCount()`
 * + `apps/mcp-server/src/server.ts` handlePassportShow + CLI
 * `passport.ts` show command.
 */
import { JsonRpcProvider, type Signer } from 'ethers';
import { AgentPassportClient, getDeployedAddress } from '@ivaronix/og-chain';
import type { Address, Network } from '@ivaronix/core';

export interface PassportClientHandle {
  client: AgentPassportClient;
  address: Address;
  version: 'v1' | 'v2';
}

/**
 * Pick the V2 passport client when deployed; fall back to V1. Pass a
 * `Signer` to get a write-capable client, `JsonRpcProvider` for read-only.
 * Returns `null` if neither V1 nor V2 is deployed on the network.
 */
export function getActivePassportClient(
  network: Network,
  runner: Signer | JsonRpcProvider,
): PassportClientHandle | null {
  const addrV2 = getDeployedAddress(network, 'AgentPassportINFTV2');
  const addrV1 = getDeployedAddress(network, 'AgentPassportINFT');
  if (addrV2) {
    return {
      client: new AgentPassportClient(addrV2 as Address, runner),
      address: addrV2 as Address,
      version: 'v2',
    };
  }
  if (addrV1) {
    return {
      client: new AgentPassportClient(addrV1 as Address, runner),
      address: addrV1 as Address,
      version: 'v1',
    };
  }
  return null;
}

/**
 * V2-first tokenId resolution. Returns 0n when the wallet has no
 * passport on either V1 or V2.
 */
export async function resolvePassportTokenId(
  network: Network,
  runner: Signer | JsonRpcProvider,
  wallet: Address,
): Promise<{ tokenId: bigint; version: 'v1' | 'v2' | null }> {
  const addrV2 = getDeployedAddress(network, 'AgentPassportINFTV2');
  const addrV1 = getDeployedAddress(network, 'AgentPassportINFT');
  if (addrV2) {
    try {
      const id = await new AgentPassportClient(addrV2 as Address, runner).passportOf(wallet);
      if (id !== 0n) return { tokenId: id, version: 'v2' };
    } catch { /* fall through to V1 */ }
  }
  if (addrV1) {
    try {
      const id = await new AgentPassportClient(addrV1 as Address, runner).passportOf(wallet);
      if (id !== 0n) return { tokenId: id, version: 'v1' };
    } catch { /* not on V1 either */ }
  }
  return { tokenId: 0n, version: null };
}
