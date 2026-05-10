import type { Network } from '@ivaronix/core';

export interface Env {
  network: Network;
  chainId: number;
  rpcUrl: string;
  privateKey?: string;
  walletAddress?: string;
  routerApiKey?: string;
  routerServiceUrl?: string;
  routerProvider?: string;
  defaultModel: string;
}

/**
 * Read the first non-empty value from the alias chain. Names listed in
 * canonical → legacy order so the canonical IVARONIX_* form wins when
 * an operator has both set.
 */
function pickAlias(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v !== undefined && v !== '') return v;
  }
  return undefined;
}

/**
 * Load env vars via the canonical → legacy alias chain that mirrors
 * `packages/runtime/src/env.ts` SIGNER_KEY_ALIASES, NETWORK_ALIASES,
 * etc.
 *
 * Pre-sweep-113 this function read ONLY legacy names. EVERY CLI
 * command that imports `loadEnv` from `'../lib/env.js'` (chat, compute,
 * debug, delegate, demo, doc, doctor, export, …) silently failed when
 * the operator set only canonical IVARONIX_* names — because
 * `process.env.OG_NETWORK` etc. resolved to undefined. Studio (which
 * uses `@ivaronix/runtime`'s loadEnv) worked correctly; CLI silently
 * didn't. That's the root cause of every "Set EVM_PRIVATE_KEY" /
 * "Set ZG_API_SECRET" error message that sweeps 108-112 fixed at the
 * symptom layer — this fix removes the cause.
 *
 * Same alias-chain shape as packages/runtime/src/env.ts; the two
 * env loaders should ideally consolidate into a single shared module
 * (queued · cron note: avoid the dual-loader drift).
 */
export function loadEnv(): Env {
  const network = ((pickAlias('IVARONIX_NETWORK', 'OG_NETWORK') as Network) ?? 'testnet') as Network;
  return {
    network,
    chainId: Number(pickAlias('IVARONIX_CHAIN_ID', 'OG_CHAIN_ID') ?? (network === 'mainnet' ? 16661 : 16602)),
    rpcUrl: pickAlias('IVARONIX_RPC_URL', 'OG_RPC_URL') ?? (network === 'mainnet' ? 'https://evmrpc.0g.ai' : 'https://evmrpc-testnet.0g.ai'),
    privateKey: pickAlias('IVARONIX_SIGNER_KEY', 'OG_PRIVATE_KEY', 'EVM_PRIVATE_KEY'),
    walletAddress: pickAlias('IVARONIX_WALLET_ADDRESS', 'EVM_WALLET_ADDRESS'),
    routerApiKey: pickAlias('IVARONIX_ROUTER_KEY', 'ZG_API_SECRET'),
    routerServiceUrl: pickAlias('IVARONIX_ROUTER_URL', 'ZG_SERVICE_URL'),
    routerProvider: pickAlias('IVARONIX_ROUTER_PROVIDER', 'OG_COMPUTE_PROVIDER'),
    defaultModel: pickAlias('IVARONIX_DEFAULT_MODEL', 'OG_DEFAULT_MODEL') ?? 'qwen/qwen-2.5-7b-instruct',
  };
}
