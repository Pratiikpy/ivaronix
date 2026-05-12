/**
 * Build-time import of `contracts/deployments/<network>.json` into the Studio
 * bundle.
 *
 * Why this exists: `@ivaronix/og-chain`'s `getDeployedAddress(...)` walks up
 * from `process.cwd()` looking for `contracts/deployments/<network>.json` on
 * disk. That's correct for the CLI (which runs from inside the monorepo, so
 * the walk-up lands on the file) but BREAKS on Vercel — the deployment's
 * serverless function bundle does not include the `contracts/` directory,
 * so `findDeploymentsDir` returns null and every chain client comes back as
 * null. Every `/r/<id>` returns 404 and `/api/dashboard/<addr>` returns
 * an empty payload (no passport, no recent receipts) even though the
 * receipts genuinely exist on Galileo.
 *
 * Fix: import the JSON manifests directly. Webpack traces the imports at
 * build time and copies them into the function bundle. `process.cwd()` is
 * never read, so the deploy is location-independent.
 *
 * When V2 contracts redeploy, `contracts/deployments/testnet.json` is the
 * single source of truth (CLAUDE.md §15 bookkeeping rule) — a new Vercel
 * deploy automatically picks up the new addresses without any code change.
 */
import type { Address, Network } from '@ivaronix/core';

import testnetManifest from '../../../../contracts/deployments/testnet.json';

type ContractRow = { address: string; txHash?: string; explorer?: string };
type Manifest = { contracts: Record<string, ContractRow> };

const MANIFESTS: Record<Network, Manifest | null> = {
  // Mainnet manifest is not yet deployed; falls back to the og-chain `process.cwd()`
  // walk if Studio is ever pointed at mainnet before the redeploy.
  mainnet: null,
  testnet: testnetManifest as Manifest,
};

/**
 * Studio-local replacement for `@ivaronix/og-chain` `getDeployedAddress`.
 * Returns the same shape (`Address | null`) — null means the contract isn't
 * deployed on the target network yet.
 */
export function getStudioDeployedAddress(network: Network, contract: string): Address | null {
  const m = MANIFESTS[network];
  if (!m) return null;
  const row = m.contracts[contract];
  if (!row?.address) return null;
  return row.address as Address;
}

/**
 * Studio-local replacement for `@ivaronix/og-chain` `loadDeployments`.
 * Returns the entire manifest; null if the network isn't deployed.
 */
export function getStudioDeployments(network: Network): Manifest | null {
  return MANIFESTS[network] ?? null;
}
