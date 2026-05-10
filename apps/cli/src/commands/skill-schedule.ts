import { Command } from 'commander';
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { ulid, studioUrl } from '@ivaronix/core';
import { docCommand } from './doc.js';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

/**
 * Cron-scheduled skill execution (planning-01 §2C).
 *
 * Persistent local schedules that fire either manually (one-shot) or through
 * a long-running daemon. Each fire dispatches `ivaronix doc ask` in-process
 * with the scheduled skill + input + question, so every fire produces a
 * normal anchored receipt — verifiable, paid by the operator's wallet, and
 * subject to the same fee-split routing as a manual run.
 *
 * Honest disclosure: schedules only fire when `ivaronix skill schedule run`
 * is up. There is no autonomous remote daemon yet — the operator's machine
 * is the executor. The list view says so.
 */

interface ScheduleEntry {
  scheduleId: string;
  skillId: string;
  cron: string;
  /** Either a path to a doc file, or the raw text body to pass as input. */
  inputKind: 'doc' | 'prompt';
  inputValue: string;
  question: string;
  tier: 'quick' | 'standard' | 'high-stakes';
  maxRuns: number | null;
  runCount: number;
  lastRunAt: number | null;
  lastReceiptId: string | null;
  createdAt: number;
  ownerWallet: string;
  network: string;
}

function schedulesDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return resolve(dir, '.ivaronix', 'schedules');
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), '.ivaronix', 'schedules');
}

function schedulePath(id: string): string {
  return resolve(schedulesDir(), `${id}.json`);
}

function loadSchedule(id: string): ScheduleEntry | null {
  const path = schedulePath(id);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')) as ScheduleEntry; }
  catch { return null; }
}

function saveSchedule(s: ScheduleEntry): void {
  const path = schedulePath(s.scheduleId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(s, null, 2));
}

function loadAllSchedules(): ScheduleEntry[] {
  const dir = schedulesDir();
  if (!existsSync(dir)) return [];
  const out: ScheduleEntry[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try { out.push(JSON.parse(readFileSync(resolve(dir, f), 'utf8')) as ScheduleEntry); }
    catch { /* skip malformed */ }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

function findScheduleByPrefix(prefix: string): ScheduleEntry | null {
  const dir = schedulesDir();
  if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir)) {
    if (f.startsWith(prefix) && f.endsWith('.json')) {
      return loadSchedule(f.replace(/\.json$/, ''));
    }
  }
  return null;
}

/**
 * Minimal cron evaluator — supports the patterns we actually use:
 *   `*` (any), `*\/N` (every N), `<num>` (exact), `a,b,c` (list).
 * Only fires once per matching minute (caller tracks `lastRunAt`).
 * Fields: minute hour day month dayOfWeek.
 */
function cronMatches(cronExpr: string, date: Date): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const fields: Array<[number, number]> = [
    [date.getMinutes(), 0],
    [date.getHours(), 0],
    [date.getDate(), 1],
    [date.getMonth() + 1, 1],
    [date.getDay(), 0], // 0..6 (Sunday=0)
  ];
  for (let i = 0; i < 5; i++) {
    const [val] = fields[i]!;
    if (!matchesField(parts[i]!, val)) return false;
  }
  return true;
}

function matchesField(field: string, value: number): boolean {
  if (field === '*') return true;
  if (field.includes(',')) return field.split(',').some((p) => matchesField(p, value));
  if (field.startsWith('*/')) {
    const step = Number(field.slice(2));
    return Number.isFinite(step) && step > 0 && value % step === 0;
  }
  return Number(field) === value;
}

