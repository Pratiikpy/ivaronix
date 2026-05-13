/**
 * iter-170 · open Chromium with MM extension loaded, then IDLE.
 *
 * User instruction (verbatim 2026-05-13): "jst open the playright
 * browser and do nthg i will look into this dnt close it i will
 * cnfrm dnt do anyhting jst open it"
 *
 * Behaviour:
 *   1. Launches Chromium (headed) with the MetaMask extension loaded
 *      from scripts/qa/metamask-e2e/mm/extension
 *   2. Opens a fresh page so the MetaMask welcome / unlock UI renders
 *   3. STAYS OPEN. Does NOT close. Does NOT auto-onboard. Does NOT
 *      try to import any keys. Just sits there.
 *   4. Prints the extension's chrome-extension://<id>/home.html URL
 *      so the user can navigate to it manually if MM auto-popup got
 *      dismissed.
 *
 * Exit: user closes the window OR hits Ctrl-C in the terminal.
 *       Profile dir stays at scripts/qa/multi-wallet/.profile-open-and-idle
 *       so a re-launch picks up wherever the user left off.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const USER_DATA_DIR = resolve(REPO, 'scripts/qa/multi-wallet/.profile-open-and-idle');

mkdirSync(USER_DATA_DIR, { recursive: true });

async function main(): Promise<void> {
const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false,
  viewport: { width: 1440, height: 900 },
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--no-sandbox',
  ],
});

// Discover the extension ID once the service worker boots.
let extId: string | null = null;
for (let i = 0; i < 60; i++) {
  const sw = context.serviceWorkers();
  if (sw.length > 0) {
    const m = sw[0].url().match(/chrome-extension:\/\/([a-z]+)\//);
    if (m) {
      extId = m[1];
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 500));
}

console.log('\n========================================================');
console.log('  Playwright + MetaMask · OPEN AND IDLE  (iter-170)');
console.log('========================================================');
console.log(`  Extension path:  ${EXTENSION_PATH}`);
console.log(`  Profile dir:     ${USER_DATA_DIR}`);
console.log(`  Viewport:        1440x900 (headed Chromium)`);
if (extId) {
  console.log(`  Extension ID:    ${extId}`);
  console.log(`  MetaMask URL:    chrome-extension://${extId}/home.html`);
} else {
  console.log('  Extension ID:    (service worker did not boot within 30s)');
}
console.log('--------------------------------------------------------');
console.log('  STATE: idling. Browser stays open until you close it.');
console.log('  The script will NOT auto-onboard MM, NOT import any');
console.log('  keys, NOT navigate to Studio. Do whatever you need.');
console.log('--------------------------------------------------------');
console.log('  When done: close the browser window OR Ctrl-C here.');
console.log('========================================================\n');

// Block forever until the user closes the browser.
context.on('close', () => {
  console.log('\n[open-and-idle] browser closed by user · exiting.');
  process.exit(0);
});

// Keep the event loop alive.
await new Promise(() => {
  /* never resolves; only context.on('close') exits */
});
}

main().catch((e) => {
  console.error('[open-and-idle] launch failed:', (e as Error).message);
  process.exit(1);
});
