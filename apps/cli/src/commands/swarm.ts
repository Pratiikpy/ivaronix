import { Command } from 'commander';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runPipeline } from '../lib/pipeline.js';
import { ui } from '../lib/ui.js';
import { resolveUserPath } from '../lib/user-cwd.js';

/**
 * `ivaronix swarm run <todo.md>` — parent/worker mode with optional worktree
 * isolation (Octogent pattern).
 *
 * Without --worktree: tasks run sequentially in the current cwd.
 * With --worktree: each task runs in a fresh `git worktree add <path> -b
 * swarm/<ts-slug> HEAD` so workers can edit independent branches without
 * stepping on each other. Each worker gets `CONTEXT.md`, `notes.md`, and
 * `result.md` scaffolded into its worktree.
 */
export const swarmCommand = new Command('swarm').description('Multi-task parent/worker dispatch with optional worktree isolation');

function parseTasks(text: string): string[] {
  const tasks: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#/.test(line)) continue;
    const m = line.match(/^(?:-\s*\[\s*[ x]\s*\]|[-*+]|\d+[.)])\s+(.+)$/);
    if (m) tasks.push(m[1]!.trim());
  }
  return tasks;
}

function isInsideGitRepo(): boolean {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function gitRepoRoot(): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
}

function shortBranchSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'task';
}

function tryAddWorktree(branch: string, worktreePath: string): { ok: boolean; reason?: string } {
  try {
    execFileSync('git', ['worktree', 'add', worktreePath, '-b', branch, 'HEAD'], { stdio: 'pipe' });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as { stderr?: string; message: string }).stderr?.toString() ?? (err as Error).message };
  }
}

function removeWorktree(worktreePath: string) {
  try {
    execFileSync('git', ['worktree', 'remove', '--force', worktreePath], { stdio: 'pipe' });
  } catch {
    /* best-effort */
  }
}

