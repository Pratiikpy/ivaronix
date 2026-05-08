# Mainnet Readiness Test Report

> Run date: 2026-05-08 · Tester: automated playwright + CLI sweep · Network: 0G Galileo Testnet (16602)

## Mainnet-gate scoring (8 items)

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Private doc flow works end to end | ✅ PASS | Receipt #153 on chain, tx `0x94029e7e...`, Outputs match |
| 2 | CLI flow works end to end | ✅ PASS | doctor / upload-probe / model preflight / openclaw verify / skill fee-split / doc ask / receipt show / receipt verify --tee-independent — all green |
| 3 | Receipts anchor correctly | ✅ PASS | 153 receipts on chain, latest is doc_ask with feeSplit + evidenceRoot populated |
| 4 | Proof Explorer verifies correctly | ✅ PASS | /r/153 renders all rows; receipt verify --tee-independent → FULLY VERIFIED |
| 5 | Memory permissions are respected | ✅ PASS | /memory wallet-gates as expected; scope kind toggle (namespace/skill) works |
| 6 | Burn mode really burns the key | ✅ PASS | Doc ask log: "session key destroyed at 2026-05-08T..."; receipt's burn block records sessionKeyDestroyedAt + tempPathsZeroed + wording |
| 7 | Errors are clear and recoverable | ✅ PASS | MISMATCH detected on stale-hash skill → republish CTA; doc ask aborts cleanly with diagnostic; --upload-probe failures fall back to sha256 |
| 8 | No secret leaks in UI/CLI/logs | ✅ PASS | Sweep on receipts JSON, dev server log, and / HTML — no `EVM_PRIVATE_KEY` / `ZG_API_SECRET` / `nvapi-` substrings; only public hashes + tx ids visible |

## Bugs found and fixed during this run

| # | Bug | Status |
|---|-----|--------|
| B1 | doc.ts didn't populate `billing.feeSplit` from skill manifest | ✅ Fixed — same allocateFeeSplit() helper as runtime/pipeline.ts |
| B2 | doc.ts didn't upload evidence to 0G Storage; `storage.evidenceRoot` was missing | ✅ Fixed — uploads via createStorageClient before buildReceipt |
| B3 | Adding fee_split to private-doc-review changed canonical hash → MISMATCH on every run | ✅ Fixed — bumped to 0.3.0 + republished (tx 0xe020fa1b...) |
| B4 | /skill/[id] page had horizontal scrollbar at 1440 viewport | ✅ Fixed — `minmax(0, ...)` grid template + word-break on .mono |
| B5 | Mobile header had no nav links (only Connect wallet button) | ✅ Fixed — relaxed `display: none` to a tighter gap+font on mobile |
| B6 | Studio fonts were system sans + Times New Roman (vs HTML reference's Outfit + Instrument Serif) | ✅ Fixed — next/font/google with Outfit + Instrument Serif + JetBrains Mono |
| B7 | Card radii were 4–8px (vs HTML reference's 14–16px) | ✅ Fixed — bumped --radius-* tokens, button radii now pill (999px) |
| B8 | Foreground was `#1a1a1a` instead of HTML reference's `#0a0a0a` | ✅ Fixed — token swap in globals.css |
| B9 | Cards had only box-shadow on hover, no lift | ✅ Fixed — translateY(-2px) + larger shadow + border-color tint |
| B10 | Home hero was single-column with empty visual density | ✅ Fixed — 2-col grid with eyebrow + headline + stat row + RunPanel preview + "BUILT ON FULL OG STACK" band |

## Visual contract — Ivaronix.html parity

CLAUDE.md §10 was added before this test pass: "the HTML file is the canonical brand spec." After the rebuild the Studio matches the reference on every non-negotiable:

- ✅ Cream `#faf9f6` background, ink `#0a0a0a` foreground
- ✅ Outfit (sans), Instrument Serif (italic), JetBrains Mono (mono)
- ✅ Border radii 14/16/20px on cards; pill buttons (999px)
- ✅ Hero density: eyebrow + headline + serif italic accent + stat row + preview card
- ✅ Sticky 64px backdrop-blur header
- ✅ "BUILT ON THE *full* OG STACK" band with all 6 primitives
- ✅ Hover micro-interaction: translateY(-2px) + border tint
- ✅ Pulsing green "Live" status pill
- ✅ Section eyebrows (`§ 01 · …`) consistently styled

Side-by-side screenshots:
- `test-02-html-reference-hero.png` — reference at 1440×900
- `test-15-home-rebuilt-v2.png` — Studio after rebuild
- `test-17-onboard-rebuilt.png` — /onboard with new typography
- `test-18-receipt-153-rebuilt.png` — /r/153 with all new rows + premium typography

## What's still needed before mainnet

The build is feature-complete for testnet. Two human-only blockers remain:

1. **B-2 funding:** deployer wallet `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` needs ~2 OG on mainnet 16661 to deploy 6 contracts.
2. **`@ivaronix/cli` npm publish:** OpenClaw `node` install spec resolves to a package that isn't published yet. Either `pnpm publish` or build a GitHub release tarball at `Pratiikpy/ivaronix/releases/latest/download/ivaronix-cli.tar.gz`.

Neither is testable from inside the agent. Once both are done the same test pass repeats against mainnet 16661 and we ship.

## End-to-end live receipt produced during this test pass

| Field | Value |
|---|---|
| receiptId | rcpt_01KR39ASDQCVSHWGQ3DAH29WTF |
| receiptRoot | `0x5df44c9b5636ff2ccf2e146697d7966e7542f487efea44dfab2bd297de5ab679` |
| anchor tx | `0x94029e7e45574166e00d3376170cdd77426e77fa711c811c20bd0d8f664d14d8` |
| storage (evidence) root | `0x898e5e39e8df46b10a4d9a21f34980fcd75ee4f5ac6ec211d1026d3ba8c12916` |
| skill | `private-doc-review@0.3.0` |
| skillManifestHash | `sha256:fa35ff03d104178ced41c1a99856a0162fe1be2968ef51d87382db7e31255bc2` |
| billing.feeSplit | `creator 9000bps (48015000000000 neuron) + treasury 1000bps (5335000000000 neuron)` |
| burn mode | enabled; session key destroyed at 1778226697343 |
| TEE verification (independent) | `FULLY VERIFIED` via broker.processResponse |

This single receipt exercises: skill registry match, hooks, burn mode encryption, 0G Router inference, 0G Storage upload, signature, on-chain anchor, passport reputation update, fee split allocation, and TEE-independent re-verification — every layer Ivaronix promises.

## Verdict

**Green light for testnet ship.** All 8 mainnet-gate items pass. Ten real bugs were found and fixed during the run. The Studio now visually matches `Ivaronix.html` (CLAUDE.md §10 visual contract). The single end-to-end receipt above proves every primitive works together.

**Mainnet:** waiting on user to (1) fund the deployer wallet and (2) authorize the deploy. Repeat this same test pass against mainnet 16661 once the wallet is funded; if all 8 items pass again, flip Studio's `NEXT_PUBLIC_OG_NETWORK` to `mainnet`.
