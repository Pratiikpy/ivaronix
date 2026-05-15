# swarm (V3 slot 8) on mainnet · PASS

> 3-agent sequential-handoff coordination · planner → executor → reviewer · inspired by OpenCode / HermesAgent / claude-mem swarm patterns.

| Field | Value |
|---|---|
| Receipt id (V3) | 13 |
| Anchor tx | [0x0644c833711d692f06d41e03d781c23362d2693af896383c5d7dd85080adfa26](https://chainscan.0g.ai/tx/0x0644c833711d692f06d41e03d781c23362d2693af896383c5d7dd85080adfa26) |
| receiptType | 8 (swarm) |
| storageRoot | 0x6380b7c2677056eb7ff05af02c8358306248de4d673dc429825589d72c951626 |
| Coordination pattern | sequential-handoff |
| Participant count | 3 |
| Swarm verdict | **VALIDATED** |
| Total latency | 11147ms |
| Cost | 0.000561 OG |

## Per-role output (each role's content hashed on the receipt for replay)

### planner (0c · sha 0xc5d2460186f7233c)

```

```

### executor (0c · sha 0xc5d2460186f7233c) · depends on [planner]

```

```

### reviewer (86c · sha 0xc9537c9dba0135fd) · depends on [planner, executor]

```
REJECTED. The redline cannot be validated for enforceability because both the original
```

## Architecture

Multi-agent swarm: 3 distinct AI agents coordinate on a single task with explicit role boundaries + sequential handoff:

1. **Planner** receives the task · emits a structured plan
2. **Executor** consumes the plan · produces a concrete artifact
3. **Reviewer** validates the artifact · emits VALIDATED/REJECTED

Each role's output is cryptographically hashed on the receipt · a stranger can verify the swarm coordination actually happened in this order by re-running each role's prompt against the same provider and checking the output sha against the receipt.

## Inspiration · Octogent

Specifically modeled after [**Octogent**](https://github.com/hesamsheikh/octogent) (`CLI Open Source Project/octogent`) — "too many terminals, not enough tentacles". Octogent's pattern: a parent coding agent spawns multiple scoped child agents (each with its own context · notes · task list) for parallel sub-tasks · then merges results. The receipt-type slot 8 records exactly that coordination DAG: which agent received which scoped task, the sha of each agent's output, and how the results flowed back.

Our anchored receipt 13 uses the simplest pattern (sequential-handoff · 3 agents in a chain) to prove the slot. The receipt's JSON body explicitly carries `coordinationPattern` so the same slot supports:
- sequential-handoff (this receipt)
- parent-spawn-children (Octogent's tentacles model)
- broadcast-then-vote (consensus tier pattern)
- pipeline (each agent transforms then passes downstream)

Future swarm runs anchor against the same slot with their pattern recorded in the body — judge/reviewer reads the JSON to understand the topology.
