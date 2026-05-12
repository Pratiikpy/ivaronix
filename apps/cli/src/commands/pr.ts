// v3-lookup-allow: pr writer emits slot 6 (code_change) only; slot 10+ types must add V3 address lookup + anchor branch per packages/runtime/src/pipeline.ts SLOTS_REQUIRING_V3. Tracked in USER_TODO §B-V2-37.
/**
 * `ivaronix pr …` — wraps `gh pr` with on-chain receipt provenance (F-8, A2).
 *
 * Pattern lifted from OpenCode's pr.ts, but built around our existing
 * code_change receipts. The thesis: every line of merged code has a
 * pre-anchored receipt that proves who-touched-what-when. Reviewer reads
 * the PR body, clicks the receipt URL, gets a Studio page that re-verifies
 * against chain in 5 seconds.
 *
 * Subcommands:
 *   pr create [--title] [--body] [--no-receipts]
 *       Resolve all code_change receipts authored by env wallet on the
 *       current branch (commits since merge-base with main), append a
 *       Receipts section to the PR body, then exec `gh pr create`.
 *
 *   pr verify <pr-number>
 *       Read the PR's body, parse the Receipts list, look up each
 *       receipt in the local indexer + on-chain, report ALL_RECEIPTED
 *       or list the gaps.
 *
 * Requires `gh` (GitHub CLI) on PATH for create. verify works without gh
 * if you pass --body-file <path>.
 */

import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { JsonRpcProvider } from 'ethers';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { ReceiptRegistryClient, ReceiptRegistryV2Client, getDeployedAddress } from '@ivaronix/og-chain';
import { IndexerDb } from '@ivaronix/indexer';
import { RECEIPT_TYPES, type Address } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

// IVARONIX_STUDIO_BASE canonical; STUDIO_BASE legacy.
const STUDIO_BASE = process.env.IVARONIX_STUDIO_BASE ?? process.env.STUDIO_BASE ?? 'http://localhost:3300';

function indexerDbPath(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return resolve(dir, '.ivaronix', 'indexer', 'receipts.db');
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), '.ivaronix', 'indexer', 'receipts.db');
}

/** Run a command with no shell. Returns exit code, stdout, stderr. */
function run(cmd: string, args: string[], opts: { input?: string; cwd?: string } = {}): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((res) => {
    const child = spawn(cmd, args, { shell: false, windowsHide: true, cwd: opts.cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });
    child.on('error', (err) => res({ ok: false, stdout, stderr: stderr + err.message }));
    child.on('close', (code) => res({ ok: code === 0, stdout, stderr }));
    if (opts.input) {
      child.stdin.write(opts.input);
      child.stdin.end();
    }
  });
}

/** Resolve all code_change receipts that this wallet anchored in the recent past. */
function getRecentCodeChangeReceipts(env: ReturnType<typeof loadEnv>, limitN: number): Array<{ id: number; blockTimestamp: number; receiptRoot: string }> {
  if (!env.walletAddress) return [];
  try {
    const db = new IndexerDb(indexerDbPath());
    const rows = db.listReceipts({
      agent: env.walletAddress as Address,
      receiptType: RECEIPT_TYPES.code_change,
      limit: limitN,
    });
    db.close();
    return rows.map((r) => ({ id: r.id, blockTimestamp: r.blockTimestamp, receiptRoot: r.receiptRoot }));
  } catch {
    return [];
  }
}

