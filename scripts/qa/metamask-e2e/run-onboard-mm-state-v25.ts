/**
 * v25 · Drive /onboard on production with MM v13.30 extension loaded.
 * Captures the FULL connect-wallet flow state on the Studio side,
 * regardless of whether we can drive the MM popup itself.
 *
 * Goal: prove the Studio's UX is correct when a real user with MM
 * would walk through the 5-step onboarding. Even without programmatic
 * popup driving, we capture:
 *   1. /onboard initial render (extension loaded, no auth yet)
 *   2. Click "Connect injected wallet" → Studio state immediately after
 *   3. The MM popup appearance (best-effort)
 *   4. Studio state while waiting for popup confirm
 *   5. Any error or timeout state Studio shows
 *
 * This is the operator-in-loop hybrid pattern per CLAUDE.md §16.1.
 * The agent drives Studio; an operator-or-no-one clicks MM popups;
 * we capture every Studio-side transition.
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXT_PATH = resolve(HERE, 'mm', 'extension');
const SOURCE_PROFILE = resolve(HERE, 'mm', 'profile');
const OUT = resolve(REPO, 'docs', 'video', 'qa', 'verify-fix', 'mm-onboard-v25');
mkdirSync(OUT, { recursive: true });

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

async function main(): Promise<void> {
  log(`v25 · MM /onboard state capture`);

  const dataDir = resolve(tmpdir(), `mm-onboard-v25-${Date.now()}`);
  mkdirSync(dataDir, { recursive: true });
  if (existsSync(SOURCE_PROFILE)) {
    cpSync(SOURCE_PROFILE, dataDir, { recursive: true, force: true });
    log(`profile copied to ${dataDir}`);
  }

  // Launch headed Chromium with MM extension loaded. We can't drive
  // the MM popup itself (LavaMoat scuttling blocks programmatic clicks),
  // but we CAN observe the Studio side responding to the connection
  // attempt.
  const ctx = await chromium.launchPersistentContext(dataDir, {
    headless: false, // headed so MM service worker activates
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
    timeout: 60_000,
  });
  log(`Chromium launched with MM extension loaded`);

  // Wait for MM service worker to come up.
  await new Promise((r) => setTimeout(r, 5_000));
  const swPre = ctx.serviceWorkers();
  log(`Service workers detected: ${swPre.length} · ${swPre.map((s) => s.url().slice(-40)).join(', ')}`);

  // Open /onboard.
  const page = await ctx.newPage();
  await page.goto('https://www.ivaronix.xyz/onboard', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 2_500));
  await snap(page, 'onboard-loaded-with-mm');

  // Look for the connect button. Studio's button text per onboard.tsx
  // is "Connect injected wallet" (when MM is detected).
  const connectBtn = page.locator(
    'button:has-text("Connect injected wallet"), button:has-text("Connect Wallet"), button:has-text("Connect wallet")',
  ).first();

  const isVisible = await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  log(`Connect button visible: ${isVisible}`);

  if (isVisible) {
    const text = await connectBtn.textContent().catch(() => '');
    log(`Connect button text: "${text?.trim() ?? ''}"`);
    await snap(page, 'before-connect-click');

    // Click and observe.
    await connectBtn.click({ timeout: 5_000 }).catch((e) => log(`click fail: ${e.message}`));
    log(`Clicked Connect`);
    await new Promise((r) => setTimeout(r, 3_000));
    await snap(page, 'after-connect-click');

    // Wait for any MM popup window or new context page.
    await new Promise((r) => setTimeout(r, 4_000));

    // Check for new pages that may be the MM popup (notification.html or popup.html).
    const allPages = ctx.pages();
    log(`Total open pages: ${allPages.length}`);
    for (const p of allPages) {
      const url = p.url();
      log(`  page: ${url.slice(0, 80)}`);
      if (url.includes('notification.html') || url.includes('popup.html') || url.includes('home.html')) {
        try {
          await p.screenshot({ path: resolve(OUT, `${String(++stepNum).padStart(3, '0')}-mm-popup-${url.slice(-20).replace(/[^a-z0-9]+/gi, '-')}.png`) });
          log(`📸 captured MM popup at ${url.slice(-40)}`);
        } catch (e) {
          log(`popup shot fail: ${(e as Error).message.slice(0, 60)}`);
        }
      }
    }

    // Capture Studio's state after waiting for popup.
    await snap(page, 'studio-waiting-for-popup-confirm');

    // Wait some more to see if popup auto-closes or any timeout state shows.
    await new Promise((r) => setTimeout(r, 8_000));
    await snap(page, 'studio-final-state');
  } else {
    log(`Connect button NOT visible — capturing what's on screen instead`);
    const buttonsText = await page.locator('button:visible').allTextContents().catch(() => []);
    log(`Visible buttons: ${buttonsText.slice(0, 10).join(' · ')}`);
  }

  await ctx.close();
  log(`done · ${stepNum} screenshots in ${OUT}`);
}

main().catch((e) => {
  console.error('FATAL:', (e as Error).message);
  process.exit(1);
});
