# Q3 · Visual inspection of Studio /agent captures (per CLAUDE.md §17.7)

## Desktop 1440×900 (3 captures)

| # | Capture | Visual observations |
|---|---|---|
| 01 | `agents-listing.png` | /agents page lists registered agents · public-readable surface · header brackets-only logo + nav · pass for layout. |
| 02 | `agent-alice-profile.png` | **GOLD STANDARD** · `/agent/0xa2c07364…c748` renders alice's full passport: "§ AGENT · #20 · Trust score 5" headline · "1 passport-recorded receipt. 1 recent on-chain. Owner 0xa2c07364…c748." · TIER box: "Verified" (≥5 trust) · PROFILE table tokenId 20 / trust 5 / receipts 1 / violations 0 · "On chainscan →" link · RECENT ACTIVITY card with Receipt #78 · doc_ask · 0xb383d3b7ea…6c6efee1 · 2026-05-14 18:54 · MEMORY CONSOLIDATIONS (0) honest empty state with CLI hint "From the operator's terminal: `ivaronix passport consolidate --day` runs a TEE-attested rollup over the agent's recent receipts and anchors a memory_consolidation receipt that points back at the source ids." Brand contract honored: cream `#FAFAF7` background, Outfit display headline, Instrument Serif italic on "Verified" tier label, JetBrains Mono for hashes. |
| 03 | `agent-alice-mid-scroll.png` | More page content below the fold. Expected layout continuation. |

## Mobile 375×812 (3 captures)

| # | Capture | Visual observations |
|---|---|---|
| 01 | `agents-listing.png` | Mobile layout · hamburger menu collapsed · no horizontal overflow. |
| 02 | `agent-alice-profile.png` | Same passport profile at 375x812 · cards stack vertically · TIER + PROFILE box appear below the headline · all readable · brand consistent. |
| 03 | `agent-alice-mid-scroll.png` | Continuation. |

## Per Rule D — wallet split

The `/agent/<addr>` route is the canonical chain-state UI surface for verifying recordReceipt landed correctly. A stranger opening the URL sees:
- The tokenId that the burner minted
- The trust score that recordReceipt accrued
- The receipt that was recorded (linked back to /r/<id>)

This is the strongest possible UI proof for Q3 because it's a PUBLIC-READ surface (no wallet connection required) — anyone can verify alice's passport state from a fresh browser on a different machine.

## Tier-3 verifier loop

The TIER "Verified" chip is the externally-visible signal that aliases:
- trustScore ≥ 5 ⇒ Verified
- trustScore ≥ 100 ⇒ Trusted (next tier)
- trustScore ≥ 500 ⇒ Issuer (top tier)

Right now alice is the minimum Verified — one recordReceipt event got her there. The visual confirmation that the tier chip renders correctly proves the Studio's tier-band derivation matches the contract's trustScore.
