/**
 * v26 · Push past the MM unlock + connect popups by typing the password
 * directly into the focused input. LavaMoat scuttling blocks SELECTOR-based
 * automation, but Playwright's keyboard API works on whatever element has
 * focus inside the extension page.
 *
 * Strategy:
 *   1. Load MM extension into headed Chromium with the pre-onboarded profile
 *   2. Drive production /onboard
 *   3. Click "Connect wallet" → MM popup opens at notification.html#/unlock
 *   4. Find the popup page (chrome-extension://...notification.html)
 *   5. Click the password input by coordinate / locator
 *   6. Type 'TestPass123!QA' (the profile's password)
 *   7. Press Enter (Unlock button is keyboard-accessible)
 *   8. Capture state after unlock
 *   9. If a "Connect" popup appears, navigate it with Tab/Enter
 *  10. Capture final Studio state (should show wallet address)
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXT_PATH = resolve(HERE, 'mm', 'extension');
const SOURCE_PROFILE = resolve(HERE, 'mm', 'profile');
const OUT = resolve(REPO, 'docs', 'video', 'qa', 'verify-fix', 'mm-unlock-v26');
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

async function findExtPage(ctx: import('playwright').BrowserContext, urlSubstr: string, timeoutMs = 10_000): Promise<Page | null> {
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
  log(`v26 · MM unlock + connect via keyboard.type`);

  const dataDir = resolve(tmpdir(), `mm-unlock-v26-${Date.now()}`);
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

  // Service worker warmup.
  await new Promise((r) => setTimeout(r, 5_000));
  const swPre = ctx.serviceWorkers();
  log(`Service workers: ${swPre.length}`);

  // The MM profile in this repo is pre-onboarded but LOCKED. We unlock
  // by opening the home.html#/unlock page directly and typing the
  // password — this avoids depending on the dApp-initiated popup flow
  // which has additional UI steps.
  // Get the extension id from any service worker URL.
  let extId = '';
  for (const sw of ctx.serviceWorkers()) {
    const m = sw.url().match(/^chrome-extension:\/\/([a-z]+)/);
    if (m) { extId = m[1]; break; }
  }
  if (!extId) {
    // Try waiting for service worker to appear.
    log(`waiting for service worker...`);
    await new Promise((r) => setTimeout(r, 5_000));
    for (const sw of ctx.serviceWorkers()) {
      const m = sw.url().match(/^chrome-extension:\/\/([a-z]+)/);
      if (m) { extId = m[1]; break; }
    }
  }
  if (!extId) {
    log(`FAIL: could not detect extension id`);
    await ctx.close();
    return;
  }
  log(`Extension id: ${extId}`);

  // Open the MM home page directly to unlock.
  const mmHome = await ctx.newPage();
  await mmHome.goto(`chrome-extension://${extId}/home.html#/unlock`, { waitUntil: 'domcontentloaded' });
  await mmHome.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 2_000));
  await snap(mmHome, 'mm-home-unlock-loaded');

  // Type password. Click the page to focus, then type.
  // The password input is the only focusable text input on this screen.
  try {
    // Method 1: try finding the input by type=password (works pre-LavaMoat-scuttle)
    const pwdInput = mmHome.locator('input[type="password"]').first();
    const found = await pwdInput.isVisible({ timeout: 5_000 }).catch(() => false);
    log(`password input visible (selector): ${found}`);

    if (found) {
      await pwdInput.click();
      await pwdInput.fill(PASSWORD);
      log(`password typed via selector`);
    } else {
      // Method 2: keyboard-only fallback. Click center of viewport to focus the
      // active input (the password field should be auto-focused on /unlock).
      await mmHome.mouse.click(720, 460); // approximate center where the input lives
      await mmHome.keyboard.type(PASSWORD);
      log(`password typed via keyboard at coords`);
    }
    await new Promise((r) => setTimeout(r, 1_000));
    await snap(mmHome, 'mm-password-typed');

    // Press Enter to submit Unlock.
    await mmHome.keyboard.press('Enter');
    log(`Enter pressed`);
    await new Promise((r) => setTimeout(r, 4_000));
    await snap(mmHome, 'mm-after-unlock');

    // Check what page we landed on.
    log(`MM home URL after unlock: ${mmHome.url().slice(-50)}`);
  } catch (e) {
    log(`unlock attempt failed: ${(e as Error).message.slice(0, 80)}`);
    await snap(mmHome, 'mm-unlock-error');
  }

  // Now drive /onboard with a freshly-unlocked MM.
  const studio = await ctx.newPage();
  await studio.goto('https://www.ivaronix.xyz/onboard', { waitUntil: 'domcontentloaded' });
  await studio.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 3_000));
  await snap(studio, 'studio-onboard-mm-unlocked');

  const connectBtn = studio.locator('button:has-text("Connect injected wallet"), button:has-text("Connect wallet")').first();
  if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    log(`Connect button found, clicking`);
    await connectBtn.click({ timeout: 5_000 }).catch((e) => log(`click fail: ${e.message}`));
    await new Promise((r) => setTimeout(r, 3_000));
    await snap(studio, 'studio-after-connect-click');

    // Look for MM connection popup (notification.html with chains#or connect).
    const popup = await findExtPage(ctx, 'notification.html', 8_000);
    if (popup) {
      log(`MM popup found: ${popup.url().slice(-50)}`);
      await snap(popup, 'mm-connect-popup');

      // Try clicking the "Connect" / "Next" button via keyboard or selector.
      try {
        // First try a "Next" button (standard chain selection step).
        const nextBtn = popup.locator('button:has-text("Next"), button:has-text("Connect")').first();
        if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await nextBtn.click({ timeout: 5_000 });
          log(`Clicked Next/Connect in popup`);
        } else {
          // Keyboard fallback: Tab + Enter
          await popup.keyboard.press('Tab');
          await popup.keyboard.press('Enter');
          log(`Pressed Tab+Enter in popup`);
        }
        await new Promise((r) => setTimeout(r, 3_000));
        await snap(popup, 'mm-popup-after-next');
      } catch (e) {
        log(`popup interaction failed: ${(e as Error).message.slice(0, 60)}`);
      }
    } else {
      log(`No MM popup detected after Connect click`);
    }

    // Final Studio state.
    await new Promise((r) => setTimeout(r, 5_000));
    await snap(studio, 'studio-final-after-mm-flow');

    // Check if Studio shows the wallet address (connected state).
    const addrText = await studio.locator('text=/0x[a-fA-F0-9]{6,}/').first().textContent({ timeout: 3_000 }).catch(() => null);
    log(`Wallet address visible on /onboard: ${addrText ?? '(not yet)'}`);
  }

  await ctx.close();
  log(`done · ${stepNum} screenshots`);
}

main().catch((e) => {
  console.error('FATAL:', (e as Error).message);
  process.exit(1);
});
