# Skill publishing · 3 paths

> Where do I put a new skill? What is the trust gradient between paths? Companion: `seed-skills/<id>/SKILL.md` for examples; `packages/skills/src/manifest.ts` for the canonical Zod schema.

## TL;DR · pick a path by use case

| Path | When to use | Persistence | Trust |
|---|---|---|---|
| **PR to `seed-skills/<id>/SKILL.md`** | First-party skills; brand-safe; operator-vetted | Git + filesystem · ships in every clone | Operator-reviewed |
| **Studio `/api/skill/save`** | User-published; sandboxed; no PR required | Per-wallet sandbox FS · `.ivaronix/skills/<wallet>/<id>/` | SIWE-authenticated; per-wallet quota |
| **`SkillRegistry.publish()` (on-chain)** | Canonical decentralised publishing; receipt-gated payment | Chain + IPFS hash · permanent | Creator wallet + on-chain fee-split |

A user-published skill from Studio doesn't auto-anchor on chain. The on-chain step is a separate operator action: `ivaronix skill publish <id>` from the creator's wallet.

## Path 1 · `seed-skills/<id>/SKILL.md` PR

**When:** the skill is first-party (one of the 6 the project ships), the prompt + tools have been reviewed, the brand-safety bar applies. Examples: `private-doc-review`, `0g-integration-auditor`, `code-edit`, `plan-step`, `content-pitch-review`, `github-audit`.

**Where it lives:** `seed-skills/<id>/SKILL.md` + `seed-skills/<id>/prompt.md` (the body). Committed to the repo; ships in every clone; loaded at boot via `loadAllSkills()`.

**How it ships:** open a PR. Reviewer checks: (1) the prompt body matches the skill's declared persona, (2) the manifest matches `SkillManifestSchema`, (3) the `creator.fee_split` block is present (90/10 or 70/30 per `MARKETPLACE_DESIGN.md`), (4) hooks are listed if needed, (5) `compute_tee_required` is `true` for any skill that handles user data.

**Trust:** operator-reviewed. The manifest hash is committed to git; tampering is visible in git diff. Loading is deterministic — same hash for everyone who clones the repo.

## Path 2 · Studio `/api/skill/save` (sandboxed user publish)

**When:** a non-developer creator wants to ship a skill from the Studio UI without opening a PR. Use case: a deal lawyer publishes "M&A red-flag review" tuned to their firm's playbook; they keep the prompt private to their wallet's sandbox until they decide to publish on chain.

**Where it lives:** `apps/cli/.ivaronix/skills/<sessionWallet>/<skillId>/SKILL.md`. The sandbox is per-wallet so two creators publishing the same skill name don't collide.

**How it ships:** SIWE-authenticated POST to `/api/skill/save` with `{ skillId, manifest }` body. The route enforces a per-wallet rate limit (5 saves/hr), validates the YAML frontmatter against `SkillManifestSchema`, walks `og.hooks.*` for shell-injection patterns, and rejects bad shapes with 400.

**Trust:** SIWE-authenticated. The session wallet (NOT the body) controls the path namespace — cross-wallet writes are impossible by construction. A second `startsWith(sandboxRoot)` defence-in-depth check rejects any resolved path that escapes the per-wallet sandbox.

A skill published this way runs immediately via `ivaronix doc ask <doc> "..." --skill <skillId>` for the creator. It does NOT appear in `/skills` for other users until step 3 (chain publish) lands.

## Path 3 · `SkillRegistry.publish()` (on-chain canonical)

**When:** the creator is ready to publish a skill that earns receipt-gated fees per Track 3 design. Use case: a security firm publishes a `solidity-audit` skill; every paid run anchors a receipt that pays the firm's wallet via the on-chain fee split.

**Where it lives:** `SkillRegistry.sol` on 0G Chain (testnet `0xf8894Ce4FFc7C594976d5Eaca38d8FE6DB4820a1`). Skill ID = `keccak256("skill:<lowercase-name>")`. Versions are immutable; the manifest hash binds to a specific (skillId, versionId) pair.

**How it ships:** `ivaronix skill publish <skillId>` from the creator's wallet. The CLI:
1. Reads the skill from `seed-skills/` OR `apps/cli/.ivaronix/skills/<wallet>/`.
2. Computes the canonical manifest hash via `manifestHashToBytes32` (RFC-8785 JCS + keccak256).
3. Submits `SkillRegistry.publish(skillId, versionId, manifestHash, metadata...)` from the creator's wallet.
4. Returns the chain TX + on-chain skill record.

**Trust:** the creator's wallet is the on-chain owner. Subsequent versions must come from the same wallet (or transferred owner). The manifest hash on chain matches the manifest body off-chain, so any verifier can re-compute and confirm.

## Why three paths, not one

The three-path model is deliberate:
- The first-party set must be brand-safe — Path 1 enforces operator review.
- User-published skills should be runnable immediately — Path 2 ships locally, no chain wait.
- Marketplace listings need on-chain creator and fee-split — Path 3 is the public surface.

Each path has a different trust gradient, mapped to a different use case. The schema is the same (`SkillManifestSchema`); the persistence layer changes per path.

## Decision tree

```
Are you a first-party (Ivaronix-operated) creator?
├─ Yes → Path 1 (PR to seed-skills/)
└─ No
   │
   ├─ Do you want to monetise via the on-chain marketplace?
   │  ├─ Yes → Path 2 first (test in your sandbox), then Path 3 when ready to publish
   │  └─ No  → Path 2 (Studio /api/skill/save · runs locally for you only)
   │
   └─ Are you experimenting before deciding?
      → Path 2 (sandboxed; promote to Path 3 later if useful)
```

## Lint coverage

Three rules govern first-party skill manifests; two are gated by a regression today, one stays runtime-only:
- **Schema parse** — every `seed-skills/<id>/SKILL.md` parses against the canonical `SkillManifestSchema`. Gated by `scripts/qa/metamask-e2e/verify-seed-skill-manifests.ts`. Failures show up at pre-commit, not at user-first-run.
- **`creator.fee_split` block** — required per `MARKETPLACE_DESIGN.md` (creator + treasury === 10000). Enforced by the Zod schema itself (`SkillManifestSchema` rejects manifests without the block).
- **Published manifest hash matches on-chain record** — queued. The on-chain `SkillRegistry` records each skill's manifest hash at publish time; a deliberate check against `loadAllSkills()` output would catch drift between the seed file and the deployed registry entry. The runtime path catches major divergence via `scanSkill(...)` inside `runPipeline`, but a one-shot lint command would be cleaner.

The runtime checks (schema parse at load time via `loadAllSkills()`, per-wallet sandbox check at save time via `/api/skill/save`) remain in place as the defense-in-depth layer.
