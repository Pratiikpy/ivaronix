import { JsonRpcProvider } from 'ethers';
import {
  ReceiptRegistryClient,
  AgentPassportClient,
  SkillRegistryClient,
  getDeployedAddress,
} from '@ivaronix/og-chain';
import { NETWORKS, type Network } from '@ivaronix/core';

/**
 * Server-side Ethers provider. The Studio reads on-chain data directly using
 * the og-chain workspace package — no API proxy. Day-13 scaffold uses RPC at
 * request time; Day-17 will add caching + revalidation.
 */
export function getNetwork(): Network {
  return (process.env.NEXT_PUBLIC_OG_NETWORK as Network) ?? 'testnet';
}

export function getProvider(): JsonRpcProvider {
  const net = getNetwork();
  const cfg = NETWORKS[net];
  return new JsonRpcProvider(cfg.rpcUrl, { chainId: cfg.chainId, name: cfg.name });
}

export function getReceiptRegistry(): ReceiptRegistryClient | null {
  const addr = getDeployedAddress(getNetwork(), 'ReceiptRegistry');
  if (!addr) return null;
  return new ReceiptRegistryClient(addr, getProvider());
}

export function getPassportClient(): AgentPassportClient | null {
  const addr = getDeployedAddress(getNetwork(), 'AgentPassportINFT');
  if (!addr) return null;
  return new AgentPassportClient(addr, getProvider());
}

export function getSkillRegistry(): SkillRegistryClient | null {
  const addr = getDeployedAddress(getNetwork(), 'SkillRegistry');
  if (!addr) return null;
  return new SkillRegistryClient(addr, getProvider());
}

export function explorerTxUrl(txHash: string): string {
  return `${NETWORKS[getNetwork()].chainExplorer}/tx/${txHash}`;
}

export function explorerAddrUrl(addr: string): string {
  return `${NETWORKS[getNetwork()].chainExplorer}/address/${addr}`;
}
