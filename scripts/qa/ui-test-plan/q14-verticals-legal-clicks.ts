import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/ui-surfaces/interactive-clicks');
mkdirSync(OUT, { recursive: true });

type ClickRecord = { route: string; index: number; text: string; href: string | null; destination: string; status: 'ok' | 'redirect' | 'fail'; note: string };
const records: ClickRecord[] = [];

async function harvestLinks(page: Page): Promise<{ text: string; href: string | null }[]> {
  return await page.evaluate(() => {
    const out: { text: string; href: string | null }[] = [];
    document.querySelectorAll('a, button').forEach((el) => {
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100);
      if (!text) return;
      const href = (el as HTMLAnchorElement).href || null;
      out.push({ text, href });
    });
    return out;
  });
}

async function driveRoute(page: Page, route: string): Promise<void> {
  await page.goto(`${STUDIO}${route}`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(OUT, `${route.replace(/[/]/g, '_').slice(1)}-landing.png`), fullPage: false });

  const links = await harvestLinks(page);
  console.log(`\n=== ${route} · ${links.length} clickables ===`);
  let captured = 0;
  for (let i = 0; i < links.length && captured < 8; i++) {
    const link = links[i];
    if (!link.text || link.text.length < 2) continue;
    if (link.text.match(/^(\[i\]|ivaronix|menu)$/i)) continue; // skip logo + menu chrome
    if (!link.href) continue;
    const ext = !link.href.includes('ivaronix.vercel.app') && !link.href.startsWith(STUDIO);
    try {
      // For external links (chainscan, GitHub), don't navigate — record presence only
      if (ext) {
        records.push({ route, index: i, text: link.text, href: link.href, destination: link.href, status: 'ok', note: 'external link · presence-only check' });
        continue;
      }
      // Internal link: navigate, capture state
      await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await page.waitForTimeout(800);
      const dest = page.url();
      const finalRouteOk = dest.startsWith(STUDIO);
      const status = finalRouteOk ? 'ok' : 'redirect';
      records.push({ route, index: i, text: link.text, href: link.href, destination: dest, status, note: '' });
      captured++;
      const screenshot = resolve(OUT, `${route.replace(/[/]/g, '_').slice(1)}-click-${String(captured).padStart(2, '0')}.png`);
      await page.screenshot({ path: screenshot, fullPage: false });
      console.log(`  ${captured}. "${link.text.slice(0, 50)}" → ${dest}`);
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(500);
    } catch (e) {
      records.push({ route, index: i, text: link.text, href: link.href, destination: link.href ?? '', status: 'fail', note: (e as Error).message.split('\n')[0] });
      console.log(`  ✗ "${link.text.slice(0, 50)}" — ${(e as Error).message.split('\n')[0]}`);
    }
  }
}

async function main(): Promise<void> {
  console.log(`Studio: ${STUDIO}`);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await driveRoute(page, '/verticals');
    await driveRoute(page, '/legal');
  } finally {
    await ctx.close();
    await browser.close();
  }
  const passCount = records.filter((r) => r.status === 'ok').length;
  const failCount = records.filter((r) => r.status === 'fail').length;
  const report = {
    runAt: new Date().toISOString(),
    studioUrl: STUDIO,
    records,
    summary: { ok: passCount, redirect: records.filter((r) => r.status === 'redirect').length, fail: failCount, total: records.length },
  };
  writeFileSync(resolve(OUT, 'click-log.json'), JSON.stringify(report, null, 2));
  console.log(`\nSUMMARY: ${passCount} ok · ${failCount} fail · ${records.length} total. saved click-log.json + ${captured?'screenshots':'screenshots'}`);
}
let captured = 0;
main().catch((err) => { console.error('FAIL:', err.message ?? err); process.exit(1); });
