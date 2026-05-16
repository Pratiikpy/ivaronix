/**
 * v32 · v31 fix · connect via /onboard FIRST (proven working in v28),
 * then navigate to /marketplace/[skill] where the connection should
 * persist. v31's direct connect-on-marketplace got stuck "Connecting...".
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
const OUT = resolve(REPO, 'docs', 'video', 'qa', 'verify-fix', 'mm-marketplace-v32');
mkdirSync(OUT, { recursive: true });
const PASSWORD = 'TestPass123!QA';
const CONTENT = `Vendor reserves the right to amend this Agreement at any time without notice.
Customer indemnifies vendor for all third-party claims regardless of fault.
Vendor's liability is capped at $100 cumulative.
Payment is non-refundable.
Auto-renewal after 24 months with no termination for convenience.`;
const QUESTION = 'Identify the top 3 risks for the customer';

let stepNum = 0;
function log(m: string): void { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const safe = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try { await page.screenshot({ path: resolve(OUT, safe), fullPage: false }); log(`📸 ${safe}`); }
  catch { /* swallow */ }
}
async function findExtPage(ctx: BrowserContext, urlSubstr: string, timeoutMs = 15_000): Promise<Page | null> {
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
  await btn.scrollIntoViewIfNeeded({ timeout: 3_000 }).catch(() => {});
  const enabled = await btn.isEnabled().catch(() => false);
  if (!enabled) { log(`button "${text}" disabled`); return false; }
  await btn.click({ timeout: 5_000 }).catch(() => {});
  return true;
}

