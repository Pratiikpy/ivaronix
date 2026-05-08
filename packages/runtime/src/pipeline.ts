import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Wallet, JsonRpcProvider } from 'ethers';
import {
  sha256HexAsync,
  RECEIPT_TYPES,
  ROLES_BY_TIER,
  type ConsensusTier,
  type Hash,
  type ReceiptType,
} from '@ivaronix/core';
import { buildReceipt, signReceipt, defaultChainAnchor } from '@ivaronix/receipts';
import {
  ReceiptRegistryClient,
  AgentPassportClient,
  getDeployedAddress,
} from '@ivaronix/og-chain';
import { keyringFromEnv } from '@ivaronix/og-router/keyring';
import { nvidiaFromEnv } from '@ivaronix/og-router';
import { runConsensus, TIER_COST_OG, type ConsensusResult } from '@ivaronix/consensus';
import {
  findSkill,
  scanSkill,
  evaluateSandbox,
  SkillRegistryClient,
  resolveHooks,
  runHooks,
  type LoadedSkill,
  type ScanResult,
  type HookEvent_PreConsensus,
  type HookEvent_PostConsensus,
  type HookEvent_SessionStart,
} from '@ivaronix/skills';
import { loadEnv, type Env } from './env.js';
import { noopLogger, type PipelineLogger } from './logger.js';

/**
 * Shared run-skill pipeline. Used by:
 *   - CLI: plan / code / audit / swarm / watch (with a UI-bound logger)
 *   - Studio API route /api/run (with a capture logger)
 *
 * Performs: skill load → registry scan → sandbox → session.start →
 * consensus.pre (with patch) → consensus → consensus.post →
 * (optional) receipt sign + anchor + passport update.
 *
 * Burn Mode lives in the CLI's bespoke `doc ask` flow because the evidence
 * digest UX is mode-specific.
 */

export interface PipelineInput {
  skillId: string;
  context: string;
  userPrompt: string;
  tier?: ConsensusTier;
  receipt?: boolean;
  outDir?: string;
  receiptType?: ReceiptType;
  skillSearchDirs?: string[];
  /** Prefix string for status lines (so swarm/watch can label per-iteration). */
  label?: string;
  /** Logger; defaults to no-op. CLI passes a ui-bound logger. */
  logger?: PipelineLogger;
  /**
   * Inference provider. Default `'0g'` uses the 0G Router with TEE attestation
   * (TIER 1). `'nvidia'` uses NVIDIA NIM (TIER 2 — external-signed). Receipts
   * are tagged so verifiers can show the trust tier honestly.
   */
  provider?: '0g' | 'nvidia';
  /** Optional model override (provider-specific id). */
  model?: string;
}

export interface PipelineOutput {
  skill: LoadedSkill;
  finalText: string;
  consensus: ConsensusResult;
  consensusMs: number;
  receiptPath: string | null;
  receiptId: string | null;
  receiptTxHash: string | null;
  receiptOnchainId: bigint | null;
  scan: ScanResult | undefined;
}

