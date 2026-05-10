# `@ivaronix/trust-layer`

> **Status:** Schema scaffold per PRD §3.5. Implementation tracked in USER_TODO §B-V2; the schemas + policy evaluator below are the locked surface today.

## What lives here

- **`schema.ts`** — Zod schemas for the enterprise types: `Team` · `TeamMember` · `PolicyRule` · `PolicySet` · `ApprovalGate` · `SpendLedgerEntry` · `AuditExportRequest` · `AuditExportRow`.
- **`policy.ts`** — pure-function policy evaluator: `evaluatePolicy(set, candidate) → {effect, rule, reason, approvers}`. Supports `allow` · `deny` · `require_approval` · `log_only` effects, trust-score gates, daily spend caps, glob matching on skill/mode/tier/network/caller.
- **`defaultPolicySet(teamId, owner)`** — starter rules: `mainnet-high-stakes-requires-approval`, `mainnet-daily-cap-1og`, `auditor-readonly`.

## How it slots into the receipt format

Receipts shipping today already carry `request.approvalChain` (per RECEIPTS_SPEC §1). Today every receipt records `[{gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:default-strict'}]` — a single hard-coded rule. **The end-state swaps the hard-coded rule for `evaluatePolicy(team.policy, candidate)` and writes the resulting `EvalDecision` into `approvalChain` instead.** No receipt schema change required.

## Phase-3 surfaces (locked)

| | What | Where it lands |
|---|---|---|
| 1 | Team CRUD | new `TeamRegistry.sol` (ERC-721 for the team-id NFT) + Studio `/team/<slug>` |
| 2 | Policy editor | Studio `/team/<slug>/policies` — YAML/JSON editor + diff view |
| 3 | Approval queue | Studio `/team/<slug>/approvals` — pending receipts awaiting admin sign |
| 4 | Spend ledger | Studio `/team/<slug>/spend` — per-caller-per-day OG burn |
| 5 | Audit export | CLI `ivaronix team export <slug> --format json` and Studio "Export" button |
| 6 | Compliance pdf | nice-to-have; pdfkit + the audit export rows |

## Why a schema scaffold (not full impl)?

Per PRD §3.5: *"Realistic enterprise revenue line; designed in schema now."* Locking the surface today means:

- Receipts shipping today already conform; future Phase-3 contract additions don't break the receipt format.
- Future contract additions are predictable (TeamRegistry + PolicyAnchor are the only new on-chain entities required).
- Studio's Trust-Layer pages can be designed against the schema before the contracts ship.

## Quick example

```ts
import { evaluatePolicy, defaultPolicySet } from '@ivaronix/trust-layer';

const set = defaultPolicySet('team_01H...XYZ', '0xaa95...');
const decision = evaluatePolicy(set, {
  skillId: 'private-doc-review',
  mode: 'doc',
  tier: 'high-stakes',
  caller: '0xbeef...',
  network: 'mainnet',
  callerTrustScore: 12,
  todaySpendOg: 0.5,
});
// → { effect: 'require_approval', approvers: ['role:admin'], reason: '...' }
```
