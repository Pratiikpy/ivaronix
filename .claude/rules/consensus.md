# Consensus rules

> Auto-loads when working on `packages/consensus/**`. Path-scoped guidance per planning-003 §A.4.2.

## Stack

- Multi-role inference orchestrator. Tiers: `quick` (1 role) · `standard` (3 roles) · `high-stakes` (5 roles) · `audit` (6 roles, queued).
- Convergence scoring: tokenized Jaccard today (`packages/consensus/src/convergence.ts`). Embeddings via `vector.ts` `embedAsync` queued (planning-003 §A.4.9).

## Hard rules

- **`processResponse(provider, chatID, usageJSON)` takes 3 args.** Third arg is `JSON.stringify(data.usage ?? {})`. NOT response text. Required for fee caching.

- **RoleId enum is canonical.** Defined in `packages/consensus/src/prompts.ts:11-17`: `analyst`, `critic`, `risk-reviewer`, `evidence-checker`, `red-team-critic`, `judge`. Six roles. Tier configurations select subsets.

- **Convergence threshold defaults to 0.6** (Jaccard). Skill manifests can override via `og.consensus.threshold`. Below threshold → "no convergence" recorded on the receipt.

- **`red-team-critic`** is currently orphan (queued · planning-003 §A.5.20 ships the audit tier that uses it). Don't add it to standard or high-stakes tiers; ship the audit tier first.

## Tier composition

| Tier | Roles | Use case |
|---|---|---|
| `quick` | analyst | one-shot answer |
| `standard` | analyst + critic + judge | reviewed answer with one objection cycle |
| `high-stakes` | analyst + critic + risk-reviewer + evidence-checker + judge | legal / contract / financial review |
| `audit` (queued) | + red-team-critic (6 total) | adversarial review, premium tier |

## Aggregation policies (queued · planning-003 §A.4.4)

`consensus.policy: 'unanimous' | 'majority' | 'first-objection' | 'weighted'` will land with the Efficiency Game work. Today every tier uses `majority` implicitly (judge synthesises with simple majority sentiment).

## Tests

`packages/consensus/test/` — vitest. Run via `pnpm --filter @ivaronix/consensus test`.

## File location reference

- Prompts: `packages/consensus/src/prompts.ts`
- Convergence: `packages/consensus/src/convergence.ts`
- Gates (pre-flight checks): `packages/consensus/src/gates.ts`
- Main orchestrator: `packages/consensus/src/index.ts`
