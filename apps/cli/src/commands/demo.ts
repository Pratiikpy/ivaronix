import { Command } from 'commander';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonRpcProvider } from 'ethers';
import { runPipeline } from '../lib/pipeline.js';
import { keyringFromEnv } from '@ivaronix/og-router/keyring';
import { AgentPassportClient, ReceiptRegistryClient, getDeployedAddress } from '@ivaronix/og-chain';
import { NETWORKS, studioUrl, type Address } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

/**
 * `ivaronix demo` — single-command end-to-end proof.
 *
 * Bundles the canonical "watch this work" sequence into one invocation
 * judges and grant reviewers can run themselves:
 *   1. Sanity check the network (chain, router, balance)
 *   2. Run a canonical doc-ask against a synthetic lease excerpt
 *   3. Anchor the receipt on chain
 *   4. Print the public proof URL + the explorer URL + the verify command
 *
 * Total runtime: ~5 seconds + one receipt's worth of OG (~0.0001 OG).
 *
 * The synthetic input is intentionally pre-baked so the demo is reproducible
 * — the worst-clause output should always identify the jury-trial waiver
 * (the most one-sided clause in the canonical input).
 */
export const demoCommand = new Command('demo')
  .description('Single-shot end-to-end proof — anchors one receipt and prints the public proof URL')
  .option('--skill <id>', 'skill to use', 'private-doc-review')
  .option('--question <q>', 'question to ask', 'Which clause is most concerning?')
  .option('--tier <tier>', 'consensus tier: quick | standard | high-stakes', 'quick')
  .option('--burn', 'enable burn mode — encrypt evidence, destroy session key after run', false)
  .action(async (opts: { skill: string; question: string; tier: string; burn?: boolean }) => {
    if (!['quick', 'standard', 'high-stakes'].includes(opts.tier)) {
      ui.fail(`invalid --tier "${opts.tier}"`, 'must be quick | standard | high-stakes');
      process.exitCode = 1;
      return;
    }
    if (opts.burn) {
      // Burn mode is wired through doc ask's bespoke pipeline (it owns the
      // session-key lifecycle + AES-256-GCM encrypt + Storage upload). Don't
      // pretend we can do it from this command — point the user at the real
      // path so the demo stays honest.
      ui.fail('--burn is wired through `ivaronix doc ask --burn`, not `demo`');
      ui.hint('Run:    ivaronix doc ask <file> "..." --burn --quick');
      ui.hint('Example: see scripts/round25-doc.txt for canonical sensitive doc');
      process.exitCode = 1;
      return;
    }
    const env = loadEnv();
    ui.title('ivaronix demo · one-shot end-to-end proof');
    ui.divider();

    // ─── Pre-flight checks ─────────────────────────────────────────
    ui.section('pre-flight');
    ui.info(`network              ${env.network} · chainId ${env.chainId}`);
    const keyring = keyringFromEnv();
    if (!keyring) {
      ui.fail('Router not configured', 'Set IVARONIX_ROUTER_KEY / IVARONIX_ROUTER_URL / IVARONIX_ROUTER_PROVIDER / IVARONIX_WALLET_ADDRESS in .env (legacy aliases ZG_API_SECRET, ZG_SERVICE_URL, OG_COMPUTE_PROVIDER, EVM_WALLET_ADDRESS still resolve)');
      process.exitCode = 1;
      return;
    }
    ui.pass('router               configured');
    if (!env.privateKey || !env.walletAddress) {
      ui.fail('No IVARONIX_SIGNER_KEY + IVARONIX_WALLET_ADDRESS in .env (legacy aliases EVM_PRIVATE_KEY + EVM_WALLET_ADDRESS still resolve)');
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const balance = await provider.getBalance(env.walletAddress).catch(() => 0n);
    const balanceOg = Number(balance) / 1e18;
    ui.info(`wallet               ${env.walletAddress}`);
    ui.info(`balance              ${balanceOg.toFixed(4)} OG`);
    if (balanceOg < 0.001) {
      ui.fail('balance too low (< 0.001 OG)', 'top up at the testnet faucet first');
      process.exitCode = 1;
      return;
    }

    // Optional passport snapshot — informational, not gating.
    try {
      const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
      if (passportAddr) {
        const client = new AgentPassportClient(passportAddr, provider);
        const data = await client.getPassportByWallet(env.walletAddress as Address);
        if (data) ui.info(`passport             tokenId ${data.tokenId} · trust ${data.trustScore} · receipts ${data.receiptCount}`);
        else ui.info(`passport             not minted yet (use 'ivaronix passport mint')`);
      }
    } catch { /* optional */ }
    ui.divider();

    // ─── Canonical input ───────────────────────────────────────────
    ui.section('input');
    const canonicalDoc = `Section 1: Tenant agrees to a $13,500 non-refundable security deposit, payable in stablecoin within 24 hours.
Section 4: Landlord may unilaterally raise rent by up to 50% per quarter without notice or justification.
Section 9: Tenant waives all rights to a jury trial and consents to mandatory arbitration in the landlord's jurisdiction of choice.`;
    const tmp = mkdtempSync(join(tmpdir(), 'ivaronix-demo-'));
    const docPath = join(tmp, 'demo-lease.txt');
    writeFileSync(docPath, canonicalDoc);
    const roleCount = opts.tier === 'quick' ? 1 : opts.tier === 'standard' ? 3 : 5;
    ui.info(`question             "${opts.question}"`);
    ui.info(`skill                ${opts.skill}`);
    ui.info(`tier                 ${opts.tier} (${roleCount} role${roleCount === 1 ? '' : 's'})`);
    ui.divider();

    // ─── Run pipeline ──────────────────────────────────────────────
    ui.section('running');
    const result = await runPipeline({
      skillId: opts.skill,
      context: canonicalDoc,
      userPrompt: opts.question,
      tier: opts.tier as 'quick' | 'standard' | 'high-stakes',
      receipt: true,
    });
    ui.divider();

    // ─── Output + proof URLs ───────────────────────────────────────
    ui.section('output');
    const headline = result.finalText.split('\n').slice(0, 5).join('\n');
    process.stdout.write(`\n${headline}\n\n`);
    ui.divider();

    if (!result.receiptOnchainId || !result.receiptTxHash) {
      ui.fail('Receipt anchored but on-chain id not resolved');
      return;
    }

    ui.section('proof');
    ui.pass(`receipt id           ${result.receiptOnchainId}`);
    ui.pass(`anchor tx            ${result.receiptTxHash}`);
    ui.info(`receipt JSON         ${result.receiptPath}`);
    ui.divider();

    // Bump cumulative count for headline copy
    let total = 0n;
    try {
      const regAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
      if (regAddr) {
        const reg = new ReceiptRegistryClient(regAddr, provider);
        total = await reg.nextId();
        if (total > 0n) total -= 1n;
      }
    } catch { /* optional */ }

    ui.banner(true, `→ ${total > 0n ? `${total} receipts on testnet · ` : ''}DEMO ANCHORED ✓`);
    const explorer = NETWORKS[env.network].chainExplorer;
    ui.hint(`Public proof URL   ${studioUrl(`/r/${result.receiptOnchainId}`)}`);
    ui.hint(`Chain explorer     ${explorer}/tx/${result.receiptTxHash}`);
    ui.hint(`Independent verify ivaronix receipt verify ${result.receiptOnchainId} --tee-independent`);
  });
