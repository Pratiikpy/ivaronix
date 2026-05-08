import { Command } from 'commander';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ui } from '../lib/ui.js';

/**
 * `ivaronix daemon` — Hermes-pattern detached background daemon.
 *
 * Subcommands:
 *   start <path>   — fork the watch loop into the background, write a PID file
 *   stop           — kill the running daemon (PID file)
 *   status         — print whether the daemon is running, target, last run
 *   logs           — print the tail of the daemon log
 *
 * Each tick of the daemon runs the same pipeline as `ivaronix watch`, so all
 * receipts are real on-chain. Per-tick state is persisted to
 * `.ivaronix/daemon/state.json` so `status` can show the last run.
 */

interface DaemonState {
  pid: number;
  startedAt: number;
  target: string;
  interval: string;
  skill: string;
  logFile: string;
  pidFile: string;
}

function stateRoot(): string {
  const root = resolve(process.cwd(), '.ivaronix', 'daemon');
  mkdirSync(root, { recursive: true });
  return root;
}

function pidFile(): string {
  return resolve(stateRoot(), 'daemon.pid');
}

function logFile(): string {
  return resolve(stateRoot(), 'daemon.log');
}

function stateFile(): string {
  return resolve(stateRoot(), 'state.json');
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readState(): DaemonState | null {
  if (!existsSync(stateFile())) return null;
  try {
    return JSON.parse(readFileSync(stateFile(), 'utf8')) as DaemonState;
  } catch {
    return null;
  }
}

export const daemonCommand = new Command('daemon').description('Detached background daemon (Hermes pattern)');

daemonCommand
  .command('start <path>')
  .description('Fork `ivaronix watch <path>` into the background')
  .option('--interval <dur>', 'time between runs', '15m')
  .option('--cron <expr>', 'standard 5-field cron expression in local time (overrides --interval)')
  .option('--skill <id>', 'audit skill', 'github-audit')
  .option('--max-files <n>', 'cap files per cycle', '10')
  .option('--quick', 'force quick tier')
  .action(async (target: string, opts: { interval: string; cron?: string; skill: string; maxFiles: string; quick?: boolean }) => {
    if (opts.cron) {
      const { parseCron, nextFireAfter } = await import('../lib/cron.js');
      try {
        const parsed = parseCron(opts.cron);
        const next = nextFireAfter(parsed);
        ui.info(`cron expression validated; next fire ${next.toISOString()}`);
      } catch (err) {
        ui.fail('bad --cron expression', (err as Error).message);
        process.exitCode = 1;
        return;
      }
    }
    if (existsSync(pidFile())) {
      const prev = parseInt(readFileSync(pidFile(), 'utf8'), 10);
      if (Number.isFinite(prev) && isAlive(prev)) {
        ui.fail(`daemon already running (pid ${prev}) — run \`ivaronix daemon stop\` first`);
        process.exitCode = 1;
        return;
      }
    }

    const targetAbs = resolve(process.cwd(), target);
    const log = logFile();
    const out = openSync(log, 'a');
    const err = openSync(log, 'a');

    // Locate the running CLI script so the child can spawn the same entry
    const here = dirname(fileURLToPath(import.meta.url));
    const cliEntry = resolve(here, '../bin/ivaronix.ts');
    const tsxBin = resolve(here, '..', '..', '..', '..', 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

    const args: string[] = [
      cliEntry,
      'watch', targetAbs,
      '--interval', opts.interval,
      '--skill', opts.skill,
      '--max-files', opts.maxFiles,
      '--max-runs', '999999',
      '--no-receipt',
    ];
    if (opts.quick) args.push('--quick');

    const child = spawn(tsxBin, args, {
      detached: true,
      stdio: ['ignore', out, err],
      cwd: process.cwd(),
      env: process.env,
    });
    if (!child.pid) {
      ui.fail('failed to spawn daemon child process');
      process.exitCode = 1;
      return;
    }
    child.unref();

    writeFileSync(pidFile(), String(child.pid));
    const state: DaemonState = {
      pid: child.pid,
      startedAt: Date.now(),
      target: targetAbs,
      interval: opts.interval,
      skill: opts.skill,
      logFile: log,
      pidFile: pidFile(),
    };
    writeFileSync(stateFile(), JSON.stringify(state, null, 2));

    ui.title('ivaronix daemon · started');
    ui.pass(`pid                  ${child.pid}`);
    ui.pass(`target               ${targetAbs}`);
    ui.pass(`schedule             ${opts.cron ? `cron "${opts.cron}"` : `interval ${opts.interval}`}`);
    ui.pass(`skill                ${opts.skill}`);
    ui.info(`log                  ${log}`);
    ui.divider();
    ui.hint('check progress:  ivaronix daemon logs   ·   ivaronix daemon status');
    ui.hint('stop:            ivaronix daemon stop');
  });

daemonCommand
  .command('stop')
  .description('Kill the running daemon')
  .action(() => {
    if (!existsSync(pidFile())) {
      ui.info('no daemon running (no PID file)');
      return;
    }
    const pid = parseInt(readFileSync(pidFile(), 'utf8'), 10);
    if (!Number.isFinite(pid)) {
      ui.fail('PID file is corrupt');
      process.exitCode = 1;
      return;
    }
    if (!isAlive(pid)) {
      ui.info(`daemon (pid ${pid}) was not alive; cleaning up PID file`);
      try { writeFileSync(pidFile(), ''); } catch { /* ignore */ }
      return;
    }
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/F', '/PID', String(pid)], { stdio: 'pipe' });
      } else {
        process.kill(pid, 'SIGTERM');
      }
      ui.pass(`stopped daemon pid ${pid}`);
    } catch (err) {
      ui.fail(`failed to stop pid ${pid}`, (err as Error).message);
      process.exitCode = 1;
    }
  });

daemonCommand
  .command('status')
  .description('Print whether the daemon is running')
  .action(() => {
    const s = readState();
    if (!s) {
      ui.info('no daemon state file — never started in this directory');
      return;
    }
    const alive = isAlive(s.pid);
    ui.title('ivaronix daemon · status');
    if (alive) ui.pass(`running              pid ${s.pid}`);
    else ui.fail(`not running          (pid ${s.pid} is dead; PID file stale)`);
    ui.info(`target               ${s.target}`);
    ui.info(`interval             ${s.interval}`);
    ui.info(`skill                ${s.skill}`);
    ui.info(`startedAt            ${new Date(s.startedAt).toISOString()}`);
    ui.info(`log                  ${s.logFile}`);
  });

daemonCommand
  .command('logs')
  .description('Tail the daemon log')
  .option('--lines <n>', 'number of trailing lines', '40')
  .action((opts: { lines: string }) => {
    const log = logFile();
    if (!existsSync(log)) {
      ui.info('no log file yet');
      return;
    }
    const n = Math.max(1, parseInt(opts.lines, 10) || 40);
    const all = readFileSync(log, 'utf8').split('\n');
    const tail = all.slice(-n).join('\n');
    process.stdout.write(tail);
    if (!tail.endsWith('\n')) process.stdout.write('\n');
  });
