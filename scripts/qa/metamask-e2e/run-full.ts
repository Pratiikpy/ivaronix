/**
 * QA: full product E2E with real MetaMask + funded wallet.
 *
 * Picks up from the persisted profile (must already be onboarded with the
 * hardhat seed via run.ts at least once). Then:
 *   1. Unlock
 *   2. Import EVM_PRIVATE_KEY as a second account
 *   3. Switch to imported account
 *   4. Open Studio /onboard, click Connect (handle popup if it appears)
 *   5. Type handle → Continue → mint → handle MM signing popup → wait for confirm
 *   6. Click Run sample audit → wait for fresh receipt id
 *   7. Navigate to /r/<new id>
 *   8. Tour /, /skills, /global, /dashboard, /memory + drill into a skill
 *   9. Take side-by-side screenshots vs brand/Ivaronix.html for each route
 *  10. Print video file sizes (Playwright auto-records into screenshots/metamask/)
 */

import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, statSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const text = readFileSync(resolve(REPO, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
  return env;
}

const env = loadEnv();
const PRIVATE_KEY = (env.EVM_PRIVATE_KEY ?? '').replace(/^0x/, '');
const WALLET_ADDR = env.EVM_WALLET_ADDRESS ?? '';
if (!PRIVATE_KEY) { console.error('FAIL: EVM_PRIVATE_KEY missing'); process.exit(1); }

const PASSWORD = 'TestPass123!QA';
const HANDLE = 'qa-' + Math.random().toString(36).slice(2, 8);

const EXTENSION_PATH = resolve(HERE, 'mm', 'extension');
const USER_DATA_DIR = resolve(HERE, 'mm', 'profile');
const SHOTS_DIR = resolve(REPO, 'screenshots', 'metamask-full');
mkdirSync(SHOTS_DIR, { recursive: true });

const STUDIO = 'http://localhost:3300';
const BRAND_HTML = resolve(REPO, 'brand', 'Ivaronix.html');

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const name = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) { console.log(`   (skip) ${name} — page closed`); return; }
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   📸 ${name}`);
  } catch (e) {
    console.log(`   (skip) ${name} — ${(e as Error).message.split('\n')[0]}`);
  }
}

async function findExtensionId(context: BrowserContext): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const sw = context.serviceWorkers();
    if (sw.length > 0) {
      const m = sw[0].url().match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('extension service worker not found');
}

// Walks any MM popup through Next/Connect/Confirm/Approve/Switch/Got it/Continue/Sign
// CTA chain until it closes or stalls.
async function drivePopup(popup: Page, label: string, maxSteps = 15): Promise<void> {
  await popup.bringToFront().catch(() => {});
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(1_500);
  await snap(popup, `${label}-open`);
  const ctaTexts = ['Connect', 'Confirm', 'Approve', 'Switch network', 'Switch to', 'Switch', 'Got it', 'Continue', 'Next', 'Sign', 'Add network', 'Got it!'];
  for (let step = 0; step < maxSteps; step++) {
    if (popup.isClosed()) { console.log(`   ${label}: popup closed at step ${step}`); return; }
    let clicked = false;
    for (const txt of ctaTexts) {
      const btn = popup.locator(`button:has-text("${txt}"):not([disabled])`).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        console.log(`   ${label}: step ${step} → "${txt}"`);
        await btn.click({ timeout: 5_000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) { console.log(`   ${label}: stall at step ${step}`); break; }
    await popup.waitForTimeout(2_000).catch(() => {});
    if (!popup.isClosed()) await snap(popup, `${label}-step-${step}`);
  }
}

async function unlockMM(mmPage: Page): Promise<void> {
  await mmPage.waitForSelector('button, input[type="password"]', { timeout: 60_000 }).catch(() => {});
  await mmPage.waitForTimeout(2_000);
  const isUnlock = await mmPage.locator('button:has-text("Unlock")').first().isVisible({ timeout: 3_000 }).catch(() => false);
  if (isUnlock) {
    console.log('   unlocking...');
    await mmPage.locator('input[type="password"]').first().fill(PASSWORD);
    await mmPage.locator('button:has-text("Unlock"), button:has-text("Sign in")').first().click({ timeout: 8_000 }).catch(() => {});
    await mmPage.waitForTimeout(3_000);
  }
  await snap(mmPage, 'mm-home');
}

// MM v13.30: bypass menu navigation by going directly to the hash route
// for the import-account form. If that fails, fall back to clicking through
// Admin → Add a wallet → Import an account.
async function importPrivateKey(mmPage: Page): Promise<void> {
  console.log('\n=== importing private key ===');
  await mmPage.bringToFront();

  // Verified data-testids from button enumeration:
  //   [1] account-menu-icon  (text "Admin")
  //   [2] account-options-menu-button (kebab)
  // Click account-menu-icon → modal opens → click "Add account or hardware wallet"
  //   → click "Import an account" → paste PK → click Import.
  console.log('   step 1: click account-menu-icon');
  await mmPage.locator('[data-testid="account-menu-icon"]').first().click({ timeout: 5_000 });
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, 'mm-account-modal');

  // Click "Add account or hardware wallet" using getByText (the row is a div).
  console.log('   step 2: click "Add account or hardware wallet"');
  await mmPage.getByText('Add account or hardware wallet', { exact: false }).first().click({ timeout: 5_000 });
  await mmPage.waitForTimeout(1_500);
  await snap(mmPage, 'mm-add-account-menu');

  // v13.30 label is "Import an account" + subtitle "Via a private key".
  // The row is a clickable div (not a button). Playwright's getByText with
  // exact:false will resolve to the nearest clickable ancestor on click.
  const importBtn = mmPage.getByText('Import an account', { exact: false }).first();
  await importBtn.click({ timeout: 5_000 });
  await mmPage.waitForTimeout(1_500);
  await snap(mmPage, 'mm-import-form');

  // Paste the private key into the input. MM uses input[id="private-key-box"]
  // historically; fall back to first text input.
  const pkInput = mmPage.locator(
    'input#private-key-box, input[placeholder*="private key" i], input[type="password"]:not([data-testid="unlock"]), input[type="text"]'
  ).first();
  await pkInput.click({ timeout: 5_000 });
  await mmPage.keyboard.type(PRIVATE_KEY, { delay: 5 });
  await mmPage.waitForTimeout(800);
  await snap(mmPage, 'mm-pk-typed');

  // Submit Import
  const submitBtn = mmPage.locator(
    'button:has-text("Import"):not([disabled]), button[data-testid="import-account-confirm-button"]:not([disabled])'
  ).first();
  await submitBtn.click({ timeout: 5_000 });
  await mmPage.waitForTimeout(3_000);
  await snap(mmPage, 'mm-imported');
  console.log('   imported account');
}

async function main(): Promise<void> {
  console.log('=== launching Chromium with persisted MM profile ===');
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
    recordVideo: { dir: SHOTS_DIR, size: { width: 1440, height: 900 } },
  });

  // Bump default timeouts globally — wallet flows + 0G Compute runs need ≫30s.
  context.setDefaultTimeout(60_000);
  context.setDefaultNavigationTimeout(120_000);

  const extId = await findExtensionId(context);
  console.log(`   ext id: ${extId}`);
  const mmHomeUrl = `chrome-extension://${extId}/home.html`;

  let mmPage = context.pages().find((p) => p.url().includes(extId));
  if (!mmPage) { mmPage = await context.newPage(); await mmPage.goto(mmHomeUrl); }
  await mmPage.bringToFront();

  await unlockMM(mmPage);

  // Import private key (only if the imported address isn't already in the profile).
  // Best-effort: try, swallow errors, screenshot at each stage.
  try { await importPrivateKey(mmPage); } catch (e) {
    console.log(`   WARN: import flow failed: ${(e as Error).message}`);
    console.log('   (continuing — account may already be imported from prior run)');
  }

  console.log('\n=== Studio: connect on /onboard ===');
  const studio = await context.newPage();
  await studio.goto(`${STUDIO}/onboard`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await studio.waitForTimeout(2_000);
  await snap(studio, 'studio-onboard-pre');

  // Capture any popup the Connect click triggers.
  const popupP1 = context.waitForEvent('page', { timeout: 12_000 }).catch(() => null);
  const connectBtn = studio.getByRole('button', { name: /Connect.*wallet|Connect injected/i }).first();
  if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await connectBtn.click({ timeout: 8_000 });
    const p1 = await popupP1;
    if (p1) await drivePopup(p1, 'mm-connect');
  } else {
    console.log('   already connected (no Connect button visible)');
  }
  await studio.bringToFront();
  await studio.waitForTimeout(3_000);
  await snap(studio, 'studio-onboard-connected');

  // Wait for wagmi to rehydrate and read balance — header should show 0x... + Disconnect.
  await studio.waitForFunction(() => /Disconnect/i.test(document.body?.innerText ?? ''), { timeout: 10_000 }).catch(() => {});
  await studio.waitForTimeout(2_000);
  await snap(studio, 'studio-onboard-rehydrated');

  // ── Add 0G Galileo to MetaMask via wallet_addEthereumChain ──────────────
  // Studio's wagmi config has chainId 16602 but MM doesn't know about it.
  // wallet_addEthereumChain blocks on user approval — we MUST drive the popup
  // in parallel, not await the evaluate first.
  console.log('\n=== adding 0G Galileo to MetaMask ===');
  const addChainPopupP = context.waitForEvent('page', { timeout: 12_000 }).catch(() => null);
  // Fire the evaluate without awaiting — promise resolves only when user approves.
  const addChainResultP = studio.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eth = (window as any).ethereum;
    if (!eth) return 'NO_ETHEREUM';
    try {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x40DA',  // 16602 hex
          chainName: '0G Galileo Testnet',
          nativeCurrency: { name: '0G', symbol: 'OG', decimals: 18 },
          rpcUrls: ['https://evmrpc-testnet.0g.ai'],
          blockExplorerUrls: ['https://chainscan-galileo.0g.ai'],
        }],
      });
      return 'OK';
    } catch (e) {
      return 'ERR:' + (e as Error).message;
    }
  });
  const addChainPopup = await addChainPopupP;
  if (addChainPopup) {
    await drivePopup(addChainPopup, 'mm-add-chain', 8);
    await studio.bringToFront();
  } else {
    console.log('   (no popup — chain may already be added)');
  }
  // Now await the evaluate result (popup approved → resolved; rejected → rejected).
  const addChainResult = await Promise.race([
    addChainResultP,
    new Promise<string>((r) => setTimeout(() => r('TIMEOUT'), 8_000)),
  ]);
  console.log(`   wallet_addEthereumChain → ${addChainResult}`);
  await studio.waitForTimeout(2_000);

  // Refetch balance — click "I funded — re-check" if balance still shows zero.
  const recheckBtn = studio.locator('button:has-text("I funded — re-check"), button:has-text("re-check")').first();
  if (await recheckBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    console.log('   clicking "I funded — re-check"');
    await recheckBtn.click({ timeout: 3_000 }).catch(() => {});
    await studio.waitForTimeout(3_000);
  }
  await snap(studio, 'studio-balance-checked');

  // ── Step 3: type handle ────────────────────────────────────────────────
  // Note: this funded wallet already has a passport (tokenId 1, 517+ receipts
  // in QA log), so onboard mint will revert with "already minted". We capture
  // the gating screenshots through step 3 as proof, then skip to the home
  // page where Run panel can generate a fresh receipt.
  console.log(`\n=== onboard step 3: type handle ${HANDLE} (mint will revert: passport exists) ===`);
  const handleInput = studio.locator('input[placeholder="your-handle"]').first();
  if (await handleInput.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await handleInput.click();
    await handleInput.fill('');
    await studio.keyboard.type(HANDLE, { delay: 30 });
    await snap(studio, 'studio-handle-typed');

    console.log('=== onboard step 4: Continue → mint (capture popup, expect revert) ===');
    const mintPopupP = context.waitForEvent('page', { timeout: 60_000 }).catch(() => null);
    const continueBtn = studio.locator('button:has-text("Continue → mint")').first();
    if (await continueBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await continueBtn.click({ timeout: 5_000 });
      console.log('   waiting for metadata upload (≤60s) + mint tx popup...');
      await snap(studio, 'studio-mint-clicked');
      const mintPopup = await mintPopupP;
      if (mintPopup) {
        console.log('   ✓ MINT TX POPUP APPEARED — driving Confirm');
        await drivePopup(mintPopup, 'mm-mint-tx', 8);
        await studio.bringToFront();
        await studio.waitForTimeout(8_000);
        await snap(studio, 'studio-mint-after-confirm');
      } else {
        console.log('   metadata upload timed out (slow 0G Storage); skipping mint proof');
      }
    }
  }

  // ── Home page: real product flow — Run sample doc → fresh receipt ─────
  // This is the actual "use the product" test: click Run on the home demo
  // panel, /api/run signs and anchors a brand-new receipt with the server
  // wallet, the panel renders the receipt id, we click into /r/<id>.
  console.log('\n=== HOME: real Run flow → fresh on-chain receipt ===');
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await studio.waitForFunction(() => /Disconnect/i.test(document.body?.innerText ?? ''), { timeout: 8_000 }).catch(() => {});
  await studio.waitForTimeout(2_000);
  await snap(studio, 'home-pre-run');

  // Run panel uses react-dropzone — there's a hidden <input type="file">.
  // Write a temp file and use setInputFiles to upload it.
  const sampleDoc = `Lease Agreement v1 · 2026-05-09\n\n1. Tenant agrees to maintain renter's insurance with $300,000 minimum coverage.\n2. Landlord may enter the unit at any time without prior notice for any maintenance or inspection deemed necessary.\n3. Late fees: 10% of monthly rent per day after the 5th of the month, compounding.\n4. Subletting requires Landlord's written approval; unauthorized sublets are grounds for immediate termination and forfeiture of deposit.`;
  const tmpFile = resolve(tmpdir(), `qa-lease-${Date.now()}.txt`);
  writeFileSync(tmpFile, sampleDoc, 'utf8');
  console.log(`   wrote sample lease to ${tmpFile}`);

  const fileInput = studio.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(tmpFile);
    console.log('   uploaded sample lease');
    await studio.waitForTimeout(2_000);
    await snap(studio, 'home-doc-uploaded');

    // Click Run (no longer disabled once content is set).
    const runBtn = studio.locator('button:has-text("Run"):not([disabled])').first();
    if (await runBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      console.log('   clicking Run...');
      await runBtn.click({ timeout: 5_000 });
      await snap(studio, 'home-run-clicked');
      // Server-side: tokens generation, receipt anchor. 30-90s typically.
      console.log('   waiting up to 240s for receipt #N or Open Public Proof URL...');
      // Wait for the run to finish — render of receiptOnchainId or "Open Public Proof URL" link.
      // Polling document.body.innerText to avoid LavaMoat-related issues with strict locators.
      const runStart = Date.now();
      let runDone = false;
      while (Date.now() - runStart < 240_000) {
        const link = await studio.locator('a[href^="/r/"]').first().isVisible({ timeout: 1_000 }).catch(() => false);
        if (link) { runDone = true; break; }
        const txt = await studio.locator('text=/receipt #\\d+/i').first().isVisible({ timeout: 1_000 }).catch(() => false);
        if (txt) { runDone = true; break; }
        await studio.waitForTimeout(2_000);
      }
      if (!runDone) console.log(`   wait timed out after ${Math.round((Date.now() - runStart) / 1000)}s`);
      else console.log(`   ✓ run completed in ${Math.round((Date.now() - runStart) / 1000)}s`);
      await snap(studio, 'home-run-done');

      // Try to find the receipt id and visit its public proof URL.
      const proofLink = studio.locator('a[href^="/r/"]').first();
      if (await proofLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
        const href = await proofLink.getAttribute('href');
        console.log(`   ✓ FRESH RECEIPT URL: ${href}`);
        await proofLink.click();
        await studio.waitForLoadState('domcontentloaded').catch(() => {});
        await studio.waitForTimeout(3_000);
        await snap(studio, 'home-fresh-receipt-page');
      } else {
        console.log('   no /r/ link found — receipt may have failed or rendered differently');
      }
    } else {
      console.log('   Run button not enabled');
    }
  } else {
    console.log('   no file input found on home page');
  }

  // ── Tour every route in connected state ─────────────────────────────────
  console.log('\n=== route tour ===');
  for (const route of ['/', '/skills', '/global', '/dashboard', '/memory']) {
    await studio.goto(`${STUDIO}${route}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await studio.waitForFunction(() => /Disconnect/i.test(document.body?.innerText ?? ''), { timeout: 8_000 }).catch(() => {});
    await studio.waitForTimeout(1_500);
    await snap(studio, `route${route.replace(/\//g, '-')}`);
  }

  // Skill detail drill-down
  await studio.goto(`${STUDIO}/skill/private-doc-review`, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => {});
  await studio.waitForTimeout(2_000);
  await snap(studio, 'route-skill-detail');

  // ── Brand consistency: open Ivaronix.html side-by-side ──────────────────
  console.log('\n=== brand consistency check ===');
  const brand = await context.newPage();
  await brand.goto(`file:///${BRAND_HTML.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await brand.waitForTimeout(2_000);
  await snap(brand, 'brand-html-1440');
  await brand.setViewportSize({ width: 375, height: 812 });
  await brand.waitForTimeout(1_000);
  await snap(brand, 'brand-html-375');

  // ── Mobile-viewport tour of Studio for parity check ─────────────────────
  await studio.setViewportSize({ width: 375, height: 812 });
  for (const route of ['/', '/onboard', '/skills', '/dashboard']) {
    await studio.goto(`${STUDIO}${route}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await studio.waitForTimeout(1_500);
    await snap(studio, `mobile${route.replace(/\//g, '-')}`);
  }

  console.log('\n=== closing context (videos flush on close) ===');
  await context.close();

  // ── Inspect video files ────────────────────────────────────────────────
  console.log('\n=== video files ===');
  const files = readdirSync(SHOTS_DIR).filter((f) => f.endsWith('.webm'));
  files.sort((a, b) => statSync(resolve(SHOTS_DIR, b)).size - statSync(resolve(SHOTS_DIR, a)).size);
  for (const f of files.slice(0, 10)) {
    const sz = statSync(resolve(SHOTS_DIR, f)).size;
    console.log(`   ${(sz / 1024 / 1024).toFixed(2)} MB  ${f}`);
  }

  console.log(`\nDone. Screenshots in: ${SHOTS_DIR}`);
}

main().catch((err: Error) => {
  console.error('FAIL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
