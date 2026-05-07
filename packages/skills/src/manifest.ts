import { z } from 'zod';

/**
 * Ivaronix skill manifest = Anthropic SKILL.md frontmatter + `og:` extension block.
 * The `og:` block is the long-term moat (per PRD §3.4): permission contracts,
 * reputation hooks, fee splits, consensus tier — none of which exist in vanilla
 * SKILL.md. A forker who copies just `name`/`description` gets nothing.
 */

const Permissions = z.object({
  memory_access: z.enum(['none', 'project_only', 'all']).default('none'),
  network_access: z.array(z.string()).default([]),
  wallet_access: z.boolean().default(false),
  writes_files: z.boolean().default(false),
  shell_access: z.enum(['none', 'sandbox-only', 'full']).default('none'),
  receipt_required: z.boolean().default(true),
  storage_quota_per_run: z.string().optional(), // e.g. "5MB"
  storage_namespace: z.string().optional(),
  compute_tee_required: z.boolean().default(true),
  chain_gas_budget: z.string().optional(), // e.g. "0.01 OG"
  passport_min_trust: z.number().int().default(0),
});

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

const Consensus = z.object({
  required: z.boolean().default(false),
  default_tier: z.enum(['quick', 'standard', 'high-stakes']).default('quick'),
});

const Burn = z.object({
  auto_enable: z.boolean().default(false),
});

/**
 * Lifecycle-hook subscriptions (Day 11). Each value is an ordered list of
 * built-in hook names. Unknown names are dropped at load time with a warning.
 */
const Hooks = z.object({
  session_start: z.array(z.string()).default([]),
  pre_consensus: z.array(z.string()).default([]),
  post_consensus: z.array(z.string()).default([]),
  pre_anchor: z.array(z.string()).default([]),
  post_anchor: z.array(z.string()).default([]),
  session_end: z.array(z.string()).default([]),
});

const OgBlock = z.object({
  permissions: Permissions.default({} as z.infer<typeof Permissions>),
  reputation: Reputation.default({} as z.infer<typeof Reputation>),
  consensus: Consensus.default({} as z.infer<typeof Consensus>),
  burn: Burn.default({} as z.infer<typeof Burn>),
  hooks: Hooks.default({} as z.infer<typeof Hooks>),
  creator: z
    .object({
      passport: z.string().optional(),
      fee_split: z
        .object({ creator: z.number().int(), treasury: z.number().int() })
        .optional(),
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
