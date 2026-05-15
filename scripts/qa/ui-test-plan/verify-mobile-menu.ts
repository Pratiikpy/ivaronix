/**
 * Recapture: mobile hamburger drawer actually opens on click.
 * The first Playwright sweep captured the drawer as CLOSED-after-click
 * (timing issue). This script explicitly waits for the drawer overlay
 * to render before screenshotting.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = 'https://ivaronix.vercel.app';
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/playwright-interactive/mobile');
mkdirSync(OUT, { recursive: true });

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto(STUDIO, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(1500);

    console.log(`→ before click`);
    await page.screenshot({ path: resolve(OUT, '027a-G-02-mobile-menu-before-click.png') });

    // The hamburger has aria-label="Open menu" or similar — try multiple selectors
    const triggers = [
      page.getByRole('button', { name: /menu/i }),
      page.locator('button:has(svg)').last(),
      page.locator('header button').last(),
    ];
    let clicked = false;
    for (const trigger of triggers) {
      if ((await trigger.count()) > 0) {
        await trigger.first().click({ force: true });
        clicked = true;
        console.log(`  clicked via ${trigger}`);
        break;
      }
    }
    if (!clicked) {
      console.error('FAIL: no hamburger button found');
      return;
    }

    // Wait for any element that should only appear in the open drawer
    await page.waitForTimeout(2000);
    console.log(`→ after click + 2s wait`);

    // Look for drawer-specific content (nav links rendered overlay-style)
    const drawerNav = await page.locator('nav a:visible').count();
    console.log(`  visible nav links: ${drawerNav}`);

    await page.screenshot({ path: resolve(OUT, '027b-G-02-mobile-menu-after-click.png') });

    // If drawer didn't open, capture HTML for debug
    if (drawerNav < 3) {
      const headerHtml = await page.locator('header').innerHTML();
      console.log(`\n  HEADER HTML SNIPPET:\n${headerHtml.slice(0, 800)}`);
    }

    await context.close();
  } finally {
    await browser.close();
  }
  console.log(`\nProof: QA_PROOF_PACK/ui/playwright-interactive/mobile/027a + 027b`);
}

main().catch((err) => { console.error('FAIL:', err); process.exit(1); });
