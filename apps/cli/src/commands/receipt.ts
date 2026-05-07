import { Command } from 'commander';
import { ui } from '../lib/ui.js';

export const receiptCommand = new Command('receipt')
  .description('Manage and verify Action Receipts');

receiptCommand
  .command('verify <id>')
  .description('Verify a receipt — shows CLAIMED → ANCHORED → FULLY VERIFIED')
  .option('--tee-independent', 'also run independent TEE verification via broker.processResponse')
  .action(async (id: string, opts: { teeIndependent?: boolean }) => {
    ui.title(`Verifying receipt ${id}`);
    ui.divider();
    ui.pending('Schema:                pending');
    ui.pending('Hash:                  pending');
    ui.pending('Signature:             pending');
    ui.pending('Storage availability:  pending');
    ui.pending('Chain anchor:          pending');
    if (opts.teeIndependent) ui.pending('TEE independent:       pending');
    ui.pending('Skill manifest:        pending');
    ui.divider();
    ui.hint('Receipt verification implementation arrives Day 2 (packages/receipts).');
  });

receiptCommand
  .command('list')
  .description('List recent receipts')
  .option('--since <date>', 'filter by date (YYYY-MM-DD)')
  .action(() => {
    ui.hint('Receipt listing arrives Day 2 once packages/receipts is implemented.');
  });

receiptCommand
  .command('show <id>')
  .description('Show full receipt JSON')
  .action((id: string) => {
    ui.hint(`Receipt show ${id} arrives Day 2.`);
  });
