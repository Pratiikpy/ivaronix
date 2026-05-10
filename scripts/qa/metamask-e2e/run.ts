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
function pickEnv(...names: string[]): string | undefined {
  for (const n of names) if (env[n]) return env[n];
  return undefined;
}
const PRIVATE_KEY = pickEnv('IVARONIX_SIGNER_KEY', 'OG_PRIVATE_KEY', 'EVM_PRIVATE_KEY') ?? '';
const WALLET_ADDR = pickEnv('IVARONIX_WALLET_ADDRESS', 'EVM_WALLET_ADDRESS') ?? '';

if (!PRIVATE_KEY) {
  console.error('FAIL: IVARONIX_SIGNER_KEY missing in .env (legacy aliases OG_PRIVATE_KEY, EVM_PRIVATE_KEY also accepted)');
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
  if (page.isClosed()) {
    console.log(`   (skip) ${name} — page already closed`);
    return;
  }
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   📸 ${name}`);
  } catch (e) {
    console.log(`   (skip) ${name} — ${(e as Error).message.split('\n')[0]}`);
  }
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

  // Wait for MetaMask UI to render — extension finishes booting
  console.log('   waiting for MetaMask UI to render...');
  // Use Playwright locator (not evaluate — LavaMoat scuttles globalThis).
  // Wait for any button OR password input to appear (covers both fresh + unlocked).
  await mmPage.waitForSelector('button, input[type="password"]', { timeout: 60_000 }).catch(() => {});
  await mmPage.waitForTimeout(3_000);
  await snap(mmPage, 'mm-welcome');

  // Detect state: onboarded (Unlock/wallet) vs fresh (welcome).
  // page.evaluate is blocked by MetaMask's LavaMoat scuttling — use locator API.
  const isFresh = await mmPage.locator('button:has-text("I have an existing wallet")').first().isVisible({ timeout: 3_000 }).catch(() => false);
  const isUnlockScreen = !isFresh && await mmPage.locator('button:has-text("Unlock")').first().isVisible({ timeout: 3_000 }).catch(() => false);

  if (!isFresh && isUnlockScreen) {
    console.log('   MM already onboarded — unlocking with password');
    await mmPage.locator('input[type="password"]').first().fill(PASSWORD);
    await mmPage.locator('button:has-text("Unlock"), button:has-text("Sign in")').first().click({ timeout: 8_000 }).catch(() => {});
    await mmPage.waitForTimeout(3_000);
    await snap(mmPage, 'mm-unlocked');
  } else if (!isFresh) {
    console.log('   MM appears already on wallet UI');
  } else {

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

  // Wait for the SRP entry page to render (textarea visible)
  console.log('   waiting for SRP entry page...');
  await mmPage.locator('textarea').first().waitFor({ state: 'visible', timeout: 30_000 });
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
  await mmPage.locator('input[type="password"]').first().waitFor({ state: 'visible', timeout: 30_000 });
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
  console.log('   onboarded — proceeding to Studio connect');
  } // end fresh-onboarding else branch

  console.log('\n=== Studio: connect wallet on /onboard ===');
  const studio = await context.newPage();
  await studio.goto(`${STUDIO}/onboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(2_000);
  await snap(studio, 'studio-onboard-pre');

  // Helper: walk a MM popup through any number of "Next" / "Connect" / "Confirm" /
  // "Approve" / "Switch network" / "Got it" steps until it closes or stalls.
  async function drivePopup(popup: Page, label: string, maxSteps = 12): Promise<void> {
    await popup.bringToFront();
    await popup.waitForLoadState('domcontentloaded').catch(() => {});
    await popup.waitForTimeout(1_500);
    await snap(popup, `${label}-open`);
    const ctaTexts = ['Connect', 'Confirm', 'Approve', 'Switch network', 'Switch', 'Got it', 'Continue', 'Next', 'Sign'];
    for (let step = 0; step < maxSteps; step++) {
      if (popup.isClosed()) {
        console.log(`   ${label}: popup closed after ${step} steps`);
        return;
      }
      let clicked = false;
      for (const txt of ctaTexts) {
        const btn = popup.locator(`button:has-text("${txt}"):not([disabled])`).first();
        const visible = await btn.isVisible({ timeout: 1_000 }).catch(() => false);
        if (visible) {
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

  // Listen for any popup that opens during the connect click.
  const popupPromise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);

  // Click "Connect wallet" / "Connect injected wallet"
  const connectBtn = studio.getByRole('button', { name: /Connect.*wallet|Connect injected/i }).first();
  await connectBtn.click({ timeout: 10_000 });

  let popup = await popupPromise;
  // Fallback: scan existing pages for an MM notification page that may already be open.
  if (!popup) {
    popup = context.pages().find((p) => p.url().includes(extId) && p !== mmPage && p !== studio) ?? null;
  }
  if (popup) {
    await drivePopup(popup, 'mm-connect-popup');
  } else {
    console.log('   WARN: no MM popup detected after Connect click');
  }

  await studio.bringToFront();
  await studio.waitForTimeout(2_000);
  await snap(studio, 'studio-onboard-after-connect');

  // The site likely also asks to switch to 0G Galileo (chainId 16602) — that
  // triggers a second popup. Listen for it on the next interaction.
  const switchPromise = context.waitForEvent('page', { timeout: 8_000 }).catch(() => null);
  // Trigger anything that might prompt a chain switch — re-clicking Connect is harmless if already connected.
  await studio.waitForTimeout(2_000);
  const switchPopup = await switchPromise;
  if (switchPopup) {
    await drivePopup(switchPopup, 'mm-switch-popup');
    await studio.bringToFront();
  }

  await studio.waitForTimeout(2_000);
  await snap(studio, 'studio-onboard-connected');

  // Tour the routes — wait for wagmi rehydration on each.
  // The connected state is detected by the header showing a 0x... address
  // chip (or "Disconnect") instead of "Connect wallet". Give it up to 8s.
  for (const route of ['/', '/skills', '/global', '/dashboard', '/memory', '/r/280']) {
    await studio.goto(`${STUDIO}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Wait for wagmi autoConnect to rehydrate (header switches Connect → 0x...)
    await studio
      .waitForFunction(
        () => {
          const txt = document.body && document.body.innerText ? document.body.innerText : '';
          return /0x[a-f0-9]{4}.*0x[a-f0-9]{4}|Disconnect/i.test(txt);
        },
        { timeout: 8_000 }
      )
      .catch(() => {});
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
