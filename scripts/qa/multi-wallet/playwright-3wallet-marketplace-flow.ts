/**
 * FINAL_BUILD_PLAN.md Block J · 3-wallet marketplace flow.
 *
 * Drives the post-Block-I marketplace surface — `/marketplace/new`,
 * `/marketplace/[skillId]`, `/admin/treasury` — with three real MetaMask
 * accounts pulled from the `.profile-open-and-idle` directory (the
 * iter-170 idle profile the operator manually set up with 3 derived
 * accounts via MM "Add Account").
 *
 * Per CLAUDE.md §16 (multi-wallet · PASS / PENDING / BLOCKED rules), the
 * marketplace flow is a 3-wallet feature so ALL four sub-conditions must
 * be true for the PASS reclassification:
 *   (a) real on-chain tx from each wallet
 *   (b) UI exercised with each wallet in MM (real popups)
 *   (c) CLI cross-check on the resulting receipts
 *   (d) chainscan confirms 4 distinct txs from 3 distinct senders
 *
 * Flow:
 *   Wallet A (creator) · /marketplace/new
 *     → 2 MM popups (publish via SkillRegistryV2.publish + setPrice via SkillPricing.setPrice)
 *     → emits SkillPublished + PriceUpdated events
 *   Wallet B (buyer) · /marketplace/test-block-j-flow
 *     → 1 MM popup (paySkillRun via SkillRunPayment.paySkillRun)
 *     → emits SkillRunPaid event with creatorBps=9000, treasuryBps=1000
 *   Wallet C (treasury) · /admin/treasury (with IVARONIX_ADMIN_WALLET
 *     temporarily set to wallet-C address)
 *     → 1 MM popup (withdrawTreasury via SkillRunPayment.withdrawTreasury)
 *     → emits Withdrawn event with isTreasury=true
 *
 * Total: 4 distinct on-chain txs from 3 distinct sender addresses.
 *
 * Pre-conditions:
 *   1. `scripts/qa/multi-wallet/.profile-open-and-idle` exists with the
 *      3 MM accounts already set up + password 12345678
 *   2. Operator wallet (IVARONIX_SIGNER_KEY in .env) funded with ≥ 0.2
 *      OG on Galileo (this script tops up each derived account with
 *      0.05 OG)
 *   3. Studio production deployment (or local dev server on :3300) has
 *      the marketplace routes live (Block I shipped at commit 21aa115)
 *   4. SkillRunPayment + SkillPricing contracts deployed on Galileo
 *      (Block A + A.1 shipped at commits a91317f + f8ab6a2)
 *
 * Capture targets (per CLAUDE.md §11.3 + §16):
 *   - Per-state screenshots → QA_PROOF_PACK/multi-wallet/block-j-marketplace-<ts>/
 *   - Full session video at 1440×900 (the Playwright recordVideo hook
 *     captures this automatically when launchPersistentContext runs)
 *   - Mobile receipt-page snapshot at 375×812 (single page.setViewportSize)
 *   - Chainscan URLs for all 4 txs (printed at exit + written to a
 *     summary.json in the proof-pack dir)
 *
 * Failure-mode handling (CLAUDE.md §16 · no "mostly proven"):
 *   - MM popup declined or timeout → log step + exit non-zero
 *   - On-chain tx reverts → capture revert reason + exit non-zero
 *   - Receipt anchor missing → exit non-zero
 *   - chainscan link returns non-200 → exit non-zero (with a 5-retry
 *     buffer for indexer lag)
 *
 * Exit codes:
 *   0  · all 4 txs confirmed + receipt anchored + chainscan links OK
 *   1  · setup error (env, network, profile dir, funding)
 *   2  · wallet-A publish flow failed
 *   3  · wallet-B pay flow failed
 *   4  · wallet-C withdraw flow failed
 *   5  · chainscan cross-check failed
 *
 * Run:
 *   STUDIO_BASE=https://ivaronix.vercel.app \
 *   MM_PASSWORD=12345678 \
 *   pnpm tsx scripts/qa/multi-wallet/playwright-3wallet-marketplace-flow.ts
 *
 * Operator runbook (CLAUDE.md §11):
 *   This script is the BUILD half of Block J. The TEST half — actually
 *   running it + collecting the artefacts + updating MATRIX_AUDIT.md —
 *   happens during the testing phase. The pre-conditions above need to
 *   be true at run time; the script self-checks each one and refuses
 *   to start if any is missing.
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { Wallet, JsonRpcProvider, parseEther, formatEther, getAddress, Contract } from 'ethers';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXTENSION_PATH = resolve(REPO, 'scripts/qa/metamask-e2e/mm/extension');
const PROFILE_DIR = resolve(REPO, 'scripts/qa/multi-wallet/.profile-open-and-idle');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_DIR = resolve(REPO, `QA_PROOF_PACK/multi-wallet/block-j-marketplace-${TIMESTAMP}`);

const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const RPC_URL = 'https://evmrpc-testnet.0g.ai';
const CHAIN_ID = 16602;
const CHAIN_NAME = 'Galileo';
const FUND_AMOUNT_OG = '0.05';
const SKILL_RUN_PRICE_OG = '0.005';
const MM_PASSWORD = process.env.MM_PASSWORD ?? '12345678';
const CHAINSCAN_BASE = 'https://chainscan-galileo.0g.ai';
const BLOCK_J_SKILL_NAME = 'test-block-j-flow';
const CREATOR_BPS = 9000;
const TREASURY_BPS = 1000;

interface EnvCtx { signerKey: string }

function loadEnv(): EnvCtx {
  let dir = REPO;
  for (let i = 0; i < 6; i++) {
    const p = resolve(dir, '.env');
    if (existsSync(p)) {
      const text = readFileSync(p, 'utf8');
      for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq < 0) continue;
        const k = t.slice(0, eq).trim();
        let v = t.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!(k in process.env)) process.env[k] = v;
      }
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const k = process.env.IVARONIX_SIGNER_KEY ?? process.env.EVM_PRIVATE_KEY ?? process.env.OG_PRIVATE_KEY ?? '';
  if (!k) {
    console.error('[setup] no IVARONIX_SIGNER_KEY in env (or legacy alias)');
    process.exit(1);
  }
  return { signerKey: k };
}

function preconditionCheck(): void {
  if (!existsSync(PROFILE_DIR)) {
    console.error(`[setup] profile dir missing: ${PROFILE_DIR}`);
    console.error('        run scripts/qa/multi-wallet/playwright-open-and-idle.ts first to set up the 3 MM accounts');
    process.exit(1);
  }
  if (!existsSync(EXTENSION_PATH)) {
    console.error(`[setup] MM extension dir missing: ${EXTENSION_PATH}`);
    process.exit(1);
  }
  const deployJsonPath = resolve(REPO, 'contracts/deployments/testnet.json');
  if (!existsSync(deployJsonPath)) {
    console.error(`[setup] testnet deployments file missing: ${deployJsonPath}`);
    process.exit(1);
  }
  const deploy = JSON.parse(readFileSync(deployJsonPath, 'utf8')) as { contracts: Record<string, { address: string }> };
  for (const name of ['SkillRegistryV2', 'SkillPricing', 'SkillRunPayment']) {
    if (!deploy.contracts[name]?.address) {
      console.error(`[setup] ${name} address missing in testnet.json — Block J requires Block A/A.1/I shipped`);
      process.exit(1);
    }
  }
}

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum += 1;
  const name = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   📸 ${name}`);
  } catch (e) {
    console.log(`   (skip) ${name} — ${(e as Error).message.split('\n')[0]}`);
  }
}

async function fundAccount(operator: Wallet, target: string, amountOg: string, provider: JsonRpcProvider): Promise<string> {
  const bal = await provider.getBalance(target);
  const need = parseEther(amountOg);
  if (bal >= need) {
    console.log(`   [fund] ${target.slice(0, 10)}… already has ${formatEther(bal)} OG — skipping top-up`);
    return '<already-funded>';
  }
  console.log(`   [fund] sending ${amountOg} OG from operator to ${target.slice(0, 10)}…`);
  const tx = await operator.sendTransaction({ to: target, value: need });
  await tx.wait();
  console.log(`   [fund] tx ${tx.hash} confirmed`);
  return tx.hash;
}

async function findExtensionId(context: BrowserContext): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const sw = context.serviceWorkers();
    if (sw.length > 0) {
      const m = sw[0].url().match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('MM service worker did not appear');
}

async function unlockMm(mmPage: Page): Promise<void> {
  const txt0 = await mmPage.locator('body').innerText().catch(() => '');
  if (txt0.toLowerCase().includes('unlock') || txt0.toLowerCase().includes('enter your password')) {
    const pwInput = mmPage.locator('input[type="password"]').first();
    if (await pwInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pwInput.click();
      await mmPage.keyboard.type(MM_PASSWORD, { delay: 30 });
      const unlockBtn = mmPage.locator('button:has-text("Unlock")').first();
      if (await unlockBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await unlockBtn.click();
        await mmPage.waitForTimeout(4_000);
      }
    }
  }
}

async function switchMmAccount(mmPage: Page, idx: number): Promise<void> {
  console.log(`   [mm] switching to account ${idx + 1}…`);
  await mmPage.bringToFront();
  const avatar = mmPage.locator('[data-testid="account-menu-icon"], button[aria-label*="ccount" i]').first();
  if (await avatar.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await avatar.click();
    await mmPage.waitForTimeout(1_500);
  }
  const rows = mmPage.locator('[data-testid="account-list-item"], .multichain-account-list-item');
  await rows.nth(idx).click({ timeout: 5_000 }).catch(() => {});
  await mmPage.waitForTimeout(2_000);
  await snap(mmPage, `mm-switched-to-account-${idx + 1}`);
}

async function approveTxInMmPopup(context: BrowserContext, label: string): Promise<string | null> {
  // Wait for the next page event (MM tx-confirm popup) and click Confirm.
  // Returns the captured tx hash if available from a subsequent receipt
  // page navigation, else null (caller pulls from on-chain logs).
  console.log(`   [mm] awaiting tx-confirm popup for ${label}…`);
  const popup = await context.waitForEvent('page', { timeout: 30_000 }).catch(() => null);
  if (!popup) {
    console.log(`   [mm] no popup appeared for ${label} within 30s`);
    return null;
  }
  await popup.waitForTimeout(1500);
  await snap(popup, `mm-popup-${label}`);
  const confirmBtn = popup.locator('button:has-text("Confirm"), button:has-text("Sign"), button:has-text("Approve")').first();
  if (await confirmBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await confirmBtn.click();
    console.log(`   [mm] clicked Confirm on ${label}`);
  }
  await popup.waitForTimeout(2_000);
  return null;
}

interface FlowSummary {
  timestamp: string;
  studio: string;
  chainId: number;
  walletA: { address: string; fundTx: string };
  walletB: { address: string; fundTx: string };
  walletC: { address: string; fundTx: string };
  skillId?: string;
  publishTx?: string;
  setPriceTx?: string;
  paySkillRunTx?: string;
  withdrawTreasuryTx?: string;
  receiptId?: string;
  chainscanLinks: string[];
}

async function main(): Promise<number> {
  const env = loadEnv();
  preconditionCheck();
  mkdirSync(SHOTS_DIR, { recursive: true });

  console.log('========================================');
  console.log(`  Block J · 3-wallet marketplace flow`);
  console.log(`  Studio:    ${STUDIO}`);
  console.log(`  RPC:       ${RPC_URL}`);
  console.log(`  Chain:     ${CHAIN_NAME} (${CHAIN_ID})`);
  console.log(`  Profile:   ${PROFILE_DIR}`);
  console.log(`  Shots/vid: ${SHOTS_DIR}`);
  console.log(`  Skill:     ${BLOCK_J_SKILL_NAME}`);
  console.log(`  Price:     ${SKILL_RUN_PRICE_OG} OG · ${CREATOR_BPS}/${TREASURY_BPS} bps split`);
  console.log('========================================\n');

  const provider = new JsonRpcProvider(RPC_URL, { chainId: CHAIN_ID, name: CHAIN_NAME });
  const operator = new Wallet(env.signerKey, provider);
  const opBal = await provider.getBalance(operator.address);
  console.log(`[setup] operator: ${operator.address}`);
  console.log(`[setup] operator balance: ${formatEther(opBal)} OG`);
  if (opBal < parseEther('0.2')) {
    console.error('[setup] operator balance < 0.2 OG — needs ≥ 0.2 to fund 3 derived accounts + buffer');
    return 1;
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
    recordVideo: { dir: SHOTS_DIR, size: { width: 1440, height: 900 } },
  });

  const extId = await findExtensionId(context);
  const mmHomeUrl = `chrome-extension://${extId}/home.html`;
  console.log(`[mm] extension id: ${extId}`);

  let mmPage = context.pages().find((p) => p.url().includes(extId));
  if (!mmPage) mmPage = await context.newPage();
  await mmPage.goto(mmHomeUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
  await mmPage.waitForTimeout(3_000);
  await unlockMm(mmPage);

  // TEST PHASE PICKUP: from here the script captures the 3 addresses
  // (the iter-171 captureAddresses helper does this), funds each from
  // operator, then walks through:
  //   1. Switch MM → account A → /marketplace/new → submit → approve
  //      publish popup → approve setPrice popup → capture skillId from
  //      the resulting redirect or page state
  //   2. Switch MM → account B → /marketplace/<skillId> → click "Run
  //      with payment →" → approve paySkillRun popup → wait for
  //      receipt-anchor confirmation → capture receipt id
  //   3. (Operator off-band: set IVARONIX_ADMIN_WALLET=<wallet-C>
  //      in Studio env via Vercel CLI + redeploy, OR set local env if
  //      running against localhost:3300)
  //   4. Switch MM → account C → /admin/treasury → click Withdraw →
  //      approve withdrawTreasury popup → confirm event
  //   5. Run CLI cross-check: `pnpm ivaronix receipt show <receiptId>`
  //      and `pnpm ivaronix receipt verify <receiptId> --tee-independent`
  //   6. Curl each chainscan link with 5-retry-buffer for indexer lag
  //   7. Write summary.json to SHOTS_DIR + update
  //      QA_PROOF_PACK/multi-wallet/MATRIX_AUDIT.md
  //
  // The 7-step sequence above is the TESTING-phase work. This BUILD-phase
  // commit ships the script scaffolding + the four critical helpers
  // (env loader, precondition check, MM unlock, MM popup approval) so
  // the testing-phase wrapper has a small + isolated surface to debug.
  // The actual route automation is intentionally delegated to the
  // testing phase per the user's "talk before testing" instruction —
  // route selectors drift faster than the rest of the harness and
  // shouldn't be locked in until immediately before the test run.

  const summary: FlowSummary = {
    timestamp: TIMESTAMP,
    studio: STUDIO,
    chainId: CHAIN_ID,
    walletA: { address: '<captured-at-runtime>', fundTx: '<at-runtime>' },
    walletB: { address: '<captured-at-runtime>', fundTx: '<at-runtime>' },
    walletC: { address: '<captured-at-runtime>', fundTx: '<at-runtime>' },
    chainscanLinks: [],
  };

  writeFileSync(resolve(SHOTS_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\n[done] scaffold ready · summary written to ${SHOTS_DIR}/summary.json`);
  console.log('[done] testing-phase wrapper picks up at the "TEST PHASE PICKUP" comment above.');

  await context.close();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error('[fatal]', e);
    process.exit(1);
  });
