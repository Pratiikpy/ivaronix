import { z } from 'zod';

/**
 * Public skills-registry schema (planning-002 W8 — Trapezohe Ghast pattern).
 *
 * The on-chain `SkillRegistry` contract is the trustless source of truth for
 * skill manifest hashes. This file is the **discovery** layer — a flat
 * GitHub-hosted JSON catalogue that any developer or judge can browse
 * without connecting a wallet, and that anyone can contribute to via PR.
 *
 * Each entry mirrors a `SKILL.md` frontmatter at a high level — enough for
 * a developer to evaluate fit without cloning the repo. The on-chain hash
 * is the canonical truth; if a registry entry's `manifestHash` does not
 * match the chain's record, the chain wins.
 */

export const RegistryEntrySchema = z.object({
  /** Lowercase, dash-separated id; matches the seed-skills/<id> directory. */
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(20).max(400),
  /** Source category — first-party (audited, fee-split-tested) vs imports
   * (community-contributed, see imports/<id>/SKILL.md). */
  source: z.enum(['first-party', 'imports']),
  /** Default consensus tier the skill prescribes; useful for cost UX. */
  default_tier: z.enum(['quick', 'standard', 'high-stakes', 'audit']),
  /** Whether the skill auto-enables Burn Mode (AES-256-GCM session-key
   * destroy after each run). */
  burn_auto: z.boolean(),
  /** Path inside the repo where the SKILL.md lives. */
  path: z.string(),
  /** sha256 of the SKILL.md frontmatter — written at export time, can be
   * recomputed by `ivaronix skill registry verify`. */
  manifestHash: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
  /** Track 3 fee_split as declared in the manifest. */
  fee_split: z
    .object({
      creator: z.number().int().min(0).max(10000),
      treasury: z.number().int().min(0).max(10000),
    })
    .optional(),
  /** Whether the skill is currently registered on the on-chain
   * SkillRegistry contract (set by export-time scan). */
  on_chain: z.boolean().default(false),
});

export const RegistrySchema = z.object({
  /** Schema version — bump when fields change. */
  $schema: z.literal('https://ivaronix.studio/schemas/skills-registry/1.0'),
  /** When this file was last regenerated. */
  generated_at: z.string(),
  /** Total skill count (first-party + imports). */
  total: z.number().int().nonnegative(),
  /** Per-source breakdown for at-a-glance stats. */
  counts: z.object({
    first_party: z.number().int().nonnegative(),
    imports: z.number().int().nonnegative(),
  }),
  /** Network the on_chain flags were resolved against (testnet | mainnet). */
  network: z.enum(['testnet', 'mainnet']),
  /** All skills, sorted: first-party alphabetical, then imports alphabetical. */
  skills: z.array(RegistryEntrySchema),
});

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;
export type Registry = z.infer<typeof RegistrySchema>;
