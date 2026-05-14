import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/multi-wallet/passport-mint');
mkdirSync(resolve(OUT, 'studio-surface', 'desktop'), { recursive: true });
mkdirSync(resolve(OUT, 'studio-surface', 'mobile'), { recursive: true });
mkdirSync(resolve(OUT, 'videos'), { recursive: true });

const ALICE = '0xa2c07364eD010b0884d2adc51f4e18eB3900c748';
let n = 0;
async function snap(page: Page, label: string, viewport: 'desktop' | 'mobile'): Promise<void> {
  n++;
  const name = `${String(n).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  await page.screenshot({ path: resolve(OUT, 'studio-surface', viewport, name), fullPage: false });
  console.log(`   📸 ${viewport} ${name}`);
}

async function driveAtViewport(viewport: 'desktop' | 'mobile'): Promise<void> {
  const size = viewport === 'desktop' ? { width: 1440, height: 900 } : { width: 375, height: 812 };
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: resolve(OUT, 'videos'), size } });
  const page = await ctx.newPage();
  try {
    // /agents listing (public)
    await page.goto(`${STUDIO}/agents`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(2000);
    await snap(page, 'agents-listing', viewport);

    // /agent/<alice> detail
    await page.goto(`${STUDIO}/agent/${ALICE}`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(2000);
    await snap(page, 'agent-alice-profile', viewport);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(1000);
    await snap(page, 'agent-alice-mid-scroll', viewport);
  } finally {
    await ctx.close();
    await browser.close();
  }
}

async function main(): Promise<void> {
  console.log(`Studio: ${STUDIO}`);
  console.log(`alice:  ${ALICE}\n`);
  console.log(`=== desktop 1440x900 ===`);
  await driveAtViewport('desktop');
  console.log(`\n=== mobile 375x812 ===`);
  n = 0;
  await driveAtViewport('mobile');
}

main().catch((err) => { console.error('FAIL:', err.message ?? err); process.exit(1); });
