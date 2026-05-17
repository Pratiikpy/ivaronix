/**
 * v72 · Rabby gap #3 · HIGH-STAKES tier + Burn Mode ON + BALANCED policy via /.
 *
 * This was iter-471's failed combo (Router 429 on a depleted Compute sub-account).
 * After Bug-78 top-up, the active provider has 4 OG locked — plenty for 5 roles.
 *
 * Drives the HOME Run panel (not marketplace), which is the proven-working path
 * for paid runs. CLI doc ask already anchored Receipt 136 with the same Compute
 * setup, so the home Run panel should work identically.
 */
import 'dotenv/config';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { JsonRpcProvider, Contract, getAddress } from 'ethers';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PASSWORD = 'RabbyPass123!QA';
const EXT_PATH = resolve(HERE, 'rabby', 'extension');
const STUDIO = 'https://www.ivaronix.xyz';
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'rabby-100pct-coverage', 'gap-3-high-stakes-burn-balanced-v72');
mkdirSync(OUT, { recursive: true });
mkdirSync(resolve(OUT, 'videos'), { recursive: true });

const PRIMARY_CTAS = ['Sign', 'Confirm', 'Approve', 'Allow'];

let stepNum = 0;
const events: string[] = [];
function log(m: string): void {
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`[${stamp}] ${m}`);
  events.push(`[${stamp}] ${m}`);
}
async function snap(p: Page, label: string): Promise<void> {
  stepNum++;
  const safe = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (p.isClosed()) return;
  try { await p.screenshot({ path: resolve(OUT, safe), fullPage: true }); } catch {}
}
async function cdpRawClick(popup: Page, x: number, y: number): Promise<boolean> {
  try {
    const cdp = await popup.context().newCDPSession(popup);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
    await new Promise((r) => setTimeout(r, 50));
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await new Promise((r) => setTimeout(r, 80));
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await cdp.detach().catch(() => {});
    return true;
  } catch { return false; }
}
async function driveOnePopup(popup: Page, idx: number): Promise<number> {
  const start = Date.now();
  let clicks = 0;
  let lastClick = Date.now();
  while (Date.now() - start < 60_000) {
    if (popup.isClosed()) return clicks;
    if (Date.now() - lastClick > 12_000 && clicks > 0) break;
    let clickedThis = false;
    for (const txt of PRIMARY_CTAS) {
      const btn = popup.getByRole('button', { name: txt, exact: true }).first();
      if (await btn.isVisible({ timeout: 1_500 }).catch(() => false)) {
        const bbox = await btn.boundingBox({ timeout: 2_000 }).catch(() => null);
        if (!bbox) continue;
        const cx = Math.round(bbox.x + bbox.width / 2);
        const cy = Math.round(bbox.y + bbox.height / 2);
        log(`    popup #${idx}: click #${clicks + 1} on "${txt}" (${cx}, ${cy})`);
        if (await cdpRawClick(popup, cx, cy)) {
          clicks++;
          lastClick = Date.now();
          clickedThis = true;
          await new Promise((r) => setTimeout(r, 3_500));
          break;
        }
      }
    }
    if (!clickedThis) await new Promise((r) => setTimeout(r, 1_500));
  }
  return clicks;
}
function findNewPopup(ctx: BrowserContext, extId: string, known: Set<Page>): Page | null {
  for (const p of ctx.pages()) {
    if (known.has(p)) continue;
    if (p.isClosed()) { known.add(p); continue; }
    const url = p.url();
    if (url.includes(extId) && url.includes('notification.html')) return p;
  }
  return null;
}
async function getV3NextId(): Promise<number> {
  const p = new JsonRpcProvider('https://evmrpc.0g.ai', { chainId: 16661, name: 'aristotle' });
  const c = new Contract(getAddress('0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297'), ['function nextId() view returns (uint256)'], p);
  return Number(await c.nextId());
}

