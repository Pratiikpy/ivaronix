/**
 * v70 · Rabby 100% coverage · Gap #1 + #2 · legal-citation + term-sheet marketplace.
 *
 * Re-runs the 2 skills that FAILED in v63 (Task #460) — post-Bug-72 keyring
 * rotation fix that unblocked the Router 429 storm.
 *
 * Per gap from MATRIX.md:
 *   #1 /marketplace/legal-citation-verifier · Quick/Standard tier
 *   #2 /marketplace/term-sheet-risk-scanner · Standard/High-Stakes tier
 *
 * Records video of full session, snapshots every state transition, anchors
 * a receipt for each, writes REPORT.md with receipt ids + chainscan links.
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
const STUDIO = process.env.STUDIO_BASE ?? 'https://www.ivaronix.xyz';
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'rabby-100pct-coverage', 'gap-1-2-marketplace-v70');
mkdirSync(OUT, { recursive: true });
mkdirSync(resolve(OUT, 'videos'), { recursive: true });

const SAMPLE_BRIEF = `IN THE UNITED STATES DISTRICT COURT
SOUTHERN DISTRICT OF NEW YORK

Plaintiff cites the following authorities in support:

1. Mata v. Avianca, Inc., 678 F. Supp. 3d 412 (S.D.N.Y. 2023) — for the proposition that the airline's limitation-of-liability clause is unenforceable under the Montreal Convention.

2. Citizens United v. FEC, 558 U.S. 310 (2010) — establishing that corporate political spending is protected First Amendment speech.

3. Patterson v. Aramburu, 815 F.3d 1208 (10th Cir. 2016) — for joint and several liability among air carriers.

4. Glenwood Capital, LLC v. Stuart Avenue, Inc., 245 N.J. Super. 543 (App. Div. 2019) — applying the parol evidence rule to commercial leases.

5. Wexler v. Brody-Tonelli, 89 F.4th 122 (2d Cir. 2023) — recognizing emotional distress damages in breach of fiduciary duty.

Plaintiff respectfully submits these citations support the relief requested.`;

const SAMPLE_TERM_SHEET = `SERIES B PREFERRED STOCK · TERM SHEET (NON-BINDING)

ISSUER: ExampleCo, Inc.
AGGREGATE INVESTMENT: $20,000,000
PRE-MONEY VALUATION: $80,000,000

LIQUIDATION PREFERENCE: 3x participating with no cap. Series B is paid 3x of the original purchase price prior to any distribution to common, then shares pro-rata with common on remaining proceeds.

ANTI-DILUTION: Full-ratchet weighted average for the first 24 months from closing; weighted-average broad-based thereafter.

OPTION POOL: 12% post-money option pool to be created prior to closing (dilutive to founders only).

FOUNDER VESTING: 4-year reset on existing founder shares with no acceleration on change of control or termination without cause.

DRAG-ALONG: Any single investor holding >5% Series B may force the sale.

PROTECTIVE PROVISIONS: Series B consent required for: hiring/firing C-level execs · annual budget approval · any expense >$50K · option grants >0.1% · debt >$100K.

PAY-TO-PLAY: None.

MFN: None.

This term sheet is subject to legal review and definitive documentation.`;

const GAPS = [
  {
    gap: 1,
    slug: 'legal-citation-verifier',
    tier: 'standard',
    burnMode: false,
    strictness: 'STRICT',
    doc: SAMPLE_BRIEF,
    question: 'Verify each case-law citation exists at the cited court.',
  },
  {
    gap: 2,
    slug: 'term-sheet-risk-scanner',
    tier: 'standard',
    burnMode: false,
    strictness: 'BALANCED',
    doc: SAMPLE_TERM_SHEET,
    question: 'Identify the most founder-hostile provisions and estimate impact.',
  },
];

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
  try { await p.screenshot({ path: resolve(OUT, safe), fullPage: false }); } catch {}
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
async function resolveSkillHref(page: Page, targetSlug: string): Promise<string | null> {
  await page.goto(`${STUDIO}/marketplace`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(6_000);
  const cards = await page.locator('a[href^="/marketplace/0x"]').evaluateAll((els: any[]) =>
    els.map((el) => ({ href: el.href, text: (el.textContent || '').trim() }))
  );
  const match = cards.find((c) => c.text.includes(targetSlug));
  return match ? match.href : null;
}

(async () => {
  log(`v70 RABBY · gap #1 + #2 · marketplace re-drive · post-Bug-72`);
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
  await snap(studio, 'studio-home-loaded');
  const header = await studio.locator('header').textContent({ timeout: 3_000 }).catch(() => '');
  if (!header?.match(/0x[a-fA-F0-9]{4,}/)) {
    log(`FAIL · header has no wallet address → not connected. header=${header?.slice(0, 100)}`);
    writeFileSync(resolve(OUT, 'REPORT.md'), `# v70 · FAIL\n\nWallet not connected to Studio.\nHeader: ${header}\n\n${events.join('\n')}`);
    await ctx.close();
    process.exit(2);
  }
  log(`connected`);

  const results: { gap: number; slug: string; href?: string; baseline: number; final: number; clicks: number; receiptId?: number }[] = [];

  for (const g of GAPS) {
    log(`\n=== Gap #${g.gap} · ${g.slug} ===`);
    const href = await resolveSkillHref(studio, g.slug);
    if (!href) {
      log(`SKIP · ${g.slug} not found on /marketplace`);
      results.push({ gap: g.gap, slug: g.slug, baseline: 0, final: 0, clicks: 0 });
      continue;
    }
    log(`href=${href}`);
    const baseline = await getV3NextId();
    log(`baseline V3 nextId=${baseline}`);

    await studio.goto(href, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await studio.waitForTimeout(6_000);
    await snap(studio, `${g.slug}-skill-page`);

    const textarea = studio.locator('textarea').first();
    if (await textarea.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await textarea.fill(g.doc);
      await studio.waitForTimeout(1_500);
    }
    const questionInput = studio.locator('input[placeholder*="question" i], input[placeholder*="Which clause" i]').first();
    if (await questionInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await questionInput.fill(g.question);
      await studio.waitForTimeout(1_500);
    }
    await snap(studio, `${g.slug}-prerun-filled`);

    const runBtn = studio.locator('button:has-text("Run"):not([disabled])').first();
    if (!(await runBtn.isVisible({ timeout: 10_000 }).catch(() => false))) {
      log(`Run not enabled for ${g.slug} — checking for disabled-reason text`);
      const reasonHtml = await studio.locator('body').innerText({ timeout: 3_000 }).catch(() => '');
      log(`disable reason scan: ${reasonHtml.slice(0, 400)}`);
      results.push({ gap: g.gap, slug: g.slug, href, baseline, final: baseline, clicks: 0 });
      continue;
    }
    const knownPages = new Set<Page>(ctx.pages());
    await runBtn.click({ timeout: 5_000 });
    log(`Run clicked for ${g.slug}`);
    await snap(studio, `${g.slug}-run-clicked`);
    await studio.waitForTimeout(2_000);

    let totalClicks = 0;
    const start = Date.now();
    while (Date.now() - start < 180_000) {
      const popup = findNewPopup(ctx, extId, knownPages);
      if (popup) {
        log(`popup detected for ${g.slug}`);
        knownPages.add(popup);
        await snap(popup, `${g.slug}-popup-${totalClicks}`);
        const c = await driveOnePopup(popup, results.length + 1);
        totalClicks += c;
        await studio.waitForTimeout(3_000);
      }
      const cur = await getV3NextId().catch(() => baseline);
      if (cur > baseline) {
        log(`Receipt detected: ${cur - 1}`);
        await snap(studio, `${g.slug}-post-anchor`);
        break;
      }
      await new Promise((r) => setTimeout(r, 2_500));
    }
    const final = await getV3NextId();
    const receiptId = final > baseline ? final - 1 : undefined;
    log(`${g.slug}: nextId ${baseline} → ${final} · receipt=${receiptId}`);
    if (receiptId !== undefined) {
      await studio.goto(`${STUDIO}/r/${receiptId}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await studio.waitForTimeout(8_000);
      await snap(studio, `${g.slug}-receipt-page-${receiptId}`);
    }
    results.push({ gap: g.gap, slug: g.slug, href, baseline, final, clicks: totalClicks, receiptId });
  }

  log(`\n=== v70 SUMMARY ===`);
  for (const r of results) {
    log(`  Gap #${r.gap} · ${r.slug}: receipt=${r.receiptId ?? 'NONE'} · clicks=${r.clicks}`);
  }
  writeFileSync(resolve(OUT, 'REPORT.md'), [
    `# v70 · Rabby gap #1 + #2 marketplace re-drive · ${new Date().toISOString()}`,
    ``,
    ...results.map((r) => [
      `## Gap #${r.gap} · ${r.slug}`,
      `- skill href: ${r.href ?? 'NOT FOUND'}`,
      `- baseline V3 nextId: ${r.baseline}`,
      `- final V3 nextId: ${r.final}`,
      `- receipt: ${r.receiptId ?? 'NONE'}`,
      `- popup clicks: ${r.clicks}`,
      `- chainscan: ${r.receiptId !== undefined ? `https://chainscan.0g.ai/address/0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297` : '-'}`,
      `- receipt URL: ${r.receiptId !== undefined ? `https://www.ivaronix.xyz/r/${r.receiptId}` : '-'}`,
    ].join('\n')),
    ``,
    `## Events`,
    events.join('\n'),
  ].join('\n\n'));
  await ctx.close();
  log(`v70 done`);
  process.exit(0);
})().catch((e) => {
  log(`FATAL: ${(e as Error).message}`);
  writeFileSync(resolve(OUT, 'REPORT.md'), `# v70 FATAL\n${(e as Error).message}\n\n${events.join('\n')}`);
  process.exit(3);
});
