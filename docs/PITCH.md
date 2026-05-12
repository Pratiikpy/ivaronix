# Ivaronix

**AI review for the documents you can't paste into ChatGPT.**

A judge can read this in five minutes. There are three pages: what Ivaronix is, how the receipt model works, and the growth roadmap. Numbers are real, contract addresses are clickable, every claim has a chainscan link or a CLI command behind it.

---

## Page 1 · What · Who · Why now

A deal lawyer reviewing an M&A info memo, a founder reading a vendor's SaaS agreement before signing, a DD analyst combing a confidential data room — they all hold paper they cannot paste into ChatGPT. Pasting trains the model. Sharing with the counterparty's tool moves the trust boundary. The privilege defense, the NDA, the regulation — any one of them collapses on a single screenshot or a single discovery subpoena.

Existing tools each fail in a different layer:

- **ChatGPT, Claude, Cursor** train on input. The provider has the document.
- **Datasite, Intralinks, Dropbox** produce vendor-controlled access logs. Useful only when the vendor is trusted.
- **Self-hosted local LLMs** lose the audit trail. The reviewer can prove they ran the model only by running it again, which they can't, because the document is gone.

Ivaronix sits exactly where those three fail. A user drops a document. **Burn Mode** encrypts it with an ephemeral AES-256-GCM session key, the key is destroyed after the run, the receipt records the key fingerprint and the destroyed-at timestamp. **0G Compute (TEE)** runs the inference inside a trusted execution environment. **0G Chain** anchors an Action Receipt that any judge, opposing counsel, or auditor can independently re-verify from any machine via one CLI command — `ivaronix receipt verify <id> --tee-independent` calls `broker.processResponse` against the original 0G Compute provider; if the TEE attestation is real, the receipt status flips to `→ FULLY VERIFIED ✓`.

The product is one concrete user flow. Drop a contract. Get an audit. Share a public proof URL. The audit can be re-run on any machine, but the document never leaves the TEE in plaintext.

**As of 2026-05-09:**

