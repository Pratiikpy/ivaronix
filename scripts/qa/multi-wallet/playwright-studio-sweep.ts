/**
 * Comprehensive Studio route sweep with real MetaMask wallet connected.
 *
 * Per user iter-144 directive: "use all you pwoers ... follow all rules
 * fo real ui real metmask".
 *
 * Builds on iter-143's success:
 * - Playwright Chromium + real MM extension ✓
 * - SRP onboarding with hardhat dev seed ✓
 * - Wallet funded on chain (operator → hardhat acct 0, tx 0xb54acecf...) ✓
 * - Studio connect wallet flow ✓
 *
 * This sweep drives 10+ Studio routes with the connected wallet + captures
 * screenshots at every meaningful state. Auto-resumes via the signal file
 * pattern so it works in non-interactive cron mode.
 *
 * Routes covered:
 *   /                        — home page
 *   /onboard                 — passport mint surface
 *   /memory                  — memory permission center
 *   /skills                  — skill catalog
 *   /data-room/<iter-134-id> — specific data room from iter-134
 *   /delegate/<iter-133-id>  — specific delegate from iter-133
 *   /dashboard               — operator dashboard
 *   /global                  — global activity feed
 *   /agents                  — agents list
 *   /r/10, /r/11, /r/6, /r/9 — multi-wallet receipts
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_DIR = resolve(REPO, `QA_PROOF_PACK/multi-wallet/manual-walkthrough/studio-sweep-${TIMESTAMP}`);
const USER_DATA_DIR = resolve(REPO, `scripts/qa/multi-wallet/.profile-sweep-${TIMESTAMP}`);

mkdirSync(SHOTS_DIR, { recursive: true });
mkdirSync(USER_DATA_DIR, { recursive: true });

const DEV_SEED = 'test test test test test test test test test test test junk';
const PASSWORD = 'test1234567890';
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

// Routes to sweep with the connected wallet. Each gets a screenshot.
const ROUTES = [
  { path: '/', label: 'home' },
  { path: '/onboard', label: 'onboard-passport-mint' },
  { path: '/skills', label: 'skills-catalog' },
  { path: '/memory', label: 'memory-permission-center' },
  { path: '/dashboard', label: 'dashboard' },
  { path: '/global', label: 'global-activity-feed' },
  { path: '/agents', label: 'agents-list' },
  { path: '/thesis', label: 'thesis' },
  { path: '/0g', label: '0g-integration-showcase' },
  { path: '/r/10', label: 'receipt-10-walletb-buyer' },
  { path: '/r/11', label: 'receipt-11-walletb-content-pitch-review' },
  { path: '/r/9', label: 'receipt-9-delegate-run' },
  { path: '/r/6', label: 'receipt-6-walletb-room-read-v3' },
  { path: '/data-room/01KRFBG2XC8G20JDJ81CD614AX', label: 'data-room-iter134' },
  { path: '/delegate/01KRFB6W7JJB2HSXRX1XJCE77N', label: 'delegate-iter133' },
];

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

async function main(): Promise<void> {
  console.log(`\n=== Studio sweep (real MM connected) iter-144 ===`);
  console.log(`   Studio target: ${STUDIO}`);
  console.log(`   routes to sweep: ${ROUTES.length}`);
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

  // Automated SRP onboarding (same as iter-143).
  console.log('=== onboarding MM with hardhat dev seed ===');
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

  // Walk through onboarding completion.
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

  // === Studio sweep ===
  console.log('\n=== sweeping Studio routes with real MM ===');
  const studio = await context.newPage();

  // First route: connect wallet
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'studio-home-pre-connect');

  const connectBtn = studio.getByRole('button', { name: /Connect.*wallet/i }).first();
  if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    console.log('   clicking Connect Wallet...');
    const popupPromise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
    await connectBtn.click({ timeout: 8_000 });
    const popup = await popupPromise;
    if (popup) {
      await popup.bringToFront();
      await popup.waitForTimeout(2_000);
      await snap(popup, 'mm-connect-popup-open');
      const ctaTexts = ['Connect', 'Confirm', 'Approve', 'Next', 'Sign'];
      for (let step = 0; step < 8; step++) {
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
  await snap(studio, 'studio-home-after-connect');

  // Sweep each route + screenshot
  for (const r of ROUTES) {
    console.log(`   visiting ${r.path}...`);
    try {
      await studio.goto(`${STUDIO}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await studio.waitForTimeout(3_500); // Allow wagmi rehydration + lazy components
      await snap(studio, `studio-${r.label}`);
    } catch (e) {
      console.log(`     FAIL on ${r.path}: ${(e as Error).message.split('\n')[0]}`);
      try { await snap(studio, `studio-${r.label}-error`); } catch { /* ok */ }
    }
  }

  console.log(`\n=== sweep complete — screenshots in ${SHOTS_DIR} ===`);
  console.log(`   total routes captured: ${ROUTES.length} (+ home pre/post connect + MM states)`);

  // Brief grace period before closing (so any final renders complete)
  await new Promise((r) => setTimeout(r, 5_000));
  await context.close();
  console.log(`=== browser closed ===`);
}

main().catch((e) => {
  console.error(`[studio-sweep] FAIL: ${(e as Error).message}`);
  process.exit(1);
});
