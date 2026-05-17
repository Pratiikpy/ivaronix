/**
 * Hit the production marketplace pages for legal-citation + term-sheet and capture
 * the current rendered state. The error message after Bug-76 fix should reveal
 * what's blocking the pipeline now.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'rabby-100pct-coverage', 'post-fix-state');
mkdirSync(OUT, { recursive: true });

const STUDIO = 'https://www.ivaronix.xyz';
const PAGES = [
  { slug: 'legal-citation-verifier', id: '0x6244e5bd1812eb26d3e1cf702b0edcdd51b172a3b4a28127b11038463a12e4b3' },
  { slug: 'term-sheet-risk-scanner', id: '0x3c79581eddfefe4218a8d177a5fe19b2f473f4dc70c4d7f1deb8efc5fd8d0f0a' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  for (const { slug, id } of PAGES) {
    const page = await ctx.newPage();
    await page.goto(`${STUDIO}/marketplace/${id}`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(3_000);
    await page.screenshot({ path: resolve(OUT, `${slug}-initial.png`), fullPage: true });
    // grab any error text
    const errorText = await page.locator('text=/Error|fail|MISMATCH|tampered|PIPELINE/i').allTextContents();
    console.log(`${slug}: error text found = ${JSON.stringify(errorText)}`);
    const fullText = await page.locator('main, body').innerText({ timeout: 5_000 }).catch(() => '');
    console.log(`${slug}: page body snippet (first 800 chars):`);
    console.log(fullText.slice(0, 800));
    console.log('---');
    await page.close();
  }
  await browser.close();
})();
