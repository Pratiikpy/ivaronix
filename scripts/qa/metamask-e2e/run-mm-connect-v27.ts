/**
 * v27 · Sequel to v26. The unlock works programmatically (v26 captured
 * fully unlocked MM dashboard with operator wallet 0xaa954…677Ce). The
 * Connect popup was captured but DURING its loading state, so Tab+Enter
 * hit nothing useful. v27 waits for the popup to fully render before
 * trying to click the Connect/Next button.
 *
 * Goal: drive the full dApp authorization flow on production /onboard
 * and capture Studio showing the wallet address (connected state).
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
const OUT = resolve(REPO, 'docs', 'video', 'qa', 'verify-fix', 'mm-connect-v27');
mkdirSync(OUT, { recursive: true });

const PASSWORD = 'TestPass123!QA';

let stepNum = 0;
function log(m: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
}
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const safe = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(OUT, safe), fullPage: false });
    log(`📸 ${safe}`);
  } catch (e) {
    log(`shot fail: ${(e as Error).message.slice(0, 60)}`);
  }
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

async function main(): Promise<void> {
  log(`v27 · MM Connect flow completion`);

  const dataDir = resolve(tmpdir(), `mm-connect-v27-${Date.now()}`);
  mkdirSync(dataDir, { recursive: true });
  if (existsSync(SOURCE_PROFILE)) {
    cpSync(SOURCE_PROFILE, dataDir, { recursive: true, force: true });
    log(`profile copied`);
  }

  const ctx = await chromium.launchPersistentContext(dataDir, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
    timeout: 60_000,
  });
  log(`Chromium launched`);

  await new Promise((r) => setTimeout(r, 6_000));
  let extId = '';
  for (const sw of ctx.serviceWorkers()) {
    const m = sw.url().match(/^chrome-extension:\/\/([a-z]+)/);
    if (m) { extId = m[1]; break; }
  }
  if (!extId) { log(`FAIL: no extension id`); await ctx.close(); return; }
  log(`Extension id: ${extId}`);

  // Step 1: Unlock MM via direct home.html navigation.
  const mmHome = await ctx.newPage();
  await mmHome.goto(`chrome-extension://${extId}/home.html#/unlock`, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 2_500));
  await snap(mmHome, 'mm-home-unlock');

  const pwdInput = mmHome.locator('input[type="password"]').first();
  if (await pwdInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pwdInput.fill(PASSWORD);
    await mmHome.keyboard.press('Enter');
    log(`Password typed + Enter pressed`);
    await new Promise((r) => setTimeout(r, 5_000));
    await snap(mmHome, 'mm-after-unlock');
  } else {
    log(`Password input NOT visible · MM may already be unlocked`);
  }

  // Step 2: Drive /onboard with unlocked MM.
  const studio = await ctx.newPage();
  await studio.goto('https://www.ivaronix.xyz/onboard', { waitUntil: 'domcontentloaded' });
  await studio.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 3_000));
  await snap(studio, 'studio-onboard-loaded');

  // Click Connect.
  const connectBtn = studio.locator('button:has-text("Connect injected wallet"), button:has-text("Connect wallet")').first();
  if (!(await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
    log(`Connect button not found — Studio may already see connected wallet`);
    await snap(studio, 'studio-no-connect-button');
    await ctx.close();
    return;
  }
  await connectBtn.click();
  log(`Connect clicked`);
  await new Promise((r) => setTimeout(r, 4_000));
  await snap(studio, 'studio-after-connect-click');

  // Step 3: Find and FULLY WAIT for the Connect popup.
  const popup = await findExtPage(ctx, 'notification.html', 10_000);
  if (!popup) {
    log(`No popup detected`);
    await snap(studio, 'studio-no-popup');
    await ctx.close();
    return;
  }
  log(`MM popup URL: ${popup.url().slice(-60)}`);

  // Wait for popup content to FULLY load (give it 8 seconds for the React app + chain checks).
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await new Promise((r) => setTimeout(r, 8_000));
  await snap(popup, 'mm-popup-fully-loaded');

  // Read what buttons are visible.
  const buttonTexts = await popup.locator('button:visible').allTextContents().catch(() => []);
  log(`Popup buttons: [${buttonTexts.slice(0, 8).map((t) => `"${t.slice(0, 30)}"`).join(', ')}]`);

  // Try the standard sequence: Next → Connect (or Connect directly).
  for (const target of ['Connect', 'Next', 'Confirm', 'Approve', 'Sign']) {
    const btn = popup.locator(`button:has-text("${target}")`).first();
    if (await btn.isVisible({ timeout: 1_500 }).catch(() => false)) {
      const isEnabled = await btn.isEnabled().catch(() => false);
      log(`Found "${target}" button (enabled: ${isEnabled})`);
      if (isEnabled) {
        await btn.click({ timeout: 5_000 }).catch((e) => log(`click "${target}" fail: ${e.message}`));
        await new Promise((r) => setTimeout(r, 3_000));
        await snap(popup, `mm-popup-after-${target.toLowerCase()}`);

        // Re-check buttons for the next step.
        const newButtons = await popup.locator('button:visible').allTextContents().catch(() => []);
        log(`Post-${target} popup buttons: [${newButtons.slice(0, 6).map((t) => `"${t.slice(0, 25)}"`).join(', ')}]`);
        break; // only click one for now; we'll re-iterate if popup still open
      }
    }
  }

  // Step 4: Capture final Studio state.
  await new Promise((r) => setTimeout(r, 6_000));
  await snap(studio, 'studio-final-state');

  // Did Studio show the wallet address?
  const addrMatch = await studio.locator('text=/0xaa954[a-fA-F0-9]+/').first().textContent({ timeout: 3_000 }).catch(() => null);
  log(`Wallet address on Studio: ${addrMatch ?? '(NOT VISIBLE)'}`);

  // Capture top header area in detail.
  await snap(studio, 'studio-header-detail');

  await ctx.close();
  log(`done · ${stepNum} screenshots`);
}

main().catch((e) => {
  console.error('FATAL:', (e as Error).message);
  process.exit(1);
});
