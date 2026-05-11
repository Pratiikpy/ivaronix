import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages are written as ESM-style TypeScript with `.js` extensions
  // in source imports (NodeNext convention). Tell webpack to resolve those to
  // the corresponding `.ts` source so we don't need a build step in dev.
  //
  // EVERY @ivaronix/* package Studio imports MUST be listed here, otherwise
  // a production `next build` (Vercel) fails to transpile the raw .ts source.
  // Studio currently imports: core, og-chain, og-storage, receipts, runtime,
  // skills (and pulls og-router transitively via runtime). `verify-vercel-
  // transpile-packages.ts` regression locks this against drift.
  transpilePackages: [
    '@ivaronix/core',
    '@ivaronix/og-chain',
    '@ivaronix/og-router',
    '@ivaronix/og-storage',
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
  async headers() {
    // Defence-in-depth HTTP security headers per HALF_BAKED Tier A item 6.
    // CSP deliberately omitted — it needs end-to-end app testing to draft
    // a working policy that allows wagmi + Next.js inline scripts +
    // brand-token style attrs without breaking flows. Tracked in
    // USER_TODO §B-V2 as a separate piece of work.
    //
    // The four headers below are safe defaults that don't risk breaking
    // any flow:
    //   X-Frame-Options: DENY            — defeats clickjacking
    //   X-Content-Type-Options: nosniff  — defeats MIME-sniff XSS
    //   Referrer-Policy: strict-origin-when-cross-origin
    //                                     — leaks scheme+host but no path on cross-origin
    //   Strict-Transport-Security        — HSTS · 2 years + subdomains + preload-eligible.
    //                                     Browsers ignore on HTTP so safe in dev too.
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default config;
