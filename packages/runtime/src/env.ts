import type { Network } from '@ivaronix/core';

/** Server-side environment shared between CLI + Studio. */
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

export function loadEnv(): Env {
  const network = ((process.env.OG_NETWORK as Network) ?? 'testnet') as Network;
  return {
    network,
    chainId: Number(process.env.OG_CHAIN_ID ?? (network === 'mainnet' ? 16661 : 16602)),
    rpcUrl:
      process.env.OG_RPC_URL ??
      (network === 'mainnet' ? 'https://evmrpc.0g.ai' : 'https://evmrpc-testnet.0g.ai'),
    privateKey: process.env.OG_PRIVATE_KEY ?? process.env.EVM_PRIVATE_KEY,
    walletAddress: process.env.EVM_WALLET_ADDRESS,
    routerApiKey: process.env.ZG_API_SECRET,
    routerServiceUrl: process.env.ZG_SERVICE_URL,
    routerProvider: process.env.OG_COMPUTE_PROVIDER,
    defaultModel: process.env.OG_DEFAULT_MODEL ?? 'qwen/qwen-2.5-7b-instruct',
  };
}
