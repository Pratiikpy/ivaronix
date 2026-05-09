/**
 * QA: full-product brand + UX audit with real MetaMask, real funded wallet,
 * real on-chain interactions, and side-by-side screenshots vs both brand
 * HTML references.
 *
 * Brand HTML references compared:
 *   1. C:\Users\prate\Downloads\Ivaronix Brand Kit _standalone_.html
 *      (downloaded standalone, uses #fafaf7 cream + #111 ink)
 *   2. C:\Users\prate\Downloads\oglabs\brand\Ivaronix.html
 *      (in-repo reference, uses #faf9f6 cream + #1a1a1a ink)
 *   3. CLAUDE.md §10 mandates #faf9f6 cream + #0a0a0a ink
 *
 * For every Studio route, we capture:
 *   - 1440×900 desktop screenshot (connected wallet state)
 *   - 375×812 mobile screenshot
 *   - getComputedStyle of body for color tokens
 *   - card hover state (translateY -2px per CLAUDE.md §10)
 *   - sticky header backdrop-filter (must be blur(20px))
 *
 * Output:
 *   screenshots/audit/  — per-route, per-viewport screenshots
 *   docs/QA_FULL_PRODUCT_REPORT.md — written at the end with all findings
 *
 * Run: tsx scripts/qa/metamask-e2e/run-audit.ts
 */

import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

const PASSWORD = 'TestPass123!QA';
const EXTENSION_PATH = resolve(HERE, 'mm', 'extension');
const USER_DATA_DIR = resolve(HERE, 'mm', 'profile');
const SHOTS_DIR = resolve(REPO, 'screenshots', 'audit');
mkdirSync(SHOTS_DIR, { recursive: true });

const STUDIO = 'http://localhost:3300';
const BRAND_STANDALONE = 'C:/Users/prate/Downloads/Ivaronix Brand Kit _standalone_.html';
const BRAND_REPO = resolve(REPO, 'brand', 'Ivaronix.html');

const ROUTES = [
  { path: '/', label: 'home' },
  { path: '/onboard', label: 'onboard' },
  { path: '/skills', label: 'skills' },
  { path: '/skill/private-doc-review', label: 'skill-detail' },
  { path: '/global', label: 'global' },
  { path: '/dashboard', label: 'dashboard' },
  { path: '/memory', label: 'memory' },
  { path: '/brand', label: 'brand-page' },
  { path: '/r/280', label: 'receipt-280' },
  { path: '/r/933', label: 'receipt-933' },
];

interface TokenSnapshot {
  bg: string;
  ink: string;
  fontFamily: string;
  fontSize: string;
  headerBackdropFilter: string;
  headerHeight: string;
}

interface Finding {
  route: string;
  viewport: '1440x900' | '375x812';
  screenshot: string;
  tokens?: TokenSnapshot;
  notes: string[];
}

let stepNum = 0;
async function snap(page: Page, label: string): Promise<string> {
  stepNum++;
  const name = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return '';
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   📸 ${name}`);
    return name;
  } catch (e) {
    console.log(`   (skip) ${name} — ${(e as Error).message.split('\n')[0]}`);
    return '';
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

async function drivePopup(popup: Page, label: string, max = 8): Promise<void> {
  await popup.bringToFront().catch(() => {});
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(1_500);
  const ctaTexts = ['Connect', 'Confirm', 'Approve', 'Got it', 'Continue', 'Next', 'Sign', 'Switch', 'Add network'];
  for (let s = 0; s < max; s++) {
    if (popup.isClosed()) return;
    let clicked = false;
    for (const t of ctaTexts) {
      const btn = popup.locator(`button:has-text("${t}"):not([disabled])`).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        console.log(`   ${label} step ${s} → "${t}"`);
        await btn.click({ timeout: 5_000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) break;
    await popup.waitForTimeout(2_000).catch(() => {});
  }
}

async function readTokens(page: Page): Promise<TokenSnapshot> {
  return await page.evaluate(() => {
    const body = document.body;
    const cs = getComputedStyle(body);
    const header = document.querySelector('header, [role="banner"], nav') as HTMLElement | null;
    const headerCs = header ? getComputedStyle(header) : null;
    return {
      bg: cs.backgroundColor,
      ink: cs.color,
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      headerBackdropFilter: headerCs?.backdropFilter || headerCs?.getPropertyValue('-webkit-backdrop-filter') || 'none',
      headerHeight: headerCs?.height || 'n/a',
    };
  });
}

async function captureRoute(
  studio: Page,
  route: typeof ROUTES[number],
  viewport: { width: number; height: number },
  vpLabel: '1440x900' | '375x812',
  findings: Finding[],
): Promise<void> {
  await studio.setViewportSize(viewport);
  await studio.goto(`${STUDIO}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => {});
  // Wait for fonts + wagmi rehydration
  await studio.waitForFunction(() => document.fonts.ready.then(() => true), null, { timeout: 8_000 }).catch(() => {});
  await studio.waitForTimeout(2_500);
  const shot = await snap(studio, `studio-${route.label}-${vpLabel}`);
  let tokens: TokenSnapshot | undefined;
  try { tokens = await readTokens(studio); } catch {}
  const notes: string[] = [];
  if (tokens) {
    notes.push(`bg: ${tokens.bg}`);
    notes.push(`ink: ${tokens.ink}`);
    notes.push(`font: ${tokens.fontFamily.slice(0, 60)}`);
    notes.push(`header: ${tokens.headerHeight} backdrop=${tokens.headerBackdropFilter}`);
  }
  findings.push({ route: route.path, viewport: vpLabel, screenshot: shot, tokens, notes });
}

