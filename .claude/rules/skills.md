# Skills rules

> Auto-loads when working on `packages/skills/**` and `seed-skills/**`. Path-scoped guidance per planning-003 §A.4.2.

## Hard rules

- **`SkillManifestSchema` is canonical** (`packages/skills/src/manifest.ts`). Every consumer (CLI, Studio, runtime, sandbox, scanner) parses against this schema. Field-level changes to the schema MUST be backwards-compatible OR ship a versioned migration.

- **Form options derive from schema, NOT redeclared.** `apps/studio/src/app/skill/new/page.tsx` MUST import `MemoryAccessEnum`, `ShellAccessEnum`, `ConsensusTierEnum` from `@ivaronix/skills` and read `.options`. NEVER redeclare the values as inline literal arrays.

- **Sandbox enum values:**
  - `memory_access`: `'none' | 'project_only' | 'all'`
  - `shell_access`: `'none' | 'sandbox-only' | 'full'`
  - `default_tier`: `'quick' | 'standard' | 'high-stakes'`
  
  These are the exact strings Zod accepts. Form drift is a §A.1.1 critical bug.

- **`receipt_required: true`** on every first-party skill (planning-003 §A.3.6). No exceptions. The §7 contract holds: every action anchors a receipt.

- **`creator.fee_split` block** required on every first-party skill manifest (planning-003 §A.3.8). Default 90/10 (creator 9000 bps / treasury 1000 bps); commoditised categories use 70/30 per `docs/MARKETPLACE_DESIGN.md`. Schema validates `creator + treasury === 10000`.

- **`compute_tee_required: true`** for any skill that handles user data. Defends against TIER 2 fall-through.

## Three publishing paths

Per `docs/SKILL_PUBLISHING.md`:
1. PR to `seed-skills/<id>/SKILL.md` (first-party)
2. Studio `/api/skill/save` → per-wallet sandbox FS (user-published)
3. `SkillRegistry.publish()` on chain (canonical decentralised)

Don't conflate them. Each has a different trust gradient.

## Manifest structure

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
    default_tier: quick | standard | high-stakes
  burn:
    auto_enable: false
  hooks:
    pre_consensus: ["redact_pii"]
    post_consensus: ["log_tokens"]
  creator:
    passport: "did:0g:passport:0x...:1"
    fee_split:
      creator: 9000
      treasury: 1000
---

# <Skill name>

<system prompt body>
```

## Hooks taxonomy

`packages/skills/src/hooks/types.ts`. Each hook stage is an array of named hook strings. Unknown hooks are dropped with a warning at load time. Built-in hooks: `redact_pii`, `balance_check`, `log_tokens`, `print_passport`, `log_anchor`, `safety_filter`.

## Tests

`packages/skills/test/` — vitest. `seed-skills/<id>/tests/` for skill-level golden tests.

## File location reference

- Manifest schema: `packages/skills/src/manifest.ts`
- Loader: `packages/skills/src/loader.ts`
- Sandbox: `packages/skills/src/sandbox.ts`
- Hooks: `packages/skills/src/hooks/`
- First-party skills: `seed-skills/<id>/SKILL.md` + `seed-skills/<id>/prompt.md`
