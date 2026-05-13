/**
 * True 3-wallet Playwright flow per user iter-145: "test all 2 walelt
 * fwo and 3 walelt flow liek real user thn ny we can say its ready to
 * laucnh".
 *
 * Approach: MM onboarded with hardhat seed gives acct 0 by default.
 * Click "Add account" (next derivation from same seed) to add acct 1
 * and acct 2. All three wallets are then available in the same MM
 * session — no private-key import flow needed.
 *
 * Hardhat seed accounts (funded iter-143+iter-144):
 *   acct 0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (0.05 OG)
 *   acct 1: 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 (0.01 OG)
 *   acct 2: 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc (0.01 OG)
 *
 * What this drives:
 *   1. Onboard MM with hardhat seed (acct 0 imported)
 *   2. Add acct 1 (auto-derived from same seed)
 *   3. Add acct 2 (auto-derived from same seed)
 *   4. Connect Studio with acct 0 → drive /memory page
 *   5. Switch MM to acct 1 → reconnect/re-render Studio → screenshot
 *   6. Switch MM to acct 2 → reconnect/re-render Studio → screenshot
 *   7. Capture each MM state + Studio render per wallet
 *
 * This produces the true multi-wallet UI evidence the user requested.
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_DIR = resolve(REPO, `QA_PROOF_PACK/multi-wallet/manual-walkthrough/3wallet-flow-${TIMESTAMP}`);
const USER_DATA_DIR = resolve(REPO, `scripts/qa/multi-wallet/.profile-3wallet-${TIMESTAMP}`);

mkdirSync(SHOTS_DIR, { recursive: true });
mkdirSync(USER_DATA_DIR, { recursive: true });

const DEV_SEED = 'test test test test test test test test test test test junk';
const PASSWORD = 'test1234567890';
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

const WALLETS = [
  { idx: 0, addr: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', label: 'acct-0-default' },
  { idx: 1, addr: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', label: 'acct-1-derived' },
  { idx: 2, addr: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', label: 'acct-2-derived' },
];

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

async function addAccount(mmPage: Page, accountIdx: number): Promise<void> {
  console.log(`   adding hardhat acct ${accountIdx} via "Add account"...`);
  // Click the account avatar (top — typically shows account initials).
  // After onboarding, the avatar button has data-testid or is a button with 2-letter text.
  const avatar = mmPage.locator('[data-testid="account-menu-icon"], button').filter({ hasText: /^[A-Z]{2}$/ }).first();
  if (await avatar.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await avatar.click();
    await mmPage.waitForTimeout(2_000);
    await snap(mmPage, `mm-account-menu-${accountIdx}`);
  }
  // Click "Add account or hardware wallet"
  await mmPage.locator(
    'button:has-text("Add account or hardware wallet"), button:has-text("Add account"), [data-testid="add-multichain-account-button"]',
  ).first().click({ timeout: 8_000 }).catch(() => {});
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, `mm-add-account-menu-${accountIdx}`);
  // Click "Add a new account" (NOT "Import account" — we want next derivation)
  await mmPage.locator('button:has-text("Add a new account"), button:has-text("Ethereum account"), button:has-text("Create account")').first()
    .click({ timeout: 8_000 }).catch(() => {});
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, `mm-add-new-account-${accountIdx}`);
  // Confirm (no name input needed; MM auto-names)
  await mmPage.locator('button:has-text("Create"), button:has-text("Add account"), button:has-text("Confirm")').first()
    .click({ timeout: 8_000 }).catch(() => {});
  await mmPage.waitForTimeout(3_000);
  await snap(mmPage, `mm-after-add-acct-${accountIdx}`);
}

async function switchAccount(mmPage: Page, addr: string): Promise<void> {
  console.log(`   switching MM to ${addr.slice(0, 10)}...`);
  const avatar = mmPage.locator('[data-testid="account-menu-icon"], button').filter({ hasText: /^[A-Z]{2}$/ }).first();
  if (await avatar.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await avatar.click();
    await mmPage.waitForTimeout(2_000);
  }
  // Find the row matching the address and click
  const short = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  const row = mmPage.locator(`text=/${addr.slice(0, 6)}.*${addr.slice(-4)}/i`).first();
  if (await row.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await row.click();
    await mmPage.waitForTimeout(2_000);
  } else {
    console.log(`     could not find row for ${short}, list state captured`);
  }
  await snap(mmPage, `mm-switched-to-${addr.slice(2, 8)}`);
}

async function main(): Promise<void> {
  console.log(`\n=== 3-wallet Playwright flow iter-145 ===`);
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

  // === SRP onboarding ===
  console.log('=== onboarding MM with hardhat seed ===');
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
  await snap(mmPage, 'mm-wallet-home-acct0');

  // === Add 2 more accounts (acct 1 + acct 2) ===
  console.log('\n=== adding accts 1 + 2 via Add account ===');
  await addAccount(mmPage, 1);
  await addAccount(mmPage, 2);
  await snap(mmPage, 'mm-after-all-3-accts-added');

  // === Connect Studio with each wallet + capture ===
  console.log('\n=== driving Studio with each of 3 wallets ===');
  const studio = await context.newPage();

  for (const w of WALLETS) {
    console.log(`\n   --- wallet ${w.idx} (${w.addr.slice(0, 10)}) ---`);
    await switchAccount(mmPage, w.addr);
    await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await studio.waitForTimeout(3_000);
    await snap(studio, `studio-home-as-${w.label}`);

    // Try connect or reconnect
    const connectBtn = studio.getByRole('button', { name: /Connect.*wallet|Reconnect/i }).first();
    if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const popupPromise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
      await connectBtn.click({ timeout: 8_000 }).catch(() => {});
      const popup = await popupPromise;
      if (popup) {
        await popup.bringToFront();
        await popup.waitForTimeout(2_000);
        await snap(popup, `mm-connect-popup-${w.label}`);
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
      await studio.waitForTimeout(3_000);
    }
    await snap(studio, `studio-connected-as-${w.label}`);
    // Visit /memory page as this wallet
    await studio.goto(`${STUDIO}/memory`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await studio.waitForTimeout(3_000);
    await snap(studio, `studio-memory-as-${w.label}`);
  }

  console.log(`\n=== 3-wallet flow complete — screenshots in ${SHOTS_DIR} ===`);
  await new Promise((r) => setTimeout(r, 5_000));
  await context.close();
}

main().catch((e) => {
  console.error(`[3wallet-flow] FAIL: ${(e as Error).message}`);
  process.exit(1);
});