swarmCommand
  .command('run <todo>')
  .description('Run every task in a todo.md as a separate consensus pass')
  .option('--skill <id>', 'skill to use for each task', 'plan-step')
  .option('--max <n>', 'cap the number of tasks dispatched', '20')
  .option('--quick', 'force quick tier')
  .option('--consensus', 'force standard 3-role consensus')
  .option('--high-stakes', 'use 5-role high-stakes consensus')
  .option('--no-receipt', 'skip receipt anchoring per task')
  .option('--worktree', 'run each task inside an isolated git worktree (Octogent pattern)')
  .option('--worktree-root <dir>', 'where to create worktrees', '.ivaronix/swarm')
  .option('--cleanup', 'remove every worktree at the end of the run')
  .option('--out-dir <dir>', 'where to write receipt JSON', '.ivaronix/receipts/anchored')
  .action(async (todoPath: string, opts: { skill: string; max: string; quick?: boolean; consensus?: boolean; highStakes?: boolean; receipt: boolean; worktree?: boolean; worktreeRoot: string; cleanup?: boolean; outDir: string }) => {
    let tier: 'quick' | 'standard' | 'high-stakes' | undefined;
    if (opts.highStakes) tier = 'high-stakes';
    else if (opts.consensus) tier = 'standard';
    else if (opts.quick) tier = 'quick';

    const todoAbs = resolveUserPath(todoPath);
    let raw: string;
    try {
      raw = readFileSync(todoAbs, 'utf8');
    } catch (err) {
      ui.fail(`cannot read ${todoPath}`, (err as Error).message);
      process.exitCode = 1;
      return;
    }
    const tasks = parseTasks(raw).slice(0, Math.max(1, parseInt(opts.max, 10) || 20));
    if (tasks.length === 0) {
      ui.fail(`no tasks parsed from ${todoPath}`, 'expected markdown bullets or numbered list');
      process.exitCode = 1;
      return;
    }

    const ctxPath = todoAbs.replace(/\.md$/, '.context.md');
    const sharedContext = existsSync(ctxPath) ? readFileSync(ctxPath, 'utf8') : '';

    const useWorktree = !!opts.worktree && isInsideGitRepo();
    if (opts.worktree && !useWorktree) {
      ui.fail('--worktree requested but not inside a git repo — falling back to flat run');
    }

    ui.title(`swarm: ${todoPath}  (${tasks.length} task${tasks.length === 1 ? '' : 's'})${useWorktree ? '  · worktree-isolated' : ''}`);
    if (sharedContext) ui.info(`shared context loaded from ${basename(ctxPath)} (${sharedContext.length} chars)`);
    ui.divider();

    const repoRoot = gitRepoRoot();
    const worktreeRootAbs = resolve(repoRoot, opts.worktreeRoot);

    let pass = 0;
    let fail = 0;
    const receipts: string[] = [];
    const worktrees: string[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]!;
      const label = `task ${i + 1}/${tasks.length}`;
      const slug = shortBranchSlug(t);
      const branch = `swarm/${Date.now()}-${i + 1}-${slug}`;
      const wtPath = useWorktree ? join(worktreeRootAbs, branch.replace(/\//g, '_')) : null;

      if (useWorktree && wtPath) {
        mkdirSync(worktreeRootAbs, { recursive: true });
        const r = tryAddWorktree(branch, wtPath);
        if (!r.ok) {
          ui.fail(`[${label}] worktree add failed`, r.reason?.split('\n')[0] ?? 'unknown');
          fail++;
          continue;
        }
        worktrees.push(wtPath);
        writeFileSync(
          join(wtPath, 'CONTEXT.md'),
          `# Task ${i + 1}/${tasks.length}\n\n## Goal\n${t}\n\n## Shared context\n${sharedContext || '(none)'}\n`,
          'utf8',
        );
        writeFileSync(join(wtPath, 'notes.md'), `# notes — ${slug}\n\n`, 'utf8');
      }

      try {
        const result = await runPipeline({
          skillId: opts.skill,
          context: sharedContext ? `${sharedContext}\n\n--- TASK ---\n${t}` : '(swarm task — no additional context provided)',
          userPrompt: t,
          tier,
          receipt: opts.receipt,
          outDir: opts.outDir,
          // B-V2-31 fix (✅ SHIPPED iter-72) · swarm-dispatched tasks anchor
          // as receipt-type 'swarm' (slot 8 in RECEIPT_TYPES + TYPE_SWARM=8 on
          // ReceiptRegistryV2). Pre-fix the tasks were typed 'doc_ask' (slot 0),
          // so RECEIPT_TYPES.swarm was enum-only with no on-chain producer.
          // Iter-14 cron drove `ivaronix swarm run` and caught the gap.
          // This is the option-A flip (per-task type) — minimal scope.
          // A future option-B variant (parent aggregate receipt with
          // priorReceiptIds lineage of every child task) is queued separately
          // as a UX enhancement, not a bug fix.
          receiptType: 'swarm',
          label,
        });
        ui.divider();
        ui.section(t);
        console.log(result.finalText);
        ui.divider();
        if (result.receiptId) receipts.push(result.receiptId);
        pass++;

        if (useWorktree && wtPath) {
          writeFileSync(
            join(wtPath, 'result.md'),
            `# result — ${slug}\n\n${result.finalText}\n\n---\n\n_receipt:_ ${result.receiptId ?? '(none)'}\n_tx:_ ${result.receiptTxHash ?? '(none)'}\n_onchain id:_ ${result.receiptOnchainId?.toString() ?? '(none)'}\n`,
            'utf8',
          );
        }
      } catch (err) {
        ui.fail(`[${label}] failed`, (err as Error).message);
        fail++;
      }
    }

    ui.divider();
    if (useWorktree && worktrees.length > 0) {
      ui.section('worktrees');
      for (const w of worktrees) ui.pass(w.replace(repoRoot + (process.platform === 'win32' ? '\\' : '/'), ''));
      if (opts.cleanup) {
        ui.divider();
        ui.pending(`--cleanup: removing ${worktrees.length} worktree${worktrees.length === 1 ? '' : 's'}...`);
        for (const w of worktrees) removeWorktree(w);
        ui.pass('cleanup done');
      } else {
        ui.hint('inspect each worker\'s `CONTEXT.md` / `notes.md` / `result.md`. Remove with `git worktree remove <path>` or pass --cleanup');
      }
    }

    ui.divider();
    if (fail === 0) {
      ui.banner(true, `→ ${pass} task${pass === 1 ? '' : 's'} done · ${receipts.length} receipt${receipts.length === 1 ? '' : 's'} anchored`);
    } else {
      ui.banner(false, `→ ${pass} ok · ${fail} failed · ${receipts.length} receipts`);
      process.exitCode = 1;
    }
  });
