import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Network, Address } from '@ivaronix/core';

export interface ContractDeployment {
  address: Address;
  txHash: string;
  explorer: string;
}

export interface DeploymentManifest {
  network: Network;
  chainId: number;
  deployer: Address;
  deployedAt: string;
  contracts: Record<string, ContractDeployment>;
}

/**
 * Walk up dirs to find `oglabs/contracts/deployments/<network>.json`.
 *
 * Path moved 2026-05-10 (cron-sweep finding): legacy location was
 * `oglabs/deployments/<network>.json`, but ~22 docs (CLAUDE.md, USER_TODO.md,
 * planning-003.md, .claude/rules/contracts.md, every Deploy*.s.sol NatSpec)
 * already documented the contracts/ location. Code now matches docs. Legacy
 * `deployments/` location kept as a fallback so any external script still
 * pointing there resolves with a one-time deprecation log.
 */
function findDeploymentsDir(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const canonical = resolve(dir, 'contracts', 'deployments');
    if (existsSync(canonical)) return canonical;
    const legacy = resolve(dir, 'deployments');
    if (existsSync(legacy)) {
      console.warn('[og-chain] deployments/ at repo root is the legacy path · move to contracts/deployments/');
      return legacy;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Load the deployments manifest for a given network. Returns null if not deployed yet. */
export function loadDeployments(network: Network, fromDir = process.cwd()): DeploymentManifest | null {
  const dir = findDeploymentsDir(fromDir);
  if (!dir) return null;
  const file = resolve(dir, `${network}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as DeploymentManifest;
}

/** Convenience: get a specific contract's deployed address. */
export function getDeployedAddress(network: Network, contract: string, fromDir = process.cwd()): Address | null {
  const m = loadDeployments(network, fromDir);
  return m?.contracts[contract]?.address ?? null;
}

/**
 * V2-first address lookup with V1 fallback. Pass the base contract name
 * (e.g. `"CapabilityRegistry"`); returns the V2 address if `<base>V2`
 * is deployed, else the V1 address, else null.
 *
 * Use this everywhere the caller writes to (or wants to prefer) the
 * hardened V2 contract while still working on networks that only have
 * V1 deployed. Matches the V2-first read pattern documented in
 * `apps/studio/src/lib/chain.ts` (`unified*` helpers) and
 * `apps/cli/src/commands/receipt.ts` (`buildReadRegistries`).
 *
 * IMPORTANT (iter-89 finding): the V1 ABI is NOT automatically
 * compatible with V2 contracts for security-hardened V2s. For example,
 * `CapabilityRegistryV2` made `grantsByOwner` and `grantsByGrantee`
 * internal (privacy gate); the V1 client's `grantsByOwner(address)`
 * call reverts against V2 because the public auto-getter no longer
 * exists. Before pointing a V1 client at a V2 address with this helper,
 * verify the read methods the client uses still exist with the same
 * signature on V2. For pure write surfaces (issueGrant, revokeGrant,
 * updateMemoryRoot), V1 client → V2 address works cleanly because V2
 * preserved the write-method signatures.
 *
 * Example:
 *   const capAddr = getActiveAddress(network, 'CapabilityRegistry');
 *   // → V2 address on Galileo (B-V2-15 SHIPPED · 0x1351CD87...)
 *   // → V1 address on networks where V2 hasn't deployed yet
 */
export function getActiveAddress(network: Network, baseName: string, fromDir = process.cwd()): Address | null {
  return (
    getDeployedAddress(network, `${baseName}V2`, fromDir) ??
    getDeployedAddress(network, baseName, fromDir)
  );
}

/**
 * Both addresses (V1 + V2) and which version each one is. Useful for
 * read paths that need to merge data across both registries.
 */
export interface VersionedAddresses {
  v2: Address | null;
  v1: Address | null;
}

export function getVersionedAddresses(network: Network, baseName: string, fromDir = process.cwd()): VersionedAddresses {
  return {
    v2: getDeployedAddress(network, `${baseName}V2`, fromDir),
    v1: getDeployedAddress(network, baseName, fromDir),
  };
}