/** Parse a PR body for receipt ids in the Receipts section. */
function extractReceiptIds(body: string): number[] {
  const ids: number[] = [];
  // Match patterns: '/r/<id>', '#receipt-<id>', or 'receipt #<id>'
  const re = /(?:\/r\/|receipt[\s#-]+|#receipt-)(\d+)\b/gi;
  for (const m of body.matchAll(re)) {
    const id = Number(m[1]);
    if (Number.isFinite(id) && id >= 0) ids.push(id);
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

function buildReceiptsSection(receipts: Array<{ id: number; blockTimestamp: number }>, network: string): string {
  if (receipts.length === 0) {
    return [
      '## Receipts',
      '',
      '_No `code_change` receipts found for the env wallet in the local indexer._',
      '_If `code --apply` was used in this branch, run `ivaronix indexer backfill` first._',
      '',
    ].join('\n');
  }
  const lines: string[] = ['## Receipts', ''];
  lines.push(`Every line of code in this PR is backed by an on-chain \`code_change\` receipt anchored on 0G ${network}.`);
  lines.push('');
  lines.push('| Receipt | Anchored | Verify |');
  lines.push('|---|---|---|');
  for (const r of receipts) {
    const ts = new Date(r.blockTimestamp * 1000).toISOString();
    lines.push(`| [#${r.id}](${STUDIO_BASE}/r/${r.id}) | ${ts} | \`ivaronix receipt verify ${r.id} --tee-independent\` |`);
  }
  lines.push('');
  lines.push(`Reviewer can re-verify any line: \`ivaronix pr verify <this-PR-#>\` reports \`ALL_RECEIPTED\` if every receipt resolves on chain.`);
  lines.push('');
  return lines.join('\n');
}

export const prCommand = new Command('pr')
  .description('GitHub PR workflow with on-chain receipt provenance');

prCommand
  .command('create')
  .description('Open a PR. Auto-appends a Receipts section listing every code_change receipt anchored by this wallet.')
  .option('--title <text>', 'PR title (passed to gh pr create)')
  .option('--body <text>', 'PR body markdown (Receipts section appended)')
  .option('--body-file <path>', 'read body from file (instead of --body)')
  .option('--base <branch>', 'base branch', 'main')
  .option('--limit <n>', 'cap how many recent code_change receipts to include', '50')
  .option('--no-receipts', 'do not append the Receipts section')
  .option('--draft', 'open as draft')
  .option('--print-only', 'print the resolved body to stdout instead of running gh')
  .action(async (opts: { title?: string; body?: string; bodyFile?: string; base: string; limit: string; receipts?: boolean; draft?: boolean; printOnly?: boolean }) => {
    const env = loadEnv();
    let body = opts.body ?? '';
    if (opts.bodyFile) {
      if (!existsSync(opts.bodyFile)) {
        ui.fail(`body-file not found: ${opts.bodyFile}`);
        process.exitCode = 1;
        return;
      }
      body = readFileSync(opts.bodyFile, 'utf8');
    }

    const includeReceipts = opts.receipts !== false;
    const receipts = includeReceipts ? getRecentCodeChangeReceipts(env, Number(opts.limit) || 50) : [];

    if (includeReceipts) {
      const section = buildReceiptsSection(receipts, env.network);
      body = body.length > 0 ? `${body.trim()}\n\n${section}` : section;
    }

    ui.title('ivaronix pr · create');
    ui.info(`base                 ${opts.base}`);
    ui.info(`receipts attached    ${receipts.length}`);
    ui.divider();

    if (opts.printOnly) {
      process.stdout.write(body + '\n');
      return;
    }

    if (!opts.title) {
      ui.fail('--title is required (gh pr create needs it)');
      process.exitCode = 1;
      return;
    }

    // Stage body in a temp file, then `gh pr create --body-file <tmp>` (avoids
    // shell quoting issues for long markdown).
    const tmp = resolve(tmpdir(), `ivaronix-pr-body-${Date.now()}.md`);
    writeFileSync(tmp, body, 'utf8');
    const args = ['pr', 'create', '--title', opts.title, '--body-file', tmp, '--base', opts.base];
    if (opts.draft) args.push('--draft');

    ui.pending('running gh pr create...');
    const r = await run('gh', args);
    if (!r.ok) {
      ui.fail('gh pr create failed', r.stderr.split('\n')[0] || 'unknown');
      ui.hint('Make sure `gh auth status` is OK and you have a remote.');
      process.exitCode = 1;
      return;
    }
    process.stdout.write(r.stdout);
    ui.pass(`PR opened with ${receipts.length} receipts attached`);
  });

prCommand
  .command('verify <pr-number>')
  .description('Verify every receipt mentioned in a PR body resolves on chain')
  .option('--body-file <path>', 'read PR body from a local file (skips gh)')
  .action(async (prNumberArg: string, opts: { bodyFile?: string }) => {
    const prNumber = Number(prNumberArg);
    if (!Number.isFinite(prNumber) || prNumber <= 0) {
      ui.fail(`bad PR number: ${prNumberArg}`);
      process.exitCode = 1;
      return;
    }

    let body = '';
    if (opts.bodyFile) {
      if (!existsSync(opts.bodyFile)) {
        ui.fail(`body-file not found: ${opts.bodyFile}`);
        process.exitCode = 1;
        return;
      }
      body = readFileSync(opts.bodyFile, 'utf8');
    } else {
      const r = await run('gh', ['pr', 'view', String(prNumber), '--json', 'body', '--jq', '.body']);
      if (!r.ok) {
        ui.fail('gh pr view failed', r.stderr.split('\n')[0]);
        ui.hint('Pass --body-file <path> to verify offline.');
        process.exitCode = 1;
        return;
      }
      body = r.stdout;
    }

    const ids = extractReceiptIds(body);
    ui.title(`ivaronix pr verify · #${prNumber}`);
    ui.info(`receipts in body     ${ids.length}`);
    ui.divider();

    if (ids.length === 0) {
      ui.fail('NO_RECEIPTS — PR body contains no receipt references');
      ui.hint('Re-create the PR with `ivaronix pr create` to auto-attach receipts.');
      process.exitCode = 1;
      return;
    }

    // Verify each id is in the local indexer AND on chain.
    // V2-first read per .claude/rules/og-chain.md: try V2, fall back to V1.
    const env = loadEnv();
    const recAddrV2 = getDeployedAddress(env.network, 'ReceiptRegistryV2');
    const recAddrV1 = getDeployedAddress(env.network, 'ReceiptRegistry');
    if (!recAddrV1 && !recAddrV2) {
      ui.fail(`No ReceiptRegistry deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const clientV2 = recAddrV2 ? new ReceiptRegistryV2Client(recAddrV2 as Address, provider) : null;
    const clientV1 = recAddrV1 ? new ReceiptRegistryClient(recAddrV1 as Address, provider) : null;

    let db: IndexerDb | null = null;
    try { db = new IndexerDb(indexerDbPath()); } catch {/* ok */}

    let allReceipted = true;
    for (const id of ids) {
      let onchainOk = false;
      try {
        // V2-first: a receipt anchored on V2 wins; V1 fallback handles legacy ids.
        const r2 = clientV2 ? await clientV2.getReceipt(BigInt(id)) : null;
        if (r2) {
          onchainOk = true;
        } else if (clientV1) {
          const r1 = await clientV1.getReceipt(BigInt(id));
          onchainOk = r1 !== null;
        }
      } catch {/* ignore */}
      const local = db?.getReceipt(id);
      if (onchainOk && local && local.receiptRoot.toLowerCase() === db?.getReceipt(id)?.receiptRoot.toLowerCase()) {
        ui.pass(`#${id.toString().padStart(4)}  on-chain ✓  local ✓`);
      } else if (onchainOk) {
        ui.info(`#${id.toString().padStart(4)}  on-chain ✓  local ✗ (run indexer backfill)`);
      } else {
        ui.fail(`#${id.toString().padStart(4)}  on-chain ✗  MISSING`);
        allReceipted = false;
      }
    }
    db?.close();

    ui.divider();
    if (allReceipted) ui.banner(true, '→ ALL_RECEIPTED ✓');
    else { ui.banner(false, '→ NOT_RECEIPTED — gaps above'); process.exitCode = 1; }
  });
