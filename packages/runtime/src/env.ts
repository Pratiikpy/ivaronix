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
  /**
   * Optional read-only proxy private key for storage-indexer auth on
   * public-fetch paths (planning-003 §A.5.3 · WT 46).
   *
   * The 0G Storage indexer requires a signer for every fetch. If we
   * use the operator wallet for both writes AND reads, the operator
   * sees every public manifest fetch — including data-room reads it's
   * not a party to. The fix is a separate zero-balance key that signs
   * read-only indexer requests. Operator wallet is only used for
   * writes (uploads, anchors).
   *
   * When unset, public reads fall back to `privateKey` (operator) and
   * the privacy boundary is leakier. See `docs/PRIVACY_NOTES.md`.
   */
  readProxyPrivateKey?: string;
}

/**
 * Canonical → legacy env var alias chain (planning-003 §A.3.4 · WT 9, 15, 22).
 *
 * The canonical names are `IVARONIX_*`. Legacy aliases (`OG_PRIVATE_KEY`,
 * `EVM_PRIVATE_KEY`, `OG_RPC_URL`, `OG_NETWORK`, etc.) still resolve so
 * existing operator `.env` files don't break, but `validateEnv()` logs a
 * one-time deprecation warning per alias used. Forge deploy scripts
 * now read `IVARONIX_SIGNER_KEY` via `vm.envOr("IVARONIX_SIGNER_KEY",
 * vm.envUint("OG_PRIVATE_KEY"))` — the migration shipped in
 * `USER_TODO §B-V2-10` (✅ SHIPPED).
 */
const SIGNER_KEY_ALIASES = ['IVARONIX_SIGNER_KEY', 'OG_PRIVATE_KEY', 'EVM_PRIVATE_KEY'] as const;
const READ_PROXY_KEY_ALIASES = ['IVARONIX_READ_PROXY_KEY', 'READ_PROXY_PRIVATE_KEY'] as const;
const RPC_URL_ALIASES = ['IVARONIX_RPC_URL', 'OG_RPC_URL'] as const;
const NETWORK_ALIASES = ['IVARONIX_NETWORK', 'OG_NETWORK'] as const;
const CHAIN_ID_ALIASES = ['IVARONIX_CHAIN_ID', 'OG_CHAIN_ID'] as const;
const WALLET_ADDR_ALIASES = ['IVARONIX_WALLET_ADDRESS', 'EVM_WALLET_ADDRESS'] as const;
const ROUTER_KEY_ALIASES = ['IVARONIX_ROUTER_KEY', 'ZG_API_SECRET'] as const;
const ROUTER_URL_ALIASES = ['IVARONIX_ROUTER_URL', 'ZG_SERVICE_URL'] as const;
const ROUTER_PROVIDER_ALIASES = ['IVARONIX_ROUTER_PROVIDER', 'OG_COMPUTE_PROVIDER'] as const;
const DEFAULT_MODEL_ALIASES = ['IVARONIX_DEFAULT_MODEL', 'OG_DEFAULT_MODEL'] as const;

const warnedAliases = new Set<string>();
// Accumulates legacy aliases used during a single loadEnv() call so we
// can emit ONE consolidated deprecation banner instead of one line per
// alias. Pre-sweep, an operator with a legacy .env saw 9 separate
// `[ivaronix env] using legacy alias "X"` lines on every CLI run — same
// info repeated 9× — which buried real output in noise.
let pendingDeprecations: Array<{ legacy: string; canonical: string }> = [];

function resolveAlias(aliases: readonly string[]): { value: string | undefined; key: string | undefined } {
  for (const k of aliases) {
    const v = process.env[k];
    if (v !== undefined && v !== '') return { value: v, key: k };
  }
  return { value: undefined, key: undefined };
}

function readWithDeprecation(aliases: readonly string[]): string | undefined {
  const r = resolveAlias(aliases);
  const canonical = aliases[0];
  if (r.key && canonical && r.key !== canonical && !warnedAliases.has(r.key)) {
    warnedAliases.add(r.key);
    pendingDeprecations.push({ legacy: r.key, canonical });
  }
  return r.value;
}

