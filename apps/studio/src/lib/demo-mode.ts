/**
 * FINAL_BUILD_PLAN.md Block E + D-6 · zero-friction demo mode.
 *
 * Server-side state + helpers for the `?demo=true` flow:
 *   - Loads the demo wallet from env (DEMO_WALLET_KEY)
 *   - Reads / writes the OUT_OF_FUNDS flag file
 *   - Provides the canonical sample document for one-click runs
 *   - Surfaces honest "demo paused" status when the demo wallet is drained
 *
 * The demo wallet pays for inference subsidised on behalf of the visitor.
 * Receipt is marked `billing.payment.subsidised = true` so the UI shows
 * "Demo run · operator-subsidised."
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Network } from '@ivaronix/core';

export const DEMO_FLAG_PATH = resolve(process.cwd(), 'apps/studio/.demo-wallet-status.json');

interface DemoWalletStatus {
  /** Operator demo wallet address; null when DEMO_WALLET_KEY unset. */
  address: string | null;
  /** Most recent balance check (OG, decimal string). */
  balanceOg: string | null;
  /** Unix ms of the most recent balance check. */
  checkedAt: number | null;
  /** When true, /?demo=true falls back to "demo paused" UX. */
  outOfFunds: boolean;
}

const DEFAULT_STATUS: DemoWalletStatus = {
  address: null,
  balanceOg: null,
  checkedAt: null,
  outOfFunds: false,
};

const SAMPLE_DOC_PATH = resolve(process.cwd(), 'tests/fixtures/sample-acquisition-term-sheet.txt');

const FALLBACK_SAMPLE_DOC = `[Demo · Acquisition Term Sheet]

The Acquirer agrees to purchase 100% of the Target's equity for $2,000,000 (the "Purchase Price"), subject to a working capital adjustment.

Non-Compete: The Founder agrees to a 5-year non-compete in any related field, globally.

Indemnification: Founder indemnifies Acquirer for all known and unknown liabilities, with no cap and no time limit.

Governing Law: Cayman Islands.

Closing Conditions: Acquirer may walk away at any time before closing for any reason or no reason, with no break-up fee.`;

const SAMPLE_QUESTION = 'Which clause is most concerning?';

/**
 * Read the demo wallet status from disk. Returns default-empty when no
 * file exists yet (typical at first boot).
 */
export function readDemoStatus(): DemoWalletStatus {
  try {
    if (!existsSync(DEMO_FLAG_PATH)) return DEFAULT_STATUS;
    return JSON.parse(readFileSync(DEMO_FLAG_PATH, 'utf8')) as DemoWalletStatus;
  } catch {
    return DEFAULT_STATUS;
  }
}

/**
 * Write the demo wallet status back to disk. Used by the monitor cron
 * (scripts/diag/demo-wallet-monitor.ts) to update balance + out-of-funds flag.
 */
export function writeDemoStatus(status: DemoWalletStatus): void {
  try {
    mkdirSync(dirname(DEMO_FLAG_PATH), { recursive: true });
    writeFileSync(DEMO_FLAG_PATH, JSON.stringify(status, null, 2));
  } catch (err) {
    // Non-fatal; log only.
    console.warn('[demo-mode] failed to write status:', (err as Error).message);
  }
}

/**
 * Get the sample document the demo flow pre-loads. Reads
 * tests/fixtures/sample-acquisition-term-sheet.txt when present, falls
 * back to an inline string when the fixture isn't bundled into the deploy.
 */
export function getDemoSampleDocument(): { text: string; question: string } {
  try {
    if (existsSync(SAMPLE_DOC_PATH)) {
      return { text: readFileSync(SAMPLE_DOC_PATH, 'utf8'), question: SAMPLE_QUESTION };
    }
  } catch {
    /* fall through */
  }
  return { text: FALLBACK_SAMPLE_DOC, question: SAMPLE_QUESTION };
}

/**
 * Returns true when ?demo=true should be honored. False when the demo
 * wallet is drained (out-of-funds flag set) — visitor sees the "demo
 * paused" UI instead.
 */
export function isDemoModeActive(): boolean {
  const status = readDemoStatus();
  // Demo wallet must exist AND not be flagged out-of-funds AND have a positive balance.
  return Boolean(
    status.address &&
    !status.outOfFunds &&
    status.balanceOg !== null &&
    parseFloat(status.balanceOg) > 0.005, // floor: 0.005 OG buffer
  );
}

/**
 * Pre-selected demo skill. Per the IvaronixPaymentStrategy doc §"First Paid
 * Skill", private-doc-review is the canonical demo skill — visually
 * recognisable as a contract review and showcases the receipt-as-proof
 * model cleanly.
 */
export const DEMO_SKILL_ID = 'private-doc-review';