export function defaultSearchDirs(): string[] {
  const cwd = process.cwd();
  const local = resolve(cwd, '.ivaronix', 'skills');
  let dir = cwd;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, 'seed-skills');
    if (existsSync(candidate)) return [local, candidate];
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return [local];
}

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const env = loadEnv();
  const log = input.logger ?? noopLogger;
  const tag = (msg: string) => (input.label ? `[${input.label}] ${msg}` : msg);

  // 0. Load skill
  const skill = findSkill(input.skillId, input.skillSearchDirs ?? defaultSearchDirs());
  if (!skill) throw new Error(`Skill "${input.skillId}" not found`);
  const tier: ConsensusTier = input.tier ?? skill.manifest.og.consensus.default_tier;

  log.info(tag(`skill                ${skill.id}@${skill.manifest.version}  tier=${tier}  ~${TIER_COST_OG[tier]} OG`));

  // 1. Scanner
  const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
  const skillRegistryAddr = getDeployedAddress(env.network, 'SkillRegistry');
  let scan: ScanResult | undefined;
  if (skillRegistryAddr) {
    const reg = new SkillRegistryClient(skillRegistryAddr, provider);
    scan = await scanSkill(skill, reg);
    if (scan.matches) log.pass(tag(`registry scan        MATCH (creator ${scan.creator})`));
    else if (scan.revoked) throw new Error(`registry: ${skill.id}@${skill.manifest.version} REVOKED on chain`);
    else if (scan.registered && !scan.matches) throw new Error(`registry: ${scan.reason}`);
    else log.info(tag(`registry scan        not registered (local-only)`));
  }

  // 2. Trust score
  let callerTrust = 0;
  try {
    const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
    if (passportAddr && env.walletAddress) {
      const pc = new AgentPassportClient(passportAddr, provider);
      const profile = await pc.getPassportByWallet(env.walletAddress as `0x${string}`);
      if (profile) callerTrust = Number(profile.trustScore ?? 0);
    }
  } catch { /* best-effort */ }

  // 3. Sandbox
  const decision = evaluateSandbox(skill, {
    callerTrustScore: callerTrust,
    receiptRequested: !!input.receipt,
    burnEnabled: false,
    scan,
  });
  for (const v of decision.violations) {
    if (v.severity === 'block') log.fail(tag(`sandbox.${v.code}`), v.message);
  }
  if (!decision.allow) throw new Error(`sandbox refused this run`);

  // 4. session.start hooks
  const sessionStartHooks = resolveHooks(skill.manifest.og.hooks?.session_start, 'session.start');
  if (sessionStartHooks.length > 0) {
    const evt: HookEvent_SessionStart = {
      kind: 'session.start',
      skill,
      network: env.network,
      caller: (env.walletAddress as `0x${string}` | undefined) ?? null,
      trustScore: callerTrust,
      command: 'pipeline',
      argv: [],
      startedAt: Date.now(),
    };
    const r = await runHooks(sessionStartHooks, evt);
    for (const lg of r.logs) log.info(tag(`hook                 ${lg}`));
    if (!r.allow) throw new Error(`session.start hook "${r.blockingHook}" refused: ${r.reason}`);
  }

  // 5. consensus.pre hooks
  let activeContext = input.context;
  let activePrompt = input.userPrompt;
  const preHooks = resolveHooks(skill.manifest.og.hooks?.pre_consensus, 'consensus.pre');
  if (preHooks.length > 0) {
    const evt: HookEvent_PreConsensus = {
      kind: 'consensus.pre',
      skill,
      network: env.network,
      caller: (env.walletAddress as `0x${string}` | undefined) ?? null,
      trustScore: callerTrust,
      context: activeContext,
      userPrompt: activePrompt,
      tier,
      estimatedCostOg: TIER_COST_OG[tier],
    };
    const r = await runHooks(preHooks, evt);
    for (const lg of r.logs) log.info(tag(`hook                 ${lg}`));
    if (!r.allow) throw new Error(`consensus.pre hook "${r.blockingHook}" refused: ${r.reason}`);
    if (r.patched.kind === 'consensus.pre') {
      activeContext = (r.patched as HookEvent_PreConsensus).context;
      activePrompt = (r.patched as HookEvent_PreConsensus).userPrompt;
    }
  }

  // 6. Router — branch by provider
  const providerKind = input.provider ?? '0g';
  const enrichedContext = `${skill.systemPromptBody}\n\n--- INPUT START ---\n${activeContext}\n--- INPUT END ---`;
  const startTime = Date.now();
  let consensus: ConsensusResult;

  if (providerKind === 'nvidia') {
    // TIER 2 path — NVIDIA NIM, single-shot, no role-based consensus.
    const nim = nvidiaFromEnv();
    if (!nim) throw new Error('NVIDIA NIM not configured (.env: NVIDIA_API_KEY=nvapi-...)');
    log.info(tag(`provider             nvidia-nim · TIER 2 (external-signed)`));
    const r = await nim.chatRich({
      model: input.model ?? process.env.NVIDIA_DEFAULT_MODEL ?? 'qwen/qwen3.5-397b-a17b',
      messages: [
        { role: 'system', content: enrichedContext },
        { role: 'user', content: activePrompt },
      ],
      stream: false,
    });
    // Synthesize a ConsensusResult so downstream receipt-builder is unchanged.
    consensus = {
      tier: 'quick',
      roles: ['analyst'],
      reviewerOutputs: [{ role: 'analyst', content: r.content }],
      judgement: null,
      convergence: { score: 1, pairwise: {}, method: 'jaccard-tokens', agreementSummary: '', disagreementSummary: '' },
      attestations: [{
        role: 'analyst',
        providerAddress: null,
        zgResKey: null,
        attestationHash: null,
        routerVerified: false,
        independentVerified: null,
        inputTokens: r.inputTokens ?? 0,
        outputTokens: r.outputTokens ?? 0,
      }] as ConsensusResult['attestations'],
      billing: {
        totalInputTokens: r.inputTokens ?? 0,
        totalOutputTokens: r.outputTokens ?? 0,
        estimatedCostOg: 0,
      },
      gateResult: { pass: true, warnings: [] },
    };
  } else {
    // TIER 1 default — 0G Router with TEE attestation
    const keyring = keyringFromEnv();
    if (!keyring) throw new Error('Router not configured (.env: ZG_API_SECRET / ZG_SERVICE_URL / OG_COMPUTE_PROVIDER / EVM_WALLET_ADDRESS)');
    consensus = await runConsensus({
      tier,
      keyring,
      model: input.model ?? env.defaultModel,
      context: enrichedContext,
      userPrompt: activePrompt,
      rawBytes: Buffer.from(activeContext, 'utf8'),
    });
  }
  const elapsedMs = Date.now() - startTime;
  log.pass(tag(`consensus complete   ${elapsedMs}ms · ${consensus.billing.totalInputTokens}+${consensus.billing.totalOutputTokens} tok · ${consensus.billing.estimatedCostOg.toFixed(8)} OG`));

  // 7. consensus.post hooks
  const postHooks = resolveHooks(skill.manifest.og.hooks?.post_consensus, 'consensus.post');
  if (postHooks.length > 0) {
    const evt: HookEvent_PostConsensus = {
      kind: 'consensus.post',
      skill,
      network: env.network,
      caller: (env.walletAddress as `0x${string}` | undefined) ?? null,
      trustScore: callerTrust,
      ms: elapsedMs,
      inputTokens: consensus.billing.totalInputTokens,
      outputTokens: consensus.billing.totalOutputTokens,
      costOg: consensus.billing.estimatedCostOg,
      convergenceScore: consensus.convergence.score ?? null,
    };
    const r = await runHooks(postHooks, evt);
    for (const lg of r.logs) log.info(tag(`hook                 ${lg}`));
  }

  const finalText = consensus.judgement?.content ?? consensus.reviewerOutputs[0]?.content ?? '';

  let receiptPath: string | null = null;
  let receiptId: string | null = null;
  let receiptTxHash: string | null = null;
  let receiptOnchainId: bigint | null = null;

  if (input.receipt) {
    const result = await anchorReceipt({
      env,
      skill,
      tier,
      activeContext,
      activePrompt,
      finalText,
      consensus,
      outDir: input.outDir ?? '.ivaronix/receipts/anchored',
      receiptType: input.receiptType ?? 'doc_ask',
      tag,
      log,
      provider: providerKind,
    });
    receiptPath = result.path;
    receiptId = result.id;
    receiptTxHash = result.txHash;
    receiptOnchainId = result.onchainId;
  }

  return {
    skill,
    finalText,
    consensus,
    consensusMs: elapsedMs,
    receiptPath,
    receiptId,
    receiptTxHash,
    receiptOnchainId,
    scan,
  };
}

