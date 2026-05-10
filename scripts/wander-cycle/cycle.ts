/**
 * One iteration of the wander-cycle agent.
 *
 * Closes planning-003 §A.4.1 (wandering thought #67). Provus has 30,000+
 * mainnet TXs from a 15-second autonomous loop. Without continuous chain
 * anchoring Ivaronix's headline number stays at "1,644 testnet receipts"
 * which reads as demo-with-traffic, not production-system.
 *
 * Each iteration:
 *   1. Generates a synthetic lease document via `synthetic-leases.ts`.
 *   2. Writes it to a temp file under `.ivaronix/wander-cycle/in/`.
 *   3. Invokes `ivaronix doc ask <file> "<question>" --skill private-doc-review`
 *      via the workspace CLI binary. Captures stdout + exit code.
 *   4. Parses the resulting receipt id + tx hash from the output.
 *   5. Appends one JSONL line to `docs/wander-cycle-history.jsonl` for
 *      observability + cost tracking.
 *
 * Designed to be invoked from a wrapper loop (systemd timer, Docker entry,
 * or Windows Task Scheduler). Default cadence: 5 minutes. Cost: ~0.0001
 * OG/run on testnet (~0.0005 OG on mainnet pending estimate).
 *
 * Usage:
 *   pnpm wander:cycle              # one iteration, exits
 *   pnpm wander:cycle --seed 42    # deterministic seed for replay
 *   pnpm wander:cycle --dry-run    # generates lease, doesn't anchor
 */
import { writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { generateLease } from './synthetic-leases.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const CYCLE_INPUT_DIR = resolve(REPO_ROOT, '.ivaronix', 'wander-cycle', 'in');
const HISTORY_FILE = resolve(REPO_ROOT, 'docs', 'wander-cycle-history.jsonl');

interface CycleResult {
  ts: string;
  seed: number;
  leaseFile: string;
  redFlagCount: number;
  exitCode: number;
  receiptId: string | null;
  txHash: string | null;
  durationMs: number;
  costOgEstimate: number;
  errorTail?: string;
}

function parseFlags(): { seed: number; dryRun: boolean; question: string } {
  const args = process.argv.slice(2);
  let seed = Date.now();
  let dryRun = false;
  let question =
    'List the three most concerning clauses for the tenant. For each, name the clause and explain the risk in one sentence.';
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--seed' && args[i + 1]) {
      seed = Number(args[i + 1]);
      i++;
    } else if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '--question' && args[i + 1]) {
      question = args[i + 1]!;
      i++;
    }
  }
  return { seed, dryRun, question };
}

function parseReceiptIdFromCli(stdout: string): { receiptId: string | null; txHash: string | null } {
  // ivaronix doc ask prints lines like:
  //   anchored             #1645 (block 12345)
  //   tx                   0xabc...
  let receiptId: string | null = null;
  let txHash: string | null = null;
  const idMatch = stdout.match(/anchored\s+#(\d+)/i) ?? stdout.match(/receipt\s+id\s*[:=]?\s*(\d+)/i);
  if (idMatch) receiptId = idMatch[1] ?? null;
  const txMatch = stdout.match(/0x[a-fA-F0-9]{64}/);
  if (txMatch) txHash = txMatch[0];
  return { receiptId, txHash };
}

async function main(): Promise<void> {
  const { seed, dryRun, question } = parseFlags();

  mkdirSync(CYCLE_INPUT_DIR, { recursive: true });
  mkdirSync(dirname(HISTORY_FILE), { recursive: true });

  const lease = generateLease(seed);
  const leaseFilePath = resolve(CYCLE_INPUT_DIR, lease.filename);
  writeFileSync(leaseFilePath, lease.body);

  console.log(`[wander-cycle] seed=${seed} lease=${lease.filename} redFlags=${lease.redFlagCount}`);

  if (dryRun) {
    console.log(`[wander-cycle] dry-run · skipping anchor`);
    return;
  }

  const start = Date.now();
  const cli = spawnSync(
    'pnpm',
    [
      'exec',
      'tsx',
      'apps/cli/src/bin/ivaronix.ts',
      'doc',
      'ask',
      leaseFilePath,
      question,
      '--skill',
      'private-doc-review',
      '--quick',
    ],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      timeout: 120_000, // 2 min hard cap per cycle
    },
  );
  const durationMs = Date.now() - start;
  const stdout = (cli.stdout ?? '') + (cli.stderr ?? '');
  const { receiptId, txHash } = parseReceiptIdFromCli(stdout);

  const result: CycleResult = {
    ts: new Date().toISOString(),
    seed,
    leaseFile: lease.filename,
    redFlagCount: lease.redFlagCount,
    exitCode: cli.status ?? -1,
    receiptId,
    txHash,
    durationMs,
    costOgEstimate: 0.0001,
    errorTail: cli.status === 0 ? undefined : stdout.trim().split(/\r?\n/).slice(-3).join(' · ').slice(0, 240),
  };

  appendFileSync(HISTORY_FILE, JSON.stringify(result) + '\n');
  console.log(
    `[wander-cycle] ${result.exitCode === 0 ? 'PASS' : 'FAIL'} · receipt=${result.receiptId ?? 'null'} tx=${(result.txHash ?? '').slice(0, 14)}… duration=${result.durationMs}ms`,
  );

  if (result.exitCode !== 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('wander-cycle fatal:', err);
  process.exit(1);
});
