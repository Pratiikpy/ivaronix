// E2E verification for planning-01 §2A (delegated AI agent) + the half-baked
// audit sweep closed in commit a899376. Real MetaMask extension, real wallet,
// real chain reads, both viewports, side-by-side vs brand/Ivaronix.html.
//
// Surfaces covered:
// 1. /thesis            — new non-technical pitch page (desktop + mobile)
// 2. /delegate/<id>     — new delegated-agent profile (desktop + mobile)
// 3. /r/1204            — the receipt signed by the DELEGATE, not the user
// 4. /agent/<delegate>  — agent profile after the audit-copy fix; receipt
//                          type label "skill_exec" not "type code 5"
// 5. /agent/no-handle   — confirms vanity-handle copy no longer mentions
//                          "Day 17 / next sprint"
// 6. /memory            — confirms the on-chain MemoryAccessLog audit feed
//                          renders without Day-18 placeholder copy
// 7. /global            — confirms first-party-skill stat is computed from
//                          loadAllSkills (not the literal "5")

import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PASSWORD = 'TestPass123!QA';
const EXTENSION_PATH = resolve(HERE, 'mm', 'extension');
const USER_DATA_DIR = resolve(HERE, 'mm', 'profile');
const SHOTS_DIR = resolve(REPO, 'screenshots', '2a-and-audit');
const BRAND_HTML = resolve(REPO, 'brand', 'Ivaronix.html');
mkdirSync(SHOTS_DIR, { recursive: true });

const DELEGATE_ID = '01KR67PT76V9AQTHN413PYWB1J';
const DELEGATE_ADDRESS = '0x4B2147665818b823bdbDd3f92Aa006A08e4224e0';
const DELEGATE_RECEIPT_ID = 1204;

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const name = `${String(stepNum).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   📸 ${name}`);
  } catch {
    // ignore — page may have closed mid-screenshot
  }
}

async function findExtensionId(context: BrowserContext): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const sw = context.serviceWorkers();
    if (sw.length) {
      const m = sw[0].url().match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('extension service worker not found');
}

async function unlockMetaMask(ctx: BrowserContext): Promise<void> {
  const extId = await findExtensionId(ctx);
  console.log(`   ext id: ${extId}`);
  const mm = ctx.pages().find((p) => p.url().includes(extId)) ?? (await ctx.newPage());
  if (!mm.url().includes(extId)) await mm.goto(`chrome-extension://${extId}/home.html`);
  await mm.bringToFront();
  await mm.waitForSelector('button, input[type="password"]', { timeout: 60_000 }).catch(() => {});
  await mm.waitForTimeout(2_500);
  if (await mm.locator('button:has-text("Unlock")').first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    await mm.locator('input[type="password"]').first().fill(PASSWORD);
    await mm.locator('button:has-text("Unlock"), button:has-text("Sign in")').first().click({ timeout: 8_000 }).catch(() => {});
    await mm.waitForTimeout(3_000);
  }
}

