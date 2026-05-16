/**
 * v40 · Paid skill RUN via real MM — proven-working click pattern.
 *
 * Breakthrough: test-mm-click-strategies.ts proved that a simple
 *   await popup.locator('[data-testid="confirm-btn"]').click()
 * works against MM v13.30 popup IF you wait 3+ seconds after popup
 * detection for the popup to fully render. v39 failed because its
 * drivePopup loop fired before the popup was render-stable, and the
 * popup reference may have grabbed popup-init.html (which auto-closes
 * when notification.html opens).
 *
 * v40 strategy:
 *   1. Wait specifically for notification.html (not popup-init.html)
 *   2. After detection, wait 3s for full render before clicking
 *   3. Click confirm-btn directly — no fuzzy fallbacks
 *   4. Treat post-click popup auto-close as success
 */
import 'dotenv/config';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PASSWORD = 'TestPass123!QA';
const EXT_PATH = resolve(HERE, 'mm', 'extension');
const SOURCE_PROFILE = resolve(HERE, 'mm', 'profile');
const STUDIO = process.env.STUDIO_BASE ?? 'https://www.ivaronix.xyz';
const OPERATOR_ADDR = '0xaa954c33810029a3eFb0bf755FEF17863E8677Ce';
const MAINNET_HEX = '0x412d'; // 16661

const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-paid-run-v40');
mkdirSync(OUT, { recursive: true });

let stepNum = 0;
const events: string[] = [];
function log(msg: string): void {
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`[${stamp}] ${msg}`);
  events.push(`[${stamp}] ${msg}`);
}

async function snap(page: Page, label: string): Promise<string> {
  stepNum++;
  const safe = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) { log(`(skip) ${safe} — page closed`); return safe; }
  try { await page.screenshot({ path: resolve(OUT, safe), fullPage: false }); log(`📸 ${safe}`); }
  catch (e) { log(`(skip) ${safe}: ${(e as Error).message.slice(0, 80)}`); }
  return safe;
}