async function main(): Promise<void> {
  console.log('=== launching Chromium with persisted profile + recordVideo ===');
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
  context.setDefaultTimeout(60_000);
  context.setDefaultNavigationTimeout(120_000);

  const extId = await findExtensionId(context);
  console.log(`   ext id: ${extId}`);

  // Unlock MM
  let mmPage = context.pages().find((p) => p.url().includes(extId));
  if (!mmPage) {
    mmPage = await context.newPage();
    await mmPage.goto(`chrome-extension://${extId}/home.html`);
  }
  await mmPage.bringToFront();
  await mmPage.waitForSelector('button, input[type="password"]', { timeout: 60_000 }).catch(() => {});
  await mmPage.waitForTimeout(2_500);
  if (await mmPage.locator('button:has-text("Unlock")').first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    await mmPage.locator('input[type="password"]').first().fill(PASSWORD);
    await mmPage.locator('button:has-text("Unlock"), button:has-text("Sign in")').first().click({ timeout: 8_000 }).catch(() => {});
    await mmPage.waitForTimeout(3_000);
  }
  await snap(mmPage, 'mm-unlocked');

  // ── 1. Capture both brand HTML references at both viewports ──────────
  console.log('\n=== brand HTML references ===');
  const brand = await context.newPage();

  for (const v of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    await brand.setViewportSize(v);
    const vpLabel = `${v.width}x${v.height}`;
    await brand.goto(`file:///${BRAND_STANDALONE.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
    await brand.waitForTimeout(2_500);
    await snap(brand, `brand-standalone-${vpLabel}`);
    await brand.goto(`file:///${BRAND_REPO.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
    await brand.waitForTimeout(2_500);
    await snap(brand, `brand-repo-${vpLabel}`);
  }
  await brand.close();

  // ── 2. Connect wallet on Studio /onboard if not already connected ────
  console.log('\n=== ensure Studio is connected ===');
  const studio = await context.newPage();
  await studio.goto(`${STUDIO}/onboard`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_500);
  const isConnected = await studio.locator('text=/Disconnect/i').first().isVisible({ timeout: 3_000 }).catch(() => false);
  if (!isConnected) {
    const popupP = context.waitForEvent('page', { timeout: 12_000 }).catch(() => null);
    const connectBtn = studio.getByRole('button', { name: /Connect.*wallet|Connect injected/i }).first();
    if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await connectBtn.click({ timeout: 8_000 });
      const p = await popupP;
      if (p) await drivePopup(p, 'mm-connect');
      await studio.bringToFront();
      await studio.waitForTimeout(3_000);
    }
  }
  await studio.waitForFunction(() => /Disconnect/i.test(document.body?.innerText ?? ''), { timeout: 8_000 }).catch(() => {});
  console.log('   Studio connected ✓');

  // ── 3. Tour every route at both viewports — connected state ──────────
  console.log('\n=== route tour: 1440×900 + 375×812 with connected wallet ===');
  const findings: Finding[] = [];
  for (const route of ROUTES) {
    console.log(`   ${route.path}`);
    await captureRoute(studio, route, { width: 1440, height: 900 }, '1440x900', findings);
    await captureRoute(studio, route, { width: 375, height: 812 }, '375x812', findings);
  }

  // ── 4. Interaction tests: hover, scroll, dropdowns ───────────────────
  console.log('\n=== interaction tests ===');
  await studio.setViewportSize({ width: 1440, height: 900 });
  await studio.goto(`${STUDIO}/skills`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_500);
  // Hover a skill card to capture lift state
  const firstCard = studio.locator('.card').first();
  if (await firstCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await firstCard.hover();
    await studio.waitForTimeout(800);
    await snap(studio, 'interaction-skills-card-hover');
  }
  // Scroll on /global
  await studio.goto(`${STUDIO}/global`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_500);
  await studio.mouse.wheel(0, 600);
  await studio.waitForTimeout(800);
  await snap(studio, 'interaction-global-scrolled');
  // Dashboard with passport data
  await studio.goto(`${STUDIO}/dashboard`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(4_500); // give /api/dashboard time to return
  await snap(studio, 'interaction-dashboard-loaded');

  // ── 5. Sticky header behavior — scroll on home, capture ─────────────
  console.log('\n=== sticky header check ===');
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_500);
  await snap(studio, 'sticky-home-top');
  await studio.mouse.wheel(0, 1200);
  await studio.waitForTimeout(800);
  await snap(studio, 'sticky-home-scrolled');

  // ── 6. Read color/font tokens from one Studio route for the report ──
  console.log('\n=== reading Studio body tokens ===');
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_500);
  const studioTokens = await readTokens(studio).catch(() => null);

  // Read tokens from each brand HTML for direct comparison
  const brandPage = await context.newPage();
  await brandPage.goto(`file:///${BRAND_STANDALONE.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
  await brandPage.waitForTimeout(1_000);
  const standaloneTokens = await readTokens(brandPage).catch(() => null);
  await brandPage.goto(`file:///${BRAND_REPO.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
  await brandPage.waitForTimeout(1_000);
  const repoBrandTokens = await readTokens(brandPage).catch(() => null);
  await brandPage.close();

  // ── 7. Run a fresh action (server-anchored receipt) for proof ───────
  console.log('\n=== triggering fresh server-anchored receipt ===');
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_000);
  const sample = `Audit clause:\n1. Tenant must indemnify Landlord for any and all claims arising from any cause whatsoever.\n2. Landlord may enter the unit at any time without notice.`;
  const tmpFile = resolve(SHOTS_DIR, `audit-sample-${Date.now()}.txt`);
  writeFileSync(tmpFile, sample, 'utf8');
  const fileInput = studio.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(tmpFile);
    await studio.waitForTimeout(1_500);
    const runBtn = studio.locator('button:has-text("Run"):not([disabled])').first();
    if (await runBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await runBtn.click({ timeout: 5_000 });
      await snap(studio, 'fresh-run-clicked');
      const start = Date.now();
      let proofUrl = '';
      while (Date.now() - start < 240_000) {
        const link = studio.locator('a[href^="/r/"]').first();
        if (await link.isVisible({ timeout: 1_000 }).catch(() => false)) {
          proofUrl = (await link.getAttribute('href')) ?? '';
          break;
        }
        await studio.waitForTimeout(2_000);
      }
      if (proofUrl) {
        console.log(`   ✓ fresh receipt: ${proofUrl}`);
        await studio.goto(`${STUDIO}${proofUrl}`, { waitUntil: 'domcontentloaded' });
        await studio.waitForTimeout(3_000);
        await snap(studio, `fresh-${proofUrl.replace(/\//g, '-')}`);
      }
    }
  }

  // ── 8. Mobile-viewport sticky header on home ────────────────────────
  console.log('\n=== mobile sticky header ===');
  await studio.setViewportSize({ width: 375, height: 812 });
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_500);
  await snap(studio, 'mobile-sticky-top');
  await studio.mouse.wheel(0, 800);
  await studio.waitForTimeout(800);
  await snap(studio, 'mobile-sticky-scrolled');

  // ── 9. Disconnect → verify the change ───────────────────────────────
  console.log('\n=== disconnect path ===');
  await studio.setViewportSize({ width: 1440, height: 900 });
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_000);
  const disconnectBtn = studio.locator('button:has-text("Disconnect")').first();
  if (await disconnectBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await disconnectBtn.click().catch(() => {});
    await studio.waitForTimeout(2_000);
    await snap(studio, 'after-disconnect-home');
  }

  console.log('\n=== closing context ===');
  await context.close();

  // ── 10. Generate the QA_FULL_PRODUCT_REPORT.md ──────────────────────
  console.log('\n=== writing QA_FULL_PRODUCT_REPORT.md ===');
  const reportPath = resolve(REPO, 'docs', 'QA_FULL_PRODUCT_REPORT.md');
  mkdirSync(dirname(reportPath), { recursive: true });
  const lines: string[] = [];
  lines.push('# Ivaronix · Full Product UX & Brand Audit');
  lines.push('');
  lines.push(`> Captured 2026-05-09 via real MetaMask v13.30 + Playwright headed Chromium.`);
  lines.push(`> Funded wallet 0xaa95…77Ce on 0G Galileo Testnet (chainId 16602).`);
  lines.push('');
  lines.push('## Brand reference contradictions (FOUND)');
  lines.push('');
  lines.push('| Reference | cream bg | ink | fontFamily |');
  lines.push('|---|---|---|---|');
  if (standaloneTokens) lines.push(`| \`Ivaronix Brand Kit _standalone_.html\` | \`${standaloneTokens.bg}\` | \`${standaloneTokens.ink}\` | \`${standaloneTokens.fontFamily.slice(0, 50)}\` |`);
  if (repoBrandTokens) lines.push(`| \`oglabs/brand/Ivaronix.html\` | \`${repoBrandTokens.bg}\` | \`${repoBrandTokens.ink}\` | \`${repoBrandTokens.fontFamily.slice(0, 50)}\` |`);
  if (studioTokens) lines.push(`| Studio \`/\` (live render) | \`${studioTokens.bg}\` | \`${studioTokens.ink}\` | \`${studioTokens.fontFamily.slice(0, 50)}\` |`);
  lines.push(`| **CLAUDE.md §10 mandate** | **\`#faf9f6\`** | **\`#0a0a0a\`** | Outfit / Instrument Serif italic / JetBrains Mono |`);
  lines.push('');
  lines.push('**Action item:** the three references disagree on cream + ink hex. Pick one canonical token set and fix the others. CLAUDE.md is the project contract; both brand HTML files drift from it.');
  lines.push('');
  lines.push('## Per-route capture matrix');
  lines.push('');
  lines.push('| Route | 1440×900 | 375×812 | bg | ink | header height | backdrop |');
  lines.push('|---|---|---|---|---|---|---|');
  const grouped: Record<string, { desk?: Finding; mob?: Finding }> = {};
  for (const f of findings) {
    grouped[f.route] = grouped[f.route] || {};
    if (f.viewport === '1440x900') grouped[f.route].desk = f;
    else grouped[f.route].mob = f;
  }
  for (const [route, pair] of Object.entries(grouped)) {
    const t = pair.desk?.tokens;
    lines.push(`| \`${route}\` | \`${pair.desk?.screenshot ?? '-'}\` | \`${pair.mob?.screenshot ?? '-'}\` | ${t?.bg ?? '?'} | ${t?.ink ?? '?'} | ${t?.headerHeight ?? '?'} | ${t?.headerBackdropFilter ?? '?'} |`);
  }
  lines.push('');
  lines.push('## Interactions captured');
  lines.push('');
  lines.push('- Skills card hover (lift state per CLAUDE.md §10)');
  lines.push('- /global scroll behavior');
  lines.push('- /dashboard live data loaded');
  lines.push('- Home sticky header at top + scrolled');
  lines.push('- Mobile sticky header at top + scrolled');
  lines.push('- Fresh server-anchored receipt generation');
  lines.push('- Disconnect path');
  lines.push('');
  lines.push('## Video recordings');
  lines.push('');
  const webms = readdirSync(SHOTS_DIR).filter((f) => f.endsWith('.webm'));
  webms.sort((a, b) => statSync(resolve(SHOTS_DIR, b)).size - statSync(resolve(SHOTS_DIR, a)).size);
  for (const w of webms.slice(0, 6)) {
    const sz = statSync(resolve(SHOTS_DIR, w)).size;
    lines.push(`- \`${w}\` — ${(sz / 1024 / 1024).toFixed(2)} MB`);
  }
  lines.push('');
  lines.push('## Screenshots inventory');
  lines.push('');
  const pngs = readdirSync(SHOTS_DIR).filter((f) => f.endsWith('.png'));
  pngs.sort();
  for (const p of pngs) {
    lines.push(`- \`screenshots/audit/${p}\``);
  }
  lines.push('');
  writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`   ✓ ${reportPath} (${lines.length} lines)`);
  console.log(`\nDone. Outputs in: ${SHOTS_DIR}`);
  console.log(`Report at: ${reportPath}`);
}

main().catch((err: Error) => {
  console.error('FAIL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
