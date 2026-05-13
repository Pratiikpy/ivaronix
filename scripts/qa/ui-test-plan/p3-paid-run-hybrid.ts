/**
 * UI_REAL_USER_TEST_PLAN.md Priority 3 · Paid-Run · Strategy 3 hybrid.
 *
 * Script drives Studio actions; operator at keyboard clicks each MM popup
 * as it appears. Script polls URL / DOM state to detect transitions and
 * snaps screenshots at each phase.
 *
 * Eliminates the LavaMoat popup-driver fragility of Strategies 1-2.
 * Pattern copied from scripts/qa/multi-wallet/playwright-3wallet-full-flow.ts.
 *
 * Pre-conditions:
 *   - private-doc-review skill published + priced on chain (P3 setup notes)
 *   - Operator at keyboard ready to click MM popups
 *   - Fresh Chromium profile or already-onboarded MM
 *
 * Operator instructions when this runs:
 *   1. When MM onboarding prompt appears: import operator wallet seed/key
 *      (or skip if profile is already onboarded)
 *   2. When "Connect" popup appears: click Connect
 *   3. When "Switch network to Galileo" popup appears: click Switch/Approve
 *   4. When SIWE "Sign in" popup appears: click Sign
 *   5. When "paySkillRun" tx popup appears: click Confirm
 *   6. Watch script log for "▶ resumed" messages indicating progress
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const USER_DATA_DIR = resolve(REPO, `scripts/qa/ui-test-plan/.p3-profile-${TIMESTAMP}`);
const SHOTS_BASE = resolve(REPO, 'QA_PROOF_PACK/ui/P3-paid-run-hybrid');
for (const sub of ['desktop', 'video']) mkdirSync(resolve(SHOTS_BASE, sub), { recursive: true });
mkdirSync(USER_DATA_DIR, { recursive: true });

const SAMPLE_TEXT = `Acquisition Term Sheet (Draft · Series A · Cayman vehicle)

The Acquirer agrees to purchase 100% of the Target's equity for $2,000,000 subject to a working capital adjustment.

Non-Compete: The Founder agrees to a 5-year non-compete in any related field, globally.

Indemnification: Founder indemnifies Acquirer for all known and unknown liabilities, with no cap and no time limit.

Governing Law: Cayman Islands.

Closing Conditions: Acquirer may walk away at any time before closing for any reason or no reason, with no break-up fee.`;

let stepNum = 0;
async function snap(page: Page, name: string): Promise<void> {
  stepNum += 1;
  const filename = `${String(stepNum).padStart(3, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
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

async function pause(prompt: string, waitFn: () => Promise<boolean>, maxSec = 240): Promise<boolean> {
  console.log(`\n   ⏸  ${prompt}`);
  console.log(`      polling every 2s for up to ${maxSec}s · operator at keyboard please`);
  for (let i = 0; i < maxSec / 2; i++) {
    if (await waitFn().catch(() => false)) {
      console.log(`   ▶  resumed after ${i * 2}s\n`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(`   ⏱  TIMEOUT after ${maxSec}s\n`);
  return false;
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

async function main(): Promise<void> {
  console.log('UI_REAL_USER_TEST_PLAN.md · P3 Paid-Run · Strategy 3 hybrid');
  console.log(`Target: ${STUDIO}`);
  console.log(`Profile: ${USER_DATA_DIR}`);
  console.log(`Output: ${SHOTS_BASE}\n`);
  console.log('========================================================');
  console.log('  OPERATOR INSTRUCTIONS:');
  console.log('  1. Import operator wallet key into MM when prompted');
  console.log('     (skip onboarding if profile already has the wallet)');
  console.log('  2. Click MM popups as they appear: Connect / Switch /');
  console.log('     Sign / Confirm');
  console.log('  3. Watch script log for "▶ resumed" messages');
  console.log('========================================================\n');

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

  // 1. Wait for MM onboarding / unlock
  console.log('\n=== 1. MetaMask setup ===');
  const mmHomeUrl = `chrome-extension://${extId}/home.html`;
  let mmPage = ctx.pages().find((p) => p.url().startsWith(`chrome-extension://${extId}`));
  if (!mmPage) {
    mmPage = await ctx.newPage();
    await mmPage.goto(mmHomeUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  }
  await mmPage.bringToFront();
  await mmPage.waitForTimeout(3_000);
  await snap(mmPage, 'mm-initial');

  await pause(
    'Complete MetaMask onboarding (import operator key) OR unlock existing wallet. Then click anywhere in MM to confirm UI is on the wallet home screen.',
    async () => {
      if (!mmPage || mmPage.isClosed()) return false;
      const txt = await mmPage.locator('body').innerText().catch(() => '');
      // Detect wallet home: account address visible OR "Buy" / "Send" / "Receive" buttons
      return /0x[a-f0-9]{4}/i.test(txt) && (txt.includes('Buy') || txt.includes('Send') || txt.includes('Receive'));
    },
    300,
  );
  await snap(mmPage, 'mm-wallet-home');

  // 2. Navigate to Studio onboard
  console.log('\n=== 2. Open Studio /onboard ===');
  const studio = await ctx.newPage();
  await studio.goto(`${STUDIO}/onboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'onboard-loaded');

  await pause(
    'Click "Connect wallet" on the Studio page, then approve the MM popup. Watch for the header to show your address (0x...) instead of "Connect wallet".',
    async () => {
      const txt = await studio.locator('body').innerText().catch(() => '');
      // Connected when header shows 0x... or "Disconnect"
      return /0x[a-f0-9]{4}.*0x[a-f0-9]{4}/i.test(txt) || /Disconnect/i.test(txt);
    },
    300,
  );
  await snap(studio, 'studio-connected');

  // 3. Navigate to home page (RunPanel)
  console.log('\n=== 3. Fill RunPanel ===');
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'landing-connected');

  // Paste sample text
  const textarea = studio.locator('textarea').first();
  if (await textarea.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await textarea.click();
    await textarea.fill(SAMPLE_TEXT);
    console.log('  ✓ pasted sample text');
  }
  await snap(studio, 'runpanel-text-filled');

  // Question
  const questionInput = studio.locator('input[placeholder*="worst" i], input[placeholder*="question" i]').first();
  if (await questionInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await questionInput.click();
    await questionInput.fill('Which clause is most concerning?');
    console.log('  ✓ question filled');
  }

  // Ensure skill = private-doc-review
  const skillSelect = studio.locator('select').first();
  if (await skillSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await skillSelect.selectOption({ label: 'private-doc-review' }).catch(() => {});
  }
  await snap(studio, 'runpanel-ready');

  // 4. Click Run → SIWE popup → payment popup
  console.log('\n=== 4. Run + sign payment ===');
  const runBtn = studio.locator('button:has-text("Run"), button:has-text("Run review")').first();
  await runBtn.click({ timeout: 8_000 }).catch(() => {});
  await studio.waitForTimeout(2_000);
  await snap(studio, 'after-run-click');

  await pause(
    'A MetaMask popup should appear for SIWE sign-in (if not already signed in) AND/OR the payment tx (paySkillRun). Click "Sign" / "Confirm" in each popup. Watch for the URL to change to /r/<id>.',
    async () => {
      const url = studio.url();
      if (/\/r\/\d+/.test(url)) return true;
      // also detect error toast
      const txt = await studio.locator('body').innerText().catch(() => '');
      return /receipt anchored|error|failed/i.test(txt);
    },
    420,
  );

  await studio.waitForTimeout(3_000);
  await snap(studio, 'after-payment');

  // 5. Capture receipt page
  const finalUrl = studio.url();
  const idMatch = finalUrl.match(/\/r\/(\d+)/);
  if (idMatch) {
    const receiptId = idMatch[1];
    console.log(`\n✓ receipt anchored: rec_${receiptId}`);
    await snap(studio, `receipt-${receiptId}-top`);
    await studio.evaluate(() => window.scrollBy(0, 600));
    await studio.waitForTimeout(500);
    await snap(studio, `receipt-${receiptId}-mid`);
    await studio.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await studio.waitForTimeout(500);
    await snap(studio, `receipt-${receiptId}-bottom`);
  } else {
    console.log(`\n⚠ no receipt id in URL: ${finalUrl}`);
    await snap(studio, 'no-receipt-final');
  }

  console.log('\n=== closing ===');
  await ctx.close();
  console.log(`Done. Captures in: ${SHOTS_BASE}`);
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
