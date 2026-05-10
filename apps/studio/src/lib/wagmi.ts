import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { injected } from 'wagmi/connectors';

// Note on `nonce too low` errors observed in QA when issuing a memory grant
// right after the server has anchored a server-side receipt for the same
// wallet: with an injected connector, MetaMask manages the nonce, not viem.
// The mismatch is a wagmi-cache + chain-mempool race. Mitigation lives in
// the call site (refetch + retry on `nonce too low`) rather than here.

/**
 * 0G Galileo Testnet (chainId 16602) — canonical reference.
 * Aristotle Mainnet (chainId 16661) — promotion gated on USER_TODO §B-V2.
 *
 * Per CLAUDE.md §10 wallet-flow rules: a single MetaMask connector keeps
 * the onboard step free of "which wallet?" friction. Future
 * mobile WalletConnect path lives in USER_TODO §B-V2 (queued behind
 * mainnet promotion).
 */

export const ogTestnet = defineChain({
  id: 16602,
  name: '0G Galileo Testnet',
  nativeCurrency: { name: '0G', symbol: 'OG', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmrpc-testnet.0g.ai'] },
  },
  blockExplorers: {
    default: { name: 'Galileo Chainscan', url: 'https://chainscan-galileo.0g.ai' },
  },
  testnet: true,
});

export const ogMainnet = defineChain({
  id: 16661,
  name: '0G Aristotle Mainnet',
  nativeCurrency: { name: '0G', symbol: 'OG', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmrpc.0g.ai'] },
  },
  blockExplorers: {
    default: { name: 'Aristotle Chainscan', url: 'https://chainscan.0g.ai' },
  },
});

export const config = createConfig({
  chains: [ogTestnet, ogMainnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [ogTestnet.id]: http(),
    [ogMainnet.id]: http(),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
