/**
 * v20 · real MM mobile-viewport paid run + AI output capture.
 *
 * Reuses v15b's proven stack: generate fresh wallet → fund → SRP-import →
 * add Aristotle → /memory issue grant → revoke → 2 txs both MM-confirmed.
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
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-mobile-paid-v20');
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
      if (visible) {
        log(`  ${label}: step ${step} click "${t}" (multi-strategy)`);
        // Multi-strategy click for MM v13.30 reliability:
        // 1. locator.click (standard) — often enough; if click succeeds + popup closes, subsequent strategies skipped
        // 2. force-click via dispatchEvent (bypasses pointer events)
        // 3. focus + keyboard Enter (semantic activation)
        // ALL waitForTimeout / locator calls guarded against closed popup.
        await btn.click({ timeout: 4_000, force: true }).catch(() => {});
        await popup.waitForTimeout(500).catch(() => {});
        if (!popup.isClosed()) {
          await btn.dispatchEvent('click').catch(() => {});
          await popup.waitForTimeout(500).catch(() => {});
        }
        if (!popup.isClosed()) {
          await btn.focus().catch(() => {});
          await popup.keyboard.press('Enter').catch(() => {});
        }
        clicked = true; break;
      }
    }
    if (!clicked) { log(`  ${label}: no CTA at step ${step}`); break; }
    await popup.waitForTimeout(2_500).catch(() => {});
    if (!popup.isClosed()) await snap(popup, `${label}-step-${step}`);
  }
}

async function main(): Promise<void> {
  log(`v20 · mobile paid run + AI output quality`);

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
    headless: false, viewport: { width: 375, height: 812 },
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, '--no-sandbox', '--disable-blink-features=AutomationControlled'],
    recordVideo: { dir: OUT, size: { width: 375, height: 812 } }, timeout: 45_000,
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

    // v17 fix: account menu auto-closes between retries on MM v13.30 cold-load.
    // If "Add wallet" not visible after a few retries, re-open the account menu via the trigger.
    for (const txt of ['Add wallet', 'Import a wallet']) {
      let btn = null;
      for (let i = 0; i < 20; i++) {  // 20 × 2s = 40s budget per button
        const t = mm.locator(`text=${txt}`).first();
        if (await t.isVisible({ timeout: 2_000 }).catch(() => false)) { btn = t; break; }
        // Snapshot every 5th retry for diagnostic
        if (i === 4 || i === 9 || i === 14) await snap(mm, `mm-${txt.replace(/ /g, '-').toLowerCase()}-retry-${i}`);
        // Every 4 retries, re-click the account menu trigger in case the menu auto-closed
        if (i > 0 && i % 4 === 0 && txt === 'Add wallet') {
          log(`  re-opening account menu (retry ${i})`);
          const reopen = mm.locator('[data-testid="account-menu-icon"]').first();
          if (await reopen.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await reopen.click({ timeout: 5_000, force: true }).catch(() => {});
            await mm.waitForTimeout(1_500);
          }
        }
        await mm.waitForTimeout(2_000);
      }
      if (!btn) {
        log(`✗ "${txt}" missing after 40s · MM v13.30 LavaMoat flake · snapshot for diagnostic`);
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

    // Capture browser console errors for diagnostic
    studio.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') log(`  🔴 console ${msg.type()}: ${msg.text().slice(0, 200)}`); });
    studio.on('pageerror', (err) => log(`  🔴 pageerror: ${err.message.slice(0, 200)}`));

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

    // EIP-3326 explicit switch · ensures chainChanged event fires + wagmi picks up new chain
    log(`\n=== Force switch to Aristotle (EIP-3326) ===`);
    const knownSwitch = new Set<Page>(ctx.pages());
    const switchP = studio.evaluate(async () => {
      try { await (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x4115' }] }); return { ok: true }; }
      catch (e) { return { ok: false, error: (e as Error).message }; }
    });
    const switchPopup = await pollPopup(ctx, extId, knownSwitch, 10_000);
    if (switchPopup) await drivePopupPatient(switchPopup, 'mm-switch-chain', 30_000);
    const switchRes = await switchP;
    log(`  switch result: ${JSON.stringify(switchRes)}`);
    await studio.bringToFront(); await studio.waitForTimeout(4_000);

    // Verify chain via window.ethereum.chainId
    const chainCheck = await studio.evaluate(async () => {
      const id = await (window as any).ethereum.request({ method: 'eth_chainId' });
      return { chainId: id };
    });
    log(`  wallet active chainId: ${chainCheck.chainId} (expect 0x4115 = 16661)`);

    // Navigate /memory · issue grant + revoke (2-tx flow)
    // Account 666 from prior iters · use ethers getAddress for proper EIP-55 checksum
    // (Studio's viem 2.48 strict mode rejects mixed-case non-checksum addresses)
    const GRANTEE = (await import('ethers')).getAddress('0xc34a9a17bfa61c4e7d49d7ef5c5ec47aaaaa9410');
    log(`\n=== /memory issue grant to ${GRANTEE} ===`);

    // MemoryNotesPanel auto-fires SIWE Sign popup on mount via ensureSiweSession
    // → must drive that Sign popup BEFORE clicking Issue grant, or wagmi's
    // writeContract queues behind the open Sign popup and hangs forever.
    const knownPreMemory = new Set<Page>(ctx.pages());
    await studio.goto(`${STUDIO}/memory`, { waitUntil: 'domcontentloaded' });
    await studio.waitForTimeout(3_000);
    log(`  watching for auto-SIWE Sign popup (MemoryNotesPanel mount)`);
    const siwePopup = await pollPopup(ctx, extId, knownPreMemory, 20_000);
    if (siwePopup) { log(`  ✓ SIWE Sign popup detected · driving`); await drivePopupPatient(siwePopup, 'mm-siwe-sign', 60_000); }
    else log(`  ⚠ no SIWE popup in 20s (already-signed or not triggered)`);
    await studio.bringToFront(); await studio.waitForTimeout(5_000);
    await snap(studio, 'studio-memory-loaded');

    // Find grantee input + Issue grant button
    log(`\n=== Step 1: Fill grantee input ===`);
    const granteeInputs = [
      'input[placeholder="0x…"]',
      'input[placeholder*="0x" i]',
      'input[type="text"]',
    ];
    let granteeFilled = false;
    for (const sel of granteeInputs) {
      const inp = studio.locator(sel).first();
      if (await inp.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await inp.click(); await inp.fill(GRANTEE);
        log(`  ✓ grantee filled: ${GRANTEE} (via ${sel})`);
        granteeFilled = true; break;
      }
    }
    if (!granteeFilled) { log(`✗ grantee input not found · MemoryPanel may not have rendered`); await snap(studio, 'studio-memory-no-input'); await ctx.close(); return; }
    await studio.waitForTimeout(1_500); await snap(studio, 'studio-memory-grantee-filled');

    log(`\n=== Step 2: Click Issue grant ===`);
    const issueBtn = studio.locator('button:has-text("Issue grant"):not([disabled])').first();
    let issueEnabled = false;
    for (let i = 0; i < 5; i++) {
      if (await issueBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const enabled = await issueBtn.isEnabled({ timeout: 500 }).catch(() => false);
        if (enabled) { issueEnabled = true; break; }
      }
      await studio.waitForTimeout(2_000);
    }
    if (!issueEnabled) { log(`✗ Issue grant button not enabled`); await snap(studio, 'studio-memory-issue-disabled'); await ctx.close(); return; }

    const knownIssue = new Set<Page>(ctx.pages());
    await issueBtn.click({ timeout: 8_000, force: true }).catch(async () => { await issueBtn.dispatchEvent('click').catch(() => {}); });
    log(`  ✓ Issue grant clicked`);
    await snap(studio, 'after-issue-click');

    for (let popups = 0; popups < 5; popups++) {
      const popup = await pollPopup(ctx, extId, knownIssue, 30_000);
      if (popup) {
        log(`  popup ${popups}`);
        await drivePopupPatient(popup, `mm-issue-${popups}`, 120_000);
        knownIssue.clear();
        for (const p of ctx.pages()) knownIssue.add(p);
      } else break;
    }

    await studio.bringToFront();
    await studio.waitForTimeout(15_000);
    await snap(studio, 'studio-post-issue');

    // Verify grant on-chain via CapabilityRegistry.listGrantsByOwner
    log(`\n=== Verify grant via chain ===`);
    const nonce1 = await provider.getTransactionCount(address);
    const bal1 = await provider.getBalance(address);
    log(`  After issue · nonce: ${nonce1} · balance: ${formatEther(bal1)} OG`);

    const capabilityAddr = '0x0000000000000000000000000000000000000000'; // V2 lookup below
    // listGrantsByOwner(address) → bytes32[]
    const sigGrants = '0x' + 'a59abc20'; // listGrantsByOwner(address) selector — actual via 4byte
    // Better: use CapabilityRegistry from contracts/deployments/mainnet.json
    const deployJson = JSON.parse(readFileSync(resolve(REPO, 'contracts/deployments/mainnet.json'), 'utf8'));
    const capAddr = deployJson.contracts.CapabilityRegistryV2 ?? deployJson.contracts.CapabilityRegistry;
    log(`  CapabilityRegistry: ${capAddr}`);
    // function listGrantsByOwner(address owner) → bytes32[]
    const eth = await import('ethers');
    const ifaceSelector = eth.keccak256(eth.toUtf8Bytes('listGrantsByOwner(address)')).slice(0, 10);
    const callData = ifaceSelector + address.slice(2).toLowerCase().padStart(64, '0');
    const callResp = await fetch(RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: capAddr, data: callData }, 'latest'], id: 1 }),
    }).then((r) => r.json()).catch(() => null);
    log(`  listGrantsByOwner result: ${callResp?.result?.slice(0, 200) ?? 'null'}`);

    // If nonce >= 1, grant tx landed
    if (nonce1 < 1) { log(`✗ grant tx never submitted · ending early`); await ctx.close(); return; }

    // Now revoke the grant — reload /memory so wagmi refetches listGrantsByOwner
    log(`\n=== Step 3: Revoke grant (reloading /memory for fresh grants list) ===`);
    await studio.goto(`${STUDIO}/memory`, { waitUntil: 'domcontentloaded' });
    await studio.waitForTimeout(8_000); // wait for SIWE session restore + listGrantsByOwner fetch
    await studio.evaluate(() => window.scrollBy(0, 350));
    await studio.waitForTimeout(3_000); await snap(studio, 'studio-memory-grants-list');

    const revokeBtn = studio.locator('button:has-text("Revoke"):not([disabled])').first();
    let revokeReady = false;
    for (let i = 0; i < 30; i++) { // wait up to 60s for grant row to render
      if (await revokeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        revokeReady = true; break;
      }
      await studio.waitForTimeout(2_000);
    }
    if (!revokeReady) { log(`✗ Revoke button not found after 30s · grant may not yet appear in UI`); await snap(studio, 'studio-memory-no-revoke'); }
    else {
      const knownRev = new Set<Page>(ctx.pages());
      await revokeBtn.click({ timeout: 8_000, force: true }).catch(async () => { await revokeBtn.dispatchEvent('click').catch(() => {}); });
      log(`  ✓ Revoke clicked`);
      await snap(studio, 'after-revoke-click');

      for (let popups = 0; popups < 5; popups++) {
        const popup = await pollPopup(ctx, extId, knownRev, 30_000);
        if (popup) {
          log(`  popup ${popups}`);
          await drivePopupPatient(popup, `mm-revoke-${popups}`, 120_000);
          knownRev.clear();
          for (const p of ctx.pages()) knownRev.add(p);
        } else break;
      }
      await studio.bringToFront();
      await studio.waitForTimeout(15_000);
      await snap(studio, 'studio-post-revoke');
    }

    const nonce2 = await provider.getTransactionCount(address);
    const bal2 = await provider.getBalance(address);
    log(`\n  After revoke · nonce: ${nonce2} · balance: ${formatEther(bal2)} OG`);
    log(`  Issue tx + Revoke tx if nonce2 >= 2 · ${nonce2 >= 2 ? '✓ BOTH txs submitted' : `✗ only ${nonce2} tx(s)`}`);

    writeFileSync(resolve(OUT, 'final.json'), JSON.stringify({
      ownerWallet: address, grantee: GRANTEE,
      nonceAfterIssue: nonce1, nonceAfterRevoke: nonce2,
      balanceFinal: formatEther(bal2),
      capabilityRegistry: capAddr,
    }, null, 2));
  } finally {
    await ctx.close().catch(() => {});
    writeFileSync(resolve(OUT, 'log.md'), `# v20 mobile paid run · ${new Date().toISOString()}\n\nFresh wallet: ${address}\n\n${events.map((e) => `- ${e}`).join('\n')}\n`);
    log(`\n=== DONE === ${stepNum} captures`);
  }
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); console.error((e as Error).stack); process.exit(1); });
