/**
 * Capture /skill/<slug> for all 6 first-party skills — the deep profile
 * page that shows full manifest data + permissions + on-chain status.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P8-skills/slug-profiles');
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
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`https://ivaronix.vercel.app/skill/${slug}`, { waitUntil: 'load', timeout: 30_000 });
      await page.waitForTimeout(2_500);
      await page.screenshot({ path: resolve(OUT, `${slug}.png`), fullPage: false });
      console.log(`📸 ${slug}: ${slug}.png`);
    } catch (e) {
      console.log(`✗ ${slug}: ${(e as Error).message.split('\n')[0]}`);
    } finally {
      await ctx.close();
    }
  }
  await browser.close();
})();
