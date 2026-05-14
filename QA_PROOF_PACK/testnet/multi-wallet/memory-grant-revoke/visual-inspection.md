# Q2 · Visual inspection of Studio /memory captures (per CLAUDE.md §17.7)

## Desktop 1440×900 (2 captures)

| # | Capture | Visual observations |
|---|---|---|
| 01 | `memory-page-connect-required.png` | **PASS** — Page renders cleanly: "§ 01 · MEMORY · QUICK CAPTURE" eyebrow + "Remember. Recall. Forget." headline + honest body copy "Drop notes scoped to project/work/legal/deals/personal. Stored in your per-wallet sandbox. The CLI's `ivaronix memory` commands give you the same surface with end-to-end encrypted persistence — see the disclosure inside." · Connect-wallet card: "Connect a wallet to use Studio memory. The encrypted MemoryEngine is available via `ivaronix memory remember` on the CLI today." · "§ 02 · MEMORY · PERMISSION CENTER" eyebrow + "Grants. Scopes. Audit." headline + body "Issue, list, and revoke memory grants directly on the on-chain CapabilityRegistry. Reads + writes on testnet." · Second connect-wallet card: "Connect a wallet to issue and revoke memory grants. The connected wallet becomes the grant owner; only it can revoke." · Honest UX — surfaces are gated to the wallet owner per V2's privacy-protected reverse indexes (CapabilityRegistryV2.sol line 12-23 documents this defense). |
| 02 | `memory-page-mid-scroll.png` | Continues the page (more sections below). |

## Mobile 375×812 (2 captures)

| # | Capture | Visual observations |
|---|---|---|
| 01 | `memory-page-connect-required.png` | Same sections render at mobile · no horizontal overflow · hamburger nav collapses correctly. |
| 02 | `memory-page-mid-scroll.png` | Same. |

## UI design read

The `/memory` page is **honestly gated** — anonymous visitors see the capability description but cannot enumerate any wallet's grants. This is correct per the V2 privacy threat model: "Defends against an attacker building a memory-access social graph from public chain reads. Reverse indexes return only to the wallet itself OR an authorized indexer" (CapabilityRegistryV2.sol:25-28). The chain-side proof in tx-hashes.md + cli-cross-check.log already verifies the grant lifecycle independent of any UI surface.

## Per Rule D wallet split

**Burner script (contract-level proof)**: ✓ at `QA_PROOF_PACK/multi-wallet/burner-memory/proof-1778781835807.json` (alice issues grant `0xd89156672fe0…` to bob · isValid=true → revoke tx `0x48ba55a9…` → isValid=false). Chain-side cross-check this fire: 9/9 PASS via `q2-chain-cross-check.ts`.

**Real MM popup smoke**: deferred to mainnet per operator's cron prompt STEP 5. The chain-side burner harness already proves the contract surface; MM popup is the user-facing pixel-level confirmation that lands in mainnet phase.

## Videos captured

- `videos/flow-desktop.webm` · 1440x900 session walking /memory page
- `videos/flow-mobile.webm` · 375x812 session walking /memory page