interface AnchorArgs {
  env: Env;
  skill: LoadedSkill;
  tier: ConsensusTier;
  activeContext: string;
  activePrompt: string;
  finalText: string;
  consensus: ConsensusResult;
  outDir: string;
  receiptType: ReceiptType;
  provider: '0g' | 'nvidia';
  tag: (msg: string) => string;
  log: PipelineLogger;
}

async function anchorReceipt(a: AnchorArgs): Promise<{ path: string; id: string; txHash: string; onchainId: bigint | null }> {
  const { env, skill, tier, activeContext, activePrompt, finalText, consensus, outDir, receiptType, tag, log } = a;

  if (!env.privateKey) throw new Error('No private key for receipt signing');
  const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
  const wallet = new Wallet(env.privateKey, provider);

  const registryAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
  if (!registryAddr) throw new Error(`ReceiptRegistry not deployed on ${env.network}`);

  const evidenceDigest = await sha256HexAsync(activeContext);
  const outputHash = await sha256HexAsync(finalText);
  const userPromptHash = await sha256HexAsync(activePrompt);

  const primaryRole = consensus.judgement ? consensus.judgement.role : consensus.reviewerOutputs[0]?.role;
  const primaryAtt = consensus.attestations.find((x) => x.role === primaryRole);

  const draft = buildReceipt({
    type: receiptType,
    agent: {
      passportId: `did:0g:passport:${wallet.address}:1`,
      ownerWallet: wallet.address as `0x${string}`,
      trustScoreAtTime: 0,
    },
    request: {
      skillId: skill.id,
      skillVersion: skill.manifest.version,
      skillManifestHash: skill.manifestHash,
      userPromptHash,
      inputArtifacts: [{ kind: 'doc', encrypted: false }],
      policyDecision: 'approved',
      approvalChain: [{ gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:default-strict' }],
    },
    execution: {
      mode: receiptType,
      burnMode: false,
      consensusMode: tier !== 'quick',
      modelSelection: { requested: env.defaultModel, final: env.defaultModel },
      providerRouting: {
        allowFallbacks: true,
        finalProvider: (primaryAtt?.providerAddress ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
      },
      consensus:
        tier !== 'quick'
          ? {
              roles: consensus.attestations.map((x) => x.role),
              convergenceScore: consensus.convergence.score,
              agreementSummary: consensus.convergence.agreementSummary,
              disagreementSummary: consensus.convergence.disagreementSummary,
              individualAttestations: consensus.attestations
                .filter((x) => x.providerAddress)
                .map((x) => ({
                  role: x.role,
                  attestationHash: ('0x' + '0'.repeat(64)) as Hash,
                  providerAddress: x.providerAddress!,
                  chatId: x.zgResKey ?? undefined,
                  independentVerified: null,
                })),
            }
          : undefined,
    },
    routerTrace: {
      requestId: `pipeline-${Date.now()}`,
      zgResKey: primaryAtt?.zgResKey ?? undefined,
      x0gTrace: {},
      rateLimit: {},
    },
    teeVerification: {
      requested: a.provider === '0g',
      routerVerified: a.provider === '0g' && !!primaryAtt?.routerVerified,
      independentVerified: null,
      providerAddress: (primaryAtt?.providerAddress ?? undefined) as `0x${string}` | undefined,
      verificationMethod: a.provider === 'nvidia' ? 'external-signed' : 'router_flag',
      verifiedAt: null,
      tier: a.provider === 'nvidia' ? 'tier-2-external-signed' : 'tier-1-tee',
      providerKind: a.provider === 'nvidia' ? 'nvidia-nim' : '0g-router',
    },
    billing: {
      inputTokens: consensus.billing.totalInputTokens,
      outputTokens: consensus.billing.totalOutputTokens,
      inputCostNeuron: String(Math.floor(consensus.billing.totalInputTokens * 5e10)),
      outputCostNeuron: String(Math.floor(consensus.billing.totalOutputTokens * 1e11)),
      totalCostNeuron: String(
        Math.floor(consensus.billing.totalInputTokens * 5e10 + consensus.billing.totalOutputTokens * 1e11),
      ),
      totalCostOg: consensus.billing.estimatedCostOg.toFixed(10),
    },
    storage: {
      proofDownloadVerified: false,
      encryption: { enabled: false, type: 'none', headerDetected: false },
    },
    chainAnchor: defaultChainAnchor(env.network, registryAddr),
    outputs: {
      outputHash,
      citations: [],
      riskLevel: 'low',
      wording: {
        headline: finalText.slice(0, 200).replace(/\n+/g, ' '),
        doNotSay: ['truth score', 'verified by AI', 'guaranteed safe'],
      },
    },
    createdBy: 'ivaronix-runtime/0.0.1',
  });

  const signed = await signReceipt(draft, wallet);
  const dir = resolve(process.cwd(), outDir);
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, `${signed.id}.json`);
  writeFileSync(path, JSON.stringify(signed, null, 2));

  const registry = new ReceiptRegistryClient(registryAddr, wallet);
  const typeCode = RECEIPT_TYPES[draft.type];
  const evidenceBytes32 = ('0x' + evidenceDigest.replace(/^sha256:/, '')) as Hash;
  const tx = await registry.anchor(
    signed.storage.receiptRoot as Hash,
    evidenceBytes32,
    typeCode,
    ('0x' + '0'.repeat(64)) as Hash,
  );
  const txReceipt = await tx.wait();

  let onchainId: bigint | null = null;
  try {
    const onChain = await registry.findByReceiptRoot(signed.storage.receiptRoot as Hash, 50);
    if (onChain) onchainId = onChain.id;
  } catch { /* not fatal */ }

  log.pass(tag(`receipt              ${signed.id}  block=${txReceipt?.blockNumber}  on-chain id=${onchainId}`));

  // Best-effort passport update
  try {
    const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
    if (passportAddr) {
      const passport = new AgentPassportClient(passportAddr, wallet);
      const tokenId = await passport.passportOf(wallet.address as `0x${string}`);
      if (tokenId !== 0n) {
        const ptx = await passport.recordReceipt(tokenId, signed.storage.receiptRoot as Hash, typeCode, 1);
        await ptx.wait();
      }
    }
  } catch {
    /* receipt is anchored; passport update is opportunistic */
  }

  // Persist anchor metadata back into the receipt file
  writeFileSync(
    path,
    JSON.stringify(
      {
        ...signed,
        chainAnchor: {
          ...signed.chainAnchor,
          anchorTxHash: tx.hash,
          anchorBlockNumber: txReceipt?.blockNumber ?? 0,
          anchorTimestamp: Math.floor(Date.now() / 1000),
        },
      },
      null,
      2,
    ),
  );

  return { path, id: signed.id, txHash: tx.hash, onchainId };
}
