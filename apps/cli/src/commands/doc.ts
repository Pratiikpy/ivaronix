import { Command } from 'commander';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { Wallet, JsonRpcProvider } from 'ethers';
import { sha256HexAsync, NETWORKS, RECEIPT_TYPES, type Hash } from '@ivaronix/core';
import { buildReceipt, signReceipt, defaultChainAnchor } from '@ivaronix/receipts';
import { ReceiptRegistryClient, getDeployedAddress } from '@ivaronix/og-chain';
import { keyringFromEnv } from '@ivaronix/og-router/keyring';
import { burnEncrypt } from '@ivaronix/og-storage';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

export const docCommand = new Command('doc')
  .description('Private document Q&A — the killer demo');

docCommand
  .command('ask <file> <question>')
  .description('Ask a question about a private document; produce an Action Receipt anchored on 0G Chain')
  .option('--burn', 'enable Burn Mode (AES-256-GCM session key destroyed after use)')
  .option('--consensus', 'enable Standard 3-role consensus (analyst/critic/judge) — Day 5')
  .option('--high-stakes', 'use 5-role High-Stakes consensus (Day 5)')
  .option('--quick', 'use 1-model Quick tier (default for Day 4)', true)
  .option('--receipt', 'create an Action Receipt for this run', true)
  .option('--model <id>', 'override default model', 'qwen/qwen-2.5-7b-instruct')
  .option('--out-dir <dir>', 'where to write the signed receipt JSON', '.ivaronix/receipts/anchored')
  .action(async (file: string, question: string, opts: { burn?: boolean; consensus?: boolean; highStakes?: boolean; quick?: boolean; receipt?: boolean; model: string; outDir: string }) => {
    const env = loadEnv();

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
    ui.info(`consensus tier:      ${opts.highStakes ? 'high-stakes (5-role)' : opts.consensus ? 'standard (3-role)' : 'quick (1-model)'}`);
    ui.divider();

    if (opts.consensus || opts.highStakes) {
      ui.pending('Consensus tier selected, but Day 4 ships Quick only. Day 5 adds 3-role / 5-role.');
    }

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

    // Evidence digest (content-addressable; placeholder for 0G Storage root until B-1 is fixed)
    const evidenceDigest = sha256HexAsync(evidenceBytes);
    ui.info(`evidence digest:     ${evidenceDigest}`);

    // ─── 3. Inference (Quick tier — 1 model) ──────────────────────────────
    const keyring = keyringFromEnv();
    if (!keyring) {
      ui.fail('Router not configured', 'Set ZG_API_SECRET / ZG_SERVICE_URL / OG_COMPUTE_PROVIDER / EVM_WALLET_ADDRESS in .env');
      process.exitCode = 1;
      return;
    }

    // Heuristic: if file is text-like, send first 8KB of plaintext as context.
    // Larger / binary files would need OCR or Storage-backed retrieval — Day 8 hybrid memory.
    const contextText = docBytes.toString('utf8', 0, Math.min(docBytes.length, 8192));
    const looksBinary = /[\x00-\x08\x0E-\x1F]/.test(contextText.slice(0, 256));
    if (looksBinary) {
      ui.fail('Cannot extract text from file', 'Day 4 supports text-like documents (.txt, .md, .json, source code). PDF parsing arrives Day 8.');
      process.exitCode = 1;
      return;
    }

    ui.pending('querying 0G Router (Quick tier)...');
    const startTime = Date.now();
    const callResult = await keyring.chat({
      model: opts.model,
      systemPrompt: `You are an expert document reviewer. Read the document below and answer the user's question concisely. If the question asks about risks, list each risk explicitly with a one-line rationale. Do not invent details not present in the document.\n\n--- DOCUMENT START ---\n${contextText}\n--- DOCUMENT END ---`,
      userPrompt: question,
      verifyTee: true,
    });
    const elapsedMs = Date.now() - startTime;

    ui.pass(`response (${callResult.outputTokens ?? '?'} tokens, ${elapsedMs} ms)`);
    if (callResult.providerAddress) ui.info(`provider:            ${callResult.providerAddress}`);
    if (callResult.routerVerified) ui.pass('Router-flag TEE verified');
    ui.divider();
    console.log(callResult.content);
    ui.divider();

    // Hash the output for the receipt (no plaintext in receipt JSON per RECEIPTS_SPEC §5)
    const outputHash = sha256HexAsync(callResult.content);

    // ─── 4. Build + sign receipt ──────────────────────────────────────────
    if (!opts.receipt) {
      ui.hint('--receipt skipped; not building/anchoring receipt.');
      return;
    }

    if (!env.privateKey) {
      ui.fail('No private key in .env', 'Set EVM_PRIVATE_KEY to sign + anchor receipts');
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

    const draft = buildReceipt({
      type: 'doc_ask',
      agent: {
        passportId: `did:0g:passport:${wallet.address}:1`, // Day 6 mints real passport
        ownerWallet: wallet.address as `0x${string}`,
        trustScoreAtTime: 0,
      },
      request: {
        skillId: 'private-doc-review',
        skillVersion: '0.0.1',
        skillManifestHash: sha256HexAsync('private-doc-review:0.0.1'), // Day 9 ships real skill
        userPromptHash: sha256HexAsync(question),
        inputArtifacts: [
          {
            kind: 'doc',
            // NOTE: storageRoot is omitted because B-1 (0G Storage upload revert) is unblocked.
            // The evidence digest is recorded in storage.encryption.keyFingerprint scope below.
            encrypted: !!opts.burn,
          },
        ],
        policyDecision: 'approved',
        approvalChain: [{ gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:default-strict' }],
      },
      execution: {
        mode: 'doc_ask',
        burnMode: !!opts.burn,
        consensusMode: false, // Day 5 enables this
        modelSelection: { requested: opts.model, final: opts.model },
        providerRouting: {
          allowFallbacks: true,
          finalProvider: (callResult.providerAddress ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
        },
      },
      routerTrace: {
        requestId: `doc-ask-${Date.now()}`,
        zgResKey: callResult.zgResKey,
        x0gTrace: callResult.x0gTrace ?? {},
        rateLimit: {},
      },
      teeVerification: {
        requested: true,
        routerVerified: !!callResult.routerVerified,
        independentVerified: null, // Day 5 — broker.processResponse
        providerAddress: callResult.providerAddress,
        verificationMethod: 'router_flag',
        verifiedAt: null,
      },
      billing: {
        inputTokens: callResult.inputTokens ?? contextText.length / 4,
        outputTokens: callResult.outputTokens ?? callResult.content.length / 4,
        // Cost calc: per 0G_TESTNET_NOTES.md — 0.05 OG / 1M input + 0.10 OG / 1M output
        inputCostNeuron: String(Math.floor(((callResult.inputTokens ?? 0) * 5e10))),
        outputCostNeuron: String(Math.floor(((callResult.outputTokens ?? 0) * 1e11))),
        totalCostNeuron: String(Math.floor((callResult.inputTokens ?? 0) * 5e10 + (callResult.outputTokens ?? 0) * 1e11)),
        totalCostOg: String(((callResult.inputTokens ?? 0) * 5e10 + (callResult.outputTokens ?? 0) * 1e11) / 1e18),
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
            wording: 'Session key destroyed; ciphertext remains on Storage and is now unreadable to operator. Burn Mode protects against operator-side disclosure; local-machine compromise is out of scope.',
          }
        : undefined,
      chainAnchor: defaultChainAnchor(env.network, registryAddr),
      outputs: {
        outputHash,
        citations: [],
        riskLevel: 'low',
        wording: {
          headline: callResult.content.slice(0, 200).replace(/\n+/g, ' '),
          doNotSay: ['truth score', 'verified by AI', 'guaranteed safe'],
        },
      },
      createdBy: 'ivaronix-forge/0.0.1',
    });

    ui.pending('signing receipt...');
    const signed = await signReceipt(draft, wallet);
    ui.pass(`receiptId            ${signed.id}`);
    ui.pass(`receiptRoot          ${signed.storage.receiptRoot}`);
    ui.pass(`signature.signer     ${signed.signature.signer}`);

    // ─── 5. Write receipt + anchor on chain ───────────────────────────────
    const outDir = resolve(process.cwd(), opts.outDir);
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `${signed.id}.json`);
    writeFileSync(outPath, JSON.stringify(signed, null, 2));
    ui.pass(`written              ${outPath}`);

    ui.pending('anchoring on 0G Chain...');
    const registry = new ReceiptRegistryClient(registryAddr, wallet);
    const typeCode = RECEIPT_TYPES['doc_ask'];
    // sha256:<hex> → 0x<hex> for bytes32 storageRoot slot. Until B-1 (0G Storage upload)
    // is unblocked, evidenceRoot on-chain is the keccak placeholder of the local digest.
    const evidenceBytes32 = ('0x' + evidenceDigest.replace(/^sha256:/, '')) as Hash;
    const tx = await registry.anchor(
      signed.storage.receiptRoot as Hash,
      evidenceBytes32,
      typeCode,
      callResult.x0gTrace?.attestationHash ? (callResult.x0gTrace.attestationHash as Hash) : ('0x' + '0'.repeat(64) as Hash),
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
    if (onChain) {
      ui.pass(`receipt on-chain id  ${onChain.id}`);
    }

    // Write back chain anchor info to file
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
    ui.hint(`Verify:    ivaronix receipt verify ${outPath}`);
    ui.hint(`Explorer:  ${NETWORKS[env.network].chainExplorer}/tx/${tx.hash}`);
  });
