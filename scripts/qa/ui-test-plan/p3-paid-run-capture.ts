/**
 * UI_REAL_USER_TEST_PLAN.md Priority 3 · Paid normal-run flow capture.
 *
 * Real Chromium + real MetaMask extension + real operator wallet drives:
 *   1. /onboard → Connect wallet popup → Sign SIWE popup
 *   2. Land on /, fill RunPanel (paste text + skill = private-doc-review)
 *   3. Click Run → /api/run/estimate returns 402 (needsPayment: true)
 *   4. wagmi paySkillRun MM popup → Confirm
 *   5. /api/run/confirm 5-check verifier → pipeline → receipt anchor
 *   6. Redirect to /r/<id> with billing.payment block visible
 *
 * Pre-conditions:
 *   - private-doc-review skill PUBLISHED + PRICED on chain (per P3 setup notes)
 *   - MM profile at scripts/qa/metamask-e2e/mm/profile/ onboarded with operator key
 *   - Operator wallet has >0.05 OG on Galileo (current: 68 OG)
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const USER_DATA_DIR = resolve(REPO, `scripts/qa/ui-test-plan/.p3-profile-${TIMESTAMP}`);
mkdirSync(USER_DATA_DIR, { recursive: true });
const SHOTS_BASE = resolve(REPO, 'QA_PROOF_PACK/ui/P3-paid-run');
for (const sub of ['desktop', 'video']) mkdirSync(resolve(SHOTS_BASE, sub), { recursive: true });

const PASSWORD = process.env.MM_PASSWORD ?? 'TestPass123!QA';
const SAMPLE_TEXT = `Acquisition Term Sheet (Draft · Series A · Cayman vehicle)

The Acquirer agrees to purchase 100% of the Target's equity for $2,000,000 (the "Purchase Price"), subject to a working capital adjustment.

Non-Compete: The Founder agrees to a 5-year non-compete in any related field, globally.

Indemnification: Founder indemnifies Acquirer for all known and unknown liabilities, with no cap and no time limit.

Governing Law: Cayman Islands.

Closing Conditions: Acquirer may walk away at any time before closing for any reason or no reason, with no break-up fee.`;

let step = 0;
async function snap(page: Page, label: string): Promise<void> {
  step += 1;
  const filename = `${String(step).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) {
    console.log(`  (skip · closed) ${filename}`);
    return;
  }
  try {
    await page.screenshot({ path: resolve(SHOTS_BASE, 'desktop', filename), fullPage: false });
    console.log(`  📸 ${filename}`);
  } catch (e) {
    console.log(`  (skip) ${filename} — ${(e as Error).message.split('\n')[0]}`);
  }
}

async function findExtensionId(ctx: BrowserContext): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const sw = ctx.serviceWorkers();
    if (sw.length > 0) {
      const m = sw[0].url().match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('MM service worker did not appear');
}

async function drivePopup(popup: Page, label: string, maxSteps = 12): Promise<void> {
  await popup.bringToFront();
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(1_500);
  await snap(popup, `${label}-open`);
  const ctaTexts = ['Connect', 'Confirm', 'Approve', 'Switch network', 'Switch', 'Got it', 'Continue', 'Next', 'Sign'];
  for (let i = 0; i < maxSteps; i++) {
    if (popup.isClosed()) {
      console.log(`  ${label}: closed after ${i} steps`);
      return;
    }
    let clicked = false;
    for (const txt of ctaTexts) {
      const btn = popup.locator(`button:has-text("${txt}"):not([disabled])`).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        console.log(`  ${label}: step ${i} → ${txt}`);
        await btn.click({ timeout: 5_000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      console.log(`  ${label}: no CTA at step ${i}, done`);
      break;
    }
    await popup.waitForTimeout(2_500);
    if (!popup.isClosed()) await snap(popup, `${label}-step-${i}`);
  }
}

async function main(): Promise<void> {
  console.log('UI_REAL_USER_TEST_PLAN.md · P3 Paid-Run capture');
  console.log(`Target: ${STUDIO}`);
  console.log(`Profile: ${USER_DATA_DIR}`);
  console.log(`Output: ${SHOTS_BASE}\n`);

  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
    recordVideo: { dir: resolve(SHOTS_BASE, 'video'), size: { width: 1440, height: 900 } },
  });

  const extId = await findExtensionId(ctx);
  console.log(`MM extension: ${extId}`);

  // 1. Unlock MetaMask
  console.log('\n=== 1. Unlock MetaMask ===');
  const mmHomeUrl = `chrome-extension://${extId}/home.html`;
  let mmPage = ctx.pages().find((p) => p.url().startsWith(`chrome-extension://${extId}`));
  if (!mmPage) {
    mmPage = await ctx.newPage();
    await mmPage.goto(mmHomeUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  }
  await mmPage.bringToFront();
  await mmPage.waitForTimeout(3_000);
  await snap(mmPage, 'mm-home');

  const unlockInput = mmPage.locator('input[type="password"]').first();
  if (await unlockInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await unlockInput.click();
    await mmPage.keyboard.type(PASSWORD, { delay: 30 });
    await snap(mmPage, 'mm-password-typed');
    await mmPage.locator('button:has-text("Unlock"), button:has-text("Sign in")').first().click({ timeout: 8_000 }).catch(() => {});
    await mmPage.waitForTimeout(4_000);
    await snap(mmPage, 'mm-unlocked');
  } else {
    console.log('  MM already unlocked');
    await snap(mmPage, 'mm-already-unlocked');
  }

  // 2. Navigate to /onboard + Connect wallet
  console.log('\n=== 2. Connect wallet on /onboard ===');
  const studio = await ctx.newPage();
  await studio.goto(`${STUDIO}/onboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(2_500);
  await snap(studio, 'onboard-loaded');

  const connectPopupP = ctx.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
  const connectBtn = studio.getByRole('button', { name: /Connect.*wallet|Connect injected/i }).first();
  await connectBtn.click({ timeout: 10_000 }).catch(async () => {
    // fallback: button text on landing might be different
    await studio.locator('button:has-text("Connect")').first().click({ timeout: 5_000 }).catch(() => {});
  });
  const connectPopup = await connectPopupP;
  if (connectPopup) {
    await drivePopup(connectPopup, 'mm-connect');
  } else {
    console.log('  WARN: no connect popup detected');
  }
  await studio.bringToFront();
  await studio.waitForTimeout(2_500);
  await snap(studio, 'onboard-after-connect');

  // 3. Sign SIWE — usually triggered by the same Connect click or by visiting a SIWE-gated page
  console.log('\n=== 3. Sign SIWE (if prompted) ===');
  const sigPopupP = ctx.waitForEvent('page', { timeout: 8_000 }).catch(() => null);
  // Triggering SIWE: navigate to a SIWE-gated route OR re-press Connect.
  await studio.goto(`${STUDIO}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(3_000);
  const sigPopup = await sigPopupP;
  if (sigPopup) {
    await drivePopup(sigPopup, 'mm-siwe');
  }
  await studio.bringToFront();
  await snap(studio, 'dashboard-connected');

  // 4. Go to landing → fill RunPanel
  console.log('\n=== 4. Fill RunPanel on landing ===');
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'landing-connected');

  // RunPanel: paste sample text into the file-drop area's "or paste text" textarea
  // The exact selector depends on RunPanel's DOM — try multiple candidates
  const textarea = studio.locator('textarea').first();
  if (await textarea.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await textarea.click();
    await textarea.fill(SAMPLE_TEXT);
    console.log('  ✓ pasted sample text');
  } else {
    console.log('  WARN: no textarea found in RunPanel');
  }
  await snap(studio, 'runpanel-text-filled');

  // Question input (the "What's the worst clause?" field)
  const questionInput = studio.locator('input[placeholder*="worst" i], input[placeholder*="question" i]').first();
  if (await questionInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await questionInput.click();
    await questionInput.fill('Which clause is most concerning?');
  }

  // Ensure skill = private-doc-review (default)
  const skillSelect = studio.locator('select, [role="combobox"]').first();
  if (await skillSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await skillSelect.selectOption({ label: 'private-doc-review' }).catch(() => {});
  }
  await snap(studio, 'runpanel-ready-to-run');

  // 5. Click Run → estimate (402) → payment popup
  console.log('\n=== 5. Click Run → 402 → payment popup ===');
  const payPopupP = ctx.waitForEvent('page', { timeout: 30_000 }).catch(() => null);
  const runBtn = studio.locator('button:has-text("Run"), button:has-text("Run review")').first();
  await runBtn.click({ timeout: 8_000 }).catch(() => {});
  await studio.waitForTimeout(3_000);
  await snap(studio, 'runpanel-after-run-click');

  const payPopup = await payPopupP;
  if (payPopup) {
    await drivePopup(payPopup, 'mm-payment');
  } else {
    console.log('  WARN: no payment popup detected within 30s — may indicate free-skill path');
  }
  await studio.bringToFront();
  await studio.waitForTimeout(3_000);
  await snap(studio, 'after-payment-popup');

  // 6. Wait for redirect to /r/<id> OR an error state
  console.log('\n=== 6. Wait for receipt anchor ===');
  let receiptId: string | null = null;
  for (let i = 0; i < 60; i++) {
    const url = studio.url();
    const m = url.match(/\/r\/(\d+)/);
    if (m) {
      receiptId = m[1];
      console.log(`  ✓ receipt anchored: rec_${receiptId}`);
      break;
    }
    const errorVisible = await studio.locator('text=/error|failed/i').first().isVisible({ timeout: 500 }).catch(() => false);
    if (errorVisible) {
      console.log('  ⚠ error visible during run');
      await snap(studio, 'run-error');
      break;
    }
    await studio.waitForTimeout(2_000);
  }

  if (receiptId) {
    await studio.waitForTimeout(3_000);
    await snap(studio, `receipt-${receiptId}-top`);
    await studio.evaluate(() => window.scrollBy(0, 600));
    await studio.waitForTimeout(500);
    await snap(studio, `receipt-${receiptId}-mid`);
    await studio.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await studio.waitForTimeout(500);
    await snap(studio, `receipt-${receiptId}-bottom`);
  } else {
    await snap(studio, 'no-receipt-after-120s');
  }

  console.log('\n=== closing ===');
  console.log(`Final URL: ${studio.url()}`);
  console.log(`Receipt: ${receiptId ?? 'NONE'}`);
  await ctx.close();
  console.log(`\nDone. Captures in: ${SHOTS_BASE}`);
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
