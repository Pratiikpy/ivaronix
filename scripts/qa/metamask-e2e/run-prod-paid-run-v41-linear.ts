/**
 * v41 · LINEAR paid-run · zero abstraction · proven-pattern verbatim.
 *
 * No drivePopup wrapper. Each MM popup is driven inline with the exact
 * pattern that test-mm-click-strategies proved works:
 *   1. waitForTimeout 3s BEFORE bringToFront (popup renders in background)
 *   2. bringToFront
 *   3. screenshot (forces render flush)
 *   4. bbox-wait
 *   5. click
 *   6. waitForTimeout 3s post-click (popup may close)
 *
 * Stages:
 *   A. Unlock MM
 *   B. Open Studio + Click Connect + drive MM connect popup
 *   C. Detect wrong-chain banner + drive MM switch-chain popup
 *   D. Click Use sample
 *   E. Click Run + drive MM tx-sign popup(s)
 *   F. Wait for /r/<id> redirect
 *   G. Output receipt URL + tx hash
 */
import 'dotenv/config';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PASSWORD = 'TestPass123!QA';
const EXT_PATH = resolve(HERE, 'mm', 'extension');
const SOURCE_PROFILE = resolve(HERE, 'mm', 'profile');
const STUDIO = 'https://www.ivaronix.xyz';
const MAINNET_HEX = '0x412d';
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-paid-run-v41');
mkdirSync(OUT, { recursive: true });

let stepNum = 0;
const events: string[] = [];
function log(msg: string): void {
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`[${stamp}] ${msg}`);
  events.push(`[${stamp}] ${msg}`);
}
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const safe = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) { log(`(skip) ${safe} — page closed`); return; }
  try { await page.screenshot({ path: resolve(OUT, safe), fullPage: false }); log(`📸 ${safe}`); }
  catch (e) { log(`(skip) ${safe}: ${(e as Error).message.slice(0, 60)}`); }
}

