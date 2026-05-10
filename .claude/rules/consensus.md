# Consensus rules

> Auto-loads when working on `packages/consensus/**`. Path-scoped guidance per planning-003 §A.4.2.

## Stack

- Multi-role inference orchestrator. Tiers: `quick` (1 role) · `standard` (3 roles) · `high-stakes` (5 roles) · `audit` (6 roles, shipped 2026-05-10).
- Convergence scoring: tokenized Jaccard plus embedding-cosine (MiniLM) when an embedder is injected (`packages/consensus/src/convergence.ts` · planning-003 §A.4.9).

## Hard rules

- **`processResponse(provider, chatID, usageJSON)` takes 3 args.** Third arg is `JSON.stringify(data.usage ?? {})`. NOT response text. Required for fee caching.

- **RoleId enum is canonical.** Defined in `packages/consensus/src/prompts.ts:11-17`: `analyst`, `critic`, `risk-reviewer`, `evidence-checker`, `red-team-critic`, `judge`. Six roles. Tier configurations select subsets.

- **Convergence threshold defaults to 0.6** (Jaccard). Skill manifests can override via `og.consensus.threshold`. Below threshold → "no convergence" recorded on the receipt.

- **`red-team-critic` lives in the `audit` tier only.** Closes planning-003 §A.5.20 (the role was orphan in `prompts.ts` until the audit tier shipped). Don't add it to standard or high-stakes — that's why audit exists. The `tier-shape.test.ts` regression suite enforces this.

## Tier composition (locked 2026-05-10)

| Tier | Roles | Use case |
|---|---|---|
| `quick` | analyst | one-shot answer |
| `standard` | analyst + critic + judge | reviewed answer with one objection cycle |
| `high-stakes` | analyst + critic + risk-reviewer + evidence-checker + judge | legal / contract / financial review |
| `audit` | analyst + critic + risk-reviewer + evidence-checker + red-team-critic + judge | premium adversarial audit (Track-3 marketplace top tier) |

Composition is **monotone**: `standard ⊂ high-stakes ⊂ audit`. Every higher tier strictly extends the previous. Drift on this is a regression and `tier-shape.test.ts` will catch it.

## Aggregation policies (queued · planning-003 §A.4.4)

`consensus.policy: 'unanimous' | 'majority' | 'first-objection' | 'weighted'` will land with the Efficiency Game work. Today every tier uses `majority` implicitly (judge synthesises with simple majority sentiment).

## Tests

`packages/consensus/src/*.test.ts` — Node's built-in `node:test` runner via `tsx`. Run via `pnpm --filter @ivaronix/consensus test`. Suites: `convergence.test.ts` · `gates.test.ts` (planning-003 §A.5.15) · `tier-shape.test.ts` (planning-003 §A.5.20).

## File location reference

- Prompts: `packages/consensus/src/prompts.ts`
- Convergence: `packages/consensus/src/convergence.ts`
- Gates (pre-flight checks): `packages/consensus/src/gates.ts`
- Main orchestrator: `packages/consensus/src/index.ts`
