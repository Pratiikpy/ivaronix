# Changelog

All notable changes to Ivaronix are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 — 2026-05-15 · Mainnet launch

Ivaronix ships on 0G Aristotle mainnet (chainId 16661).

### Added

- 10 contracts deployed on Aristotle: `ReceiptRegistryV3`, `ReceiptRegistryV2`, `AgentPassportINFTV2`, `Erc7857Verifier`, `CapabilityRegistryV2`, `MemoryAccessLogV2`, `SkillRegistryV2`, `SkillPricing`, `SkillRunPayment`, `SubscriptionEscrowV2`. Total gas spend ~0.085 OG.
- 22 receipts anchored on mainnet `ReceiptRegistryV3` across all 13 receipt-type slots.
- 5 first-party legal skills published on mainnet `SkillRegistryV2`: `private-doc-review`, `nda-triage-reviewer`, `contract-renewal-clause-detector`, `legal-citation-verifier`, `term-sheet-risk-scanner`.
- TEE attestation re-verification on mainnet via `broker.processResponse` proven against the live 0G Compute provider.
- 0G Storage upload proven on mainnet receipts.
- 3-wallet marketplace flow proven on mainnet: creator publish, buyer paid run, treasury withdraw across 6 transactions with 90/10 fee split.
- 2-wallet flows proven on mainnet: memory grant/revoke and passport mint.

### Changed

- Studio reads `IVARONIX_NETWORK=mainnet` and switches RPC + contract addresses accordingly. Legacy `OG_NETWORK` alias still resolves.
- The `live` site at `https://www.ivaronix.xyz` points at mainnet by default.

## 0.5.0 — 2026-05-13 · Marketplace economics

Receipt-gated payments and per-skill fee splits.

### Added

- `SkillRunPayment` contract: per-skill creator/treasury fee split with pull-pattern withdrawals, lifetime accumulators, and admin refund gated by a 24h timelock. 41 Foundry tests, 2 invariants, 3 fuzz suites.
- `SkillPricing` contract: mutable per-skill pricing (`priceWei` plus creator/treasury bps) gated by `SkillRegistryV2.ownerOf(skillId)`. 14 Foundry tests.
- Studio `/api/run` payment-aware flow: 402 response with payment requirement, MetaMask confirm, then receipt anchoring.
- CLI payment integration: `ivaronix demo`, `ivaronix run`, and `ivaronix receipt show` all surface payment metadata.
- Studio marketplace routes: `/marketplace`, `/marketplace/[skillId]`, `/marketplace/new`, `/marketplace/payouts`, `/admin/treasury`.
- Goldsky subgraph indexing for `SkillRunPayment` events.
- IETF Agent Audit Trail export: `ivaronix receipt verify <id> --format aat` produces JSON pinned to `draft-rosenberg-aat-01`.

## 0.4.0 — 2026-05-12 · V3 receipt registry + remaining V2 lockdowns

Closes the receipt-type capacity gap and ships the last V2 contracts.

### Added

- `ReceiptRegistryV3` admits three new receipt-type slots: `doc_room_create` (10), `doc_room_read` (11), `memory_consolidation` (12). V2 capped at slot 9. EIP-712 version bumped to `"3"` so V2 signatures cannot replay.
- `CapabilityRegistryV2`: private reverse indexes close a social-graph leak; an `authorizedRelayers` gate on `consumeRead` closes a DoS surface.
- `MemoryAccessLogV2`: `logAccess` requires either `msg.sender == agent` (self-log) or a `CapabilityRegistryV2.isValid` cross-check (grant-backed). Random wallets revert.
- `SkillRegistryV2`: constructor pre-reserves 6 first-party skill IDs to the deployer wallet, closing skill-name squatting. Owner arbitration lets the contract owner reassign squatter-grabbed unreserved skillIds.
- `SubscriptionEscrowV2`: `cancelGraceSeconds` window between agent-initiated cancel and `EXPIRED` status closes an `AGENT_AUTO` griefing surface.

### Changed

- Studio chain reads now use the V3-first → V2 → V1 fallback walk for receipts and the V2-first → V1 fallback for passports, capabilities, memory log, and skill registry.

## 0.3.0 — 2026-05-10 · V2 contracts — threat-model lockdowns

Six security findings closed by deploying new V2 contracts. V1 stays live for legacy state.

### Added

- `ReceiptRegistryV2`: EIP-712 anchor signature recovery. `agentAddress` is the recovered signer, not `msg.sender`. Per-agent monotonic nonces block replay.
- `AgentPassportINFTV2`: `authorizedRecorders`-only with a cross-check against `ReceiptRegistryV2`. `trustScoreDelta` capped at `[-100, +100]` per call. Per-token `executorVersion` bumps on transfer.

### Fixed

- **Memory-at-rest nonce derivation flaw.** Prior implementation used `sha256(plaintext || Date.now())` truncated to 12 bytes, which produced nonce reuse for same-plaintext-same-millisecond pairs. Now `randomBytes(12)` per RFC 5116. Regression suite asserts same-plaintext-same-key yields different ciphertexts.
- **TIER 2 receipts now mark `verificationMethod: 'external-signed'` and render amber on `/r/<id>`.** Prior versions rendered green chips for non-TEE inference.

### Added (polyglot canonical hash)

- TypeScript (`packages/core/src/jcs.ts`), Python (`scripts/verifier-py/jcs.py`), and Rust (`ivaronix-verifier-rs/`) reference verifiers. All three produce byte-identical receipt roots against 29 cross-implementation test vectors. CI gate `.github/workflows/jcs-roundtrip.yml` runs all three on every push.

## 0.2.0 — 2026-05-08 · Studio + CLI on Galileo testnet

First public testnet deploy with a full user-facing surface.

### Added

- 8 contracts on Galileo (chainId 16602): `ReceiptRegistry`, `AgentPassportINFT`, `Erc7857Verifier`, `CapabilityRegistry`, `MemoryAccessLog`, `SkillRegistry`, plus supports.
- Studio Next.js app at `apps/studio/`: home, `/onboard`, `/skills`, `/global`, `/dashboard`, `/memory`, `/r/<id>`, `/agent/<addr>`.
- CLI `ivaronix` binary: `demo`, `doc ask`, `receipt verify`, `receipt show`, `memory`, `skill`, `passport`, `room`, `doctor`.
- 10 first-party skills under `seed-skills/`: legal-domain specialists (private-doc-review, nda-triage-reviewer, term-sheet-risk-scanner, contract-renewal-clause-detector, legal-citation-verifier) plus general-purpose (0g-integration-auditor, github-audit, code-edit, plan-step, content-pitch-review).
- Real MetaMask end-to-end test harness at `scripts/qa/metamask-e2e/` driving the live extension via Playwright.

## Earlier

The pre-0.2 history is preserved in the git log.
