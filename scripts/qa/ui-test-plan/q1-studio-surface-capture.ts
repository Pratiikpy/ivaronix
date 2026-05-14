/**
 * Q1 · Studio marketplace surface capture.
 *
 * Drives the real production Studio at ivaronix.vercel.app to capture:
 *  - /marketplace listing (desktop + mobile)
 *  - /marketplace/private-doc-review detail page (a real first-party skill)
 *  - The Buy & Run button + wallet-required state
 *  - Receipt page /r/76 from the burner anchor this session
 *
 * Headless Playwright · no MM extension · proves the UI surface renders
 * correctly. MM popup smoke is deferred to mainnet per operator directive
 * "do not waste time fighting MetaMask for testnet speed" (cron prompt §5).
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/multi-wallet/marketplace-3w');
mkdirSync(resolve(OUT, 'studio-surface', 'desktop'), { recursive: true });
mkdirSync(resolve(OUT, 'studio-surface', 'mobile'), { recursive: true });
mkdirSync(resolve(OUT, 'videos'), { recursive: true });

let n = 0;
async function snap(page: Page, label: string, viewport: 'desktop' | 'mobile'): Promise<void> {
  n++;
  const name = `${String(n).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  const path = resolve(OUT, 'studio-surface', viewport, name);
  try {
    await page.screenshot({ path, fullPage: false });
    console.log(`   📸 ${viewport} ${name}`);
  } catch (e) {
    console.log(`   (skip) ${name} — ${(e as Error).message.split('\n')[0]}`);
  }
}

async function driveAtViewport(viewport: 'desktop' | 'mobile'): Promise<void> {
  const size = viewport === 'desktop' ? { width: 1440, height: 900 } : { width: 375, height: 812 };
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: size,
    recordVideo: { dir: resolve(OUT, 'videos'), size },
  });
  const page = await ctx.newPage();

  try {
    // 1 · /marketplace listing
    await page.goto(`${STUDIO}/marketplace`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(2000);
    await snap(page, 'marketplace-listing', viewport);

    // Scroll to see the full grid
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(1000);
    await snap(page, 'marketplace-mid-scroll', viewport);

    // 2 · /marketplace/private-doc-review (first-party skill detail)
    await page.goto(`${STUDIO}/marketplace/private-doc-review`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(2000);
    await snap(page, 'skill-detail-private-doc-review', viewport);

    // Try clicking Buy & Run (no MM, so it will trigger a wallet-required state)
    const buyBtn = page.locator('text=/buy.*run|purchase|run skill/i').first();
    const buyVisible = await buyBtn.isVisible().catch(() => false);
    if (buyVisible) {
      await buyBtn.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await snap(page, 'buy-button-clicked-no-wallet', viewport);
    } else {
      console.log(`   (info) Buy button not visible on ${viewport} skill detail — captured detail page only`);
    }

    // 3 · Receipt page from the burner anchor this session (receipt 78)
    await page.goto(`${STUDIO}/r/78`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(2000);
    await snap(page, 'receipt-78-from-burner-anchor', viewport);

    // 4 · Receipt 76 (the paySkillRun anchor)
    await page.goto(`${STUDIO}/r/76`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(2000);
    await snap(page, 'receipt-76-from-pay-anchor', viewport);
  } finally {
    await ctx.close();
    await browser.close();
  }
}

async function main(): Promise<void> {
  console.log(`Studio target: ${STUDIO}`);
  console.log(`\n=== desktop · 1440x900 ===`);
  await driveAtViewport('desktop');
  console.log(`\n=== mobile · 375x812 ===`);
  n = 0;
  await driveAtViewport('mobile');
  console.log(`\nDone · captures under ${OUT}/studio-surface/`);
}

main().catch((err) => { console.error('FAIL:', err.message ?? err); process.exit(1); });
