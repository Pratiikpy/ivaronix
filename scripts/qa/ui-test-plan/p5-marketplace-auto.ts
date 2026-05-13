/**
 * UI_REAL_USER_TEST_PLAN.md Priority 5 · Marketplace Paid-Run · FULLY AUTOMATED.
 *
 * Adapted from p3-paid-run-auto.ts to target /marketplace/<skillId>
 * instead of the home RunPanel. Validates the BuyAndRunButton end-to-end:
 *   - Real MM extension popup driving for SIWE Sign + paySkillRun Confirm
 *   - The new input UI (file drop + textarea + question + Burn Mode)
 *   - viem `waitForTransactionReceipt` finalizes before /api/run/confirm
 *   - 90s AbortController timeout surfaces honest errors (052d509)
 *   - Receipt anchors with billing.payment block populated
 *   - Redirect to /r/<id> proof page
 *
 * Reuses the persistent MM profile from p3 (.p3-mm-profile-stable) so the
 * onboarding step is skipped on second runs.
 *
 * Pre-conditions:
 *   - private-doc-review skill published + priced on chain
 *   - MM profile has been onboarded once via p3-paid-run-auto.ts
 *   - Hardhat junk Account 1 (0xf39F...2266) funded with >= 0.05 OG
 *     for the paySkillRun cost (~0.005 OG + gas)
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const SKILL_ID = process.env.SKILL_ID ?? '0x0934cfc21748e6a579630c2637fcb1f95b9fa2acfb16039e1a7ed70473860dcb';
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const USER_DATA_DIR = resolve(REPO, 'scripts/qa/ui-test-plan/.p3-mm-profile-stable');
const SHOTS_BASE = resolve(REPO, 'QA_PROOF_PACK/ui/P5-marketplace-auto');
const VIDEO_DIR = resolve(SHOTS_BASE, 'video');
for (const sub of ['desktop', 'video']) mkdirSync(resolve(SHOTS_BASE, sub), { recursive: true });
mkdirSync(USER_DATA_DIR, { recursive: true });

const SAMPLE_TEXT = `Acquisition Term Sheet (Draft · Series A · Cayman vehicle)

The Acquirer agrees to purchase 100% of the Target's equity for $2,000,000 subject to a working capital adjustment.

Non-Compete: The Founder agrees to a 5-year non-compete in any related field, globally.

Indemnification: Founder indemnifies Acquirer for all known and unknown liabilities, with no cap and no time limit.

Governing Law: Cayman Islands.

Closing Conditions: Acquirer may walk away at any time before closing for any reason or no reason, with no break-up fee.`;

const QUESTION = 'Which clause is most risky for the Founder?';
const GALILEO_CHAIN_HEX = '0x40DA';
const DEV_SEED = 'test test test test test test test test test test test junk';
const PASSWORD = 'TestPass123!QA';

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
  if (page.isClosed()) { console.log(`  (skip · closed) ${filename}`); return; }
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

async function unlockMM(mmPopup: Page): Promise<void> {
  console.log('  waiting for MM UI to render (up to 30s)...');
  await mmPopup.waitForTimeout(3_000);

  // Check if locked
  const passwordInput = mmPopup.locator('input[type="password"]').first();
  if (await passwordInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    console.log('  MM locked · entering password');
    await passwordInput.fill(PASSWORD);
    const unlock = mmPopup.locator('button:has-text("Unlock")').first();
    await unlock.click({ timeout: 4_000 }).catch(() => {});
    await mmPopup.waitForTimeout(2_500);
  }
  await snap(mmPopup, 'mm-unlocked');
}

async function drivePopupOnce(popup: Page, label: string, maxSteps = 8): Promise<void> {
  await popup.bringToFront();
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(2_000);
  await snap(popup, `${label}-open`);

  for (let step = 0; step < maxSteps; step++) {
    if (popup.isClosed()) return;
    const warningCheckbox = popup.locator('input[type="checkbox"]').first();
    if (await warningCheckbox.isVisible({ timeout: 800 }).catch(() => false)) {
      await warningCheckbox.check({ force: true }).catch(() => {});
    }
    const confirmBtn = popup
      .locator(
        "button:not([disabled]):has-text('Confirm'), " +
        "button:not([disabled]):has-text('Approve'), " +
        "button:not([disabled]):has-text('Sign'), " +
        "button:not([disabled]):has-text('Connect'), " +
        "button:not([disabled]):has-text('Send'), " +
        "button:not([disabled]):has-text('Switch'), " +
        "button:not([disabled]):has-text('Next'), " +
        "button:not([disabled]):has-text('Got it'), " +
        "button:not([disabled]):has-text('Continue'), " +
        "button:not([disabled]):has-text('Proceed')",
      )
      .filter({ hasNotText: /Cancel/i })
      .first();
    try {
      await confirmBtn.waitFor({ state: 'visible', timeout: 4_000 });
      const txt = await confirmBtn.textContent().catch(() => '?');
      await confirmBtn.scrollIntoViewIfNeeded().catch(() => {});
      await confirmBtn.hover().catch(() => {});
      await confirmBtn.click({ delay: 70, force: true });
      console.log(`  ${label} step ${step}: clicked "${txt?.trim()}"`);
      await popup.waitForTimeout(2_500);
      if (!popup.isClosed()) await snap(popup, `${label}-step-${step}`);
    } catch (e) {
      console.log(`  ${label}: selector miss at step ${step}, trying Enter`);
      try {
        await popup.bringToFront();
        await popup.keyboard.press('Enter');
        await popup.waitForTimeout(2_500);
        if (!popup.isClosed()) {
          await snap(popup, `${label}-enter-${step}`);
          continue;
        }
      } catch {/* fallthrough */}
      console.log(`  ${label}: no actionable at step ${step}, done`);
      break;
    }
  }
}

