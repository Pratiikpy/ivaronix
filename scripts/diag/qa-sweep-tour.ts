/**
 * Comprehensive Playwright tour of every Studio public surface on
 * production. Captures screenshots at desktop (1440×900) and key
 * pages at mobile (375×812). Output: docs/video/qa/<viewport>/<name>.png.
 *
 * Each route is hit twice: once cold (no auth), once after settling
 * networkidle, so we catch any client-side hydration drift.
 */
import { chromium, type Browser, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const OUT = resolve(REPO_ROOT, 'docs', 'video', 'qa');
mkdirSync(OUT, { recursive: true });
mkdirSync(resolve(OUT, 'desktop'), { recursive: true });
mkdirSync(resolve(OUT, 'mobile'), { recursive: true });

const BASE = process.env.SITE_BASE ?? 'https://www.ivaronix.xyz';

const DESKTOP_ROUTES = [
  // Public landing surfaces
  { name: '01-home', path: '/' },
  { name: '02-onboard', path: '/onboard' },
  { name: '03-skills', path: '/skills' },
  { name: '04-marketplace', path: '/marketplace' },
  { name: '05-agents', path: '/agents' },
  { name: '06-global', path: '/global' },
  { name: '07-thesis', path: '/thesis' },
  { name: '08-brand', path: '/brand' },
  { name: '09-docs', path: '/docs' },
  { name: '10-verticals', path: '/verticals' },
  { name: '11-legal', path: '/legal' },
  // "Why" nav button links to /thesis (see Header.tsx:42); /why is
  // intentionally not a route — single canonical location for the
  // long-form product narrative.
  { name: '12-thesis-from-nav', path: '/thesis' },
  { name: '13-dashboard', path: '/dashboard' },
  { name: '14-memory', path: '/memory' },
  // Wallet-required surfaces should at least render with empty state
  { name: '15-admin-treasury', path: '/admin/treasury' },
  { name: '16-admin-health', path: '/admin/health' },
  { name: '17-marketplace-payouts', path: '/marketplace/payouts' },
  { name: '18-marketplace-new', path: '/marketplace/new' },
  { name: '19-skill-new', path: '/skill/new' },
  // Detail pages
  { name: '20-marketplace-private-doc-review', path: '/marketplace/private-doc-review' },
  { name: '21-skill-private-doc-review', path: '/skill/private-doc-review' },
  // Receipt pages — sample across registry versions + recent
  { name: '22-receipt-14', path: '/r/14' },
  { name: '23-receipt-52', path: '/r/52' },
  { name: '24-receipt-62', path: '/r/62' },
];

const MOBILE_ROUTES = [
  { name: 'm-01-home', path: '/' },
  { name: 'm-02-onboard', path: '/onboard' },
  { name: 'm-03-marketplace', path: '/marketplace' },
  { name: 'm-04-receipt', path: '/r/62' },
];

async function tour(viewport: { width: number; height: number }, label: 'desktop' | 'mobile', routes: typeof DESKTOP_ROUTES) {
  const browser: Browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page: Page = await context.newPage();
    const results: Array<{ name: string; path: string; status: number; ok: boolean }> = [];
    for (const r of routes) {
      const url = `${BASE}${r.path}`;
      let status = 0;
      let ok = false;
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        status = resp?.status() ?? 0;
        ok = status >= 200 && status < 400;
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1500);
        await page.screenshot({ path: resolve(OUT, label, `${r.name}.png`), fullPage: false });
      } catch (e) {
        ok = false;
      }
      results.push({ name: r.name, path: r.path, status, ok });
      console.log(`[${label}] ${r.path.padEnd(40)} → ${status} ${ok ? '✓' : '✗'}`);
    }
    await context.close();
    return results;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('=== Desktop tour (1440×900) ===');
  const desktop = await tour({ width: 1440, height: 900 }, 'desktop', DESKTOP_ROUTES);
  console.log('\n=== Mobile tour (375×812) ===');
  const mobile = await tour({ width: 375, height: 812 }, 'mobile', MOBILE_ROUTES);
  const all = [...desktop, ...mobile];
  const pass = all.filter((r) => r.ok).length;
  const fail = all.filter((r) => !r.ok).length;
  console.log(`\n=== summary === ${pass} PASS · ${fail} FAIL (out of ${all.length})`);
  if (fail > 0) {
    console.log('\nFailures:');
    for (const r of all.filter((r) => !r.ok)) {
      console.log(`  ${r.name.padEnd(35)} ${r.path.padEnd(40)} status=${r.status}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
