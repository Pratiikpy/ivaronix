/**
 * v29 · Drive the FULL marketplace paid-run flow with MM:
 *   1. Unlock MM
 *   2. Navigate to /marketplace/private-doc-review
 *   3. Connect wallet via MM popup
 *   4. Switch chain to mainnet (16661) via MM popup
 *   5. Paste sample contract text into the run input
 *   6. Click "Run with payment"
 *   7. Confirm payment tx in MM popup
 *   8. Wait for tx + pipeline + receipt
 *   9. Capture the resulting /r/<id> page
 *
 * This is Track 3 (Agentic Economy) core proof. Operator wallet acts as
 * both buyer and creator for this test — the 90% creator-share returns
 * to the operator's claimable balance, treasury gets 10%, operator net
 * spend is ~0.0025 OG (gas + treasury share).
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXT_PATH = resolve(HERE, 'mm', 'extension');
const SOURCE_PROFILE = resolve(HERE, 'mm', 'profile');
const OUT = resolve(REPO, 'docs', 'video', 'qa', 'verify-fix', 'mm-marketplace-v29');
mkdirSync(OUT, { recursive: true });
const PASSWORD = 'TestPass123!QA';

const SAMPLE = `Vendor reserves the right to amend this Agreement at any time without notice.
Customer indemnifies vendor for all third-party claims regardless of fault.
Vendor's liability is capped at $100 cumulative.
Payment is non-refundable under any circumstance.
Auto-renewal after 24 months with no termination for convenience.
Mandatory binding arbitration in Vendor's chosen jurisdiction.`;

let stepNum = 0;
function log(m: string): void { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const safe = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try { await page.screenshot({ path: resolve(OUT, safe), fullPage: false }); log(`📸 ${safe}`); }
  catch { /* swallow */ }
}

