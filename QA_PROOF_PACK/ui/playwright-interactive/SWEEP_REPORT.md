# Playwright Interactive Sweep · Report

- Target: https://ivaronix.vercel.app
- Run at: 2026-05-14T10:04:57.949Z
- Total: 46 PASS · 0 FAIL · 0 SKIP
- Receipt URL produced by §E: https://ivaronix.vercel.app/r/52
- Console errors caught: 1

## Per-section
| Section | PASS | FAIL | SKIP |
|---|---|---|---|
| §A | 19 | 0 | 0 |
| §B | 7 | 0 | 0 |
| §C | 4 | 0 | 0 |
| §D | 5 | 0 | 0 |
| §E | 5 | 0 | 0 |
| §F | 3 | 0 | 0 |
| §G | 3 | 0 | 0 |

## Details
| Section | Name | Status | Detail |
|---|---|---|---|
| A | A.1 home / loads | PASS |  |
| A | A.2 header "Why" → /thesis | PASS | landed at https://ivaronix.vercel.app/thesis |
| A | A.2 header "0G" → /0g | PASS | landed at https://ivaronix.vercel.app/0g |
| A | A.2 header "Skills" → /skills | PASS | landed at https://ivaronix.vercel.app/skills |
| A | A.2 header "Agents" → /agents | PASS | landed at https://ivaronix.vercel.app/agents |
| A | A.2 header "Dashboard" → /dashboard | PASS | landed at https://ivaronix.vercel.app/dashboard |
| A | A.3 home module-card grid present | PASS | 18 cards |
| A | A.3 module "Proof Explorer" → /r/ | PASS | landed at https://ivaronix.vercel.app/r/1004 |
| A | A.3 module "Skill Library" → /skills | PASS | landed at https://ivaronix.vercel.app/skills |
| A | A.3 module "FAQ" → /faq | PASS | landed at https://ivaronix.vercel.app/faq |
| A | A.4 landing-loop-card count | PASS | 5 of 5 |
| A | A.4 loop "Run" → /onboard | PASS | https://ivaronix.vercel.app/onboard |
| A | A.5 builder card href="/docs#cli" | PASS | 1 matches |
| A | A.5 builder card href="/docs#sdk" | PASS | 1 matches |
| A | A.5 builder card href="/docs#mcp" | PASS | 1 matches |
| A | A.5 builder card href="/embed/r/1004" | PASS | 1 matches |
| A | A.6 CTA "Try the demo" → /?demo=true | PASS | https://ivaronix.vercel.app/?demo=true |
| A | A.7 CTA "Run on my own doc" → /onboard | PASS | https://ivaronix.vercel.app/onboard |
| A | A.8 final CTA href contains github.com | PASS | https://github.com/Pratiikpy/ivaronix |
| B | B.1 /r/1004 loads | PASS |  |
| B | B.2 verified+ANCHORED+TIER 1 chips render | PASS | chip-verified=1 ANCHORED=1 TIER 1=1 |
| B | B.3 Print link present | PASS | 1 candidates |
| B | B.3 /r/1004/print renders | PASS |  |
| B | B.4 Share/Copy button present | PASS | 1 buttons (no click — system dialog) |
| B | B.5 chainscan tx link present | PASS | first href: https://chainscan-galileo.0g.ai/address/0xaa954c33810029a3eFb0bf755FEF17863E8677Ce |
| B | B.6 registry chainscan link | PASS | total chainscan links: 18 |
| C | C.1 /faq loads | PASS |  |
| C | C.2 <details> count | PASS | 15 found (expected 15) |
| C | C.3 details[0] expands (DOM-toggle fallback) | PASS | open=true via setOpen |
| C | C.3 details[1] expands (DOM-toggle fallback) | PASS | open=true via setOpen |
| D | D.1 /docs loads | PASS |  |
| D | D.2 TOC pill #cli | PASS | https://ivaronix.vercel.app/docs#cli |
| D | D.2 TOC pill #sdk | PASS | https://ivaronix.vercel.app/docs#sdk |
| D | D.2 TOC pill #mcp | PASS | https://ivaronix.vercel.app/docs#mcp |
| D | D.2 TOC pill #embed | PASS | https://ivaronix.vercel.app/docs#embed |
| E | E.1 /?demo=true loads | PASS |  |
| E | E.2 DemoPanel rendered | PASS | eyebrow text count: 2 |
| E | E.3 "Run review" clicked | PASS |  |
| E | E.4 receipt anchored | PASS | rec_52 |
| E | E.5 /r/52 renders verified+ANCHORED chips | PASS | chip-verified=1 ANCHORED=1 TIER1=1 |
| F | F.1 home loads for RunPanel | PASS |  |
| F | F.2 text input/textarea present on home | PASS | 1 candidates |
| F | F.3 input accepts long question string | PASS | typed length=100 expected=100 |
| G | G.1 mobile home loads | PASS |  |
| G | G.2 mobile menu drawer opens on tap | PASS | dialog visible=true |
| G | G.3 /?demo=true mobile renders DemoPanel | PASS | eyebrow: 2 |

## Console errors
- pageerror: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.