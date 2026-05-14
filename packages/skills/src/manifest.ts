import { z } from 'zod';

/**
 * Ivaronix skill manifest = Anthropic SKILL.md frontmatter + `og:` extension block.
 * The `og:` block is the long-term moat (per PRD §3.4): permission contracts,
 * reputation hooks, fee splits, consensus tier — none of which exist in vanilla
 * SKILL.md. A forker who copies just `name`/`description` gets nothing.
 */

/**
 * Raw enum schemas for the Permissions block. Exported separately so
 * consumers (the Studio skill-builder form, source-file regressions, etc.)
 * can read the enum values directly via `.options` without unwrapping
 * `.default(...)` runtime metadata.
 *
 * Derived from these enums + form-field defaults, the Studio
 * `apps/studio/src/app/skill/new/page.tsx` builder produces SKILL.md
 * frontmatter that always parses against `SkillManifestSchema` — the
 * form/schema drift bug (planning-003 §A.1.1 / WT 43, 44, 85) is closed
 * by this single source of truth.
 */
export const MemoryAccessEnum = z.enum(['none', 'project_only', 'all']);
export const ShellAccessEnum = z.enum(['none', 'sandbox-only', 'full']);

export type MemoryAccess = z.infer<typeof MemoryAccessEnum>;
export type ShellAccess = z.infer<typeof ShellAccessEnum>;

export const Permissions = z.object({
  memory_access: MemoryAccessEnum.default('none'),
  network_access: z.array(z.string()).default([]),
  wallet_access: z.boolean().default(false),
  writes_files: z.boolean().default(false),
  shell_access: ShellAccessEnum.default('none'),
  receipt_required: z.boolean().default(true),
  storage_quota_per_run: z.string().optional(), // e.g. "5MB"
  storage_namespace: z.string().optional(),
  compute_tee_required: z.boolean().default(true),
  chain_gas_budget: z.string().optional(), // e.g. "0.01 OG"
  passport_min_trust: z.number().int().default(0),
});

export type SkillPermissions = z.infer<typeof Permissions>;

const Reputation = z.object({
  on_pass: z
    .object({
      trustScore: z.number().int(),
      receiptCount: z.number().int().default(1),
    })
    .default({ trustScore: 1, receiptCount: 1 }),
  on_fail: z
    .object({
      trustScore: z.number().int(),
      violationCount: z.number().int().default(0),
    })
    .default({ trustScore: -2, violationCount: 0 }),
  on_violation: z
    .object({
      trustScore: z.number().int(),
      locked: z.boolean().default(false),
    })
    .default({ trustScore: -10, locked: false }),
});

/**
 * Consensus tier enum, exported separately so the Studio skill-builder
 * form derives its `default_tier` dropdown options from this schema
 * (planning-003 §A.1.6 · same pattern as MemoryAccessEnum / ShellAccessEnum).
 *
 * Tier composition is the source-of-truth `ROLES_BY_TIER` map in
 * `@ivaronix/core/types`. The `audit` tier (6 roles incl. red-team-critic)
 * lands per planning-003 §A.5.20 as the Track-3 marketplace premium tier.
 */
export const ConsensusTierEnum = z.enum(['quick', 'standard', 'high-stakes', 'audit']);

export type ConsensusTier = z.infer<typeof ConsensusTierEnum>;

/**
 * Aggregation policy applied to reviewer outputs (planning-003 §A.4.4 ·
 * zer0Gig Efficiency Game). The policy decides what counts as "consensus
 * reached" given a set of role outputs:
 *
 *   - `unanimous`: every reviewer must agree; one objection blocks.
 *   - `majority`: ≥ ceil(N/2) reviewers must agree (default).
 *   - `first-objection`: any single reviewer flagging a hard concern
 *     short-circuits the run; the receipt records the objector's role
 *     + the dissent text. Useful for high-stakes legal review.
 *   - `weighted`: reviewers carry per-role weight from the skill manifest
 *     (e.g. evidence-checker > critic > analyst); decision is the
 *     weighted-majority sentiment.
 *
 * Studio Run panel exposes this as a "How strict?" dropdown:
 *   - STRICT   = unanimous
 *   - BALANCED = majority (skill default)
 *   - LENIENT  = first-objection inverted (passes unless every reviewer
 *               objects)
 */
export const ConsensusPolicyEnum = z.enum([
  'unanimous',
  'majority',
  'first-objection',
  'weighted',
]);

export type ConsensusPolicy = z.infer<typeof ConsensusPolicyEnum>;

