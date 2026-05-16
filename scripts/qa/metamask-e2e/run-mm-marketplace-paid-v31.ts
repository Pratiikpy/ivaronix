/**
 * v31 · Fills BOTH the content textarea AND the question input, then drives
 * the full paid run end-to-end on production. The UX gate "drop content +
 * question to enable" required both, not just one (v29/v30 lesson).
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
const OUT = resolve(REPO, 'docs', 'video', 'qa', 'verify-fix', 'mm-marketplace-v31');
mkdirSync(OUT, { recursive: true });
const PASSWORD = 'TestPass123!QA';

const CONTENT = `Vendor reserves the right to amend this Agreement at any time without notice.
Customer indemnifies vendor for all third-party claims regardless of fault.
Vendor's liability is capped at $100 cumulative.
Payment is non-refundable under any circumstance.
Auto-renewal after 24 months with no termination for convenience.
Mandatory binding arbitration in Vendor's chosen jurisdiction.`;

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
  log(`v31 · marketplace paid run with BOTH inputs filled`);
  const dataDir = resolve(tmpdir(), `mm-mkt-v31-${Date.now()}`);
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

  // Unlock MM.
  const mmHome = await ctx.newPage();
  await mmHome.goto(`chrome-extension://${extId}/home.html#/unlock`);
  await new Promise((r) => setTimeout(r, 2_500));
  const pwd = mmHome.locator('input[type="password"]').first();
  if (await pwd.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pwd.fill(PASSWORD);
    await mmHome.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 5_000));
  }

  // Studio /marketplace/private-doc-review.
  const studio = await ctx.newPage();
  await studio.goto('https://www.ivaronix.xyz/marketplace/private-doc-review');
  await studio.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 3_000));
  await snap(studio, 'loaded');

  // Connect.
  if (await clickByText(studio, 'Connect wallet')) {
    await new Promise((r) => setTimeout(r, 4_000));
    const popup = await findExtPage(ctx, 'notification.html', 10_000);
    if (popup) {
      await new Promise((r) => setTimeout(r, 6_000));
      if (await clickByText(popup, 'Connect')) {
        await new Promise((r) => setTimeout(r, 4_000));
      }
    }
  }

  // Switch chain.
  if (await clickByText(studio, 'Switch to 0G Mainnet')) {
    await new Promise((r) => setTimeout(r, 4_000));
    const sp = await findExtPage(ctx, 'notification.html', 8_000);
    if (sp) {
      await new Promise((r) => setTimeout(r, 5_000));
      for (const t of ['Approve', 'Switch network', 'Confirm', 'Switch']) {
        if (await clickByText(sp, t, 1_500)) break;
      }
      await new Promise((r) => setTimeout(r, 4_000));
    }
  }
  await snap(studio, 'connected-mainnet');

  // Fill CONTENT (textarea).
  const textarea = studio.locator('textarea').first();
  await textarea.click();
  await textarea.focus();
  await studio.keyboard.type(CONTENT, { delay: 5 });
  log(`Content typed (${CONTENT.length} chars)`);
  await new Promise((r) => setTimeout(r, 1_000));

  // Fill QUESTION (input with placeholder containing "question").
  const questionInput = studio.locator('input[placeholder*="question" i], input[placeholder*="Which clause" i]').first();
  if (await questionInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await questionInput.click();
    await questionInput.focus();
    await studio.keyboard.type(QUESTION, { delay: 5 });
    log(`Question typed: "${QUESTION}"`);
  } else {
    // Fallback: find ALL inputs and try each
    const allInputs = await studio.locator('input').all();
    log(`Found ${allInputs.length} inputs · trying to fill question input`);
    for (const inp of allInputs) {
      const placeholder = await inp.getAttribute('placeholder').catch(() => '');
      if (placeholder?.toLowerCase().includes('question') || placeholder?.toLowerCase().includes('clause')) {
        await inp.click();
        await inp.focus();
        await studio.keyboard.type(QUESTION, { delay: 5 });
        log(`Question typed in input with placeholder "${placeholder}"`);
        break;
      }
    }
  }
  await new Promise((r) => setTimeout(r, 1_500));
  await snap(studio, 'both-inputs-filled');

  // Click Run with payment.
  const runBtn = studio.locator('button:has-text("Run with payment")').first();
  await runBtn.scrollIntoViewIfNeeded().catch(() => {});
  const enabled = await runBtn.isEnabled().catch(() => false);
  log(`Run button enabled: ${enabled}`);
  await snap(studio, 'run-button-state');

  if (enabled) {
    await runBtn.click();
    log(`Run with payment CLICKED`);
    await new Promise((r) => setTimeout(r, 5_000));
    await snap(studio, 'after-run-click');

    // MM payment tx popup.
    const txPopup = await findExtPage(ctx, 'notification.html', 15_000);
    if (txPopup) {
      log(`MM tx popup: ${txPopup.url().slice(-60)}`);
      await new Promise((r) => setTimeout(r, 7_000));
      await snap(txPopup, 'mm-payment-tx');

      const txText = await txPopup.locator('body').textContent().catch(() => '');
      log(`Tx popup excerpt: ${(txText ?? '').slice(0, 300).replace(/\s+/g, ' ')}`);

      let confirmed = false;
      for (const t of ['Confirm', 'Sign', 'Approve', 'Pay']) {
        if (await clickByText(txPopup, t, 2_000)) {
          confirmed = true;
          log(`Tx "${t}" clicked`);
          await new Promise((r) => setTimeout(r, 5_000));
          await snap(txPopup, 'mm-after-confirm');
          break;
        }
      }

      if (confirmed) {
        log(`Waiting 60s for pipeline + receipt anchor...`);
        await new Promise((r) => setTimeout(r, 60_000));
        await snap(studio, 'studio-pipeline-done');
        const url = studio.url();
        log(`Studio URL: ${url}`);
        if (url.includes('/r/')) {
          stepNum++;
          await studio.screenshot({ path: resolve(OUT, `${String(stepNum).padStart(3, '0')}-receipt-fullpage.png`), fullPage: true });
          log(`📸 receipt-fullpage`);
        }
      }
    } else {
      log(`No MM tx popup found`);
    }
  } else {
    // Diagnostic: read state
    const note = await studio.locator('text=/drop content|enable|missing/i').first().textContent({ timeout: 2_000 }).catch(() => null);
    log(`Inline note: ${note}`);
  }

  await ctx.close();
  log(`done · ${stepNum} screenshots`);
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