(async () => {
  log(`v72 RABBY · gap #3 · HIGH-STAKES + Burn ON + BALANCED via home Run panel`);
  const tmpProfile = resolve(REPO, '.rabby-profile');
  if (!existsSync(tmpProfile)) { log(`FATAL: .rabby-profile missing`); process.exit(1); }

  const ctx = await chromium.launchPersistentContext(tmpProfile, {
    headless: false,
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, '--no-sandbox'],
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: resolve(OUT, 'videos'), size: { width: 1440, height: 900 } },
  });

  let extId = '';
  for (let i = 0; i < 15; i++) {
    const sw = ctx.serviceWorkers().find((w) => w.url().includes('chrome-extension://'));
    if (sw) { extId = sw.url().split('/')[2]; break; }
    await new Promise((r) => setTimeout(r, 800));
  }
  log(`Rabby extId=${extId}`);

  const rabby = await ctx.newPage();
  await rabby.goto(`chrome-extension://${extId}/index.html`).catch(() => {});
  await rabby.waitForTimeout(5_000);
  const pw = rabby.locator('input[type="password"]').first();
  if (await pw.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await pw.click({ timeout: 3_000 });
    await rabby.keyboard.type(PASSWORD, { delay: 50 });
    await rabby.keyboard.press('Enter');
    await rabby.waitForTimeout(4_000);
    log(`Rabby unlocked`);
  }

  const studio = await ctx.newPage();
  await studio.goto(STUDIO, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await studio.waitForTimeout(8_000);
  await snap(studio, 'home-loaded');
  const header = await studio.locator('header').textContent({ timeout: 3_000 }).catch(() => '');
  if (!header?.match(/0x[a-fA-F0-9]{4,}/)) {
    log(`FAIL · not connected`);
    writeFileSync(resolve(OUT, 'REPORT.md'), `# v72 · FAIL\nWallet not connected.\n\n${events.join('\n')}`);
    await ctx.close();
    process.exit(2);
  }
  log(`connected`);

  const baseline = await getV3NextId();
  log(`baseline V3 nextId=${baseline}`);

  // Click "Use sample contract →" button — fills both contentText + question in one click
  const sampleBtn = studio.locator('button:has-text("Use sample contract")').first();
  if (await sampleBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await sampleBtn.click({ timeout: 5_000 });
    log(`"Use sample contract" clicked`);
    await studio.waitForTimeout(2_000);
  } else {
    log(`FATAL · "Use sample contract" button not found`);
    await ctx.close();
    process.exit(4);
  }

  // Tier = high-stakes (second <select> on the page · proven v60 pattern)
  await studio.locator('select').nth(1).selectOption('high-stakes');
  log(`tier=high-stakes via select.nth(1)`);
  await studio.waitForTimeout(1_500);

  // Strictness (policy) = BALANCED (third <select> · proven v61 pattern)
  await studio.locator('select').nth(2).selectOption('BALANCED');
  log(`policy=BALANCED via select.nth(2)`);
  await studio.waitForTimeout(1_500);

  // Burn Mode = ON via checkbox label (text varies; try both)
  const burnLabel = studio.locator('label:has-text("Burn Mode"), label:has-text("Burn")').first();
  if (await burnLabel.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await burnLabel.click({ timeout: 3_000 });
    log(`burn label clicked`);
    await studio.waitForTimeout(1_000);
  }

  await snap(studio, 'prerun-filled');

  const runBtn = studio.locator('button:has-text("Run"):not([disabled])').first();
  if (!(await runBtn.isVisible({ timeout: 10_000 }).catch(() => false))) {
    log(`Run not enabled`);
    writeFileSync(resolve(OUT, 'REPORT.md'), `# v72 · FAIL\nRun button not enabled.\n\n${events.join('\n')}`);
    await ctx.close();
    process.exit(3);
  }
  const knownPages = new Set<Page>(ctx.pages());
  await runBtn.click({ timeout: 5_000 });
  log(`Run clicked`);
  await snap(studio, 'run-clicked');
  await studio.waitForTimeout(2_000);

  // Drive Rabby popups (SIWE Sign + maybe paySkillRun if home charges)
  let totalClicks = 0;
  const popupStart = Date.now();
  while (Date.now() - popupStart < 90_000) {
    const popup = findNewPopup(ctx, extId, knownPages);
    if (popup) {
      log(`popup detected`);
      knownPages.add(popup);
      await snap(popup, `popup-${totalClicks}`);
      const c = await driveOnePopup(popup, totalClicks + 1);
      totalClicks += c;
      await studio.waitForTimeout(3_000);
    }
    await new Promise((r) => setTimeout(r, 2_000));
    if (totalClicks >= 4) break;
  }
  log(`popup phase done · ${totalClicks} clicks`);

  // Wait up to 5 min for anchor (5-role HIGH-STAKES + Burn + BALANCED takes longer)
  log(`waiting up to 300s for receipt anchor (5-role tier)...`);
  const anchorStart = Date.now();
  let final = baseline;
  let captures = 0;
  while (Date.now() - anchorStart < 300_000) {
    final = await getV3NextId().catch(() => baseline);
    if (final > baseline) {
      log(`receipt anchored: ${final - 1}`);
      break;
    }
    if ((Date.now() - anchorStart) > captures * 30_000) {
      captures++;
      await snap(studio, `waiting-${captures * 30}s`);
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }

  await snap(studio, 'final-state');

  const receiptId = final > baseline ? final - 1 : undefined;
  if (receiptId !== undefined) {
    await studio.goto(`${STUDIO}/r/${receiptId}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await studio.waitForTimeout(8_000);
    await snap(studio, `receipt-${receiptId}`);
  }

  writeFileSync(resolve(OUT, 'REPORT.md'), [
    `# v72 · gap #3 · HIGH-STAKES + Burn + BALANCED · ${new Date().toISOString()}`,
    ``,
    `- baseline V3 nextId: ${baseline}`,
    `- final V3 nextId: ${final}`,
    `- receipt: ${receiptId ?? 'NONE'}`,
    `- popup clicks: ${totalClicks}`,
    `- chainscan: ${receiptId !== undefined ? `https://chainscan.0g.ai/address/0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297` : '-'}`,
    `- receipt URL: ${receiptId !== undefined ? `${STUDIO}/r/${receiptId}` : '-'}`,
    ``,
    `## Events`,
    events.join('\n'),
  ].join('\n\n'));
  await ctx.close();
  log(`v72 done`);
  process.exit(0);
})().catch((e) => {
  log(`FATAL: ${(e as Error).message}`);
  writeFileSync(resolve(OUT, 'REPORT.md'), `# v72 FATAL\n${(e as Error).message}\n\n${events.join('\n')}`);
  process.exit(3);
});