const Consensus = z.object({
  required: z.boolean().default(false),
  default_tier: ConsensusTierEnum.default('quick'),
  /**
   * Default aggregation policy. Optional + defaulted so older manifests
   * keep their canonical hash. `majority` is the default because it's
   * what `runConsensus` has implicitly applied since the receipt format
   * shipped.
   */
  policy: ConsensusPolicyEnum.default('majority'),
});

/**
 * Fee-split policy for receipts produced by this skill (planning-003
 * §A.4.4 · zer0Gig Efficiency Game).
 *
 *   - `flat`: creator share is fixed (per the skill's `creator.fee_split`).
 *     The default; matches the pre-A.4.4 behaviour exactly.
 *   - `efficiency-game`: creator share is conditioned on outcome:
 *       * TIER 1 first-attempt   → 95% of declared bps
 *       * TIER 1 retry           → 85% of declared bps
 *       * TIER 2 (any)           → 70% of declared bps
 *       * failed (status = 'failed')  → 0%; treasury collects gas only
 *     The skill opts in via this field; the runtime branches on it.
 */
export const FeeSplitPolicyEnum = z.enum(['flat', 'efficiency-game']);

export type FeeSplitPolicy = z.infer<typeof FeeSplitPolicyEnum>;

const Burn = z.object({
  auto_enable: z.boolean().default(false),
});

/**
 * Lifecycle-hook subscriptions. Each value is an ordered list of built-in
 * hook names. Unknown names are dropped at load time with a warning.
 */
const Hooks = z.object({
  session_start: z.array(z.string()).default([]),
  pre_consensus: z.array(z.string()).default([]),
  post_consensus: z.array(z.string()).default([]),
  pre_anchor: z.array(z.string()).default([]),
  post_anchor: z.array(z.string()).default([]),
  session_end: z.array(z.string()).default([]),
});

/**
 * Skill-declared tools. Skills declare which built-in tools they allow plus
 * any custom shell-runner tools (e.g. `extract_pdf_text` calling
 * `pdftotext`). The chat REPL merges these with the global tool catalog
 * when this skill is active. Custom tools render through a small template
 * substitution: `{{argName}}` in args[] is replaced with the corresponding
 * JSON property the model passed.
 *
 * Example (private-doc-review/SKILL.md):
 *
 *   og:
 *     tools:
 *       builtins: ["read_file", "list_files"]
 *       custom:
 *         - name: extract_pdf_text
 *           description: Extract plain text from a PDF file at `path`.
 *           parameters:
 *             type: object
 *             properties:
 *               path: {type: string, description: "PDF path"}
 *             required: ["path"]
 *           runner:
 *             type: shell
 *             cmd: pdftotext
 *             args: ["{{path}}", "-"]
 *             timeout_ms: 15000
 */
const ToolRunner = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('shell'),
    cmd: z.string(),
    args: z.array(z.string()).default([]),
    timeout_ms: z.number().int().min(100).max(60_000).default(20_000),
  }),
  z.object({
    type: z.literal('builtin'),
    tool: z.enum(['read_file', 'write_file', 'list_files', 'grep', 'run_bash', 'web_fetch']),
  }),
]);

const SkillTools = z.object({
  builtins: z
    .array(z.enum(['read_file', 'write_file', 'list_files', 'grep', 'run_bash', 'web_fetch']))
    .optional()
    .describe('Subset of built-in tools the skill is allowed to use; unset = all six'),
  custom: z
    .array(
      z.object({
        name: z.string().regex(/^[a-z][a-z0-9_]{0,40}$/),
        description: z.string().min(1).max(500),
        parameters: z
          .object({
            type: z.literal('object'),
            properties: z.record(z.unknown()),
            required: z.array(z.string()).optional(),
          })
          .strict(),
        runner: ToolRunner,
      }),
    )
    .default([]),
});

export type SkillToolDef = z.infer<typeof SkillTools>['custom'][number];

/**
 * Vertical taxonomy. Skills declare their target domain so the marketplace
 * can group + filter, and so `/verticals` can lead with the live cluster.
 * Adding a vertical here is the contract: every `LIVE` value MUST have at
 * least one shipped, published, FULLY-VERIFIED-anchored first-party skill
 * behind it. `roadmap_*` values are the honest COMING SOON list — they exist
 * in the enum so a `/verticals` card can render with an amber dashed badge,
 * but no shipped skill carries a `roadmap_*` value.
 *
 * Backwards compatibility: this field is optional on `og` so the 6 existing
 * first-party skills (published with canonical sha256 manifestHashes already
 * registered on `SkillRegistryV2 0xF05113E83…`) serialize to byte-identical
 * canonical JSON when re-loaded. New first-party skills MUST declare a vertical.
 */
