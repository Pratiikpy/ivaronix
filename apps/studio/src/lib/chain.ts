import { JsonRpcProvider } from 'ethers';
import {
  ReceiptRegistryClient,
  ReceiptRegistryV2Client,
  AgentPassportClient,
  SkillRegistryClient,
  getDeployedAddress,
} from '@ivaronix/og-chain';
import { NETWORKS, RECEIPT_TYPES, type Network } from '@ivaronix/core';

/** Reverse-map a numeric receipt type code (as stored on chain) to its canonical name. */
const RECEIPT_TYPE_LABELS: Record<number, string> = Object.fromEntries(
  Object.entries(RECEIPT_TYPES).map(([k, v]) => [v as number, k])
);

export function receiptTypeLabel(code: number | bigint): string {
  const n = typeof code === 'bigint' ? Number(code) : code;
  return RECEIPT_TYPE_LABELS[n] ?? `type_${n}`;
}

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

export function getReceiptRegistryV2(): ReceiptRegistryV2Client | null {
  const addr = getDeployedAddress(getNetwork(), 'ReceiptRegistryV2');
  if (!addr) return null;
  return new ReceiptRegistryV2Client(addr, getProvider());
}

/**
 * Unified registry view: V2 first, V1 fallback. The label tells the
 * caller which registry the row came from so the UI can render a
 * `LEGACY-REGISTRY` chip on V1 receipts.
 */
export interface UnifiedRegistries {
  v2: ReceiptRegistryV2Client | null;
  v1: ReceiptRegistryClient | null;
}

export function getRegistries(): UnifiedRegistries {
  return { v2: getReceiptRegistryV2(), v1: getReceiptRegistry() };
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
