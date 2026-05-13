/**
 * Wrong-network UI handling per plan §748.
 *
 * MM v13.30 starts on Ethereum Mainnet by default. After onboarding,
 * we do NOT manually add Galileo. Then we visit Studio + try Connect.
 * Studio should prompt to switch to Galileo (chainId 16602) → MM popup
 * → click Switch → MM adds + switches to Galileo.
 *
 * Closes the PARTIAL item in plan §1370 scorecard.
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_DIR = resolve(REPO, `QA_PROOF_PACK/multi-wallet/manual-walkthrough/wrong-network-${TIMESTAMP}`);
const USER_DATA_DIR = resolve(REPO, `scripts/qa/multi-wallet/.profile-wrongnet-${TIMESTAMP}`);

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

async function drivePopup(popup: Page, label: string): Promise<{ steps: string[] }> {
  const steps: string[] = [];
  await popup.bringToFront();
  await popup.waitForTimeout(1_500);
  await snap(popup, `${label}-open`);
  const ctaTexts = ['Connect', 'Approve', 'Switch network', 'Switch to', 'Switch', 'Continue', 'Confirm', 'Approve', 'Sign', 'Got it', 'Next'];
  for (let step = 0; step < 10; step++) {
    if (popup.isClosed()) {
      steps.push('popup-closed');
      return { steps };
    }
    let clicked: string | null = null;
    for (const txt of ctaTexts) {
      const btn = popup.locator(`button:has-text("${txt}"):not([disabled])`).first();
      if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await btn.click({ timeout: 5_000 }).catch(() => {});
        clicked = txt;
        break;
      }
    }
    if (!clicked) {
      steps.push(`no-cta-at-step-${step}`);
      break;
    }
    steps.push(clicked);
    await popup.waitForTimeout(1_500).catch(() => {});
    if (!popup.isClosed()) await snap(popup, `${label}-step-${step}-${clicked.toLowerCase().replace(/\s+/g, '-')}`);
  }
  return { steps };
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
  console.log(`\n=== Wrong-network UI handling iter-152 ===`);
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
  console.log('=== onboarding MM (default network is Ethereum Mainnet — WRONG for Studio) ===');
  await onboardMM(mmPage, mmHomeUrl);
  await snap(mmPage, 'mm-on-default-eth-mainnet');
  console.log(`   MM URL after onboard: ${mmPage.url()}`);

  // === Visit Studio while MM is on wrong network ===
  console.log('\n=== visiting Studio while MM is on Ethereum (wrong network) ===');
  const studio = await context.newPage();
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'studio-home-wrong-network');

  // Click Connect — expect MM popup that walks through both Connect AND
  // a Switch-Network prompt because Studio requires Galileo (chainId 16602).
  console.log('   clicking Connect Wallet on wrong network...');
  const connectBtn = studio.getByRole('button', { name: /Connect.*wallet/i }).first();
  if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    // Listen for multiple popups — Connect popup + Switch-Network popup
    const popup1Promise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
    await connectBtn.click({ timeout: 8_000 });
    const popup1 = await popup1Promise;
    if (popup1) {
      console.log('   first MM popup detected — driving Connect + Switch-Network steps...');
      const { steps } = await drivePopup(popup1, 'mm-connect-and-switch');
      console.log(`   popup steps: ${steps.join(' → ')}`);
    }

    // Watch for a second popup (sometimes Switch-Network is a separate popup)
    const popup2Promise = context.waitForEvent('page', { timeout: 8_000 }).catch(() => null);
    await studio.waitForTimeout(2_000);
    const popup2 = await popup2Promise;
    if (popup2) {
      console.log('   second MM popup detected — driving Switch-Network...');
      const { steps } = await drivePopup(popup2, 'mm-switch-network-popup');
      console.log(`   popup2 steps: ${steps.join(' → ')}`);
    }

    await studio.bringToFront();
    await studio.waitForTimeout(3_000);
  } else {
    console.log('   no Connect button visible — Studio may already be in some other state');
  }
  await snap(studio, 'studio-after-connect-on-wrong-network');

  // Check what state MM is in now
  await mmPage.bringToFront();
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, 'mm-after-connect-attempt');
  console.log(`   MM URL after connect attempt: ${mmPage.url()}`);

  console.log(`\n=== wrong-network sweep complete ===`);
  console.log(`   screenshots: ${SHOTS_DIR}`);
  await new Promise((r) => setTimeout(r, 5_000));
  await context.close();
}

main().catch((e) => {
  console.error(`[wrong-network] FAIL: ${(e as Error).message}`);
  process.exit(1);
});
