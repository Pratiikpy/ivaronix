import { Command } from 'commander';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { Wallet, JsonRpcProvider } from 'ethers';
import { sha256HexAsync, NETWORKS, RECEIPT_TYPES, ROLES_BY_TIER, type ConsensusTier, type Hash } from '@ivaronix/core';
import { buildReceipt, signReceipt, defaultChainAnchor } from '@ivaronix/receipts';
import { ReceiptRegistryClient, getDeployedAddress } from '@ivaronix/og-chain';
import { keyringFromEnv } from '@ivaronix/og-router/keyring';
import { burnEncrypt } from '@ivaronix/og-storage';
import { runConsensus, TIER_COST_OG } from '@ivaronix/consensus';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

export const docCommand = new Command('doc')
  .description('Private document Q&A — the killer demo');

docCommand
  .command('ask <file> <question>')
  .description('Ask a question about a private document; produce an Action Receipt anchored on 0G Chain')
  .option('--burn', 'enable Burn Mode (AES-256-GCM session key destroyed after use)')
  .option('--consensus', 'enable Standard 3-role consensus (analyst/critic/judge) — default tier when set')
  .option('--high-stakes', 'use 5-role High-Stakes consensus (legal/contract/financial/medical)')
  .option('--quick', 'force 1-model Quick tier (overrides --consensus / --high-stakes)')
  .option('--receipt', 'create an Action Receipt for this run', true)
  .option('--model <id>', 'override default model', 'qwen/qwen-2.5-7b-instruct')
  .option('--out-dir <dir>', 'where to write the signed receipt JSON', '.ivaronix/receipts/anchored')
  .action(async (file: string, question: string, opts: { burn?: boolean; consensus?: boolean; highStakes?: boolean; quick?: boolean; receipt?: boolean; model: string; outDir: string }) => {
    const env = loadEnv();

    // Resolve tier — Quick is default; --consensus → Standard; --high-stakes → High-Stakes
    let tier: ConsensusTier = 'quick';
    if (opts.highStakes) tier = 'high-stakes';
    else if (opts.consensus) tier = 'standard';
    if (opts.quick) tier = 'quick';

    // ─── 1. Read the file ─────────────────────────────────────────────────
    const filePath = resolve(process.cwd(), file);
    let docBytes: Buffer;
    try {
      docBytes = readFileSync(filePath);
    } catch (err) {
      ui.fail(`Cannot read ${file}`, (err as Error).message);
      process.exitCode = 1;
      return;
    }

    ui.title(`doc ask ${basename(file)}`);
    ui.info(`question:            "${question}"`);
    ui.info(`model:               ${opts.model}`);
    ui.info(`burn mode:           ${opts.burn ? 'ON (AES-256-GCM)' : 'off'}`);
    ui.info(`consensus tier:      ${tier} (~${TIER_COST_OG[tier]} OG estimate)`);
    ui.info(`roles:               ${ROLES_BY_TIER[tier].join(', ')}`);
    ui.divider();

    // ─── 2. Encryption (Burn Mode) ────────────────────────────────────────
    let burnMeta: { keyFingerprint: `sha256:${string}`; encryptionType: 'aes-256-gcm'; destroyedAt: number } | null = null;
    let evidenceBytes: Uint8Array;
    if (opts.burn) {
      ui.pending('encrypting with AES-256-GCM session key...');
      const enc = burnEncrypt(docBytes);
      evidenceBytes = enc.ciphertext;
      burnMeta = {
        keyFingerprint: enc.keyFingerprint,
        encryptionType: enc.encryptionType,
        destroyedAt: enc.destroyedAt,
      };
      ui.pass(`session key fingerprint: ${enc.keyFingerprint.slice(0, 30)}…`);
      ui.pass(`session key destroyed at ${new Date(enc.destroyedAt).toISOString()}`);
    } else {
      evidenceBytes = new Uint8Array(docBytes);
    }
    const evidenceDigest = sha256HexAsync(evidenceBytes);
    ui.info(`evidence digest:     ${evidenceDigest}`);

    // ─── 3. Inference ─────────────────────────────────────────────────────
    const keyring = keyringFromEnv();
    if (!keyring) {
      ui.fail('Router not configured', 'Set ZG_API_SECRET / ZG_SERVICE_URL / OG_COMPUTE_PROVIDER / EVM_WALLET_ADDRESS in .env');
      process.exitCode = 1;
      return;
    }

    const contextText = docBytes.toString('utf8', 0, Math.min(docBytes.length, 8192));

    ui.pending(`querying 0G Router (${tier} tier, ${ROLES_BY_TIER[tier].length} role${ROLES_BY_TIER[tier].length > 1 ? 's' : ''})...`);
    const startTime = Date.now();

    const consensusResult = await runConsensus({
      tier,
      keyring,
      model: opts.model,
      context: contextText,
      userPrompt: question,
      rawBytes: docBytes,
      // Optional: future polish — pass live router balance + registry pause state
    });

    const elapsedMs = Date.now() - startTime;

    if (consensusResult.gateResult.warnings.length > 0) {
      ui.divider();
      for (const w of consensusResult.gateResult.warnings) ui.pending(`⚠ ${w}`);
    }

    ui.pass(`consensus complete (${elapsedMs} ms; ${consensusResult.billing.totalInputTokens}+${consensusResult.billing.totalOutputTokens} tokens; ${consensusResult.billing.estimatedCostOg.toFixed(8)} OG)`);
    ui.info(`convergence score:   ${consensusResult.convergence.score}  (${consensusResult.convergence.method})`);

    if (consensusResult.judgement) {
      ui.divider();
      ui.title('JUDGE');
      console.log(consensusResult.judgement.content);
    } else {
      ui.divider();
      console.log(consensusResult.reviewerOutputs[0]?.content ?? '');
    }

    if (consensusResult.convergence.disagreementSummary) {
      ui.divider();
      ui.section('disagreement summary');
      console.log(consensusResult.convergence.disagreementSummary);
    }
    ui.divider();

    // Pick the canonical "output" for the receipt: judge if present, else single reviewer.
    const finalOutput = consensusResult.judgement?.content
      ?? consensusResult.reviewerOutputs[0]?.content
      ?? '';
    const outputHash = sha256HexAsync(finalOutput);

    // ─── 4. Build + sign receipt ──────────────────────────────────────────
    if (!opts.receipt) {
      ui.hint('--receipt skipped; not building/anchoring receipt.');
      return;
    }

    if (!env.privateKey) {
      ui.fail('No private key in .env');
      process.exitCode = 1;
      return;
    }

    const registryAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
    if (!registryAddr) {
      ui.fail(`ReceiptRegistry not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }

    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const wallet = new Wallet(env.privateKey, provider);

    // Pick the primary attestation for the receipt's teeVerification block — the judge if present
    const primaryRole = consensusResult.judgement ? consensusResult.judgement.role : consensusResult.reviewerOutputs[0]?.role;
    const primaryAtt = consensusResult.attestations.find((a) => a.role === primaryRole);

    const draft = buildReceipt({
      type: tier === 'quick' ? 'doc_ask' : 'consensus',
      agent: {
        passportId: `did:0g:passport:${wallet.address}:1`,
        ownerWallet: wallet.address as `0x${string}`,
        trustScoreAtTime: 0,
      },
      request: {
        skillId: 'private-doc-review',
        skillVersion: '0.0.1',
        skillManifestHash: sha256HexAsync('private-doc-review:0.0.1'),
        userPromptHash: sha256HexAsync(question),
        inputArtifacts: [{ kind: 'doc', encrypted: !!opts.burn }],
        policyDecision: 'approved',
        approvalChain: [{ gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:default-strict' }],
      },
      execution: {
        mode: tier === 'quick' ? 'doc_ask' : 'consensus',
        burnMode: !!opts.burn,
        consensusMode: tier !== 'quick',
        modelSelection: { requested: opts.model, final: opts.model },
        providerRouting: {
          allowFallbacks: true,
          finalProvider: (primaryAtt?.providerAddress ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
        },
        consensus: tier !== 'quick'
          ? {
              roles: consensusResult.attestations.map((a) => a.role),
              convergenceScore: consensusResult.convergence.score,
              agreementSummary: consensusResult.convergence.agreementSummary,
              disagreementSummary: consensusResult.convergence.disagreementSummary,
              individualAttestations: consensusResult.attestations
                .filter((a) => a.providerAddress)
                .map((a) => ({
                  role: a.role,
                  attestationHash: ('0x' + '0'.repeat(64)) as Hash, // populated by --tee-independent verify; unknown at build time
                  providerAddress: a.providerAddress!,
                  chatId: a.zgResKey ?? undefined,
                  independentVerified: null,
                })),
            }
          : undefined,
      },
      routerTrace: {
        requestId: `doc-ask-${Date.now()}`,
        zgResKey: primaryAtt?.zgResKey ?? undefined,
        x0gTrace: {},
        rateLimit: {},
      },
      teeVerification: {
        requested: true,
        routerVerified: !!primaryAtt?.routerVerified,
        independentVerified: null,
        providerAddress: (primaryAtt?.providerAddress ?? undefined) as `0x${string}` | undefined,
        verificationMethod: 'router_flag',
        verifiedAt: null,
      },
      billing: {
        inputTokens: consensusResult.billing.totalInputTokens,
        outputTokens: consensusResult.billing.totalOutputTokens,
        inputCostNeuron: String(Math.floor(consensusResult.billing.totalInputTokens * 5e10)),
        outputCostNeuron: String(Math.floor(consensusResult.billing.totalOutputTokens * 1e11)),
        totalCostNeuron: String(Math.floor(consensusResult.billing.totalInputTokens * 5e10 + consensusResult.billing.totalOutputTokens * 1e11)),
        totalCostOg: consensusResult.billing.estimatedCostOg.toFixed(10),
      },
      storage: {
        proofDownloadVerified: false,
        encryption: opts.burn
          ? {
              enabled: true,
              type: 'aes-256-gcm',
              headerDetected: true,
              keyFingerprint: burnMeta!.keyFingerprint,
            }
          : { enabled: false, type: 'none', headerDetected: false },
      },
      burn: opts.burn
        ? {
            sessionKeyDestroyedAt: burnMeta!.destroyedAt,
            localCleanupStatus: 'completed',
            tempPathsZeroed: [],
            wording: 'Session key destroyed; ciphertext now unreadable to operator. Burn Mode protects against operator-side disclosure; local-machine compromise is out of scope.',
          }
        : undefined,
      chainAnchor: defaultChainAnchor(env.network, registryAddr),
      outputs: {
        outputHash,
        citations: [],
        riskLevel: 'low',
        wording: {
          headline: finalOutput.slice(0, 200).replace(/\n+/g, ' '),
          doNotSay: ['truth score', 'verified by AI', 'guaranteed safe'],
        },
      },
      createdBy: 'ivaronix-forge/0.0.1',
    });

    ui.pending('signing receipt...');
    const signed = await signReceipt(draft, wallet);
    ui.pass(`receiptId            ${signed.id}`);
    ui.pass(`receiptRoot          ${signed.storage.receiptRoot}`);

    const outDir = resolve(process.cwd(), opts.outDir);
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `${signed.id}.json`);
    writeFileSync(outPath, JSON.stringify(signed, null, 2));
    ui.pass(`written              ${outPath}`);

    ui.pending('anchoring on 0G Chain...');
    const registry = new ReceiptRegistryClient(registryAddr, wallet);
    const typeCode = RECEIPT_TYPES[draft.type];
    const evidenceBytes32 = ('0x' + evidenceDigest.replace(/^sha256:/, '')) as Hash;
    const tx = await registry.anchor(
      signed.storage.receiptRoot as Hash,
      evidenceBytes32,
      typeCode,
      ('0x' + '0'.repeat(64)) as Hash,
    );
    ui.info(`tx hash              ${tx.hash}`);
    const txReceipt = await tx.wait();
    if (!txReceipt) {
      ui.fail('anchor tx did not return receipt');
      return;
    }
    ui.pass(`block                ${txReceipt.blockNumber}`);
    ui.pass(`gas used             ${txReceipt.gasUsed}`);

    const onChain = await registry.findByReceiptRoot(signed.storage.receiptRoot as Hash, 50);
    if (onChain) ui.pass(`receipt on-chain id  ${onChain.id}`);

    writeFileSync(outPath, JSON.stringify({
      ...signed,
      chainAnchor: {
        ...signed.chainAnchor,
        anchorTxHash: tx.hash,
        anchorBlockNumber: txReceipt.blockNumber,
        anchorTimestamp: Math.floor(Date.now() / 1000),
      },
    }, null, 2));

    ui.divider();
    ui.banner(true, '→ ANCHORED ✓');
    ui.hint(`Verify:    ivaronix receipt verify ${outPath} --tee-independent`);
    ui.hint(`Explorer:  ${NETWORKS[env.network].chainExplorer}/tx/${tx.hash}`);
  });
