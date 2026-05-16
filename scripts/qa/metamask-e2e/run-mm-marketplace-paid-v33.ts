/**
 * v33 · Full marketplace paid-run end-to-end. Handle BOTH popups:
 *   1. SIWE sign-in (proven in v32)
 *   2. paySkillRun tx confirmation (new — costs ~0.0025 OG net for operator-as-creator)
 *
 * If successful, this is the Track 3 (Agentic Economy) irrefutable proof.
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
const OUT = resolve(REPO, 'docs', 'video', 'qa', 'verify-fix', 'mm-marketplace-v33');
mkdirSync(OUT, { recursive: true });
const PASSWORD = 'TestPass123!QA';
const CONTENT = `Vendor reserves the right to amend this Agreement at any time without notice.
Customer indemnifies vendor for all third-party claims regardless of fault.
Vendor's liability is capped at $100 cumulative.`;
const QUESTION = 'Top 3 risks?';

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
  if (!(await btn.isEnabled().catch(() => false))) { log(`"${text}" disabled`); return false; }
  await btn.click({ timeout: 5_000 }).catch(() => {});
  return true;
}

async function main(): Promise<void> {
  log(`v33 · marketplace paid-run · handle SIWE + tx-confirm`);
  const dataDir = resolve(tmpdir(), `mm-mkt-v33-${Date.now()}`);
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

  // Unlock.
  const mmHome = await ctx.newPage();
  await mmHome.goto(`chrome-extension://${extId}/home.html#/unlock`);
  await new Promise((r) => setTimeout(r, 3_000));
  const pwd = mmHome.locator('input[type="password"]').first();
  if (await pwd.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pwd.fill(PASSWORD);
    await mmHome.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 6_000));
  }

  // Connect via /onboard (proven path).
  const studio = await ctx.newPage();
  await studio.goto('https://www.ivaronix.xyz/onboard');
  await studio.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 4_000));

  if (await clickByText(studio, 'Connect wallet')) {
    await new Promise((r) => setTimeout(r, 5_000));
    const p = await findExtPage(ctx, 'notification.html', 10_000);
    if (p) { await new Promise((r) => setTimeout(r, 7_000)); if (await clickByText(p, 'Connect')) await new Promise((r) => setTimeout(r, 5_000)); }
  }

  // Chain switch.
  if (await clickByText(studio, 'Switch to 0G Mainnet')) {
    await new Promise((r) => setTimeout(r, 4_000));
    const sp = await findExtPage(ctx, 'notification.html', 8_000);
    if (sp) {
      await new Promise((r) => setTimeout(r, 6_000));
      for (const t of ['Approve', 'Switch network', 'Confirm', 'Switch']) {
        if (await clickByText(sp, t, 1_500)) { await new Promise((r) => setTimeout(r, 5_000)); break; }
      }
    }
  }
  await snap(studio, 'onboard-connected-mainnet');

  // Navigate to /marketplace/private-doc-review.
  await studio.goto('https://www.ivaronix.xyz/marketplace/private-doc-review');
  await studio.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 4_000));
  await snap(studio, 'marketplace-loaded');

  // Fill BOTH inputs via keyboard.type.
  const textarea = studio.locator('textarea').first();
  await textarea.scrollIntoViewIfNeeded().catch(() => {});
  await textarea.click();
  await studio.keyboard.type(CONTENT, { delay: 5 });
  await new Promise((r) => setTimeout(r, 1_000));
  const questionInput = studio.locator('input[placeholder*="question" i], input[placeholder*="clause" i]').first();
  if (await questionInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await questionInput.click();
    await studio.keyboard.type(QUESTION, { delay: 5 });
  }
  await new Promise((r) => setTimeout(r, 1_500));
  await snap(studio, 'both-inputs-filled');

  // Click Run.
  const runBtn = studio.locator('button:has-text("Run with payment")').first();
  await runBtn.scrollIntoViewIfNeeded().catch(() => {});
  if (!(await runBtn.isEnabled().catch(() => false))) {
    log(`Run button disabled — aborting`);
    await snap(studio, 'run-disabled');
    await ctx.close();
    return;
  }
  await runBtn.click();
  log(`Run clicked — expect SIWE popup first, then tx-confirm`);
  await new Promise((r) => setTimeout(r, 5_000));
  await snap(studio, 'after-run-click');

  // POPUP 1: SIWE sign-in.
  const siwePopup = await findExtPage(ctx, 'notification.html', 12_000);
  if (siwePopup) {
    log(`Popup 1 (SIWE): ${siwePopup.url().slice(-40)}`);
    await new Promise((r) => setTimeout(r, 7_000));
    await snap(siwePopup, 'popup-1-siwe');
    if (await clickByText(siwePopup, 'Confirm')) {
      log(`SIWE confirmed`);
      await new Promise((r) => setTimeout(r, 6_000));
    }
  } else {
    log(`No SIWE popup detected`);
  }

  // POPUP 2: paySkillRun tx — appears after SIWE handshake completes.
  // Studio button text should change to "Confirm payment in MetaMask..."
  await new Promise((r) => setTimeout(r, 8_000));
  await snap(studio, 'studio-awaiting-tx');

  // Look for a new popup (might be in same or new tab).
  const txPopup = await findExtPage(ctx, 'notification.html', 20_000);
  if (txPopup && !txPopup.isClosed()) {
    log(`Popup 2 (tx): ${txPopup.url().slice(-50)}`);
    await new Promise((r) => setTimeout(r, 8_000));
    await snap(txPopup, 'popup-2-tx-confirm');

    const txText = await txPopup.locator('body').textContent().catch(() => '');
    log(`TX popup excerpt: ${(txText ?? '').slice(0, 400).replace(/\s+/g, ' ')}`);

    // Click Confirm on the tx popup.
    let txConfirmed = false;
    for (const t of ['Confirm', 'Sign', 'Approve']) {
      if (await clickByText(txPopup, t, 2_500)) {
        log(`TX "${t}" clicked — should anchor receipt on chain`);
        txConfirmed = true;
        await new Promise((r) => setTimeout(r, 8_000));
        await snap(txPopup, 'popup-2-after-confirm');
        break;
      }
    }

    if (txConfirmed) {
      log(`Waiting 90s for tx mine + pipeline + receipt anchor...`);
      await new Promise((r) => setTimeout(r, 90_000));
      await snap(studio, 'studio-pipeline-result');
      const url = studio.url();
      log(`Final Studio URL: ${url}`);
      if (url.includes('/r/')) {
        stepNum++;
        await studio.screenshot({ path: resolve(OUT, `${String(stepNum).padStart(3, '0')}-receipt-result-fullpage.png`), fullPage: true });
        log(`📸 receipt-result-fullpage saved`);
      }
    }
  } else {
    log(`No tx popup detected within 20s`);
  }

  await ctx.close();
  log(`done · ${stepNum} screenshots`);
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
