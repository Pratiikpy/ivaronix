// E2E verification for planning-01 §3B (visual skill creator).
// Loads /skill/new at desktop + mobile. Verifies the form renders + the
// live SKILL.md preview updates as fields change. Exercises the
// /api/skill/save endpoint with a unique skill id and confirms the file
// lands on disk. No MetaMask required.

import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const SHOTS_DIR = resolve(REPO, 'screenshots', '3b-skill-builder');
mkdirSync(SHOTS_DIR, { recursive: true });

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const name = `${String(stepNum).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   ${name}`);
  } catch (e) {
    console.log(`   skipped ${name}: ${(e as Error).message.slice(0, 80)}`);
  }
}

async function visit(page: Page, path: string, settleMs = 4_000): Promise<void> {
  await page.goto(`http://localhost:3300${path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(settleMs);
}

(async () => {
  // Pre-clean any leftover skill from a prior run
  const testSkillId = 'qa-test-skill-3b';
  const expectedSkillDir = resolve(REPO, '.ivaronix', 'skills', testSkillId);
  if (existsSync(expectedSkillDir)) {
    rmSync(expectedSkillDir, { recursive: true, force: true });
  }

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: SHOTS_DIR, size: { width: 1440, height: 900 } },
  });
  ctx.setDefaultTimeout(60_000);
  ctx.setDefaultNavigationTimeout(120_000);
  const page = await ctx.newPage();

  // Desktop · /skill/new
  console.log('=== /skill/new · desktop ===');
  await visit(page, '/skill/new', 4_000);
  await snap(page, 'skill-new-desktop-top');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(700);
  await snap(page, 'skill-new-desktop-mid');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  await snap(page, 'skill-new-desktop-bottom');

  // Voice + content checks
  const text = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  const checks: Array<[string, RegExp]> = [
    ['form headline rendered', /Compose a skill/i],
    ['live preview block', /live preview · SKILL\.md/i],
    ['fee split slider label', /fee split · creator/i],
    ['system prompt field', /system prompt/i],
    ['phase B publish disclosure', /publish.*Phase B|wallet-side signing/i],
  ];
  for (const [label, rx] of checks) console.log(rx.test(text) ? `   ✓ ${label}` : `   ✗ ${label}`);

  // Edit fields → confirm live preview updates
  await page.locator('input[type="text"]').first().fill(testSkillId);
  await page.waitForTimeout(400);
  await page.locator('textarea').nth(1).fill('You audit smart-contract storage layouts. Output a list of dangerous patterns: missing access controls, slot overlap, uninit storage. Cap at 5 items.');
  await page.waitForTimeout(400);
  await snap(page, 'skill-new-after-edits');

  // Verify the preview reflects the change
  const previewText = await page.locator('pre').first().innerText().catch(() => '');
  console.log(previewText.includes(testSkillId) ? '   ✓ preview reflects skill id' : '   ✗ preview did not update');
  console.log(previewText.includes('storage layouts') ? '   ✓ preview reflects system prompt' : '   ✗ preview prompt missing');

  // Click "Save manifest locally"
  await page.locator('button:has-text("Save manifest")').first().click();
  // Wait until the button text flips from "Saving…" to "Saved ✓" (or
  // until the error message renders).
  await page.waitForFunction(
    () => /Saved ✓|save failed/i.test(document.body.innerText || ''),
    { timeout: 30_000 },
  ).catch(() => console.log('   (save completion wait timed out)'));
  await page.waitForTimeout(800);
  await snap(page, 'skill-new-after-save');

  // Confirm the file landed on disk
  const expectedFile = resolve(expectedSkillDir, 'SKILL.md');
  if (existsSync(expectedFile)) {
    console.log(`   ✓ SKILL.md written to ${expectedFile}`);
    const body = readFileSync(expectedFile, 'utf8');
    if (body.includes(testSkillId) && body.includes('storage layouts')) {
      console.log('   ✓ saved manifest contains the form values');
    } else {
      console.log('   ✗ saved manifest is missing form values');
    }
  } else {
    console.log(`   ✗ SKILL.md not at ${expectedFile}`);
  }

  // Mobile pass
  await page.setViewportSize({ width: 375, height: 812 });
  await visit(page, '/skill/new', 3_500);
  await snap(page, 'skill-new-mobile-top');
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(700);
  await snap(page, 'skill-new-mobile-form');

  // Cleanup the test skill so it doesn't pollute /skills
  if (existsSync(expectedSkillDir)) rmSync(expectedSkillDir, { recursive: true, force: true });
  console.log(`   cleanup: removed ${expectedSkillDir}`);

  await ctx.close();
  await browser.close();
  console.log('\n=== verify-3b complete ===');
})().catch((e: Error) => { console.error('FAIL:', e.message); console.error(e.stack); process.exit(1); });