async function findExtPage(ctx: BrowserContext, urlSubstr: string, timeoutMs = 12_000): Promise<Page | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const p of ctx.pages()) {
      if (p.url().includes(urlSubstr) && !p.isClosed()) return p;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function clickByText(page: Page, text: string, timeoutMs = 3_000): Promise<boolean> {
  const btn = page.locator(`button:has-text("${text}")`).first();
  if (!(await btn.isVisible({ timeout: timeoutMs }).catch(() => false))) return false;
  const enabled = await btn.isEnabled().catch(() => false);
  if (!enabled) return false;
  await btn.click({ timeout: 5_000 }).catch(() => {});
  return true;
}

async function main(): Promise<void> {
  log(`v29 · marketplace paid-run end-to-end`);
  const dataDir = resolve(tmpdir(), `mm-mkt-v29-${Date.now()}`);
  mkdirSync(dataDir, { recursive: true });
  if (existsSync(SOURCE_PROFILE)) cpSync(SOURCE_PROFILE, dataDir, { recursive: true, force: true });

  const ctx = await chromium.launchPersistentContext(dataDir, {
    headless: false, viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, '--no-sandbox', '--disable-blink-features=AutomationControlled'],
    timeout: 60_000,
  });
  log(`Chromium launched`);
  await new Promise((r) => setTimeout(r, 6_000));

  let extId = '';
  for (const sw of ctx.serviceWorkers()) {
    const m = sw.url().match(/^chrome-extension:\/\/([a-z]+)/);
    if (m) { extId = m[1]; break; }
  }
  if (!extId) { log(`no extId`); await ctx.close(); return; }
  log(`Extension id: ${extId}`);

  // Step 1: Unlock MM.
  const mmHome = await ctx.newPage();
  await mmHome.goto(`chrome-extension://${extId}/home.html#/unlock`, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 2_500));
  const pwdInput = mmHome.locator('input[type="password"]').first();
  if (await pwdInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pwdInput.fill(PASSWORD);
    await mmHome.keyboard.press('Enter');
    log(`MM unlocked`);
    await new Promise((r) => setTimeout(r, 5_000));
  }
  await snap(mmHome, 'mm-unlocked');

  // Step 2: /marketplace/private-doc-review.
  const studio = await ctx.newPage();
  await studio.goto('https://www.ivaronix.xyz/marketplace/private-doc-review', { waitUntil: 'domcontentloaded' });
  await studio.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 3_000));
  await snap(studio, 'marketplace-detail-loaded');

  // Step 3: Connect wallet — the marketplace page should have a Connect button.
  if (await clickByText(studio, 'Connect wallet')) {
    log(`Connect clicked`);
    await new Promise((r) => setTimeout(r, 4_000));
    const popup = await findExtPage(ctx, 'notification.html', 10_000);
    if (popup) {
      await popup.waitForLoadState('domcontentloaded').catch(() => {});
      await new Promise((r) => setTimeout(r, 6_000));
      await snap(popup, 'mm-connect-popup');
      if (await clickByText(popup, 'Connect')) {
        log(`Popup Connect clicked`);
        await new Promise((r) => setTimeout(r, 4_000));
      }
    }
  }
  await new Promise((r) => setTimeout(r, 3_000));
  await snap(studio, 'marketplace-after-connect');

  // Step 4: Switch chain if banner present.
  if (await clickByText(studio, 'Switch to 0G Mainnet')) {
    log(`Chain switch clicked`);
    await new Promise((r) => setTimeout(r, 4_000));
    const switchPopup = await findExtPage(ctx, 'notification.html', 8_000);
    if (switchPopup) {
      await switchPopup.waitForLoadState('domcontentloaded').catch(() => {});
      await new Promise((r) => setTimeout(r, 5_000));
      for (const t of ['Approve', 'Switch network', 'Confirm', 'Switch']) {
        if (await clickByText(switchPopup, t, 1_500)) {
          log(`Clicked "${t}" in chain-switch popup`);
          await new Promise((r) => setTimeout(r, 4_000));
          break;
        }
      }
    }
  } else {
    log(`Chain switch banner not present (may already be on mainnet)`);
  }
  await new Promise((r) => setTimeout(r, 3_000));
  await snap(studio, 'marketplace-on-mainnet');

  // Step 5: Find the text input + paste sample.
  // Looking for a textarea or contenteditable for the contract paste box.
  const pasteBox = studio.locator('textarea, div[contenteditable="true"], input[type="text"]').first();
  if (await pasteBox.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pasteBox.click();
    await pasteBox.fill(SAMPLE);
    log(`Sample text pasted`);
    await snap(studio, 'marketplace-text-pasted');
  } else {
    log(`No paste box visible — capturing what's present`);
    await snap(studio, 'marketplace-no-paste-box');
  }

  // Step 6: Click "Run with payment" or similar.
  let runClicked = false;
  for (const t of ['Run with payment', 'Pay & run', 'Run for', 'Run for 0.015', 'Run', 'Continue']) {
    if (await clickByText(studio, t, 2_000)) {
      log(`Run-button clicked: "${t}"`);
      runClicked = true;
      break;
    }
  }
  if (!runClicked) {
    log(`No run button found — capturing state`);
    const buttons = await studio.locator('button:visible').allTextContents().catch(() => []);
    log(`Visible buttons: [${buttons.slice(0, 10).join(', ')}]`);
  }
  await new Promise((r) => setTimeout(r, 4_000));
  await snap(studio, 'marketplace-after-run-click');

  // Step 7: MM payment-tx popup.
  const txPopup = await findExtPage(ctx, 'notification.html', 12_000);
  if (txPopup) {
    log(`MM tx popup found: ${txPopup.url().slice(-60)}`);
    await txPopup.waitForLoadState('domcontentloaded').catch(() => {});
    await new Promise((r) => setTimeout(r, 6_000));
    await snap(txPopup, 'mm-tx-popup-fully-loaded');

    // Capture the tx details.
    const popupText = await txPopup.locator('body').textContent().catch(() => '');
    log(`Popup text excerpt: ${(popupText ?? '').slice(0, 200).replace(/\s+/g, ' ')}`);

    // Click Confirm.
    let txConfirmed = false;
    for (const t of ['Confirm', 'Sign', 'Approve', 'Pay']) {
      if (await clickByText(txPopup, t, 2_000)) {
        log(`Tx ${t} clicked`);
        txConfirmed = true;
        await new Promise((r) => setTimeout(r, 5_000));
        break;
      }
    }
    await snap(txPopup, txConfirmed ? 'mm-tx-confirmed' : 'mm-tx-popup-no-button');

    if (txConfirmed) {
      // Step 8: Wait for the pipeline to run + receipt to anchor.
      // The Studio page will redirect or update to show the resulting /r/<id>.
      log(`Waiting for pipeline + receipt anchor...`);
      await new Promise((r) => setTimeout(r, 30_000));
      await snap(studio, 'studio-pipeline-result');

      // Try to capture the receipt URL if Studio redirected.
      const currentUrl = studio.url();
      log(`Studio final URL: ${currentUrl}`);
      if (currentUrl.includes('/r/')) {
        stepNum++;
        await studio.screenshot({ path: resolve(OUT, `${String(stepNum).padStart(3, '0')}-receipt-result-fullpage.png`), fullPage: true });
        log(`📸 receipt-result-fullpage`);
      }
    }
  } else {
    log(`No MM tx popup detected`);
  }

  await ctx.close();
  log(`done · ${stepNum} screenshots`);
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
