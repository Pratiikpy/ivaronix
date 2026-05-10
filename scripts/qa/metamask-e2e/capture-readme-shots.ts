/**
 * Capture the 6 README product shots per planning-003 §A.2.2.
 *
 * Aishi packs 8 phone screenshots in their README; Ivaronix had zero
 * before this script. This produces the visual-density layer the
 * `2x3` markdown table in the README references.
 *
 * Captures (all 1200×800 PNG):
 *   01-home.png            Studio home with hero + receipt counter
 *   02-runpanel-mid.png    Run panel mid-execution (4 lights pending)
 *   03-receipt-tier1.png   /r/<id> proof page · all 4 lights green · TIER 1 chip
 *   04-burn-mode.png       Burn Mode dialog · key fingerprint visible
 *   05-agents.png          /agents leaderboard · 4 minted passports
 *   06-onboard.png         /onboard 5-row stepper · green checkmarks
 *
 * Output: `screenshots/readme/<NN-name>.png` (committed; README points
 * directly at these paths).
 *
 * Operator workflow (queued in USER_TODO §B-V2-23 because the Studio
 * dev server + a funded wallet are required):
 *
 *   1. Start Studio in one terminal:
 *        pnpm --filter @ivaronix/studio dev
 *   2. Confirm a real receipt id exists (default 1644 — change via
 *      RECEIPT_ID env var if you want a different shot):
 *        RECEIPT_ID=1644
 *   3. Run this script:
 *        pnpm screenshots:refresh
 *
 *   The script connects to localhost:3300, navigates each route, waits
 *   for content to settle, captures the PNG, and writes to
 *   `screenshots/readme/`.
 *
 * Network-access only when the Studio dev server is running locally.
 * No external service calls.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, 'screenshots', 'readme');

const STUDIO_BASE = process.env.STUDIO_BASE ?? 'http://localhost:3300';
const RECEIPT_ID = process.env.RECEIPT_ID ?? '1644';
const VIEWPORT = { width: 1200, height: 800 } as const;

interface Shot {
  name: string;
  path: string;
  navigate: (page: Page) => Promise<void>;
  /**
   * Optional: post-navigation work to set the page into the demoable
   * state (open a dialog, scroll into view, fill an input). Runs after
   * `navigate()` resolves.
   */
  setup?: (page: Page) => Promise<void>;
}

const SHOTS: Shot[] = [
  {
    name: 'home',
    path: `${STUDIO_BASE}/`,
    navigate: async (page) => {
      await page.goto(`${STUDIO_BASE}/`, { waitUntil: 'networkidle' });
      // Wait for the receipt-counter chip to populate from chain.
      await page.waitForSelector('text=/receipts/i', { timeout: 30_000 }).catch(() => {/* counter optional */});
      await page.waitForTimeout(800);
    },
  },
  {
    name: 'runpanel-mid',
    path: `${STUDIO_BASE}/`,
    navigate: async (page) => {
      await page.goto(`${STUDIO_BASE}/`, { waitUntil: 'networkidle' });
    },
    setup: async (page) => {
      // Click "Use sample contract" to populate the input. We DELIBERATELY
      // do not click Run — without real Router credentials the run would
      // fail with a "Provider proxy" toast, which is honest but bad for
      // the README's first-scroll impression. Pre-Run "ready" state shows
      // the sample-contract loaded + four lights pending + question
      // populated, which is the actual demoable state for an offline reader.
      const sampleBtn = page.getByRole('button', { name: /sample contract/i });
      if (await sampleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sampleBtn.click();
      }
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'receipt-tier1',
    path: `${STUDIO_BASE}/r/${RECEIPT_ID}`,
    navigate: async (page) => {
      await page.goto(`${STUDIO_BASE}/r/${RECEIPT_ID}`, { waitUntil: 'networkidle' });
      // The proof page renders synchronously from server data; just
      // wait for the TIER chip to appear before capturing.
      await page.waitForSelector('text=/TIER 1/i', { timeout: 30_000 }).catch(() => {/* legacy receipts may not have it */});
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'burn-mode',
    path: `${STUDIO_BASE}/r/${RECEIPT_ID}`,
    navigate: async (page) => {
      // Burn Mode visualisation lives on the receipt page (the home
      // page has no burn dialog). The receipt body's `burn` block
      // renders the AES-256-GCM key fingerprint, the destroyed-at
      // timestamp, and the cleanup status.
      await page.goto(`${STUDIO_BASE}/r/${RECEIPT_ID}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
    },
    setup: async (page) => {
      // The "burn mode · evidence proof" section header lives mid-page;
      // its block carries the AES-256-GCM key fingerprint, the destroyed-at
      // timestamp, and the cleanup status. Center it in the viewport.
      const burnSection = page.getByText(/burn mode · evidence proof/i).first();
      if (await burnSection.isVisible({ timeout: 2000 }).catch(() => false)) {
        await burnSection.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior }));
        await page.waitForTimeout(500);
      }
    },
  },
  {
    name: 'agents',
    path: `${STUDIO_BASE}/agents`,
    navigate: async (page) => {
      await page.goto(`${STUDIO_BASE}/agents`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
    },
  },
  {
    name: 'onboard',
    path: `${STUDIO_BASE}/onboard`,
    navigate: async (page) => {
      await page.goto(`${STUDIO_BASE}/onboard`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
    },
  },
];

async function captureShot(context: BrowserContext, idx: number, shot: Shot): Promise<string> {
  const page = await context.newPage();
  try {
    await shot.navigate(page);
    if (shot.setup) await shot.setup(page);
    const seq = String(idx + 1).padStart(2, '0');
    const filename = `${seq}-${shot.name}.png`;
    const out = resolve(OUT_DIR, filename);
    await page.screenshot({ path: out, fullPage: false });
    return out;
  } finally {
    await page.close();
  }
}

async function main(): Promise<void> {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log(`[screenshots] base ${STUDIO_BASE}`);
  console.log(`[screenshots] receipt id ${RECEIPT_ID}`);
  console.log(`[screenshots] viewport ${VIEWPORT.width}x${VIEWPORT.height}`);
  console.log(`[screenshots] out  ${OUT_DIR}`);
  console.log('');

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });

    for (let i = 0; i < SHOTS.length; i++) {
      const shot = SHOTS[i]!;
      const seq = String(i + 1).padStart(2, '0');
      try {
        const out = await captureShot(context, i, shot);
        console.log(`  PASS · ${seq}-${shot.name}.png  ${out}`);
      } catch (err) {
        console.log(`  FAIL · ${seq}-${shot.name}.png  ${(err as Error).message}`);
        // Don't abort the whole pass — capture as many as possible so
        // the operator can re-run for the missing ones.
      }
    }
  } finally {
    await browser?.close();
  }

  console.log('');
  console.log(`[screenshots] done — verify the 6 PNGs at ${OUT_DIR}`);
  console.log('[screenshots] commit them, then push to refresh the README grid.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
