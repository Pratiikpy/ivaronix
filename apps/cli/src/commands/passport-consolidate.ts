import { Command } from 'commander';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Wallet, JsonRpcProvider } from 'ethers';
import {
  AgentPassportClient,
  ReceiptRegistryClient,
  getDeployedAddress,
} from '@ivaronix/og-chain';
import { buildReceipt, signReceipt, defaultChainAnchor } from '@ivaronix/receipts';
import { sha256HexAsync, type Address, type Hash } from '@ivaronix/core';
import { keyringFromEnv } from '@ivaronix/og-router/keyring';
import { runConsensus, TIER_COST_OG } from '@ivaronix/consensus';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

/**
 * Memory consolidation lifecycle (planning-01 §2B).
 *
 * The agent reads its own past receipts in a window (day / month / year),
 * produces a TEE-attested summary via 0G Compute, and anchors the summary
 * as a `memory_consolidation` receipt that points at the source ids it
 * consolidated. The consolidation IS a receipt — no sidecar contract,
 * no contract redeploy. Lineage is verifiable via `request.priorReceiptIds`
 * inside the receipt body, plus the chain anchor of the consolidation
 * itself.
 *
 * Honest scope:
 *  - The consolidation IS itself a receipt — counted in the agent's
 *    receiptCount, increases their trustScore.
 *  - When 0G Compute is configured (ZG_API_SECRET present), the prose
 *    summary is signed by the agent's wallet *after* a real TEE
 *    inference run on a remote provider. `verificationMethod` is
 *    `'router_flag'` and `--tee-independent` re-verifies via
 *    `broker.processResponse`.
 *  - When 0G Compute is unavailable, falls back to a deterministic
 *    local synthesis (counts + types + time range). The receipt body
 *    records `consolidation.method = 'local-synthesis'` so the path
 *    is auditable from the receipt itself — no fake TEE claim.
 *  - On-chain anchor uses receipt-type code 4 (memory_access)
 *    semantically — until ReceiptRegistry is redeployed to admit the
 *    new slot 12. The off-chain receipt body still records
 *    `type: 'memory_consolidation'` faithfully.
 */

const WINDOWS = {
  day: { seconds: 24 * 3600, label: 'day', lookbackBlocks: 50_000 },
  month: { seconds: 30 * 24 * 3600, label: 'month', lookbackBlocks: 600_000 },
  year: { seconds: 365 * 24 * 3600, label: 'year', lookbackBlocks: 6_000_000 },
} as const;
type WindowKey = keyof typeof WINDOWS;

const RECEIPT_TYPE_LABELS: Record<number, string> = {
  0: 'doc_ask',
  1: 'audit',
  2: 'consensus',
  3: 'burn',
  4: 'memory_access',
  5: 'skill_exec',
  6: 'code_change',
  7: 'passport_update',
  8: 'swarm',
  9: 'subscription_skill_exec',
  10: 'doc_room_create',
  11: 'doc_room_read',
  12: 'memory_consolidation',
};

interface SourceReceiptSummary {
  id: string;
  receiptRoot: Hash;
  receiptType: number;
  receiptTypeName: string;
  timestamp: number;
  timestampIso: string;
}