function flushDeprecationBanner(): void {
  if (pendingDeprecations.length === 0) return;
  if (process.env.IVARONIX_QUIET_ALIAS_WARNINGS) {
    pendingDeprecations = [];
    return;
  }
  const pairs = pendingDeprecations.map((p) => `${p.legacy} → ${p.canonical}`).join(', ');
  // eslint-disable-next-line no-console
  console.warn(
    `[ivaronix env] ${pendingDeprecations.length} legacy alias${pendingDeprecations.length === 1 ? '' : 'es'} in use: ${pairs} (planning-003 §A.3.4 · set IVARONIX_QUIET_ALIAS_WARNINGS=1 to silence)`,
  );
  pendingDeprecations = [];
}

export function loadEnv(): Env {
  // Default to mainnet so first-run experience anchors against live 0G
  // Aristotle (chainId 16661) without needing an inline env override.
  const network = ((readWithDeprecation(NETWORK_ALIASES) as Network) ?? 'mainnet') as Network;

  // When network=mainnet, pin chainId + rpcUrl to the mainnet defaults
  // and reject testnet-shaped values left over in a legacy .env. This
  // closes a class of bug where a stale `OG_CHAIN_ID=16602` and
  // `OG_RPC_URL=https://evmrpc-testnet.0g.ai` from an older operator
  // setup silently downgraded a mainnet run to testnet RPC, producing
  // TIER 2 / LOCAL ONLY receipts.
  const explicitChainId = readWithDeprecation(CHAIN_ID_ALIASES);
  const explicitRpcUrl = readWithDeprecation(RPC_URL_ALIASES);
  let chainId: number;
  let rpcUrl: string;
  if (network === 'mainnet') {
    chainId = 16661;
    rpcUrl = 'https://evmrpc.0g.ai';
    if (explicitChainId && Number(explicitChainId) !== 16661) {
      // eslint-disable-next-line no-console
      console.warn(`[ivaronix env] IVARONIX_NETWORK=mainnet but CHAIN_ID=${explicitChainId} (testnet) found in env; pinning to mainnet 16661.`);
    }
    if (explicitRpcUrl && !explicitRpcUrl.includes('evmrpc.0g.ai')) {
      // eslint-disable-next-line no-console
      console.warn(`[ivaronix env] IVARONIX_NETWORK=mainnet but RPC_URL=${explicitRpcUrl} found in env; pinning to https://evmrpc.0g.ai.`);
    }
  } else {
    chainId = Number(explicitChainId ?? 16602);
    rpcUrl = explicitRpcUrl ?? 'https://evmrpc-testnet.0g.ai';
  }

  const env: Env = {
    network,
    chainId,
    rpcUrl,
    privateKey: readWithDeprecation(SIGNER_KEY_ALIASES),
    readProxyPrivateKey: readWithDeprecation(READ_PROXY_KEY_ALIASES),
    walletAddress: readWithDeprecation(WALLET_ADDR_ALIASES),
    routerApiKey: readWithDeprecation(ROUTER_KEY_ALIASES),
    routerServiceUrl: readWithDeprecation(ROUTER_URL_ALIASES),
    routerProvider: readWithDeprecation(ROUTER_PROVIDER_ALIASES),
    defaultModel: readWithDeprecation(DEFAULT_MODEL_ALIASES) ?? 'qwen/qwen-2.5-7b-instruct',
  };
  flushDeprecationBanner();
  return env;
}

/**
 * Walks every alias chain and prints which canonical / alias is set.
 * Powers `pnpm env:check` (`scripts/diag/env-check.ts`) — operators see
 * exactly what their `.env` resolves to before running deploy commands.
 * Closed B-V2-11 in commit 2e49612.
 */
export function envCheckReport(): Array<{ canonical: string; usedAlias: string | null; value: string | null }> {
  const groups: Array<readonly string[]> = [
    SIGNER_KEY_ALIASES,
    READ_PROXY_KEY_ALIASES,
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