async function fireOnce(s: ScheduleEntry, env: ReturnType<typeof loadEnv>): Promise<{ ok: boolean; receiptId: string | null }> {
  if (env.network !== s.network) {
    ui.fail(`schedule was created on ${s.network} but env is ${env.network}`);
    return { ok: false, receiptId: null };
  }

  const inputArg = s.inputKind === 'doc'
    ? (existsSync(s.inputValue) ? s.inputValue : resolve(process.cwd(), s.inputValue))
    : s.inputValue;

  if (s.inputKind === 'doc' && !existsSync(inputArg)) {
    ui.fail(`scheduled doc not found at ${inputArg}`);
    return { ok: false, receiptId: null };
  }

  const tierFlag = s.tier === 'quick' ? '--quick'
    : s.tier === 'standard' ? '--consensus'
    : '--high-stakes';
  const args = ['node', 'doc', 'ask', inputArg, s.question, '--skill', s.skillId, tierFlag];

  ui.title(`firing schedule ${s.scheduleId.slice(0, 12)}…`);
  ui.info(`skill                ${s.skillId}`);
  ui.info(`cron                 ${s.cron}`);
  ui.info(`tier                 ${s.tier}`);
  ui.info(`run count            ${s.runCount + 1}${s.maxRuns ? `/${s.maxRuns}` : ''}`);
  ui.divider();

  // Capture the latest anchored receipt id by snapshotting the count before
  // the run, then reading directory contents after.
  const env2 = loadEnv();
  const receiptsDirGuess = resolve(process.cwd(), '.ivaronix', 'receipts', 'anchored');
  const before = existsSync(receiptsDirGuess) ? readdirSync(receiptsDirGuess) : [];

  let ok = false;
  try {
    process.exitCode = 0;
    await docCommand.parseAsync(args);
    ok = process.exitCode === 0 || process.exitCode === undefined;
  } catch (err) {
    ui.fail('schedule fire failed', ((err as Error).message.split('\n')[0] ?? '').slice(0, 120));
    ok = false;
  }

  // Best-effort receipt capture
  let newReceiptId: string | null = null;
  if (existsSync(receiptsDirGuess)) {
    const after = readdirSync(receiptsDirGuess);
    const fresh = after.filter((f) => !before.includes(f) && f.startsWith('rcpt_'));
    if (fresh.length > 0) {
      newReceiptId = (fresh[fresh.length - 1] ?? '').replace(/\.json$/, '');
    }
  }

  // Persist run state
  s.runCount += 1;
  s.lastRunAt = Date.now();
  if (newReceiptId) s.lastReceiptId = newReceiptId;
  saveSchedule(s);

  return { ok, receiptId: newReceiptId };
}

