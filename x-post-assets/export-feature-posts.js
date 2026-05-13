const path = require("path");
const { chromium } = require("playwright");

const cards = [
  "burn-mode-01",
  "burn-mode-02",
  "consensus-01",
  "consensus-02",
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1080 },
    deviceScaleFactor: 1,
  });

  const htmlPath = path.resolve(__dirname, "ivaronix-feature-posts.html");
  await page.goto(`file://${htmlPath}`);

  for (const id of cards) {
    const locator = page.locator(`#${id}`);
    await locator.screenshot({
      path: path.resolve(__dirname, `${id}.png`),
      animations: "disabled",
    });
  }

  await browser.close();
})();
