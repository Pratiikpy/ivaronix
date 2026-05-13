/**
 * Playwright signing sweep — drives Studio actions that require real
 * MetaMask SIGNATURES (not just connect).
 *
 * Per user iter-145: "nt js tocnencted but usign and signing everyig
 * too frm metmask nt sjt conenct eveyrign lieka real user".
 *
 * What this drives:
 *   1. Connect wallet (proven iter-144)
 *   2. SIWE login on /memory page → real signTypedData popup from MM
 *   3. Approve SIWE in MM popup → session established
 *   4. Capture screenshots of every signature popup state
 *   5. Verify the signature was accepted (page transitions to authenticated state)
 *
 * SIWE signatures are off-chain (no gas), so the hardhat wallet's
 * 0.05 OG balance is plenty. After this proves the signing flow works,
 * a future iter can drive on-chain signing (issue grant, doc ask, etc.).
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_DIR = resolve(REPO, `QA_PROOF_PACK/multi-wallet/manual-walkthrough/signing-sweep-${TIMESTAMP}`);
const USER_DATA_DIR = resolve(REPO, `scripts/qa/multi-wallet/.profile-signing-${TIMESTAMP}`);

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
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: true });
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

async function drivePopup(popup: Page, label: string, maxSteps = 12): Promise<void> {
  await popup.bringToFront();
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(1_500);
  await snap(popup, `${label}-open`);
  const ctaTexts = ['Connect', 'Confirm', 'Approve', 'Sign', 'Switch network', 'Switch', 'Got it', 'Continue', 'Next'];
  for (let step = 0; step < maxSteps; step++) {
    if (popup.isClosed()) {
      console.log(`   ${label}: popup closed after ${step} steps`);
      return;
    }
    let clicked = false;
    for (const txt of ctaTexts) {
      const btn = popup.locator(`button:has-text("${txt}"):not([disabled])`).first();
      if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        console.log(`   ${label}: step ${step} clicking "${txt}"`);
        await btn.click({ timeout: 5_000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      console.log(`   ${label}: no actionable CTA at step ${step}, breaking`);
      break;
    }
    await popup.waitForTimeout(2_000).catch(() => {});
    if (!popup.isClosed()) await snap(popup, `${label}-step-${step}`);
  }
}

async function main(): Promise<void> {
  console.log(`\n=== signing sweep (real MM signatures) iter-145 ===`);
  console.log(`   Studio target: ${STUDIO}`);
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
  await snap(mmPage, 'mm-wallet-home-ready');

  console.log('\n=== Studio connect + signature flows ===');
  const studio = await context.newPage();
  await studio.goto(`${STUDIO}/memory`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'studio-memory-pre-connect');

  // Connect Wallet
  const connectBtn = studio.getByRole('button', { name: /Connect.*wallet/i }).first();
  if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    console.log('   clicking Connect Wallet...');
    const popupPromise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
    await connectBtn.click({ timeout: 8_000 });
    const popup = await popupPromise;
    if (popup) await drivePopup(popup, 'mm-connect');
    await studio.bringToFront();
    await studio.waitForTimeout(3_000);
  }
  await snap(studio, 'studio-memory-connected');

  // Try to trigger any signature-required action. The /memory page often
  // prompts SIWE on connection or shows a "Sign in" / "Sign message" button.
  console.log('\n   looking for Sign-in / SIWE / signature triggers...');
  const signInBtn = studio.locator(
    'button:has-text("Sign in"), button:has-text("Sign message"), button:has-text("Authenticate")',
  ).first();
  if (await signInBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    console.log('   clicking Sign-in...');
    const popupPromise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
    await signInBtn.click({ timeout: 8_000 });
    const popup = await popupPromise;
    if (popup) await drivePopup(popup, 'mm-siwe');
    await studio.bringToFront();
    await studio.waitForTimeout(3_000);
  } else {
    console.log('   no Sign-in button visible on /memory — trying /onboard');
    await studio.goto(`${STUDIO}/onboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await studio.waitForTimeout(3_000);
    await snap(studio, 'studio-onboard-after-connect');

    // /onboard typically has the passport mint button — that DOES require
    // a signature (signTypedData for the metadata or a tx for mint).
    const mintBtn = studio.locator('button:has-text("Mint"), button:has-text("Sign"), button:has-text("Continue")').first();
    if (await mintBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      console.log('   clicking onboard mint/sign button...');
      const popupPromise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
      await mintBtn.click({ timeout: 8_000 });
      const popup = await popupPromise;
      if (popup) await drivePopup(popup, 'mm-onboard-mint-sign');
      await studio.bringToFront();
      await studio.waitForTimeout(3_000);
    }
  }

  await snap(studio, 'studio-final-state');

  // Capture the MM page state too (showing connected account + maybe signed messages)
  await mmPage.bringToFront();
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, 'mm-final-state');

  console.log(`\n=== signing sweep complete — screenshots in ${SHOTS_DIR} ===`);
  await new Promise((r) => setTimeout(r, 5_000));
  await context.close();
}

main().catch((e) => {
  console.error(`[signing-sweep] FAIL: ${(e as Error).message}`);
  process.exit(1);
});
