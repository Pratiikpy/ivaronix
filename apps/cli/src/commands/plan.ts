import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { runPipeline } from '../lib/pipeline.js';
import { ui } from '../lib/ui.js';

/**
 * `ivaronix plan <prompt>` — read-only planning mode.
 *
 * Produces a numbered plan for a free-form goal. Optional --files <glob...>
 * pulls additional context (README, design docs, prior decisions) into the
 * skill input. No receipt by default (read-only); pass --receipt to anchor.
 */
export const planCommand = new Command('plan')
  .description('Produce a numbered plan for a goal — read-only mode')
  .argument('<goal>', 'free-form goal description')
  .option('-f, --files <paths...>', 'context files to load (relative paths)')
  .option('--skill <id>', 'planning skill to use', 'plan-step')
  .option('--quick', 'force quick tier (default for plan-step)')
  .option('--consensus', 'use standard 3-role consensus instead of quick')
  .option('--high-stakes', 'use 5-role high-stakes consensus')
  .option('--receipt', 'anchor a receipt for this plan run', false)
  .option('--out-dir <dir>', 'where to write the receipt JSON', '.ivaronix/receipts/anchored')
  .action(async (goal: string, opts: { files?: string[]; skill: string; quick?: boolean; consensus?: boolean; highStakes?: boolean; receipt?: boolean; outDir: string }) => {
    let tier: 'quick' | 'standard' | 'high-stakes' | undefined;
    if (opts.highStakes) tier = 'high-stakes';
    else if (opts.consensus) tier = 'standard';
    else if (opts.quick) tier = 'quick';

    const contextParts: string[] = [];
    if (opts.files?.length) {
      for (const f of opts.files) {
        const path = resolve(process.cwd(), f);
        try {
          const content = readFileSync(path, 'utf8');
          contextParts.push(`=== ${basename(path)} ===\n${content.slice(0, 16_000)}`);
        } catch (err) {
          ui.fail(`failed to read context file ${f}`, (err as Error).message);
          process.exitCode = 1;
          return;
        }
      }
    }
    const context = contextParts.length > 0
      ? contextParts.join('\n\n')
      : '(no additional context provided — proceed with the goal alone)';

    ui.title(`plan: ${goal}`);
    ui.divider();

    try {
      const result = await runPipeline({
        skillId: opts.skill,
        context,
        userPrompt: goal,
        tier,
        receipt: opts.receipt,
        outDir: opts.outDir,
        receiptType: 'doc_ask',
      });
      ui.divider();
      console.log(result.finalText);
      ui.divider();
      if (result.receiptId) {
        ui.banner(true, '→ ANCHORED ✓');
        ui.hint(`Verify: ivaronix receipt verify ${result.receiptPath} --tee-independent`);
      } else {
        ui.banner(true, '→ COMPLETE');
      }
    } catch (err) {
      ui.fail('plan failed', (err as Error).message);
      process.exitCode = 1;
    }
  });
