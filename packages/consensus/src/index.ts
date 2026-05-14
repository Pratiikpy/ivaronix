import type { Address, ConsensusTier, Hash } from '@ivaronix/core';
import { ROLES_BY_TIER } from '@ivaronix/core';
import type { Keyring, RouterCallResult, ToolDef } from '@ivaronix/og-router';
import { ROLE_PROMPTS, type RoleId } from './prompts.js';
import { computeConvergence, type ConvergenceResult } from './convergence.js';
import { runGates, type GateInput, type GateResult } from './gates.js';
import { applyPolicy, type ConsensusPolicy, type PolicyDecision } from './policy.js';
import { runWithTools, type ToolCallTrace } from './tool-loop.js';

export * from './prompts.js';
export * from './convergence.js';
export * from './gates.js';
export * from './policy.js';
export * from './tool-loop.js';

export interface ConsensusInput {
  tier: ConsensusTier;
  keyring: Keyring;
  model: string;
  context: string;
  userPrompt: string;
  rawBytes: Buffer | Uint8Array;
  /** Optional pre-flight gate inputs. */
  routerBalanceOg?: number;
  registryPaused?: boolean;
  modelCapabilities?: GateInput['modelCapabilities'];
  /**
   * Operator signer private key (hex). Forwarded to gate 2 so it can
   * exact-match against the doc body. Per planning-003 §A.5.15 this is the
   * only zero-false-positive path for detecting an accidental key paste.
   */
  signerPrivateKey?: string;
  /**
   * Aggregation policy for the run (planning-003 §A.4.4 · zer0Gig
   * Efficiency Game). Defaults to `'majority'` when unset, matching the
   * pre-A.4.4 behaviour. Skill manifests can declare a per-skill default
   * via `og.consensus.policy`; the Studio Run panel exposes a "How
   * strict?" override (STRICT/BALANCED/LENIENT/WEIGHTED) that lands here.
   */
  policy?: ConsensusPolicy;
  /**
   * Optional per-role weights for `policy: 'weighted'`. Map of `RoleId`
   * → numeric weight. Reviewers without an entry default to weight 1.
   */
  weights?: Record<string, number>;
  /**
   * Tool definitions the model is permitted to call during each role's
   * inference. When both `tools` and `dispatchTool` are provided, the
   * runner uses `keyring.chatRich` + the `runWithTools` tool-call loop
   * instead of the single-pass `keyring.chat`. Without both, behaviour
   * is unchanged from pre-fire-10C.
   *
   * The tools array comes from the active skill's `og.tools.builtins`
   * declaration (e.g. legal-citation-verifier with `['web_fetch']`).
   * The dispatchTool callback executes the named tool with raw JSON
   * arguments and returns the response body fed back to the model.
   */
  tools?: ToolDef[];
  dispatchTool?: (name: string, args: string) => Promise<{ ok: boolean; output: string }>;
}

export interface RoleAttestation {
  role: RoleId;
  providerAddress: Address | null;
  zgResKey: string | null;
  attestationHash: Hash | null;
  routerVerified: boolean;
  /** Filled in by the post-hoc independent verify step (`broker.processResponse`). */
  independentVerified: boolean | null;
  inputTokens: number;
  outputTokens: number;
}

export interface ConsensusResult {
  tier: ConsensusTier;
  roles: RoleId[];
  /** Each non-judge role's response. */
  reviewerOutputs: { role: RoleId; content: string }[];
  /** The judge's synthesized output (only present when tier has a judge). */
  judgement: { role: RoleId; content: string } | null;
  /** Convergence over non-judge reviewers. */
  convergence: ConvergenceResult;
  /** Per-role TEE attestations. Independent verify is null until verifyAttestations() runs. */
  attestations: RoleAttestation[];
  /** Aggregate billing across all role calls. */
  billing: {
    totalInputTokens: number;
    totalOutputTokens: number;
    estimatedCostOg: number;
  };
  /** Gate result captured pre-flight. */
  gateResult: GateResult;
  /**
   * Aggregation-policy decision (planning-003 §A.4.4). Records what
   * policy actually ran + whether the reviewers' aggregate stance
   * passed or blocked. `null` for tiers with fewer than 2 reviewers
   * (the policy layer is meaningless on a single-reviewer run).
   */
  policyDecision: PolicyDecision | null;
  /**
   * Aggregate tool-call trace across every role's inference loop.
   * Populated only when the caller provided `tools` + `dispatchTool`
   * on `ConsensusInput`. Empty array if all roles ran tool-free.
   *
   * Closes the Mata v. Avianca runtime gap: a skill that declares
   * `og.tools.builtins: ['web_fetch']` produces a non-empty trace only
   * if the model actually emitted tool_calls. The fail-closed gate at
   * receipt-assembly time inspects this field; if a citation-bearing
   * skill produced an empty trace, the run is rejected before chain
   * anchor. See `apps/cli/src/commands/doc.ts` + the receipt schema's
   * `execution.toolCallTrace` field (packages/receipts/src/schema.ts).
   */
  toolCallTrace?: ToolCallTrace[];
}

