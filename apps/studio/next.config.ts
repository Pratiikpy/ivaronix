import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// apps/studio/ → ../../ is the monorepo root. Pin it so file tracing (and the
// outputFileTracingExcludes globs below) resolve against the right base on
// Vercel — without this Next *infers* the root from lockfile walk-up and warns.
const MONOREPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const config: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: MONOREPO_ROOT,
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
  // Keep heavy/native deps OUT of the server JS bundle — Vercel's serverless
  // functions cap at 250 MB uncompressed and `/api/run` (via @ivaronix/runtime
  // → og-storage / memory) drags in a lot. These are loaded from node_modules
  // at runtime instead of inlined: better-sqlite3 (native .node) + sharp +
  // onnxruntime-node (~92 MB native) + @xenova/transformers (~45 MB, the MiniLM
  // embedder — only the hashing-trick fallback runs on Vercel) + the 0G Storage
  // SDK (ships its own ethers v5).
  serverExternalPackages: [
    'better-sqlite3',
    'sharp',
    'onnxruntime-node',
    '@xenova/transformers',
    '@0gfoundation/0g-ts-sdk',
  ],
  // What actually blew `api/run` past Vercel's 250 MB cap: `@vercel/nft`
  // pulled the webpack PERSISTENT BUILD CACHE (`.next/cache/webpack/*.pack`,
  // ~600+ MB) and `*.tsbuildinfo` files into the function trace — pure
  // build-time artifacts with no runtime use. Plus the workspace `.ivaronix/`
  // data dirs (1500+ committed CLI receipt fixtures) and the npx-cli bundle
  // got dragged in by string-path references in the delegate path.
  //
  // The MiniLM / ONNX / sharp stack is also excluded: the memory engine's
  // `await import('@xenova/transformers')` is gated behind
  // IVARONIX_MEMORY_EMBEDDER=fallback on Vercel (and degrades to the
  // hashing-trick embedder if the module is absent), so ~150 MB of weights +
  // native runtime never executes there.
  // Include seed-skills/ in the serverless function trace. `loadAllSkills()`
  // (apps/studio/src/lib/skills.ts) walks parent dirs from cwd looking for
  // seed-skills/<id>/SKILL.md — those files live OUTSIDE apps/studio/ so
  // Vercel's nft tracer doesn't pull them by default. Without this, the
  // home page stat row shows "0 verified skills" on production (caught
  // during P1 Landing UI test on 2026-05-13).
  outputFileTracingIncludes: {
    '**': [
      '../../seed-skills/**/SKILL.md',
      '../../seed-skills/**/prompt.md',
      '../../seed-skills/**/manifest.json',
      '../../seed-skills/**/tests/**',
      // Bundled cluster proof receipts · read at request time via
      // `apps/studio/src/lib/local-receipt.ts:findReceiptsDirs()`.
      // Without explicit inclusion, Vercel's nft tracer doesn't pull
      // these JSON files into the function bundle (they're not import-
      // referenced — read via fs.readFileSync). The locked launch-
      // readiness sequence needs prod /r/<id> to render structured
      // findings for the cluster proof set (commit 9605c56).
      'src/data/receipts/anchored/**',
    ],
  },
  outputFileTracingExcludes: {
    '**': [
      // build-time artifacts (belt — `config.cache = false` below is the
      // real defence; the .pack files only exist if webpack writes them)
      '.next/cache/**',
      '**/.next/cache/**',
      'apps/studio/.next/cache/**',
      '**/*.tsbuildinfo',
      '**/*.pack',
      '**/*.pack.old',
      '**/*.pack.gz',
      '**/.next/trace',
      // workspace runtime-data dirs that resolved into the trace by accident
      '**/.ivaronix/**',
      'apps/npx-cli/dist/**',
      // ML stack — never runs on Vercel (hashing-trick fallback embedder)
      'node_modules/**/onnxruntime-node/**',
      'node_modules/**/@xenova/transformers/**',
      'node_modules/**/sharp/**',
      'node_modules/**/@img/**',
    ],
  },
  webpack: (cfg, { dev }) => {
    // Disable webpack's filesystem cache for production `next build`. It writes
    // `.next/cache/webpack/*.pack` (600+ MB here) which @vercel/nft drags into
    // every serverless function's trace via .tsbuildinfo references — that's
    // what pushed `api/run` past Vercel's 250 MB cap. Vercel builds fresh each
    // time so there's no cache to reuse anyway; locally it just means `next
    // build` doesn't get the incremental speedup (`next dev` is unaffected).
    if (!dev) cfg.cache = false;
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.extensionAlias = {
      ...(cfg.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    };
    // wagmi v2's MetaMask connector tries to import mobile-only deps
    // (@react-native-async-storage/async-storage) for React Native parity.
    // WalletConnect's logger pulls pino, which has an optional
    // `require('pino-pretty')` for dev-only pretty-printing, plus lokijs;
    // node-fetch reaches for `encoding`. None ship in our browser bundle, so
    // noop them — otherwise webpack emits "Module not found" warnings every
    // build (cosmetic, but noisy and looks like a real failure).
    cfg.resolve.fallback = {
      ...(cfg.resolve.fallback ?? {}),
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
      lokijs: false,
      encoding: false,
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
    // USER_TODO §B-V2-42 as a separate piece of work.
    //
    // The four headers below are safe defaults that don't risk breaking
    // any flow:
    //   X-Frame-Options: DENY            — defeats clickjacking
    //   X-Content-Type-Options: nosniff  — defeats MIME-sniff XSS
    //   Referrer-Policy: strict-origin-when-cross-origin
    //                                     — leaks scheme+host but no path on cross-origin
    //   Strict-Transport-Security        — HSTS · 2 years + subdomains + preload-eligible.
    //                                     Browsers ignore on HTTP so safe in dev too.
    // B-V2-45 closure · edge-cache headers on public-manifest routes
    // (`docs/PRIVACY_NOTES.md §1` recommendation). Without these the
    // operator wallet signs an indexer read for every distinct viewer
    // of /r/<id>, /embed/r/<id>, /data-room/<id>. With `s-maxage=86400`
    // the Vercel edge caches the public manifest for 24h and only the
    // FIRST viewer triggers an operator-signed fetch; subsequent viewers
    // hit the edge cache. Reduces operator-wallet appearance in indexer
    // logs by ~99% on popular receipts.
    //
    // `stale-while-revalidate=604800` (7d) keeps the cache warm even
    // when the underlying manifest hasn't changed in a week — the next
    // viewer gets the stale copy instantly, Vercel re-validates in
    // background. Receipt bodies are immutable (canonical-hash-bound)
    // so stale-while-revalidate has no correctness risk.
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
      {
        source: '/r/:id',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/r/:id/print',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/embed/r/:id',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/data-room/:id',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=86400, stale-while-revalidate=604800' },
        ],
      },
    ];
  },
};

export default config;
