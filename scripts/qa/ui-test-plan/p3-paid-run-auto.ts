/**
 * UI_REAL_USER_TEST_PLAN.md Priority 3 · Paid-Run · FULLY AUTOMATED.
 *
 * Real MetaMask extension + real wallet + real popup driving — no human
 * clicks, no DOM mutation, no wallet mocking. Pattern from operator's
 * working settle-protocol Phantom harness:
 *
 *   1. chromium.launchPersistentContext (NOT regular browser)
 *   2. Headed mode (extensions disabled in headless)
 *   3. --disable-blink-features=AutomationControlled hides "Chrome is
 *      controlled by automated test software" banner
 *   4. Close MM's auto-opened onboarding tabs at session start
 *   5. Unlock directly via chrome-extension://<id>/popup.html
 *   6. Wait for popup as separate Page (NOT iframe inside dApp DOM)
 *   7. waitFor → scrollIntoView → hover → click(delay:70) per button
 *   8. Multi-stage loop for warning screens
 *
 * Flow:
 *   1. Boot Chromium + MM extension + persistent profile
 *   2. (First run) MM onboarding programmatically: agree terms → "I have
 *      existing wallet" → SRP import (hardhat junk seed) → password →
 *      acknowledge loss → done
 *   3. Add operator key as Account 2 via Account menu → Import → private
 *      key paste
 *   4. Add 0G Galileo network via wallet_addEthereumChain RPC trigger
 *   5. Navigate /onboard → Connect Wallet → MM popup → click Connect
 *   6. Navigate / → fill RunPanel (text + skill = private-doc-review)
 *   7. Click Run → MM popup for paySkillRun → click Confirm
 *   8. Wait redirect to /r/<id>
 *   9. Capture screenshots at every state + record video
 *
 * Pre-conditions:
 *   - private-doc-review skill published + priced on chain (P3 setup)
 *   - Operator wallet has > 0.05 OG on Galileo (currently 68 OG)
 *   - MM extension unpacked at scripts/qa/metamask-e2e/mm/extension/
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const USER_DATA_DIR = resolve(REPO, 'scripts/qa/ui-test-plan/.p3-mm-profile-stable');
const SHOTS_BASE = resolve(REPO, 'QA_PROOF_PACK/ui/P3-paid-run-auto');
const VIDEO_DIR = resolve(SHOTS_BASE, 'video');
for (const sub of ['desktop', 'video']) mkdirSync(resolve(SHOTS_BASE, sub), { recursive: true });
mkdirSync(USER_DATA_DIR, { recursive: true });

const DEV_SEED = 'test test test test test test test test test test test junk';
const PASSWORD = 'TestPass123!QA';
const GALILEO_RPC = 'https://evmrpc-testnet.0g.ai';
const GALILEO_CHAIN_HEX = '0x40DA'; // 16602
const SAMPLE_TEXT = `Acquisition Term Sheet (Draft · Series A · Cayman vehicle)

The Acquirer agrees to purchase 100% of the Target's equity for $2,000,000 subject to a working capital adjustment.

Non-Compete: The Founder agrees to a 5-year non-compete in any related field, globally.

Indemnification: Founder indemnifies Acquirer for all known and unknown liabilities, with no cap and no time limit.

Governing Law: Cayman Islands.

Closing Conditions: Acquirer may walk away at any time before closing for any reason or no reason, with no break-up fee.`;

// Load operator key from .env walking up
function loadOperatorKey(): string {
  let dir = REPO;
  for (let i = 0; i < 6; i++) {
    const p = resolve(dir, '.env');
    if (existsSync(p)) {
      const text = readFileSync(p, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq < 0) continue;
        const k = t.slice(0, eq).trim();
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!(k in process.env)) process.env[k] = v;
      }
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const k = process.env.IVARONIX_SIGNER_KEY ?? process.env.EVM_PRIVATE_KEY ?? '';
  if (!k) throw new Error('IVARONIX_SIGNER_KEY missing from .env');
  return k.startsWith('0x') ? k : `0x${k}`;
}

let stepNum = 0;
async function snap(page: Page, name: string): Promise<void> {
  stepNum += 1;
  const filename = `${String(stepNum).padStart(3, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) {
    console.log(`  (skip · closed) ${filename}`);
    return;
  }
  try {
    await page.screenshot({ path: resolve(SHOTS_BASE, 'desktop', filename), fullPage: false });
    console.log(`  📸 ${filename}`);
  } catch (e) {
    console.log(`  (skip) ${filename} — ${(e as Error).message.split('\n')[0]}`);
  }
}

async function findExtensionId(ctx: BrowserContext): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const sw = ctx.serviceWorkers();
    if (sw.length > 0) {
      const m = sw[0].url().match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('MM service worker did not appear');
}

async function clickButton(page: Page, locator: string, label: string, timeout = 12_000): Promise<boolean> {
  const btn = page.locator(locator).first();
  try {
    await btn.waitFor({ state: 'visible', timeout });
    await btn.scrollIntoViewIfNeeded();
    await btn.hover();
    await btn.click({ delay: 70 });
    console.log(`  ✓ clicked ${label}`);
    return true;
  } catch (e) {
    console.log(`  ✗ ${label} not clickable: ${(e as Error).message.split('\n')[0]}`);
    return false;
  }
}

// MM onboarding (runs once on first launch of the persistent profile)
async function onboardIfFresh(mmPage: Page, operatorKey: string): Promise<void> {
  await mmPage.waitForTimeout(3_000);
  // Check if already onboarded — wallet home shows "Buy"/"Send"/"Receive"
  const body = await mmPage.locator('body').innerText().catch(() => '');
  if (/Buy|Send|Receive/.test(body) && /0x[a-f0-9]{4}/i.test(body)) {
    console.log('  MM appears already onboarded');
    await snap(mmPage, 'mm-already-onboarded');
    return;
  }

  // Check for unlock screen (onboarded but locked)
  const pwd = mmPage.locator('input[type="password"]').first();
  if (await pwd.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const txt = await mmPage.locator('body').innerText().catch(() => '');
    if (/Unlock|password/i.test(txt) && !/Create.*password/i.test(txt)) {
      console.log('  MM locked, entering password');
      await pwd.fill(PASSWORD);
      await mmPage.keyboard.press('Enter');
      await mmPage.waitForTimeout(4_000);
      await snap(mmPage, 'mm-unlocked-existing');
      return;
    }
  }

  console.log('\n  === MM ONBOARDING (fresh profile) ===');
  await snap(mmPage, 'mm-onboard-welcome');

  // Terms checkbox
  const terms = mmPage.locator('input[data-testid="onboarding-terms-checkbox"], input[type="checkbox"]').first();
  if (await terms.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await terms.check({ force: true }).catch(() => {});
  }

  // "I have an existing wallet"
  await clickButton(mmPage, 'button:has-text("I have an existing wallet"), button:has-text("Import an existing wallet")', 'I have existing wallet');
  await mmPage.waitForTimeout(2_500);

  // Metrics consent
  await clickButton(mmPage, 'button:has-text("I agree"), button:has-text("No thanks"), button:has-text("Accept")', 'metrics consent', 8_000);
  await mmPage.waitForTimeout(2_500);

  // SRP choice screen (MM v13.30+)
  await clickButton(mmPage, 'button:has-text("Import using Secret Recovery Phrase"), button:has-text("Import using SRP")', 'import SRP', 8_000);
  await mmPage.waitForTimeout(2_500);

  // Type SRP into textarea
  console.log('  typing SRP via real keystrokes');
  const srpTextarea = mmPage.locator('textarea').first();
  await srpTextarea.waitFor({ state: 'visible', timeout: 30_000 });
  await srpTextarea.click();
  await mmPage.keyboard.type(DEV_SEED, { delay: 30 });
  await mmPage.waitForTimeout(1_000);
  await snap(mmPage, 'mm-srp-typed');

  await clickButton(mmPage, 'button[data-testid="import-srp-confirm"], button:has-text("Continue"), button:has-text("Import")', 'srp continue', 12_000);
  await mmPage.waitForTimeout(2_500);

  // Set password — two password inputs
  console.log('  setting password');
  await mmPage.locator('input[type="password"]').first().waitFor({ state: 'visible', timeout: 30_000 });
  const pwds = mmPage.locator('input[type="password"]');
  await pwds.first().click();
  await mmPage.keyboard.type(PASSWORD, { delay: 30 });
  await pwds.nth(1).click();
  await mmPage.keyboard.type(PASSWORD, { delay: 30 });

  // Acknowledge "if I lose this password..." checkbox
  const lossAck = mmPage.locator('input[type="checkbox"]').first();
  if (await lossAck.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await lossAck.check({ force: true }).catch(() => {});
  }
  await snap(mmPage, 'mm-password-acked');

  // Submit
  await clickButton(mmPage, 'button:has-text("Create password"), button:has-text("Create new password"), button:has-text("Import my wallet")', 'create password', 12_000);
  await mmPage.waitForTimeout(3_500);

  // Walk through "Got it" / "Done" / "Next" / "Continue" until home
  for (let i = 0; i < 12; i++) {
    const advanced = await clickButton(
      mmPage,
      'button:has-text("Got it"), button:has-text("Done"), button:has-text("Next"), button:has-text("Continue"), button:has-text("Skip"), button:has-text("Open wallet")',
      `post-onboard step ${i}`,
      3_500,
    );
    if (!advanced) break;
    await mmPage.waitForTimeout(2_000);
  }
  await snap(mmPage, 'mm-onboarded');

  // Import operator account
  console.log('\n  === IMPORT OPERATOR ACCOUNT ===');
  await mmPage.bringToFront();
  await mmPage.waitForTimeout(2_000);

  // Click account menu (avatar / name)
  await clickButton(
    mmPage,
    '[data-testid="account-menu-icon"], button[aria-label*="ccount" i], button:has-text("Account")',
    'account menu',
    8_000,
  );
  await mmPage.waitForTimeout(1_500);
  await snap(mmPage, 'mm-account-menu');

  // Click "Add account or hardware wallet" or "Add account"
  await clickButton(
    mmPage,
    'button:has-text("Add account or hardware wallet"), button:has-text("Add account"), button:has-text("Account options")',
    'add account',
    6_000,
  );
  await mmPage.waitForTimeout(1_500);

  // Click "Import account"
  await clickButton(mmPage, 'button:has-text("Import account"), text="Import account"', 'import account', 6_000);
  await mmPage.waitForTimeout(2_500);
  await snap(mmPage, 'mm-import-prompt');

  // Paste private key
  const keyInput = mmPage.locator('input[type="password"], input[placeholder*="private" i]').first();
  await keyInput.waitFor({ state: 'visible', timeout: 8_000 });
  await keyInput.click();
  await mmPage.keyboard.type(operatorKey.replace(/^0x/, ''), { delay: 20 });
  await snap(mmPage, 'mm-key-typed');

  await clickButton(mmPage, 'button:has-text("Import")', 'import button', 8_000);
  await mmPage.waitForTimeout(3_500);
  await snap(mmPage, 'mm-operator-imported');
}

// Drive any single MM popup until it closes or no more buttons
async function drivePopupOnce(popup: Page, label: string, maxSteps = 8): Promise<void> {
  await popup.bringToFront();
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(2_000);
  await snap(popup, `${label}-open`);

  for (let step = 0; step < maxSteps; step++) {
    if (popup.isClosed()) return;
    // First: any "Proceed anyway" / "I understand" warning checkbox
    const warningCheckbox = popup.locator('input[type="checkbox"]').first();
    if (await warningCheckbox.isVisible({ timeout: 800 }).catch(() => false)) {
      await warningCheckbox.check({ force: true }).catch(() => {});
    }
    // Multi-label confirm button
    const confirmBtn = popup
      .locator(
        "button:has-text('Confirm'), button:has-text('Approve'), button:has-text('Sign'), button:has-text('Connect'), button:has-text('Send'), button:has-text('Switch'), button:has-text('Next'), button:has-text('Got it'), button:has-text('Continue'), button:has-text('Proceed')"
      )
      .first();
    try {
      await confirmBtn.waitFor({ state: 'visible', timeout: 4_000 });
      await confirmBtn.scrollIntoViewIfNeeded().catch(() => {});
      await confirmBtn.hover().catch(() => {});
      await confirmBtn.click({ delay: 70 });
      console.log(`  ${label} step ${step}: clicked`);
      await popup.waitForTimeout(1_800);
      if (!popup.isClosed()) await snap(popup, `${label}-step-${step}`);
    } catch {
      console.log(`  ${label}: no actionable button at step ${step}, done`);
      break;
    }
  }
}

async function main(): Promise<void> {
  console.log('UI_REAL_USER_TEST_PLAN.md · P3 Paid-Run · FULLY AUTOMATED');
  console.log(`Target: ${STUDIO}`);
  console.log(`Profile: ${USER_DATA_DIR}`);
  console.log(`Output: ${SHOTS_BASE}\n`);

  const operatorKey = loadOperatorKey();
  console.log(`Operator key loaded · address derivation handled by MM at import time\n`);

  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });

  await new Promise((r) => setTimeout(r, 4_000));

  const extId = await findExtensionId(ctx);
  console.log(`MM extension ID: ${extId}`);

  // Close any MM auto-opened tabs (welcome/onboarding) that we'll handle ourselves
  for (const p of ctx.pages()) {
    if (p.url().includes(extId)) {
      // Keep one for onboarding; close duplicates
      break;
    }
  }

  // 1. Open MM popup.html and onboard/unlock
  console.log('\n=== 1. MetaMask onboarding/unlock ===');
  const mmPopup = await ctx.newPage();
  await mmPopup.goto(`chrome-extension://${extId}/home.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await mmPopup.waitForTimeout(3_000);
  await onboardIfFresh(mmPopup, operatorKey);

  // 2. Navigate to Studio /onboard and Connect Wallet
  console.log('\n=== 2. Studio /onboard → Connect Wallet ===');
  const studio = await ctx.newPage();
  await studio.goto(`${STUDIO}/onboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'onboard-loaded');

  // Listen for connect popup
  const connectPopupP = ctx.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
  await clickButton(studio, 'button:has-text("Connect wallet"), button:has-text("Connect injected")', 'Connect wallet', 10_000);
  await studio.waitForTimeout(2_000);
  const connectPopup = await connectPopupP;
  if (connectPopup && connectPopup.url().includes(extId)) {
    await drivePopupOnce(connectPopup, 'mm-connect');
  } else {
    // Sometimes MM injects in-context vs popup — give it another beat
    await studio.waitForTimeout(2_000);
    const popup = ctx.pages().find((p) => p.url().includes(extId) && p !== mmPopup);
    if (popup) await drivePopupOnce(popup, 'mm-connect');
  }
  await studio.bringToFront();
  await studio.waitForTimeout(3_000);
  await snap(studio, 'after-connect');

  // 3. Switch to Galileo network — Studio should prompt OR we can request
  console.log('\n=== 3. Switch to Galileo ===');
  const switchPromise = ctx.waitForEvent('page', { timeout: 10_000 }).catch(() => null);
  await studio.evaluate(async (chainHex) => {
    const eth = (window as unknown as { ethereum?: { request: (req: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) return;
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainHex }] });
    } catch (err: unknown) {
      const e = err as { code?: number };
      if (e?.code === 4902) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainHex,
            chainName: '0G Galileo',
            rpcUrls: ['https://evmrpc-testnet.0g.ai'],
            nativeCurrency: { name: 'OG', symbol: 'OG', decimals: 18 },
            blockExplorerUrls: ['https://chainscan-galileo.0g.ai'],
          }],
        });
      }
    }
  }, GALILEO_CHAIN_HEX).catch(() => {});
  const switchPopup = await switchPromise;
  if (switchPopup && switchPopup.url().includes(extId)) {
    await drivePopupOnce(switchPopup, 'mm-switch-chain');
  }
  await studio.bringToFront();
  await studio.waitForTimeout(2_500);
  await snap(studio, 'after-chain-switch');

  // 4. Navigate to home + fill RunPanel
  console.log('\n=== 4. Fill RunPanel on landing ===');
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(3_500);
  await snap(studio, 'landing-connected');

  const textarea = studio.locator('textarea').first();
  if (await textarea.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await textarea.click();
    await textarea.fill(SAMPLE_TEXT);
  }
  const question = studio.locator('input[placeholder*="worst" i], input[placeholder*="question" i]').first();
  if (await question.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await question.click();
    await question.fill('Which clause is most concerning?');
  }
  await snap(studio, 'runpanel-filled');

  // 5. Run + payment popup
  console.log('\n=== 5. Click Run → MM payment popup ===');
  const payPopupP = ctx.waitForEvent('page', { timeout: 60_000 }).catch(() => null);
  await clickButton(studio, 'button:has-text("Run"), button:has-text("Run review")', 'Run', 8_000);
  await studio.waitForTimeout(3_000);
  await snap(studio, 'after-run-click');

  const payPopup = await payPopupP;
  if (payPopup && payPopup.url().includes(extId)) {
    await drivePopupOnce(payPopup, 'mm-payment');
  } else {
    const popup = ctx.pages().find((p) => p.url().includes(extId) && p !== mmPopup && p !== studio);
    if (popup) await drivePopupOnce(popup, 'mm-payment');
  }

  // 6. Wait for receipt redirect
  console.log('\n=== 6. Wait for receipt anchor ===');
  let receiptId: string | null = null;
  for (let i = 0; i < 90; i++) {
    const url = studio.url();
    const m = url.match(/\/r\/(\d+)/);
    if (m) {
      receiptId = m[1];
      console.log(`  ✓ receipt anchored: rec_${receiptId}`);
      break;
    }
    await studio.waitForTimeout(2_000);
  }

  if (receiptId) {
    await studio.waitForTimeout(3_000);
    await snap(studio, `receipt-${receiptId}-top`);
    await studio.evaluate(() => window.scrollBy(0, 600));
    await studio.waitForTimeout(500);
    await snap(studio, `receipt-${receiptId}-mid`);
    await studio.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await studio.waitForTimeout(500);
    await snap(studio, `receipt-${receiptId}-bottom`);
  } else {
    await snap(studio, 'no-receipt-final');
  }

  console.log(`\nFinal URL: ${studio.url()}`);
  console.log(`Receipt: ${receiptId ?? 'NONE'}`);
  await ctx.close();
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
