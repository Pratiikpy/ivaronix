# Playwright Interactive Sweep · Report

- Target: https://ivaronix.vercel.app
- Run at: 2026-05-14T09:51:47.337Z
- Total: 32 PASS · 13 FAIL · 0 SKIP
- Receipt URL produced by §E: https://ivaronix.vercel.app/r/48
- Console errors caught: 0

## Per-section
| Section | PASS | FAIL | SKIP |
|---|---|---|---|
| §A | 11 | 8 | 0 |
| §B | 6 | 1 | 0 |
| §C | 2 | 2 | 0 |
| §D | 5 | 0 | 0 |
| §E | 4 | 1 | 0 |
| §F | 1 | 1 | 0 |
| §G | 3 | 0 | 0 |

## Details
| Section | Name | Status | Detail |
|---|---|---|---|
| A | A.1 home / loads | PASS |  |
| A | A.2 header "Why" → /thesis | FAIL | landed at https://ivaronix.vercel.app/ |
| A | A.2 header "0G" → /0g | FAIL | landed at https://ivaronix.vercel.app/ |
| A | A.2 header "Skills" → /skills | FAIL | landed at https://ivaronix.vercel.app/ |
| A | A.2 header "Agents" → /agents | PASS | landed at https://ivaronix.vercel.app/agents |
| A | A.2 header "Dashboard" → /dashboard | FAIL | landed at https://ivaronix.vercel.app/ |
| A | A.3 home module-card grid present | PASS | 18 cards |
| A | A.3 module "Proof Explorer" → /r/ | FAIL | landed at https://ivaronix.vercel.app/ |
| A | A.3 module "Skill Library" → /skills | FAIL | landed at https://ivaronix.vercel.app/ |
| A | A.3 module "FAQ" → /faq | PASS | landed at https://ivaronix.vercel.app/faq |
| A | A.4 landing-loop-card count | PASS | 5 of 5 |
| A | A.4 loop "Run" → /onboard | FAIL | https://ivaronix.vercel.app/ |
| A | A.5 builder card href="/docs#cli" | PASS | 1 matches |
| A | A.5 builder card href="/docs#sdk" | PASS | 1 matches |
| A | A.5 builder card href="/docs#mcp" | PASS | 1 matches |
| A | A.5 builder card href="/embed/r/1004" | PASS | 1 matches |
| A | A.6 CTA "Try the demo" → /?demo=true | FAIL | https://ivaronix.vercel.app/ |
| A | A.7 CTA "Run on my own doc" → /onboard | PASS | https://ivaronix.vercel.app/onboard |
| A | A.8 final CTA href contains github.com | PASS | https://github.com/Pratiikpy/ivaronix |
| B | B.1 /r/1004 loads | PASS |  |
| B | B.2 FULLY VERIFIED text present | FAIL | 0 occurrences |
| B | B.3 Print link present | PASS | 1 candidates |
| B | B.3 /r/1004/print renders | PASS |  |
| B | B.4 Share/Copy button present | PASS | 1 buttons (no click — system dialog) |
| B | B.5 chainscan tx link present | PASS | first href: https://chainscan-galileo.0g.ai/address/0xaa954c33810029a3eFb0bf755FEF17863E8677Ce |
| B | B.6 registry chainscan link | PASS | total chainscan links: 18 |
| C | C.1 /faq loads | PASS |  |
| C | C.2 <details> count | PASS | 15 found (expected 15) |
| C | C.3 details[0] expands on click | FAIL | open=false |
| C | C.3 details[1] expands on click | FAIL | open=false |
| D | D.1 /docs loads | PASS |  |
| D | D.2 TOC pill #cli | PASS | https://ivaronix.vercel.app/docs#cli |
| D | D.2 TOC pill #sdk | PASS | https://ivaronix.vercel.app/docs#sdk |
| D | D.2 TOC pill #mcp | PASS | https://ivaronix.vercel.app/docs#mcp |
| D | D.2 TOC pill #embed | PASS | https://ivaronix.vercel.app/docs#embed |
| E | E.1 /?demo=true loads | PASS |  |
| E | E.2 DemoPanel rendered | PASS | eyebrow text count: 2 |
| E | E.3 "Run review" clicked | PASS |  |
| E | E.4 receipt anchored | PASS | rec_48 |
| E | E.5 /r/48 renders + FULLY VERIFIED | FAIL | chip count: 0 |
| F | F.1 /onboard loads | PASS |  |
| F | F.2 text input/textarea present | FAIL | 0 candidates |
| G | G.1 mobile home loads | PASS |  |
| G | G.2 mobile menu opens on tap | PASS | drawer links visible: 7 |
| G | G.3 /?demo=true mobile renders DemoPanel | PASS | eyebrow: 2 |