function deterministicSummary(window: WindowKey, items: SourceReceiptSummary[]): string {
  const counts: Record<string, number> = {};
  for (const it of items) {
    counts[it.receiptTypeName] = (counts[it.receiptTypeName] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const breakdown = sorted.map(([k, n]) => `${n}× ${k}`).join(', ');
  if (items.length === 0) return `No receipts anchored in the last ${window}.`;
  const span = `${items[items.length - 1]!.timestampIso} → ${items[0]!.timestampIso}`;
  const headline = `${items.length} receipt${items.length === 1 ? '' : 's'} in the last ${window}.`;
  return `${headline}\n\nWindow: ${span}\nBreakdown: ${breakdown}\n\nThe agent has ${counts['skill_exec'] ?? 0} skill execution${(counts['skill_exec'] ?? 0) === 1 ? '' : 's'}, ${counts['doc_ask'] ?? 0} document review${(counts['doc_ask'] ?? 0) === 1 ? '' : 's'}, ${counts['memory_access'] ?? 0} memory access${(counts['memory_access'] ?? 0) === 1 ? '' : 'es'}, and ${counts['doc_room_create'] ?? 0} confidential data room${(counts['doc_room_create'] ?? 0) === 1 ? '' : 's'} created. The dominant activity is ${sorted[0]?.[0] ?? '—'}.`;
}

function buildContextString(window: WindowKey, items: SourceReceiptSummary[]): string {
  const lines: string[] = [];
  lines.push(`Window: last ${window}`);
  lines.push(`Total receipts: ${items.length}`);
  lines.push('');
  lines.push('Receipt log (newest first):');
  for (const it of items.slice(0, 50)) {
    lines.push(`- #${it.id} · ${it.receiptTypeName} · ${it.timestampIso}`);
  }
  return lines.join('\n');
}

const SUMMARY_PROMPT = `You are summarising an AI agent's recent on-chain activity. Read the receipt log below and produce a short, honest summary in plain language.

Constraints:
- Open with one sentence stating how many receipts were anchored in the window and what the dominant activity was.
- Then 2-4 sentences of pattern observations: what type of work the agent is doing, any spikes or quiet periods, anything notable.
- No marketing language. No adjective stacks. No "delve / leverage / unlock / robust / seamless / unleash."
- One claim per sentence.
- Do not invent numbers. If a number is not in the log, do not state it.
- Do not address the user or the agent in second person. Write in third person about the agent.
- Output 80 to 160 words. No headers, no bullet points, just prose.`;

export function addConsolidateCommand(parent: Command): void {
  parent
    .command('consolidate')
    .description('Roll up the agent\'s recent receipts into a signed memory_consolidation receipt')
    .option('--day', 'consolidate the last 24 hours')
    .option('--month', 'consolidate the last 30 days')
    .option('--year', 'consolidate the last 365 days')
    .option('--no-compute', 'force local deterministic synthesis (skip 0G Compute call)')
    .option('--out-dir <dir>', 'where to write the signed receipt JSON', '.ivaronix/receipts/anchored')
    .action(async (opts: { day?: boolean; month?: boolean; year?: boolean; compute: boolean; outDir: string }) => {
      const env = loadEnv();
      if (!env.privateKey || !env.walletAddress) {
        ui.fail('passport consolidate requires EVM_PRIVATE_KEY + EVM_WALLET_ADDRESS in .env');
        process.exitCode = 1;
        return;
      }

      // Resolve window
      let windowKey: WindowKey;
      if (opts.day) windowKey = 'day';
      else if (opts.month) windowKey = 'month';
      else if (opts.year) windowKey = 'year';
      else { windowKey = 'day'; ui.info('no window flag — defaulting to --day'); }
      const window = WINDOWS[windowKey];

      const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
      const wallet = new Wallet(env.privateKey, provider);
      const registryAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
      const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
      if (!registryAddr) {
        ui.fail(`ReceiptRegistry not deployed on ${env.network}`);
        process.exitCode = 1;
        return;
      }
      const reg = new ReceiptRegistryClient(registryAddr, wallet);

      ui.title(`Consolidating recent receipts · window=${window.label}`);
      ui.info(`agent wallet         ${env.walletAddress}`);
      ui.info(`network              ${env.network}`);
      ui.info(`lookback             ~${window.lookbackBlocks.toLocaleString()} blocks`);

      // 1. Fetch recent on-chain receipts for this agent
      ui.pending('reading on-chain receipts...');
      const onChain = await reg.findByAgent(env.walletAddress as Address, 100, window.lookbackBlocks);
      const cutoff = Math.floor(Date.now() / 1000) - window.seconds;
      const inWindow = onChain.filter((r) => Number(r.timestamp) >= cutoff);

      if (inWindow.length === 0) {
        ui.fail(`no receipts found in the last ${window.label}`);
        ui.hint(`The lookback was ~${window.lookbackBlocks.toLocaleString()} blocks. If you anchored receipts further back, try a wider window.`);
        process.exitCode = 1;
        return;
      }

      const sources: SourceReceiptSummary[] = inWindow
        .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
        .map((r) => ({
          id: r.id.toString(),
          receiptRoot: r.receiptRoot,
          receiptType: r.receiptType,
          receiptTypeName: RECEIPT_TYPE_LABELS[r.receiptType] ?? `type_${r.receiptType}`,
          timestamp: Number(r.timestamp),
          timestampIso: new Date(Number(r.timestamp) * 1000).toISOString().slice(0, 19).replace('T', ' '),
        }));

      ui.pass(`found                ${sources.length} receipt${sources.length === 1 ? '' : 's'} in window`);
      ui.divider();

      // 2. Build the summary — either via 0G Compute (TEE) or local synthesis
      const context = buildContextString(windowKey, sources);
      let summaryText = '';
      let consolidationMethod: 'tee-attested' | 'local-synthesis' = 'local-synthesis';
      let consensusBilling = { totalInputTokens: 0, totalOutputTokens: 0, estimatedCostOg: 0 };
      let providerAddress: Address | null = null;
      let zgResKey: string | null = null;
      let routerVerified = false;

      const tryCompute = opts.compute && !!env.routerApiKey;
      if (tryCompute) {
        ui.pending('running 0G Compute (quick tier, 1 role) for TEE-attested summary...');
        try {
          const keyring = await keyringFromEnv();
          if (!keyring) throw new Error('keyringFromEnv returned null — ZG_API_SECRET / ZG_SERVICE_URL incomplete');
          const result = await runConsensus({
            tier: 'quick',
            keyring,
            model: env.defaultModel,
            context,
            userPrompt: SUMMARY_PROMPT,
            rawBytes: Buffer.from(context, 'utf8'),
          });
          const judgement = result.judgement?.content ?? result.reviewerOutputs[0]?.content ?? '';
          summaryText = judgement.trim();
          consensusBilling = result.billing;
          const att = result.attestations[0];
          if (att) {
            providerAddress = att.providerAddress;
            zgResKey = att.zgResKey;
            routerVerified = att.routerVerified;
          }
          consolidationMethod = 'tee-attested';
          ui.pass(`compute returned     ${summaryText.length} char summary  (${consensusBilling.totalInputTokens}+${consensusBilling.totalOutputTokens} tokens)`);
        } catch (err) {
          ui.fail(`0G Compute failed`, ((err as Error).message.split('\n')[0] ?? '').slice(0, 120));
          ui.info(`falling back to local-synthesis (deterministic, no TEE claim)`);
        }
      } else if (!opts.compute) {
        ui.info(`--no-compute: using local deterministic synthesis`);
      } else {
        ui.info(`ZG_API_SECRET not set: using local deterministic synthesis`);
      }

      if (!summaryText) {
        summaryText = deterministicSummary(windowKey, sources);
        consolidationMethod = 'local-synthesis';
      }

      ui.divider();
      ui.info('summary:');
      console.log(summaryText.split('\n').map((l) => '  ' + l).join('\n'));
      ui.divider();

      // 3. Build the consolidation receipt
      const userPromptHash = (await sha256HexAsync(new TextEncoder().encode(SUMMARY_PROMPT))) as Hash;
      const outputHash = (await sha256HexAsync(new TextEncoder().encode(summaryText))) as Hash;
      // Receipt body keeps the canonical "sha256:<hex>" form; the on-chain
      // anchor call needs raw bytes32 (0x<hex>). Compute both from the same data.
      const sourceIdsCanonical = (await sha256HexAsync(new TextEncoder().encode(sources.map((s) => s.id).join(',')))) as Hash;
      const sourceIdsHashBytes32 = ('0x' + sourceIdsCanonical.replace(/^sha256:/, '')) as Hash;

      const draft = buildReceipt({
        type: 'memory_consolidation',
        agent: {
          passportId: `did:0g:passport:${env.walletAddress}:1`,
          ownerWallet: env.walletAddress as Address,
          trustScoreAtTime: 0,
        },
        request: {
          skillId: 'memory.consolidate',
          skillVersion: '0.1.0',
          skillManifestHash: sourceIdsCanonical,
          userPromptHash,
          inputArtifacts: [{ kind: 'memory', encrypted: false }],
          policyDecision: 'approved',
          approvalChain: [{ gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:default-strict' }],
          priorReceiptIds: sources.map((s) => s.id),
        },
        execution: {
          mode: 'memory_consolidation',
          burnMode: false,
          consensusMode: false,
          modelSelection: { requested: env.defaultModel, final: env.defaultModel },
          providerRouting: {
            allowFallbacks: true,
            finalProvider: (providerAddress ?? '0x0000000000000000000000000000000000000000') as Address,
          },
        },
        teeVerification: {
          requested: consolidationMethod === 'tee-attested',
          routerVerified,
          independentVerified: null,
          ...(providerAddress ? { providerAddress } : {}),
          verificationMethod: consolidationMethod === 'tee-attested' ? 'router_flag' : 'external-signed',
          verifiedAt: null,
        },
        routerTrace: {
          requestId: `memory.consolidate:${windowKey}:${Date.now()}`,
          ...(zgResKey ? { zgResKey } : {}),
          x0gTrace: {},
          rateLimit: {},
        },
        billing: {
          inputTokens: consensusBilling.totalInputTokens,
          outputTokens: consensusBilling.totalOutputTokens,
          inputCostNeuron: String(Math.floor(consensusBilling.totalInputTokens * 5e10)),
          outputCostNeuron: String(Math.floor(consensusBilling.totalOutputTokens * 1e11)),
          totalCostNeuron: String(
            Math.floor(consensusBilling.totalInputTokens * 5e10 + consensusBilling.totalOutputTokens * 1e11)
          ),
          totalCostOg: consensusBilling.estimatedCostOg.toFixed(10),
        },
        chainAnchor: defaultChainAnchor(env.network as 'testnet' | 'mainnet', registryAddr as Address),
        storage: {
          proofDownloadVerified: false,
          encryption: { enabled: false, type: 'none', headerDetected: false },
        },
        outputs: {
          outputHash,
          citations: [],
          riskLevel: 'low',
          wording: {
            headline: summaryText.split('\n')[0]?.slice(0, 200) ?? `Memory consolidation · ${windowKey}`,
            doNotSay: ['truth score', 'verified by AI', 'guaranteed safe'],
          },
        },
        createdBy: 'ivaronix-runtime/0.0.1',
      });

      const signed = await signReceipt(draft, wallet);

      // 4. Persist locally
      const outDir = resolve(opts.outDir);
      mkdirSync(outDir, { recursive: true });
      const localPath = resolve(outDir, `${signed.id}.json`);
      writeFileSync(localPath, JSON.stringify(signed, null, 2));
      ui.pass(`receipt              ${signed.id}`);
      ui.pass(`receiptRoot          ${signed.storage!.receiptRoot}`);
      ui.pass(`written              ${localPath}`);

      // 5. Anchor on chain
      ui.pending('anchoring on 0G Chain...');
      const ZERO_HASH = ('0x' + '0'.repeat(64)) as Hash;
      // Slot 4 (memory_access) used as the chain code until ReceiptRegistry
      // is redeployed with slot 12. Off-chain body still records the canonical
      // 'memory_consolidation' type.
      const RECEIPT_TYPE_CODE = 4;
      // The storageRoot must be non-zero per contract. We use sourceIdsHash —
      // the canonical hash of the source receipt ids this consolidation
      // consumed — as a semantically meaningful root: anyone who fetches
      // the receipt body and recomputes sha256 of its priorReceiptIds list
      // gets the same hash that's anchored on chain.
      const tx = await reg.anchor(
        signed.storage!.receiptRoot as Hash,
        sourceIdsHashBytes32,
        RECEIPT_TYPE_CODE,
        ZERO_HASH,
      );
      const txReceipt = await tx.wait();

      // Resolve the on-chain id from the latest nextId (the just-anchored is nextId-1)
      const nextId = await reg.nextId();
      const onChainId = (nextId - 1n).toString();

      ui.pass(`tx                   ${tx.hash}`);
      ui.pass(`block                ${txReceipt?.blockNumber ?? '?'}`);
      ui.pass(`on-chain id          ${onChainId}`);

      // Update the local receipt with the anchor info (so /r/<id> can resolve)
      const updated = {
        ...signed,
        chainAnchor: {
          ...signed.chainAnchor,
          status: 'anchored' as const,
          onChainId: onChainId,
          anchorTxHash: tx.hash,
          anchorBlockNumber: txReceipt?.blockNumber,
          anchorTimestamp: Math.floor(Date.now() / 1000),
        },
      };
      writeFileSync(localPath, JSON.stringify(updated, null, 2));

      // 6. Update passport (the consolidation itself counts as a receipt)
      if (passportAddr) {
        const passport = new AgentPassportClient(passportAddr, wallet);
        try {
          const tokenId = await passport.passportOf(env.walletAddress as Address);
          if (tokenId !== 0n) {
            ui.pending(`recording consolidation against passport tokenId=${tokenId}...`);
            const ptx = await passport.recordReceipt(
              tokenId,
              signed.storage!.receiptRoot as Hash,
              RECEIPT_TYPE_CODE,
              1,
            );
            await ptx.wait();
            const refreshed = await passport.getPassport(tokenId);
            if (refreshed) {
              ui.pass(`passport updated     receiptCount=${refreshed.receiptCount} trustScore=${refreshed.trustScore}`);
            }
          }
        } catch (err) {
          ui.fail(`passport update failed (receipt is still anchored)`, ((err as Error).message.split('\n')[0] ?? '').slice(0, 120));
        }
      }

      ui.divider();
      ui.pass(`Consolidation complete (${consolidationMethod})`);
      ui.hint(`Verify:    ivaronix receipt verify ${localPath} --tee-independent`);
      ui.hint(`View:      http://localhost:3300/r/${onChainId}`);
      ui.hint(`Agent:     http://localhost:3300/agent/${env.walletAddress}`);
      if (consolidationMethod === 'local-synthesis') {
        ui.info(`(local synthesis path; ${tryCompute ? '0G Compute call failed' : 'compute disabled or no router key'} — receipt body records this honestly)`);
      }
    });
}
