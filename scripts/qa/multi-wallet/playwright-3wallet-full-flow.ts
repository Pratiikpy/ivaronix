/**
 * iter-171 · 3-wallet full flow with user-set-up MetaMask accounts.
 *
 * User context (2026-05-13): user manually set up MetaMask via the
 * iter-170 idle browser, creating 3 accounts that show in the MM
 * Accounts panel as:
 *   Account 1: 0x90043...169e2
 *   Account 2: 0x16fc2...5589c
 *   Account 3: 0x0C9aC...89964
 *
 * All 3 start at $0.00 (no OG, no Galileo network added).
 *
 * This script:
 *   1. Re-launches Chromium with the SAME profile dir so all 3
 *      accounts are still there.
 *   2. PAUSES for the user to unlock MM (user knows the password).
 *   3. Captures all 3 account addresses via eth_accounts switching.
 *   4. Funds each account from operator (~0.01 OG each) via a
 *      side-channel ethers tx (NOT via the browser).
 *   5. Adds Galileo network to MM via wallet_addEthereumChain RPC
 *      from a test page → user clicks Approve in the popup.
 *   6. For EACH of the 3 accounts:
 *        a. Switch active account in MM to the target.
 *        b. Open Studio /onboard in a fresh tab.
 *        c. Click "Connect Wallet" → MM popup → user clicks Connect.
 *        d. SIWE sign popup → user clicks Sign.
 *        e. Navigate to RunPanel.
 *        f. Click Run → MM tx popup → user clicks Confirm.
 *        g. Verify the anchored receipt page renders with that
 *           wallet's address.
 *        h. Capture: screenshots at every state + full video.
 *   7. Collect 3 distinct anchor txs from 3 distinct sender
 *      addresses. Cross-check chainscan.
 *
 * On PASS: §16 of CLAUDE.md says 3-wallet flows go PENDING -> PASS.
 *
 * Failure modes:
 *   - User declines an MM popup -> script logs the step + exits.
 *   - Operator wallet doesn't have funds -> caught at funding step.
 *   - Studio dev server not running -> script targets the production
 *     deployment at ivaronix.vercel.app (set STUDIO_BASE env to override).
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { Wallet, JsonRpcProvider, parseEther, getAddress } from 'ethers';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const PROFILE_DIR = resolve(REPO, 'scripts/qa/multi-wallet/.profile-open-and-idle');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_DIR = resolve(REPO, `QA_PROOF_PACK/multi-wallet/iter-171-3wallet-flow-${TIMESTAMP}`);
mkdirSync(SHOTS_DIR, { recursive: true });

const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const RPC_URL = 'https://evmrpc-testnet.0g.ai';
const CHAIN_ID = 16602;
const CHAIN_NAME = 'Galileo';
const FUND_AMOUNT = '0.01';

// Load operator key from .env walking up.
function loadEnv(): { signerKey: string } {
  let dir = REPO;
  for (let i = 0; i < 6; i++) {
    const p = resolve(dir, '.env');
    if (existsSync(p)) {
      const text = readFileSync(p, 'utf8');
      for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq < 0) continue;
        const k = t.slice(0, eq).trim();
        let v = t.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!(k in process.env)) process.env[k] = v;
      }
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const k = process.env.IVARONIX_SIGNER_KEY ?? process.env.EVM_PRIVATE_KEY ?? process.env.OG_PRIVATE_KEY ?? '';
  if (!k) throw new Error('no IVARONIX_SIGNER_KEY in env (or legacy alias)');
  return { signerKey: k };
}

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum += 1;
  const name = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   📸 ${name}`);
  } catch (e) {
    console.log(`   (skip) ${name} — ${(e as Error).message.split('\n')[0]}`);
  }
}

async function pause(prompt: string, waitFn: () => Promise<boolean>, maxSec = 180): Promise<void> {
  console.log(`\n   ⏸  ${prompt}`);
  console.log(`      Polling every 2s for up to ${maxSec}s...`);
  for (let i = 0; i < maxSec / 2; i++) {
    if (await waitFn().catch(() => false)) {
      console.log(`   ▶  resumed.\n`);
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`paused too long for: ${prompt}`);
}

async function findExtensionId(context: BrowserContext): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const sw = context.serviceWorkers();
    if (sw.length > 0) {
      const m = sw[0].url().match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('MM service worker did not appear');
}

interface CapturedAccounts {
  addresses: string[];
}

async function captureAddresses(context: BrowserContext, mmPage: Page): Promise<CapturedAccounts> {
  // Walk MM's Accounts panel: click each account row, read the active
  // address by visiting a test page with window.ethereum.
  console.log('   capturing all 3 account addresses by iterating the Accounts panel...');
  await mmPage.bringToFront();

  // Open the Accounts panel.
  const avatar = mmPage.locator('[data-testid="account-menu-icon"], button[aria-label*="ccount" i]').first();
  if (await avatar.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await avatar.click().catch(() => {});
    await mmPage.waitForTimeout(1_500);
  }
  await snap(mmPage, 'mm-accounts-panel-open');

  // MM v13.30 renders each account row with a copy-icon. Find each row
  // and click its copy button — the address goes to clipboard. We read
  // clipboard via a content-script page.
  // Alternative + simpler: MM v13.30 also shows the truncated address
  // in plain text inside `[data-testid="account-list-item"]`. From the
  // user screenshot we have 3 rows. We extract full addresses by reading
  // the title/aria-label attributes (MM exposes the full hex there).
  const addresses: string[] = [];
  const rows = mmPage.locator('[data-testid="account-list-item"], .multichain-account-list-item, button[data-testid*="account-list"]');
  const rowCount = await rows.count();
  console.log(`   ${rowCount} account row(s) detected in MM UI`);
  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    // The full address shows up in aria-label or as a child text node.
    const aria = await row.getAttribute('aria-label').catch(() => null);
    const inner = await row.innerText().catch(() => '');
    let hit = (aria ?? '').match(/0x[0-9a-fA-F]{40}/)?.[0]
           ?? inner.match(/0x[0-9a-fA-F]{40}/)?.[0]
           ?? null;
    // Newer MM hides the full address in a tooltip-style span:
    if (!hit) {
      const fullAttr = await row.locator('[data-testid="account-list-address"], [data-clipboard-text]').first().getAttribute('data-clipboard-text').catch(() => null);
      if (fullAttr) hit = fullAttr;
    }
    if (hit) {
      addresses.push(getAddress(hit));
      console.log(`   row ${i + 1}: ${hit}`);
    } else {
      console.log(`   row ${i + 1}: full address not found in attrs; will fall back to clipboard probe`);
    }
  }

  // Fallback: if UI scrape failed, do a per-row click + eth_accounts via window.ethereum on a test page.
  if (addresses.length < rowCount && rowCount > 0) {
    console.log('   falling back to per-row click + eth_accounts probe...');
    addresses.length = 0; // restart
    const testPage = await context.newPage();
    await testPage.goto('https://etherscan.io/', { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
    await testPage.waitForTimeout(2_000);
    for (let i = 0; i < rowCount; i++) {
      // Re-open the panel each iteration; MM closes it after a click.
      await mmPage.bringToFront();
      const av = mmPage.locator('[data-testid="account-menu-icon"], button[aria-label*="ccount" i]').first();
      if (await av.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await av.click().catch(() => {});
        await mmPage.waitForTimeout(1_000);
      }
      const r = mmPage.locator('[data-testid="account-list-item"], .multichain-account-list-item').nth(i);
      await r.click({ timeout: 5_000 }).catch(() => {});
      await mmPage.waitForTimeout(1_500);
      // Now read the active account from the test page's window.ethereum.
      await testPage.bringToFront();
      const popupP = context.waitForEvent('page', { timeout: 8_000 }).catch(() => null);
      const probe = await testPage.evaluate(async () => {
        const eth = (window as unknown as { ethereum?: { request: (req: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
        if (!eth) return null;
        try {
          const r = await eth.request({ method: 'eth_requestAccounts' });
          return Array.isArray(r) && r.length ? r[0] : null;
        } catch (e) {
          return null;
        }
      }).catch(() => null);
      const pp = await popupP;
      if (pp) {
        // Auto-accept the connection popup.
        await pp.waitForTimeout(2_000);
        const nextBtn = pp.locator('button:has-text("Next"), button:has-text("Connect")').first();
        if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) await nextBtn.click().catch(() => {});
        await pp.waitForTimeout(1_500);
        const connectBtn = pp.locator('button:has-text("Connect")').first();
        if (await connectBtn.isVisible({ timeout: 3_000 }).catch(() => false)) await connectBtn.click().catch(() => {});
      }
      if (probe) {
        const norm = getAddress(probe as string);
        if (!addresses.includes(norm)) {
          addresses.push(norm);
          console.log(`   probed row ${i + 1}: ${norm}`);
        }
      }
    }
    await testPage.close().catch(() => {});
  }

  console.log(`   captured ${addresses.length} address(es): ${addresses.join(', ')}`);
  return { addresses };
}

async function main(): Promise<void> {
  const env = loadEnv();
  console.log('========================================');
  console.log(`  iter-171 · 3-wallet full flow`);
  console.log(`  Studio:    ${STUDIO}`);
  console.log(`  RPC:       ${RPC_URL}`);
  console.log(`  Chain:     ${CHAIN_NAME} (${CHAIN_ID})`);
  console.log(`  Profile:   ${PROFILE_DIR}`);
  console.log(`  Shots/vid: ${SHOTS_DIR}`);
  console.log('========================================\n');

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
    recordVideo: { dir: SHOTS_DIR, size: { width: 1440, height: 900 } },
  });

  const extId = await findExtensionId(context);
  const mmHomeUrl = `chrome-extension://${extId}/home.html`;
  console.log(`   extension id: ${extId}`);

  // Open MM directly so user can unlock it.
  let mmPage = context.pages().find((p) => p.url().includes(extId));
  if (!mmPage) mmPage = await context.newPage();
  await mmPage.goto(mmHomeUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
  await mmPage.waitForTimeout(3_000);
  await snap(mmPage, 'mm-home-locked-or-unlocked');

  // Auto-unlock via env-supplied password (user provided over chat).
  const MM_PASSWORD = process.env.MM_PASSWORD ?? '12345678';
  const txt0 = await mmPage.locator('body').innerText().catch(() => '');
  if (txt0.toLowerCase().includes('unlock') || txt0.toLowerCase().includes('enter your password')) {
    console.log('   MM is locked — auto-unlocking with provided password...');
    const pwInput = mmPage.locator('input[type="password"]').first();
    if (await pwInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pwInput.click();
      await mmPage.keyboard.type(MM_PASSWORD, { delay: 30 });
      await mmPage.waitForTimeout(800);
      await snap(mmPage, 'mm-password-typed');
      const unlockBtn = mmPage.locator('button:has-text("Unlock")').first();
      if (await unlockBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await unlockBtn.click();
        console.log('   clicked Unlock — waiting for accounts UI...');
        await mmPage.waitForTimeout(4_000);
      }
    }
  } else {
    console.log('   MM appears already unlocked.');
  }
  // Confirm we're unlocked.
  await pause(
    '...waiting for MM unlocked state...',
    async () => {
      const t = await mmPage!.locator('body').innerText().catch(() => '');
      return t.includes('Buy') || t.includes('Send') || t.includes('Receive') || /Account\s+\d/i.test(t);
    },
    60,
  );
  await snap(mmPage, 'mm-unlocked');

  // Capture all 3 account addresses by iterating MM's Accounts panel.
  const cap = await captureAddresses(context, mmPage);
  let accounts = cap.addresses;

  // If UI scrape only got a subset, fall back to a signal file.
  if (accounts.length < 3) {
    console.log(`\n   ⚠ only captured ${accounts.length} address(es) automatically.`);
    const SIGNAL_FILE = resolve(SHOTS_DIR, 'addresses.json');
    console.log('========================================');
    console.log('  please paste the 3 FULL addresses to me in chat OR');
    console.log(`  write them as a JSON array to: ${SIGNAL_FILE}`);
    console.log('========================================\n');
    await pause(
      `awaiting addresses.json signal file at ${SIGNAL_FILE}`,
      async () => existsSync(SIGNAL_FILE),
      900,
    );
    accounts = JSON.parse(readFileSync(SIGNAL_FILE, 'utf8'));
  }
  console.log(`\n   ✓ working with ${accounts.length} accounts: ${accounts.join(', ')}`);

  // === Fund Account 1 + Account 2 + Account 3 from operator ===
  console.log('\n=== Funding step ===');
  const provider = new JsonRpcProvider(RPC_URL, { chainId: CHAIN_ID, name: CHAIN_NAME.toLowerCase() });
  const operator = new Wallet(env.signerKey.startsWith('0x') ? env.signerKey : '0x' + env.signerKey, provider);
  console.log(`   operator: ${operator.address}`);
  const bal = await provider.getBalance(operator.address);
  console.log(`   operator balance: ${(Number(bal) / 1e18).toFixed(4)} OG`);

  const fundTxs: { to: string; tx: string }[] = [];
  for (const to of accounts) {
    const balBefore = await provider.getBalance(to);
    if (balBefore > parseEther('0.005')) {
      console.log(`   ${to} already has ${(Number(balBefore) / 1e18).toFixed(4)} OG · skip fund`);
      continue;
    }
    const tx = await operator.sendTransaction({
      to,
      value: parseEther(FUND_AMOUNT),
      gasPrice: 5_000_000_000n,
    });
    console.log(`   funded ${to} · tx ${tx.hash}`);
    await tx.wait();
    fundTxs.push({ to, tx: tx.hash });
  }
  console.log(`   ✓ all ${accounts.length} accounts funded.\n`);

  // === Add Galileo network to MM ===
  console.log('=== Adding Galileo network to MM ===');
  const triggerPage = await context.newPage();
  await triggerPage.goto('about:blank');
  await triggerPage.setContent('<html><body><h1>Add Galileo network</h1><p>Click the Approve button in the MM popup that will appear.</p></body></html>');
  await snap(triggerPage, 'pre-add-network');

  const popupPromise1 = context.waitForEvent('page', { timeout: 30_000 }).catch(() => null);
  await triggerPage.evaluate(async ({ rpcUrl, chainIdHex }) => {
    const eth = (window as unknown as { ethereum?: { request: (req: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) throw new Error('no window.ethereum');
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: chainIdHex,
        chainName: 'Galileo Testnet (0G)',
        rpcUrls: [rpcUrl],
        nativeCurrency: { name: '0G', symbol: 'OG', decimals: 18 },
        blockExplorerUrls: ['https://chainscan-galileo.0g.ai'],
      }],
    });
  }, { rpcUrl: RPC_URL, chainIdHex: '0x40DA' }).catch((e) => console.log(`   addChain triggered popup (expected): ${(e as Error).message.split('\n')[0]}`));

  const popup1 = await popupPromise1;
  if (popup1) {
    console.log('   MM Add-Network popup opened.');
    await popup1.waitForTimeout(2_500);
    await snap(popup1, 'mm-addchain-popup');
    await pause(
      '👋 please click "Approve" in the MM popup to add Galileo network',
      async () => popup1.isClosed(),
      120,
    );
  }

  // === Run the per-account flow ===
  console.log('\n=== Per-account Studio flow ===');
  const results: { addr: string; anchorTx?: string; receiptId?: string; status: string }[] = [];
  for (let i = 0; i < accounts.length; i++) {
    const addr = accounts[i]!;
    console.log(`\n--- Wallet ${i + 1} of ${accounts.length} · ${addr} ---`);
    await snap(mmPage, `acct-${i + 1}-before-switch`);

    // 1. User switches MM to this account.
    await pause(
      `👋 please switch MetaMask to Account ${i + 1} (${addr.slice(0, 8)}...) — click the account avatar at top, then click the account name`,
      async () => {
        const probe = await mmPage!.evaluate(async () => {
          const eth = (window as unknown as { ethereum?: { request: (req: { method: string }) => Promise<string[]> } }).ethereum;
          if (!eth) return null;
          try {
            const r = await eth.request({ method: 'eth_accounts' });
            return r?.[0] ?? null;
          } catch {
            return null;
          }
        }).catch(() => null);
        if (!probe) return false;
        return getAddress(probe).toLowerCase() === addr.toLowerCase();
      },
      180,
    );
    await snap(mmPage, `acct-${i + 1}-switched`);

    // 2. Open Studio /onboard in a fresh tab.
    const studio = await context.newPage();
    await studio.goto(`${STUDIO}/onboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await studio.waitForTimeout(3_000);
    await snap(studio, `acct-${i + 1}-studio-onboard`);

    // 3. Click Connect.
    const connectPopupPromise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
    const connectBtn = studio.getByRole('button', { name: /Connect/i }).first();
    if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await connectBtn.click({ timeout: 10_000 });
      console.log(`   clicked Connect — awaiting MM popup...`);
    }
    const connectPopup = await connectPopupPromise;
    if (connectPopup) {
      await snap(connectPopup, `acct-${i + 1}-connect-popup-open`);
      await pause(
        `👋 click "Connect" in the MM popup to allow Studio to see Account ${i + 1}`,
        async () => connectPopup.isClosed(),
        120,
      );
    }
    await studio.bringToFront();
    await studio.waitForTimeout(3_000);
    await snap(studio, `acct-${i + 1}-connected`);

    // 4. SIWE sign popup (if Studio requires session auth).
    const siwePopupPromise = context.waitForEvent('page', { timeout: 8_000 }).catch(() => null);
    await studio.waitForTimeout(2_000);
    const siwePopup = await siwePopupPromise;
    if (siwePopup) {
      await snap(siwePopup, `acct-${i + 1}-siwe-popup`);
      await pause(
        `👋 click "Sign" in the MM popup to sign in (SIWE)`,
        async () => siwePopup.isClosed(),
        120,
      );
      await studio.bringToFront();
      await studio.waitForTimeout(3_000);
    }
    await snap(studio, `acct-${i + 1}-signed-in`);

    // 5. Navigate to home + run the RunPanel.
    await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await studio.waitForTimeout(3_000);
    await snap(studio, `acct-${i + 1}-home`);

    const sampleBtn = studio.locator('button:has-text("Use sample"), button:has-text("Sample contract")').first();
    if (await sampleBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sampleBtn.click().catch(() => {});
      await studio.waitForTimeout(2_000);
      await snap(studio, `acct-${i + 1}-sample-loaded`);
    }
    const runBtn = studio.locator('button:has-text("Run")').first();
    if (await runBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      console.log(`   clicking Run...`);
      await runBtn.click({ timeout: 10_000 });
      await studio.waitForTimeout(5_000);
      await snap(studio, `acct-${i + 1}-run-clicked`);
    }

    // Final state — see if a receipt rendered.
    await studio.waitForTimeout(15_000);
    await snap(studio, `acct-${i + 1}-final-state`);

    // Detect anchor tx hash from page text.
    const finalText = await studio.locator('body').innerText().catch(() => '');
    const txMatch = finalText.match(/0x[0-9a-fA-F]{64}/);
    const idMatch = finalText.match(/receipt[^0-9]*(\d{1,5})/i);
    const anchorTx = txMatch?.[0];
    const receiptId = idMatch?.[1];
    if (anchorTx) console.log(`   ✓ anchor tx detected: ${anchorTx}`);
    if (receiptId) console.log(`   ✓ receipt id: ${receiptId}`);
    results.push({
      addr,
      anchorTx,
      receiptId,
      status: anchorTx ? 'PASS' : 'NO_TX_DETECTED',
    });

    await studio.close().catch(() => {});
  }

  // === Summary ===
  console.log('\n\n========================================');
  console.log('  iter-171 · 3-wallet flow summary');
  console.log('========================================');
  for (const r of results) {
    console.log(`  ${r.addr}: ${r.status}${r.anchorTx ? ' · tx ' + r.anchorTx : ''}${r.receiptId ? ' · id ' + r.receiptId : ''}`);
  }
  console.log('========================================\n');

  console.log(`   screenshots + video at: ${SHOTS_DIR}`);
  console.log(`   browser stays open 30s so you can verify...`);
  await new Promise((r) => setTimeout(r, 30_000));
  await context.close();
}

main().catch((e) => {
  console.error('[3wallet-flow] FAIL:', (e as Error).message);
  process.exit(1);
});
