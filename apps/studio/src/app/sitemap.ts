import type { MetadataRoute } from 'next';
import { getSampleReceiptId } from '@/lib/sample-receipt';
import { FIRST_PARTY_SLUGS } from '@/lib/first-party-skills';

/**
 * Production sitemap for search engines.
 *
 * Lists the public Studio surfaces a crawler should index — the canonical
 * entry-point pages plus the 3 bundled mainnet receipt fixtures (66, 68,
 * 70) that strangers can verify-replay without credentials. First-party
 * skill detail pages are also included so the legal-cluster ranks for
 * domain-specific queries.
 *
 * Next.js 15 convention: this file at apps/studio/src/app/sitemap.ts is
 * auto-served at https://<host>/sitemap.xml.
 *
 * Bug-18 closure (sweep · 2026-05-16): /sitemap.xml was 404 in production.
 *
 * Slug source is `@/lib/first-party-skills` per the regression contract
 * `verify-first-party-slugs-canonical.ts` (no array-literal redeclarations).
 */

const BASE = 'https://www.ivaronix.xyz';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const sampleId = getSampleReceiptId();

  const entries: MetadataRoute.Sitemap = [];

  // High-priority entry points + the trust-establishing routes.
  entries.push({ url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 });
  entries.push({ url: `${BASE}/onboard`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 });
  entries.push({ url: `${BASE}/marketplace`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 });
  entries.push({ url: `${BASE}/thesis`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 });

  // Mid-priority pages — content + product surface.
  for (const path of ['/skills', '/agents', '/global', '/memory', '/dashboard', '/0g', '/docs', '/faq', '/legal', '/verticals', '/brand', '/learn']) {
    entries.push({ url: `${BASE}${path}`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 });
  }

  // Skill detail pages — every first-party slug from the canonical list.
  for (const slug of FIRST_PARTY_SLUGS) {
    entries.push({ url: `${BASE}/skill/${slug}`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 });
  }

  // Bundled receipt fixtures — strangers can verify-replay these without credentials.
  for (const id of [66, 68, 70]) {
    entries.push({ url: `${BASE}/r/${id}`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 });
  }
  // Also include the network-aware "sample receipt" path for one-off
  // crawler discovery — it's the canonical id the CTAs reference.
  if (![66, 68, 70].includes(sampleId)) {
    entries.push({ url: `${BASE}/r/${sampleId}`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 });
  }

  // Bundled data-room manifest — strangers can see the full room shape
  // (parties, storage root, key fingerprint, on-chain anchor) without
  // needing the operator's local FS. Bug-19 closure.
  entries.push({ url: `${BASE}/data-room/01KRP4EZ54Y611S7YZ0CGRK6VG`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 });

  // Low-priority legal/admin pages.
  for (const path of ['/privacy', '/terms']) {
    entries.push({ url: `${BASE}${path}`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 });
  }

  return entries;
}