| Number | Where to look |
|---|---|
| **<!-- numbers:auto:receipts.total -->1650<!-- /numbers:auto:receipts.total -->+ receipts** anchored on chain | [`ReceiptRegistry`](https://chainscan-galileo.0g.ai/address/0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c) (V1) + [`ReceiptRegistryV2`](https://chainscan-galileo.0g.ai/address/0xf675d4183b34fe8d1981FA9c117065aAcff690ab) (V2) |
| **<!-- numbers:auto:contracts.deployed -->8<!-- /numbers:auto:contracts.deployed --> contracts** deployed on Galileo | [`ReceiptRegistry`](https://chainscan-galileo.0g.ai/address/0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c) + V2 · [`AgentPassportINFT`](https://chainscan-galileo.0g.ai/address/0x08d25653638c3ed40C3b82840fA20CAe9c94563E) + V2 · [`CapabilityRegistry`](https://chainscan-galileo.0g.ai/address/0x3783f3c4834fCCBD553860e15c64C7E052646a8D) · [`MemoryAccessLog`](https://chainscan-galileo.0g.ai/address/0xEe1aDFe76785377C4430B1325d86E58A6eC92119) · [`SkillRegistry`](https://chainscan-galileo.0g.ai/address/0xf8894Ce4FFc7C594976d5Eaca38d8FE6DB4820a1) · [`Erc7857Verifier`](https://chainscan-galileo.0g.ai/address/0xEAd66Cb90B681720f3aab52d86c289E21106d938) |
| **<!-- numbers:auto:skills.firstParty -->6<!-- /numbers:auto:skills.firstParty --> first-party skills** with on-chain receipts | private-doc-review · github-audit · 0g-integration-auditor · plan-step · code-edit · content-pitch-review |
| **<!-- numbers:auto:skills.catalogTotal -->156<!-- /numbers:auto:skills.catalogTotal --> skills** in the catalog (`/v1/skills`) | first-party + <!-- numbers:auto:skills.vendored -->150<!-- /numbers:auto:skills.vendored --> vendored |
| **<!-- numbers:auto:contracts.foundryTests -->167<!-- /numbers:auto:contracts.foundryTests -->/<!-- numbers:auto:contracts.foundryTests -->167<!-- /numbers:auto:contracts.foundryTests --> Foundry tests passing** | Forge suite green |
| **13/13 mainnet-readiness** items | [`docs/MAINNET_READINESS.md`](./MAINNET_READINESS.md) |
| **0 silent failures** | tampered `receiptRoot` fails closed; empty input gated before Router spend; bogus id rejects with format hint |

**Why now.** 0G Compute's TEE attestation went production-grade. ERC-7857 Intelligent NFT spec stabilized. The browser-and-wallet experience around MetaMask reached the point where a non-technical user can drop a document and get a chain-anchored receipt in under thirty seconds. The four pieces — TEE, INFT, chain, browser — were never simultaneously ready before. They are now. Ivaronix is the first product to put all four behind one user-facing flow.

**Track positioning:**

- **Track 1 — Agentic Infrastructure (primary).** Ivaronix is the cognitive backbone: skills, memory, receipts, hooks, scanner, sandbox. Five first-party skills, all on chain.
- **Track 3 — Agentic Economy (automatic secondary).** SkillRegistry + `og.creator.fee_split` is a receipt-gated marketplace. Creators earn only when a TIER 1 TEE receipt anchors. `ivaronix skill earn-history` shows real numbers: private-doc-review = 26 runs, creator earned 0.0014009400 OG, exact 90/10 split.
- **Track 5 — Privacy & Sovereign Infrastructure (the upcoming Confidential Data Room hero).** Multi-party document review where every read is a receipt and every counterparty is a named wallet on-chain. None of the 24 competitors in the field claim Track 5 with this depth.

---

## Page 2 · The receipt is the spine

Every action ships a receipt. Every receipt has the same shape, validated by Zod, signed by an `AgentPassport`-resolvable wallet, anchored on `ReceiptRegistry`. The full schema lives in [`docs/RECEIPT_SCHEMA.md`](./RECEIPT_SCHEMA.md). The short version:

```
receipt = {
  id, type, version,
  agent: { passportId, ownerWallet, trustScoreAtTime },
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

**Canonical hash.** Take the receipt minus `signature`, `id`, and `chainAnchor`. Sort keys recursively, serialize with no whitespace, take `keccak256`. That hash is the `receiptRoot`. Sign it with the wallet's ECDSA key. The on-chain anchor stores only `receiptRoot` plus metadata — the full body lives off-chain on 0G Storage. A verifier with the receipt JSON can re-derive `receiptRoot` and compare against the on-chain registry without trusting any single party.

**Tampering is detected at verify time.** Flip a single hex character of `storage.receiptRoot` in a local copy and `ivaronix receipt verify <path>` returns `hash FAIL — expected 0xa9aa…0a5ca0, computed 0xa9aa…0a5ca7 → ✗ INVALID`. We tested this in the QA edge sweep.

**Tier marking is a single field.** `teeVerification.verificationMethod` takes one of three values:

- `router_flag` or `compute_sdk_process_response` — TIER 1, TEE-attested, renders **green**.
- `external-signed` — TIER 2, ran on NVIDIA NIM / OpenAI / Ollama. Signed and chain-anchored, **not** TEE-verified. Renders **amber**. Honest, not flattering.

A page displaying TIER 1 green that has any other value is a schema violation; the page refuses to render. We anchored a real NVIDIA NIM receipt (#1056) to verify the amber path renders correctly — the four-light row turns TEE amber while STORAGE / COMPUTE / CHAIN stay green.

**Independent re-verification — the part nobody else has.** Most 0G projects can prove they invoked 0G Compute. They cannot independently re-verify the response. Ivaronix runs `broker.processResponse` against the original provider and confirms the TEE attestation post-hoc:

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

Receipts #994, #1004, #1056, #1069 all reach `FULLY VERIFIED ✓`. The freshness window applies — the broker drops session records over time — but the integrity-only checks (schema, hash, signature, chain anchor) PASS on any receipt regardless of broker state. Only the optional fifth check (`tee:primary`) needs a warm session.

**Burn Mode evidence proof.** When the user enables Burn Mode, the receipt records `storage.encryption.type: aes-256-gcm`, `storage.encryption.keyFingerprint: sha256:11a3f1a1849212ebc5cfbf...`, `burn.sessionKeyDestroyedAt: 1778314505036`, and `burn.localCleanupStatus: completed`. Anyone with the receipt can prove (a) the input was encrypted, (b) the encryption was AES-256-GCM, (c) the session key was destroyed at a specific UTC instant. Nobody — including us — can decrypt the original document afterwards.

This is the entire trust model. A receipt is one JSON file. A receipt anchored on chain plus the CLI that re-verifies it is the entire system.

---

## Page 3 · Growth roadmap

The Confidential Data Room is the wedge. Once one law firm runs a real M&A diligence cycle on Ivaronix, the second one is easier. Once five firms run on it, opposing counsel start asking for it by default — the audit log is provably independent.

**Year 1 — testnet → mainnet → first 10 firms.** Phase A (Galileo testnet) is complete; <!-- numbers:auto:receipts.total -->1650<!-- /numbers:auto:receipts.total -->+ receipts anchored, 13/13 mainnet-readiness items GREEN, the deploy script is identical for chainId 16661. Phase B is the funded mainnet promotion plus the Confidential Data Room as the headline product. Target: ten paying law firms, two M&A advisory boutiques, one Big-Four-adjacent due-diligence team. Pricing: per-room or per-GB-month, undercut Datasite by 30 %, win on independent verifiability.

**Year 2 — skill marketplace public surface, embeddable verifier, cross-chain receipts.** Promote `/skills` from catalog to live marketplace with creator earnings, run counts, top-earning skills, creator passport tier. Ship `<ReceiptVerifier id="1004" />` as an npm package + iframe so any external website can render and verify Ivaronix receipts inline. Anchor receipts on a second chain (Base or Arbitrum) so a non-0G app can demand an Ivaronix attestation before executing — receipts become an interop primitive, not just a 0G feature. Open SkillRegistry to third-party creators; the `og.creator.fee_split` already exists, the public submission flow is the gate.

**Year 3 — SOC2-style trust framework + B2B sales.** Pursue SOC2 Type II. Sell into compliance, internal audit, and legal-tech. The Burn-Mode-receipt-gated audit log is exactly what these teams already buy from Datasite and Intralinks, and Ivaronix beats both on independent verifiability. Build a vertical: a Confidential Data Room for clinical-trial protocols (HIPAA), a Confidential Data Room for trade-secret review (ITAR-adjacent), a Confidential Data Room for whistleblower / journalist source review.

**What we will not build.** Consumer chat companions (Aishi already owns that lane in 0G's own showcase). Trading agents (Track 2 is not our wedge; Provus owns it). Meme launchpads (Whale.fun owns Track 4). General-purpose AI agent rentals (Agent0G, Agentra, zer0Gig already crowd that). Saying no is part of how we win.

**The single bet.** A document covered by privilege, NDA, regulation, or counterparty confidentiality is a $300/hour problem today. Ivaronix is the first product where you can drop that document into an AI, get an audit, prove the audit happened, and prove the document was burned afterwards — all on chain, all independently re-verifiable, all in under thirty seconds. That is the entire pitch. The receipts are the spine. The TEE is the lock. The chain is the ledger. Everything else is execution.

---

**Try it:**

```bash
git clone https://github.com/Pratiikpy/ivaronix.git && cd ivaronix
pnpm install
cp .env.example .env   # add ZG_API_SECRET + EVM_PRIVATE_KEY
pnpm exec tsx apps/cli/src/bin/ivaronix.ts demo
```

One command. ~3 seconds. One real on-chain receipt. Then:

```bash
ivaronix receipt verify <id> --tee-independent
```

Status flips to `→ FULLY VERIFIED ✓`. That is the entire claim, end-to-end, in two commands.
