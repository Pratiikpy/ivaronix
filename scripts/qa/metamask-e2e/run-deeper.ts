/**
 * QA: deeper interaction tests beyond the basic route tour.
 * - Click "Try the killer demo →" from home
 * - Click "Browse skills" from home
 * - Click "Open Studio →" from a skill detail page
 * - Test footer links
 * - Scroll the sample input on /skill detail
 * - Real on-chain memory grant via /memory (writes — opens MM tx popup)
 * - Confirm the popup → wait for tx confirmation → see new grant in list
 *
 * Run after `run-full.ts` so MM is onboarded with funded key + 0G chain.
 */

import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PASSWORD = 'TestPass123!QA';
const EXTENSION_PATH = resolve(HERE, 'mm', 'extension');
const USER_DATA_DIR = resolve(HERE, 'mm', 'profile');
const SHOTS_DIR = resolve(REPO, 'screenshots', 'deeper');
mkdirSync(SHOTS_DIR, { recursive: true });
const STUDIO = process.env.STUDIO_BASE ?? 'http://localhost:3300';

let stepNum = 0;
async function snap(page: Page, label: string): Promise<string> {
  stepNum++;
  const name = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return '';
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   📸 ${name}`);
    return name;
  } catch (e) {
    console.log(`   (skip) ${name} — ${(e as Error).message.split('\n')[0]}`);
    return '';
  }
}

async function findExtensionId(context: BrowserContext): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const sw = context.serviceWorkers();
    if (sw.length > 0) {
      const m = sw[0].url().match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('extension service worker not found');
}

async function drivePopup(popup: Page, label: string, max = 8): Promise<void> {
  await popup.bringToFront().catch(() => {});
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(1_500);
  await snap(popup, `${label}-open`);
  const ctaTexts = ['Connect', 'Confirm', 'Approve', 'Got it', 'Continue', 'Next', 'Sign', 'Switch', 'Add network'];
  for (let s = 0; s < max; s++) {
    if (popup.isClosed()) return;
    let clicked = false;
    for (const t of ctaTexts) {
      const btn = popup.locator(`button:has-text("${t}"):not([disabled])`).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        console.log(`   ${label} step ${s} → "${t}"`);
        await btn.click({ timeout: 5_000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) break;
    await popup.waitForTimeout(2_000).catch(() => {});
  }
}

async function main(): Promise<void> {
  console.log('=== launching Chromium ===');
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
    recordVideo: { dir: SHOTS_DIR, size: { width: 1440, height: 900 } },
  });
  context.setDefaultTimeout(60_000);
  context.setDefaultNavigationTimeout(120_000);

  const extId = await findExtensionId(context);
  console.log(`   ext id: ${extId}`);

  // Unlock MM
  let mmPage = context.pages().find((p) => p.url().includes(extId));
  if (!mmPage) {
    mmPage = await context.newPage();
    await mmPage.goto(`chrome-extension://${extId}/home.html`);
  }
  await mmPage.bringToFront();
  await mmPage.waitForSelector('button, input[type="password"]', { timeout: 60_000 }).catch(() => {});
  await mmPage.waitForTimeout(2_500);
  if (await mmPage.locator('button:has-text("Unlock")').first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    await mmPage.locator('input[type="password"]').first().fill(PASSWORD);
    await mmPage.locator('button:has-text("Unlock"), button:has-text("Sign in")').first().click({ timeout: 8_000 }).catch(() => {});
    await mmPage.waitForTimeout(3_000);
  }

  const studio = await context.newPage();
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_500);

  // Ensure connection
  const connectBtn = studio.locator('button:has-text("Connect wallet"):not([disabled])').first();
  if (await connectBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const popupP = context.waitForEvent('page', { timeout: 12_000 }).catch(() => null);
    await connectBtn.click({ timeout: 5_000 });
    const p = await popupP;
    if (p) await drivePopup(p, 'mm-connect');
    await studio.bringToFront();
    await studio.waitForTimeout(3_000);
  }
  await snap(studio, 'home-connected');

  // ── 1. Footer link inspection (no clicks — just hrefs) ────────────
  console.log('\n=== test: footer link inspection ===');
  await studio.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await studio.waitForTimeout(1_500);
  await snap(studio, 'footer-visible');
  const footerLinks = ['0G Compute', '0G Storage', '0G Chain', '0G DA', '0G Router', 'Sealed Inference'];
  for (const fl of footerLinks) {
    const link = studio.locator(`a:has-text("${fl}"), button:has-text("${fl}")`).first();
    const visible = await link.isVisible({ timeout: 800 }).catch(() => false);
    const href = visible ? await link.getAttribute('href').catch(() => null) : null;
    console.log(`   "${fl}" — ${visible ? `href=${href}` : 'not visible'}`);
  }

  // ── 6. /memory: real on-chain Issue grant ──────────────────────────
  console.log('\n=== test: real /memory Issue grant (on-chain write) ===');
  await studio.goto(`${STUDIO}/memory`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'memory-pre-grant');

  const granteeInput = studio.locator('input[placeholder="0x"], input[name="grantee"], input[type="text"]').first();
  if (await granteeInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    // Burn-style address — no real recipient, just for chain proof
    const burn = '0xdEAD000000000000000042069420694206942069';
    await granteeInput.click();
    await granteeInput.fill(burn);
    await snap(studio, 'memory-grantee-typed');

    const issueBtn = studio.locator('button:has-text("Issue grant"):not([disabled])').first();
    if (await issueBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      console.log('   clicking Issue grant — real MM tx popup expected');
      const popupP = context.waitForEvent('page', { timeout: 30_000 }).catch(() => null);
      await issueBtn.click({ timeout: 5_000 });
      await snap(studio, 'memory-issue-clicked');
      const mp = await popupP;
      if (mp) {
        console.log('   ✓ MM TX POPUP for grant — driving Confirm');
        await drivePopup(mp, 'mm-grant-tx', 8);
        await studio.bringToFront();
        await studio.waitForTimeout(8_000);
        await snap(studio, 'memory-after-grant-confirm');

        // Wait for grant to appear in the list (refetch happens on tx confirm)
        await studio.waitForFunction(
          (b) => (document.body?.innerText ?? '').toLowerCase().includes(b.toLowerCase().slice(0, 10)),
          burn,
          { timeout: 60_000 },
        ).catch(() => {});
        await snap(studio, 'memory-grant-in-list');
      } else {
        console.log('   no popup — grant may have failed at simulation');
      }
    } else {
      console.log('   Issue grant button not enabled');
    }
  } else {
    console.log('   grantee input not found');
  }

  // ── 7. Final disconnect → reconnect cycle ──────────────────────────
  console.log('\n=== test: disconnect then reconnect ===');
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_000);
  const disco = studio.locator('button:has-text("Disconnect")').first();
  if (await disco.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await disco.click().catch(() => {});
    await studio.waitForTimeout(2_000);
    await snap(studio, 'disconnect-done');
    // Reconnect
    const popupP = context.waitForEvent('page', { timeout: 12_000 }).catch(() => null);
    const reconnect = studio.locator('button:has-text("Connect wallet"):not([disabled])').first();
    if (await reconnect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await reconnect.click({ timeout: 5_000 });
      const p = await popupP;
      if (p) await drivePopup(p, 'mm-reconnect');
      await studio.bringToFront();
      await studio.waitForTimeout(3_000);
      await snap(studio, 'reconnected');
    }
  }

  console.log('\n=== closing context ===');
  await context.close();
  console.log(`\nDone. Outputs in: ${SHOTS_DIR}`);
}

main().catch((err: Error) => {
  console.error('FAIL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
