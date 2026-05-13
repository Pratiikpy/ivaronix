# Daily checkpoint · UI test plan execution

## 2026-05-13 (Day 1)

Test plan: `docs/UI_REAL_USER_TEST_PLAN.md` (PART 1 P0-P16 · PART 2 P17-P19)
Cron: `a5a439aa` firing every minute to re-anchor on the plan + continue.

| Priority | Status | Items pass/total | Blocker / next step |
|---|---|---|---|
| **UI Inventory Gate** | DONE | — | `QA_PROOF_PACK/ui/UI_INVENTORY.md` written · 27 routes mapped |
| **P0 Setup** | IN PROGRESS | 0/9 | Production deploy verify next |
| P1 Landing | NOT STARTED | 0/9 | — |
| P2 Demo | NOT STARTED | 0/7 | — |
| P3 Normal Run | NOT STARTED | 0/13 | — |
| P4 Receipt | NOT STARTED | 0/14 | — |
| P5 Marketplace | NOT STARTED | 0/16 | — |
| P6 Memory | NOT STARTED | 0/9 | — |
| P7 Agent/Passport | NOT STARTED | 0/9 | — |
| P8 Skills | NOT STARTED | 0/6 | — |
| P9 Data Room/Delegate | NOT STARTED | 0/9 | — |
| P10 Docs/0G/Legal | NOT STARTED | 0/6 | — |
| P11 Mobile | NOT STARTED | 0/13 | — |
| P12 Final UI Pass | NOT STARTED | 0/6 | — |
| P13 Cross-tool (CLI light) | NOT STARTED | 0/4 | — |
| P14 Performance | NOT STARTED | 0/6 | — |
| P15 Vercel verify | NOT STARTED | 0/5 | — |
| P16 Data freshness | NOT STARTED | 0/34 | — |
| **PART 2 BELOW** | | | |
| P17 CLI test phase | NOT STARTED | 0/30+ | gated on Part 1 |
| P18 MCP test phase | NOT STARTED | 0/13 | gated on Part 1 |
| P19 Cross-machine | NOT STARTED | 0/9 | gated on Part 1 |

## Rules in effect

- **§16.1 MM popup no-skip** — no compromise, no skip, no "blocked" without 3 strategies tried
- **§17 UI testing no-skip** — real MetaMask, real signing, real chain writes
- **§17.7 visual inspection** — agent reads every screenshot, operator spot-checks before PASS
- **Fail rule** — fail → stop → fix properly → re-test

## Today's intent

Execute P0 Setup against `https://ivaronix.vercel.app` — production verify + cold-load timing + connect MetaMask with operator wallet. Capture screenshots at every state. Move to P1 Landing only after P0 returns PASS.
