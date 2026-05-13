/**
 * Hybrid Playwright script: launches Chromium with MM extension + does
 * automated onboarding, then PAUSES with the browser visible so the
 * user can manually import Wallet B's private key. After user resumes
 * (Enter in this terminal), script captures proof + drives Studio.
 *
 * Per iter-141 user offer: "u can open playrgh browsr and i can improt
 * this in their". The user does the MM import; the script automates
 * everything else.
 *
 * Run: pnpm exec tsx scripts/qa/multi-wallet/playwright-paused-for-manual-import.ts
 *
 * Browser stays open for up to 30 minutes after pause. To resume, press
 * Enter in the terminal where this script is running.
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_DIR = resolve(REPO, `QA_PROOF_PACK/multi-wallet/manual-walkthrough/playwright-paused-${TIMESTAMP}`);
const USER_DATA_DIR = resolve(REPO, `scripts/qa/multi-wallet/.profile-paused-${TIMESTAMP}`);

mkdirSync(SHOTS_DIR, { recursive: true });
mkdirSync(USER_DATA_DIR, { recursive: true });

const WALLET_B_FIXTURE = resolve(REPO, '.ivaronix/test-wallets/wallet-b.json');
const walletB = JSON.parse(readFileSync(WALLET_B_FIXTURE, 'utf8')) as { address: string; privateKey: string };
const WALLET_B_KEY = walletB.privateKey;
const WALLET_B_ADDR = walletB.address;

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

const SIGNAL_FILE = resolve(REPO, '.ivaronix/walletb-imported.signal');
async function waitForUserSignal(label: string, maxMinutes = 20): Promise<boolean> {
  console.log(`   waiting for signal file: ${SIGNAL_FILE}`);
  console.log(`   to resume, create the file: touch "${SIGNAL_FILE}"`);
  console.log(`   (or in PowerShell: New-Item -ItemType File -Path "${SIGNAL_FILE}")`);
  console.log(`   max wait: ${maxMinutes} minutes`);
  const startMs = Date.now();
  const maxMs = maxMinutes * 60 * 1000;
  while (Date.now() - startMs < maxMs) {
    if (existsSync(SIGNAL_FILE)) {
      try {
        const ageMs = Date.now() - (readFileSync(SIGNAL_FILE).length > 0 ? 0 : 0);
        void ageMs;
      } catch { /* ok */ }
      console.log(`   ✓ signal received after ${Math.round((Date.now() - startMs) / 1000)}s`);
      // Consume the signal so subsequent runs start fresh
      try { writeFileSync(SIGNAL_FILE, ''); } catch { /* ok */ }
      return true;
    }
    await new Promise((r) => setTimeout(r, 3_000));
    if ((Date.now() - startMs) % 30_000 < 3_000) {
      console.log(`   still waiting at ${label}... (${Math.round((Date.now() - startMs) / 1000)}s elapsed)`);
    }
  }
  console.log(`   ✗ timeout waiting for signal at ${label}`);
  return false;
}