async function main(): Promise<void> {
  log(`v32 · connect-via-onboard-first, then drive marketplace paid run`);
  const dataDir = resolve(tmpdir(), `mm-mkt-v32-${Date.now()}`);
  mkdirSync(dataDir, { recursive: true });
  if (existsSync(SOURCE_PROFILE)) cpSync(SOURCE_PROFILE, dataDir, { recursive: true, force: true });

  const ctx = await chromium.launchPersistentContext(dataDir, {
    headless: false, viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, '--no-sandbox', '--disable-blink-features=AutomationControlled'],
    timeout: 60_000,
  });
  await new Promise((r) => setTimeout(r, 7_000));
  let extId = '';
  for (const sw of ctx.serviceWorkers()) {
    const m = sw.url().match(/^chrome-extension:\/\/([a-z]+)/);
    if (m) { extId = m[1]; break; }
  }
  if (!extId) { log(`no extId`); await ctx.close(); return; }

  // Step 1: Unlock MM.
  const mmHome = await ctx.newPage();
  await mmHome.goto(`chrome-extension://${extId}/home.html#/unlock`);
  await new Promise((r) => setTimeout(r, 3_000));
  const pwd = mmHome.locator('input[type="password"]').first();
  if (await pwd.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pwd.fill(PASSWORD);
    await mmHome.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 6_000));
    log(`MM unlocked`);
  }

  // Step 2: Connect via /onboard (proven path from v28).
  const studio = await ctx.newPage();
  await studio.goto('https://www.ivaronix.xyz/onboard', { waitUntil: 'domcontentloaded' });
  await studio.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 4_000));
  await snap(studio, 'onboard-loaded');

  if (await clickByText(studio, 'Connect wallet')) {
    log(`Onboard Connect clicked`);
    await new Promise((r) => setTimeout(r, 5_000));
    const popup = await findExtPage(ctx, 'notification.html', 12_000);
    if (popup) {
      await popup.waitForLoadState('domcontentloaded').catch(() => {});
      await new Promise((r) => setTimeout(r, 7_000));
      await snap(popup, 'mm-connect-popup');
      if (await clickByText(popup, 'Connect')) {
        log(`Popup Connect confirmed`);
        await new Promise((r) => setTimeout(r, 6_000));
      }
    }
  }
  // Wait long enough for wagmi to fully commit the connection.
  await new Promise((r) => setTimeout(r, 5_000));
  await snap(studio, 'onboard-connected');

  // Switch chain.
  if (await clickByText(studio, 'Switch to 0G Mainnet')) {
    log(`Chain-switch clicked`);
    await new Promise((r) => setTimeout(r, 4_000));
    const sp = await findExtPage(ctx, 'notification.html', 10_000);
    if (sp) {
      await new Promise((r) => setTimeout(r, 6_000));
      for (const t of ['Approve', 'Switch network', 'Confirm', 'Switch']) {
        if (await clickByText(sp, t, 1_500)) { log(`chain-switch "${t}" clicked`); break; }
      }
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
  await snap(studio, 'onboard-mainnet');

  // Step 3: Navigate to /marketplace/private-doc-review (connection should persist).
  await studio.goto('https://www.ivaronix.xyz/marketplace/private-doc-review', { waitUntil: 'domcontentloaded' });
  await studio.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 4_000));
  await snap(studio, 'marketplace-loaded-after-onboard-connect');

  // Read header to see wallet state.
  const headerText = await studio.locator('header, nav').first().textContent().catch(() => '');
  log(`Header excerpt: ${(headerText ?? '').slice(0, 100).replace(/\s+/g, ' ')}`);

  // Step 4: Fill BOTH inputs.
  const textarea = studio.locator('textarea').first();
  await textarea.scrollIntoViewIfNeeded().catch(() => {});
  await textarea.click();
  await textarea.focus();
  await studio.keyboard.type(CONTENT, { delay: 5 });
  log(`Content typed`);
  await new Promise((r) => setTimeout(r, 1_500));

  const questionInput = studio.locator('input[placeholder*="question" i], input[placeholder*="clause" i]').first();
  if (await questionInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await questionInput.click();
    await questionInput.focus();
    await studio.keyboard.type(QUESTION, { delay: 5 });
    log(`Question typed`);
  }
  await new Promise((r) => setTimeout(r, 1_500));
  await snap(studio, 'marketplace-both-inputs-filled');

  // Step 5: Click Run.
  const runBtn = studio.locator('button:has-text("Run with payment")').first();
  await runBtn.scrollIntoViewIfNeeded().catch(() => {});
  const enabled = await runBtn.isEnabled().catch(() => false);
  log(`Run button enabled: ${enabled}`);
  if (enabled) {
    await runBtn.click();
    log(`Run with payment CLICKED`);
    await new Promise((r) => setTimeout(r, 6_000));
    await snap(studio, 'studio-after-run-click');

    // Step 6: MM payment tx popup.
    const txPopup = await findExtPage(ctx, 'notification.html', 20_000);
    if (txPopup) {
      log(`MM payment popup: ${txPopup.url().slice(-60)}`);
      await new Promise((r) => setTimeout(r, 8_000));
      await snap(txPopup, 'mm-payment-tx-popup');

      const txText = await txPopup.locator('body').textContent().catch(() => '');
      log(`Tx popup excerpt: ${(txText ?? '').slice(0, 400).replace(/\s+/g, ' ')}`);

      for (const t of ['Confirm', 'Sign', 'Approve', 'Pay']) {
        if (await clickByText(txPopup, t, 2_000)) {
          log(`Tx "${t}" clicked`);
          await new Promise((r) => setTimeout(r, 8_000));
          await snap(txPopup, 'mm-tx-after-confirm');
          log(`Waiting 90s for pipeline + receipt anchor...`);
          await new Promise((r) => setTimeout(r, 90_000));
          await snap(studio, 'studio-pipeline-complete');
          const url = studio.url();
          log(`Studio final URL: ${url}`);
          if (url.includes('/r/')) {
            stepNum++;
            await studio.screenshot({ path: resolve(OUT, `${String(stepNum).padStart(3, '0')}-receipt-fullpage.png`), fullPage: true });
            log(`📸 receipt-fullpage`);
          }
          break;
        }
      }
    } else {
      log(`No MM payment popup found`);
    }
  } else {
    const inlineNote = await studio.locator('text=/drop content|Connect your wallet|enable/i').first().textContent({ timeout: 2_000 }).catch(() => null);
    log(`Run button disabled · inline note: ${inlineNote}`);
  }

  await ctx.close();
  log(`done · ${stepNum} screenshots`);
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
