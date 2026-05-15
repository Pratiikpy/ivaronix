/**
 * Real-MM production Connect+SIWE smoke on https://ivaronix.vercel.app
 *
 * Drives the existing MetaMask harness (pre-onboarded with operator's
 * signer key per scripts/qa/metamask-e2e/mm/profile) against the live
 * production Studio. Tests the wallet-flow surface that doesn't cost OG:
 *
 *   1. Launch Chromium headed with MM v13.30 extension loaded
 *   2. Unlock MM with the harness's known password
 *   3. Navigate to https://ivaronix.vercel.app/onboard
 *   4. Click "Connect injected wallet" · drive the MM Connect popup
 *   5. If site requests SIWE signature · drive the MM Sign popup
 *   6. If site requests network switch to chainId 16661 · accept
 *   7. Capture: screenshots at every transition · session video
 *
 * Paid-run / marketplace buy / memory grant / passport mint flows that
 * spend real OG are operator-driven follow-ups (each costs 0.005-0.02 OG
 * real mainnet · this script intentionally stops at Connect+SIWE to
 * avoid autonomous spend on production wallet flows).
 *
 * Output:
 *   QA_PROOF_PACK/submission-final/mm-smoke/screenshots/*.png
 *   QA_PROOF_PACK/submission-final/mm-smoke/video.webm
 *   QA_PROOF_PACK/submission-final/mm-smoke/log.md
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-smoke');
const SHOTS = resolve(OUT, 'screenshots');
const VIDEO_DIR = resolve(OUT, 'video');
mkdirSync(SHOTS, { recursive: true });
mkdirSync(VIDEO_DIR, { recursive: true });

const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const USER_DATA_DIR = resolve(REPO, 'scripts/qa/metamask-e2e/mm/profile');
const PASSWORD = 'TestPass123!QA';
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

let step = 0;
const events: string[] = [];

async function snap(page: Page, label: string): Promise<void> {
  step++;
  const name = `${String(step).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  try {
    await page.screenshot({ path: resolve(SHOTS, name), fullPage: false });
    console.log(`  📸 ${name}`);
    events.push(`📸 ${name}`);
  } catch (e) {
    console.log(`  (skip) ${name}: ${(e as Error).message.slice(0, 80)}`);
    events.push(`(skip) ${name}: ${(e as Error).message.slice(0, 80)}`);
  }
}

async function findExtensionId(context: BrowserContext): Promise<string> {
  // Try service worker route (MV3 standard)
  for (let i = 0; i < 120; i++) {
    const sw = context.serviceWorkers();
    if (sw.length > 0) {
      const m = sw[0]!.url().match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) return m[1]!;
    }
    // Also try background page route (MV2 fallback) - poll for any extension-scoped page
    const pages = context.pages();
    for (const p of pages) {
      const m = p.url().match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) return m[1]!;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('MM service worker / background page did not appear in 60s · MV3 extensions need a real desktop display');
}

async function main(): Promise<void> {
  console.log(`real-MM prod Connect+SIWE smoke against ${STUDIO}`);
  events.push(`Started ${new Date().toISOString()}`);
  events.push(`Studio: ${STUDIO}`);

  console.log('Launching Chromium with MM v13.30 extension ...');
  // Try headless first (chromium "new" headless supports extensions on most platforms)
  // Falls back to headed:false if headless fails
  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: true,
      viewport: { width: 1440, height: 900 },
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--headless=new',
      ],
      recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
    });
  } catch (e1) {
    console.log(`headless launch failed: ${(e1 as Error).message.slice(0, 100)} · trying headed`);
    events.push(`headless launch failed: ${(e1 as Error).message.slice(0, 100)}`);
    context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      viewport: { width: 1440, height: 900 },
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
      ],
      recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
    });
  }

  try {
    const extId = await findExtensionId(context);
    console.log(`MM extension id: ${extId}`);
    events.push(`MM extension id: ${extId}`);

    // 1. Unlock MM (profile already onboarded)
    const mmHome = `chrome-extension://${extId}/home.html`;
    let mmPage = context.pages().find((p) => p.url().startsWith(mmHome)) ?? await context.newPage();
    if (!mmPage.url().startsWith(mmHome)) await mmPage.goto(mmHome);
    await mmPage.bringToFront();
    await mmPage.waitForSelector('button, input[type="password"]', { timeout: 30_000 }).catch(() => {});
    await mmPage.waitForTimeout(2_000);
    await snap(mmPage, 'mm-initial');

    const unlockBtn = mmPage.locator('button:has-text("Unlock")').first();
    if (await unlockBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      console.log('  unlocking MM with harness password');
      await mmPage.locator('input[type="password"]').first().fill(PASSWORD);
      await unlockBtn.click({ timeout: 10_000 });
      await mmPage.waitForTimeout(3_000);
      await snap(mmPage, 'mm-unlocked');
      events.push('MM unlocked');
    } else {
      console.log('  MM already unlocked OR fresh-state (skipping unlock)');
      events.push('MM unlock screen not visible');
    }

    // 2. Open production Studio /onboard
    console.log(`\nNavigating to ${STUDIO}/onboard ...`);
    const studioPage = await context.newPage();
    await studioPage.goto(`${STUDIO}/onboard`, { waitUntil: 'networkidle', timeout: 30_000 });
    await studioPage.waitForTimeout(2_000);
    await snap(studioPage, 'studio-onboard');
    events.push(`Studio /onboard HTTP loaded`);

    // 3. Click "Connect injected wallet" / "Connect Wallet"
    console.log('  Clicking Connect Wallet ...');
    const connectBtn = studioPage.locator('button:has-text("Connect injected wallet"), button:has-text("Connect wallet"), button:has-text("Connect Wallet")').first();
    const connectVisible = await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!connectVisible) {
      events.push('Connect Wallet button not found on /onboard · trying / instead');
      await studioPage.goto(STUDIO, { waitUntil: 'networkidle' });
      await studioPage.waitForTimeout(1_500);
      await snap(studioPage, 'studio-home');
    }

    // Wait for MM Connect popup
    const connectPopupPromise = context.waitForEvent('page', { timeout: 20_000, predicate: (p) => p.url().includes(extId) }).catch(() => null);
    if (connectVisible) await connectBtn.click({ timeout: 5_000 });
    const popup = await connectPopupPromise;
    if (popup) {
      console.log('  MM Connect popup appeared · driving Confirm');
      events.push('MM Connect popup appeared');
      await popup.waitForLoadState('domcontentloaded');
      await popup.waitForTimeout(1_500);
      await snap(popup, 'mm-connect-popup');
      const confirmBtn = popup.locator('button:has-text("Connect"), button:has-text("Confirm"), button:has-text("Next")').first();
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click({ timeout: 5_000 });
        await popup.waitForTimeout(2_000);
        await snap(popup, 'mm-connect-confirmed');
        events.push('MM Connect confirmed');
      }
    } else {
      events.push('MM Connect popup did NOT appear within 20s · Connect button might not have fired the request (selector miss or already-connected state)');
    }

    // 4. Look for SIWE / sign popup (if site requests it)
    await studioPage.waitForTimeout(3_000);
    await snap(studioPage, 'studio-after-connect');
    const sigPopupPromise = context.waitForEvent('page', { timeout: 8_000, predicate: (p) => p.url().includes(extId) }).catch(() => null);
    const sigPopup = await sigPopupPromise;
    if (sigPopup) {
      console.log('  MM Sign popup appeared (SIWE) · driving Sign');
      events.push('MM SIWE Sign popup appeared');
      await sigPopup.waitForLoadState('domcontentloaded');
      await sigPopup.waitForTimeout(1_500);
      await snap(sigPopup, 'mm-siwe-popup');
      const signBtn = sigPopup.locator('button:has-text("Sign"), button:has-text("Confirm")').first();
      if (await signBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await signBtn.click({ timeout: 5_000 });
        await sigPopup.waitForTimeout(2_000);
        await snap(sigPopup, 'mm-siwe-signed');
        events.push('MM SIWE signature signed');
      }
    } else {
      events.push('No additional MM Sign popup within 8s (site may use eth_requestAccounts only · no SIWE flow on /onboard yet)');
    }

    await studioPage.waitForTimeout(3_000);
    await snap(studioPage, 'studio-final-connected');

    // 5. Capture address visible on page
    const addressMatch = await studioPage.evaluate(() => {
      const text = document.body.textContent ?? '';
      const m = text.match(/0x[a-fA-F0-9]{40}/);
      return m ? m[0] : null;
    });
    if (addressMatch) {
      console.log(`  Connected wallet visible: ${addressMatch}`);
      events.push(`Connected wallet visible on page: ${addressMatch}`);
    } else {
      events.push('No wallet address visible on page · Connect may not have completed');
    }
  } finally {
    await context.close();
  }

  const log = `# real-MM production Connect+SIWE smoke · ${new Date().toISOString()}\n\n## Studio\n\n${STUDIO}\n\n## Events\n\n${events.map((e) => `- ${e}`).join('\n')}\n\n## Artifacts\n\n- Screenshots: \`QA_PROOF_PACK/submission-final/mm-smoke/screenshots/*.png\` (${step} captures)\n- Video: \`QA_PROOF_PACK/submission-final/mm-smoke/video/*.webm\`\n\n## Scope\n\nThis smoke covers Connect+SIWE (no OG cost). Paid-run / marketplace buy / memory grant / passport mint MM popups remain operator-driven follow-ups · each costs 0.005-0.02 OG real mainnet · the harness at \`scripts/qa/metamask-e2e/run.ts\` can be extended with mainnet network-add to drive those flows when the operator is ready to authorize the spend.\n`;
  writeFileSync(resolve(OUT, 'log.md'), log);
  console.log(`\n=== DONE ===\n${step} screenshots captured · log at ${resolve(OUT, 'log.md')}`);
}

main().catch((e) => { console.error('FATAL:', e instanceof Error ? e.message : String(e)); process.exit(1); });
