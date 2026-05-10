#!/usr/bin/env tsx
/**
 * `@ivaronix/og-toolkit` consumer smoke test.
 *
 * Proves the package surface as advertised in its README: one import,
 * `createOg({ network })`, then `og.runSkill({...})` produces a real receipt
 * anchored on chain. Mirrors what an external builder would write after
 * `pnpm add @ivaronix/og-toolkit`.
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

import { createOg } from '@ivaronix/og-toolkit';

async function main() {
  const og = createOg({
    network: 'testnet',
    privateKey: process.env.IVARONIX_SIGNER_KEY ?? process.env.OG_PRIVATE_KEY ?? process.env.EVM_PRIVATE_KEY,
  });

  console.log(`og-toolkit consumer test — network=${og.network}, signer=${await og.chain.getSignerAddress()}`);

  const r = await og.runSkill({
    skillId: 'github-audit',
    userPrompt: 'flag the worst defect',
    context: 'contract Foo { function rugPull(address x) external { selfdestruct(payable(x)); } }',
    tier: 'quick',
    receipt: true,
    receiptType: 'audit',
  });

  console.log('\n--- result ---');
  console.log(`final text   : ${r.finalText.slice(0, 120)}…`);
  console.log(`tokens       : ${r.consensus.billing.totalInputTokens}+${r.consensus.billing.totalOutputTokens}`);
  console.log(`cost         : ${r.consensus.billing.estimatedCostOg.toFixed(8)} OG`);
  console.log(`receiptId    : ${r.receiptId}`);
  console.log(`onchainId    : ${r.receiptOnchainId?.toString() ?? 'n/a'}`);
  console.log(`receiptTx    : ${r.receiptTxHash ?? 'n/a'}`);
}

main().catch((err) => {
  console.error('fatal:', err.message ?? err);
  process.exit(1);
});