async function waitForPopup(ctx: BrowserContext, extId: string, known: Set<Page>, ms = 25_000): Promise<Page | null> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    for (const p of ctx.pages()) {
      if (known.has(p)) continue;
      if (p.url().includes(extId)) return p;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

// Verbatim test-mm-click-strategies pattern, no abstraction.
async function drivePopupOnce(popup: Page, label: string, snapLabel: string): Promise<boolean> {
  log(`  drive ${label}: render-wait 3s`);
  try { await popup.waitForTimeout(3_000); } catch { log(`  ${label}: popup closed during wait`); return true; }
  if (popup.isClosed()) { log(`  ${label}: popup closed after render-wait`); return true; }
  try { await popup.bringToFront(); } catch { /* may be detaching */ }
  try { await popup.screenshot({ path: resolve(OUT, `${snapLabel}.png`), fullPage: true }); } catch { /* */ }

  const btn = popup.locator('[data-testid="confirm-btn"]');
  const bbox = await btn.boundingBox({ timeout: 12_000 }).catch(() => null);
  if (!bbox) {
    const allBtns = await popup.locator('button').allTextContents().catch(() => [] as string[]);
    log(`  ${label}: bbox timeout · url=${popup.url().slice(0, 70)} · buttons=[${allBtns.slice(0, 6).join(' | ').slice(0, 200)}]`);
    return false;
  }
  log(`  ${label}: bbox x=${Math.round(bbox.x)} y=${Math.round(bbox.y)} w=${Math.round(bbox.width)} h=${Math.round(bbox.height)}`);

  try {
    await btn.click({ timeout: 8_000 });
    log(`  ${label}: ✓ click done`);
  } catch (e) {
    log(`  ${label}: click failed: ${(e as Error).message.slice(0, 80)}`);
    return false;
  }
  try { await popup.waitForTimeout(3_000); } catch { log(`  ${label}: popup auto-closed (normal)`); return true; }
  return true;
}

async function readChainId(studio: Page): Promise<string | null> {
  try {
    return await studio.evaluate(async () => {
      const eth = (window as { ethereum?: { request: (a: { method: string }) => Promise<string> } }).ethereum;
      if (!eth) return null;
      return await eth.request({ method: 'eth_chainId' });
    });
  } catch { return null; }
}

(async () => {
  log(`v41 LINEAR paid-run · target: 1 fresh receipt`);
  const tmpProfile = resolve(REPO, '.v41-profile');
  if (existsSync(tmpProfile)) rmSync(tmpProfile, { recursive: true, force: true });
  const { cpSync } = await import('node:fs');
  log(`Cloning MM profile`);
  cpSync(SOURCE_PROFILE, tmpProfile, { recursive: true });

  const ctx = await chromium.launchPersistentContext(tmpProfile, {
    headless: false,
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
    viewport: { width: 1440, height: 900 },
  });
  log(`Chromium launched`);

  let extId = '';
  for (let i = 0; i < 10; i++) {
    const sw = ctx.serviceWorkers().find((w) => w.url().includes('chrome-extension://'));
    if (sw) { extId = sw.url().split('/')[2]; log(`MM extId: ${extId}`); break; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!extId) { log('FATAL: MM SW not found'); process.exit(1); }

  // === STAGE A: Unlock MM ===
  const mm = await ctx.newPage();
  await mm.goto(`chrome-extension://${extId}/home.html`);
  await mm.waitForTimeout(3_000);
  await snap(mm, 'mm-initial');
  const pwInput = mm.locator('input[type="password"]').first();
  if (await pwInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pwInput.fill(PASSWORD);
    await mm.locator('button:has-text("Unlock"), button[data-testid="unlock-submit"]').first().click().catch(() => {});
    await mm.waitForTimeout(3_000);
    log(`STAGE A: MM unlocked`);
  }
  await snap(mm, 'mm-unlocked');

  // === STAGE B: Connect to Studio ===
  const studio = await ctx.newPage();
  await studio.goto(STUDIO, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(5_000);
  await snap(studio, 'studio-loaded');

  let known = new Set<Page>(ctx.pages());
  const connectBtn = studio.locator('button:has-text("Connect"), a:has-text("Connect Wallet")').first();
  if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await connectBtn.click({ timeout: 5_000 });
    log(`STAGE B: Connect clicked`);
    const popup = await waitForPopup(ctx, extId, known, 25_000);
    if (popup) {
      await drivePopupOnce(popup, 'mm-connect', 'popup-mm-connect');
      await studio.bringToFront();
      await studio.waitForTimeout(5_000);
    }
  }
  await snap(studio, 'after-connect');
  // Verify connected (header shows address)
  const headerText = await studio.locator('header').textContent({ timeout: 3_000 }).catch(() => '');
  if (!headerText?.includes('0x')) {
    log(`STAGE B FAIL: header has no address: "${headerText?.slice(0, 100)}"`);
    writeFileSync(resolve(OUT, 'REPORT.md'), `# v41 FAIL stage B\n${events.join('\n')}`);
    await ctx.close();
    process.exit(1);
  }
  log(`STAGE B PASS: connected, header="${headerText?.slice(0, 80)}"`);

  // === STAGE C: Ensure mainnet ===
  let chainOK = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const cid = await readChainId(studio);
    log(`STAGE C: attempt ${attempt + 1} chainId=${cid}`);
    if (cid === MAINNET_HEX) { chainOK = true; break; }
    // Find switch button
    const switchBtn = studio.locator('button:has-text("Switch to 0G Mainnet"), a:has-text("Switch to 0G Mainnet")').first();
    if (await switchBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      known = new Set<Page>(ctx.pages());
      await switchBtn.click({ timeout: 5_000 });
      log(`STAGE C: Switch button clicked`);
      const popup = await waitForPopup(ctx, extId, known, 20_000);
      if (popup) await drivePopupOnce(popup, 'mm-switch', `popup-mm-switch-a${attempt + 1}`);
      await studio.bringToFront();
      await studio.waitForTimeout(4_000);
    } else {
      log(`STAGE C: no Switch button (banner missing)`);
      await studio.waitForTimeout(3_000);
    }
  }
  await snap(studio, 'after-chain-switch');
  if (!chainOK) {
    log(`STAGE C FAIL: chain still not mainnet`);
    writeFileSync(resolve(OUT, 'REPORT.md'), `# v41 FAIL stage C\n${events.join('\n')}`);
    await ctx.close();
    process.exit(1);
  }
  log(`STAGE C PASS: wallet on OG Mainnet (${MAINNET_HEX})`);

  // === STAGE D: Use sample ===
  const useSampleBtn = studio.locator('a:has-text("Use sample contract"), button:has-text("Use sample contract")').first();
  if (await useSampleBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await useSampleBtn.click({ timeout: 5_000 });
    log(`STAGE D: Use sample clicked`);
    await studio.waitForTimeout(3_000);
  } else {
    log(`STAGE D: no Use sample CTA — assuming form is fillable`);
  }
  await snap(studio, 'after-use-sample');

  // === STAGE E: Click Run ===
  const runBtn = studio.locator('button:has-text("Run"):not([disabled])').first();
  if (!(await runBtn.isVisible({ timeout: 10_000 }).catch(() => false))) {
    log(`STAGE E FAIL: Run button not enabled`);
    writeFileSync(resolve(OUT, 'REPORT.md'), `# v41 FAIL stage E\n${events.join('\n')}`);
    await ctx.close();
    process.exit(1);
  }
  known = new Set<Page>(ctx.pages());
  await runBtn.click({ timeout: 5_000 });
  log(`STAGE E: Run clicked`);
  await studio.waitForTimeout(2_000);
  await snap(studio, 'after-run-click');

  // Drive 1-3 sequential MM popups (paySkillRun, possibly SIWE refresh)
  for (let popupIdx = 0; popupIdx < 4; popupIdx++) {
    const popup = await waitForPopup(ctx, extId, known, 25_000);
    if (!popup) break;
    log(`STAGE E: popup #${popupIdx + 1} detected · driving`);
    await drivePopupOnce(popup, `mm-tx-${popupIdx + 1}`, `popup-mm-tx-${popupIdx + 1}`);
    known.add(popup);
    await studio.bringToFront();
    await studio.waitForTimeout(4_000);
  }

  // === STAGE F: Wait for /r/<id> ===
  const startWait = Date.now();
  let receiptId: string | null = null;
  while (Date.now() - startWait < 180_000) {
    const url = studio.url();
    const m = url.match(/\/r\/(\d+)/);
    if (m) { receiptId = m[1]; log(`STAGE F PASS: redirected to /r/${receiptId}`); break; }
    await studio.waitForTimeout(3_000);
  }
  await snap(studio, 'final-state');

  if (!receiptId) {
    log(`STAGE F FAIL: no /r/<id> redirect after 180s`);
    writeFileSync(resolve(OUT, 'REPORT.md'), `# v41 FAIL stage F\n${events.join('\n')}`);
    await ctx.close();
    process.exit(1);
  }

  // === STAGE G: Output ===
  const headline = await studio.locator('p').first().textContent({ timeout: 5_000 }).catch(() => '');
  log(`Receipt URL: ${STUDIO}/r/${receiptId}`);
  log(`AI headline: ${headline?.slice(0, 200)}`);
  writeFileSync(resolve(OUT, 'REPORT.md'), `# v41 PASS\nReceipt URL: ${STUDIO}/r/${receiptId}\nAI: ${headline?.slice(0, 500)}\n\n${events.join('\n')}`);
  log(`v41 PASS · receipt ${receiptId}`);
  await ctx.close();
  process.exit(0);
})().catch((e) => {
  log(`FATAL: ${(e as Error).message}`);
  writeFileSync(resolve(OUT, 'REPORT.md'), `# v41 FATAL\n${(e as Error).message}\n\n${events.join('\n')}`);
  process.exit(2);
});
