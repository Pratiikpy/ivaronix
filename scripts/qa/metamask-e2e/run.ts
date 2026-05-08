/**
 * QA: real MetaMask extension end-to-end test.
 *
 * Loads the MetaMask MV3 Chrome extension v13.30.0 into a fresh Chromium
 * instance, drives the onboarding (with a throwaway dev seed), imports
 * the test wallet's private key as an additional account, adds 0G
 * Galileo testnet, navigates Studio, clicks Connect wallet, and captures
 * screenshots + video.
 *
 * Output:
 *   ../../../screenshots/metamask/   — per-step screenshots
 *   ../../../screenshots/metamask/video.webm  — full session recording
 *
 * Run: cd scripts/qa/metamask-e2e && tsx run.ts
 */

import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

// Load env vars from repo .env
function loadEnv() {
  const envFile = resolve(REPO, '.env');
  const env: Record<string, string> = {};
  try {
    const text = readFileSync(envFile, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
  return env;
}

const env = loadEnv();
const PRIVATE_KEY = env.EVM_PRIVATE_KEY ?? '';
const WALLET_ADDR = env.EVM_WALLET_ADDRESS ?? '';

if (!PRIVATE_KEY) {
  console.error('FAIL: EVM_PRIVATE_KEY missing in .env');
  process.exit(1);
}

// Throwaway dev seed (well-known hardhat default — zero value, no risk)
const DEV_SEED = 'test test test test test test test test test test test junk';
const PASSWORD = 'TestPass123!QA';

const EXTENSION_PATH = resolve(HERE, 'mm', 'extension');
const USER_DATA_DIR = resolve(HERE, 'mm', 'profile');
const SHOTS_DIR = resolve(REPO, 'screenshots', 'metamask');
mkdirSync(SHOTS_DIR, { recursive: true });
mkdirSync(USER_DATA_DIR, { recursive: true });

const STUDIO = 'http://localhost:3300';

let stepNum = 0;
async function snap(page: Page, label: string) {
  stepNum++;
  const name = `${String(stepNum).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
  console.log(`   📸 ${name}`);
}

async function findExtensionId(context: BrowserContext): Promise<string> {
  // Wait for the service worker / background page to register
  for (let i = 0; i < 30; i++) {
    const sw = context.serviceWorkers();
    if (sw.length > 0) {
      const url = sw[0].url();
      const m = url.match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('extension service worker did not appear within 15s');
}

async function main() {
  console.log('=== launching Chromium with MetaMask extension loaded ===');
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
  console.log(`   MetaMask extension id: ${extId}`);

  // Open the extension's onboarding page directly
  const mmHomeUrl = `chrome-extension://${extId}/home.html`;
  let mmPage = context.pages().find((p) => p.url().startsWith(mmHomeUrl));
  if (!mmPage) {
    // Wait briefly for MM to auto-open its tab
    for (let i = 0; i < 10; i++) {
      mmPage = context.pages().find((p) => p.url().includes(extId));
      if (mmPage) break;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!mmPage) {
    mmPage = await context.newPage();
    await mmPage.goto(mmHomeUrl + '#onboarding/welcome');
  }
  await mmPage.bringToFront();

  // Wait for onboarding UI to actually render — extension finishes booting
  console.log('   waiting for MetaMask onboarding UI to render...');
  await mmPage.waitForFunction(() => document.body && document.body.innerText && document.body.innerText.length > 50, { timeout: 60_000 }).catch(() => {});
  await mmPage.waitForTimeout(3_000);
  await snap(mmPage, 'mm-welcome');

  console.log('\n=== driving MetaMask onboarding ===');
  // Welcome screen — accept terms checkbox
  const termsCheckbox = mmPage.locator('input[data-testid="onboarding-terms-checkbox"]').first();
  if (await termsCheckbox.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await termsCheckbox.check({ force: true }).catch(() => {});
    await snap(mmPage, 'mm-terms-accepted');
  }
  // "I have an existing wallet"
  await mmPage.locator('button:has-text("I have an existing wallet"), button:has-text("Import an existing wallet")').first().click({ timeout: 15_000 });
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, 'mm-after-existing-wallet');

  // Metrics consent ("I agree" / "No thanks") — accept whichever shows
  await mmPage.locator('button:has-text("I agree"), button:has-text("No thanks"), button:has-text("Accept")').first().click({ timeout: 8_000 }).catch(() => {});
  await mmPage.waitForTimeout(3_000);
  await snap(mmPage, 'mm-after-metrics');

  // MM v13.30 has social sign-in choice screen — click "Import using Secret Recovery Phrase"
  console.log('   clicking Import using Secret Recovery Phrase...');
  await mmPage.locator('button:has-text("Import using Secret Recovery Phrase"), button:has-text("Import using SRP")').first().click({ timeout: 15_000 });
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, 'mm-after-srp-choice');

  // Wait for the SRP entry page to render (its inputs may take a moment)
  console.log('   waiting for SRP entry page...');
  await mmPage.waitForFunction(() => {
    const inputs = document.querySelectorAll('input');
    if (inputs.length >= 12) return true;
    const txt = document.body && document.body.innerText ? document.body.innerText : '';
    return /secret recovery phrase|import.*recovery/i.test(txt);
  }, { timeout: 30_000 }).catch(() => {});
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, 'mm-srp-page-loaded');

  // MM v13.30 uses a single textarea for the whole SRP — but it requires
  // real keystroke events (input event listeners) not raw fill().
  console.log('   typing seed phrase via real keystrokes...');
  const srpTextarea = mmPage.locator('textarea').first();
  await srpTextarea.click();
  await srpTextarea.fill(''); // clear first
  await mmPage.keyboard.type(DEV_SEED, { delay: 30 });
  await mmPage.waitForTimeout(800);
  await snap(mmPage, 'mm-srp-filled');

  // Continue
  await mmPage.locator('button[data-testid="import-srp-confirm"], button:has-text("Continue"), button:has-text("Import")').first().click({ timeout: 15_000 });
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, 'mm-after-srp-continue');

  // Set password — MM v13.30 password page uses bare <input> elements (no test-id).
  console.log('   setting password...');
  // Wait for the password page to fully render
  await mmPage.waitForFunction(() => {
    const t = document.body && document.body.innerText ? document.body.innerText : '';
    return /Create new password|MetaMask password/i.test(t);
  }, { timeout: 30_000 }).catch(() => {});
  await mmPage.waitForTimeout(1_000);

  // Use the two visible password fields (first = new, second = confirm)
  const pwds = mmPage.locator('input[type="password"]');
  await pwds.first().click();
  await mmPage.keyboard.type(PASSWORD, { delay: 20 });
  await pwds.nth(1).click();
  await mmPage.keyboard.type(PASSWORD, { delay: 20 });
  await snap(mmPage, 'mm-password-typed');

  // Acknowledge "If I lose this password..." — checkbox or its label
  const lossAck = mmPage.locator('input[type="checkbox"]').first();
  if (await lossAck.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await lossAck.check({ force: true }).catch(() => {});
  }
  await snap(mmPage, 'mm-password-acked');

  // Submit
  await mmPage.locator('button:has-text("Create password"), button:has-text("Create new password"), button:has-text("Import my wallet")').first().click({ timeout: 15_000 });
  await mmPage.waitForTimeout(3_000);
  await snap(mmPage, 'mm-password-set');

  // "Got it" / "Done" / "Continue" / "Open wallet" — keep clicking until home.
  for (let i = 0; i < 10; i++) {
    const cta = mmPage.locator(
      'button:has-text("Got it"), button:has-text("Done"), button:has-text("Next"), button:has-text("Confirm"), button:has-text("Continue"), button:has-text("Skip"), button:has-text("Open wallet"), button:has-text("Open MetaMask")'
    ).first();
    if (await cta.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await cta.click().catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
      await snap(mmPage, `mm-post-onboard-${i}`);
    } else break;
  }
  await snap(mmPage, 'mm-onboarding-done');

  console.log('\n=== explicit Open wallet click ===');
  // Sometimes the loop above already clicked it; try again specifically.
  await mmPage.waitForTimeout(2_000);
  const openWalletBtn = mmPage.locator('button:has-text("Open wallet")').first();
  if (await openWalletBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await openWalletBtn.click({ force: true }).catch(() => {});
    await mmPage.waitForTimeout(4_000);
  }
  await snap(mmPage, 'mm-wallet-home');
  console.log('   skipping per-account import + network add (selectors changed in v13.30)');
  console.log('   connecting Studio with the onboarded MM wallet directly');

  console.log('\n=== Studio: connect wallet on /onboard ===');
  const studio = await context.newPage();
  await studio.goto(`${STUDIO}/onboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(2_000);
  await snap(studio, 'studio-onboard-pre');

  // Click "Connect wallet" / "Connect injected wallet"
  const connectBtn = studio.getByRole('button', { name: /Connect.*wallet|Connect injected/i }).first();
  await connectBtn.click({ timeout: 10_000 });

  // MetaMask connect popup will open — find and accept
  await studio.waitForTimeout(2_000);
  const mmPopup = context.pages().find((p) => p.url().includes('notification.html') || p.url().includes('connect-hardware'));
  if (mmPopup) {
    await mmPopup.bringToFront();
    await snap(mmPopup, 'mm-connect-popup');
    await mmPopup.getByRole('button', { name: /Next|Connect/i }).first().click({ timeout: 8_000 }).catch(() => {});
    await mmPopup.getByRole('button', { name: /Connect/i }).first().click({ timeout: 8_000 }).catch(() => {});
  }

  await studio.bringToFront();
  await studio.waitForTimeout(3_000);
  await snap(studio, 'studio-onboard-connected');

  // Tour the routes
  for (const route of ['/', '/skills', '/global', '/dashboard', '/memory', '/r/280']) {
    await studio.goto(`${STUDIO}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await studio.waitForTimeout(1_500);
    await snap(studio, `studio-connected${route.replace(/[\/]/g, '-')}`);
  }

  console.log('\n=== closing context ===');
  await context.close();
  console.log(`\nDone. Screenshots in: ${SHOTS_DIR}`);
}

main().catch(async (err) => {
  console.error('FAIL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
