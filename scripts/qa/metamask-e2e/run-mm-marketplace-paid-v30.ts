/**
 * v30 · v29 fix · use page.keyboard.type() instead of locator.fill() so
 * React's onChange handler fires per-keystroke, which is what enables
 * the "Run with payment" button. Also scroll the run button into view
 * before clicking.
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
const OUT = resolve(REPO, 'docs', 'video', 'qa', 'verify-fix', 'mm-marketplace-v30');
mkdirSync(OUT, { recursive: true });
const PASSWORD = 'TestPass123!QA';
const SAMPLE = `Vendor reserves the right to amend this Agreement at any time without notice.
Customer indemnifies vendor for all third-party claims regardless of fault.
Vendor's liability is capped at $100 cumulative.
Payment is non-refundable.
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
  await btn.scrollIntoViewIfNeeded({ timeout: 3_000 }).catch(() => {});
  const enabled = await btn.isEnabled().catch(() => false);
  if (!enabled) { log(`button "${text}" found but disabled`); return false; }
  await btn.click({ timeout: 5_000 }).catch(() => {});
  return true;
}

async function main(): Promise<void> {
  log(`v30 · marketplace paid run (React-onChange fix)`);
  const dataDir = resolve(tmpdir(), `mm-mkt-v30-${Date.now()}`);
  mkdirSync(dataDir, { recursive: true });
  if (existsSync(SOURCE_PROFILE)) cpSync(SOURCE_PROFILE, dataDir, { recursive: true, force: true });

  const ctx = await chromium.launchPersistentContext(dataDir, {
    headless: false, viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, '--no-sandbox', '--disable-blink-features=AutomationControlled'],
    timeout: 60_000,
  });
  await new Promise((r) => setTimeout(r, 6_000));

  let extId = '';
  for (const sw of ctx.serviceWorkers()) {
    const m = sw.url().match(/^chrome-extension:\/\/([a-z]+)/);
    if (m) { extId = m[1]; break; }
  }
  if (!extId) { log(`no extId`); await ctx.close(); return; }

  // Unlock.
  const mmHome = await ctx.newPage();
  await mmHome.goto(`chrome-extension://${extId}/home.html#/unlock`);
  await new Promise((r) => setTimeout(r, 2_500));
  const pwd = mmHome.locator('input[type="password"]').first();
  if (await pwd.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pwd.fill(PASSWORD);
    await mmHome.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 5_000));
  }

  // Studio.
  const studio = await ctx.newPage();
  await studio.goto('https://www.ivaronix.xyz/marketplace/private-doc-review', { waitUntil: 'domcontentloaded' });
  await studio.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 3_000));
  await snap(studio, 'marketplace-loaded');

  if (await clickByText(studio, 'Connect wallet')) {
    await new Promise((r) => setTimeout(r, 4_000));
    const popup = await findExtPage(ctx, 'notification.html', 10_000);
    if (popup) {
      await new Promise((r) => setTimeout(r, 6_000));
      if (await clickByText(popup, 'Connect')) {
        log(`Connect popup confirmed`);
        await new Promise((r) => setTimeout(r, 4_000));
      }
    }
  }
  await new Promise((r) => setTimeout(r, 3_000));

  if (await clickByText(studio, 'Switch to 0G Mainnet')) {
    await new Promise((r) => setTimeout(r, 4_000));
    const switchPopup = await findExtPage(ctx, 'notification.html', 8_000);
    if (switchPopup) {
      await new Promise((r) => setTimeout(r, 5_000));
      for (const t of ['Approve', 'Switch network', 'Confirm', 'Switch']) {
        if (await clickByText(switchPopup, t, 1_500)) { log(`chain-switch ${t}`); break; }
      }
      await new Promise((r) => setTimeout(r, 4_000));
    }
  }
  await snap(studio, 'marketplace-connected-mainnet');

  // KEY FIX: use page.keyboard.type so React onChange fires per keystroke.
  const pasteBox = studio.locator('textarea').first();
  if (await pasteBox.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pasteBox.click();
    await pasteBox.focus();
    // Use keyboard.type with delay so React's input event fires for each char.
    // This is the difference from v29's .fill() which only sets value at end.
    await studio.keyboard.type(SAMPLE, { delay: 5 });
    log(`Sample text typed (${SAMPLE.length} chars, with React onChange events)`);
    await new Promise((r) => setTimeout(r, 1_500));
    await snap(studio, 'marketplace-text-typed');
  }

  // Scroll button into view + click.
  const runBtn = studio.locator('button:has-text("Run with payment")').first();
  if (await runBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await runBtn.scrollIntoViewIfNeeded();
    await snap(studio, 'marketplace-run-button-visible');
    const enabled = await runBtn.isEnabled().catch(() => false);
    log(`Run button enabled: ${enabled}`);
    if (enabled) {
      await runBtn.click();
      log(`Run clicked!`);
      await new Promise((r) => setTimeout(r, 4_000));
      await snap(studio, 'studio-after-run-click');

      // MM payment tx popup.
      const txPopup = await findExtPage(ctx, 'notification.html', 15_000);
      if (txPopup) {
        log(`Payment tx popup: ${txPopup.url().slice(-60)}`);
        await new Promise((r) => setTimeout(r, 7_000));
        await snap(txPopup, 'mm-payment-tx-popup');
        const txText = await txPopup.locator('body').textContent().catch(() => '');
        log(`Tx popup excerpt: ${(txText ?? '').slice(0, 250).replace(/\s+/g, ' ')}`);

        let txConfirmed = false;
        for (const t of ['Confirm', 'Sign', 'Approve', 'Pay', 'Next']) {
          if (await clickByText(txPopup, t, 2_000)) {
            log(`Tx ${t} clicked`);
            txConfirmed = true;
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 5_000));
        await snap(txPopup, txConfirmed ? 'mm-tx-confirmed' : 'mm-tx-buttons-not-found');

        if (txConfirmed) {
          log(`waiting 60s for pipeline + receipt anchor...`);
          await new Promise((r) => setTimeout(r, 60_000));
          await snap(studio, 'studio-pipeline-complete');
          const url = studio.url();
          log(`Studio URL after pipeline: ${url}`);
          if (url.includes('/r/')) {
            stepNum++;
            await studio.screenshot({ path: resolve(OUT, `${String(stepNum).padStart(3, '0')}-receipt-final.png`), fullPage: true });
            log(`📸 receipt-final (FULLPAGE)`);
          }
        }
      } else {
        log(`No payment tx popup detected`);
      }
    } else {
      log(`Run button still disabled — typing didn't trigger React onChange OR another gate active`);
      // Diagnostic: read button's full state
      const btnText = await runBtn.textContent().catch(() => '');
      log(`Run button text: "${btnText}"`);
      const ariaDisabled = await runBtn.getAttribute('aria-disabled').catch(() => null);
      log(`aria-disabled: ${ariaDisabled}`);
    }
  } else {
    log(`Run button not found`);
  }

  await ctx.close();
  log(`done · ${stepNum} screenshots`);
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
