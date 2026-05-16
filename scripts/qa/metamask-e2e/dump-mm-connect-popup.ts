/**
 * MM v13.30 connect-popup DOM dumper.
 *
 * Launches Chromium + MM, opens Studio, clicks Connect, then when the
 * MM popup appears, captures full HTML + button-by-button properties
 * to a JSON file. Future driver iterations use this dump to lock onto
 * the exact selectors instead of guessing.
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PASSWORD = 'TestPass123!QA';
const EXT_PATH = resolve(HERE, 'mm', 'extension');
const SOURCE_PROFILE = resolve(HERE, 'mm', 'profile');
const STUDIO = 'https://www.ivaronix.xyz';
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-popup-dump');
mkdirSync(OUT, { recursive: true });

function log(m: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
}

(async () => {
  const tmpProfile = resolve(REPO, '.popup-dump-profile');
  if (existsSync(tmpProfile)) rmSync(tmpProfile, { recursive: true, force: true });
  const { cpSync } = await import('node:fs');
  log(`Cloning MM profile`);
  cpSync(SOURCE_PROFILE, tmpProfile, { recursive: true });

  const ctx = await chromium.launchPersistentContext(tmpProfile, {
    headless: false,
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
    viewport: { width: 1440, height: 900 },
  });
  log(`Chromium launched`);

  let extId = '';
  for (let i = 0; i < 10; i++) {
    const sw = ctx.serviceWorkers().find((w) => w.url().includes('chrome-extension://'));
    if (sw) { extId = sw.url().split('/')[2]; log(`MM extId: ${extId}`); break; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!extId) { log('MM SW not found'); process.exit(1); }

  const mm = await ctx.newPage();
  await mm.goto(`chrome-extension://${extId}/home.html`);
  await mm.waitForTimeout(3000);
  const pwInput = mm.locator('input[type="password"]').first();
  if (await pwInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pwInput.fill(PASSWORD);
    const unlockBtn = mm.locator('button:has-text("Unlock"), button[data-testid="unlock-submit"]').first();
    if (await unlockBtn.isVisible({ timeout: 3000 }).catch(() => false)) await unlockBtn.click();
    await mm.waitForTimeout(3000);
    log('MM unlocked');
  }
  await mm.screenshot({ path: resolve(OUT, '01-mm-unlocked.png') });

  // Open Studio
  const studio = await ctx.newPage();
  log(`Studio: ${STUDIO}`);
  await studio.goto(STUDIO, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await studio.waitForTimeout(5000);
  await studio.screenshot({ path: resolve(OUT, '02-studio-loaded.png') });

  // Click Connect
  const known = new Set(ctx.pages());
  const connectBtn = studio.locator('button:has-text("Connect"), a:has-text("Connect Wallet")').first();
  await connectBtn.click({ timeout: 5000 });
  log('Connect clicked, waiting for popup...');

  // Wait for popup
  let popup = null;
  for (let i = 0; i < 30; i++) {
    for (const p of ctx.pages()) {
      if (known.has(p)) continue;
      if (p.url().includes(extId)) { popup = p; break; }
    }
    if (popup) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!popup) { log('NO POPUP appeared after Connect click'); await ctx.close(); process.exit(1); }
  log(`Popup detected: ${popup.url()}`);

  // Wait for popup to be fully rendered
  await popup.waitForTimeout(3000);
  await popup.screenshot({ path: resolve(OUT, '03-popup-rendered.png'), fullPage: true });

  // DUMP — capture all buttons with their properties
  const popupHtml = await popup.content();
  writeFileSync(resolve(OUT, 'popup.html'), popupHtml);
  log(`HTML written: ${popupHtml.length} bytes`);

  const buttonInfo = await popup.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
    return all.map((b, idx) => ({
      idx,
      text: b.textContent?.trim().slice(0, 100) || '',
      visible: b.offsetParent !== null,
      disabled: b.disabled,
      testid: b.getAttribute('data-testid'),
      ariaLabel: b.getAttribute('aria-label'),
      className: b.className.slice(0, 100),
      type: b.type,
      rect: { x: Math.round(b.getBoundingClientRect().x), y: Math.round(b.getBoundingClientRect().y), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) },
    }));
  });
  writeFileSync(resolve(OUT, 'buttons.json'), JSON.stringify(buttonInfo, null, 2));
  log(`Found ${buttonInfo.length} buttons. Dumped to buttons.json`);

  // Also dump all inputs (account checkboxes etc.)
  const inputInfo = await popup.evaluate(() => {
    const all = Array.from(document.querySelectorAll('input, [role="checkbox"]')) as HTMLElement[];
    return all.map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: (el as HTMLInputElement).type ?? null,
      checked: (el as HTMLInputElement).checked ?? null,
      testid: el.getAttribute('data-testid'),
      ariaLabel: el.getAttribute('aria-label'),
      className: el.className.slice(0, 100),
      rect: { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) },
    }));
  });
  writeFileSync(resolve(OUT, 'inputs.json'), JSON.stringify(inputInfo, null, 2));
  log(`Found ${inputInfo.length} inputs/checkboxes`);

  // Print the most likely primary buttons
  log('=== VISIBLE NON-DISABLED BUTTONS ===');
  for (const b of buttonInfo.filter((x) => x.visible && !x.disabled)) {
    log(`  [${b.idx}] testid=${b.testid ?? '(none)'} text="${b.text.slice(0, 40)}" rect=${JSON.stringify(b.rect)}`);
  }

  log('Sleeping 8s for visual inspection, then closing');
  await new Promise((r) => setTimeout(r, 8000));
  await ctx.close();
  log('DONE');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
