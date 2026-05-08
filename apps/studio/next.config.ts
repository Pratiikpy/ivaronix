import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages are written as ESM-style TypeScript with `.js` extensions
  // in source imports (NodeNext convention). Tell webpack to resolve those to
  // the corresponding `.ts` source so we don't need a build step in dev.
  transpilePackages: [
    '@ivaronix/core',
    '@ivaronix/og-chain',
    '@ivaronix/og-router',
    '@ivaronix/consensus',
    '@ivaronix/skills',
    '@ivaronix/receipts',
    '@ivaronix/runtime',
  ],
  // The runtime imports better-sqlite3 transitively via @ivaronix/skills?? no,
  // it doesn't. But it does need .env loaded at server startup.
  serverExternalPackages: [],
  webpack: (cfg) => {
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.extensionAlias = {
      ...(cfg.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    };
    // wagmi v2's MetaMask connector tries to import mobile-only deps
    // (@react-native-async-storage/async-storage) for React Native parity.
    // We don't ship a mobile build, so noop them to silence the webpack warning.
    cfg.resolve.fallback = {
      ...(cfg.resolve.fallback ?? {}),
      '@react-native-async-storage/async-storage': false,
    };
    return cfg;
  },
  env: {
    NEXT_PUBLIC_OG_NETWORK: process.env.NEXT_PUBLIC_OG_NETWORK ?? 'testnet',
  },
};

export default config;
