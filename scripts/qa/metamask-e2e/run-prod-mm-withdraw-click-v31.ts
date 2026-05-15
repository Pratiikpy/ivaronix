/**
 * v31 · THE missing piece · real-MM click on /marketplace/payouts Withdraw button
 *        with NON-ZERO balance, popup confirmed, on-chain tx visible.
 *
 * Strategy: bypass Router 429 (which blocks paid inference) by using the
 * paySkillRun contract function DIRECTLY via ethers — no inference needed,
 * just the chain-side fee-split. The fresh wallet pays itself a fictitious
 * skill run (msg.sender == creator), accruing 90% to its own creatorBalance.
 * Then MM SRP-imports the same mnemonic and drives the Withdraw click.
 *
 * The mnemonic for the v28 fresh wallet was saved at v28-time. We recover
 * the wallet, top it up if needed, accrue balance, then drive MM.
 *
 * Per CLAUDE.md §17 — real MM popup, real chain tx, real outcome visible.
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import { JsonRpcProvider, Wallet, Contract, formatEther, parseEther, parseUnits, HDNodeWallet, hexlify, randomBytes } from 'ethers';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PASSWORD = 'TestPass123!QA';
const EXT_PATH = resolve(HERE, 'mm', 'extension');
const SOURCE_PROFILE = resolve(HERE, 'mm', 'profile');
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-withdraw-click-v31');
mkdirSync(OUT, { recursive: true });
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const RPC = 'https://evmrpc-testnet.0g.ai';
const ARISTOTLE_TESTNET = {
  chainId: '0x40DA', chainName: '0G Galileo',
  nativeCurrency: { name: '0G', symbol: 'OG', decimals: 18 },
  rpcUrls: ['https://evmrpc-testnet.0g.ai'],
  blockExplorerUrls: ['https://chainscan-galileo.0g.ai'],
};

const WALLET_PATH = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-payouts-click-v28', 'fresh-wallet.json');

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const text = readFileSync(resolve(REPO, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('='); if (eq < 0) continue;
      env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
  return env;
}
const env = loadEnv();
const OPERATOR_KEY = env['IVARONIX_SIGNER_KEY'] ?? env['EVM_PRIVATE_KEY']!;

function log(m: string): void { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const safe = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try { await page.screenshot({ path: resolve(OUT, safe), fullPage: true }); log(`📸 ${safe}`); } catch {}
}

async function pollPopup(ctx: BrowserContext, extId: string, known: Set<Page>, ms = 30_000): Promise<Page | null> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    for (const p of ctx.pages()) { if (known.has(p)) continue; if (p.url().includes(extId)) return p; }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

async function drivePopup(popup: Page, label: string, ctaMs = 90_000): Promise<void> {
  await popup.bringToFront();
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(2_000);
  const splashStart = Date.now();
  while (Date.now() - splashStart < 90_000 && !popup.isClosed()) {
    const splash = popup.locator('text=/Loading is taking longer/i').first();
    const isSplash = await splash.isVisible({ timeout: 500 }).catch(() => false);
    const hasBtn = await popup.locator('button:visible').first().isVisible({ timeout: 500 }).catch(() => false);
    if (!isSplash && hasBtn) { log(`  ${label}: splash cleared`); break; }
    await popup.waitForTimeout(3_000);
  }
  const ctas = ['Confirm', 'Approve', 'Connect', 'Sign', 'Got it', 'Continue', 'Next'];
  for (let step = 0; step < 20; step++) {
    if (popup.isClosed()) { log(`  ${label}: closed after ${step}`); return; }
    let clicked = false;
    for (const t of ctas) {
      const btn = popup.locator(`button:has-text("${t}"):not([disabled])`).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        log(`  ${label}: step ${step} click "${t}"`);
        await btn.click({ timeout: 4_000, force: true }).catch(() => {});
        await popup.waitForTimeout(500).catch(() => {});
        if (!popup.isClosed()) await btn.dispatchEvent('click').catch(() => {});
        clicked = true; break;
      }
    }
    if (!clicked) break;
    await popup.waitForTimeout(2_500).catch(() => {});
  }
}

async function main(): Promise<void> {
  log(`v31 · MM popup withdraw click · accrual via direct paySkillRun (Router-bypass)`);

  // Recover fresh wallet from v28
  const persisted = JSON.parse(readFileSync(WALLET_PATH, 'utf8'));
  const fresh = HDNodeWallet.fromPhrase(persisted.mnemonic);
  log(`Recovered wallet: ${fresh.address}`);

  const provider = new JsonRpcProvider(RPC, { chainId: 16602, name: 'galileo' });
  const freshSigner = new Wallet(fresh.privateKey, provider);
  const operator = new Wallet(OPERATOR_KEY, provider);

  // Check + top up wallet
  let bal = await provider.getBalance(fresh.address);
  log(`Fresh wallet bal: ${formatEther(bal)} OG`);
  if (bal < parseEther('0.01')) {
    log(`Topping up 0.05 OG...`);
    const top = await operator.sendTransaction({ to: fresh.address, value: parseEther('0.05'), gasPrice: 10_000_000_000n, gasLimit: 50_000 });
    await top.wait();
    bal = await provider.getBalance(fresh.address);
    log(`✓ ${formatEther(bal)} OG`);
  }

  // Accrue creator balance via direct paySkillRun (self-pay)
  const deployments = JSON.parse(readFileSync(resolve(REPO, 'contracts/deployments/testnet.json'), 'utf8'));
  const PAYMENT = deployments.contracts.SkillRunPayment.address;
  const PAY_ABI = [
    'function paySkillRun(bytes32 receiptRoot, address creator, uint16 creatorBps, uint16 treasuryBps) external payable',
    'function creatorBalance(address) view returns (uint256)',
    'function creatorLifetimeEarned(address) view returns (uint256)',
  ];
  const payment = new Contract(PAYMENT, PAY_ABI, freshSigner);

  const preBalance = await (payment as any).creatorBalance(fresh.address) as bigint;
  log(`\n=== PRE creator balance ===`);
  log(`creatorBalance:        ${formatEther(preBalance)} OG`);

  log(`\n=== ACTION: self-pay paySkillRun ===`);
  const receiptRoot = hexlify(randomBytes(32));
  const payAmount = parseEther('0.005');
  const tx = await (payment as any).paySkillRun(receiptRoot, fresh.address, 9000, 1000, {
    value: payAmount,
    gasPrice: parseUnits('5', 'gwei'),
    gasLimit: 200_000,
  });
  log(`pay tx: ${tx.hash}`);
  const rcpt = await tx.wait();
  log(`✓ block ${rcpt.blockNumber}, gas ${rcpt.gasUsed}`);

  const postBalance = await (payment as any).creatorBalance(fresh.address) as bigint;
  const lifetime = await (payment as any).creatorLifetimeEarned(fresh.address) as bigint;
  log(`\n=== POST creator balance ===`);
  log(`creatorBalance:        ${formatEther(postBalance)} OG  (was ${formatEther(preBalance)})`);
  log(`creatorLifetimeEarned: ${formatEther(lifetime)} OG`);
  if (postBalance === 0n) { log(`✗ accrual failed`); process.exit(1); }

  // Now drive MM to withdraw it
  log(`\n=== Launching MM v13.30 ===`);
  const dataDir = resolve(tmpdir(), `mm-v31-${Date.now()}`);
  mkdirSync(dataDir, { recursive: true });
  if (existsSync(SOURCE_PROFILE)) cpSync(SOURCE_PROFILE, dataDir, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(dataDir, {
    headless: false, viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, '--no-sandbox', '--disable-blink-features=AutomationControlled'],
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
    timeout: 45_000,
  });

  let extId = '';
  for (let i = 0; i < 60; i++) {
    const sw = ctx.serviceWorkers();
    if (sw.length > 0) { const m = sw[0]!.url().match(/chrome-extension:\/\/([a-z]+)\//); if (m) { extId = m[1]!; break; } }
    await new Promise((r) => setTimeout(r, 500));
  }
  log(`MM extId=${extId}`);

  try {
    let mm = ctx.pages().find((p) => p.url().includes(extId)) ?? await ctx.newPage();
    if (!mm.url().includes(extId)) await mm.goto(`chrome-extension://${extId}/home.html`);
    await mm.bringToFront();
    await mm.waitForSelector('button, input[type="password"]', { timeout: 30_000 }).catch(() => {});
    await mm.waitForTimeout(2_000);
    await snap(mm, 'mm-start');

    const unlock = mm.locator('button:has-text("Unlock"), button:has-text("Sign in")').first();
    if (await unlock.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await mm.locator('input[type="password"]').first().fill(PASSWORD);
      await unlock.click(); await mm.waitForTimeout(3_000);
    }

    log(`\n=== SRP import fresh wallet (recovered) ===`);
    await mm.waitForTimeout(3_000);
    const trigger = mm.locator('[data-testid="account-menu-icon"]').first();
    if (!(await trigger.isVisible({ timeout: 10_000 }).catch(() => false))) { log(`✗ no account menu`); await ctx.close(); return; }
    await trigger.click({ timeout: 5_000, force: true }).catch(() => {});
    await mm.waitForTimeout(2_500);

    for (const txt of ['Add wallet', 'Import a wallet']) {
      let btn = null;
      for (let i = 0; i < 15; i++) {
        const t = mm.locator(`text=${txt}`).first();
        if (await t.isVisible({ timeout: 1_500 }).catch(() => false)) { btn = t; break; }
        if (i > 0 && i % 4 === 0 && txt === 'Add wallet') {
          const re = mm.locator('[data-testid="account-menu-icon"]').first();
          if (await re.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await re.click({ timeout: 5_000, force: true }).catch(() => {});
            await mm.waitForTimeout(1_500);
          }
        }
        await mm.waitForTimeout(2_000);
      }
      if (!btn) { log(`✗ "${txt}" not found`); await snap(mm, `fail-${txt.replace(/ /g, '-')}`); await ctx.close(); return; }
      await btn.click({ timeout: 8_000, force: true }).catch(() => {});
      await mm.waitForTimeout(3_500);
    }
    const srp = mm.locator('textarea').first();
    await srp.click(); await mm.keyboard.type(persisted.mnemonic, { delay: 30 });
    await mm.waitForTimeout(1_500);
    const cont = mm.locator('button:has-text("Continue"):not([disabled])').first();
    if (await cont.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await cont.click({ timeout: 8_000 }); await mm.waitForTimeout(6_000);
      log(`✓ SRP imported`);
      await snap(mm, 'mm-srp-imported');
    }

    log(`\n=== Studio /marketplace/payouts ===`);
    const studio = await ctx.newPage();
    studio.on('console', (msg) => { if (msg.type() === 'error') log(`🔴 ${msg.text().slice(0, 150)}`); });
    await studio.goto(`${STUDIO}/marketplace/payouts?cb=${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await studio.waitForTimeout(4_000);
    await snap(studio, 'studio-payouts-pre-connect');

    const connect = studio.locator('button:has-text("Connect wallet")').first();
    const k1 = new Set<Page>(ctx.pages());
    if (await connect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await connect.click({ timeout: 5_000 });
      const p = await pollPopup(ctx, extId, k1, 20_000);
      if (p) await drivePopup(p, 'mm-connect', 30_000);
    }
    await studio.bringToFront(); await studio.waitForTimeout(4_000);

    // Studio production points at MAINNET. The fresh wallet's balance is on TESTNET.
    // We need to switch the wallet to TESTNET (Galileo · chainId 16602 · 0x40DA hex) so the panel reads testnet balance.
    log(`\n=== Add + switch to Galileo testnet (so panel reads where the balance lives) ===`);
    const kAdd = new Set<Page>(ctx.pages());
    await studio.evaluate(async (chain) => {
      try { await (window as any).ethereum.request({ method: 'wallet_addEthereumChain', params: [chain] }); } catch {}
    }, ARISTOTLE_TESTNET);
    const pAdd = await pollPopup(ctx, extId, kAdd, 15_000);
    if (pAdd) await drivePopup(pAdd, 'mm-add-galileo', 30_000);
    await studio.bringToFront(); await studio.waitForTimeout(3_000);

    const kSw = new Set<Page>(ctx.pages());
    await studio.evaluate(async () => {
      try { await (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x40DA' }] }); } catch {}
    });
    const pSw = await pollPopup(ctx, extId, kSw, 10_000);
    if (pSw) await drivePopup(pSw, 'mm-switch-galileo', 30_000);
    await studio.bringToFront(); await studio.waitForTimeout(5_000);
    await snap(studio, 'studio-payouts-connected-galileo');

    // Click Withdraw
    log(`\n=== Click Withdraw button ===`);
    const withdrawBtn = studio.locator('button:has-text("Withdraw"):not([disabled])').first();
    const isEnabled = await withdrawBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    log(`Withdraw button enabled+visible: ${isEnabled}`);
    if (isEnabled) {
      const kW = new Set<Page>(ctx.pages());
      await withdrawBtn.click({ timeout: 5_000, force: true });
      log(`  → button clicked, waiting MM popup`);
      const pW = await pollPopup(ctx, extId, kW, 25_000);
      if (pW) {
        log(`  ✓ MM popup detected`);
        await snap(pW, 'mm-withdraw-popup-open');
        await drivePopup(pW, 'mm-withdraw-confirm', 60_000);
      } else {
        log(`  ⚠ no popup detected within 25s`);
      }
    } else {
      log(`  ⚠ Withdraw not enabled — capturing state`);
    }
    await studio.bringToFront(); await studio.waitForTimeout(8_000);
    await snap(studio, 'studio-payouts-post-click');

    // Verify chain side
    const finalBalance = await (payment as any).creatorBalance(fresh.address) as bigint;
    log(`\n=== Final chain state ===`);
    log(`creatorBalance: ${formatEther(finalBalance)} OG (was ${formatEther(postBalance)} after accrual)`);

    writeFileSync(resolve(OUT, 'final.json'), JSON.stringify({
      wallet: fresh.address,
      payment: PAYMENT,
      accrualTx: tx.hash,
      preAccrual: preBalance.toString(),
      postAccrual: postBalance.toString(),
      postWithdrawAttempt: finalBalance.toString(),
      withdrawClicked: isEnabled,
      withdrawSucceeded: finalBalance < postBalance,
    }, null, 2));
  } finally {
    await ctx.close().catch(() => {});
    log(`=== DONE ===`);
  }
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
