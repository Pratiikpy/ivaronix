# Ivaronix · Quality philosophy

> Evergreen doc. The verbatim user voice on what "ship it" means lives in `docs/QA_LOOP_BRIEF.md` (the contract). This doc is the philosophy distilled from that contract — what stays true regardless of which sprint, which contractor, which feature is on the table. Closes planning-003 §A.5.4 (the QUALITY-vs-QA_MISSION split).

## 1. Receipts > rhetoric

Every shipped feature ends in an artefact a judge can replay on a different machine. The artefact is one of:

- **A receipt URL** — `https://ivaronix.app/r/<id>` resolves to a public proof page rendered from chain + storage, not from a database we control.
- **A tx hash on chainscan** — `https://chainscan-galileo.0g.ai/tx/<hash>` (testnet) or `https://chainscan.0g.ai/tx/<hash>` (mainnet) shows the on-chain side effect.
- **A command output** — `pnpm <smoke> 2>&1` lands a deterministic transcript in `screenshots/` or `docs/numbers.json`.
- **A screenshot or short video** — captured at every meaningful state transition, not only the final result.

If a feature is "done" but produces none of these, it is not done. The whole point of receipts is that they outlive the run, the contractor, the sprint.

## 2. Brutal honesty over flattering claims

The product is built around an honest answer to "did this actually work, end-to-end, and where exactly are the cracks?" That answer is recorded in three places, all linked from the README:

- **`docs/HALF_BAKED.md`** — open audit ledger. Every issue is a row with status, fix path, owner.
- **`CHANGELOG.md`** — closed-audit ledger. Every fix carries a `Closes audit <ID>` commit trailer.
- **`docs/USER_TODO.md`** — operator-action gates that need real-world resources (mainnet OG, BotFather token, Vercel domain).

A feature with a row in HALF_BAKED.md and no row in CHANGELOG.md is honest about being unfinished. That's the right state to be in until the proof lands. The wrong state is silence — claims with no audit row, demos with no replay path, "verified" without a `tx_hash`.

## 3. The CLI is the gold standard

The CLI runs one command, produces one receipt, costs nothing for the user to verify. Every Studio surface should clear that bar — if a flow takes more than one click for the user to see a verifiable result, redesign it.

This is why the home Run panel collapses to a single Run button after file-drop, why `/r/<id>` opens straight from clicking the receipt link, and why every CLI command has a Studio counterpart with the same proof shape. Drift between CLI and Studio is a quality bug, not a polish item.

## 4. TIER 1 vs TIER 2 — say so

Receipts that ran on 0G Compute inside a TEE and were re-verified via `broker.processResponse` render in green with the TIER 1 chip. Receipts that ran on NVIDIA NIM, OpenAI, or Ollama render in amber with the TIER 2 chip and `verificationMethod: 'external-signed'` written into the body.

Honest > flattering. A green chip on a TIER 2 receipt is a quality bug — the exact kind of thing that erodes trust the moment a judge spots it.

## 5. Drive it like a user, not like a test runner

The strongest available test path is always the right one. For wallet-touching flows: a real MetaMask extension loaded into Playwright via `--load-extension`, real chain writes on Galileo, screenshots of every transition (pre-action → MM popup open → post-confirm → final proof page), video for anything where transition smoothness matters.

Selector-only assertions don't count. Mocked wallets don't count. Connect-only flows don't count. CLAUDE.md §11 is the operational version of this rule; this section is the why.

## 6. Test topology before test runs

Before claiming a feature is end-to-end-verified, name the actors, wallets, roles, permissions, surfaces, chain writes, receipts, state transitions, and failure states the test must cover. A marketplace flow needs a creator wallet AND a buyer wallet AND a treasury wallet — the listing, purchase, payout, protocol fee, receipt, reputation, and UI state all need to be observed.

The smallest test that compiles is rarely the right test. The smallest test that proves the feature works for a real user is.

## 7. Stop condition

A loop terminates only when every shipped feature is one of:

- **verified end-to-end with proof** (screenshot or video, receipt URL, tx hash, command output, or chainscan link),
- **fixed and re-tested** after a regression was found, OR
- **explicitly blocked with a real reason AND a concrete unblock action** (BotFather token, mainnet OG funding, no public testnet endpoint, etc.).

Anything else is "looks like it works," which is not done.

## See also

- **`CLAUDE.md` §1, §6, §8, §11, §12** — the operational rules these principles map to.
- **`docs/QA_LOOP_BRIEF.md`** — the contract version (verbatim user voice).
- **`docs/QA_FULL_PRODUCT_REPORT.md`** — the live product-quality matrix.
- **`docs/HALF_BAKED.md`** — the open-audit ledger.
- **`CHANGELOG.md`** — the closed-audit ledger.