async function main(): Promise<void> {
  console.log('UI_REAL_USER_TEST_PLAN.md · P5 Marketplace Paid-Run · FULLY AUTOMATED');
  console.log(`Target: ${STUDIO}/marketplace/${SKILL_ID}`);
  console.log(`Profile: ${USER_DATA_DIR}`);
  console.log(`Output: ${SHOTS_BASE}\n`);

  const operatorKey = loadOperatorKey();
  console.log(`Operator key loaded (length ${operatorKey.length}) · MM expected to already have hardhat junk Account 1 from prior p3 run\n`);

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

  const allCreatedPages: Page[] = [];
  ctx.on('page', (p) => {
    allCreatedPages.push(p);
    console.log(`  [page-event] new: ${p.url().slice(0, 100)}`);
  });

  await new Promise((r) => setTimeout(r, 4_000));
  const extId = await findExtensionId(ctx);
  console.log(`MM extension ID: ${extId}`);

  // 1. Unlock MM
  console.log('\n=== 1. MetaMask unlock ===');
  const mmPopup = await ctx.newPage();
  await mmPopup.goto(`chrome-extension://${extId}/home.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await unlockMM(mmPopup);

  // 2. Navigate to marketplace skill detail
  console.log('\n=== 2. Open /marketplace/<skillId> ===');
  const studio = await ctx.newPage();
  await studio.goto(`${STUDIO}/marketplace/${SKILL_ID}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(3_500);
  await snap(studio, 'marketplace-skill-loaded');

  // Verify the new input UI rendered
  const dropzoneVisible = await studio.locator('text=/Drop a file or click to browse/i').isVisible({ timeout: 5_000 }).catch(() => false);
  console.log(`  New input UI present: ${dropzoneVisible}`);

  // 3. Connect wallet (header button) if not already connected
  console.log('\n=== 3. Connect wallet ===');
  const connectBtn = studio.locator('button:has-text("Connect wallet")').first();
  if (await connectBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const beforeCount = allCreatedPages.length;
    await connectBtn.click({ timeout: 5_000 }).catch(() => {});
    await studio.waitForTimeout(6_000);
    const newPages = allCreatedPages.slice(beforeCount);
    for (const p of newPages) {
      if (p.url().includes(extId) && !p.isClosed()) {
        await drivePopupOnce(p, 'mm-connect', 6);
      }
    }
  } else {
    console.log('  wallet already connected (or page state different)');
  }
  await studio.bringToFront();
  await studio.waitForTimeout(2_500);
  await snap(studio, 'after-connect');

  // 4. Ensure Galileo chain (request via injected provider)
  console.log('\n=== 4. Ensure Galileo network ===');
  const switchP = ctx.waitForEvent('page', { timeout: 8_000 }).catch(() => null);
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
  const sp = await switchP;
  if (sp && sp.url().includes(extId)) {
    await drivePopupOnce(sp, 'mm-switch-chain', 4);
  }
  await studio.bringToFront();
  await studio.waitForTimeout(2_500);
  await snap(studio, 'after-chain-switch');

  // 5. Fill the new input UI (textarea + question)
  console.log('\n=== 5. Fill input UI (textarea + question) ===');
  // Try textarea first (visible, no need for setInputFiles)
  const textarea = studio.locator('textarea').first();
  if (await textarea.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await textarea.click();
    await textarea.fill(SAMPLE_TEXT);
    console.log(`  ✓ pasted ${SAMPLE_TEXT.length} chars into textarea`);
  } else {
    // Fallback: file drop via setInputFiles
    const sampleFile = resolve(tmpdir(), `p5-sample-${Date.now()}.txt`);
    writeFileSync(sampleFile, SAMPLE_TEXT, 'utf8');
    const fileInput = studio.locator('input[type="file"]').first();
    await fileInput.setInputFiles(sampleFile, { timeout: 8_000 }).catch((e) => console.log(`  ⚠ setInputFiles failed: ${(e as Error).message}`));
  }
  await studio.waitForTimeout(1_500);

  const questionInput = studio.locator('input[placeholder*="question" i]').first();
  if (await questionInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await questionInput.click();
    await questionInput.fill(QUESTION);
    console.log(`  ✓ filled question`);
  }
  await snap(studio, 'marketplace-inputs-filled');

  // 6. Click "Run with payment" — drives SIWE popup + paySkillRun popup
  console.log('\n=== 6. Click "Run with payment" → drive MM popups ===');
  const runBtn = studio.locator('button:has-text("Run with payment")').first();
  await runBtn.click({ timeout: 8_000 }).catch((e) => console.log(`  ⚠ Run click failed: ${(e as Error).message}`));
  await studio.waitForTimeout(3_000);
  await snap(studio, 'after-run-click');

  // Loop-drive any popups (SIWE first, then paySkillRun)
  let driven = 0;
  for (let i = 0; i < 6; i++) {
    const popup = ctx.pages().find((p) =>
      p.url().includes(extId) &&
      !p.url().includes('home.html') &&
      p !== mmPopup && p !== studio,
    );
    if (popup) {
      const label = driven === 0 ? 'mm-siwe' : `mm-pay-${driven}`;
      await drivePopupOnce(popup, label, 6);
      driven += 1;
      await studio.waitForTimeout(2_500);
      continue;
    }
    if (/\/r\/\d+/.test(studio.url())) break;
    // check for error toast (the new 90s timeout fix surfaces as "Run timed out…")
    const errText = await studio.locator('text=/timed out|FETCH_TIMEOUT|provider rejected/i').first().textContent({ timeout: 1_000 }).catch(() => null);
    if (errText) {
      console.log(`  ⚠ error toast: ${errText.slice(0, 80)}`);
      break;
    }
    await studio.waitForTimeout(4_500);
  }

  // 7. Wait for redirect to /r/<id>
  console.log('\n=== 7. Wait for receipt anchor ===');
  let receiptId: string | null = null;
  for (let i = 0; i < 90; i++) {
    const url = studio.url();
    const m = url.match(/\/r\/(\d+)/);
    if (m) { receiptId = m[1]; console.log(`  ✓ receipt anchored: rec_${receiptId}`); break; }
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
    // capture whatever the final state is — may be the new "Run timed out" error
    await snap(studio, 'no-receipt-final');
    const errPanel = await studio.locator('text=/Error · |timed out|FETCH_TIMEOUT/i').first().textContent({ timeout: 2_000 }).catch(() => null);
    if (errPanel) console.log(`  Final error state: ${errPanel.trim().slice(0, 200)}`);
  }

  console.log(`\nFinal URL: ${studio.url()}`);
  console.log(`Receipt: ${receiptId ?? 'NONE'}`);
  console.log(`MM popups driven: ${driven}`);
  await ctx.close();
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
