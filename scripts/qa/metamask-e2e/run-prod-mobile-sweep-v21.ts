/**
 * v21 · Mobile 375×812 (iPhone) browser-only sweep · what a judge with iPhone Safari sees.
 *
 * No MM (real iPhone users use MetaMask Mobile app, not the Chrome extension).
 * Just renders every Studio route at iPhone viewport + captures full-page screenshots.
 * Inspects: layout breaks, tap-target reachability, hero density, chip rendering.
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-mobile-sweep-v21');
mkdirSync(OUT, { recursive: true });
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

function log(m: string): void { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const safe = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try { await page.screenshot({ path: resolve(OUT, safe), fullPage: true }); log(`📸 ${safe}`); } catch {}
}

const routes = [
  '/', '/onboard', '/skills', '/memory', '/marketplace', '/dashboard',
  '/global', '/agents', '/thesis', '/brand', '/docs', '/privacy', '/terms',
  '/verticals', '/legal', '/admin/treasury', '/admin/health', '/skill/new',
  '/marketplace/payouts', '/r/1', '/r/2', '/r/3', '/r/4', '/r/5',
];

async function main(): Promise<void> {
  log(`v21 · mobile 375×812 sweep · iPhone Safari simulation`);
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  const results: any[] = [];

  try {
    for (const r of routes) {
      const url = `${STUDIO}${r}`;
      log(`\n=== ${r} ===`);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForTimeout(4_000);
        await snap(page, `route${r.replace(/\//g, '-')}`);

        const title = await page.title().catch(() => '');
        const hasErrors = await page.locator('text=/error|404|not found|invalid/i').count().catch(() => 0);
        const docHeight = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => 0);
        const hamburgerVisible = await page.locator('button[aria-label*="menu" i], button:has-text("☰"), [data-mobile-menu], button[aria-label*="navigation" i]').first().isVisible({ timeout: 500 }).catch(() => false);
        const chipsFound = await page.locator('text=/ANCHORED|TIER 1|TIER 2|0GM|VERIFIED|BURN MODE/i').count().catch(() => 0);

        results.push({ route: r, title: title.slice(0, 60), errors: hasErrors, docHeight, hamburgerVisible, chipsFound });
        log(`  title="${title.slice(0, 40)}" · errors=${hasErrors} · h=${docHeight} · hamburger=${hamburgerVisible} · chips=${chipsFound}`);
      } catch (err) {
        results.push({ route: r, error: (err as Error).message.slice(0, 100) });
        log(`  ✗ ${(err as Error).message.slice(0, 100)}`);
      }
    }
    writeFileSync(resolve(OUT, 'final.json'), JSON.stringify({ viewport: '375x812', deviceScaleFactor: 3, userAgent: 'iPhone Safari', studio: STUDIO, routes: results }, null, 2));
    log(`\n=== Summary ===`);
    for (const r of results) {
      if (r.error) log(`  ${r.route}: ✗ ${r.error}`);
      else log(`  ${r.route}: ${r.errors === 0 ? '✓' : '⚠'} ${r.title.slice(0, 40)} h=${r.docHeight} ham=${r.hamburgerVisible} chips=${r.chipsFound}`);
    }
  } finally {
    await ctx.close().catch(() => {});
    log(`=== DONE ===`);
  }
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
