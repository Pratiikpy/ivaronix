#!/usr/bin/env tsx
/**
 * Anchor one receipt of each of the 5 RECEIPTS_SPEC types not yet seen on
 * chain in this project: burn, memory_access, skill_exec, passport_update,
 * swarm. Closes the doc-gap from RECEIPTS_SPEC §1.
 *
 * Each anchor uses the runtime pipeline so the receipt body is real
 * (consensus output, signature, on-chain tx) just with the receiptType
 * code set per row.
 */

import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

let dir = process.cwd();
for (let i = 0; i < 8; i++) {
  const candidate = resolve(dir, '.env');
  if (existsSync(candidate)) { dotenvConfig({ path: candidate }); break; }
  const parent = dirname(dir);
  if (parent === dir) break;
  dir = parent;
}

import { runPipeline } from '@ivaronix/runtime';
import type { ReceiptType } from '@ivaronix/core';

interface Run {
  type: ReceiptType;
  prompt: string;
  context: string;
}

const RUNS: Run[] = [
  {
    type: 'burn',
    prompt: 'Confirm the session key was destroyed and what that means for the operator.',
    context: 'session_key_fingerprint: sha256:abcdef0123456789… · destroyedAt: 2026-05-08T03:00:00Z · ciphertext_size: 1298 bytes',
  },
  {
    type: 'memory_access',
    prompt: 'Summarize this memory-access event.',
    context: 'event: WRITE · grantId: 0xf437… · memoryRoot: 0xcb70… · scope: namespace:project · agent: 0xaa95…',
  },
  {
    type: 'skill_exec',
    prompt: 'Acknowledge that the skill ran successfully.',
    context: 'skillId: github-audit · skillVersion: 0.1.0 · manifestHash: sha256:2c23… · convergence: 1.0',
  },
  {
    type: 'passport_update',
    prompt: 'Confirm the passport delta and its causal receipt.',
    context: 'tokenId: 1 · before: trust=132 receipts=132 · after: trust=133 receipts=133 · cause: receipt #145', // numbers-snapshot-allow:passport-delta-example · 132 is a contrived passport trust score / receipt count in this ops example, not the live numbers.json mainnet receipt count it happens to collide with
  },
  {
    type: 'swarm',
    prompt: 'Summarize the swarm dispatch.',
    context: 'parent: agent #1 · workers: 2 · tasks: ["plan login flow", "plan graceful shutdown"] · all completed',
  },
];

async function main() {
  console.log('=== anchoring 5 missing receipt types ===');
  const results: { type: ReceiptType; receiptId: string | null; tx: string | null; onchainId: string | null }[] = [];
  for (const r of RUNS) {
    process.stdout.write(`\n[${r.type}] ... `);
    try {
      const result = await runPipeline({
        skillId: 'plan-step',
        context: r.context,
        userPrompt: r.prompt,
        tier: 'quick',
        receipt: true,
        receiptType: r.type,
      });
      console.log(`#${result.receiptOnchainId} · ${result.receiptTxHash?.slice(0, 14)}…`);
      results.push({
        type: r.type,
        receiptId: result.receiptId,
        tx: result.receiptTxHash,
        onchainId: result.receiptOnchainId !== null ? result.receiptOnchainId.toString() : null,
      });
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
    }
  }
  console.log('\n=== summary ===');
  for (const r of results) {
    console.log(`  ${r.type.padEnd(18)} #${r.onchainId} → https://chainscan-galileo.0g.ai/tx/${r.tx}`);
  }
}

main().catch((err) => { console.error('fatal:', err); process.exit(1); });
