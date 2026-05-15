# Ivaronix · Pitch

**AI review for the documents you can't paste into ChatGPT.**

A judge can read this in five minutes. Three pages: what Ivaronix is, how the receipt model works, the growth roadmap. Every number is real, every contract address is clickable, every claim has a chainscan link or a CLI command behind it. As of **2026-05-15**, the system is live on both Galileo testnet and Aristotle mainnet.

---

## Page 1 · What · Who · Why now

A deal lawyer reviewing an M&A info memo, a founder reading a vendor's SaaS agreement before signing, a DD analyst combing a confidential data room — they all hold paper they cannot paste into a consumer AI tool. Pasting trains the model. Sharing with the counterparty's tool moves the trust boundary. The privilege defence, the NDA, the regulation — any one of them collapses on a single screenshot or a single discovery subpoena.

The three classes of tool reviewers reach for today each fail in a different layer:

- **Consumer LLM products** (ChatGPT, Claude, Cursor) train on input by default; the provider holds the document; the audit log, if any, is controlled by the same vendor being audited.
- **Vendor data rooms** (Datasite, Intralinks, Dropbox) issue access logs controlled by the same vendor — useful only when the vendor is trusted, and the EU AI Act Article 12 record-keeping mandate ([enforceable 2 August 2026](https://artificialintelligenceact.eu/article/12/)) explicitly demands a record the operator does *not* control.
- **Self-hosted local LLMs** lose the audit trail entirely. The reviewer can prove they ran the model only by running it again, which they can't, because the document is gone.

Ivaronix sits where those three fail. A user drops a document. **Burn Mode** encrypts it with an ephemeral AES-256-GCM session key; the key is destroyed after the run; the receipt records the key fingerprint and the destroyed-at timestamp. **0G Compute** runs the inference inside a TEE-attested enclave. **0G Chain** anchors an Action Receipt that any judge, opposing counsel, or auditor can independently re-verify from any machine via one CLI command — `ivaronix receipt verify <id> --tee-independent` re-invokes `broker.processResponse` against the original 0G Compute provider; if the TEE attestation remains valid, the receipt status flips to `→ FULLY VERIFIED ✓`.

The product is one concrete user flow. Drop a contract. Get an audit. Share a public proof URL. The audit can be re-run on any machine, but the document never leaves the TEE in plaintext.

### The state of the system today

| Metric | Value | Where to look |
|---|---|---|
| **Receipts anchored on chain** | **1,750+** total | <!-- numbers:auto:receipts.total -->1737<!-- /numbers:auto:receipts.total --> testnet + <!-- numbers:auto:mainnet.receiptsAnchored -->22<!-- /numbers:auto:mainnet.receiptsAnchored --> mainnet |
| **Contracts deployed** | **25** | <!-- numbers:auto:contracts.deployed -->15<!-- /numbers:auto:contracts.deployed --> on Galileo testnet · <!-- numbers:auto:mainnet.deployedContractsToday -->10<!-- /numbers:auto:mainnet.deployedContractsToday --> on Aristotle mainnet, deployed **2026-05-15** |
| **First-party skills + ported** | <!-- numbers:auto:skills.firstParty -->10<!-- /numbers:auto:skills.firstParty --> + <!-- numbers:auto:skills.vendored -->150<!-- /numbers:auto:skills.vendored --> = <!-- numbers:auto:skills.catalogTotal -->160<!-- /numbers:auto:skills.catalogTotal --> | every paid run produces a receipt; declared 90/10 creator/treasury split written to the receipt body |
| **Foundry tests passing** | <!-- numbers:auto:contracts.foundryTests -->227<!-- /numbers:auto:contracts.foundryTests --> | `forge test` green across V1+V2+V3 of every registry |
| **Polyglot canonical hash** | TS · Python · Rust, byte-equal | <!-- numbers:auto:polyglotHash.languages -->3<!-- /numbers:auto:polyglotHash.languages --> reference implementations checked on every PR against 29 cross-impl vectors |
| **Mainnet `ReceiptRegistryV3`** | [`0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297`](https://chainscan.0g.ai/address/0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297) | live · explorer link · no auth required |
| **0 silent failures** | tampered `receiptRoot` fails closed; empty input gated before Router spend; bogus id rejects with format hint | edge-case sweep in QA proof pack |

### Why this matters now

Four forces converged in 2025–2026:

- **0G Compute's TEE attestation reached production grade.** `broker.processResponse` returns a verifiable signature from the enclave that anyone can re-check.
- **ERC-7857 stabilised** as the agent-identity standard. Agent passports are now soulbound INFTs with on-chain trust scores.
- **The EU AI Act Article 12 record-keeping mandate** for high-risk systems enters full application on **2 August 2026**, with penalties up to €15 million or 3% of worldwide annual turnover. Operators need an audit log they do not control.
- **Generative-AI adoption among legal organisations roughly doubled** in twelve months — from 14% in 2024 to 26% in 2025 (Thomson Reuters Future of Professionals Report, 1,700+ respondents). 28% at law firms specifically.

The intersection — TEE-attested inference, a non-operator-controlled audit log, an on-chain identity tied to that log, and a regulator clock — was not previously available simultaneously. Ivaronix is the first product to put all four behind a single user-facing flow.

### Track positioning

- **Track 1 — Agentic Infrastructure (primary).** Ivaronix is the cognitive backbone: skills, memory, receipts, hooks, scanner, sandbox. Ten first-party skills, all on chain.
- **Track 3 — Agentic Economy (automatic-secondary).** `SkillRegistryV2` + the `og.creator.fee_split` manifest field make every paid run a receipt-bound transaction. The declared creator/treasury split is written to the receipt body today; live atomic OG settlement via `SkillRunPayment.sol` is the v1.1 headline. The marketplace primitive is deployed on both networks.

We do not compete on Track 2 (Verifiable Finance), Track 4, or any track where the product would have to dilute its receipt-first posture. Doing one thing well is the bet.

---

## Page 2 · The receipt is the spine

Every action ships a receipt. Every receipt has the same shape — Zod-validated, RFC-8785 canonical-hashed, EIP-712 signed by an `AgentPassport`-resolvable wallet, anchored on `ReceiptRegistryV3`. Full schema in [`RECEIPT_SCHEMA.md`](./RECEIPT_SCHEMA.md). Short version:

```
receipt = {
  id, type, version,
  agent: { passportId, ownerWallet, trustScoreAtTime, signedBy },
  request: { skillId, skillVersion, userPromptHash, inputArtifacts, ... },
  execution: { burnMode, consensusMode, modelSelection: { requested, final }, ... },
  teeVerification: { verificationMethod, routerVerified, providerAddress },
  billing: { tokens, costNeuron, feeSplit: { creator, treasury } },
  storage: { receiptRoot, encryption: { type, keyFingerprint } },
  burn: { sessionKeyDestroyedAt, localCleanupStatus },
  chainAnchor: { network, chainId, registry, anchorTxHash, anchorBlockNumber },
  outputs: { outputHash, riskLevel, wording },
  signature
}
```

### Canonical hash

Take the receipt minus `signature`, `id`, and `chainAnchor`. Apply RFC-8785 JSON Canonicalisation (sorted keys, no insignificant whitespace, Unicode normalised). Hash with keccak256. The result is `receiptRoot`. Sign it with the agent's ECDSA key. On-chain we anchor only `receiptRoot` plus the per-agent monotonic nonce; the full body lives off-chain on 0G Storage. A verifier with the receipt JSON can re-derive `receiptRoot` and compare against the on-chain registry without trusting any single party. RFC-8785 determinism is what makes the hash byte-equal across TypeScript, Python, and Rust.

### Tampering is detected at verify time

Flip a single hex character of `storage.receiptRoot` in a local copy and `ivaronix receipt verify <path>` returns `hash FAIL → ✗ INVALID`. This is structural, not a heuristic.

### Two-tier trust, honestly labelled

`teeVerification.verificationMethod` takes one of three values:

- `router_flag` or `compute_sdk_process_response` — **TIER 1, TEE-attested**, renders **green** on `/r/<id>`.
- `external-signed` — **TIER 2**, ran on NVIDIA NIM / OpenAI / Ollama. Signed and chain-anchored, **not** TEE-verified. Renders **amber**. Honest, not flattering.

The `/r/<id>` page refuses to render TIER 1 green for any other value — a schema mismatch is a render error. We anchored a real NVIDIA NIM receipt to verify the amber path renders correctly: the TEE light turns amber while STORAGE / COMPUTE / CHAIN stay green.

### Independent re-verification — five checks, no account

The receipt is verifiable to a stranger on a clean machine, in any of three languages, in one command:

```
$ ivaronix receipt verify 1004 --tee-independent
schema                 PASS
hash                   PASS
signature              PASS
                    → CLAIMED
chain anchor          PASS  (id=1004 block≈1778309178)
                    → ANCHORED
initializing 0G Compute broker...
verifying 1 attestation via broker.processResponse...
tee:primary           PASS  (provider 0xa48f0128…)
                    → FULLY VERIFIED ✓
```

The first four checks (`schema · hash · signature · chain anchor`) are the load-bearing authenticity proof and pass deterministically regardless of broker state. The fifth check (`tee:primary`) calls back to the live 0G Compute provider — it proves the inference itself ran inside an attested TEE at the moment the receipt was issued. The five-step proof is what makes the receipt verifiable to a third party weeks after the original inference; CLAUDE.md §11.3a names this the load-bearing claim of the whole product.

When the live broker's TEE channel is temporarily unreachable (rate limit, provider session rotation, transient network), the CLI returns ANCHORED with an honest amber banner and exit code 1 — never fake-green. The first four checks still pass.

### Burn Mode

For inputs that must never leave the operator's machine in plaintext, Burn Mode encrypts the evidence with a freshly-generated AES-256-GCM session key (12-byte nonce, K-20 fix locks `randomBytes(12)`-only — never `Date.now()`-derived). The receipt records `storage.encryption.type: aes-256-gcm`, `storage.encryption.keyFingerprint: sha256:…`, `burn.sessionKeyDestroyedAt: <unix-ms>`, and `burn.localCleanupStatus: completed`. The `keyFingerprint` is captured *before* the key buffer is zeroed; the key never touches 0G Storage. After the receipt anchors, nobody — including the operator — can decrypt the original document.

This is the entire trust model. A receipt is one JSON file. The receipt plus the CLI that re-verifies it is the entire system.

---

## Page 3 · Growth roadmap

### Now — testnet at depth, mainnet at the line

Phase A (Galileo testnet, chainId 16602) is mature: <!-- numbers:auto:receipts.total -->1737<!-- /numbers:auto:receipts.total -->+ receipts anchored across V1+V2+V3 registries; 5 legal skills deployed on `SkillRegistryV2` with schema-aware output validation; full 13-type receipt enum populated; <!-- numbers:auto:contracts.foundryTests -->227<!-- /numbers:auto:contracts.foundryTests --> Foundry tests green; 13/13 mainnet-readiness items green.

Phase B (Aristotle mainnet, chainId 16661) shipped **2026-05-15**: <!-- numbers:auto:mainnet.deployedContractsToday -->10<!-- /numbers:auto:mainnet.deployedContractsToday --> contracts deployed in a single 0.085-OG-cost session, <!-- numbers:auto:mainnet.receiptsAnchored -->22<!-- /numbers:auto:mainnet.receiptsAnchored --> receipts anchored on `ReceiptRegistryV3` across all 13 receipt-type slots — real TEE attestation via `broker.processResponse` proven on mainnet receipt #4, real 0G Storage upload on receipts 3–14.

### Year 1 — first 10 firms

The Confidential Data Room is the wedge. Once one law firm runs a real M&A diligence cycle on Ivaronix, the second one is easier. Once five firms run on it, opposing counsel start asking for it by default — the audit log is provably independent. Target: ten paying law firms, two M&A advisory boutiques, one Big-Four-adjacent due-diligence team. Pricing: per-room or per-GB-month, win on independent verifiability and the EU AI Act Article 12 compliance story.

### Year 2 — open marketplace, embeddable verifier, cross-chain

Three structural pieces of work:

1. **Open the marketplace.** Promote `/skills` from catalog to public surface with creator earnings, run counts, top-earning skills, creator-passport tier badges. The `og.creator.fee_split` schema field already exists; live atomic OG settlement via `SkillRunPayment.sol` (the v1.1 headline) closes the loop end-to-end.
2. **Ship the embeddable verifier.** `<ReceiptVerifier id="<id>" />` as an npm package plus iframe so any external website can render and verify an Ivaronix receipt inline. The widget reads chain and storage directly; no Ivaronix server in the loop.
3. **Cross-chain receipts.** Anchor a copy of the receipt root on Ethereum L2s so a non-0G app can demand an Ivaronix attestation before executing. Receipts become an interop primitive, not a 0G-only artefact.

### Year 3 — compliance framework, B2B sales

Pursue SOC 2 Type II. Sell into compliance, internal audit, and legal-tech buyers. The Burn-Mode receipt is exactly what these teams already buy from incumbents, and the independent verifiability + the EU AI Act Article 12 compliance posture is the wedge. Verticals: clinical-trial protocols (HIPAA), trade-secret review (ITAR-adjacent), whistleblower / journalist source review.

### What we will not build

We will not build chat companions, trading agents, meme launchpads, or generic agent-rental marketplaces. Each of those is its own product with its own positioning; trying to also be them dilutes the audit-receipt wedge. Saying no to adjacent surface area is how we keep the receipt as the spine and avoid feature creep.

### The single bet

A document covered by privilege, NDA, regulation, or counterparty confidentiality is a $300/hour problem today. Ivaronix is the first product where you can drop that document into an AI, get an audit, prove the audit happened, and prove the document was destroyed afterwards — all on chain, all independently re-verifiable, all in under thirty seconds. The receipts are the spine. The TEE is the lock. The chain is the ledger. Everything else is execution.

---

### Try it · two commands

```bash
git clone https://github.com/Pratiikpy/ivaronix.git && cd ivaronix
pnpm install
cp .env.example .env   # fill IVARONIX_ROUTER_KEY + IVARONIX_SIGNER_KEY · faucet at faucet.0g.ai
pnpm ivaronix demo
```

One command. ~3 seconds. One real on-chain receipt with three independent proof URLs. Then:

```bash
pnpm ivaronix receipt verify <id> --tee-independent
```

Status flips to `→ FULLY VERIFIED ✓` (or honest amber if the broker channel is temporarily unreachable — never fake-green). The entire claim, end-to-end, in two commands.

---

*Submission for the 0G APAC Hackathon · May 2026 · Track 1 (Agentic Infrastructure) primary · Track 3 (Agentic Economy) automatic-secondary.*
