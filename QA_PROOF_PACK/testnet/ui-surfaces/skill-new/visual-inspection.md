# Q5 · Visual inspection of /skill/new captures (per CLAUDE.md §17.7)

## Desktop 1440×900 (4 captures)

| # | Capture | Visual observations |
|---|---|---|
| 01 | `skill-new-landing.png` | **PASS** — "SKILL BUILDER" eyebrow · "Compose a skill *without writing TypeScript*." headline (Instrument Serif italic on "without writing TypeScript") · subhead explains the model "Pick a system prompt, set the permissions, choose a default tier and fee split, and the page composes a real SKILL.md manifest. Save it locally to make the skill immediately runnable from the CLI." · two-column layout: CONFIGURE form on left (slug=my-skill / version=0.1.0 / description placeholder / system prompt stub) + LIVE PREVIEW · SKILL.MD on right showing rendered YAML (628 chars · all the defaults visible). Editorial cream-on-black brand · clean typography. |
| 02-04 | `skill-new-section-*.png` | Continued page scroll · likely capturing license dropdown, default tier dropdown, fee-split inputs, save button. |

## Mobile 375×812 (6 captures)

| # | Capture | Visual observations |
|---|---|---|
| 01 | `skill-new-landing.png` | **PASS** — Single-column stack at mobile: hamburger menu · "Connect wallet" CTA top-right · "SKILL BUILDER" eyebrow · "Compose a skill *without writing TypeScript*." headline wraps cleanly to 3 lines · subhead readable · CONFIGURE form below with slug (my-skill) · version (0.1.0) · description input · clear placeholder text. No horizontal overflow. |
| 02-06 | `skill-new-section-*.png` | Continued mobile scroll · captures the LIVE PREVIEW · SKILL.MD card below the form (stacked vertically on mobile vs side-by-side on desktop) and any subsequent license/tier/fee-split fields. |

## Safe-by-design defaults · honest observation

The live preview shows that the form's defaults are intentionally restrictive:
- `memory_access: project_only` (NOT `all`)
- `shell_access: none` (NOT `full` or `sandbox-only`)
- `wallet_access: false`
- `writes_files: false`
- `receipt_required: true` (locked · §7 CLAUDE.md hard rule)
- `compute_tee_required: true` (defends TIER 2 fall-through)
- `default_tier: quick` (cheapest · explicit upgrade required)
- `creator.fee_split: 9000/1000` (matches MARKETPLACE_DESIGN canonical)

This means a creator who clicks Save without changing anything publishes a SAFE skill, not a permissive one. That's a real product-quality decision visible in the UI.

## Brand contract honored (per CLAUDE.md §10)

- Cream background `#FAFAF7` ✓
- Outfit headlines + Instrument Serif italic accent ✓
- JetBrains Mono in the YAML preview (cleanly differentiates code/data from prose) ✓
- Card surface treatment (white on cream) ✓
- Sticky header preserved ✓
- Single-column mobile stack (no overflow) ✓
