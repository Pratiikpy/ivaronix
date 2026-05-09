// E2E verification for planning-01 §2B (memory consolidation lifecycle).
// Captures: /agent/<operator-wallet> with the new "memory consolidations"
// card, /r/1252 (the consolidation receipt itself), at desktop + mobile.
// No MetaMask interaction needed — the surfaces are public read-only.

import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const SHOTS_DIR = resolve(REPO, 'screenshots', '2b-consolidation');
mkdirSync(SHOTS_DIR, { recursive: true });

const OPERATOR = '0xaa954c33810029a3eFb0bf755FEF17863E8677Ce';
const CONSOLIDATION_RECEIPT_ID = 1252;

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

  // Desktop · /agent/<operator>
  console.log('=== /agent/<operator> · desktop ===');
  await visit(page, `/agent/${OPERATOR}`, 4_500);
  await snap(page, 'agent-desktop-top');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(700);
  await snap(page, 'agent-desktop-recent-activity');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  await snap(page, 'agent-desktop-consolidations');

  // Voice + content checks
  const agentText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  if (/memory consolidations/i.test(agentText)) {
    console.log('   ✓ "memory consolidations" section rendered');
  } else {
    console.log('   ✗ memory consolidations section missing');
  }
  if (/TEE · TIER 1|LOCAL · TIER 2/i.test(agentText)) {
    console.log('   ✓ honest tier badge rendered (TEE TIER 1 or LOCAL TIER 2)');
  } else {
    console.log('   ✗ tier badge missing');
  }

  // Desktop · /r/<consolidation-id>
  console.log('=== /r/1252 · consolidation receipt ===');
  await visit(page, `/r/${CONSOLIDATION_RECEIPT_ID}`, 4_500);
  await snap(page, 'r-1252-top');
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(700);
  await snap(page, 'r-1252-mid');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  await snap(page, 'r-1252-bottom');

  // Mobile
  console.log('=== Mobile pass ===');
  await page.setViewportSize({ width: 375, height: 812 });

  await visit(page, `/agent/${OPERATOR}`, 3_500);
  await snap(page, 'agent-mobile-top');
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(700);
  await snap(page, 'agent-mobile-consolidations');

  await visit(page, `/r/${CONSOLIDATION_RECEIPT_ID}`, 3_500);
  await snap(page, 'r-1252-mobile-top');

  // Side-by-side brand HTML
  console.log('=== Brand HTML reference ===');
  await page.setViewportSize({ width: 1440, height: 900 });
  const brandPath = resolve(REPO, 'brand', 'Ivaronix.html');
  await page.goto(`file:///${brandPath.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4_000);
  await snap(page, 'brand-html-desktop');

  await ctx.close();
  await browser.close();
  console.log('\n=== verify-2b complete ===');
})().catch((e: Error) => {
  console.error('FAIL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
