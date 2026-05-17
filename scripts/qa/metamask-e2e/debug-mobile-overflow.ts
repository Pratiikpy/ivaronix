import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto('https://www.ivaronix.xyz/', { waitUntil: 'networkidle', timeout: 30000 });
  const culprits = await page.evaluate(() => {
    const out: Array<{tag: string; w: number; left: number; right: number; cls: string; text: string}> = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.right > 375 && r.width > 10 && el.children.length === 0) {
        out.push({
          tag: el.tagName.toLowerCase(),
          w: Math.round(r.width),
          left: Math.round(r.left),
          right: Math.round(r.right),
          cls: ((el as HTMLElement).className?.toString() ?? '').slice(0, 50),
          text: ((el as HTMLElement).innerText ?? '').slice(0, 40),
        });
      }
    });
    return out.slice(0, 15);
  });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(culprits, null, 2));
  await browser.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
