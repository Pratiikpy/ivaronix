# Security policy

> What Ivaronix's security posture is, what it isn't, and how to report a vulnerability.

## Reporting a vulnerability

**Open a GitHub issue at <https://github.com/Pratiikpy/ivaronix/issues>** with `[security]` in the title, OR (preferred for any issue involving a wallet, key, or chain write) email the operator listed in the GitHub profile. Do not post exploit details on Twitter or in a PR comment until a fix has shipped.

We aim to respond within 72 hours. Hackathon-stage caveats apply: there is no formal SLA, no bounty program, and the project relies on the operator's personal time for triage.

## What the receipt system defends against

Threats Ivaronix's design actively addresses (with the file paths to read):

- **Operator-side disclosure of plaintext after a Burn-Mode run.** The session key is destroyed before the response returns; the ciphertext is unreadable to the operator after that. See `packages/og-storage/src/burn.ts:13-14` (canonical threat-model JSDoc).
- **Forged signer claims on receipt anchors.** `ReceiptRegistryV2` recovers `agentAddress` from an EIP-712 typed-data signature; the relayer is `msg.sender` but cannot attribute receipts to a wallet that didn't sign. Per-agent monotonic nonces prevent replay. See `contracts/src/ReceiptRegistryV2.sol`.
- **Tampered receipt content.** Every receipt's `receiptRoot` is `keccak256(canonical-json-without-signature)`; the canonical hash is byte-equal across TS / Python / Rust reference implementations (29/29 cross-vector CI gate). See `docs/HASH_FUNCTION.md` + `.github/workflows/jcs-roundtrip.yml`.
- **Memory-grant log spoofing.** `MemoryAccessLogV2` enforces `msg.sender == agent` for self-logs and cross-checks `IGrantViewV2.isValid()` for grant-backed logs. V1 was vulnerable; V2 ships the fix. See `contracts/src/MemoryAccessLogV2.sol`.
- **Skill-name squatter risk.** `SkillRegistryV2` reserves first-party skill names at construction time + ships an `arbitrateOwnership` safety valve. See `contracts/src/SkillRegistryV2.sol`.
- **Subscription billing without delivery.** `SubscriptionEscrowV2` requires a real `attestationReceiptId` whose timestamp is fresh (within `MAX_RECEIPT_AGE = 86400`) and whose `agentAddress` matches the expected agent. No receipt → no charge. See `contracts/src/SubscriptionEscrowV2.sol`.
- **Accidental private-key paste in doc-review input.** The pre-flight gate exact-matches against `IVARONIX_SIGNER_KEY` (zero false positives) and falls back to a context-aware heuristic for read-only flows. See `packages/consensus/src/gates.ts` (planning-003 §A.5.15 fix).
- **Cross-wallet sandbox escapes.** `/api/skill/save` is per-wallet, SIWE-gated, and validates manifest hook references for shell-injection patterns before write. See `apps/studio/src/app/api/skill/save/route.ts`.

## What the system does NOT defend against

These boundaries are documented honestly. If you need protection against any of them, the receipt model is not the right tool:

- **Local-machine compromise.** Burn Mode protects against operator-side disclosure after the run. It does NOT protect plaintext extraction during the run window — the session key is in process memory until destroyed. Same for any signer key on disk.
- **Operator log harvesting.** The Studio process can log every read it serves; receipts attest to inference output, not to read patterns at the storage layer. The read-proxy key (`IVARONIX_READ_PROXY_KEY`) reduces the leak vector at the indexer layer but does not eliminate operator-side observability. See `docs/PRIVACY_NOTES.md` §1.
- **Side-channels.** Request size, response timing, and traffic volume can re-identify a read pattern even when the signer is anonymized.
- **TIER 2 provider trust.** Receipts run on NVIDIA NIM / OpenAI / Ollama are signed and chain-anchored but the inference itself runs outside a TEE. The provider sees the plaintext. Receipts are tagged `verificationMethod: 'external-signed'` and rendered in amber so a reviewer can tell at a glance. See CLAUDE.md §6.
- **Receipt body content disclosure.** A receipt's `body.outputs` is part of the canonical hash and lives publicly in 0G Storage. If a model summarises a private contract into the headline field, the headline is public. Redact at the `pre_consensus` / `post_consensus` hook layer if this matters. See `packages/skills/src/hooks/`.
- **Trust in the third-party Router proxy.** `compute-network-X.integratenetwork.work` is NOT operated by 0G Foundation — it relays requests to 0G Compute providers. The Router operator sees every request body before it reaches a TEE. The TEE attestation re-verify (`broker.processResponse` against the actual provider) is the only path that closes this gap; the `--tee-independent` CLI flag runs that check. See `.claude/rules/og-router.md`.

## Non-security operator boundaries

These aren't security threats but are worth naming so users have correct expectations:

- **Receipt anchoring requires gas.** A receipt that didn't anchor is unfindable on chain. The operator pays the gas; the user authorises it. Mainnet redeploy + funded ops wallet are gating items in `docs/USER_TODO.md §B-V2`.
- **0G DA integration is roadmap.** `packages/og-da/` ships the gRPC client + the `docker-compose.yml` for a local disperser, but no public testnet endpoint exists. See `docs/PHASE_B_DISCLOSURES.md`.
- **Mobile WalletConnect path is queued.** Studio currently supports MetaMask only (per CLAUDE.md §10 wallet-flow rule). `apps/studio/src/lib/wagmi.ts` documents the upgrade path.

## See also

- `docs/PRIVACY_NOTES.md` — operator-as-proxy threat model + read-proxy key wire-up
- `docs/CRYPTO_NOTES.md` — broader cryptographic primitive choices
- `BRAND.md` — separate trademark license; the LICENSE file's MIT grant covers code, not brand
- `docs/USER_TODO.md §B-V2` — operator-action mainnet readiness items
- `CLAUDE.md §6` — TIER 1 vs TIER 2 honesty rule (no green chip for non-TEE receipts)
- `CLAUDE.md §11` — end-to-end testing rule (real MetaMask, real chain, real proof)
