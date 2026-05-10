# `seed-skills/` — agent guidance

> Per planning-003 §A.5.2. Path-scoped specifics live in `.claude/rules/skills.md` (auto-loaded when editing skill manifests here or in `packages/skills/**`).

## Stack at a glance

- First-party skills: each skill is a directory with `SKILL.md` (YAML frontmatter + system-prompt body) + optional `tests/` golden fixtures.
- Manifest schema: `packages/skills/src/manifest.ts` — Zod-validated, source of truth. NEVER redeclare schema fields inline.
- Sandbox enums: `MemoryAccessEnum` (`'none' | 'project_only' | 'all'`), `ShellAccessEnum` (`'none' | 'sandbox-only' | 'full'`), `ConsensusTierEnum` (`'quick' | 'standard' | 'high-stakes' | 'audit'`). Studio forms derive options from `.options` per planning-003 §A.1.1.

## Hard rules

- **`receipt_required: true`** on every first-party skill (planning-003 §A.3.6). No exceptions. The §7 contract holds: every action anchors a receipt.
- **`creator.fee_split` block** required on every first-party skill manifest (planning-003 §A.3.8). Default 90/10 (creator 9000 bps / treasury 1000 bps); commoditised categories use 70/30 per `docs/MARKETPLACE_DESIGN.md`. Schema validates `creator + treasury === 10000`.
- **`compute_tee_required: true`** for any skill that handles user data. Defends against TIER 2 fall-through.
- **`audit` tier opt-in** per planning-003 §A.5.20: skills can declare `default_tier: audit` for premium adversarial review (6 roles incl. red-team-critic). Marketplace pricing reflects this.

## Three publishing paths (different trust gradient)

1. PR to `seed-skills/<id>/SKILL.md` (first-party, audited).
2. Studio `/api/skill/save` → per-wallet sandbox FS (user-published, SIWE-gated).
3. `SkillRegistry.publish()` on chain (canonical decentralised, requires gas).

Don't conflate them.

## Hot files

- Manifest schema: `packages/skills/src/manifest.ts`.
- Loader: `packages/skills/src/loader.ts`.
- Sandbox: `packages/skills/src/sandbox.ts`.
- Hooks: `packages/skills/src/hooks/`.
- First-party skills: `seed-skills/<id>/SKILL.md` + `seed-skills/<id>/prompt.md`.

## Manifest skeleton

```yaml
---
name: <slug>
version: <semver>
description: <one-sentence>
license: Apache-2.0 | MIT | GPL-3.0
entrypoint: prompt.md
og:
  permissions:
    memory_access: project_only
    shell_access: none
    receipt_required: true
    compute_tee_required: true
    passport_min_trust: 0
  consensus:
    required: false
    default_tier: quick | standard | high-stakes | audit
  burn:
    auto_enable: false
  creator:
    passport: "did:0g:passport:0x...:1"
    fee_split:
      creator: 9000
      treasury: 1000
---

# <Skill name>

<system prompt body>
```

## Test command

```bash
pnpm --filter @ivaronix/skills typecheck
pnpm --filter @ivaronix/skills test
# Per-skill golden:
pnpm tsx seed-skills/<id>/tests/golden.ts
```

## See also

- `.claude/rules/skills.md` — full schema-as-source-of-truth rule + hooks taxonomy.
- `docs/SKILL_PUBLISHING.md` — three-path table with trust gradients.
- `docs/MARKETPLACE_DESIGN.md` — fee-split economic policy.