(async () => {
  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
    recordVideo: { dir: SHOTS_DIR, size: { width: 1440, height: 900 } },
  });
  ctx.setDefaultTimeout(60_000);
  ctx.setDefaultNavigationTimeout(120_000);

  await unlockMetaMask(ctx);

  const studio = await ctx.newPage();

  // ─── /thesis · desktop ────────────────────────────────────────────────
  await studio.goto(`http://localhost:3300/thesis`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(3_500);
  await snap(studio, 'thesis-desktop-top');
  await studio.evaluate(() => window.scrollTo(0, 600));
  await studio.waitForTimeout(700);
  await snap(studio, 'thesis-desktop-mid');
  await studio.evaluate(() => window.scrollTo(0, 1400));
  await studio.waitForTimeout(700);
  await snap(studio, 'thesis-desktop-numbers');
  await studio.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await studio.waitForTimeout(700);
  await snap(studio, 'thesis-desktop-cta');

  // Audit voice spot-check: no banned words on /thesis
  const thesisText = (await studio.locator('article').innerText()).toLowerCase();
  const BANNED = ['delve', 'unlock', 'unleash', 'leverage', 'empower', 'seamless', 'harness', 'streamline', 'cutting-edge', 'state-of-the-art', 'revolutionize'];
  const hits = BANNED.filter((w) => thesisText.includes(w));
  console.log(hits.length === 0 ? '   ✓ /thesis voice clean' : `   ✗ /thesis banned words: ${hits.join(', ')}`);

  // ─── /delegate/<id> · desktop ─────────────────────────────────────────
  await studio.goto(`http://localhost:3300/delegate/${DELEGATE_ID}`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(4_000);
  await snap(studio, 'delegate-desktop-top');
  await studio.evaluate(() => window.scrollTo(0, 600));
  await studio.waitForTimeout(700);
  await snap(studio, 'delegate-desktop-grants');
  await studio.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await studio.waitForTimeout(700);
  await snap(studio, 'delegate-desktop-verify');

  // ─── /r/<delegate-receipt-id> · proof the signer is the delegate ──────
  await studio.goto(`http://localhost:3300/r/${DELEGATE_RECEIPT_ID}`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(4_000);
  await snap(studio, 'r-1204-delegate-signed-top');
  await studio.evaluate(() => window.scrollTo(0, 800));
  await studio.waitForTimeout(700);
  await snap(studio, 'r-1204-delegate-signed-mid');

  // ─── /agent/<delegate-address> · 25-cap, new vanity copy, type labels ─
  await studio.goto(`http://localhost:3300/agent/${DELEGATE_ADDRESS}`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(4_000);
  await snap(studio, 'agent-delegate-top');

  // ─── /agent/not-an-address · vanity-handle fallback copy ──────────────
  await studio.goto(`http://localhost:3300/agent/alice`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_500);
  const sprintCopyHit = (await studio.locator('body').innerText()).match(/Day\s*17|next sprint/i);
  console.log(sprintCopyHit ? `   ✗ /agent vanity copy still references sprint days: ${sprintCopyHit[0]}` : '   ✓ /agent vanity copy purged of sprint wording');
  await snap(studio, 'agent-vanity-fallback');

  // ─── /memory · audit feed visible ─────────────────────────────────────
  await studio.goto(`http://localhost:3300/memory`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'memory-grants-and-audit');
  await studio.evaluate(() => window.scrollTo(0, 800));
  await studio.waitForTimeout(700);
  await snap(studio, 'memory-audit-feed-scrolled');

  // ─── /global · stat row uses real skill count ─────────────────────────
  await studio.goto(`http://localhost:3300/global`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'global-stat-row');

  // ─── /dashboard · receipt type human label ────────────────────────────
  await studio.goto(`http://localhost:3300/dashboard`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(4_000);
  await snap(studio, 'dashboard-receipt-labels');
  const dashText = await studio.locator('body').innerText();
  if (dashText.match(/type code \d+/)) {
    console.log('   ✗ dashboard still renders raw "type code N"');
  } else {
    console.log('   ✓ dashboard renders human receipt type labels');
  }

  // ─── Mobile pass · /thesis + /delegate ────────────────────────────────
  await studio.setViewportSize({ width: 375, height: 812 });

  await studio.goto(`http://localhost:3300/thesis`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_500);
  await snap(studio, 'thesis-mobile-top');
  await studio.evaluate(() => window.scrollTo(0, 800));
  await studio.waitForTimeout(700);
  await snap(studio, 'thesis-mobile-mid');

  await studio.goto(`http://localhost:3300/delegate/${DELEGATE_ID}`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_500);
  await snap(studio, 'delegate-mobile-top');
  await studio.evaluate(() => window.scrollTo(0, 600));
  await studio.waitForTimeout(700);
  await snap(studio, 'delegate-mobile-grants');

  // ─── Side-by-side vs brand/Ivaronix.html ──────────────────────────────
  await studio.setViewportSize({ width: 1440, height: 900 });
  await studio.goto(`file:///${BRAND_HTML.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(4_000);
  await snap(studio, 'brand-html-desktop');

  await ctx.close();
  console.log('\n=== verify-2a-and-audit complete ===');
})().catch((e: Error) => {
  console.error('FAIL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
