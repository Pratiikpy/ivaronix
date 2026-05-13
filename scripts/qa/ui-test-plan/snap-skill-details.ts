/**
 * Capture /marketplace/<hex> for each first-party skill so we have
 * visual proof that the slug-name + description fix works across all
 * 6 skills, not just private-doc-review.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { keccak256, toUtf8Bytes } from 'ethers';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P5-marketplace/skill-details');
mkdirSync(OUT, { recursive: true });

const SLUGS = [
  '0g-integration-auditor',
  'code-edit',
  'content-pitch-review',
  'github-audit',
  'plan-step',
  'private-doc-review',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const slug of SLUGS) {
    const hex = keccak256(toUtf8Bytes(`skill:${slug}`));
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`https://ivaronix.vercel.app/marketplace/${hex}`, { waitUntil: 'load', timeout: 30_000 });
      await page.waitForTimeout(2_000);
      const out = resolve(OUT, `marketplace-${slug}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`📸 ${slug}: ${out}`);
    } catch (e) {
      console.log(`✗ ${slug}: ${(e as Error).message.split('\n')[0]}`);
    } finally {
      await ctx.close();
    }
  }
  await browser.close();
})();
