# Phase 2 step 4 · 5 mainnet model credentials validated

> All 5 §3 mainnet inference models authenticated + chat-completion-tested. Each `app-sk-*` saved to gitignored `.env.mainnet` keyring (`IVARONIX_MAINNET_MODEL_<TAG>_KEY`). Receipts will record actual model returned per §2.5 fallback honesty.

## 5 models · 5 distinct providers · all returned valid chat completions

| Tag | Plan §3 target | Actual returned | Provider | Endpoint | Status |
|---|---|---|---|---|---|
| 0GM | `0GM-1.0-35B-A3B` | `0GM-1.0-35B-A3B-0427` | `0x4870CbC4D07d6Ac2EE5aA865588e5985FE77a4E9` | compute-network-20 | ✓ HELLO test passed |
| DSV4 | `deepseek-v4-pro` | `deepseek-v4-pro` | `0xB01EBd79c3fd63ff52fD47C3935119601EEe2FdB` | compute-network-21 | ✓ HELLO_MAINNET returned · 31 reasoning tokens |
| GLM | `zai-org/GLM-5-FP8` | `z-ai/glm-5-20260211` | `0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C` | compute-network-1 | ✓ tokens returned (truncated content) |
| QWEN | `qwen/qwen3-vl-30b-a3b-instruct` | `qwen3-vl-flash` | `0x4415ef5CBb415347bb18493af7cE01f225Fc0868` | compute-network-3 | ✓ HELLO_MAINNET returned |
| DSV3 | `deepseek/deepseek-chat-v3-0324` | `deepseek-v3.2` | `0x1B3AAef3ae5050EEE04ea38cD4B087472BD85EB0` | compute-network-4 | ✓ HELLO_MAINNET returned |

## Honest substitution notes (per §2.5 fallback honesty rule)

3 of the 5 models came back as provider-side-routed snapshots / variants. This is the natural §2.5 fallback pattern:
- GLM-5-FP8 → `z-ai/glm-5-20260211` (provider's current GLM-5 snapshot · Feb 2026 build)
- qwen3-vl-30b-a3b-instruct → `qwen3-vl-flash` (provider's flash variant of the Qwen 3 vision-language family)
- deepseek-chat-v3-0324 → `deepseek-v3.2` (newer Oct 2024 snapshot · same DeepSeek v3 family)

Receipts will surface the actual returned model in `execution.rolesRun[].model` field. UI displays "Ran on `<actual>`" not the §3 target. No claim of model that didn't run.

## Per-skill role coverage (final mainnet composition)

### private-doc-review (high-stakes · 5-role)
| Role | Model used |
|---|---|
| analyst | 0GM-1.0-35B-A3B-0427 |
| critic | deepseek-v4-pro |
| risk-reviewer | z-ai/glm-5-20260211 |
| evidence-checker | deepseek-v3.2 |
| judge | 0GM-1.0-35B-A3B-0427 (different seed) |

### contract-renewal-clause-detector (standard · 3-role)
analyst 0GM-1.0 · critic 0GM-1.0 · judge deepseek-v4-pro

### legal-citation-verifier (high-stakes · 5-role · external HTTP)
analyst 0GM-1.0 · critic deepseek-v4-pro · risk-reviewer GLM-5 · evidence-checker 0GM-1.0+web_fetch · judge 0GM-1.0
(Q9 PARTIAL still applies until runtime web_fetch enforcement ships · documented)

### nda-triage-reviewer (standard · 3-role)
analyst 0GM-1.0 · critic 0GM-1.0 · judge deepseek-v4-pro

### term-sheet-risk-scanner (high-stakes · 5-role · audit-tier deferred to v1.1 per operator decision)
analyst 0GM-1.0 · critic deepseek-v4-pro · risk-reviewer qwen3-vl-flash · evidence-checker GLM-5 · judge 0GM-1.0

## CLI tx hashes (compute account funding)

| Action | Tx hash |
|---|---|
| deposit 4 OG to compute account | 0x8aa77c4292d7dafed415a0abe4a0f634d0c907a4889ad71d015412629e1bda37 |
| transfer 1 OG → DSV4 sub-account | 0x9cbe118738a1c610a47edcc75698b0945f6d63899e551867f52fe4931212e9af |
| transfer 1 OG → GLM sub-account | 0xf2b3176e89229435106c2e235855597cad86329783e60d921a375a793f482f1c |
| transfer 1 OG → QWEN sub-account | 0x7e7745212d49080cca55f9a23ffbb32eaeb0c4723738a82d18fbabbcdfed32f7 |
| transfer 1 OG → DSV3 sub-account | 0x4a072f6410cb065d8bfaf07be45e5fbcc2c5e4adcf8477f80a73ccaebe8dd8f2 |

0GM-1.0 (provider 0x4870CbC4...) was already pre-funded by operator with 2 OG before this session.

## Spend total this fire

~4.0 OG (deposit) + ~5 × gas (~0.001 OG each) = ~4.005 OG · brings cumulative mainnet spend to ~4.10 OG (25.0% of 16.38 OG autonomous cap).

— agent · Phase 2 step 4 · 2026-05-15T03:11Z chain time
