import type { MetadataRoute } from 'next';

/**
 * Production robots.txt for search engines.
 *
 * Allows the public Studio surface (home, /onboard, /skills, /marketplace,
 * /r/<id>, /agents, /global, /thesis, etc.) so judges + reviewers can
 * find Ivaronix via search. Disallows the operator/admin paths and the
 * /api/ routes (no value in indexing those).
 *
 * Routes the canonical sitemap to /sitemap.xml so crawlers can discover
 * the 20+ public pages without random-walking the site.
 *
 * Next.js 15 convention: this file at apps/studio/src/app/robots.ts is
 * auto-served at https://<host>/robots.txt by the Next runtime.
 *
 * Bug-18 closure (sweep · 2026-05-16): /robots.txt was 404 in production
 * — a standard production-readiness signal was missing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/test-wallet/',
        ],
      },
    ],
    sitemap: 'https://www.ivaronix.xyz/sitemap.xml',
    host: 'https://www.ivaronix.xyz',
  };
}
