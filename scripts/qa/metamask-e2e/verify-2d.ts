// E2E verification for planning-01 §2D (Studio /docs page).
// Captures /docs at desktop + mobile + brand HTML side-by-side. No MM needed.

import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const SHOTS_DIR = resolve(REPO, 'screenshots', '2d-docs');
mkdirSync(SHOTS_DIR, { recursive: true });

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const name = `${String(stepNum).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   ${name}`);
  } catch (e) {
    console.log(`   skipped ${name}: ${(e as Error).message.slice(0, 80)}`);
  }
}

async function visit(page: Page, path: string, settleMs = 4_000): Promise<void> {
  await page.goto(`http://localhost:3300${path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(settleMs);
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: SHOTS_DIR, size: { width: 1440, height: 900 } },
  });
  ctx.setDefaultTimeout(60_000);
  ctx.setDefaultNavigationTimeout(120_000);
  const page = await ctx.newPage();

  console.log('=== /docs · desktop ===');
  await visit(page, '/docs', 4_000);
  await snap(page, 'docs-desktop-top');
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(700);
  await snap(page, 'docs-desktop-mid');
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(700);
  await snap(page, 'docs-desktop-lower');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  await snap(page, 'docs-desktop-bottom');

  // Voice + content checks
  const docsText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  const checks: Array<[string, RegExp]> = [
    ['0G Chain card present', /0G Chain/i],
    ['0G Compute card present', /0G Compute/i],
    ['0G Storage card present', /0G Storage/i],
    ['0G Router card present', /0G Router/i],
    ['Agent ID card present', /Agent ID/i],
    ['0G DA roadmap-flagged', /0G DA[\s\S]{0,200}roadmap/i],
    ['receipt #1004 link', /receipt #1004/i],
    ['contract address shown', /0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c/],
  ];
  for (const [label, rx] of checks) console.log(rx.test(docsText) ? `   ✓ ${label}` : `   ✗ ${label}`);

  // No banned words
  const BANNED = ['delve', 'unlock', 'unleash', 'leverage', 'empower', 'seamless', 'harness', 'streamline', 'cutting-edge', 'state-of-the-art', 'revolutionize', 'robust'];
  const hits = BANNED.filter((w) => docsText.toLowerCase().includes(w));
  console.log(hits.length === 0 ? '   ✓ docs voice clean' : `   ✗ banned words: ${hits.join(', ')}`);

  // Mobile
  await page.setViewportSize({ width: 375, height: 812 });
  await visit(page, '/docs', 3_500);
  await snap(page, 'docs-mobile-top');
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(700);
  await snap(page, 'docs-mobile-mid');

  // Brand HTML
  await page.setViewportSize({ width: 1440, height: 900 });
  const brandPath = resolve(REPO, 'brand', 'Ivaronix.html');
  await page.goto(`file:///${brandPath.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4_000);
  await snap(page, 'brand-html-desktop');

  await ctx.close();
  await browser.close();
  console.log('\n=== verify-2d complete ===');
})().catch((e: Error) => { console.error('FAIL:', e.message); console.error(e.stack); process.exit(1); });
