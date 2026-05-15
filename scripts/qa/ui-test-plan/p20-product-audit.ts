/**
 * Priority 20 · Post-green product UI upgrade gate.
 *
 * Captures every shipped Studio route at desktop 1440×900 AND mobile
 * 375×812 (per plan §B "Mobile landing still explains the full product").
 * The agent then Reads each capture and writes a 1-sentence audit
 * against the §A/§B/§B2 criteria. Output: QA_PROOF_PACK/ui/P20-audit/.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P20-audit');
mkdirSync(resolve(OUT, 'desktop'), { recursive: true });
mkdirSync(resolve(OUT, 'mobile'), { recursive: true });

const ROUTES: Array<[string, string]> = [
  ['/', 'landing'],
  ['/onboard', 'onboard'],
  ['/marketplace', 'marketplace'],
  ['/marketplace/payouts', 'marketplace-payouts'],
  ['/memory', 'memory'],
  ['/agents', 'agents'],
  ['/dashboard', 'dashboard'],
  ['/global', 'global'],
  ['/thesis', 'thesis'],
  ['/0g', '0g'],
  ['/skills', 'skills'],
  ['/r/1004', 'receipt-v1'],
  ['/r/32', 'receipt-v2'],
  ['/r/1', 'receipt-v3'],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const [path, name] of ROUTES) {
    for (const [vw, label, dir] of [
      [1440, 'desktop', 'desktop'],
      [375, 'mobile', 'mobile'],
    ] as const) {
      const ctx = await browser.newContext({
        viewport: { width: vw as number, height: vw === 1440 ? 900 : 812 },
      });
      const page = await ctx.newPage();
      try {
        await page.goto(`https://ivaronix.vercel.app${path}`, { waitUntil: 'load', timeout: 30_000 });
        await page.waitForTimeout(2_000);
        const out = resolve(OUT, dir, `${name}.png`);
        await page.screenshot({ path: out, fullPage: false });
        console.log(`📸 ${label} ${path}: ${name}.png`);
      } catch (e) {
        console.log(`✗ ${label} ${path}: ${(e as Error).message.split('\n')[0]}`);
      } finally {
        await ctx.close();
      }
    }
  }
  await browser.close();
})();
