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

/**
 * Canonical → legacy env var alias chain (planning-003 §A.3.4 · WT 9, 15, 22).
 *
 * The canonical names are `IVARONIX_*`. Legacy aliases (`OG_PRIVATE_KEY`,
 * `EVM_PRIVATE_KEY`, `OG_RPC_URL`, `OG_NETWORK`, etc.) still resolve so
 * existing operator `.env` files don't break, but `validateEnv()` logs a
 * one-time deprecation warning per alias used. Forge deploy scripts
 * separately read `OG_PRIVATE_KEY` directly via vm.envString — that
 * migration is the operator-action follow-up (USER_TODO §B-V2-10).
 */
const SIGNER_KEY_ALIASES = ['IVARONIX_SIGNER_KEY', 'OG_PRIVATE_KEY', 'EVM_PRIVATE_KEY'] as const;
const RPC_URL_ALIASES = ['IVARONIX_RPC_URL', 'OG_RPC_URL'] as const;
const NETWORK_ALIASES = ['IVARONIX_NETWORK', 'OG_NETWORK'] as const;
const CHAIN_ID_ALIASES = ['IVARONIX_CHAIN_ID', 'OG_CHAIN_ID'] as const;
const WALLET_ADDR_ALIASES = ['IVARONIX_WALLET_ADDRESS', 'EVM_WALLET_ADDRESS'] as const;
const ROUTER_KEY_ALIASES = ['IVARONIX_ROUTER_KEY', 'ZG_API_SECRET'] as const;
const ROUTER_URL_ALIASES = ['IVARONIX_ROUTER_URL', 'ZG_SERVICE_URL'] as const;
const ROUTER_PROVIDER_ALIASES = ['IVARONIX_ROUTER_PROVIDER', 'OG_COMPUTE_PROVIDER'] as const;
const DEFAULT_MODEL_ALIASES = ['IVARONIX_DEFAULT_MODEL', 'OG_DEFAULT_MODEL'] as const;

const warnedAliases = new Set<string>();

function resolveAlias(aliases: readonly string[]): { value: string | undefined; key: string | undefined } {
  for (const k of aliases) {
    const v = process.env[k];
    if (v !== undefined && v !== '') return { value: v, key: k };
  }
  return { value: undefined, key: undefined };
}

function readWithDeprecation(aliases: readonly string[]): string | undefined {
  const r = resolveAlias(aliases);
  if (r.key && r.key !== aliases[0] && !warnedAliases.has(r.key)) {
    warnedAliases.add(r.key);
    // eslint-disable-next-line no-console
    console.warn(
      `[ivaronix env] using legacy alias "${r.key}" — please migrate to canonical "${aliases[0]}" (planning-003 §A.3.4).`,
    );
  }
  return r.value;
}

export function loadEnv(): Env {
  const network = ((readWithDeprecation(NETWORK_ALIASES) as Network) ?? 'testnet') as Network;
  return {
    network,
    chainId: Number(readWithDeprecation(CHAIN_ID_ALIASES) ?? (network === 'mainnet' ? 16661 : 16602)),
    rpcUrl:
      readWithDeprecation(RPC_URL_ALIASES) ??
      (network === 'mainnet' ? 'https://evmrpc.0g.ai' : 'https://evmrpc-testnet.0g.ai'),
    privateKey: readWithDeprecation(SIGNER_KEY_ALIASES),
    walletAddress: readWithDeprecation(WALLET_ADDR_ALIASES),
    routerApiKey: readWithDeprecation(ROUTER_KEY_ALIASES),
    routerServiceUrl: readWithDeprecation(ROUTER_URL_ALIASES),
    routerProvider: readWithDeprecation(ROUTER_PROVIDER_ALIASES),
    defaultModel: readWithDeprecation(DEFAULT_MODEL_ALIASES) ?? 'qwen/qwen-2.5-7b-instruct',
  };
}

/**
 * Walks every alias chain and prints which canonical / alias is set.
 * Used by `pnpm env:check` (queued · USER_TODO §B-V2-11) so operators see
 * exactly what their `.env` resolves to before running deploy commands.
 */
export function envCheckReport(): Array<{ canonical: string; usedAlias: string | null; value: string | null }> {
  const groups: Array<readonly string[]> = [
    SIGNER_KEY_ALIASES,
    RPC_URL_ALIASES,
    NETWORK_ALIASES,
    CHAIN_ID_ALIASES,
    WALLET_ADDR_ALIASES,
    ROUTER_KEY_ALIASES,
    ROUTER_URL_ALIASES,
    ROUTER_PROVIDER_ALIASES,
    DEFAULT_MODEL_ALIASES,
  ];
  return groups.map((aliases) => {
    const r = resolveAlias(aliases);
    return {
      canonical: aliases[0]!,
      usedAlias: r.key ?? null,
      value: r.value ?? null,
    };
  });
}
