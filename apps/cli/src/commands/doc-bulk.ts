import { Command } from 'commander';
import { writeFileSync, readdirSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { Wallet, JsonRpcProvider } from 'ethers';
import {
  AgentPassportClient,
  ReceiptRegistryClient,
  getDeployedAddress,
} from '@ivaronix/og-chain';
import { buildReceipt, signReceipt, defaultChainAnchor } from '@ivaronix/receipts';
import { sha256HexAsync, type Address, type Hash } from '@ivaronix/core';
import { docCommand } from './doc.js';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

/**
 * Bulk multi-doc audit (planning-01 §4B).
 *
 * The DD analyst's day-one workflow: drop a folder of vendor agreements
 * (NDA, MSA, SaaS subscription, etc.), get one anchored receipt per file
 * for the audit trail, plus ONE aggregate `memory_consolidation`-style
 * parent receipt that points back at every child via `priorReceiptIds`.
 * The parent receipt is what goes into the investment-memo binder; the
 * children are the file-by-file evidence.
 *
 * Each child run produces a normal anchored receipt — same skill, same
 * fee-split, same TEE attestation path, same `--tee-independent`
 * re-verify — so the children stand on their own. The aggregate is the
 * audit-committee-presentable summary.
 */

const DEFAULT_PATTERN = /\.(txt|md|pdf)$/i;

export function addBulkCommand(parent: Command): void {
  parent
    .command('bulk <dir>')
    .description('Run a skill across every matching file in a directory; produce one receipt per file plus one aggregate receipt')
    .option('--pattern <regex>', 'filename pattern to include (default: *.txt|md|pdf)', '')
    .option('--question <q>', 'question to ask the skill on each doc', 'Run the standard review and surface the worst clauses.')
    .option('--skill <id>', 'skill id to use', 'private-doc-review')
    .option('--tier <tier>', 'consensus tier per doc', 'quick')
    .option('--max-files <n>', 'cap on the number of files to process (safety guard)', '20')
    .option('--out-dir <dir>', 'where to write the signed aggregate receipt JSON', '.ivaronix/receipts/anchored')
    .action(async (dir: string, opts: { pattern: string; question: string; skill: string; tier: string; maxFiles: string; outDir: string }) => {
      const env = loadEnv();
      if (!env.privateKey || !env.walletAddress) {
        ui.fail('doc bulk requires EVM_PRIVATE_KEY + EVM_WALLET_ADDRESS in .env');
        process.exitCode = 1;
        return;
      }

      const absDir = resolve(dir);
      if (!existsSync(absDir) || !statSync(absDir).isDirectory()) {
        ui.fail(`directory not found: ${absDir}`);
        process.exitCode = 1;
        return;
      }

      const pattern = opts.pattern ? new RegExp(opts.pattern) : DEFAULT_PATTERN;
      const maxFiles = Math.max(1, Math.min(50, Number(opts.maxFiles)));
      const allFiles = readdirSync(absDir)
        .filter((f) => pattern.test(f))
        .map((f) => resolve(absDir, f))
        .filter((p) => statSync(p).isFile())
        .sort()
        .slice(0, maxFiles);

      if (allFiles.length === 0) {
        ui.fail(`no files matching ${pattern} in ${absDir}`);
        process.exitCode = 1;
        return;
      }

      ui.title(`Bulk audit · ${allFiles.length} file${allFiles.length === 1 ? '' : 's'} · skill ${opts.skill}`);
      ui.info(`directory            ${absDir}`);
      ui.info(`pattern              ${pattern}`);
      ui.info(`question             "${opts.question}"`);
      ui.info(`tier                 ${opts.tier}`);
      ui.divider();

      // Snapshot existing receipts so we can detect the new children
      // produced by each child run (docCommand.parseAsync writes JSON to
      // env.outDir which defaults to .ivaronix/receipts/anchored).
      const receiptsDirGuess = resolve(process.cwd(), '.ivaronix', 'receipts', 'anchored');
      const before = existsSync(receiptsDirGuess) ? new Set(readdirSync(receiptsDirGuess)) : new Set<string>();

      const tierFlag = opts.tier === 'standard' ? '--consensus' : opts.tier === 'high-stakes' ? '--high-stakes' : '--quick';

      interface ChildResult {
        filePath: string;
        fileName: string;
        receiptId: string | null;
        onChainId: string | null;
        riskLevel: string | null;
        headline: string | null;
        ok: boolean;
      }
      const children: ChildResult[] = [];

      for (let i = 0; i < allFiles.length; i++) {
        const filePath = allFiles[i]!;
        const fileName = basename(filePath);
        ui.title(`[${i + 1}/${allFiles.length}] ${fileName}`);
        const args = ['node', 'doc', 'ask', filePath, opts.question, '--skill', opts.skill, tierFlag];

        let childOk = false;
        try {
          process.exitCode = 0;
          await docCommand.parseAsync(args);
          childOk = process.exitCode === 0 || process.exitCode === undefined;
        } catch (err) {
          ui.fail(`child run threw`, ((err as Error).message.split('\n')[0] ?? '').slice(0, 120));
        }

        // Find the new receipt JSON by diffing the directory
        let receiptId: string | null = null;
        let onChainId: string | null = null;
        let riskLevel: string | null = null;
        let headline: string | null = null;
        if (existsSync(receiptsDirGuess)) {
          const after = readdirSync(receiptsDirGuess);
          const fresh = after.filter((f) => !before.has(f) && f.startsWith('rcpt_'));
          if (fresh.length > 0) {
            const newest = fresh[fresh.length - 1]!;
            receiptId = newest.replace(/\.json$/, '');
            before.add(newest);
            try {
              const { readFileSync } = await import('node:fs');
              const body = JSON.parse(readFileSync(resolve(receiptsDirGuess, newest), 'utf8')) as Record<string, unknown>;
              const ca = body.chainAnchor as Record<string, unknown> | undefined;
              const outputs = body.outputs as Record<string, unknown> | undefined;
              const wording = outputs?.wording as Record<string, unknown> | undefined;
              onChainId = (ca?.onChainId as string | undefined) ?? null;
              riskLevel = (outputs?.riskLevel as string | undefined) ?? null;
              headline = (wording?.headline as string | undefined) ?? null;
            } catch { /* ignore body-parse errors */ }
          }
        }

        children.push({ filePath, fileName, receiptId, onChainId, riskLevel, headline, ok: childOk });
        ui.divider();
      }

      const okCount = children.filter((c) => c.ok && c.receiptId).length;
      ui.title(`Children complete · ${okCount}/${allFiles.length} anchored`);
      for (const c of children) {
        const id = c.onChainId ? `#${c.onChainId}` : c.receiptId ? c.receiptId.slice(0, 18) : '(no receipt)';
        const status = c.ok ? '✓' : '✗';
        ui.info(`${status} ${c.fileName.padEnd(36)} risk=${(c.riskLevel ?? '—').padEnd(7)} ${id}`);
      }
      ui.divider();

      if (okCount === 0) {
        ui.fail('no child receipts anchored — skipping aggregate receipt');
        process.exitCode = 1;
        return;
      }

      // ─── Aggregate receipt ────────────────────────────────────────────
      ui.title('Aggregate receipt');
      const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
      const wallet = new Wallet(env.privateKey, provider);
      const registryAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
      const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
      if (!registryAddr) { ui.fail('ReceiptRegistry not deployed'); process.exitCode = 1; return; }
      const reg = new ReceiptRegistryClient(registryAddr, wallet);

      const childIds = children.filter((c) => c.receiptId).map((c) => c.receiptId!);
      const dominantRisk = (() => {
        const counts: Record<string, number> = {};
        for (const c of children) if (c.riskLevel) counts[c.riskLevel] = (counts[c.riskLevel] ?? 0) + 1;
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
      })();

      const summaryLines: string[] = [];
      summaryLines.push(`Bulk audit of ${children.length} document${children.length === 1 ? '' : 's'} via ${opts.skill}.`);
      summaryLines.push(`Dominant risk level: ${dominantRisk}.`);
      summaryLines.push('');
      summaryLines.push('Per-document headlines:');
      for (const c of children) {
        const id = c.onChainId ? `#${c.onChainId}` : c.receiptId ? c.receiptId.slice(0, 14) + '…' : '(no receipt)';
        const head = c.headline ? c.headline.slice(0, 160) + (c.headline.length > 160 ? '…' : '') : '(no headline)';
        summaryLines.push(`- [${id}] ${c.fileName} · risk=${c.riskLevel ?? '—'} · ${head}`);
      }
      const summary = summaryLines.join('\n');

      const userPromptHash = (await sha256HexAsync(new TextEncoder().encode(`bulk:${absDir}:${opts.question}`))) as Hash;
      const outputHash = (await sha256HexAsync(new TextEncoder().encode(summary))) as Hash;
      const childIdsCanonical = (await sha256HexAsync(new TextEncoder().encode(childIds.join(',')))) as Hash;
      const childIdsBytes32 = ('0x' + childIdsCanonical.replace(/^sha256:/, '')) as Hash;

      const draft = buildReceipt({
        type: 'memory_consolidation',
        agent: {
          passportId: `did:0g:passport:${env.walletAddress}:1`,
          ownerWallet: env.walletAddress as Address,
          trustScoreAtTime: 0,
        },
        request: {
          skillId: 'doc.bulk',
          skillVersion: '0.1.0',
          skillManifestHash: childIdsCanonical,
          userPromptHash,
          inputArtifacts: [{ kind: 'doc', encrypted: false }],
          policyDecision: 'approved',
          approvalChain: [{ gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:default-strict' }],
          priorReceiptIds: childIds,
        },
        execution: {
          mode: 'memory_consolidation',
          burnMode: false,
          consensusMode: false,
          modelSelection: { requested: 'n/a', final: 'n/a' },
          providerRouting: {
            allowFallbacks: true,
            finalProvider: '0x0000000000000000000000000000000000000000' as Address,
          },
        },
        teeVerification: {
          requested: false,
          routerVerified: false,
          independentVerified: null,
          verificationMethod: 'external-signed',
          verifiedAt: null,
        },
        routerTrace: {
          requestId: `doc.bulk:${Date.now()}`,
          x0gTrace: {},
          rateLimit: {},
        },
        billing: {
          inputTokens: 0,
          outputTokens: 0,
          inputCostNeuron: '0',
          outputCostNeuron: '0',
          totalCostNeuron: '0',
          totalCostOg: '0.0000000000',
        },
        chainAnchor: defaultChainAnchor(env.network as 'testnet' | 'mainnet', registryAddr as Address),
        storage: {
          proofDownloadVerified: false,
          encryption: { enabled: false, type: 'none', headerDetected: false },
        },
        outputs: {
          outputHash,
          citations: [],
          riskLevel: dominantRisk === 'high' || dominantRisk === 'medium' || dominantRisk === 'low' ? dominantRisk : 'low',
          wording: {
            headline: summaryLines[0]!.slice(0, 200),
            doNotSay: ['truth score', 'verified by AI', 'guaranteed safe'],
          },
        },
        createdBy: 'ivaronix-runtime/0.0.1',
      });

      const signed = await signReceipt(draft, wallet);

      // Persist locally
      const outDir = resolve(opts.outDir);
      mkdirSync(outDir, { recursive: true });
      const localPath = resolve(outDir, `${signed.id}.json`);
      writeFileSync(localPath, JSON.stringify(signed, null, 2));
      ui.pass(`aggregate receipt    ${signed.id}`);
      ui.pass(`receiptRoot          ${signed.storage!.receiptRoot}`);
      ui.pass(`written              ${localPath}`);

      // Anchor on chain (slot 4 = memory_access, same Phase A constraint as 2B)
      const ZERO_HASH = ('0x' + '0'.repeat(64)) as Hash;
      const RECEIPT_TYPE_CODE = 4;
      ui.pending('anchoring aggregate on 0G Chain...');
      const tx = await reg.anchor(
        signed.storage!.receiptRoot as Hash,
        childIdsBytes32,
        RECEIPT_TYPE_CODE,
        ZERO_HASH,
      );
      const txReceipt = await tx.wait();
      const nextId = await reg.nextId();
      const onChainId = (nextId - 1n).toString();
      ui.pass(`tx                   ${tx.hash}`);
      ui.pass(`block                ${txReceipt?.blockNumber ?? '?'}`);
      ui.pass(`on-chain id          ${onChainId}`);

      // Update the persisted receipt with anchor info
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

      // Bump passport
      if (passportAddr) {
        try {
          const passport = new AgentPassportClient(passportAddr, wallet);
          const tokenId = await passport.passportOf(env.walletAddress as Address);
          if (tokenId !== 0n) {
            ui.pending(`recording aggregate against passport tokenId=${tokenId}...`);
            const ptx = await passport.recordReceipt(tokenId, signed.storage!.receiptRoot as Hash, RECEIPT_TYPE_CODE, 1);
            await ptx.wait();
            const refreshed = await passport.getPassport(tokenId);
            if (refreshed) {
              ui.pass(`passport updated     receiptCount=${refreshed.receiptCount} trustScore=${refreshed.trustScore}`);
            }
          }
        } catch (err) {
          ui.fail('passport update failed (aggregate is still anchored)', ((err as Error).message.split('\n')[0] ?? '').slice(0, 120));
        }
      }

      ui.divider();
      ui.pass(`Bulk audit complete · ${okCount} child receipt${okCount === 1 ? '' : 's'} + 1 aggregate (#${onChainId})`);
      ui.hint(`View aggregate:  http://localhost:3300/r/${onChainId}`);
      ui.hint(`Verify:          ivaronix receipt verify ${localPath} --tee-independent`);

      void extname; // keep import used
    });
}