export function addScheduleCommand(parent: Command): void {
  const schedule = parent
    .command('schedule')
    .description('Schedule autonomous skill runs (planning-01 §2C)');

  // ─── create ────────────────────────────────────────────────────────────
  schedule
    .command('create')
    .description('Register a new scheduled skill run')
    .requiredOption('--skill <id>', 'skill id (e.g. private-doc-review)')
    .requiredOption('--cron <expr>', 'cron expression (e.g. "0 9 * * MON" or "*/30 * * * *")')
    .requiredOption('--input <value>', 'doc path OR raw prompt text (use --prompt to mark as prompt)')
    .option('--prompt', 'treat --input as raw prompt text instead of a file path')
    .option('--question <q>', 'question to ask the skill', 'Run the standard review.')
    .option('--tier <tier>', 'consensus tier (quick / standard / high-stakes)', 'quick')
    .option('--max-runs <n>', 'maximum number of fires (default unlimited)', '')
    .action((opts: { skill: string; cron: string; input: string; prompt?: boolean; question: string; tier: string; maxRuns: string }) => {
      const env = loadEnv();
      if (!env.walletAddress) {
        ui.fail('schedule create requires IVARONIX_WALLET_ADDRESS (legacy: EVM_WALLET_ADDRESS) in .env');
        process.exitCode = 1;
        return;
      }

      const id = ulid();
      const tier = (opts.tier === 'standard' || opts.tier === 'high-stakes' ? opts.tier : 'quick') as ScheduleEntry['tier'];
      const inputKind: 'doc' | 'prompt' = opts.prompt ? 'prompt' : 'doc';
      let inputValue = opts.input;
      if (inputKind === 'doc') {
        const abs = resolve(opts.input);
        if (!existsSync(abs)) {
          ui.fail(`input doc not found: ${abs}`);
          ui.hint(`Use --prompt to pass a raw prompt instead of a file path.`);
          process.exitCode = 1;
          return;
        }
        inputValue = abs;
      }

      const entry: ScheduleEntry = {
        scheduleId: id,
        skillId: opts.skill,
        cron: opts.cron,
        inputKind,
        inputValue,
        question: opts.question,
        tier,
        maxRuns: opts.maxRuns ? Number(opts.maxRuns) : null,
        runCount: 0,
        lastRunAt: null,
        lastReceiptId: null,
        createdAt: Date.now(),
        ownerWallet: env.walletAddress,
        network: env.network,
      };
      saveSchedule(entry);

      ui.title(`Schedule created · ${id.slice(0, 12)}…`);
      ui.info(`skill                ${entry.skillId}`);
      ui.info(`cron                 ${entry.cron}`);
      ui.info(`input                ${entry.inputKind === 'doc' ? entry.inputValue : '(prompt) ' + entry.inputValue.slice(0, 80) + (entry.inputValue.length > 80 ? '…' : '')}`);
      ui.info(`tier                 ${entry.tier}`);
      ui.info(`max runs             ${entry.maxRuns ?? 'unlimited'}`);
      ui.info(`saved                ${schedulePath(id)}`);
      ui.divider();
      ui.hint(`Fire once now:    ivaronix skill schedule fire ${id.slice(0, 12)}`);
      ui.hint(`Run daemon:       ivaronix skill schedule run`);
      ui.hint(`Studio:           ${studioUrl('/dashboard')}`);
    });

  // ─── list ──────────────────────────────────────────────────────────────
  schedule
    .command('list')
    .description('List local schedules with their state')
    .action(() => {
      const all = loadAllSchedules();
      if (all.length === 0) {
        ui.info('(no schedules yet — create one with `ivaronix skill schedule create --skill <id> --cron "*/30 * * * *" --input <doc>`)');
        return;
      }
      ui.title(`Schedules in ${schedulesDir()}`);
      for (const s of all) {
        const last = s.lastRunAt ? new Date(s.lastRunAt).toISOString().slice(0, 16).replace('T', ' ') : 'never';
        const cap = s.maxRuns ? `${s.runCount}/${s.maxRuns}` : `${s.runCount}/∞`;
        ui.info(`${s.scheduleId.slice(0, 12)}…  ${s.skillId.padEnd(28)}  cron "${s.cron}"  runs ${cap}  last ${last}`);
      }
      ui.divider();
      ui.hint(`Schedules fire only when \`ivaronix skill schedule run\` is up. There is no remote daemon — the operator's machine is the executor.`);
    });

  // ─── fire ──────────────────────────────────────────────────────────────
  schedule
    .command('fire <scheduleId>')
    .description('Fire a schedule once now (manual one-shot — for demos and one-offs)')
    .action(async (rawId: string) => {
      const env = loadEnv();
      const s = findScheduleByPrefix(rawId);
      if (!s) { ui.fail(`schedule "${rawId}" not found`); process.exitCode = 1; return; }
      if (s.maxRuns !== null && s.runCount >= s.maxRuns) {
        ui.fail(`schedule has reached max-runs (${s.runCount}/${s.maxRuns})`);
        process.exitCode = 1;
        return;
      }
      const r = await fireOnce(s, env);
      ui.divider();
      if (r.ok) {
        ui.pass(`fire complete  receipt ${r.receiptId ?? '(unknown — check .ivaronix/receipts/anchored/)'}`);
      } else {
        ui.fail(`fire failed`);
      }
    });

  // ─── remove ────────────────────────────────────────────────────────────
  schedule
    .command('remove <scheduleId>')
    .alias('rm')
    .description('Delete a schedule (does not affect already-anchored receipts)')
    .action((rawId: string) => {
      const s = findScheduleByPrefix(rawId);
      if (!s) { ui.fail(`schedule "${rawId}" not found`); process.exitCode = 1; return; }
      unlinkSync(schedulePath(s.scheduleId));
      ui.pass(`removed ${s.scheduleId.slice(0, 12)}… (${s.skillId})`);
    });

  // ─── run (daemon) ──────────────────────────────────────────────────────
  schedule
    .command('run')
    .description('Run the schedule daemon — polls every minute and fires schedules whose cron matches')
    .option('--once', 'evaluate the cron expressions once, fire any matches, then exit (for testing)')
    .option('--max-iterations <n>', 'stop after N polling iterations (default unlimited)', '')
    .action(async (opts: { once?: boolean; maxIterations: string }) => {
      const env = loadEnv();
      ui.title('Schedule daemon');
      ui.info(`schedules dir        ${schedulesDir()}`);
      ui.info(`poll interval        60s`);
      ui.info(`mode                 ${opts.once ? 'once' : opts.maxIterations ? `max ${opts.maxIterations} iterations` : 'forever'}`);
      ui.hint(`Press Ctrl+C to stop. Schedules fire only while this process is up.`);
      ui.divider();

      let iterations = 0;
      const maxIter = opts.maxIterations ? Number(opts.maxIterations) : (opts.once ? 1 : Infinity);
      const lastFiredMinute: Record<string, number> = {};

      // Polling loop. We poll once per minute and fire any schedule whose
      // cron matches the current minute, but never the same schedule twice
      // for the same minute (lastFiredMinute guards against multi-fire if
      // poll is faster than 60s).
      while (iterations < maxIter) {
        iterations++;
        const now = new Date();
        const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
        const schedules = loadAllSchedules();

        for (const s of schedules) {
          if (s.maxRuns !== null && s.runCount >= s.maxRuns) continue;
          const minuteEpoch = Math.floor(now.getTime() / 60_000);
          if (lastFiredMinute[s.scheduleId] === minuteEpoch) continue;
          if (!cronMatches(s.cron, now)) continue;

          ui.info(`[${now.toISOString().slice(0, 19)}Z] firing ${s.scheduleId.slice(0, 12)}… (${s.skillId})`);
          lastFiredMinute[s.scheduleId] = minuteEpoch;
          try {
            const fresh = loadSchedule(s.scheduleId) ?? s;
            await fireOnce(fresh, env);
          } catch (err) {
            ui.fail(`fire threw`, ((err as Error).message.split('\n')[0] ?? '').slice(0, 120));
          }
        }

        if (iterations >= maxIter) break;
        await new Promise((r) => setTimeout(r, 60_000));
      }

      ui.divider();
      ui.pass(`daemon exited after ${iterations} iteration${iterations === 1 ? '' : 's'}`);
    });
}
