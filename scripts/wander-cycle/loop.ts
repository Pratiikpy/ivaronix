/**
 * Continuous wander-cycle wrapper. Runs `cycle.ts` every N minutes.
 *
 * Operator-runnable on a CI-funded wallet (USER_TODO §B-V2-7). Designed
 * to be daemonised under systemd, Docker, or Windows Task Scheduler;
 * the script itself is a long-lived Node process.
 *
 * Usage:
 *   pnpm wander:loop                       # 5-min cadence (default)
 *   pnpm wander:loop --interval 600        # 10-min cadence
 *   pnpm wander:loop --max-cycles 10       # stop after 10 iterations
 *
 * On each cycle: spawns `cycle.ts`, captures result, logs the iteration
 * counter + total cost. On error: logs + continues; the cycle script's
 * own JSONL append already records the failure for later replay.
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

function parseFlags(): { intervalSec: number; maxCycles: number } {
  const args = process.argv.slice(2);
  let intervalSec = 300; // 5 min default
  let maxCycles = 0; // 0 = run forever
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--interval' && args[i + 1]) {
      intervalSec = Number(args[i + 1]);
      i++;
    } else if (a === '--max-cycles' && args[i + 1]) {
      maxCycles = Number(args[i + 1]);
      i++;
    }
  }
  return { intervalSec, maxCycles };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const { intervalSec, maxCycles } = parseFlags();
  console.log(`[wander-loop] starting · interval=${intervalSec}s · maxCycles=${maxCycles || 'forever'}`);

  let count = 0;
  const startedAt = Date.now();

  // Trap ctrl-c for clean shutdown.
  let shutdown = false;
  process.on('SIGINT', () => {
    console.log(`\n[wander-loop] SIGINT received · stopping after current cycle`);
    shutdown = true;
  });
  process.on('SIGTERM', () => {
    console.log(`\n[wander-loop] SIGTERM received · stopping after current cycle`);
    shutdown = true;
  });

  while (!shutdown && (maxCycles === 0 || count < maxCycles)) {
    count++;
    const cycleStart = Date.now();
    console.log(`[wander-loop] cycle ${count} starting at ${new Date().toISOString()}`);

    const result = spawnSync('pnpm', ['exec', 'tsx', resolve(HERE, 'cycle.ts')], {
      cwd: resolve(HERE, '..', '..'),
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });

    const cycleMs = Date.now() - cycleStart;
    if (result.status === 0) {
      console.log(`[wander-loop] cycle ${count} PASS in ${cycleMs}ms`);
    } else {
      console.error(`[wander-loop] cycle ${count} FAIL exit=${result.status} in ${cycleMs}ms · continuing`);
    }

    if (shutdown) break;
    if (maxCycles > 0 && count >= maxCycles) break;

    const sleepMs = Math.max(0, intervalSec * 1000 - cycleMs);
    if (sleepMs > 0) {
      console.log(`[wander-loop] sleeping ${(sleepMs / 1000).toFixed(0)}s until next cycle`);
      await sleep(sleepMs);
    }
  }

  const elapsedMin = (Date.now() - startedAt) / 60_000;
  console.log(`[wander-loop] stopped after ${count} cycle(s) over ${elapsedMin.toFixed(1)} min`);
}

main().catch((err) => {
  console.error('[wander-loop] fatal:', err);
  process.exit(1);
});
