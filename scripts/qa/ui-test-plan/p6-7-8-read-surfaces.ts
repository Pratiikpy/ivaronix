/**
 * UI_REAL_USER_TEST_PLAN.md P6 Memory · P7 Agent · P8 Skills
 * Read-only surfaces · no MM popup driving needed.
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const OPERATOR = '0xaa954c33810029a3eFb0bf755FEF17863E8677Ce';

const ROUTES: Array<{ priority: string; route: string; label: string }> = [
  // P6 Memory
  { priority: 'P6-memory', route: '/memory', label: 'memory-gated' },
  // P7 Agent
  { priority: 'P7-agent', route: '/onboard', label: 'onboard' },
  { priority: 'P7-agent', route: '/dashboard', label: 'dashboard-gated' },
  { priority: 'P7-agent', route: '/agents', label: 'agents-leaderboard' },
  { priority: 'P7-agent', route: `/agent/${OPERATOR}`, label: 'agent-profile' },
  // P8 Skills
  { priority: 'P8-skills', route: '/skills', label: 'skills-index' },
  { priority: 'P8-skills', route: '/skill/private-doc-review', label: 'skill-detail' },
  { priority: 'P8-skills', route: '/skill/new', label: 'skill-new-gated' },
  // P9 Data room / Delegate (placeholders)
  { priority: 'P9-data-room', route: '/data-room/test', label: 'data-room-invalid' },
  { priority: 'P9-delegate', route: '/delegate/test', label: 'delegate-invalid' },
  // P10 Docs / 0G / Legal
  { priority: 'P10-docs', route: '/0g', label: '0g-page' },
  { priority: 'P10-docs', route: '/docs', label: 'docs-page' },
  { priority: 'P10-docs', route: '/privacy', label: 'privacy-page' },
  { priority: 'P10-docs', route: '/terms', label: 'terms-page' },
  { priority: 'P10-docs', route: '/brand', label: 'brand-page' },
  { priority: 'P10-docs', route: '/thesis', label: 'thesis-page' },
];

const SHOTS_BASE = resolve(REPO, 'QA_PROOF_PACK/ui/P6-P10-read-surfaces');

async function captureViewport(viewport: 'desktop' | 'mobile'): Promise<void> {
  const size = viewport === 'desktop' ? { width: 1440, height: 900 } : { width: 375, height: 812 };
  console.log(`\n=== ${viewport.toUpperCase()} ${size.width}×${size.height} ===`);

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: size });
  const page = await ctx.newPage();

  for (const { priority, route, label } of ROUTES) {
    const dir = resolve(SHOTS_BASE, priority, viewport);
    mkdirSync(dir, { recursive: true });
    console.log(`  → ${route}`);
    try {
      const resp = await page.goto(`${STUDIO}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const status = resp?.status() ?? 0;
      await page.waitForTimeout(3_000);
      const filename = `${label}-${status}.png`;
      await page.screenshot({ path: resolve(dir, filename), fullPage: false });
      console.log(`    📸 ${status} · ${priority}/${viewport}/${filename}`);
    } catch (e) {
      console.log(`    ⚠ ${(e as Error).message.split('\n')[0]}`);
    }
  }

  await ctx.close();
  await browser.close();
}

async function main(): Promise<void> {
  console.log('UI_REAL_USER_TEST_PLAN.md · P6/P7/P8/P9/P10 read-surfaces capture');
  console.log(`Target: ${STUDIO}\nOutput: ${SHOTS_BASE}\n`);

  await captureViewport('desktop');
  await captureViewport('mobile');

  console.log('\n✓ Read-surfaces capture complete');
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
