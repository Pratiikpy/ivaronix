import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runPipeline } from '../lib/pipeline.js';
import { ui } from '../lib/ui.js';

/**
 * `ivaronix swarm run <todo.md>` — parent/worker mode.
 *
 * Parses a todo file (markdown bullet list or numbered list — one task per
 * line). For each task, runs a consensus pass using the chosen skill and
 * anchors a receipt. Tasks run sequentially (Day-12 testnet quality);
 * Day-19+ will add worktree-isolated parallelism.
 */
export const swarmCommand = new Command('swarm').description('Multi-task parent/worker dispatch');

function parseTasks(text: string): string[] {
  const tasks: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#/.test(line)) continue;
    // Markdown bullets, numbered lists, or "- [ ]" task lists
    const m = line.match(/^(?:-\s*\[\s*[ x]\s*\]|[-*+]|\d+[.)])\s+(.+)$/);
    if (m) tasks.push(m[1]!.trim());
  }
  return tasks;
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
  .option('--out-dir <dir>', 'where to write receipt JSON', '.ivaronix/receipts/anchored')
  .action(async (todoPath: string, opts: { skill: string; max: string; quick?: boolean; consensus?: boolean; highStakes?: boolean; receipt: boolean; outDir: string }) => {
    let tier: 'quick' | 'standard' | 'high-stakes' | undefined;
    if (opts.highStakes) tier = 'high-stakes';
    else if (opts.consensus) tier = 'standard';
    else if (opts.quick) tier = 'quick';

    const path = resolve(process.cwd(), todoPath);
    let raw: string;
    try {
      raw = readFileSync(path, 'utf8');
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

    ui.title(`swarm: ${todoPath}  (${tasks.length} task${tasks.length === 1 ? '' : 's'})`);
    ui.divider();

    let pass = 0;
    let fail = 0;
    const receipts: string[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]!;
      const label = `task ${i + 1}/${tasks.length}`;
      try {
        const result = await runPipeline({
          skillId: opts.skill,
          context: '(swarm task — no additional context provided)',
          userPrompt: t,
          tier,
          receipt: opts.receipt,
          outDir: opts.outDir,
          receiptType: 'doc_ask',
          label,
        });
        ui.divider();
        ui.section(t);
        console.log(result.finalText);
        ui.divider();
        if (result.receiptId) receipts.push(result.receiptId);
        pass++;
      } catch (err) {
        ui.fail(`[${label}] failed`, (err as Error).message);
        fail++;
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
