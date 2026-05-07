import { Command } from 'commander';
import { ui } from '../lib/ui.js';

export const docCommand = new Command('doc')
  .description('Private document Q&A — the killer demo');

docCommand
  .command('ask <file> <question>')
  .description('Ask a question about a private document')
  .option('--burn', 'enable Burn Mode (AES-256-GCM session key destroyed after use)')
  .option('--consensus', 'enable Standard 3-role consensus (analyst/critic/judge)')
  .option('--high-stakes', 'use 5-role High-Stakes consensus (legal/contract/financial)')
  .option('--quick', 'use 1-model Quick tier')
  .option('--receipt', 'create an Action Receipt for this run')
  .option('--model <id>', 'override default model', 'qwen/qwen-2.5-7b-instruct')
  .action((file: string, question: string, opts) => {
    ui.title(`doc ask ${file}`);
    ui.hint(`question: ${question}`);
    ui.hint(`burn: ${Boolean(opts.burn)}  consensus: ${Boolean(opts.consensus)}  receipt: ${Boolean(opts.receipt)}`);
    ui.divider();
    ui.hint('Full doc-ask flow arrives Phase A Day 4 (Burn Mode + skill runtime).');
    ui.hint('Roadmap:');
    ui.hint('  Day 2 — receipts skeleton');
    ui.hint('  Day 3 — ReceiptRegistry on testnet');
    ui.hint('  Day 4 — Burn Mode + this command end-to-end');
    ui.hint('  Day 5 — tiered consensus + independent TEE verify');
  });