async function pollPopup(ctx: BrowserContext, extId: string, known: Set<Page>, ms = 30_000): Promise<Page | null> {
  const start = Date.now();
  // v40: prefer notification.html (the real popup), not popup-init.html
  // (the loading shim that auto-redirects). pollPopup waits for either,
  // and after detection the caller should wait 3s for full render.
  while (Date.now() - start < ms) {
    for (const p of ctx.pages()) {
      if (known.has(p)) continue;
      const url = p.url();
      if (url.includes(extId) && url.includes('notification.html')) return p;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  // Fallback: any extId page (popup-init might be all we have)
  for (const p of ctx.pages()) {
    if (known.has(p)) continue;
    if (p.url().includes(extId)) return p;
  }
  return null;
}

async function drivePopup(popup: Page, label: string, ms = 90_000): Promise<boolean> {
  // v40c: EXACT pattern from test-mm-click-strategies which succeeded
  // in producing wallet-connected state on production. Critical detail:
  // waitForTimeout 3s FIRST (popup renders in background), THEN
  // bringToFront, THEN screenshot (forces render flush), THEN bbox+click.
  const overallStart = Date.now();
  let stepIdx = 0;
  while (Date.now() - overallStart < ms) {
    if (popup.isClosed()) { log(`  ${label}: popup closed after ${stepIdx} steps`); return true; }

    // Step 1: wait for popup to render in background (3s)
    try { await popup.waitForTimeout(3_000); } catch {
      log(`  ${label}: popup closed during render-wait`); return true;
    }
    if (popup.isClosed()) { log(`  ${label}: popup closed after render-wait`); return true; }

    // Step 2: bring popup to front + force render flush via screenshot
    try { await popup.bringToFront(); } catch { /* may be detaching */ }
    try {
      const snapPath = resolve(OUT, `popup-${label}-step-${stepIdx + 1}.png`);
      await popup.screenshot({ path: snapPath, fullPage: true });
    } catch { /* screenshot may fail */ }

    // Step 3: bbox-wait then click (proven pattern)
    const btn = popup.locator('[data-testid="confirm-btn"]');
    const bbox = await btn.boundingBox({ timeout: 10_000 }).catch(() => null);
    if (!bbox) {
      const allBtns = await popup.locator('button').allTextContents().catch(() => [] as string[]);
      log(`  ${label}: confirm-btn bbox-wait timed out after ${stepIdx} steps · popup url: ${popup.url().slice(0, 60)} · buttons: ${allBtns.slice(0, 6).join(' | ').slice(0, 200)}`);
      return false;
    }
    const text = await btn.textContent({ timeout: 500 }).catch(() => '');
    try {
      await btn.click({ timeout: 10_000 });
      stepIdx++;
      log(`  ${label}: step ${stepIdx} click "${text?.trim().slice(0, 30)}" @ x=${Math.round(bbox.x)} y=${Math.round(bbox.y)}`);
    } catch (e) {
      log(`  ${label}: click failed at step ${stepIdx + 1}: ${(e as Error).message.slice(0, 80)}`);
      return false;
    }
    // Post-click: popup may close (success) or show next step
    try { await popup.waitForTimeout(3_000); } catch {
      log(`  ${label}: popup auto-closed after step ${stepIdx} (normal)`);
      return true;
    }
  }
  return false;
}

async function readWalletChainId(studio: Page): Promise<string | null> {
  try {
    const cid = await studio.evaluate(async () => {
      const eth = (window as { ethereum?: { request: (a: { method: string }) => Promise<string> } }).ethereum;
      if (!eth) return null;
      return await eth.request({ method: 'eth_chainId' });
    });
    return cid;
  } catch {
    return null;
  }
}

async function ensureMainnet(studio: Page, ctx: BrowserContext, extId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const cid = await readWalletChainId(studio);
    log(`  attempt ${attempt + 1}: wallet chainId = ${cid}`);
    if (cid === MAINNET_HEX) {
      log(`  ✓ Wallet is on OG Mainnet (${MAINNET_HEX})`);
      return true;
    }
    const banner = studio.locator('text=/Wrong network/i').first();
    const hasBanner = await banner.isVisible({ timeout: 2_000 }).catch(() => false);
    if (!hasBanner && cid && cid !== MAINNET_HEX) {
      log(`  ⚠ Banner gone but wallet still on ${cid} — reload`);
      await studio.reload({ waitUntil: 'domcontentloaded' });
      await studio.waitForTimeout(3_000);
      continue;
    }
    const switchBtn = studio.locator('button:has-text("Switch to OG Mainnet"), a:has-text("Switch to OG Mainnet")').first();
    if (await switchBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      log(`  → clicking Switch button (attempt ${attempt + 1})`);
      const known = new Set<Page>(ctx.pages());
      await switchBtn.click({ timeout: 5_000 });
      const popup = await pollPopup(ctx, extId, known, 30_000);
      if (popup) await drivePopup(popup, 'mm-chain-switch', 60_000);
      await studio.bringToFront();
      // Wait + verify chainId update
      for (let i = 0; i < 20; i++) {
        await studio.waitForTimeout(1500);
        const c2 = await readWalletChainId(studio);
        if (c2 === MAINNET_HEX) {
          log(`  ✓ Wallet chainId now ${c2} after ${(i + 1) * 1.5}s`);
          return true;
        }
      }
    }
  }
  return false;
}

interface PaidRunResult {
  status: 'PASS' | 'BLOCK' | 'FAIL';
  receiptId?: string;
  receiptUrl?: string;
  txHash?: string;
  aiHeadline?: string;
  cliVerifyOutput?: string;
  blockedAt?: string;
  notes: string;
}

async function paidRun(studio: Page, ctx: BrowserContext, extId: string): Promise<PaidRunResult> {
  log(`\n=== PAID RUN v40 · home → ensure mainnet → Use sample → Run → MM → /r/<id> ===`);
  try {
    await studio.goto(STUDIO, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await studio.waitForTimeout(5_000);

    // Drive Connect first if needed
    const connectBtn = studio.locator('button:has-text("Connect"), a:has-text("Connect Wallet")').first();
    if (await connectBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const known = new Set<Page>(ctx.pages());
      await connectBtn.click({ timeout: 5_000 });
      log(`  ✓ Connect clicked`);
      const popup = await pollPopup(ctx, extId, known, 20_000);
      if (popup) await drivePopup(popup, 'mm-connect', 30_000);
      await studio.bringToFront();
      await studio.waitForTimeout(5_000);
    }
    await snap(studio, 'home-connected');

    // Ensure wallet is on mainnet BEFORE proceeding
    const onMainnet = await ensureMainnet(studio, ctx, extId);
    if (!onMainnet) {
      await snap(studio, 'chain-switch-failed');
      return { status: 'BLOCK', blockedAt: 'chain-switch', notes: 'Could not force wallet to mainnet chainId 0x412d after 3 attempts.' };
    }
    await snap(studio, 'on-mainnet');

    const useSampleBtn = studio.locator('a:has-text("Use sample contract"), button:has-text("Use sample contract")').first();
    if (!(await useSampleBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      return { status: 'BLOCK', blockedAt: 'use-sample-not-visible', notes: 'No Use Sample CTA.' };
    }
    await useSampleBtn.click({ timeout: 5_000 });
    log(`  ✓ Use sample clicked`);
    await studio.waitForTimeout(3_000);
    await snap(studio, 'sample-loaded');

    const runBtn = studio.locator('button:has-text("Run"):not([disabled])').first();
    if (!(await runBtn.isVisible({ timeout: 8_000 }).catch(() => false))) {
      return { status: 'BLOCK', blockedAt: 'run-button-not-visible', notes: 'No enabled Run button.' };
    }

    const known = new Set<Page>(ctx.pages());
    await runBtn.click({ timeout: 5_000 });
    log(`  ✓ Run clicked`);
    await studio.waitForTimeout(2_000);
    await snap(studio, 'run-clicked');

    let popupIdx = 0;
    for (let i = 0; i < 4; i++) {
      const popup = await pollPopup(ctx, extId, known, 30_000);
      if (popup) {
        popupIdx++;
        log(`  → MM popup #${popupIdx} detected · auto-driving`);
        await snap(popup, `popup-${popupIdx}`);
        const ok = await drivePopup(popup, `mm-paid-run-${popupIdx}`, 60_000);
        log(`  ← popup #${popupIdx} ${ok ? 'closed' : 'timed out'}`);
        await studio.bringToFront();
        await studio.waitForTimeout(5_000);
      } else {
        break;
      }
    }
    await snap(studio, 'after-popups');

    const start = Date.now();
    while (Date.now() - start < 180_000) {
      const url = studio.url();
      const m = url.match(/\/r\/(\d+)/);
      if (m) {
        const receiptId = m[1];
        log(`  ✓ Redirected to /r/${receiptId}`);
        await studio.waitForTimeout(8_000);
        await snap(studio, `receipt-${receiptId}-loaded`);
        const headline = await studio.locator('p').first().textContent({ timeout: 5_000 }).catch(() => '');
        log(`  AI headline: ${headline?.slice(0, 140)}`);
        return {
          status: 'PASS',
          receiptId,
          receiptUrl: `${STUDIO}/r/${receiptId}`,
          aiHeadline: headline?.slice(0, 500),
          notes: `Paid run complete. ${popupIdx} MM popup(s) auto-driven.`,
        };
      }
      const errorAlert = await studio.locator('[role="alert"]').first().textContent({ timeout: 1_000 }).catch(() => '');
      if (errorAlert && errorAlert.length > 5) log(`  alert: ${errorAlert.slice(0, 100)}`);
      await studio.waitForTimeout(3_000);
    }

    await snap(studio, 'timeout-no-receipt');
    return { status: 'BLOCK', blockedAt: 'no-redirect-to-receipt', notes: `180s elapsed, ${popupIdx} popups driven.` };
  } catch (e) {
    log(`  ✗ paidRun threw: ${(e as Error).message.slice(0, 200)}`);
    await snap(studio, 'paid-run-error');
    return { status: 'FAIL', blockedAt: 'exception', notes: (e as Error).message };
  }
}

(async () => {
  log(`v40 paid-run real-MM · notification.html + 3s render-wait + direct click · target: 1 fresh receipt`);
  log(`Studio: ${STUDIO}`);

  const tmpProfile = resolve(REPO, '.v40-profile');
  if (!existsSync(tmpProfile)) {
    const { cpSync } = await import('node:fs');
    log(`Copying MM profile to ${tmpProfile}`);
    cpSync(SOURCE_PROFILE, tmpProfile, { recursive: true });
  } else {
    log(`Reusing existing temp profile`);
  }

  const ctx = await chromium.launchPersistentContext(tmpProfile, {
    headless: false,
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  log(`Chromium launched`);

  let extId = '';
  for (let i = 0; i < 10; i++) {
    const sw = ctx.serviceWorkers().find((w) => w.url().includes('chrome-extension://'));
    if (sw) {
      extId = sw.url().split('/')[2];
      log(`MM SW · extId=${extId}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!extId) {
    log(`✗ MM SW not found`);
    await ctx.close();
    process.exit(1);
  }

  const mm = await ctx.newPage();
  await mm.goto(`chrome-extension://${extId}/home.html`);
  await mm.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {});
  await mm.waitForTimeout(3_000);
  await snap(mm, 'mm-initial');
  const pwInput = mm.locator('input[type="password"], input[data-testid="unlock-password"]').first();
  if (await pwInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pwInput.fill(PASSWORD);
    const unlockBtn = mm.locator('button:has-text("Unlock"), button[data-testid="unlock-submit"]').first();
    if (await unlockBtn.isVisible({ timeout: 3_000 }).catch(() => false)) await unlockBtn.click();
    await mm.waitForTimeout(4_000);
  }
  await snap(mm, 'mm-unlocked');

  const studio = await ctx.newPage();
  const result = await paidRun(studio, ctx, extId);

  log(`\n=== RESULT ===`);
  log(`Status: ${result.status}`);
  if (result.receiptId) log(`Receipt: ${result.receiptUrl}`);
  if (result.blockedAt) log(`Blocked at: ${result.blockedAt}`);
  log(`Notes: ${result.notes}`);

  let cliOutput = '';
  if (result.status === 'PASS' && result.receiptId && /^\d+$/.test(result.receiptId)) {
    try {
      log(`\n=== CLI VERIFY · pnpm ivaronix receipt verify ${result.receiptId} --network mainnet ===`);
      const proc = spawnSync('pnpm', ['ivaronix', 'receipt', 'verify', result.receiptId, '--network', 'mainnet'], {
        cwd: REPO, encoding: 'utf8', timeout: 60_000, shell: true,
      });
      cliOutput = (proc.stdout || '') + (proc.stderr || '');
      log(cliOutput.split('\n').slice(0, 12).join('\n'));
      result.cliVerifyOutput = cliOutput;
    } catch (e) {
      log(`✗ CLI verify threw: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  const report = [
    `# v37 Paid-Run Real-MM Driver Report (chain-state polled)`,
    ``,
    `**Status:** ${result.status}`,
    `**Studio:** ${STUDIO}`,
    `**Operator wallet:** \`${OPERATOR_ADDR}\``,
    ``,
    `## Outcome`,
    ``,
    result.receiptId ? `- **Receipt ID:** ${result.receiptId}` : `- **Blocked at:** ${result.blockedAt}`,
    result.receiptUrl ? `- **Receipt URL:** ${result.receiptUrl}` : '',
    result.aiHeadline ? `\n## AI Output Headline\n\n> ${result.aiHeadline}` : '',
    result.cliVerifyOutput ? `\n## CLI Verify Output\n\n\`\`\`\n${result.cliVerifyOutput.split('\n').slice(0, 30).join('\n')}\n\`\`\`` : '',
    `\n## Notes\n\n${result.notes}`,
    `\n## Event Log\n\n\`\`\`\n${events.join('\n')}\n\`\`\``,
  ].filter(Boolean).join('\n');
  writeFileSync(resolve(OUT, 'REPORT.md'), report);
  log(`\n📄 Report: ${resolve(OUT, 'REPORT.md')}`);

  await ctx.close();
  process.exit(result.status === 'PASS' ? 0 : 1);
})().catch((e) => {
  log(`✗ FATAL: ${(e as Error).message}`);
  process.exit(2);
});
