/**
 * FINAL_BUILD_PLAN.md Block E + D-6 · demo wallet balance monitor.
 *
 * Run periodically (cron / Vercel scheduled job / systemd timer):
 *   pnpm demo-wallet:monitor
 *
 * Checks the demo wallet's balance on Galileo (or mainnet), updates
 * `apps/studio/.demo-wallet-status.json`, posts a Telegram alert when
 * balance drops below the warning/critical thresholds.
 *
 * Thresholds (per D-6):
 *   < 0.05 OG  → log warning
 *   < 0.02 OG  → out-of-funds; `?demo=true` falls back to "demo paused" UX
 *   < 0.005 OG → critical; alert operator urgently
 */
import { JsonRpcProvider, Wallet, formatUnits } from 'ethers';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const NETWORK = (process.env.IVARONIX_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const RPC_URL = process.env.IVARONIX_RPC_URL ?? (NETWORK === 'mainnet' ? 'https://evmrpc.0g.ai' : 'https://evmrpc-testnet.0g.ai');
const CHAIN_ID = NETWORK === 'mainnet' ? 16661 : 16602;
const DEMO_WALLET_KEY = process.env.DEMO_WALLET_KEY ?? process.env.IVARONIX_SIGNER_KEY ?? process.env.EVM_PRIVATE_KEY;

const THRESHOLD_WARNING_OG = 0.05;
const THRESHOLD_OUT_OF_FUNDS_OG = 0.02;
const THRESHOLD_CRITICAL_OG = 0.005;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_OPERATOR_CHAT_ID;

const FLAG_PATH = resolve(process.cwd(), 'apps/studio/.demo-wallet-status.json');

async function postTelegramAlert(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[demo-wallet-monitor] Telegram not configured; alert logged only');
    return;
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }),
    });
    if (!r.ok) console.warn(`[demo-wallet-monitor] Telegram alert failed: ${r.status}`);
  } catch (err) {
    console.warn('[demo-wallet-monitor] Telegram alert error:', (err as Error).message);
  }
}

async function main(): Promise<void> {
  if (!DEMO_WALLET_KEY) {
    console.error('[demo-wallet-monitor] DEMO_WALLET_KEY (or IVARONIX_SIGNER_KEY fallback) not set');
    process.exit(1);
  }
  const provider = new JsonRpcProvider(RPC_URL, { chainId: CHAIN_ID, name: NETWORK });
  const wallet = new Wallet(DEMO_WALLET_KEY.startsWith('0x') ? DEMO_WALLET_KEY : '0x' + DEMO_WALLET_KEY, provider);
  const balance = await provider.getBalance(wallet.address);
  const balanceOg = parseFloat(formatUnits(balance, 18));
  const now = Date.now();

  const status = {
    address: wallet.address,
    balanceOg: balanceOg.toFixed(6),
    checkedAt: now,
    outOfFunds: balanceOg < THRESHOLD_OUT_OF_FUNDS_OG,
  };

  mkdirSync(dirname(FLAG_PATH), { recursive: true });
  writeFileSync(FLAG_PATH, JSON.stringify(status, null, 2));

  console.log(`[demo-wallet-monitor] ${wallet.address} balance=${balanceOg.toFixed(6)} OG · outOfFunds=${status.outOfFunds}`);

  // Alert tiers
  if (balanceOg < THRESHOLD_CRITICAL_OG) {
    await postTelegramAlert(
      `🚨 IVARONIX DEMO WALLET CRITICAL\n\n` +
      `Address: ${wallet.address}\n` +
      `Balance: ${balanceOg.toFixed(6)} OG\n` +
      `Network: ${NETWORK}\n\n` +
      `Top up IMMEDIATELY — visitors see "Demo paused" right now.\n` +
      `Run: pnpm demo-wallet:topup`,
    );
  } else if (balanceOg < THRESHOLD_OUT_OF_FUNDS_OG) {
    await postTelegramAlert(
      `⚠️ Ivaronix demo wallet OUT-OF-FUNDS\n\n` +
      `Address: ${wallet.address}\n` +
      `Balance: ${balanceOg.toFixed(6)} OG\n` +
      `Network: ${NETWORK}\n\n` +
      `?demo=true now falls back to wallet-connect path. Top up to restore the zero-friction demo.\n` +
      `Run: pnpm demo-wallet:topup`,
    );
  } else if (balanceOg < THRESHOLD_WARNING_OG) {
    await postTelegramAlert(
      `Ivaronix demo wallet balance low\n\n` +
      `Address: ${wallet.address}\n` +
      `Balance: ${balanceOg.toFixed(6)} OG\n` +
      `Network: ${NETWORK}\n\n` +
      `Below warning threshold (${THRESHOLD_WARNING_OG} OG). Plan to top up soon.`,
    );
  }
}

main().catch((err) => {
  console.error('[demo-wallet-monitor] FAIL:', err);
  process.exit(1);
});
