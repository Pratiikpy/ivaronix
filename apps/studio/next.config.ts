import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages are written as ESM-style TypeScript with `.js` extensions
  // in source imports (NodeNext convention). Tell webpack to resolve those to
  // the corresponding `.ts` source so we don't need a build step in dev.
  transpilePackages: ['@ivaronix/core', '@ivaronix/og-chain'],
  webpack: (cfg) => {
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.extensionAlias = {
      ...(cfg.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    };
    return cfg;
  },
  env: {
    NEXT_PUBLIC_OG_NETWORK: process.env.NEXT_PUBLIC_OG_NETWORK ?? 'testnet',
  },
};

export default config;
