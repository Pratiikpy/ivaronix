// v3-lookup-allow: doc writer emits slots 0-9 only (doc_ask/consensus/burn/skill_exec). Reader-side fix shipped for §B-V2-37 (✅ shipped); writer stays grandfathered until/unless a slot 10+ extension lands here.
// Passport read/write path now V2-first via getActivePassportClient (K-6 memoryRoot-poisoning fix on V2). Closes the V1-only waiver from USER_TODO §B-V2-38 (✅ shipped).
import { Command } from 'commander';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { Wallet, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';
import { existsSync } from 'node:fs';
import { sha256HexAsync, NETWORKS, RECEIPT_TYPES, ROLES_BY_TIER, type ConsensusTier, type Hash } from '@ivaronix/core';
import { buildReceipt, signReceipt, defaultChainAnchor, allocateFeeSplit } from '@ivaronix/receipts';
import { ReceiptRegistryClient, ReceiptRegistryV2Client, ReceiptRegistryV3Client, getDeployedAddress } from '@ivaronix/og-chain';
import { getActivePassportClient } from '../lib/passport.js';
import { keyringFromEnv } from '@ivaronix/og-router/keyring';
import { burnEncrypt, createStorageClient } from '@ivaronix/og-storage';
import { runConsensus, TIER_COST_OG } from '@ivaronix/consensus';
import { findSkill, scanSkill, evaluateSandbox, SkillRegistryClient, resolveHooks, runHooks, type LoadedSkill, type ScanResult, type HookEvent_PreConsensus, type HookEvent_PostConsensus, type HookEvent_SessionStart, type HookEvent_SessionEnd } from '@ivaronix/skills';
import { TOOL_DEFS, dispatchTool as dispatchSkillTool } from '../lib/chat-tools.js';
import { TIER_COST_OG as TIER_COST_OG_LOOKUP } from '@ivaronix/consensus';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';
import { addBulkCommand } from './doc-bulk.js';
import { deriveRiskLevel, tryParseJson } from '@ivaronix/runtime';

/** Walk up directories to find seed-skills + .ivaronix/skills */
function skillSearchDirs(): string[] {
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

export const docCommand = new Command('doc')
  .description('Private document Q&A · audit a contract / vendor agreement / data room and produce an Action Receipt');

docCommand
  .command('ask <file> <question>')
  .description('Ask a question about a private document; produce an Action Receipt anchored on 0G Chain')
  .option('--burn', 'enable Burn Mode (AES-256-GCM session key destroyed after use)')
  .option('--consensus', 'enable Standard 3-role consensus (analyst/critic/judge) — default tier when set')
  .option('--high-stakes', 'use 5-role High-Stakes consensus (legal/contract/financial/medical)')
  .option('--audit', 'use 6-role Audit consensus (adds red-team-critic on top of high-stakes; premium adversarial review)')
  .option('--quick', 'force 1-model Quick tier (overrides --consensus / --high-stakes / --audit)')
  .option('--receipt', 'create an Action Receipt for this run', true)
  .option('--skill <id>', 'use this skill (defaults to private-doc-review)', 'private-doc-review')
  .option('--model <id>', 'override default model', 'qwen/qwen-2.5-7b-instruct')
  .option('--out-dir <dir>', 'where to write the signed receipt JSON', '.ivaronix/receipts/anchored')
  .option('--memory-depth <n>', 'load N most recent receipts for this agent + skill into context (planning-01 §3A)', '0')
  .action(async (file: string, question: string, opts: { burn?: boolean; consensus?: boolean; highStakes?: boolean; audit?: boolean; quick?: boolean; receipt?: boolean; skill: string; model: string; outDir: string; memoryDepth?: string }) => {
    const env = loadEnv();

    // ─── 0. Load skill ────────────────────────────────────────────────────
    const skill: LoadedSkill | null = findSkill(opts.skill, skillSearchDirs());
    if (!skill) {
      ui.fail(`Skill "${opts.skill}" not found in seed-skills/ or .ivaronix/skills/`);
      ui.hint(`Run 'ivaronix skill list' to see available skills`);
      process.exitCode = 1;
      return;
    }

    // Resolve tier — explicit flag wins; otherwise skill's default_tier; finally Quick fallback.
    // Precedence: --quick > --audit > --high-stakes > --consensus > skill default.
    let tier: ConsensusTier = skill.manifest.og.consensus.default_tier;
    if (opts.audit) tier = 'audit';
    else if (opts.highStakes) tier = 'high-stakes';
    else if (opts.consensus) tier = 'standard';
    if (opts.quick) tier = 'quick';

    // Auto-enable Burn Mode if the skill prescribes it (e.g., private-doc-review)
    const burnMode = Boolean((opts as { burn?: boolean }).burn ?? skill.manifest.og.burn.auto_enable);

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
    ui.info(`skill:               ${skill.id} v${skill.manifest.version}`);
    ui.info(`manifestHash:        ${skill.manifestHash}`);
    ui.info(`question:            "${question}"`);
    ui.info(`model:               ${opts.model}`);
    ui.info(`burn mode:           ${burnMode ? 'ON (AES-256-GCM)' : 'off'}${!burnMode && skill.manifest.og.burn.auto_enable ? ' [auto-enabled by skill]' : ''}`);
    ui.info(`consensus tier:      ${tier} (~${TIER_COST_OG[tier]} OG estimate)`);
    ui.info(`roles:               ${ROLES_BY_TIER[tier].join(', ')}`);
    ui.divider();

    // ─── 1.5. Scanner + sandbox pre-flight ────────────────────────────────
    // V2-first read per iter-123 (B-V2-17). V2-published skills are
    // invisible to V1-only scans; try V2 first, fall back to V1.
    const provider0 = new JsonRpcProvider(env.rpcUrl);
    const skillRegistryAddrV2 = getDeployedAddress(env.network, 'SkillRegistryV2');
    const skillRegistryAddrV1 = getDeployedAddress(env.network, 'SkillRegistry');
    let scan: ScanResult | undefined;
    if (skillRegistryAddrV2) {
      const reg = new SkillRegistryClient(skillRegistryAddrV2, provider0);
      scan = await scanSkill(skill, reg);
    }
    if ((!scan || !scan.registered) && skillRegistryAddrV1) {
      const reg = new SkillRegistryClient(skillRegistryAddrV1, provider0);
      const v1Scan = await scanSkill(skill, reg);
      if (v1Scan.registered || !scan) scan = v1Scan;
    }
    if (scan) {
      if (scan.matches) {
        ui.pass(`registry scan        MATCH (creator ${scan.creator}, block-time ${new Date(scan.publishedAt! * 1000).toISOString()})`);
      } else if (!scan.registered) {
        ui.info(`registry scan        not registered — manifest is local-only`);
      } else if (scan.revoked) {
        ui.fail(`registry scan        REVOKED on chain — refusing to run`);
        process.exitCode = 1;
        return;
      } else {
        ui.fail(`registry scan        MISMATCH — local manifest differs from on-chain canonical record`);
        ui.fail(`                     ${scan.reason}`);
        process.exitCode = 1;
        return;
      }
    } else {
      ui.info(`registry scan        skipped (SkillRegistry not deployed on ${env.network})`);
    }

    // Sandbox: pull caller's passport trust score (best-effort, V2-first).
    let callerTrust = 0;
    try {
      if (env.walletAddress) {
        const handle = getActivePassportClient(env.network, provider0);
        if (handle) {
          const profile = await handle.client.getPassportByWallet(env.walletAddress as `0x${string}`);
          if (profile) callerTrust = Number(profile.trustScore ?? 0);
        }
      }
    } catch { /* best-effort; sandbox treats trust=0 if unknown */ }

    const decision = evaluateSandbox(skill, {
      callerTrustScore: callerTrust,
      receiptRequested: !!opts.receipt,
      burnEnabled: burnMode,
      scan,
      // CLI doc-ask runs on 0G only; no --provider flag exposed here.
      providerKind: '0g',
    });

    if (decision.violations.length > 0) {
      for (const v of decision.violations) {
        const fn = v.severity === 'block' ? ui.fail : ui.info;
        fn(`sandbox.${v.code}`, v.message);
      }
    }
    if (!decision.allow) {
      ui.fail(`sandbox refused this run`);
      process.exitCode = 1;
      return;
    }
    if (decision.violations.length > 0) ui.divider();

    // ─── 1.7. session.start hooks ─────────────────────────────────────────
    const startedAt = Date.now();
    const sessionStartHooks = resolveHooks(skill.manifest.og.hooks?.session_start, 'session.start');
    if (sessionStartHooks.length > 0) {
      const evt: HookEvent_SessionStart = {
        kind: 'session.start',
        skill,
        network: env.network,
        caller: (env.walletAddress as `0x${string}` | undefined) ?? null,
        trustScore: callerTrust,
        command: 'doc.ask',
        argv: [file, question],
        startedAt,
      };
      const r = await runHooks(sessionStartHooks, evt);
      for (const log of r.logs) ui.info(`hook                 ${log}`);
      if (!r.allow) {
        ui.fail(`session.start hook "${r.blockingHook}" refused: ${r.reason}`);
        process.exitCode = 1;
        return;
      }
      if (r.logs.length > 0) ui.divider();
    }

    // ─── 2. Encryption (Burn Mode) ────────────────────────────────────────
    let burnMeta: { keyFingerprint: `sha256:${string}`; encryptionType: 'aes-256-gcm'; destroyedAt: number } | null = null;
    let evidenceBytes: Uint8Array;
    if (burnMode) {
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

    // ─── 2b. Upload evidence to 0G Storage ────────────────────────────────
    // B-1 unblocked: we now upload the (encrypted, if burn-mode) bytes to 0G
    // Storage and use the canonical Merkle root as `storage.evidenceRoot`.
    // On transient failure, fall back to the local sha256 digest so the run
    // still completes (TIER 2 evidence — receipt remains valid).
    let evidenceRoot: `0x${string}` | undefined;
    if (env.privateKey) {
      try {
        const sc = createStorageClient({ network: env.network, privateKey: env.privateKey });
        ui.pending('uploading evidence to 0G Storage...');
        const sr = await sc.upload(evidenceBytes);
        evidenceRoot = sr.rootHash;
        ui.pass(`evidence on 0G Storage: ${sr.rootHash}`);
      } catch (err) {
        ui.fail('0G Storage upload failed; falling back to sha256 evidenceRoot', (err as Error).message.split('\n')[0]);
        evidenceRoot = ('0x' + evidenceDigest.replace(/^sha256:/, '')) as `0x${string}`;
      }
    }

    // ─── 2c. W3 · 0G DA dispersal (opt-in via ZG_DA_URL) ─────────────────
    // When the operator has a DA Client Docker node running, also disperse
    // the encrypted blob to 0G DA. The receipt body's storage.daBlobRef
    // records the request_id so anyone with a DA node can later
    // RetrieveBlob and reconstruct.  When ZG_DA_URL is unset OR the node
    // is unreachable, the receipt body omits daBlobRef — no fake claim.
    let daBlobRef: { endpoint: string; requestIdHex: string; status: 'UNKNOWN' | 'PROCESSING' | 'CONFIRMED' | 'FAILED' | 'INSUFFICIENT_SIGNATURES'; blobBytes: number; dispersedAt: number } | undefined;
    const daClient = (await import('@ivaronix/og-da')).DaClient.fromEnv();
    if (daClient && evidenceBytes.length > 0) {
      try {
        ui.pending(`dispersing to 0G DA at ${daClient.endpoint}...`);
        const reachable = await daClient.ping();
        if (!reachable.ok) {
          ui.fail(`0G DA ping failed; receipt will omit daBlobRef`, reachable.reason.slice(0, 80));
        } else {
          // HALF_BAKED §I-16 closure (sweep 167): pre-sweep we called
          // disperseBlob() once and recorded result.status (typically
          // PROCESSING) as the terminal value in daBlobRef. That meant
          // every receipt's daBlobRef said PROCESSING permanently — a
          // provisional state captured as a permanent fact. Now we
          // poll via disperseAndFinalize() with a 30s timeout (short
          // enough to keep CLI responsive, long enough that most
          // testnet dispersals finalize). On timeout / failure we
          // record the LAST-OBSERVED status honestly (PROCESSING if
          // polling timed out; the receipt body is then explicit that
          // the blob hadn't finalized when the receipt was signed).
          const dispersed = await daClient.disperseBlob(evidenceBytes);
          const requestIdHex = '0x' + Buffer.from(dispersed.requestId).toString('hex');
          type SchemaBlobStatus = 'UNKNOWN' | 'PROCESSING' | 'CONFIRMED' | 'FAILED' | 'INSUFFICIENT_SIGNATURES';
          const collapse = (s: string): SchemaBlobStatus =>
            s === 'FINALIZED' ? 'CONFIRMED' : (s as SchemaBlobStatus);
          let finalStatus: SchemaBlobStatus = collapse(dispersed.status);
          const pollDeadline = Date.now() + 30_000;
          try {
            while (Date.now() < pollDeadline) {
              const s = await daClient.getBlobStatus(dispersed.requestId);
              if (s.status === 'FINALIZED') { finalStatus = 'CONFIRMED'; break; }
              if (s.status === 'FAILED' || s.status === 'INSUFFICIENT_SIGNATURES') { finalStatus = s.status; break; }
              if (s.status === 'PROCESSING' || s.status === 'UNKNOWN') finalStatus = s.status;
              await new Promise((r) => setTimeout(r, 2_000));
            }
          } catch { /* polling errors leave finalStatus at the last observed value */ }
          daBlobRef = {
            endpoint: daClient.endpoint,
            requestIdHex,
            status: finalStatus,
            blobBytes: evidenceBytes.length,
            dispersedAt: Date.now(),
          };
          ui.pass(`0G DA dispersed: status=${finalStatus} request_id=${requestIdHex.slice(0, 18)}…`);
        }
        daClient.close();
      } catch (err) {
        ui.fail(`0G DA disperse failed; receipt will omit daBlobRef`, ((err as Error).message.split('\n')[0] ?? '').slice(0, 120));
      }
    }

    // ─── 3. Inference ─────────────────────────────────────────────────────
    const keyring = keyringFromEnv();
    if (!keyring) {
      ui.fail('Router not configured', 'Set IVARONIX_ROUTER_KEY / IVARONIX_ROUTER_URL / IVARONIX_ROUTER_PROVIDER / IVARONIX_WALLET_ADDRESS (legacy: ZG_API_SECRET / ZG_SERVICE_URL / OG_COMPUTE_PROVIDER / EVM_WALLET_ADDRESS) in .env');
      process.exitCode = 1;
      return;
    }

    const docContextText = docBytes.toString('utf8', 0, Math.min(docBytes.length, 8192));

    // ─── 2c. memory-depth · prior receipts as context (planning-01 §3A) ──
    // The agent reads its own last N receipts on this skill from local
    // disk and prepends a short summary block to the consensus context.
    // The receipt body records request.priorReceiptIds so the lineage is
    // verifiable later — anyone can fetch each prior receipt's body and
    // confirm the agent actually ran it.
    const memoryDepth = Math.max(0, Math.min(20, Number(opts.memoryDepth ?? 0)));
    let priorReceiptIds: string[] = [];
    let priorContextBlock = '';
    if (memoryDepth > 0 && env.walletAddress) {
      const owner = (env.walletAddress as string).toLowerCase();
      const receiptDirs = [resolve(process.cwd(), '.ivaronix', 'receipts', 'anchored')];
      // Walk up to repo root and check apps/cli too
      let upDir = process.cwd();
      for (let i = 0; i < 8; i++) {
        if (existsSync(resolve(upDir, 'pnpm-workspace.yaml'))) {
          receiptDirs.push(resolve(upDir, 'apps', 'cli', '.ivaronix', 'receipts', 'anchored'));
          break;
        }
        const p = resolve(upDir, '..');
        if (p === upDir) break;
        upDir = p;
      }
      const summaries: Array<{ id: string; createdAt: number; headline: string; riskLevel: string; onChainId: string | null }> = [];
      const { readdirSync: rds, readFileSync: rfs } = await import('node:fs');
      for (const dir of receiptDirs) {
        if (!existsSync(dir)) continue;
        try {
          for (const fname of rds(dir)) {
            if (!fname.endsWith('.json')) continue;
            try {
              const r = JSON.parse(rfs(resolve(dir, fname), 'utf8')) as Record<string, unknown>;
              const a = (r.agent as Record<string, unknown> | undefined)?.ownerWallet as string | undefined;
              const sk = (r.request as Record<string, unknown> | undefined)?.skillId as string | undefined;
              if (!a || a.toLowerCase() !== owner) continue;
              if (!sk || sk !== skill.id) continue;
              const outputs = (r.outputs as Record<string, unknown> | undefined) ?? {};
              const wording = (outputs.wording as Record<string, unknown> | undefined) ?? {};
              const ca = (r.chainAnchor as Record<string, unknown> | undefined) ?? {};
              summaries.push({
                id: (r.id as string) ?? fname.replace(/\.json$/, ''),
                createdAt: Number(r.createdAt ?? 0),
                headline: (wording.headline as string) ?? '(no headline)',
                riskLevel: (outputs.riskLevel as string) ?? 'unknown',
                onChainId: (ca.onChainId as string | undefined) ?? null,
              });
            } catch { /* skip malformed */ }
          }
        } catch { /* skip unreadable */ }
      }
      // Dedupe — both candidate dirs may resolve to the same path when
      // running from apps/cli/.
      const seen = new Set<string>();
      const deduped = summaries.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      deduped.sort((a, b) => b.createdAt - a.createdAt);
      const picked = deduped.slice(0, memoryDepth);
      if (picked.length > 0) {
        priorReceiptIds = picked.map((s) => s.id);
        ui.info(`memory-depth         loading ${picked.length} prior receipt${picked.length === 1 ? '' : 's'} for ${skill.id}`);
        for (const s of picked) {
          const onChain = s.onChainId ? `#${s.onChainId}` : '(local)';
          ui.info(`prior                ${onChain}  risk=${s.riskLevel}  ${s.headline.slice(0, 80)}${s.headline.length > 80 ? '…' : ''}`);
        }
        const lines: string[] = [];
        lines.push('--- PRIOR RUNS CONTEXT ---');
        lines.push(`The agent has previously executed ${skill.id} ${picked.length} time${picked.length === 1 ? '' : 's'} (newest first):`);
        for (const s of picked) {
          const when = s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 19) : 'unknown';
          const onChain = s.onChainId ? `receipt #${s.onChainId}` : `receipt ${s.id.slice(0, 18)}…`;
          lines.push(`- ${onChain} · ${when} · risk=${s.riskLevel} · ${s.headline.slice(0, 200)}`);
        }
        lines.push('--- END PRIOR RUNS CONTEXT ---');
        priorContextBlock = lines.join('\n') + '\n\n';
      } else {
        ui.info(`memory-depth         requested ${memoryDepth} but no prior receipts found for ${skill.id}`);
      }
    }

    const contextText = priorContextBlock + docContextText;

    // ─── 3a. consensus.pre hooks ──────────────────────────────────────────
    let activeContext = contextText;
    let activeQuestion = question;
    const preConsensusHooks = resolveHooks(skill.manifest.og.hooks?.pre_consensus, 'consensus.pre');
    if (preConsensusHooks.length > 0) {
      const evt: HookEvent_PreConsensus = {
        kind: 'consensus.pre',
        skill,
        network: env.network,
        caller: (env.walletAddress as `0x${string}` | undefined) ?? null,
        trustScore: callerTrust,
        context: contextText,
        userPrompt: question,
        tier,
        estimatedCostOg: TIER_COST_OG_LOOKUP[tier],
      };
      const r = await runHooks(preConsensusHooks, evt);
      for (const log of r.logs) ui.info(`hook                 ${log}`);
      if (!r.allow) {
        ui.fail(`consensus.pre hook "${r.blockingHook}" refused: ${r.reason}`);
        process.exitCode = 1;
        return;
      }
      if (r.patched.kind === 'consensus.pre') {
        activeContext = (r.patched as HookEvent_PreConsensus).context;
        activeQuestion = (r.patched as HookEvent_PreConsensus).userPrompt;
      }
      if (r.logs.length > 0) ui.divider();
    }

    ui.pending(`querying 0G Router (${tier} tier, ${ROLES_BY_TIER[tier].length} role${ROLES_BY_TIER[tier].length > 1 ? 's' : ''})...`);
    const startTime = Date.now();

    // Inject the skill's prompt body as the role-shared instruction prefix
    const enrichedContext = `${skill.systemPromptBody}\n\n--- INPUT START ---\n${activeContext}\n--- INPUT END ---`;

    // Tool-loop wiring · fire 10E. When the skill manifest declares
    // og.tools.builtins (e.g. legal-citation-verifier with web_fetch),
    // build the tools array + a dispatchTool callback so each consensus
    // role can iteratively call tools mid-inference per the runWithTools
    // pattern in @ivaronix/consensus. Empty/undefined manifest tools =>
    // existing single-pass keyring.chat behaviour (zero impact on the 4
    // non-tool-bearing legal cluster skills).
    const skillBuiltins = skill.manifest.og.tools?.builtins ?? [];
    const tools = skillBuiltins.length > 0
      ? TOOL_DEFS.filter((d) => skillBuiltins.includes(d.function.name as typeof skillBuiltins[number]))
      : undefined;
    const cwd = process.cwd();
    const dispatchTool = tools
      ? async (name: string, args: string): Promise<{ ok: boolean; output: string }> => {
          const r = await dispatchSkillTool(cwd, name, args, new Map());
          return { ok: r.ok, output: r.output };
        }
      : undefined;

    const consensusResult = await runConsensus({
      tier,
      keyring,
      model: opts.model,
      context: enrichedContext,
      userPrompt: activeQuestion,
      rawBytes: docBytes,
      // Forward the operator's signer key so gate 2 can exact-match
      // against an accidental paste. Per planning-003 §A.5.15.
      signerPrivateKey: env.privateKey,
      ...(tools && dispatchTool ? { tools, dispatchTool } : {}),
    });

    // Fail-closed runtime gate · the Mata v. Avianca architectural closure.
    // When a skill declares web_fetch in og.tools.builtins, the runtime
    // MUST observe at least one actual web_fetch tool_call in the
    // aggregate trace before the receipt is allowed to anchor. Otherwise
    // the model produced a "verified" verdict without external HTTP
    // verification — the exact pattern the skill exists to prevent.
    if (skillBuiltins.includes('web_fetch')) {
      const trace = consensusResult.toolCallTrace ?? [];
      const webFetchCalls = trace.filter((t) => t.tool === 'web_fetch').length;
      if (webFetchCalls === 0) {
        ui.fail(
          `Runtime gate: skill ${skill.id} declares og.tools.builtins=['web_fetch'] but the run produced 0 web_fetch tool_calls. ` +
          `Refusing to anchor a receipt that would claim citation verification without making real HTTP requests to CourtListener/Cornell LII. ` +
          `This is the Mata v. Avianca runtime closure (QA_PROOF_PACK/legal-cluster/citation-verifier-audit.md).`
        );
        ui.hint(
          `Possible causes: the 7B model didn't emit tool_calls (mainnet promotion with a stronger model · 0GM-1.0 · is the proper fix). ` +
          `Re-run if intermittent.`
        );
        process.exitCode = 1;
        return;
      }
      ui.pass(`runtime gate: ${webFetchCalls} web_fetch tool_call(s) recorded · Mata v. Avianca contract upheld`);
    }

    const elapsedMs = Date.now() - startTime;

    // ─── 3b. consensus.post hooks ─────────────────────────────────────────
    const postConsensusHooks = resolveHooks(skill.manifest.og.hooks?.post_consensus, 'consensus.post');
    if (postConsensusHooks.length > 0) {
      const evt: HookEvent_PostConsensus = {
        kind: 'consensus.post',
        skill,
        network: env.network,
        caller: (env.walletAddress as `0x${string}` | undefined) ?? null,
        trustScore: callerTrust,
        ms: elapsedMs,
        inputTokens: consensusResult.billing.totalInputTokens,
        outputTokens: consensusResult.billing.totalOutputTokens,
        costOg: consensusResult.billing.estimatedCostOg,
        convergenceScore: consensusResult.convergence.score ?? null,
      };
      const r = await runHooks(postConsensusHooks, evt);
      for (const log of r.logs) ui.info(`hook                 ${log}`);
    }

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

    // Structured-output extraction · closes the cluster-wide "manifest
    // promises JSON, runtime never parses it" gap surfaced in the legal
    // cluster AI quality audit (QA_PROOF_PACK/notes/ai-quality-audit-
    // legal-cluster.md). Manifests like contract-renewal-clause-detector
    // and term-sheet-risk-scanner declare `Output schema` sections
    // returning `{findings: Finding[]}`; the model emits those as a
    // markdown-fenced JSON block embedded in prose. `tryParseJson`
    // (packages/runtime/src/json-repair.ts) strips the fence, peels
    // leading/trailing prose, fixes trailing commas + smart quotes,
    // and recovers the JSON value. The result lands on the receipt
    // as `outputs.parsed` so machine consumers can read structured
    // findings from the canonical receipt body. ok=false records the
    // attempt honestly when the model emitted prose-only.
    const parseAttempt = tryParseJson<unknown>(finalOutput);
    // Schema-aware validation · B-V2-46 closure (launch-readiness).
    // When the skill manifest declares `og.output_schema.required_keys`,
    // check the parsed data against the required set. Mismatch → mark
    // validationFailed: true (mark-and-anchor preserves Router credits +
    // honest gap signal); if `fail_closed: true`, exit before chain anchor.
    type ParsedField =
      | { ok: true; data: unknown; repaired: string[]; rawBytes: number; validationFailed?: boolean; validationError?: string }
      | { ok: false; error: string; attempted: string[]; rawBytes: number };
    let parsedField: ParsedField;
    const outputSchema = skill.manifest.og.output_schema;
    let validationFailed = false;
    let validationError: string | undefined;
    if (parseAttempt.ok && outputSchema) {
      const required = outputSchema.required_keys;
      const data = parseAttempt.value;
      if (Array.isArray(data)) {
        validationFailed = true;
        validationError = `array shape but object with required keys [${required.join(', ')}] expected`;
      } else if (data === null || typeof data !== 'object') {
        validationFailed = true;
        validationError = `${typeof data} shape but object with required keys [${required.join(', ')}] expected`;
      } else {
        const missing = required.filter((k) => !(k in (data as Record<string, unknown>)));
        if (missing.length > 0) {
          validationFailed = true;
          validationError = `missing required keys: ${missing.join(', ')}`;
        }
      }
    }
    if (parseAttempt.ok) {
      parsedField = {
        ok: true,
        data: parseAttempt.value,
        repaired: parseAttempt.repaired,
        rawBytes: Buffer.byteLength(finalOutput, 'utf8'),
        ...(validationFailed ? { validationFailed: true, validationError } : {}),
      };
    } else {
      parsedField = {
        ok: false,
        error: parseAttempt.error,
        attempted: parseAttempt.attempted,
        rawBytes: Buffer.byteLength(finalOutput, 'utf8'),
      };
    }
    if (parseAttempt.ok) {
      if (!validationFailed) {
        ui.pass(`structured output   parsed ok (${parseAttempt.repaired.length === 0 ? 'raw' : parseAttempt.repaired.join('+')})`);
      } else {
        ui.fail(`structured output   schema mismatch · ${validationError}`);
        if (outputSchema?.fail_closed) {
          ui.hint('skill declares fail_closed: true · refusing to anchor with malformed output');
          process.exitCode = 1;
          return;
        }
        ui.hint(`anchoring receipt anyway (mark-and-anchor preserves Router credits · validationFailed flag is visible)`);
      }
    } else {
      ui.info(`structured output   prose-only · ${parseAttempt.error}`);
    }

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

    // V3-first per .claude/rules/og-chain.md · used to skip V3 entirely. The
    // mainnet V2 passport's receiptRegistry pointer is V3, so anchoring to V2
    // breaks the passport.recordReceipt cross-check (receiptRoot mismatch on a
    // different row at the same id). V3 → V2 → V1 fallback brings doc.ts in
    // line with demo.ts / room.ts / memory.ts / subscribe.ts.
    const registryAddrV3 = getDeployedAddress(env.network, 'ReceiptRegistryV3');
    const registryAddrV2 = getDeployedAddress(env.network, 'ReceiptRegistryV2');
    const registryAddrV1 = getDeployedAddress(env.network, 'ReceiptRegistry');
    const registryAddr = registryAddrV3 ?? registryAddrV2 ?? registryAddrV1;
    const registryVersion: 'v1' | 'v2' | 'v3' = registryAddrV3 ? 'v3' : registryAddrV2 ? 'v2' : 'v1';
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

    // Receipt-type selection (B-V2-35 closures):
    //   - burnMode → 'burn' (slot 3 · closed iter-96) — the
    //     bytes-are-encrypted physical-mode signal.
    //   - non-default skill → 'skill_exec' (slot 5 · closed iter-99)
    //     — user explicitly invoked a named skill via --skill <id>.
    //   - quick tier, default skill → 'doc_ask' (slot 0) — the
    //     conversational doc-question shape.
    //   - multi-role tier, default skill → 'consensus' (slot 2) —
    //     the multi-role review shape.
    const draft = buildReceipt({
      type: burnMode
        ? 'burn'
        : skill.id !== 'private-doc-review'
          ? 'skill_exec'
          : tier === 'quick'
            ? 'doc_ask'
            : 'consensus',
      agent: {
        passportId: `did:0g:passport:${wallet.address}:1`,
        ownerWallet: wallet.address as `0x${string}`,
        trustScoreAtTime: 0,
      },
      request: {
        skillId: skill.id,
        skillVersion: skill.manifest.version,
        skillManifestHash: skill.manifestHash,
        userPromptHash: sha256HexAsync(question),
        inputArtifacts: [{ kind: 'doc', encrypted: !!burnMode }],
        policyDecision: 'approved',
        approvalChain: [{ gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:default-strict' }],
        ...(priorReceiptIds.length > 0 ? { priorReceiptIds } : {}),
      },
      execution: {
        mode: tier === 'quick' ? 'doc_ask' : 'consensus',
        burnMode: !!burnMode,
        consensusMode: tier !== 'quick',
        modelSelection: { requested: opts.model, final: opts.model },
        providerRouting: {
          allowFallbacks: true,
          finalProvider: (primaryAtt?.providerAddress ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
        },
        consensus: tier !== 'quick'
          ? (() => {
              // Build role → content map for the 3-arg processResponse path
              // per HALF_BAKED.md H-2.
              const roleContent = new Map<string, string>();
              for (const r of consensusResult.reviewerOutputs) roleContent.set(r.role, r.content);
              if (consensusResult.judgement) roleContent.set(consensusResult.judgement.role, consensusResult.judgement.content);
              return {
                roles: consensusResult.attestations.map((a) => a.role),
                convergenceScore: consensusResult.convergence.score,
                agreementSummary: consensusResult.convergence.agreementSummary,
                disagreementSummary: consensusResult.convergence.disagreementSummary,
                // J-4 closure (sweep 216): type-predicate filter narrows
                // `providerAddress` from optional to required, removing the
                // load-bearing `!` postfix that the type system couldn't
                // verify across the .filter()/.map() boundary.
                individualAttestations: consensusResult.attestations
                  .filter((a): a is typeof a & { providerAddress: NonNullable<typeof a.providerAddress> } => Boolean(a.providerAddress))
                  .map((a) => ({
                    role: a.role,
                    // H-1: keccak256 of the chat ID — anchors a real
                    // attestation commitment on chain instead of zero.
                    attestationHash: (a.zgResKey
                      ? keccak256(toUtf8Bytes(a.zgResKey))
                      : ('0x' + '0'.repeat(64))) as Hash,
                    providerAddress: a.providerAddress,
                    chatId: a.zgResKey ?? undefined,
                    content: roleContent.get(a.role),
                    independentVerified: null,
                  })),
              };
            })()
          : undefined,
        // Tool-call trace · fire 10E · closes the Mata v. Avianca runtime
        // contract. Optional + only present when the skill declared
        // og.tools.builtins (e.g. legal-citation-verifier with web_fetch).
        // Verifiers can re-run any URL from this trace to confirm the
        // skill's external verification really happened.
        ...(consensusResult.toolCallTrace && consensusResult.toolCallTrace.length > 0
          ? { toolCallTrace: consensusResult.toolCallTrace }
          : {}),
      },
      routerTrace: {
        requestId: `doc-ask-${Date.now()}`,
        zgResKey: primaryAtt?.zgResKey ?? undefined,
        x0gTrace: {},
        rateLimit: {},
        rotations: [],
      },
      teeVerification: {
        requested: true,
        routerVerified: !!primaryAtt?.routerVerified,
        independentVerified: null,
        providerAddress: (primaryAtt?.providerAddress ?? undefined) as `0x${string}` | undefined,
        verificationMethod: 'router_flag',
        verifiedAt: null,
      },
      billing: (() => {
        const totalCostNeuron = String(
          Math.floor(consensusResult.billing.totalInputTokens * 5e10 + consensusResult.billing.totalOutputTokens * 1e11),
        );
        const fs = skill.manifest.og.creator?.fee_split;
        const passport = skill.manifest.og.creator?.passport;
        const feeSplit = fs
          ? allocateFeeSplit({
              totalCostNeuron,
              creatorBps: fs.creator,
              treasuryBps: fs.treasury,
              creatorPassport: passport,
            })
          : undefined;
        return {
          inputTokens: consensusResult.billing.totalInputTokens,
          outputTokens: consensusResult.billing.totalOutputTokens,
          inputCostNeuron: String(Math.floor(consensusResult.billing.totalInputTokens * 5e10)),
          outputCostNeuron: String(Math.floor(consensusResult.billing.totalOutputTokens * 1e11)),
          totalCostNeuron,
          totalCostOg: consensusResult.billing.estimatedCostOg.toFixed(10),
          feeSplit,
        };
      })(),
      storage: {
        proofDownloadVerified: false,
        evidenceRoot: evidenceRoot ?? undefined,
        ...(daBlobRef ? { daBlobRef } : {}),
        encryption: burnMode && burnMeta
          ? {
              enabled: true,
              type: 'aes-256-gcm',
              headerDetected: true,
              keyFingerprint: burnMeta.keyFingerprint,
            }
          : { enabled: false, type: 'none', headerDetected: false },
      },
      // J-4 closure (sweep 216): drop the `!` postfix; gate the entire
      // burn payload on `burnMode && burnMeta` so TS narrows naturally.
      // The two flags are set together in the encryption block above, so
      // they can't diverge in practice — explicit gate beats trust-me-bro.
      burn: burnMode && burnMeta
        ? {
            sessionKeyDestroyedAt: burnMeta.destroyedAt,
            // §K-24 closure (sweep 215): burn pipeline encrypts in-memory
            // and uploads ciphertext; no plaintext temp files exist on
            // disk. `not-applicable` is the honest status — `completed`
            // implied a cleanup that wasn't needed.
            localCleanupStatus: 'not-applicable',
            tempPathsZeroed: [],
            wording: 'Session key destroyed; ciphertext now unreadable to operator. Burn Mode protects against operator-side disclosure; local-machine compromise is out of scope. No temp files were created (in-memory encrypt-and-upload).',
          }
        : undefined,
      chainAnchor: defaultChainAnchor(env.network, registryAddr),
      outputs: {
        outputHash,
        citations: [],
        // HALF_BAKED §I-13 closure (sweep 165): derive from finalOutput
        // instead of hardcoding 'low'. See packages/runtime/src/risk.ts.
        riskLevel: deriveRiskLevel(finalOutput),
        wording: {
          headline: finalOutput.slice(0, 200).replace(/\n+/g, ' '),
          doNotSay: ['truth score', 'verified by AI', 'guaranteed safe'],
        },
        // Structured output extraction · closes the legal-cluster audit
        // RED. Receipts where the model emitted no JSON record
        // ok: false honestly (the audit trail of the parse attempt
        // is preserved; downstream consumers see "prose-only" rather
        // than a misleading empty-array).
        parsed: parsedField,
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

    ui.pending(`anchoring on 0G Chain (${registryVersion.toUpperCase()})...`);
    const typeCode = RECEIPT_TYPES[draft.type];
    const evidenceBytes32 = ('0x' + evidenceDigest.replace(/^sha256:/, '')) as Hash;
    // HALF_BAKED §I-8 closure (sweep 162): the on-chain attestationHash
    // was hardcoded to zero. The off-chain receipt body already computes
    // keccak256(zgResKey) per role (line 520). For the on-chain anchor
    // we use the PRIMARY role's attestation hash — the receipt's
    // headline trust binding. TIER 2 / no-zgResKey paths still anchor
    // with zero (preserves the existing fall-through for non-TEE runs);
    // TIER 1 runs now carry a real attestation commitment to chain.
    const anchorAttestationHash: Hash = primaryAtt?.zgResKey
      ? (keccak256(toUtf8Bytes(primaryAtt.zgResKey)) as Hash)
      : (('0x' + '0'.repeat(64)) as Hash);
    let tx: { hash: string };
    let txReceipt: { blockNumber: number; gasUsed: bigint } | null;
    let onChain: { id: bigint } | null = null;
    if (registryVersion === 'v3') {
      const registryV3 = new ReceiptRegistryV3Client(registryAddr, wallet);
      const { tx: v3Tx } = await registryV3.signAndAnchor(wallet, {
        receiptRoot: signed.storage.receiptRoot as Hash,
        storageRoot: evidenceBytes32,
        receiptType: typeCode,
        attestationHash: anchorAttestationHash,
      });
      tx = { hash: v3Tx.hash };
      const r = await v3Tx.wait();
      txReceipt = r ? { blockNumber: r.blockNumber, gasUsed: r.gasUsed } : null;
      try {
        // nextId minus one is the just-anchored row for V3 (atomic per-block).
        const next = await registryV3.nextId();
        onChain = { id: next - 1n };
      } catch { /* not fatal */ }
    } else if (registryVersion === 'v2') {
      const registryV2 = new ReceiptRegistryV2Client(registryAddr, wallet);
      const { tx: v2Tx } = await registryV2.signAndAnchor(wallet, {
        receiptRoot: signed.storage.receiptRoot as Hash,
        storageRoot: evidenceBytes32,
        receiptType: typeCode,
        attestationHash: anchorAttestationHash,
      });
      tx = { hash: v2Tx.hash };
      const r = await v2Tx.wait();
      txReceipt = r ? { blockNumber: r.blockNumber, gasUsed: r.gasUsed } : null;
      try {
        const found = await registryV2.findByReceiptRoot(signed.storage.receiptRoot as Hash, 50);
        if (found) onChain = { id: found.id };
      } catch { /* not fatal · scan-window miss isn't a verify failure */ }
    } else {
      const registryV1 = new ReceiptRegistryClient(registryAddr, wallet);
      const v1Tx = await registryV1.anchor(
        signed.storage.receiptRoot as Hash,
        evidenceBytes32,
        typeCode,
        anchorAttestationHash,
      );
      tx = { hash: v1Tx.hash };
      const r = await v1Tx.wait();
      txReceipt = r ? { blockNumber: r.blockNumber, gasUsed: r.gasUsed } : null;
      try {
        const found = await registryV1.findByReceiptRoot(signed.storage.receiptRoot as Hash, 50);
        if (found) onChain = { id: found.id };
      } catch { /* not fatal · scan-window miss isn't a verify failure */ }
    }
    ui.info(`tx hash              ${tx.hash}`);
    if (!txReceipt) {
      ui.fail('anchor tx did not return receipt');
      return;
    }
    ui.pass(`block                ${txReceipt.blockNumber}`);
    ui.pass(`gas used             ${txReceipt.gasUsed}`);
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

    // ─── 6. Record receipt against passport (if owner has one) ────────────
    // V2-first write — K-1 closure cross-checks receiptId against ReceiptRegistry,
    // so the V2 path needs the on-chain id (`onChainReceiptId` captured after anchor).
    const passportHandle = getActivePassportClient(env.network, wallet);
    if (passportHandle) {
      const passport = passportHandle.client;
      try {
        const tokenId = await passport.passportOf(wallet.address as `0x${string}`);
        if (tokenId !== 0n) {
          ui.pending(`recording receipt against ${passportHandle.version.toUpperCase()} passport tokenId=${tokenId}...`);
          // Trust delta: +1 per anchored receipt; tunable per skill via the
          // skill manifest's `og.reputation.on_pass.trustScore` field.
          // V2 passport contract: 5-arg signature with receiptId; cross-checks
          // the registry pointed at by passport.receiptRegistry (currently V3
          // on mainnet). V1 passport: 4-arg legacy.
          const ptx = passportHandle.version === 'v2' && onChain
            ? await passport.recordReceiptV2(tokenId, onChain.id, signed.storage.receiptRoot as Hash, typeCode, 1)
            : await passport.recordReceipt(tokenId, signed.storage.receiptRoot as Hash, typeCode, 1);
          await ptx.wait();
          // Re-read updated state
          const updated = await passport.getPassport(tokenId);
          if (updated) {
            ui.pass(`passport updated     receiptCount=${updated.receiptCount} trustScore=${updated.trustScore} · ${passportHandle.version.toUpperCase()}`);
          }
        }
      } catch (err) {
        // Don't fail the whole flow if passport update fails — receipt is still anchored
        ui.pending(`passport update skipped: ${(err as Error).message.split('\n')[0]}`);
      }
    }

    ui.divider();
    ui.banner(true, '→ ANCHORED ✓');
    ui.hint(`Verify:    ivaronix receipt verify ${outPath} --tee-independent`);
    ui.hint(`Explorer:  ${NETWORKS[env.network].chainExplorer}/tx/${tx.hash}`);
  });

// ─── doc bulk (planning-01 §4B) ──────────────────────────────────────────
addBulkCommand(docCommand);
