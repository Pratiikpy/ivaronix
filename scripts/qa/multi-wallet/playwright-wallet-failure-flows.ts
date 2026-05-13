/**
 * Playwright sweep for wallet failure flows (plan §1373):
 * - Disconnect wallet from Studio
 * - Wrong-network handling (switch MM to Ethereum mainnet, try protected action)
 * - Reconnect cleanly
 *
 * Closes the "2 PARTIAL" item in plan §1370 Minimum Launch Acceptance.
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_DIR = resolve(REPO, `QA_PROOF_PACK/multi-wallet/manual-walkthrough/failure-flows-${TIMESTAMP}`);
const USER_DATA_DIR = resolve(REPO, `scripts/qa/multi-wallet/.profile-failure-${TIMESTAMP}`);

mkdirSync(SHOTS_DIR, { recursive: true });
mkdirSync(USER_DATA_DIR, { recursive: true });

const DEV_SEED = 'test test test test test test test test test test test junk';
const PASSWORD = 'test1234567890';
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum += 1;
  const name = `${String(stepNum).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   📸 ${name}`);
  } catch (e) {
    console.log(`   (skip) ${name} — ${(e as Error).message.split('\n')[0]}`);
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
  throw new Error('MM service worker did not appear within 15s');
}

async function drivePopup(popup: Page, label: string): Promise<void> {
  await popup.bringToFront();
  await popup.waitForTimeout(1_500);
  await snap(popup, `${label}-open`);
  const ctaTexts = ['Connect', 'Confirm', 'Approve', 'Sign', 'Switch network', 'Switch'];
  for (let step = 0; step < 6; step++) {
    if (popup.isClosed()) return;
    let clicked = false;
    for (const txt of ctaTexts) {
      const btn = popup.locator(`button:has-text("${txt}"):not([disabled])`).first();
      if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await btn.click({ timeout: 5_000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) break;
    await popup.waitForTimeout(1_500).catch(() => {});
  }
}

async function onboardMM(mmPage: Page, mmHomeUrl: string): Promise<void> {
  await mmPage.locator('button:has-text("I have an existing wallet")').first()
    .click({ timeout: 15_000 }).catch(() => {});
  await mmPage.waitForTimeout(2_000);
  await mmPage.locator('button:has-text("No thanks"), button:has-text("Skip")').first()
    .click({ timeout: 5_000 }).catch(() => {});
  await mmPage.waitForTimeout(1_500);
  await mmPage.locator('button:has-text("Import using Secret Recovery Phrase"), button:has-text("Import using SRP")').first()
    .click({ timeout: 15_000 }).catch(() => {});
  await mmPage.waitForTimeout(2_000);
  await mmPage.locator('textarea').first().waitFor({ state: 'visible', timeout: 30_000 });
  await mmPage.locator('textarea').first().click();
  await mmPage.keyboard.type(DEV_SEED, { delay: 30 });
  await mmPage.waitForTimeout(1_000);
  await mmPage.locator('button[data-testid="import-srp-confirm"], button:has-text("Continue"), button:has-text("Import")').first()
    .click({ timeout: 15_000 });
  await mmPage.waitForTimeout(2_500);
  const pwds = mmPage.locator('input[type="password"]');
  await pwds.first().waitFor({ state: 'visible', timeout: 30_000 });
  await pwds.first().click();
  await mmPage.keyboard.type(PASSWORD, { delay: 20 });
  await pwds.nth(1).click();
  await mmPage.keyboard.type(PASSWORD, { delay: 20 });
  const lossAck = mmPage.locator('input[type="checkbox"]').first();
  if (await lossAck.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await lossAck.check({ force: true }).catch(() => {});
  }
  await mmPage.locator('button:has-text("Create password"), button:has-text("Import my wallet")').first()
    .click({ timeout: 15_000 });
  await mmPage.waitForTimeout(3_000);
  for (let i = 0; i < 12; i++) {
    const cta = mmPage.locator(
      'button:has-text("Got it"), button:has-text("Done"), button:has-text("Next"), button:has-text("Continue"), button:has-text("Skip"), button:has-text("Manage default settings"), button:has-text("Open wallet")',
    ).first();
    if (await cta.isVisible({ timeout: 2_500 }).catch(() => false)) {
      await cta.click().catch(() => {});
      await mmPage.waitForTimeout(1_500);
    } else break;
  }
  if (mmPage.url().includes('/onboarding/')) {
    await mmPage.goto(mmHomeUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
    await mmPage.waitForTimeout(3_000);
  }
}

async function main(): Promise<void> {
  console.log(`\n=== Wallet failure flows iter-151 ===`);
  console.log(`   Studio: ${STUDIO}`);
  console.log(`   screenshots: ${SHOTS_DIR}\n`);

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

  const extId = await findExtensionId(context);
  const mmHomeUrl = `chrome-extension://${extId}/home.html`;
  let mmPage = context.pages().find((p) => p.url().includes(extId));
  if (!mmPage) {
    mmPage = await context.newPage();
    await mmPage.goto(mmHomeUrl + '#onboarding/welcome');
  }
  await mmPage.bringToFront();
  await mmPage.waitForTimeout(3_000);
  console.log('=== onboarding MM ===');
  await onboardMM(mmPage, mmHomeUrl);
  await snap(mmPage, 'mm-ready');

  // === STEP 1: Connect MM to Studio ===
  console.log('\n=== step 1 · Connect ===');
  const studio = await context.newPage();
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'studio-pre-connect');

  const connectBtn = studio.getByRole('button', { name: /Connect.*wallet/i }).first();
  if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const popupPromise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
    await connectBtn.click({ timeout: 8_000 });
    const popup = await popupPromise;
    if (popup) await drivePopup(popup, 'mm-connect');
    await studio.bringToFront();
    await studio.waitForTimeout(3_000);
  }
  await snap(studio, 'studio-connected');

  // === STEP 2: Disconnect ===
  console.log('\n=== step 2 · Disconnect ===');
  // Studio's disconnect button is typically in the header — find "Disconnect" or the connected-address chip menu.
  const disconnectBtn = studio.getByRole('button', { name: /Disconnect/i }).first();
  if (await disconnectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    console.log('   clicking Disconnect...');
    await disconnectBtn.click({ timeout: 5_000 }).catch(() => {});
    await studio.waitForTimeout(2_500);
  } else {
    // Address chip might need to be clicked first to reveal a menu
    console.log('   no Disconnect button visible; trying address-chip menu');
    const addrChip = studio.locator('button').filter({ hasText: /0x[a-fA-F0-9]{4}/ }).first();
    if (await addrChip.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await addrChip.click().catch(() => {});
      await studio.waitForTimeout(1_500);
      await snap(studio, 'studio-addr-chip-menu');
      const disc2 = studio.getByRole('button', { name: /Disconnect/i }).first();
      if (await disc2.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await disc2.click().catch(() => {});
        await studio.waitForTimeout(2_000);
      }
    }
  }
  await snap(studio, 'studio-after-disconnect');

  // Verify: Connect Wallet button should be visible again
  const reConnectBtn = studio.getByRole('button', { name: /Connect.*wallet/i }).first();
  const isReConnectVisible = await reConnectBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  console.log(`   Connect Wallet visible after disconnect: ${isReConnectVisible}`);

  // === STEP 3: Reconnect ===
  console.log('\n=== step 3 · Reconnect ===');
  if (isReConnectVisible) {
    const popupPromise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
    await reConnectBtn.click({ timeout: 8_000 });
    const popup = await popupPromise;
    if (popup) await drivePopup(popup, 'mm-reconnect');
    await studio.bringToFront();
    await studio.waitForTimeout(3_000);
  }
  await snap(studio, 'studio-reconnected');

  // === STEP 4: Wrong network handling ===
  console.log('\n=== step 4 · Wrong-network handling ===');
  // Switch MM to a different network (Ethereum mainnet is default — switch away from Galileo)
  await mmPage.bringToFront();
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, 'mm-before-switch-network');

  // Click MM's network picker (top-left typically · "Ethereum Mainnet" or "Galileo")
  const networkPicker = mmPage.locator('[data-testid="network-display"], button:has-text("Ethereum"), button:has-text("Galileo"), button:has-text("0G")').first();
  if (await networkPicker.isVisible({ timeout: 5_000 }).catch(() => false)) {
    console.log('   opening network picker...');
    await networkPicker.click();
    await mmPage.waitForTimeout(2_000);
    await snap(mmPage, 'mm-network-picker-open');
    // Pick Ethereum Mainnet (or any default-non-Galileo network)
    const ethRow = mmPage.locator('button:has-text("Ethereum"), [data-testid*="network-list"]:has-text("Ethereum")').first();
    if (await ethRow.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await ethRow.click().catch(() => {});
      await mmPage.waitForTimeout(2_000);
      await snap(mmPage, 'mm-switched-to-ethereum');
    }
  }

  // Now visit Studio · expect to see "switch to Galileo" prompt OR app handles wrong-network state
  await studio.bringToFront();
  await studio.goto(`${STUDIO}/memory`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'studio-memory-with-wrong-network');

  // Try triggering protected action — if Studio prompts switch-network, popup will appear
  const anyBtn = studio.locator('button:not([disabled])').filter({ hasText: /Switch|Issue|Run|Connect|Action|Sign in/ }).first();
  if (await anyBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const popupPromise = context.waitForEvent('page', { timeout: 8_000 }).catch(() => null);
    await anyBtn.click({ timeout: 5_000 }).catch(() => {});
    const popup = await popupPromise;
    if (popup) {
      await snap(popup, 'mm-switch-network-popup');
      await drivePopup(popup, 'mm-switch-network');
    }
    await studio.bringToFront();
    await studio.waitForTimeout(3_000);
  }
  await snap(studio, 'studio-after-network-action');

  console.log(`\n=== failure flows sweep complete ===`);
  console.log(`   screenshots: ${SHOTS_DIR}`);
  await new Promise((r) => setTimeout(r, 5_000));
  await context.close();
}

main().catch((e) => {
  console.error(`[wallet-failure-flows] FAIL: ${(e as Error).message}`);
  process.exit(1);
});
