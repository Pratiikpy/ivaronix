/**
 * v16 · autonomous passport mint via /onboard with fresh wallet.
 *
 * Reuses v15b's proven stack: generate fresh wallet → fund → SRP-import →
 * add Aristotle → drive /onboard mint button → MM tx Confirm → capture tx hash.
 */
import { chromium, type BrowserContext, type Page, type Response } from 'playwright';
import { JsonRpcProvider, Wallet, parseEther, formatEther, HDNodeWallet } from 'ethers';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PASSWORD = 'TestPass123!QA';
const EXT_PATH = resolve(HERE, 'mm', 'extension');
const SOURCE_PROFILE = resolve(HERE, 'mm', 'profile');
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-passport-v16');
mkdirSync(OUT, { recursive: true });
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const RPC = 'https://evmrpc.0g.ai';
const ARISTOTLE = {
  chainId: '0x4115', chainName: '0G Aristotle',
  nativeCurrency: { name: '0G', symbol: 'OG', decimals: 18 },
  rpcUrls: ['https://evmrpc.0g.ai'],
  blockExplorerUrls: ['https://chainscan.0g.ai'],
};

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
const OPERATOR_KEY = (env['IVARONIX_SIGNER_KEY'] ?? env['OG_PRIVATE_KEY'] ?? env['EVM_PRIVATE_KEY']) as string;

const events: string[] = [];
function log(msg: string): void {
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`[${stamp}] ${msg}`);
  events.push(`[${stamp}] ${msg}`);
}

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const safe = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try { await page.screenshot({ path: resolve(OUT, safe), fullPage: false }); log(`📸 ${safe}`); } catch {}
}

async function pollPopup(ctx: BrowserContext, extId: string, known: Set<Page>, ms = 30_000): Promise<Page | null> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    for (const p of ctx.pages()) { if (known.has(p)) continue; if (p.url().includes(extId)) return p; }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

async function drivePopupPatient(popup: Page, label: string, ctaWaitMs = 120_000): Promise<void> {
  await popup.bringToFront();
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(2_000);
  await snap(popup, `${label}-open`);
  // v16e splash-clear wait: MM v13.30 popup cold-starts can take 60-90s.
  // The "Loading is taking longer than usual" splash blocks CTA rendering.
  const splashStart = Date.now();
  while (Date.now() - splashStart < 120_000 && !popup.isClosed()) {
    const splash = popup.locator('text=/Loading is taking longer/i').first();
    const isSplash = await splash.isVisible({ timeout: 500 }).catch(() => false);
    const fox = popup.locator('svg').first();
    const hasButton = await popup.locator('button:visible').first().isVisible({ timeout: 500 }).catch(() => false);
    if (!isSplash && hasButton) { log(`  ${label}: splash cleared after ${Math.floor((Date.now() - splashStart) / 1000)}s`); break; }
    if (isSplash) log(`  ${label}: splash visible · waiting (${Math.floor((Date.now() - splashStart) / 1000)}s)`);
    await popup.waitForTimeout(3_000);
  }
  await snap(popup, `${label}-after-splash`);
  const ctaTexts = ['Confirm', 'Approve', 'Connect', 'Sign', 'Got it', 'Continue', 'Next'];
  const startCta = Date.now();
  let foundCta = false;
  while (Date.now() - startCta < ctaWaitMs && !popup.isClosed()) {
    for (const t of ctaTexts) {
      const btn = popup.locator(`button:has-text("${t}"):not([disabled])`).first();
      const visible = await Promise.race([
        btn.isVisible({ timeout: 500 }).catch(() => false),
        new Promise<boolean>((r) => setTimeout(() => r(false), 1_500)),
      ]);
      if (visible) { foundCta = true; log(`  ${label}: "${t}" after ${Math.floor((Date.now() - startCta) / 1000)}s`); break; }
    }
    if (foundCta) break;
    await new Promise((r) => setTimeout(r, 1_500));
  }
  if (!foundCta) { log(`  ${label}: ✗ no CTA in ${ctaWaitMs}ms`); return; }
  for (let step = 0; step < 25; step++) {
    if (popup.isClosed()) { log(`  ${label}: closed after ${step}`); return; }
    let clicked = false;
    for (const t of ctaTexts) {
      const btn = popup.locator(`button:has-text("${t}"):not([disabled])`).first();
      const visible = await Promise.race([
        btn.isVisible({ timeout: 800 }).catch(() => false),
        new Promise<boolean>((r) => setTimeout(() => r(false), 1_500)),
      ]);
      if (visible) { log(`  ${label}: step ${step} click "${t}"`); await btn.click({ timeout: 5_000 }).catch(() => {}); clicked = true; break; }
    }
    if (!clicked) { log(`  ${label}: no CTA at step ${step}`); break; }
    await popup.waitForTimeout(2_500).catch(() => {});
    if (!popup.isClosed()) await snap(popup, `${label}-step-${step}`);
  }
}

