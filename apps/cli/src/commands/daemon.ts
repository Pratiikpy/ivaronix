import { Command } from 'commander';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { platform as osPlatform } from 'node:os';
import { fileURLToPath } from 'node:url';
import { ui } from '../lib/ui.js';
import {
  NATIVE_HOST_NAME,
  manifestPathFor,
  registryKeyFor,
  buildManifest,
  writeManifest,
  readManifest,
  deleteManifest,
  writeShim,
  writeRegistryKey,
  deleteRegistryKey,
  readRegistryValue,
  type SupportedBrowser,
} from '../lib/native-host.js';

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

    // Receipts are anchored by default — the skill manifest decides via
    // og.permissions.receipt_required. Hardcoding --no-receipt here used to
    // make every receipt_required skill (github-audit, code-edit, etc.) get
    // sandbox-refused on every cycle, which made the daemon unusable as
    // shipped. The user can still opt out by running `ivaronix watch` directly
    // with --no-receipt for skills where the manifest allows it.
    const args: string[] = [
      cliEntry,
      'watch', targetAbs,
      '--interval', opts.interval,
      '--skill', opts.skill,
      '--max-files', opts.maxFiles,
      '--max-runs', '999999',
    ];
    if (opts.quick) args.push('--quick');

    // On Windows, tsx is a .cmd shim and spawn() cannot CreateProcess a .cmd
    // directly — it returns EINVAL. shell: true delegates to cmd.exe which can
    // run the shim. POSIX systems use the binary path directly (no shell).
    const isWin = process.platform === 'win32';
    const child = spawn(tsxBin, args, {
      detached: true,
      stdio: ['ignore', out, err],
      cwd: process.cwd(),
      env: process.env,
      shell: isWin,
      windowsHide: true,
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

// ─── native-host pairing (PASS 76 S-4) ──────────────────────────────────────
// Lift from Trapezohe companion-cli's register-native-host pattern. Writes
// the Chromium-family native-messaging manifest (and on Windows, the HKCU
// registry key pointing at it) so a future browser extension can discover
// the daemon without users hand-copying tokens. Manifest contents per
// developer.chrome.com/docs/extensions/develop/concepts/native-messaging.

const DEFAULT_BROWSERS: SupportedBrowser[] = ['chrome', 'brave', 'edge'];

function parseBrowsers(input?: string): SupportedBrowser[] {
  if (!input) return DEFAULT_BROWSERS;
  const list = input
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as SupportedBrowser[];
  for (const b of list) {
    if (!DEFAULT_BROWSERS.includes(b)) throw new Error(`unsupported browser: ${b}`);
  }
  return list;
}

/**
 * Resolve the absolute path to the running CLI's bin entry. Used as the
 * target the shim file forwards to. Resolves from import.meta.url so it
 * works whether running from src (tsx) or dist (built bin).
 */
function cliEntryPath(): string {
  const here = fileURLToPath(import.meta.url);
  // We're at .../apps/cli/{src,dist}/commands/daemon.ts (.js)
  // The bin lives at .../apps/cli/{src,dist}/bin/ivaronix.ts (.js)
  const cliRoot = resolve(here, '..', '..');
  const ts = resolve(cliRoot, 'bin', 'ivaronix.ts');
  const js = resolve(cliRoot, 'bin', 'ivaronix.js');
  return existsSync(ts) ? ts : js;
}

daemonCommand
  .command('register-host')
  .description('Register the Ivaronix daemon as a browser native-messaging host')
  .option(
    '--browser <list>',
    'Comma-separated list of chrome,brave,edge — default all',
  )
  .option(
    '--allowed-origin <origin>',
    'Origin allowed to message the host. Replace with your real extension id later.',
    'chrome-extension://REPLACE_WITH_REAL_EXTENSION_ID/',
  )
  .action((opts: { browser?: string; allowedOrigin: string }) => {
    let browsers: SupportedBrowser[];
    try {
      browsers = parseBrowsers(opts.browser);
    } catch (err) {
      ui.fail((err as Error).message);
      process.exitCode = 1;
      return;
    }
    const cli = cliEntryPath();
    const shim = writeShim(cli);
    const manifest = buildManifest({
      allowedOrigin: opts.allowedOrigin,
      cliEntryAbsolutePath: cli,
    });

    ui.title('ivaronix daemon · register-host');
    ui.info(`name                 ${NATIVE_HOST_NAME}`);
    ui.info(`shim                 ${shim}`);
    ui.info(`allowed-origin       ${opts.allowedOrigin}`);
    ui.divider();

    for (const browser of browsers) {
      const manifestPath = writeManifest(manifest, browser);
      ui.pass(`${browser.padEnd(8)} manifest    ${manifestPath}`);
      if (osPlatform() === 'win32') {
        writeRegistryKey(browser, manifestPath);
        ui.pass(`${browser.padEnd(8)} reg-key     ${registryKeyFor(browser)}`);
      }
    }
    ui.divider();
    ui.hint('Verify: ivaronix daemon host-info');
    if (opts.allowedOrigin.includes('REPLACE_WITH_REAL_EXTENSION_ID')) {
      ui.hint('Re-run with --allowed-origin "chrome-extension://<your-extension-id>/" once you have one.');
    }
  });

daemonCommand
  .command('unregister-host')
  .description('Remove the Ivaronix native-messaging manifest + registry keys')
  .option('--browser <list>', 'Comma-separated list of chrome,brave,edge — default all')
  .action((opts: { browser?: string }) => {
    let browsers: SupportedBrowser[];
    try {
      browsers = parseBrowsers(opts.browser);
    } catch (err) {
      ui.fail((err as Error).message);
      process.exitCode = 1;
      return;
    }
    ui.title('ivaronix daemon · unregister-host');
    for (const browser of browsers) {
      const removedManifest = deleteManifest(browser);
      ui.info(`${browser.padEnd(8)} manifest    ${removedManifest ? 'removed' : '(absent)'}`);
      if (osPlatform() === 'win32') {
        const removedKey = deleteRegistryKey(browser);
        ui.info(`${browser.padEnd(8)} reg-key     ${removedKey ? 'removed' : '(absent)'}`);
      }
    }
  });

daemonCommand
  .command('host-info')
  .description('Print the currently registered native-messaging host(s)')
  .option('--browser <list>', 'Comma-separated list of chrome,brave,edge — default all')
  .action((opts: { browser?: string }) => {
    let browsers: SupportedBrowser[];
    try {
      browsers = parseBrowsers(opts.browser);
    } catch (err) {
      ui.fail((err as Error).message);
      process.exitCode = 1;
      return;
    }
    ui.title('ivaronix daemon · host-info');
    for (const browser of browsers) {
      const manifest = readManifest(browser);
      ui.info(`---- ${browser} ----`);
      if (!manifest) {
        ui.info(`  manifest             (not registered)`);
      } else {
        ui.pass(`  manifest             ${manifestPathFor(browser)}`);
        ui.info(`  name                 ${manifest.name}`);
        ui.info(`  path (shim)          ${manifest.path}`);
        ui.info(`  type                 ${manifest.type}`);
        ui.info(`  allowed_origins      ${manifest.allowed_origins.join(', ')}`);
      }
      if (osPlatform() === 'win32') {
        const reg = readRegistryValue(browser);
        if (reg) {
          ui.pass(`  reg-key value        ${reg}`);
        } else {
          ui.info(`  reg-key value        (not set)`);
        }
      }
    }
  });

// Stdio bridge stub. Real protocol handling lands when an extension exists;
// for now the subcommand exists so the registered shim has a real target —
// `daemon register-host` writes a shim that execs us with this verb. Echoes
// a length-prefixed JSON ack per Chrome's framed-stdio protocol so a manual
// test (echo a framed message in, see a framed message out) verifies
// end-to-end pairing without needing the extension.
daemonCommand
  .command('native-host-stdio', { hidden: true })
  .description('Internal: stdio bridge for browser native-messaging hosts (Phase B — no extension shipped yet; verb echoes for harness pairing only)')
  .action(() => {
    process.stdin.on('data', (chunk: Buffer) => {
      // Parse Chrome's framed protocol: 4-byte little-endian length + JSON body.
      let i = 0;
      while (i + 4 <= chunk.length) {
        const len = chunk.readUInt32LE(i);
        if (i + 4 + len > chunk.length) break;
        const body = chunk.slice(i + 4, i + 4 + len).toString('utf8');
        i += 4 + len;
        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = { error: 'invalid-json', raw: body };
        }
        const reply = JSON.stringify({ ok: true, echo: parsed, host: NATIVE_HOST_NAME });
        const replyBuf = Buffer.from(reply, 'utf8');
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32LE(replyBuf.length, 0);
        process.stdout.write(Buffer.concat([lenBuf, replyBuf]));
      }
    });
    process.stdin.on('end', () => process.exit(0));
  });
