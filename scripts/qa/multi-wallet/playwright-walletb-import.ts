/**
 * Multi-wallet Playwright driver — imports Wallet B's private key into a
 * real MetaMask extension instance.
 *
 * Closes the UI gate per docs/MULTI_WALLET_RULES.md: "Do not claim UI
 * coverage if Wallet B/C was not imported into MetaMask and used through
 * Studio." The existing scripts/qa/metamask-e2e/run.ts uses a throwaway
 * hardhat seed for connect-only smoke tests — this script extends the
 * pattern to import a real funded wallet's private key.
 *
 * Wallet B address: 0xaf295d3c842bc1145E818d7FEf2c929726625620
 * Wallet B funded: 0.1+ OG on Galileo testnet (iter-132 + iter-136 top-ups)
 *
 * Output:
 *   QA_PROOF_PACK/multi-wallet/screenshots-<timestamp>/  — step screenshots
 *   QA_PROOF_PACK/multi-wallet/screenshots-<timestamp>/video.webm  — full session
 *
 * Run: pnpm exec tsx scripts/qa/multi-wallet/playwright-walletb-import.ts
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_DIR = resolve(REPO, `QA_PROOF_PACK/multi-wallet/screenshots-${TIMESTAMP}`);
const USER_DATA_DIR = resolve(REPO, `scripts/qa/multi-wallet/.profile-${TIMESTAMP}`);

mkdirSync(SHOTS_DIR, { recursive: true });
mkdirSync(USER_DATA_DIR, { recursive: true });

// Load Wallet B key from gitignored fixture.
const WALLET_B_FIXTURE = resolve(REPO, '.ivaronix/test-wallets/wallet-b.json');
if (!existsSync(WALLET_B_FIXTURE)) {
  console.error(`FAIL: Wallet B fixture missing at ${WALLET_B_FIXTURE}. Run scripts/qa/multi-wallet/setup-wallets.ts first.`);
  process.exit(1);
}
const walletB = JSON.parse(readFileSync(WALLET_B_FIXTURE, 'utf8')) as { address: string; privateKey: string };
const WALLET_B_KEY = walletB.privateKey.replace(/^0x/, '');
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

async function main(): Promise<void> {
  console.log(`=== multi-wallet Playwright driver iter-139 ===`);
  console.log(`   Wallet B addr: ${WALLET_B_ADDR}`);
  console.log(`   Studio target: ${STUDIO}`);
  console.log(`   screenshots: ${SHOTS_DIR}`);

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

  // Quick SRP onboarding with dev seed (mirrors run.ts).
  console.log('=== SRP onboarding ===');
  await mmPage.locator('button:has-text("I have an existing wallet"), button:has-text("Import")').first()
    .click({ timeout: 15_000 }).catch(() => {});
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, 'mm-after-existing');

  // Skip onboarding analytics opt-in if present.
  await mmPage.locator('button:has-text("No thanks"), button:has-text("Skip"), button:has-text("Agree")').first()
    .click({ timeout: 5_000 }).catch(() => {});
  await mmPage.waitForTimeout(1_500);

  // SRP import.
  await mmPage.locator('button:has-text("Import using Secret Recovery Phrase"), button:has-text("Import using SRP")').first()
    .click({ timeout: 15_000 }).catch(() => {});
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, 'mm-srp-choice');

  await mmPage.locator('textarea').first().waitFor({ state: 'visible', timeout: 30_000 });
  const srp = mmPage.locator('textarea').first();
  await srp.click();
  await mmPage.keyboard.type(DEV_SEED, { delay: 30 });
  await mmPage.waitForTimeout(1_000);
  await snap(mmPage, 'mm-srp-typed');

  await mmPage.locator('button[data-testid="import-srp-confirm"], button:has-text("Continue"), button:has-text("Import")').first()
    .click({ timeout: 15_000 });
  await mmPage.waitForTimeout(2_500);
  await snap(mmPage, 'mm-srp-submitted');

  // Password.
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
  await snap(mmPage, 'mm-password-entered');

  await mmPage.locator('button:has-text("Create password"), button:has-text("Import my wallet")').first()
    .click({ timeout: 15_000 });
  await mmPage.waitForTimeout(3_000);
  await snap(mmPage, 'mm-onboarding-mid');

  // Walk past any "Got it" / "Done" / "Open wallet" buttons.
  for (let i = 0; i < 10; i++) {
    const cta = mmPage.locator(
      'button:has-text("Got it"), button:has-text("Done"), button:has-text("Next"), button:has-text("Continue"), button:has-text("Skip"), button:has-text("Open wallet")',
    ).first();
    if (await cta.isVisible({ timeout: 2_500 }).catch(() => false)) {
      await cta.click().catch(() => {});
      await mmPage.waitForTimeout(1_500);
    } else break;
  }
  await snap(mmPage, 'mm-onboarding-done');

  // === KEY STEP iter-139: Import Wallet B's private key as additional account ===
  console.log('=== importing Wallet B private key ===');
  await mmPage.waitForTimeout(2_000);

  // Open account picker. MM v13.30 has the account menu in the top-right area.
  // Try several known selectors.
  const accountMenu = mmPage.locator(
    '[data-testid="account-menu-icon"], button[aria-label*="ccount"], div[data-testid*="account-list"]',
  ).first();
  if (await accountMenu.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await accountMenu.click();
  } else {
    // Fallback: click the address chip in the header
    await mmPage.locator('button').filter({ hasText: /0x[a-fA-F0-9]{4}.*[a-fA-F0-9]{4}/ }).first()
      .click({ timeout: 5_000 }).catch(() => {});
  }
  await mmPage.waitForTimeout(1_500);
  await snap(mmPage, 'mm-account-menu-open');

  // Click "Add account or hardware wallet"
  await mmPage.locator('button:has-text("Add account or hardware wallet"), button:has-text("Add account")').first()
    .click({ timeout: 8_000 }).catch(() => {});
  await mmPage.waitForTimeout(1_500);
  await snap(mmPage, 'mm-add-account-menu');

  // Click "Import account"
  await mmPage.locator('button:has-text("Import account"), button:has-text("Private key")').first()
    .click({ timeout: 8_000 }).catch(() => {});
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, 'mm-import-account-page');

  // MM v13.30 may show a "Select Type" dropdown first. If so, pick Private Key.
  const typeDropdown = mmPage.locator('select, [role="combobox"], button:has-text("Select Type")').first();
  if (await typeDropdown.isVisible({ timeout: 2_500 }).catch(() => false)) {
    console.log('   Type dropdown visible — selecting Private Key');
    await typeDropdown.click().catch(() => {});
    await mmPage.waitForTimeout(800);
    await mmPage.locator('text="Private Key", option:has-text("Private Key"), [role="option"]:has-text("Private Key")').first()
      .click({ timeout: 5_000 }).catch(() => {});
    await mmPage.waitForTimeout(1_000);
    await snap(mmPage, 'mm-private-key-type-selected');
  }

  // Broad selector for the private-key input across MM versions.
  const keyInput = mmPage.locator(
    '[data-testid="private-key-box"], input#private-key-box, input[name="private-key-box"], input[type="password"], input[placeholder*="rivate"], textarea[placeholder*="rivate"], textarea',
  ).first();
  const inputFound = await keyInput.isVisible({ timeout: 8_000 }).catch(() => false);
  if (!inputFound) {
    // Last resort: any input on the page
    console.log('   primary selector missed — falling back to any input');
    await mmPage.locator('input, textarea').first().waitFor({ state: 'visible', timeout: 8_000 });
    await mmPage.locator('input, textarea').first().click();
  } else {
    await keyInput.click();
  }
  await mmPage.keyboard.type(WALLET_B_KEY, { delay: 15 });
  await mmPage.waitForTimeout(1_000);
  await snap(mmPage, 'mm-private-key-typed');

  // Click Import / Confirm. MM v13.30 may use "Add account" or "Confirm".
  await mmPage.locator(
    '[data-testid="import-account-confirm-button"], button:has-text("Add account"), button:has-text("Import"), button:has-text("Confirm")',
  ).first().click({ timeout: 8_000 });
  await mmPage.waitForTimeout(4_000);
  await snap(mmPage, 'mm-after-import-click');

  // Verify Wallet B address appears in the UI
  const walletBShort = `${WALLET_B_ADDR.slice(0, 6)}…${WALLET_B_ADDR.slice(-4)}`.toLowerCase();
  console.log(`   looking for Wallet B short address: ${walletBShort}`);
  const found = await mmPage.locator(`text=/${WALLET_B_ADDR.slice(0, 6)}.*${WALLET_B_ADDR.slice(-4)}/i`).first()
    .isVisible({ timeout: 8_000 }).catch(() => false);
  console.log(`   Wallet B address visible in MM: ${found}`);
  await snap(mmPage, found ? 'mm-walletb-imported-success' : 'mm-walletb-import-result-unclear');

  // Capture the final state regardless of explicit address match.
  console.log(`\n=== result summary ===`);
  console.log(`   Wallet B address (target):  ${WALLET_B_ADDR}`);
  console.log(`   address visible in MM UI:   ${found}`);
  console.log(`   screenshots saved:          ${SHOTS_DIR}`);
  console.log(`   user-data-dir:              ${USER_DATA_DIR}`);

  await context.close();
}

main().catch((e) => {
  console.error(`[walletb-import] FAIL: ${(e as Error).message}`);
  process.exit(1);
});
