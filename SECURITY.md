# Security Policy

## Reporting a vulnerability

**Do not file public GitHub issues for security problems.** A public issue
tells attackers about a vulnerability before users can patch.

Use one of these instead:

1. **GitHub Private Vulnerability Reporting.** Go to the [Security tab](https://github.com/Pratiikpy/ivaronix/security)
   on this repo and click **Report a vulnerability**. This opens a private
   advisory only the maintainers can see.
2. **Email** `pratiik@ivaronix.xyz` for issues touching wallet keys, signer
   compromise, or anything you'd want fixed before public disclosure.

We acknowledge within 72 hours and aim to ship a fix within 30 days for
high-severity issues. We do not run a paid bounty program, but researchers
acting in good faith are credited in the release notes.

## What the receipt system defends against

Every claim below is enforced in code. Source paths are in the `## Source map`
section at the bottom.

- **Operator-side disclosure after a Burn-Mode run.** The session key is
  generated, used to encrypt, then zeroed in memory before the receipt is
  written. The ciphertext on 0G Storage is unrecoverable after that — even
  by the operator.
- **Forged signer claims on receipt anchors.** `ReceiptRegistryV3` recovers
  the agent address from an EIP-712 signature. The relayer is `msg.sender`
  and cannot attribute receipts to a wallet that did not sign. Per-agent
  monotonic nonces block replay.
- **Tampered receipt content.** `receiptRoot` is `keccak256` of the canonical
  JSON (RFC-8785) with the signature, id, and chain anchor stripped. Three
  reference implementations (TypeScript, Python, Rust) produce byte-equal
  hashes against 29 cross-language vectors on every PR.
- **Memory-grant log spoofing.** `MemoryAccessLogV2` requires `msg.sender`
  to be the agent for self-logs and cross-checks `IGrantViewV2.isValid()`
  for grant-backed logs.
- **Skill-name squatting.** `SkillRegistryV2` reserves first-party skill
  names at construction time and exposes an `arbitrateOwnership` safety
  valve.
- **Subscription billing without delivery.** `SubscriptionEscrowV2`
  requires a fresh `attestationReceiptId` (within `MAX_RECEIPT_AGE = 86400`
  seconds) whose `agentAddress` matches the expected agent. No receipt,
  no charge.
- **Private-key paste in document input.** The pre-flight gate exact-matches
  against `IVARONIX_SIGNER_KEY` and falls back to a context-aware heuristic
  for read-only flows.
- **Cross-wallet sandbox escape.** `/api/skill/save` is per-wallet,
  SIWE-gated, and validates manifest hook references for shell-injection
  patterns before write.

## What the system does not defend against

These boundaries are documented honestly. If your threat model needs any
of these, the receipt system is not the right tool by itself:

- **Local-machine compromise.** Burn Mode protects against operator-side
  disclosure after the run. It does not protect plaintext during the run
  window — the session key sits in process memory until destruction. Same
  applies to any signer key on disk.
- **Operator log harvesting.** The Studio process can log every read it
  serves. Receipts attest to inference output, not to read patterns at the
  storage layer. The read-proxy key reduces but does not eliminate
  operator-side observability.
- **Side-channels.** Request size, response timing, and traffic volume can
  re-identify a read pattern even when the signer is anonymous.
- **TIER 2 provider trust.** Receipts produced on NVIDIA NIM, OpenAI, or
  Ollama are signed and chain-anchored, but the inference itself runs
  outside a TEE. The provider sees the plaintext. The receipt body tags
  these `verificationMethod: 'external-signed'` and the proof page
  renders them in amber, not green.
- **Receipt body content disclosure.** The receipt body lives publicly on
  0G Storage. If a model summarises a private contract into the `outputs`
  field, that summary is public. Redact at the `pre_consensus` or
  `post_consensus` hook layer if this matters.
- **Trust in the third-party Router proxy.** The Router endpoint
  (`compute-network-X.integratenetwork.work`) is not operated by 0G
  Foundation. It relays requests to 0G Compute providers and sees every
  request body before the TEE does. The `--tee-independent` CLI flag
  closes this gap by re-running `broker.processResponse` against the
  actual provider; the Router cannot forge that result.

## Operator notes (not security threats, but worth naming)

- **Anchoring costs gas.** A receipt that did not anchor is unfindable on
  chain. The operator pays the gas; the user authorises it.
- **0G DA integration is on the roadmap.** The gRPC client and a local
  disperser via Docker Compose are shipped. There is no public testnet
  endpoint yet.
- **Mobile WalletConnect is queued.** Studio supports MetaMask today.

## Source map

| Claim | Source |
|---|---|
| Burn Mode key destruction | `packages/og-storage/src/burn.ts` |
| EIP-712 anchor + nonces | `contracts/src/ReceiptRegistryV3.sol` |
| Polyglot canonical hash | `docs/HASH_FUNCTION.md` · `.github/workflows/jcs-roundtrip.yml` |
| Memory-grant cross-check | `contracts/src/MemoryAccessLogV2.sol` |
| Skill-name reservation | `contracts/src/SkillRegistryV2.sol` |
| Subscription billing gate | `contracts/src/SubscriptionEscrowV2.sol` |
| Private-key paste gate | `packages/consensus/src/gates.ts` |
| Sandbox manifest validation | `apps/studio/src/app/api/skill/save/route.ts` |
| Read-proxy threat model | `docs/PRIVACY_NOTES.md` |
| Crypto primitive choices | `docs/CRYPTO_NOTES.md` |
| TIER 1 / TIER 2 disclosure | [README.md](README.md#tier-1--tier-2) · `docs/PRIVACY_NOTES.md` |
