import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyClaimed } from '@ivaronix/receipts';
import { ui } from '../lib/ui.js';

export const receiptCommand = new Command('receipt')
  .description('Manage and verify Action Receipts');

receiptCommand
  .command('verify <pathOrId>')
  .description('Verify a receipt — shows CLAIMED → ANCHORED → FULLY VERIFIED')
  .option('--tee-independent', 'also run independent TEE verification via broker.processResponse')
  .action((pathOrId: string, opts: { teeIndependent?: boolean }) => {
    // Day 2 supports JSON file path. Day 3+ adds receipt-id lookup via ReceiptRegistry.
    const filePath = resolve(process.cwd(), pathOrId);
    if (!existsSync(filePath)) {
      ui.fail(`No receipt at ${filePath}`, 'Day 3+ will resolve receipt ids by querying ReceiptRegistry.');
      process.exitCode = 1;
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (err) {
      ui.fail(`Cannot parse JSON`, (err as Error).message);
      process.exitCode = 1;
      return;
    }

    ui.title(`Verifying ${pathOrId}`);
    ui.divider();

    const result = verifyClaimed(json);

    for (const check of result.checks) {
      const label = check.name.padEnd(22);
      if (check.pass) ui.pass(`${label} PASS`);
      else ui.fail(`${label} FAIL`, check.detail);
    }

    if (result.state === 'INVALID') {
      ui.divider();
      ui.banner(false, '✗ INVALID');
      process.exitCode = 1;
      return;
    }

    ui.divider();
    if (result.state === 'CLAIMED') {
      ui.banner(true, `→ ${result.state}`);
      ui.hint('Storage availability + chain anchor + TEE checks land Day 3+ (ReceiptRegistry deploy).');
      if (opts.teeIndependent) ui.hint('--tee-independent flag noted; Day 5 will activate it.');
    }
  });

receiptCommand
  .command('list')
  .description('List recent receipts')
  .option('--since <date>', 'filter by date (YYYY-MM-DD)')
  .action(() => {
    ui.hint('Receipt listing arrives Day 3 via ReceiptRegistry events.');
  });

receiptCommand
  .command('show <id>')
  .description('Show full receipt JSON')
  .action((id: string) => {
    ui.hint(`Receipt show ${id} arrives Day 3 via ReceiptRegistry queries.`);
  });
