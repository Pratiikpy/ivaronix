// E2E verification for planning-01 §2C (cron-scheduled skill execution).
// Uses the new ?address= dashboard query (Phase A · public chain state),
// so no MetaMask is required to render the connected-state card view.

import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const SHOTS_DIR = resolve(REPO, 'screenshots', '2c-schedule');
mkdirSync(SHOTS_DIR, { recursive: true });

const SCHEDULE_RECEIPT_ID = 1262;
const OPERATOR = '0xaa954c33810029a3eFb0bf755FEF17863E8677Ce';

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

  // Disconnected state first
  await visit(page, '/dashboard', 3_500);
  await snap(page, 'dashboard-disconnected');

  // Use the ?address= query — public-chain-state path, no MetaMask
  await visit(page, `/dashboard?address=${OPERATOR}`, 4_000);
  // Wait for the dashboard's loading message to disappear (chain RPC is slow).
  await page.waitForFunction(
    () => !/Loading from chain/i.test(document.body.innerText || ''),
    { timeout: 30_000 },
  ).catch(() => console.log('   (loading wait timed out — capturing whatever rendered)'));
  await page.waitForTimeout(1_500);

  await snap(page, 'dashboard-via-address-query-top');
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(800);
  await snap(page, 'dashboard-via-address-query-mid');
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(800);
  await snap(page, 'dashboard-via-address-query-schedules');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await snap(page, 'dashboard-via-address-query-bottom');

  const dashText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  console.log(/scheduled runs/i.test(dashText) ? '   ✓ scheduled runs card rendered' : '   ✗ schedules card missing');
  console.log(/0 9 \* \* MON/.test(dashText) ? '   ✓ cron expression rendered' : '   ⓘ cron not visible (may need scroll)');
  console.log(/private-doc-review/.test(dashText) ? '   ✓ scheduled skill id rendered' : '   ✗ skill id missing');

  // Visit the receipt produced by the schedule fire
  await visit(page, `/r/${SCHEDULE_RECEIPT_ID}`, 4_500);
  await snap(page, 'r-1262-fired-by-schedule');

  // Mobile pass
  await page.setViewportSize({ width: 375, height: 812 });
  await visit(page, `/dashboard?address=${OPERATOR}`, 4_500);
  await snap(page, 'dashboard-mobile-top');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(700);
  await snap(page, 'dashboard-mobile-schedules');

  // Brand HTML
  await page.setViewportSize({ width: 1440, height: 900 });
  const brandPath = resolve(REPO, 'brand', 'Ivaronix.html');
  await page.goto(`file:///${brandPath.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4_000);
  await snap(page, 'brand-html-desktop');

  await ctx.close();
  await browser.close();
  console.log('\n=== verify-2c complete ===');
})().catch((e: Error) => { console.error('FAIL:', e.message); console.error(e.stack); process.exit(1); });