async function main(): Promise<void> {
  console.log(`\n=== paused Playwright driver iter-141 ===`);
  console.log(`   Wallet B addr: ${WALLET_B_ADDR}`);
  console.log(`   Wallet B key:  ${WALLET_B_KEY}`);
  console.log(`   Studio target: ${STUDIO}`);
  console.log(`   screenshots:   ${SHOTS_DIR}\n`);

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
  console.log(`   MM extension id: ${extId}`);

  const mmHomeUrl = `chrome-extension://${extId}/home.html`;
  let mmPage = context.pages().find((p) => p.url().includes(extId));
  if (!mmPage) {
    mmPage = await context.newPage();
    await mmPage.goto(mmHomeUrl + '#onboarding/welcome');
  }
  await mmPage.bringToFront();
  await mmPage.waitForTimeout(3_000);
  await snap(mmPage, 'mm-welcome');

  // === automated SRP onboarding ===
  console.log('\n=== automated SRP onboarding ===');
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
  await snap(mmPage, 'mm-onboarded-password-set');

  // Walk through onboarding completion (manage default settings → privacy → home)
  for (let i = 0; i < 12; i++) {
    const cta = mmPage.locator(
      'button:has-text("Got it"), button:has-text("Done"), button:has-text("Next"), button:has-text("Continue"), button:has-text("Skip"), button:has-text("Manage default settings"), button:has-text("Open wallet")',
    ).first();
    if (await cta.isVisible({ timeout: 2_500 }).catch(() => false)) {
      await cta.click().catch(() => {});
      await mmPage.waitForTimeout(1_500);
    } else break;
  }
  // Force navigate to home if still stuck in onboarding
  if (mmPage.url().includes('/onboarding/')) {
    await mmPage.goto(mmHomeUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
    await mmPage.waitForTimeout(3_000);
  }
  await snap(mmPage, 'mm-wallet-home-ready-for-user');
  console.log(`   wallet home reached: ${mmPage.url()}`);

  // === PAUSE FOR USER TO IMPORT WALLET B ===
  console.log('\n');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  USER ACTION REQUIRED — IMPORT WALLET B INTO METAMASK');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  The Chromium window is open with MetaMask onboarded.');
  console.log('  Look for the MetaMask extension popup OR the MetaMask tab.');
  console.log('');
  console.log('  Steps:');
  console.log('    1. Click the account avatar (top of MM — likely shows "BM")');
  console.log('    2. Click "Add account or hardware wallet"');
  console.log('    3. Click "Import account"');
  console.log('    4. Paste this private key into the input field:');
  console.log('');
  console.log(`       ${WALLET_B_KEY}`);
  console.log('');
  console.log('    5. Click "Import"');
  console.log('    6. Confirm Wallet B address appears in the account list:');
  console.log(`       ${WALLET_B_ADDR}`);
  console.log('');
  console.log('  When done, create the signal file to resume the script:');
  console.log(`    file: ${SIGNAL_FILE}`);
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('');
  // Clear any stale signal first
  try { if (existsSync(SIGNAL_FILE)) writeFileSync(SIGNAL_FILE, ''); } catch { /* ok */ }
  const ok = await waitForUserSignal('post-MM-import', 20);
  if (!ok) {
    console.log('   timeout — proceeding with whatever state MM is in');
  }

  // === RESUME: capture proof + drive Studio ===
  console.log('\n=== resuming — capturing post-import proof ===');
  await mmPage.bringToFront();
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, 'mm-after-user-imported-walletb');

  // Open account menu to confirm Wallet B is present
  await mmPage.locator('button').filter({ hasText: /^BM$|^[A-Z]{2}$/ }).first()
    .click({ timeout: 5_000 }).catch(() => {});
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, 'mm-account-list-showing-both-wallets');

  // Look for Wallet B's address in the page text
  const walletBVisible = await mmPage.locator(`text=/${WALLET_B_ADDR.slice(0, 6)}/i`).first()
    .isVisible({ timeout: 5_000 }).catch(() => false);
  console.log(`   Wallet B visible in MM account list: ${walletBVisible}`);
  await snap(mmPage, walletBVisible ? 'mm-walletb-confirmed-in-list' : 'mm-walletb-not-visible');

  // Navigate to Studio - Wallet B should be the selected account if user switched to it
  console.log('\n=== driving Studio flows ===');
  const studio = await context.newPage();
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'studio-home');

  // Try clicking Connect Wallet
  const connectBtn = studio.getByRole('button', { name: /Connect.*wallet/i }).first();
  if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    console.log('   clicking Connect Wallet...');
    const popupPromise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
    await connectBtn.click({ timeout: 8_000 });
    const popup = await popupPromise;
    if (popup) {
      await popup.bringToFront();
      await popup.waitForTimeout(2_000);
      await snap(popup, 'mm-connect-popup');
      // Walk through connect popup
      const ctaTexts = ['Connect', 'Confirm', 'Approve', 'Next'];
      for (let step = 0; step < 5; step++) {
        if (popup.isClosed()) break;
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
    await studio.bringToFront();
    await studio.waitForTimeout(2_000);
    await snap(studio, 'studio-connected');
  }

  // Visit specific receipt pages for proof
  for (const path of ['/r/10', '/r/11', '/r/6']) {
    console.log(`   visiting ${path}...`);
    await studio.goto(`${STUDIO}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await studio.waitForTimeout(3_000);
    await snap(studio, `studio${path.replace(/\//g, '-')}`);
  }

  console.log(`\n=== captures complete — screenshots in ${SHOTS_DIR} ===`);
  console.log(`   browser will stay open for 5 more minutes (or signal again to close)`);
  await waitForUserSignal('close-browser', 5);
  await context.close();
}

main().catch((e) => {
  console.error(`[paused-driver] FAIL: ${(e as Error).message}`);
  process.exit(1);
});
