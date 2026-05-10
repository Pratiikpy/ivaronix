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
