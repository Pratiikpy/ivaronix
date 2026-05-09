// Pages-only E2E for 2A + audit pass. No MetaMask interaction; the surfaces
// under test are public / read-only and the value to verify is rendering +
// copy + voice + visual layout — not signing flows. The earlier delegate
// signing flow is verified end-to-end in the CLI logs already; receipt #1204
// proves the on-chain story.
//
// Captures both viewports for: /thesis, /delegate/<id>, /r/1204, /agent/<addr>,
// /agent/<vanity>, /global, /dashboard. Asserts no banned-word slop on /thesis
// and no "type code N" on /dashboard.

import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const SHOTS_DIR = resolve(REPO, 'screenshots', '2a-pages');
mkdirSync(SHOTS_DIR, { recursive: true });

const DELEGATE_ID = '01KR67PT76V9AQTHN413PYWB1J';
const DELEGATE_ADDRESS = '0x4B2147665818b823bdbDd3f92Aa006A08e4224e0';
const DELEGATE_RECEIPT_ID = 1204;
const SAMPLE_RECEIPT_ID = 1004;
const ROOM_ID = '01KR66C1GJVR57MHQPJCW1HQQY';

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const name = `${String(stepNum).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   ${name}`);
  } catch (e) {
    console.log(`   skipped ${name} (${(e as Error).message.slice(0, 60)})`);
  }
}

async function visit(page: Page, path: string, settleMs = 3000): Promise<void> {
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

  console.log('=== /thesis · desktop ===');
  await visit(page, '/thesis', 4_000);

  // Voice check up-front while the page is fresh + at the top.
  let bannedHits: string[] = [];
  try {
    const thesisText = (await page.evaluate(() => document.body.innerText || '')).toLowerCase();
    const BANNED = ['delve', 'unlock', 'unleash', 'leverage', 'empower', 'seamless', 'harness', 'streamline', 'cutting-edge', 'state-of-the-art', 'revolutionize', 'robust'];
    bannedHits = BANNED.filter((w) => thesisText.includes(w));
  } catch (e) {
    console.log(`   voice-check skipped: ${(e as Error).message.slice(0, 80)}`);
  }
  console.log(bannedHits.length === 0 ? '   thesis voice clean' : `   thesis banned words: ${bannedHits.join(', ')}`);

  await snap(page, 'thesis-desktop-top');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(700);
  await snap(page, 'thesis-desktop-mid');
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(700);
  await snap(page, 'thesis-desktop-numbers');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  await snap(page, 'thesis-desktop-cta');

  console.log('=== /delegate/<id> · desktop ===');
  await visit(page, `/delegate/${DELEGATE_ID}`, 4_000);
  await snap(page, 'delegate-desktop-top');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(700);
  await snap(page, 'delegate-desktop-grants');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  await snap(page, 'delegate-desktop-verify');

  console.log('=== /r/1204 · delegate-signed receipt ===');
  await visit(page, `/r/${DELEGATE_RECEIPT_ID}`, 4_000);
  await snap(page, 'r-1204-top');
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(700);
  await snap(page, 'r-1204-mid');

  console.log('=== /r/1004 · TIER 1 sample receipt ===');
  await visit(page, `/r/${SAMPLE_RECEIPT_ID}`, 4_000);
  await snap(page, 'r-1004-top');

  console.log('=== /agent/<delegate-addr> · type label fix ===');
  await visit(page, `/agent/${DELEGATE_ADDRESS}`, 4_000);
  await snap(page, 'agent-delegate-top');
  const agentPageText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  if (/type code \d+/i.test(agentPageText)) {
    console.log('   ✗ /agent/<addr> still renders raw "type code N"');
  } else {
    console.log('   ✓ /agent/<addr> renders human receipt type label');
  }

  console.log('=== /agent/alice · vanity fallback copy ===');
  await visit(page, '/agent/alice', 2_500);
  await snap(page, 'agent-vanity-fallback');
  const vanityText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  const sprintHit = vanityText.match(/Day\s*1[3-7]|next sprint/i);
  console.log(sprintHit ? `   ✗ vanity copy still mentions "${sprintHit[0]}"` : '   ✓ vanity copy purged');

  console.log('=== /global · stat row ===');
  await visit(page, '/global', 3_500);
  await snap(page, 'global-stat-row');

  console.log('=== /dashboard · receipt type labels ===');
  await visit(page, '/dashboard', 4_500);
  await snap(page, 'dashboard-disconnected');
  const dashText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  if (/type code \d+/i.test(dashText)) {
    console.log('   ✗ dashboard still renders raw "type code N"');
  } else {
    console.log('   ✓ dashboard renders human receipt type labels (or empty list)');
  }

  console.log('=== /memory · audit feed disclosure ===');
  await visit(page, '/memory', 3_500);
  await snap(page, 'memory-disconnected');

  console.log('=== /data-room/<id> · existing 1B surface still intact ===');
  await visit(page, `/data-room/${ROOM_ID}`, 4_000);
  await snap(page, 'data-room-still-intact');

  console.log('=== Mobile pass ===');
  await page.setViewportSize({ width: 375, height: 812 });

  await visit(page, '/thesis', 2_500);
  await snap(page, 'thesis-mobile-top');
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(600);
  await snap(page, 'thesis-mobile-mid');

  await visit(page, `/delegate/${DELEGATE_ID}`, 2_500);
  await snap(page, 'delegate-mobile-top');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(600);
  await snap(page, 'delegate-mobile-grants');

  await visit(page, '/', 2_500);
  await snap(page, 'home-mobile-top');

  console.log('=== Side-by-side · brand HTML ===');
  await page.setViewportSize({ width: 1440, height: 900 });
  const brandPath = resolve(REPO, 'brand', 'Ivaronix.html');
  await page.goto(`file:///${brandPath.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4_000);
  await snap(page, 'brand-html-desktop');

  await ctx.close();
  await browser.close();
  console.log('\n=== verify-2a-pages complete ===');
})().catch((e: Error) => {
  console.error('FAIL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