/**
 * Estimated cost per tier for fee-display UX (HLD §11 + COMPONENTS §15).
 * Numerator is the all-in budget across all roles; divisor is the rough
 * cost-per-100-tokens factor used for billing previews. Per
 * planning-003 §A.5.20 the `audit` tier is priced as a premium
 * marketplace tier (~6/5 of high-stakes for the extra red-team-critic
 * role; rounded up for headroom on long inputs).
 */
export const TIER_COST_OG: Record<ConsensusTier, number> = {
  quick: 0.02 / 5,         // 1 call, ~0.004 OG
  standard: 0.10 / 5,      // 3 calls, ~0.02 OG
  'high-stakes': 0.25 / 5, // 5 calls, ~0.05 OG
  audit: 0.36 / 5,         // 6 calls, ~0.072 OG (premium adversarial audit)
};

/**
 * Run a consensus inference at the requested tier.
 * Throws if the pre-flight gate fails (no Router calls made = no OG burned).
 */
export async function runConsensus(input: ConsensusInput): Promise<ConsensusResult> {
  const tier = input.tier;
  const roleIds = ROLES_BY_TIER[tier] as RoleId[];

  // ─── Pre-flight gates ───────────────────────────────────────────────
  const gateResult = runGates({
    context: input.context,
    rawBytes: input.rawBytes,
    estimatedInputTokens: Math.ceil(input.context.length / 4), // ~4 chars per token
    model: input.model,
    modelCapabilities: input.modelCapabilities,
    routerBalanceOg: input.routerBalanceOg,
    registryPaused: input.registryPaused,
    signerPrivateKey: input.signerPrivateKey,
  });

  if (!gateResult.pass) {
    throw new Error(
      `Consensus pre-flight gate ${gateResult.failedGate} failed: ${gateResult.reason}. No Router calls made.`,
    );
  }

  // ─── Identify reviewer roles vs. judge ──────────────────────────────
  const judgeRoleId = roleIds.find((r) => r === 'judge');
  const reviewerRoleIds = roleIds.filter((r) => r !== 'judge');

  // ─── Run reviewers ──────────────────────────────────────────────────
  // Standard tier (3 reviewers) runs in parallel; high-stakes (4 reviewers)
  // runs sequentially to stay under the testnet 10-req/min Router cap. Once
  // the rate limit lifts on mainnet we can flip back to parallel.
  //
  // Tool-loop branch (fire 10C): when the caller provided `tools` AND
  // `dispatchTool`, route each role's inference through `runWithTools`
  // (keyring.chatRich + the canonical tool-call loop). Otherwise stay on
  // the single-pass keyring.chat path that the 4 non-tool legal cluster
  // skills depend on — zero behaviour change for them.
  const useTools = Boolean(input.tools && input.dispatchTool);
  const perRoleTraces: Map<RoleId, ToolCallTrace[]> = new Map();

  const runReviewer = async (roleId: RoleId) => {
    const prompt = ROLE_PROMPTS[roleId];
    const systemPrompt = prompt.systemPrompt(input.context, input.userPrompt);
    if (useTools) {
      const result = await runWithTools({
        keyring: input.keyring,
        model: input.model,
        systemPrompt,
        userPrompt: input.userPrompt,
        tools: input.tools!,
        dispatchTool: input.dispatchTool!,
        verifyTee: true,
      });
      perRoleTraces.set(roleId, result.toolCallTrace);
      // Map runWithTools result into the RouterCallResult shape downstream
      // expects. providerAddress + zgResKey come from a path chatRich does
      // not currently surface, so they're undefined for tool-using runs;
      // attestationFromRaw filters these out of individualAttestations,
      // and the toolCallTrace IS the proof channel for tool-using skills.
      const synthRaw: RouterCallResult = {
        content: result.content,
        providerAddress: undefined,
        zgResKey: undefined,
        attestationHash: null,
        inputTokens: result.finalRaw?.inputTokens,
        outputTokens: result.finalRaw?.outputTokens,
        routerVerified: result.finalRaw?.routerVerified,
        rawResponse: result.finalRaw?.rawResponse,
      } as unknown as RouterCallResult;
      return { role: roleId, content: result.content, raw: synthRaw };
    }
    const raw = await input.keyring.chat({
      model: input.model,
      systemPrompt,
      userPrompt: input.userPrompt,
      verifyTee: true,
    });
    return { role: roleId, content: raw.content, raw };
  };

  let reviewerResults: { role: RoleId; content: string; raw: RouterCallResult }[];
  // Tiers above 3 reviewers run sequentially to stay under the testnet
  // 10-req/min Router cap. Once the rate limit lifts on mainnet (USER_TODO
  // §B-V2-3) we can flip back to parallel for everything.
  if (tier === 'high-stakes' || tier === 'audit') {
    reviewerResults = [];
    for (const roleId of reviewerRoleIds) {
      reviewerResults.push(await runReviewer(roleId));
    }
  } else {
    reviewerResults = await Promise.all(reviewerRoleIds.map(runReviewer));
  }
  const reviewerOutputs = reviewerResults.map((r) => ({ role: r.role, content: r.content }));

  // ─── Convergence ────────────────────────────────────────────────────
  const convergence = computeConvergence(reviewerOutputs);

  // ─── Judge (only if tier has one) ───────────────────────────────────
  let judgement: { role: RoleId; content: string } | null = null;
  let judgeRaw: RouterCallResult | null = null;
  if (judgeRoleId) {
    const judgePrompt = ROLE_PROMPTS[judgeRoleId];
    const reviewerSummary = reviewerResults
      .map((r) => `=== ${r.role.toUpperCase()} ===\n${r.content}`)
      .join('\n\n');
    const judgeSystem = judgePrompt.systemPrompt(input.context, input.userPrompt);
    const judgeUser = `User question: ${input.userPrompt}\n\nReviewer outputs:\n${reviewerSummary}\n\nDeliver the synthesized judgment now.`;
    if (useTools) {
      const result = await runWithTools({
        keyring: input.keyring,
        model: input.model,
        systemPrompt: judgeSystem,
        userPrompt: judgeUser,
        tools: input.tools!,
        dispatchTool: input.dispatchTool!,
        verifyTee: true,
      });
      perRoleTraces.set(judgeRoleId, result.toolCallTrace);
      judgeRaw = {
        content: result.content,
        providerAddress: undefined,
        zgResKey: undefined,
        attestationHash: null,
        inputTokens: result.finalRaw?.inputTokens,
        outputTokens: result.finalRaw?.outputTokens,
        routerVerified: result.finalRaw?.routerVerified,
        rawResponse: result.finalRaw?.rawResponse,
      } as unknown as RouterCallResult;
      judgement = { role: judgeRoleId, content: result.content };
    } else {
      judgeRaw = await input.keyring.chat({
        model: input.model,
        systemPrompt: judgeSystem,
        userPrompt: judgeUser,
        verifyTee: true,
      });
      judgement = { role: judgeRoleId, content: judgeRaw.content };
    }
  }

  // ─── Per-role attestations ──────────────────────────────────────────
  const attestations: RoleAttestation[] = [
    ...reviewerResults.map((r) => attestationFromRaw(r.role, r.raw)),
    ...(judgeRoleId && judgeRaw ? [attestationFromRaw(judgeRoleId, judgeRaw)] : []),
  ];

  // ─── Billing aggregate ──────────────────────────────────────────────
  const allRaws: RouterCallResult[] = [
    ...reviewerResults.map((r) => r.raw),
    ...(judgeRaw ? [judgeRaw] : []),
  ];
  const totalInputTokens = sum(allRaws.map((r) => r.inputTokens ?? 0));
  const totalOutputTokens = sum(allRaws.map((r) => r.outputTokens ?? 0));
  // Per 0G_TESTNET_NOTES.md: 0.05 OG / 1M input + 0.10 OG / 1M output
  const estimatedCostOg = (totalInputTokens * 0.05 + totalOutputTokens * 0.10) / 1_000_000;

  // Policy decision (planning-003 §A.4.4 · zer0Gig Efficiency Game).
  // Single-reviewer tiers (`quick`) have no meaningful policy layer; the
  // judge synthesis IS the decision in that case. For 2+ reviewers, run
  // the configured policy and record what it produced so verifiers can
  // re-run it offline.
  const policyDecision: PolicyDecision | null =
    reviewerOutputs.length >= 2
      ? applyPolicy({
          reviewerOutputs,
          policy: input.policy ?? 'majority',
          ...(input.weights ? { weights: input.weights } : {}),
        })
      : null;

  // Aggregate the per-role tool-call traces in role order. The receipt's
  // execution.toolCallTrace field stores this flattened list (with the
  // tool, argumentsHash, ok, durationMs, responseHash, responseSize shape
  // declared in packages/receipts/src/schema.ts).
  const toolCallTrace: ToolCallTrace[] | undefined = useTools
    ? [
        ...reviewerResults.flatMap((r) => perRoleTraces.get(r.role) ?? []),
        ...(judgeRoleId ? perRoleTraces.get(judgeRoleId) ?? [] : []),
      ]
    : undefined;

  return {
    tier,
    roles: roleIds,
    reviewerOutputs,
    judgement,
    convergence,
    attestations,
    billing: { totalInputTokens, totalOutputTokens, estimatedCostOg },
    gateResult,
    policyDecision,
    ...(toolCallTrace !== undefined ? { toolCallTrace } : {}),
  };
}

