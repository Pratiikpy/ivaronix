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

/** Walk up dirs to find oglabs/deployments/<network>.json. */
function findDeploymentsDir(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, 'deployments');
    if (existsSync(candidate)) return candidate;
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
