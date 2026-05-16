/**
 * v28 · Drive /dashboard with a CONNECTED MM wallet. Never tested in
 * the connected state across the prior 6 audit sessions — judge would
 * see this page if they click Dashboard nav after connecting.
 *
 * Also tests:
 *   - The "Switch to 0G Mainnet" button in the wrong-network banner
 *   - Studio behavior when wallet has a passport (tokenId 2 already
 *     minted on operator wallet)
 *   - /dashboard connected-state rendering with real on-chain reads
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
const OUT = resolve(REPO, 'docs', 'video', 'qa', 'verify-fix', 'mm-dashboard-v28');
mkdirSync(OUT, { recursive: true });
const PASSWORD = 'TestPass123!QA';

let stepNum = 0;
function log(m: string): void { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const safe = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(OUT, safe), fullPage: false });
    log(`📸 ${safe}`);
  } catch { /* swallow */ }
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

async function clickByText(page: Page, text: string, timeoutMs = 4_000): Promise<boolean> {
  const btn = page.locator(`button:has-text("${text}")`).first();
  if (!(await btn.isVisible({ timeout: timeoutMs }).catch(() => false))) return false;
  await btn.click({ timeout: 5_000 }).catch(() => {});
  return true;
}

async function main(): Promise<void> {
  log(`v28 · MM dashboard connected-state capture`);
  const dataDir = resolve(tmpdir(), `mm-dash-v28-${Date.now()}`);
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

  // Unlock MM.
  const mmHome = await ctx.newPage();
  await mmHome.goto(`chrome-extension://${extId}/home.html#/unlock`, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 2_500));
  const pwdInput = mmHome.locator('input[type="password"]').first();
  if (await pwdInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pwdInput.fill(PASSWORD);
    await mmHome.keyboard.press('Enter');
    log(`Password typed + Enter`);
    await new Promise((r) => setTimeout(r, 5_000));
  }
  await snap(mmHome, 'mm-unlocked');

  // Connect via /onboard.
  const studio = await ctx.newPage();
  await studio.goto('https://www.ivaronix.xyz/onboard', { waitUntil: 'domcontentloaded' });
  await studio.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 3_000));
  await snap(studio, 'studio-onboard-initial');

  if (await clickByText(studio, 'Connect wallet')) {
    log(`Onboard Connect clicked`);
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
  await snap(studio, 'studio-onboard-connected');

  // Navigate to /dashboard.
  await studio.goto('https://www.ivaronix.xyz/dashboard', { waitUntil: 'domcontentloaded' });
  await studio.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 5_000));
  await snap(studio, 'dashboard-connected-state');
  log(`/dashboard navigated, capturing full page`);

  // Capture full-page including footer.
  try {
    stepNum++;
    await studio.screenshot({ path: resolve(OUT, `${String(stepNum).padStart(3, '0')}-dashboard-fullpage.png`), fullPage: true });
    log(`📸 dashboard-fullpage`);
  } catch { /* skip */ }

  // Try the "Switch to 0G Mainnet" button to trigger chain-switch popup.
  await studio.goto('https://www.ivaronix.xyz/onboard', { waitUntil: 'domcontentloaded' });
  await studio.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 3_000));
  await snap(studio, 'onboard-with-mismatch-warning');

  if (await clickByText(studio, 'Switch to 0G Mainnet')) {
    log(`Chain-switch clicked`);
    await new Promise((r) => setTimeout(r, 4_000));
    const switchPopup = await findExtPage(ctx, 'notification.html', 10_000);
    if (switchPopup) {
      await switchPopup.waitForLoadState('domcontentloaded').catch(() => {});
      await new Promise((r) => setTimeout(r, 5_000));
      await snap(switchPopup, 'mm-chain-switch-popup');
      // The chain-switch popup typically has "Approve" or "Switch network" button.
      for (const t of ['Approve', 'Switch network', 'Switch', 'Confirm']) {
        if (await clickByText(switchPopup, t, 1_500)) {
          log(`Clicked "${t}" in chain-switch popup`);
          await new Promise((r) => setTimeout(r, 4_000));
          break;
        }
      }
    }
    await new Promise((r) => setTimeout(r, 4_000));
    await snap(studio, 'onboard-after-chain-switch');
  } else {
    log(`No "Switch to 0G Mainnet" button visible (may already be on mainnet)`);
  }

  // Final /dashboard capture (post-switch).
  await studio.goto('https://www.ivaronix.xyz/dashboard', { waitUntil: 'domcontentloaded' });
  await studio.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 6_000));
  await snap(studio, 'dashboard-after-chain-switch');
  try {
    stepNum++;
    await studio.screenshot({ path: resolve(OUT, `${String(stepNum).padStart(3, '0')}-dashboard-after-switch-fullpage.png`), fullPage: true });
    log(`📸 dashboard-after-switch-fullpage`);
  } catch { /* skip */ }

  await ctx.close();
  log(`done · ${stepNum} screenshots`);
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
