import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runPipeline } from '../lib/pipeline.js';
import { ui } from '../lib/ui.js';

/**
 * `ivaronix code <task> --files <paths...>` — build mode.
 *
 * Proposes a unified diff for the task given source context. Does NOT write
 * to disk — emits the diff for the user (or a follow-up agent) to apply.
 * Always anchors a receipt because edits are accountable.
 */
export const codeCommand = new Command('code')
  .description('Propose code changes for a task — emits a unified diff (does not apply)')
  .argument('<task>', 'task description')
  .requiredOption('-f, --files <paths...>', 'source files providing context')
  .option('--skill <id>', 'code-edit skill to use', 'code-edit')
  .option('--quick', 'force quick tier')
  .option('--consensus', 'force standard 3-role consensus (default for code-edit)')
  .option('--high-stakes', 'use 5-role high-stakes consensus')
  .option('--no-receipt', 'skip receipt anchoring (for ad-hoc dry runs)')
  .option('--out-dir <dir>', 'where to write the receipt JSON', '.ivaronix/receipts/anchored')
  .action(async (task: string, opts: { files: string[]; skill: string; quick?: boolean; consensus?: boolean; highStakes?: boolean; receipt: boolean; outDir: string }) => {
    let tier: 'quick' | 'standard' | 'high-stakes' | undefined;
    if (opts.highStakes) tier = 'high-stakes';
    else if (opts.consensus) tier = 'standard';
    else if (opts.quick) tier = 'quick';

    const parts: string[] = [];
    for (const f of opts.files) {
      const path = resolve(process.cwd(), f);
      try {
        const content = readFileSync(path, 'utf8');
        parts.push(`=== ${f} ===\n${content.slice(0, 24_000)}`);
      } catch (err) {
        ui.fail(`failed to read ${f}`, (err as Error).message);
        process.exitCode = 1;
        return;
      }
    }
    const context = parts.join('\n\n');

    ui.title(`code: ${task}`);
    ui.divider();

    try {
      const result = await runPipeline({
        skillId: opts.skill,
        context,
        userPrompt: task,
        tier,
        receipt: opts.receipt,
        outDir: opts.outDir,
        receiptType: 'code_change',
      });
      ui.divider();
      console.log(result.finalText);
      ui.divider();
      if (result.receiptId) {
        ui.banner(true, '→ ANCHORED ✓');
        ui.hint(`Apply diff manually with \`git apply\` or \`patch -p1\`. Receipt: ${result.receiptPath}`);
      } else {
        ui.banner(true, '→ COMPLETE');
      }
    } catch (err) {
      ui.fail('code failed', (err as Error).message);
      process.exitCode = 1;
    }
  });
