// E2E verification for planning-002 quick-wins batch (W1, W2, W7, W11, W12).
// Captures: home page hero (live count chip + 3 CTAs + verified-skills count),
// run panel (sample-contract button), stack band (0G DA honest qualifier).
// No MM required.

import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const SHOTS_DIR = resolve(REPO, 'screenshots', 'w-batch');
mkdirSync(SHOTS_DIR, { recursive: true });

let n = 0;
async function snap(page: Page, label: string): Promise<void> {
  n++;
  const name = `${String(n).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try { await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false }); console.log(`   ${name}`); }
  catch (e) { console.log(`   skip ${name}: ${(e as Error).message.slice(0, 60)}`); }
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  ctx.setDefaultNavigationTimeout(120_000);
  const page = await ctx.newPage();

  console.log('=== / · desktop ===');
  await page.goto('http://localhost:3300/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(5000);
  await snap(page, 'home-desktop-top');
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(700);
  await snap(page, 'home-desktop-stack-band');

  // W1 — click sample-contract button, then snap
  await page.goto('http://localhost:3300/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const sampleBtn = page.locator('button:has-text("Use sample contract")').first();
  if (await sampleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sampleBtn.click();
    await page.waitForTimeout(800);
    await snap(page, 'home-with-sample-loaded');
  }

  // Voice + content checks
  const text = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  const checks: Array<[string, RegExp]> = [
    ['W1 sample contract button', /Use sample contract/i],
    ['W2 live count chip', /\d{1,3}(,\d{3})* receipts on-chain · live/i],
    ['W7 alignment — verify command should be discoverable on home (not specific check, just hero stable)', /receipts on-chain/i],
    ['W11 verified skills count not literal "5"', /\b\d+\s+verified skills\b/i],
    ['W11 0G DA integration documented qualifier', /0G DA[\s\S]{0,80}integration documented/i],
    ['W12 Why Ivaronix CTA', /Why Ivaronix/i],
  ];
  for (const [label, rx] of checks) console.log(rx.test(text) ? `   ✓ ${label}` : `   ✗ ${label}`);

  // Mobile pass
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:3300/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await snap(page, 'home-mobile-top');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(700);
  await snap(page, 'home-mobile-stack-band');

  // Brand HTML side-by-side
  await page.setViewportSize({ width: 1440, height: 900 });
  const brandPath = resolve(REPO, 'brand', 'Ivaronix.html');
  await page.goto(`file:///${brandPath.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await snap(page, 'brand-html-desktop');

  await ctx.close();
  await browser.close();
  console.log('\n=== verify-w-batch complete ===');
})().catch((e: Error) => { console.error('FAIL:', e.message); process.exit(1); });
