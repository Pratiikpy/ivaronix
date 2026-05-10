# Marketplace design · per-skill economic policy

> How fees are set per skill, why differentiated skills earn 90/10 and commoditised skills earn 70/30, and where this fits with zer0Gig's quality-conditioned Efficiency Game. Closes planning-003 §A.4.5 (wandering thought #83).

## TL;DR · per-skill base rate × per-run quality multiplier

Every Ivaronix skill manifest declares its own creator/treasury fee split. The split is **per-skill**, not per-run. A future quality-conditioned multiplier (planning-003 §A.4.4 · zer0Gig Efficiency Game) layers on top:

```
final_split = base_split (per skill) × quality_multiplier (per run)
```

Where:
- `base_split.creator` ∈ {9000, 8000, 7000, 5000} basis points (90/10, 80/20, 70/30, 50/50).
- `quality_multiplier ∈ {1.0, 0.85, 0.70, 0.0}` keyed on receipt tier × retry count.

Today only the base split ships. The multiplier is queued.

## Why per-skill rates

Different skill categories have different competitive density. A skill creator's earning potential depends on (a) how unique the skill is, (b) how much treasury value the platform contributes (catalog visibility, retention, audit trail).

| Category | Competitive density | Creator share | Treasury share | Reasoning |
|---|---|---|---|---|
| **Differentiated specialty** (legal, security audit, complex consensus) | Low — few qualified creators | 90% | 10% | The creator IS the value; the platform is a delivery rail. |
| **Commoditised** (marketing review, content edits, summarisation) | High — many creators competing | 70% | 30% | The platform's catalog + discovery is the value-add; per-creator differentiation is small. |
| **Trust-critical infrastructure** (audit-as-a-service for receipts, key rotation review) | Moderate — requires brand vetting | 80% | 20% | Mid-rate; creator earns differentiated price, treasury covers vetting overhead. |
| **Free / loss-leader** (onboarding, tutorial walkthroughs) | n/a | 50% | 50% | No-cost surface to attract creators; treasury covers infra. |

## Two examples shipped today

`seed-skills/private-doc-review/SKILL.md:44-50`:

```yaml
creator:
  passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
  fee_split:
    creator: 9000     # 90%
    treasury: 1000    # 10%
```

The legal-review specialty: low density, high differentiation, creator earns 90%.

`seed-skills/content-pitch-review/SKILL.md:44-50`:

```yaml
creator:
  passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
  # Track 3 marketing-persona surface. Lower creator share than
  # private-doc-review (which is the legal-persona killer demo) because
  # marketing-review skills are commoditised and we want the field
  # competition to set price discovery on this one.
  fee_split:
    creator: 7000     # 70%
    treasury: 3000    # 30%
```

The marketing-review surface: high density (every agency offers content review), commoditised, creator earns 70%. Skill creators in the same category know upfront that the floor is 70% and price accordingly.

## How quality multipliers will combine (queued · §A.4.4)

When zer0Gig's Efficiency Game lands (planning-003 §A.4.4):

```
TIER 1 + first-attempt    → multiplier 1.00
TIER 1 + retry             → multiplier 0.85
TIER 2 (external provider) → multiplier 0.70
Failed run (no payout)     → multiplier 0.00
```

Combined with per-skill base rate:

| Skill | TIER 1 first-attempt | TIER 1 retry | TIER 2 | Failed |
|---|---|---|---|---|
| `private-doc-review` (90/10) | 90.0% | 76.5% | 63.0% | 0% |
| `0g-integration-auditor` (90/10) | 90.0% | 76.5% | 63.0% | 0% |
| `content-pitch-review` (70/30) | 70.0% | 59.5% | 49.0% | 0% |

The multiplier is recorded on the receipt's `outcome` block; the chip on `/r/<id>` reads `EFFICIENCY 90% (1.0×)` or `EFFICIENCY 76% (0.85×, 1 retry)`. Honest pricing visible to every party.

## Why competitors don't have this

- **AgentPay** ships generic agent-to-agent payment infrastructure. No per-skill or per-run economic policy.
- **Trapezohe Ghast** is a static plugin registry — no payment layer at all.
- **zer0Gig** ships per-run quality conditioning (Efficiency Game) but not per-skill base rates.
- **Agentra** acknowledges "permissionless infrastructure to monetize AI agents on-chain" but is "Under Development · Not production-ready."

The combination (per-skill × per-run) is unique to Ivaronix. It's what `seed-skills/content-pitch-review/SKILL.md` already encodes; once the multiplier ships, the marketplace has dimensional pricing nobody else offers.

## How creators set their rate

For new skills published via Path 3 (`SkillRegistry.publish()` per `docs/SKILL_PUBLISHING.md`), the creator chooses a base split from the four discrete rates above. Free-form rates are NOT supported in V1 — discrete categories give judges + users a quick-glance trust signal ("this is a 70/30 commoditised category").

The Studio `/skill/new` form will surface the choice as a dropdown:

```
Category (select one):
○ Differentiated specialty   90/10
○ Trust-critical infra       80/20
○ Commoditised               70/30   (default for first-time creators)
○ Free / loss-leader         50/50
```

Default: 70/30 commoditised. Creators must explicitly opt into 90/10 or 80/20 by selecting a higher-trust category. The dropdown is wired to the schema's enum so the option set tracks `MARKETPLACE_DESIGN.md` automatically (planning-003 §A.1.1 + §A.1.6 pattern).

## Treasury allocation

The treasury share routes to the operator wallet today. Future plan: a `TreasuryVault.sol` contract that splits the treasury share into:
- 50% protocol operations (Vercel, Sentry, Upstash, RPC fees)
- 30% creator-fund pool (grants for high-quality early creators)
- 20% audit + security retainer (ChainGPT or equivalent)

That allocation is a Track 3 follow-up, captured in `docs/USER_TODO.md` (queued for post-mainnet).

## Render in `/skills` Studio surface

The skill catalog page renders the per-skill rate next to each skill:

```
private-doc-review     · 90/10 · TIER 1
content-pitch-review   · 70/30 · TIER 1
0g-integration-auditor · 90/10 · TIER 1
github-audit           · 90/10 · TIER 1
plan-step              · 90/10 · TIER 1
code-edit              · 90/10 · TIER 1
```

The chip is the first thing a creator browsing the marketplace sees. Sorting by rate is supported. Future filter: `--rate ≥ 80` to show only differentiated-specialty skills.

## Why this is honest

Every skill manifest carries the rate explicitly. No hidden fees, no platform-take adjusted at runtime, no "we'll figure out fees later" framing. The rate is the contract between creator, platform, and user. The rate ships in the receipt. The receipt anchors on chain. The chain is the audit trail.

This is what receipt-gated fee splits MEAN. Other marketplaces talk about fee splits; Ivaronix encodes them in immutable, on-chain, per-skill manifests.
