/**
 * `ivaronix session …` — multi-session continuity (F-session, A2).
 *
 * Pattern lifted from OpenCode's tui/{attach,thread}.ts. Wraps the
 * existing `.ivaronix/conversations/` persistence so users can:
 *
 *   ivaronix session list                 recent conversations table
 *   ivaronix session show <id>            print the transcript
 *   ivaronix session attach <id>          open chat-v2 with conv pre-loaded
 *   ivaronix session prune --before <iso> drop old conversations
 *
 * No new persistence layer — conversations are already saved by `chat`
 * and `chat-v2`. This subtree just gives explicit verbs for what was
 * implicit slash-commands inside the TUI.
 */

import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync, unlinkSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listConversations, loadConversation, type ConversationFile } from '../lib/conversation.js';
import { ui } from '../lib/ui.js';

function findConvDir(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const c = resolve(dir, '.ivaronix', 'conversations');
    if (existsSync(c)) return c;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export const sessionCommand = new Command('session')
  .description('Multi-session continuity — list, show, attach, or prune saved chat conversations');

sessionCommand
  .command('list')
  .description('Recent saved conversations (most recent first)')
  .option('--limit <n>', 'max rows', '20')
  .option('--json', 'machine-readable JSON')
  .action((opts: { limit: string; json?: boolean }) => {
    const rows = listConversations(Math.max(1, Number(opts.limit) || 20));
    if (opts.json) {
      process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
      return;
    }
    ui.title('ivaronix session · list');
    if (rows.length === 0) {
      ui.info('(no saved conversations yet — start one with `ivaronix`)');
      return;
    }
    ui.divider();
    for (const r of rows) {
      const ts = new Date(r.updatedAt).toISOString().slice(0, 16).replace('T', ' ');
      const shortId = r.id.length > 20 ? `${r.id.slice(0, 18)}…` : r.id;
      ui.info(`  ${ts}  ${shortId.padEnd(20)} ${String(r.messages).padStart(3)} msgs · ${r.model}`);
    }
    ui.divider();
    ui.hint('Resume: ivaronix session attach <id>');
    ui.hint('Print:  ivaronix session show <id>');
  });

sessionCommand
  .command('show <id>')
  .description('Print a saved conversation transcript')
  .option('--json', 'machine-readable JSON')
  .option('--no-system', 'omit system messages')
  .action((id: string, opts: { json?: boolean; system?: boolean }) => {
    let conv: ConversationFile;
    try {
      conv = loadConversation(id);
    } catch (err) {
      ui.fail((err as Error).message);
      process.exitCode = 1;
      return;
    }
    if (opts.json) {
      process.stdout.write(JSON.stringify(conv, null, 2) + '\n');
      return;
    }

    ui.title(`session · ${conv.id}`);
    ui.info(`created              ${new Date(conv.createdAt).toISOString()}`);
    ui.info(`updated              ${new Date(conv.updatedAt).toISOString()}`);
    ui.info(`network              ${conv.network}`);
    ui.info(`model                ${conv.model}`);
    if (conv.skill) ui.info(`skill                ${conv.skill}`);
    ui.info(`messages             ${conv.messages.length}`);
    ui.info(`tokens               in=${conv.tokens.input}  out=${conv.tokens.output}`);
    ui.info(`receipts             ${conv.receipts.length}`);
    ui.divider();

    const includeSystem = opts.system !== false;
    for (const m of conv.messages) {
      if (!includeSystem && m.role === 'system') continue;
      const tag = `[${m.role}]`.padEnd(10);
      const body = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      const lines = body.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i === 0) process.stdout.write(`${tag}${lines[i]}\n`);
        else process.stdout.write(`          ${lines[i]}\n`);
      }
      process.stdout.write('\n');
    }

    if (conv.receipts.length > 0) {
      ui.divider();
      ui.section('Receipts in this session');
      for (const r of conv.receipts) ui.info(`  ${r}`);
    }
  });

sessionCommand
  .command('attach <id>')
  .description('Resume a saved conversation in the chat-v2 TUI')
  .option('--model <model>', 'override model for the resumed session')
  .action((id: string, opts: { model?: string }) => {
    // Resolve so we fail fast on a bad id, not after spawning Ink.
    let conv: ConversationFile;
    try {
      conv = loadConversation(id);
    } catch (err) {
      ui.fail((err as Error).message);
      ui.hint('Run: ivaronix session list');
      process.exitCode = 1;
      return;
    }
    ui.title(`session · attach ${conv.id}`);
    ui.info(`messages             ${conv.messages.length}`);
    ui.info(`model                ${opts.model ?? conv.model}`);
    ui.divider();
    ui.pending('opening chat-v2…');

    const here = fileURLToPath(import.meta.url);
    const cliBin = resolve(dirname(here), '..', 'bin', 'ivaronix.ts');
    const args = ['exec', 'tsx', cliBin, 'chat-v2', '--resume', conv.id];
    if (opts.model) args.push('--model', opts.model);
    const child = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    });
    child.on('exit', (code) => process.exit(code ?? 0));
  });

sessionCommand
  .command('prune')
  .description('Remove conversations older than a cutoff (--before <iso>)')
  .option('--before <iso>', 'cut-off ISO date (default: 30 days ago)')
  .option('--dry-run', 'list what would be pruned, do not delete')
  .action((opts: { before?: string; dryRun?: boolean }) => {
    const dir = findConvDir();
    if (!dir) {
      ui.info('(no conversations directory)');
      return;
    }
    const cutoffMs = opts.before ? Date.parse(opts.before) : Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(cutoffMs)) {
      ui.fail(`invalid --before: ${opts.before}`);
      process.exitCode = 1;
      return;
    }
    const cutoff = new Date(cutoffMs).toISOString();
    ui.title('session · prune');
    ui.info(`cutoff               ${cutoff}`);
    ui.info(`mode                 ${opts.dryRun ? 'dry-run' : 'apply'}`);
    ui.divider();

    const entries = readdirSync(dir).filter((e) => e.endsWith('.json'));
    let pruned = 0;
    for (const e of entries) {
      const p = join(dir, e);
      try {
        const body = JSON.parse(readFileSync(p, 'utf8')) as ConversationFile;
        if (body.updatedAt < cutoffMs) {
          ui.info(`  ${e}  updated=${new Date(body.updatedAt).toISOString().slice(0, 16)}`);
          if (!opts.dryRun) {
            unlinkSync(p);
          }
          pruned++;
        }
      } catch {/* skip malformed */}
    }
    ui.divider();
    if (opts.dryRun) ui.info(`would prune          ${pruned}`);
    else ui.pass(`pruned               ${pruned}`);
  });
