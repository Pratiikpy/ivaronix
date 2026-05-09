import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Wallet, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';
import {
  sha256HexAsync,
  RECEIPT_TYPES,
  ROLES_BY_TIER,
  type ConsensusTier,
  type Hash,
  type ReceiptType,
} from '@ivaronix/core';
import { buildReceipt, signReceipt, defaultChainAnchor, allocateFeeSplit } from '@ivaronix/receipts';
import { burnEncrypt } from '@ivaronix/og-storage';
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
  type HookEvent_PreAnchor,
  type HookEvent_PostAnchor,
  type HookEvent_SessionEnd,
} from '@ivaronix/skills';
import { loadEnv, type Env } from './env.js';
import { noopLogger, type PipelineLogger } from './logger.js';
import { MemoryClient, buildMemoryContextBlock, type MemorySearchMethod } from './memory-client.js';

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
  /**
   * Burn Mode: encrypts the input context with an ephemeral AES-256-GCM
   * session key, records the key fingerprint in the receipt, and destroys
   * the key after the run. Receipt's `burn` block carries the destroyed
   * timestamp + cleanup status. Auto-enabled for skills with
   * `og.burn.auto_enable: true` (e.g. `private-doc-review`).
   */
  burn?: boolean;
  /**
   * W9 · When set to a 0x…40-hex address, the receipt's
   * `agent.ownerWallet` records this user wallet (instead of the
   * operator's), AND `agent.signedBy = 'operator-on-behalf-of-user'`.
   * The operator still signs the receipt body (browser cannot sign
   * server-side bytes); the chain anchor records the user as the
   * owning agent so trust is correctly attributed. Phase B replaces
   * this with full SIWE — the browser signs the receipt body itself.
   */
  delegatedOwnerWallet?: `0x${string}`;
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
  /**
   * 0G Storage Merkle root for the run's evidence blob, when the pipeline
   * uploaded one. `null` when no upload happened (the runtime path today
   * does not upload — see HALF_BAKED.md H-3). Surfaced so /api/run can
   * forward it to the client honestly.
   */
  storageEvidenceRoot: string | null;
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
  const pipelineStart = Date.now();
  const env = loadEnv();
  const log = input.logger ?? noopLogger;
  const tag = (msg: string) => (input.label ? `[${input.label}] ${msg}` : msg);

  // 0. Load skill
  const skill = findSkill(input.skillId, input.skillSearchDirs ?? defaultSearchDirs());
  if (!skill) throw new Error(`Skill "${input.skillId}" not found`);
  const tier: ConsensusTier = input.tier ?? skill.manifest.og.consensus.default_tier;
  // Burn Mode: caller-explicit OR skill-prescribed (e.g. private-doc-review).
  const burnEnabled = Boolean(input.burn ?? skill.manifest.og.burn?.auto_enable);

  log.info(tag(`skill                ${skill.id}@${skill.manifest.version}  tier=${tier}  ~${TIER_COST_OG[tier]} OG  burn=${burnEnabled ? 'on' : 'off'}`));

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

  // 3. Sandbox — pass providerKind so compute_tee_required is enforced for
  //    non-0G inference paths. Without this, a NIM-routed run against a
  //    TEE-required skill would silently downgrade to TIER 2 attestation.
  const decision = evaluateSandbox(skill, {
    callerTrustScore: callerTrust,
    receiptRequested: !!input.receipt,
    burnEnabled,
    scan,
    providerKind: input.provider ?? '0g',
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

  // 4b. 0G Persistent Memory retrieval (planning-002 W4) — opt-in via
  // ZG_MEMORY_URL. When set and reachable, search prior episodic memories
  // keyed by skillId + walletAddress, prepend the retrieved block to the
  // input context. When unset or unreachable, the run proceeds with no
  // memory context and the receipt body records `memoryQuery: undefined`.
  // Honest disclosure either way — the receipt shows whether memory was
  // queried and how many entries surfaced.
  const memoryClient = MemoryClient.fromEnv();
  let memoryQueryRecord: { method: MemorySearchMethod; k: number; retrievedCount: number; ok: boolean } | undefined;
  let memoryContextPrefix = '';
  if (memoryClient && env.walletAddress) {
    const result = await memoryClient.search({
      group_id: skill.id,
      user_id: env.walletAddress,
      query: input.userPrompt,
      method: 'agentic',
      k: 5,
    });
    memoryContextPrefix = buildMemoryContextBlock(result, skill.id);
    memoryQueryRecord = {
      method: result.method,
      k: 5,
      retrievedCount: result.retrievedCount,
      ok: result.ok,
    };
    if (result.ok && result.retrievedCount > 0) {
      log.info(tag(`memory               retrieved ${result.retrievedCount} prior memories from 0G Persistent Memory`));
    } else if (!result.ok) {
      log.info(tag(`memory               sidecar unreachable; proceeding without prior context (honest)`));
    }
  }

  // 5. consensus.pre hooks
  let activeContext = memoryContextPrefix + input.context;
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
  // The model that's actually used. Receipts must record THIS, not env.defaultModel
  // (which can mislead readers into thinking a 0G model ran for an NVIDIA tx).
  // CLAUDE.md §6: Honest > flattering.
  const resolvedModel = providerKind === 'nvidia'
    ? (input.model ?? process.env.NVIDIA_DEFAULT_MODEL ?? 'qwen/qwen3.5-397b-a17b')
    : (input.model ?? env.defaultModel);

  if (providerKind === 'nvidia') {
    // TIER 2 path — NVIDIA NIM, single-shot, no role-based consensus.
    const nim = nvidiaFromEnv();
    if (!nim) throw new Error('NVIDIA NIM not configured (.env: NVIDIA_API_KEY=nvapi-...)');
    log.info(tag(`provider             nvidia-nim · TIER 2 (external-signed)`));
    const r = await nim.chatRich({
      model: resolvedModel,
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
      model: resolvedModel,
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
      callerTrust,
      burnEnabled,
      resolvedModel,
      ...(memoryQueryRecord ? { memoryQuery: memoryQueryRecord } : {}),
      ...(input.delegatedOwnerWallet ? { delegatedOwnerWallet: input.delegatedOwnerWallet } : {}),
    });
    receiptPath = result.path;
    receiptId = result.id;
    receiptTxHash = result.txHash;
    receiptOnchainId = result.onchainId;

    // H-4: after a successful anchor, persist the receipt as an episodic
    // memory keyed by skillId + walletAddress. The pipeline already
    // searches Persistent Memory pre-consensus (line 211); without a write
    // call the store remained empty forever and `request.memoryQuery
    // .retrievedCount` was 0 on every run. Best-effort, never throws —
    // when the sidecar is unreachable the receipt is still anchored, the
    // memory hop is just unfilled. Honest by absence: when ZG_MEMORY_URL
    // is unset, memoryClient is null and the store call is skipped.
    if (memoryClient && env.walletAddress && receiptId) {
      const memContent = JSON.stringify({
        receiptId,
        receiptOnchainId: receiptOnchainId !== null ? receiptOnchainId.toString() : null,
        skillId: skill.id,
        skillVersion: skill.manifest.version,
        tier,
        finalText,
        convergenceScore: consensus.convergence.score,
      });
      const stored = await memoryClient.store({
        group_id: skill.id,
        user_id: env.walletAddress,
        type: 'episodic_memory',
        content: memContent,
        metadata: {
          receiptId,
          receiptOnchainId: receiptOnchainId !== null ? receiptOnchainId.toString() : null,
          tier,
          providerKind,
          anchorTxHash: receiptTxHash,
          anchoredAt: Date.now(),
        },
      });
      if (stored.ok) {
        log.info(tag(`memory               stored receipt ${receiptId} → 0G Persistent Memory (group=${skill.id})`));
      } else {
        log.info(tag(`memory               sidecar store failed (${stored.reason ?? 'unknown'}); receipt anchored regardless`));
      }
    }
  }

  // 8. session.end hooks (always last, even if anchor was skipped)
  const sessionEndHooks = resolveHooks(skill.manifest.og.hooks?.session_end, 'session.end');
  if (sessionEndHooks.length > 0) {
    const evt: HookEvent_SessionEnd = {
      kind: 'session.end',
      skill,
      network: env.network,
      caller: (env.walletAddress as `0x${string}` | undefined) ?? null,
      trustScore: callerTrust,
      totalMs: Date.now() - pipelineStart,
      receiptsAnchored: receiptId ? [receiptId] : [],
      exitCode: 0,
    };
    const r = await runHooks(sessionEndHooks, evt);
    for (const lg of r.logs) log.info(tag(`hook                 ${lg}`));
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
    // No 0G Storage upload happens in the Studio runtime path today (see
    // HALF_BAKED.md H-3). When H-3 lands, the upload result's Merkle root
    // populates this field; until then `null` is the honest answer and
    // RunPanel keeps the Storage light pending accordingly.
    storageEvidenceRoot: null,
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
  callerTrust: number;
  burnEnabled: boolean;
  resolvedModel: string;
  /** 0G Persistent Memory query record (planning-002 W4). undefined when
   * memory was not configured or not queried. */
  memoryQuery?: { method: MemorySearchMethod; k: number; retrievedCount: number; ok: boolean };
  /** W9 · SIWE-style delegated owner. When set, receipt's
   * `agent.ownerWallet` records the user wallet and
   * `agent.signedBy = 'operator-on-behalf-of-user'`. */
  delegatedOwnerWallet?: `0x${string}`;
}

async function anchorReceipt(a: AnchorArgs): Promise<{ path: string; id: string; txHash: string; onchainId: bigint | null }> {
  const { env, skill, tier, activeContext, activePrompt, finalText, consensus, outDir, receiptType, tag, log, burnEnabled, resolvedModel } = a;

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

  // I-2 / K-16 fix: Burn Mode runs REAL AES-256-GCM encryption on the input
  // context. Previous implementation wrote a fake `keyFingerprint =
  // sha256("burn:" + skillId + userPromptHash + sessionKeyDestroyedAt)` —
  // no real key, no real encryption. The schema's security claim was
  // unenforced. Now: `burnEncrypt(...)` from @ivaronix/og-storage generates
  // a fresh 32-byte session key via randomBytes, encrypts the context with
  // AES-256-GCM, captures the SHA-256 of the key BEFORE destruction, and
  // zeroes the key buffer. The CLI doc-ask path already uses this; the
  // Studio runtime now matches.
  let sessionKeyDestroyedAt = Date.now();
  let keyFingerprint: Hash | undefined;
  let burnCiphertext: Uint8Array | undefined;
  if (burnEnabled) {
    const burned = burnEncrypt(Buffer.from(activeContext, 'utf8'));
    keyFingerprint = burned.keyFingerprint as Hash;
    sessionKeyDestroyedAt = burned.destroyedAt;
    burnCiphertext = burned.ciphertext;
    log.info(tag(`burn-mode            encrypted ${burnCiphertext.length} bytes · keyFingerprint=${burned.keyFingerprint.slice(0, 23)}…  destroyed`));
  }
  // burnCiphertext is in-memory only at this point. When 0G Storage upload
  // is wired (HALF_BAKED H-3), this blob becomes the on-storage evidence;
  // until then the schema honestly omits the storage root and the receipt's
  // burn block records the destroyed-at + fingerprint as the key-existence
  // proof. Mark as intentionally unused so tsc with strict checks accepts.
  void burnCiphertext?.length;

  // W9 — when an SIWE-style delegated wallet is provided, the receipt
  // owner becomes the user's wallet (operator merely anchors).
  const ownerWallet = a.delegatedOwnerWallet ?? (wallet.address as `0x${string}`);
  const signedBy: 'operator' | 'operator-on-behalf-of-user' | 'user-direct' =
    a.delegatedOwnerWallet ? 'operator-on-behalf-of-user' : 'operator';

  const draft = buildReceipt({
    type: receiptType,
    agent: {
      passportId: `did:0g:passport:${ownerWallet}:1`,
      ownerWallet,
      trustScoreAtTime: 0,
      signedBy,
    },
    request: {
      skillId: skill.id,
      skillVersion: skill.manifest.version,
      skillManifestHash: skill.manifestHash,
      userPromptHash,
      inputArtifacts: [{ kind: 'doc', encrypted: burnEnabled }],
      policyDecision: 'approved',
      approvalChain: [{ gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:default-strict' }],
      ...(a.memoryQuery ? { memoryQuery: a.memoryQuery } : {}),
    },
    execution: {
      mode: receiptType,
      burnMode: burnEnabled,
      consensusMode: tier !== 'quick',
      modelSelection: { requested: env.defaultModel, final: resolvedModel },
      providerRouting: {
        allowFallbacks: true,
        finalProvider: (primaryAtt?.providerAddress ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
      },
      consensus:
        tier !== 'quick'
          ? (() => {
              // Build role → content map from reviewer outputs + judgement so
              // each individualAttestation carries the content the SDK's
              // 3-arg processResponse expects. H-2 fix per HALF_BAKED.md.
              const roleContent = new Map<string, string>();
              for (const r of consensus.reviewerOutputs) roleContent.set(r.role, r.content);
              if (consensus.judgement) roleContent.set(consensus.judgement.role, consensus.judgement.content);
              return {
                roles: consensus.attestations.map((x) => x.role),
                convergenceScore: consensus.convergence.score,
                agreementSummary: consensus.convergence.agreementSummary,
                disagreementSummary: consensus.convergence.disagreementSummary,
                individualAttestations: consensus.attestations
                  .filter((x) => x.providerAddress)
                  .map((x) => ({
                    role: x.role,
                    // H-1: bind attestationHash to the chat ID via keccak256.
                    // Receipts pre-dating this fix anchored 0x0…0; receipts
                    // produced from now on commit to the chat ID on chain so
                    // a chain-only verifier can cross-check it. zero-fallback
                    // retained when the inference path produced no chat ID.
                    attestationHash: (x.zgResKey
                      ? keccak256(toUtf8Bytes(x.zgResKey))
                      : ('0x' + '0'.repeat(64))) as Hash,
                    providerAddress: x.providerAddress!,
                    chatId: x.zgResKey ?? undefined,
                    content: roleContent.get(x.role),
                    independentVerified: null,
                  })),
              };
            })()
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
    billing: (() => {
      const totalCostNeuron = String(
        Math.floor(consensus.billing.totalInputTokens * 5e10 + consensus.billing.totalOutputTokens * 1e11),
      );
      const fs = skill.manifest.og.creator?.fee_split;
      const passport = skill.manifest.og.creator?.passport;
      // W5 — tier multiplier: TIER 1 (TEE-attested via 0G Compute) earns
      // 100% of declared creator bps; TIER 2 (external-signed) earns 85%.
      // The provider determines the tier — same logic as
      // teeVerification.verificationMethod a few lines above.
      const tier: 'TIER_1' | 'TIER_2' = a.provider === 'nvidia' ? 'TIER_2' : 'TIER_1';
      const feeSplit = fs
        ? allocateFeeSplit({
            totalCostNeuron,
            creatorBps: fs.creator,
            treasuryBps: fs.treasury,
            creatorPassport: passport,
            tier,
          })
        : undefined;
      return {
        inputTokens: consensus.billing.totalInputTokens,
        outputTokens: consensus.billing.totalOutputTokens,
        inputCostNeuron: String(Math.floor(consensus.billing.totalInputTokens * 5e10)),
        outputCostNeuron: String(Math.floor(consensus.billing.totalOutputTokens * 1e11)),
        totalCostNeuron,
        totalCostOg: consensus.billing.estimatedCostOg.toFixed(10),
        feeSplit,
      };
    })(),
    storage: {
      proofDownloadVerified: false,
      encryption: burnEnabled
        ? { enabled: true, type: 'aes-256-gcm', headerDetected: true, keyFingerprint }
        : { enabled: false, type: 'none', headerDetected: false },
    },
    ...(burnEnabled
      ? {
          burn: {
            sessionKeyDestroyedAt,
            localCleanupStatus: 'completed' as const,
            tempPathsZeroed: [],
            wording:
              'Session key destroyed; ciphertext now unreadable to operator. Burn Mode protects against operator-side disclosure; local-machine compromise is out of scope.',
          },
        }
      : {}),
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

  // receipt.pre-anchor — local sign done, on-chain submit pending. Allows a
  // skill to emit a final audit log or refuse the anchor (e.g. if a policy
  // gate flagged the output post-hoc). Refusal throws and the receipt stays
  // local-only.
  const preAnchorHooks = resolveHooks(skill.manifest.og.hooks?.pre_anchor, 'receipt.pre-anchor');
  if (preAnchorHooks.length > 0) {
    const evt: HookEvent_PreAnchor = {
      kind: 'receipt.pre-anchor',
      skill,
      network: env.network,
      caller: (env.walletAddress as `0x${string}` | undefined) ?? null,
      trustScore: a.callerTrust,
      receiptId: signed.id,
      receiptRoot: signed.storage.receiptRoot,
    };
    const r = await runHooks(preAnchorHooks, evt);
    for (const lg of r.logs) log.info(tag(`hook                 ${lg}`));
    if (!r.allow) throw new Error(`receipt.pre-anchor hook "${r.blockingHook}" refused: ${r.reason}`);
  }

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

  // receipt.post-anchor — receipt is now on chain. Use this to push to
  // off-chain index, ping a webhook, or update a creator-fee dashboard.
  const postAnchorHooks = resolveHooks(skill.manifest.og.hooks?.post_anchor, 'receipt.post-anchor');
  if (postAnchorHooks.length > 0) {
    const evt: HookEvent_PostAnchor = {
      kind: 'receipt.post-anchor',
      skill,
      network: env.network,
      caller: (env.walletAddress as `0x${string}` | undefined) ?? null,
      trustScore: a.callerTrust,
      receiptId: signed.id,
      txHash: tx.hash,
      blockNumber: txReceipt?.blockNumber ?? 0,
    };
    const r = await runHooks(postAnchorHooks, evt);
    for (const lg of r.logs) log.info(tag(`hook                 ${lg}`));
  }

  return { path, id: signed.id, txHash: tx.hash, onchainId };
}
