/**
 * v22 · Desktop 1440×900 browser-only sweep · what a judge with a desktop sees.
 *
 * Companion to v21 (mobile 375×812). No MM for read-only routes — judges
 * load these without connecting a wallet. For each surface we capture a
 * full-page screenshot, count chips, surface error words, click the first
 * visible CTA when present, and re-capture post-click.
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-desktop-sweep-v22');
mkdirSync(OUT, { recursive: true });
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

function log(m: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
}

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const safe = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(OUT, safe), fullPage: true });
    log(`📸 ${safe}`);
  } catch (e) {
    log(`screenshot fail: ${(e as Error).message.slice(0, 60)}`);
  }
}

const routes = [
  { path: '/thesis', label: 'thesis-narrative' },
  { path: '/verticals', label: 'verticals-index' },
  { path: '/legal', label: 'legal-cluster' },
  { path: '/agents', label: 'agents-list' },
  { path: '/global', label: 'global-stats' },
  { path: '/dashboard', label: 'dashboard-connect-cta' },
  { path: '/admin/treasury', label: 'admin-treasury-gate' },
  { path: '/admin/health', label: 'admin-health-public' },
];

async function inspectRoute(page: Page, r: { path: string; label: string }, results: any[]): Promise<void> {
  const url = `${STUDIO}${r.path}`;
  log(`\n=== ${r.path} ===`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(4_000);
    await snap(page, `route-${r.label}-loaded`);

    const title = await page.title().catch(() => '');
    const errorCount = await page.locator('text=/\\b(404|not found|server error|something went wrong)\\b/i').count().catch(() => 0);
    const chipsFound = await page.locator('text=/ANCHORED|TIER 1|TIER 2|0GM|VERIFIED|BURN MODE|MAINNET|TESTNET|FULLY VERIFIED/i').count().catch(() => 0);
    const buttonsVisible = await page.locator('button:visible, a:visible[role="button"]').count().catch(() => 0);
    const docHeight = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => 0);

    log(`  title="${title.slice(0, 50)}" · errors=${errorCount} · chips=${chipsFound} · buttons=${buttonsVisible} · h=${docHeight}`);

    // Try clicking the first visible nav/CTA button (not "Connect Wallet" since no MM here)
    const safeCtas = page.locator('a:visible:not([href*="wallet"]):not(:has-text("Connect"))').filter({ hasText: /view|learn|read|explore|details|see/i }).first();
    if (await safeCtas.isVisible({ timeout: 1_000 }).catch(() => false)) {
      const ctaText = await safeCtas.textContent().catch(() => '');
      log(`  → clicking CTA "${(ctaText || '').slice(0, 30)}"`);
      await safeCtas.click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(2_500);
      await snap(page, `route-${r.label}-post-cta`);
    }

    results.push({ route: r.path, title: title.slice(0, 60), errors: errorCount, chips: chipsFound, buttons: buttonsVisible, docHeight });
  } catch (err) {
    log(`  ✗ ${(err as Error).message.slice(0, 100)}`);
    results.push({ route: r.path, error: (err as Error).message.slice(0, 100) });
  }
}

async function main(): Promise<void> {
  log(`v22 · desktop 1440×900 sweep · ${routes.length} untested surfaces`);
  log(`Studio: ${STUDIO}`);

  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  const results: any[] = [];

  try {
    for (const r of routes) await inspectRoute(page, r, results);

    writeFileSync(resolve(OUT, 'final.json'), JSON.stringify({ viewport: '1440x900', studio: STUDIO, routes: results }, null, 2));
    log(`\n=== Summary ===`);
    for (const r of results) {
      if (r.error) log(`  ${r.route}: ✗ ${r.error}`);
      else log(`  ${r.route}: ${r.errors === 0 ? '✓' : '⚠'} title="${r.title.slice(0, 40)}" · chips=${r.chips} · buttons=${r.buttons}`);
    }
  } finally {
    await ctx.close().catch(() => {});
    log(`\n=== DONE ===`);
  }
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