async function main(): Promise<void> {
  log(`v16 · passport mint autonomous`);

  // Generate + fund fresh wallet
  const fresh = HDNodeWallet.createRandom();
  const mnemonic = fresh.mnemonic!.phrase; const address = fresh.address;
  log(`Fresh wallet: ${address}`);
  writeFileSync(resolve(OUT, 'fresh-wallet.json'), JSON.stringify({ address, mnemonic, privKey: fresh.privateKey }, null, 2));

  const provider = new JsonRpcProvider(RPC, { chainId: 16661, name: 'aristotle' });
  const operator = new Wallet(OPERATOR_KEY, provider);
  log(`Funding 0.05 OG`);
  const fundTx = await operator.sendTransaction({ to: address, value: parseEther('0.05'), gasPrice: 10_000_000_000n, gasLimit: 50_000 });
  log(`Fund tx: ${fundTx.hash}`);
  await fundTx.wait();
  const balAfter = await provider.getBalance(address);
  log(`✓ ${formatEther(balAfter)} OG arrived`);

  // Launch MM
  const dataDir = resolve(tmpdir(), `mm-prod-v16-${Date.now()}`);
  mkdirSync(dataDir, { recursive: true });
  if (existsSync(SOURCE_PROFILE)) cpSync(SOURCE_PROFILE, dataDir, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(dataDir, {
    headless: false, viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, '--no-sandbox', '--disable-blink-features=AutomationControlled'],
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } }, timeout: 45_000,
  });
  log(`Chromium launched`);

  let extId = '';
  for (let i = 0; i < 60; i++) {
    const sw = ctx.serviceWorkers();
    if (sw.length > 0) { const m = sw[0]!.url().match(/chrome-extension:\/\/([a-z]+)\//); if (m) { extId = m[1]!; break; } }
    await new Promise((r) => setTimeout(r, 500));
  }
  log(`MM SW · extId=${extId}`);

  const apiResponses: { url: string; status: number; body: string }[] = [];

  try {
    let mm = ctx.pages().find((p) => p.url().includes(extId)) ?? await ctx.newPage();
    if (!mm.url().includes(extId)) await mm.goto(`chrome-extension://${extId}/home.html`);
    await mm.bringToFront(); await mm.waitForSelector('button, input[type="password"]', { timeout: 30_000 }).catch(() => {});
    await mm.waitForTimeout(2_000); await snap(mm, 'mm-initial');

    const unlock = mm.locator('button:has-text("Unlock"), button:has-text("Sign in")').first();
    if (await unlock.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await mm.locator('input[type="password"]').first().fill(PASSWORD);
      await unlock.click(); await mm.waitForTimeout(3_000); await snap(mm, 'mm-unlocked');
    }

    // SRP import (v15b proven pattern)
    log(`\n=== SRP import ===`);
    await mm.waitForTimeout(5_000);
    let trigger = null;
    for (let i = 0; i < 8; i++) {
      const t = mm.locator('[data-testid="account-menu-icon"]').first();
      if (await t.isVisible({ timeout: 2_000 }).catch(() => false)) { trigger = t; break; }
      await mm.waitForTimeout(2_000);
    }
    if (!trigger) { log(`✗ trigger missing`); await ctx.close(); return; }
    await trigger.click({ timeout: 10_000, force: true }).catch(async () => { await trigger!.dispatchEvent('click').catch(() => {}); });
    await mm.waitForTimeout(2_500); await snap(mm, 'mm-account-menu');

    for (const txt of ['Add wallet', 'Import a wallet']) {
      let btn = null;
      for (let i = 0; i < 15; i++) {  // 15 × 2s = 30s budget per button (was 5 × 1.5s = 7.5s)
        const t = mm.locator(`text=${txt}`).first();
        if (await t.isVisible({ timeout: 2_000 }).catch(() => false)) { btn = t; break; }
        // Snapshot every 5th retry for diagnostic
        if (i === 4 || i === 9) await snap(mm, `mm-${txt.replace(/ /g, '-').toLowerCase()}-retry-${i}`);
        await mm.waitForTimeout(2_000);
      }
      if (!btn) {
        log(`✗ "${txt}" missing after 30s · MM v13.30 LavaMoat flake · snapshot for diagnostic`);
        await snap(mm, `mm-${txt.replace(/ /g, '-').toLowerCase()}-FINAL-MISSING`);
        await ctx.close(); return;
      }
      await btn.click({ timeout: 10_000, force: true }).catch(async () => { await btn!.dispatchEvent('click').catch(() => {}); });
      await mm.waitForTimeout(3_500); await snap(mm, `mm-after-${txt.replace(/ /g, '-').toLowerCase()}`);
    }

    const srpTa = mm.locator('textarea').first();
    await srpTa.click(); await mm.keyboard.type(mnemonic, { delay: 30 });
    await mm.waitForTimeout(1_500); await snap(mm, 'mm-srp-typed');
    const cont = mm.locator('button:has-text("Continue"):not([disabled])').first();
    if (await cont.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await cont.click({ timeout: 8_000 }); await mm.waitForTimeout(8_000);
      await snap(mm, 'mm-srp-imported');
      log(`  ✓ SRP imported`);
    }

    // Studio + addEthereumChain
    log(`\n=== Studio + add Aristotle ===`);
    const studio = await ctx.newPage();
    studio.on('response', async (resp: Response) => {
      const url = resp.url();
      if (url.includes('/api/')) {
        try { const body = await resp.text(); apiResponses.push({ url, status: resp.status(), body: body.slice(0, 10_000) }); log(`  📡 ${resp.status()} ${url.slice(STUDIO.length)}: ${body.slice(0, 180).replace(/\n/g, ' ')}`); } catch {}
      }
    });

    await studio.goto(STUDIO, { waitUntil: 'domcontentloaded' });
    await studio.waitForTimeout(5_000); await snap(studio, 'studio-home');

    const headerConnect = studio.locator('button:has-text("Connect wallet")').first();
    const known1 = new Set<Page>(ctx.pages());
    if (await headerConnect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await headerConnect.click({ timeout: 8_000 });
      const popup = await pollPopup(ctx, extId, known1, 25_000);
      if (popup) await drivePopupPatient(popup, 'mm-connect', 30_000);
    }
    await studio.bringToFront(); await studio.waitForTimeout(5_000);

    // Add Aristotle
    const knownAdd = new Set<Page>(ctx.pages());
    const addP = studio.evaluate(async (chain) => {
      try { const r = await (window as any).ethereum.request({ method: 'wallet_addEthereumChain', params: [chain] }); return { ok: true, r }; }
      catch (e) { return { ok: false, error: (e as Error).message }; }
    }, ARISTOTLE);
    const addPopup = await pollPopup(ctx, extId, knownAdd, 20_000);
    if (addPopup) await drivePopupPatient(addPopup, 'mm-add-network', 30_000);
    await addP;
    await studio.bringToFront(); await studio.waitForTimeout(3_000);
    await snap(studio, 'studio-network-added');

    // Navigate /onboard · complete dependent steps before Mint (step 4)
    log(`\n=== /onboard passport mint (5-step flow) ===`);
    await studio.goto(`${STUDIO}/onboard`, { waitUntil: 'domcontentloaded' });
    await studio.waitForTimeout(5_000); await snap(studio, 'studio-onboard-step1');

    // Step 1: Connect injected wallet (may already be done from earlier · skip if not visible)
    const cijb = studio.locator('button:has-text("Connect injected wallet")').first();
    if (await cijb.isVisible({ timeout: 3_000 }).catch(() => false)) {
      log(`  Connect injected wallet visible · clicking`);
      const knownC = new Set<Page>(ctx.pages());
      await cijb.click({ timeout: 8_000 });
      const popup = await pollPopup(ctx, extId, knownC, 25_000);
      if (popup) await drivePopupPatient(popup, 'mm-connect-inj', 25_000);
      await studio.bringToFront(); await studio.waitForTimeout(3_000);
    }

    // Step 2: Check balance (auto-loads · just scroll)
    await studio.evaluate(() => window.scrollBy(0, 250));
    await studio.waitForTimeout(2_000); await snap(studio, 'studio-onboard-step2-balance');

    // Step 3: Pick a handle (input field)
    log(`\n=== Step 3: Pick handle ===`);
    const handleHex = `qa${Date.now().toString(36).slice(-6)}`;
    const handleInputs = [
      'input[placeholder*="handle" i]',
      'input[placeholder*="name" i]',
      'input[placeholder*="alice" i]',
      'input[type="text"]',
    ];
    let handleFilled = false;
    for (const sel of handleInputs) {
      const inp = studio.locator(sel).first();
      if (await inp.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await inp.click(); await inp.fill(handleHex);
        log(`  ✓ handle filled: ${handleHex} (via ${sel})`);
        handleFilled = true; break;
      }
    }
    if (handleFilled) {
      await studio.waitForTimeout(1_500); await snap(studio, 'studio-onboard-step3-handle');
    }

    // Step 4: Find Mint button (may need to scroll more)
    await studio.evaluate(() => window.scrollBy(0, 250));
    await studio.waitForTimeout(2_000);

    log(`\n=== Step 4: Mint Passport ===`);
    const mintBtnCandidates = [
      'button:has-text("Mint your Agent Passport"):not([disabled])',
      'button:has-text("Mint passport"):not([disabled])',
      'button:has-text("Mint"):not([disabled])',
    ];
    let mintBtn = null;
    for (let i = 0; i < 8; i++) {
      for (const sel of mintBtnCandidates) {
        const btn = studio.locator(sel).first();
        if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const enabled = await btn.isEnabled({ timeout: 500 }).catch(() => false);
          if (enabled) { mintBtn = btn; log(`  matched mint: ${sel}`); break; }
        }
      }
      if (mintBtn) break;
      await studio.waitForTimeout(2_000);
    }
    if (!mintBtn) { log(`✗ Mint button not enabled · steps may not have completed`); await snap(studio, 'studio-onboard-no-mint'); await ctx.close(); return; }

    const knownMint = new Set<Page>(ctx.pages());
    await mintBtn.click({ timeout: 8_000, force: true }).catch(async () => { await mintBtn!.dispatchEvent('click').catch(() => {}); });
    log(`  ✓ Mint clicked`);
    await snap(studio, 'after-mint-click');

    for (let popups = 0; popups < 5; popups++) {
      const popup = await pollPopup(ctx, extId, knownMint, 30_000);
      if (popup) {
        log(`  popup ${popups}`);
        await drivePopupPatient(popup, `mm-mint-${popups}`, 120_000);
        knownMint.clear();
        for (const p of ctx.pages()) knownMint.add(p);
      } else break;
    }

    await studio.bringToFront();
    await studio.waitForTimeout(15_000);
    await snap(studio, 'studio-post-mint');

    // Verify passport via chain
    log(`\n=== Verify passport via chain ===`);
    const nonce = await provider.getTransactionCount(address);
    const bal = await provider.getBalance(address);
    log(`  Fresh wallet nonce: ${nonce} · balance: ${formatEther(bal)} OG`);
    log(`  If nonce > 0 → tx submitted; balance dropped → tx confirmed`);

    // Query AgentPassportINFTV2 to see if passport minted
    const passportAddr = '0x5D724659A7d4B0B0917F5DAe9579423D2c85a6Ad';
    const balOfData = '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0');
    const balCall = await fetch(RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: passportAddr, data: balOfData }, 'latest'], id: 1 }),
    }).then((r) => r.json()).catch(() => null);
    if (balCall?.result) {
      const passportBal = BigInt(balCall.result);
      log(`  AgentPassportINFTV2.balanceOf(${address}): ${passportBal} (${passportBal > 0n ? '✓ PASSPORT MINTED' : '✗ no passport'})`);
    }

    writeFileSync(resolve(OUT, 'final.json'), JSON.stringify({ buyerWallet: address, nonce, balance: formatEther(bal) }, null, 2));
  } finally {
    await ctx.close().catch(() => {});
    writeFileSync(resolve(OUT, 'log.md'), `# v16 passport mint · ${new Date().toISOString()}\n\nFresh wallet: ${address}\n\n${events.map((e) => `- ${e}`).join('\n')}\n`);
    log(`\n=== DONE === ${stepNum} captures`);
  }
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); console.error((e as Error).stack); process.exit(1); });