function attestationFromRaw(role: RoleId, raw: RouterCallResult): RoleAttestation {
  return {
    role,
    providerAddress: raw.providerAddress ?? null,
    zgResKey: raw.zgResKey ?? null,
    attestationHash: null, // populated by independent verify if available
    routerVerified: !!raw.routerVerified,
    independentVerified: null,
    inputTokens: raw.inputTokens ?? 0,
    outputTokens: raw.outputTokens ?? 0,
  };
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

/**
 * Independent TEE verify per attestation — calls broker.inference.processResponse for
 * each role's (provider, chatID) pair. Mutates the attestations in place.
 *
 * This is the "FULLY VERIFIED" step. Without it, attestations are only Router-flag
 * verified (we trusted the Router's claim that TEE was used).
 */
export interface BrokerLike {
  inference: {
    processResponse: (
      providerAddress: string,
      chatID?: string,
      content?: string,
    ) => Promise<boolean | null>;
  };
}

export async function verifyAttestationsIndependent(
  attestations: RoleAttestation[],
  broker: BrokerLike,
  reviewerOutputs: { role: RoleId; content: string }[],
  judgement: { role: RoleId; content: string } | null,
): Promise<RoleAttestation[]> {
  const contentMap = new Map<string, string>();
  for (const r of reviewerOutputs) contentMap.set(r.role, r.content);
  if (judgement) contentMap.set(judgement.role, judgement.content);

  await Promise.all(
    attestations.map(async (att) => {
      if (!att.providerAddress || !att.zgResKey) {
        att.independentVerified = false;
        return;
      }
      try {
        const result = await broker.inference.processResponse(
          att.providerAddress,
          att.zgResKey,
          contentMap.get(att.role),
        );
        att.independentVerified = result === true;
      } catch (err) {
        att.independentVerified = false;
        // Surface as a warning at the caller layer — we don't throw here
        console.error(`[consensus] processResponse failed for role=${att.role}:`, (err as Error).message);
      }
    }),
  );

  return attestations;
}