export const VerticalEnum = z.enum([
  'legal',
  'roadmap_healthcare',
  'roadmap_hr',
  'roadmap_finance',
  'roadmap_customer_support',
  'roadmap_education',
  'roadmap_code',
  'roadmap_compliance',
  'roadmap_insurance',
  'roadmap_real_estate',
  'roadmap_journalism',
  'roadmap_marketing_sales',
  'roadmap_research',
  'roadmap_government',
  'roadmap_procurement',
]);

export type Vertical = z.infer<typeof VerticalEnum>;

const OgBlock = z.object({
  permissions: Permissions.default({} as z.infer<typeof Permissions>),
  reputation: Reputation.default({} as z.infer<typeof Reputation>),
  consensus: Consensus.default({} as z.infer<typeof Consensus>),
  burn: Burn.default({} as z.infer<typeof Burn>),
  /**
   * Vertical taxonomy (legal first · 14 others as honest roadmap). Optional
   * to preserve canonical manifestHash byte-identity for previously published
   * first-party skills. New manifests declare a vertical; the marketplace and
   * `/verticals` page filter on it.
   */
  vertical: VerticalEnum.optional(),
  /**
   * Models this skill is permitted to run against. The runtime checks
   * `model in acceptableModels[]` against the live 0G Compute provider
   * catalog before invocation; mismatch fails the run rather than silently
   * substituting. Empty/undefined = no whitelist (testnet permissive).
   *
   * TESTNET (Galileo · today): the legal cluster locks to
   * `['qwen/qwen-2.5-7b-instruct']` plus whatever else `compute list-providers`
   * returns live. Mainnet promotion swaps to `['0GM-1.0-35B-A3B',
   * 'deepseek-v4-pro', 'qwen3-32b']` — never substitute before the §2.7
   * smoke test confirms our route hits those endpoints.
   *
   * Optional for canonical-hash backwards compatibility.
   */
  acceptableModels: z.array(z.string()).optional(),
  // Hooks is optional so older manifests (published without an `og.hooks` block)
  // produce the SAME canonical-JSON hash they did before this field was added.
  // Adding `.default({})` would silently mutate every old manifest's hash.
  hooks: Hooks.optional(),
  // Skill-declared tools. Optional so older manifests' canonical hash
  // stays unchanged after this field was added.
  tools: SkillTools.optional(),
  creator: z
    .object({
      passport: z.string().optional(),
      // Basis points (sum to 10000 = 100%). 9000/1000 = creator gets 90%,
      // treasury gets 10%. Validated in `validateFeeSplit` below.
      fee_split: z
        .object({
          creator: z.number().int().min(0).max(10000),
          treasury: z.number().int().min(0).max(10000),
        })
        .refine((v) => v.creator + v.treasury === 10000, {
          message: 'creator + treasury must sum to 10000 basis points (100%)',
        })
        .optional(),
      /**
       * Fee-split policy for receipts produced by this skill
       * (planning-003 §A.4.4). `flat` (default) routes the declared bps
       * unconditionally. `efficiency-game` conditions the bps on outcome
       * tier × attempts so a clean first-pass earns the full creator
       * share while a retry-heavy run is settled at a discount. See
       * `FeeSplitPolicyEnum` JSDoc for the bps schedule.
       */
      fee_split_policy: FeeSplitPolicyEnum.default('flat'),
    })
    .optional(),
  scanner: z
    .object({
      last_scan_at: z.number().int().optional(),
      score: z.number().int().min(0).max(100).optional(),
      warnings: z.array(z.string()).default([]),
    })
    .optional(),
  anchor: z
    .object({
      manifest_hash: z.string().optional(), // sha256:<hex>
      registry_address: z.string().optional(),
      token_id: z.number().int().optional(),
      tx_hash: z.string().optional(),
    })
    .optional(),
});

export const SkillManifestSchema = z.object({
  // Anthropic-standard SKILL.md frontmatter
  name: z.string().min(1),
  version: z.string().default('0.0.1'),
  description: z.string().min(1),
  license: z.string().default('Apache-2.0'),
  // Optional Anthropic fields
  entrypoint: z.string().default('prompt.md'),
  references: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  tests: z.array(z.string()).default([]),
  // Ivaronix og: extension
  og: OgBlock,
});

export type SkillManifest = z.infer<typeof SkillManifestSchema>;
