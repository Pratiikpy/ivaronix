# CLI demo · live mainnet · run sheet

Five commands. Real on-chain side effects on 0G Aristotle mainnet. Anchors a real TIER 1 receipt anyone can re-verify. Sample document at `demo/sample-vendor-agreement.md` is a fictional SaaS contract with several obvious red flags (auto-renewal with 90-day notice, unilateral 12% price hikes, mandatory arbitration in vendor's chosen forum, perpetual data licence, customer indemnification).

Time to complete: ≈ 90 seconds. Cost: ≈ 0.0005 OG mainnet (under a tenth of a US cent).

---

## Before you hit record

1. Open Windows Terminal (or your preferred terminal), font 18-20pt, dark theme.
2. Resize to ~120 columns × 30 rows.
3. `cd C:\Users\prate\Downloads\oglabs`
4. Run `cls` to clear.
5. Pre-flight: `pnpm ivaronix doctor` once before recording. Confirm `network · mainnet`, `chainId · 16661`, balance > 0.01 OG. If those check out, `cls` and start recording.

---

## Command 1 · Show the setup is real (≈ 10 s)

```powershell
pnpm ivaronix doctor
```

**What you should see**
- `network              mainnet`
- `chainId              16661  (matches eth_chainId)`
- `rpc                  https://evmrpc.0g.ai`
- 10 mainnet contracts listed with green dots
- `balance              X.X OG` (operator wallet funded)
- `Status: ✓ ALL SYSTEMS GO`

**What to say**
> "First a quick health check. The CLI is talking to 0G Aristotle mainnet right now. Wallet funded, all ten contracts live, every system green."

---

## Command 2 · Anchor a real TIER 1 receipt on a real contract (≈ 30 s)

```powershell
pnpm ivaronix doc ask demo/sample-vendor-agreement.md "Which clause is the worst risk for the customer?" --skill private-doc-review
```

**What you should see**
- `skill                private-doc-review@0.4.0`
- `consensus complete   1500-2500ms · ~400 tokens`
- `storage upload       evidenceRoot ...`
- `receipt              rcpt_... block= ... on-chain id=NN`
- AI output listing the worst clauses (Section 5 perpetual data licence, Section 4 customer indemnification, Section 7 mandatory arbitration in vendor's forum, etc.)
- `Status: → DEMO ANCHORED ✓`
- `Public proof URL   https://www.ivaronix.xyz/r/NN`
- `Chain explorer     https://chainscan.0g.ai/tx/0x...`

**What to say (while it runs)**
> "Here is the actual review. I am asking the AI to find the worst clause in a fictional vendor contract. The inference runs inside a 0G Compute TEE. The evidence saves to 0G Storage. The receipt anchors on 0G Chain. Every step is real, on mainnet."

When the receipt id prints, point at it with your cursor.

**Write down the receipt id** — you need it for Commands 3 and 4. (Let's call it `<id>`.)

---

## Command 3 · Inspect the receipt body (≈ 15 s)

```powershell
pnpm ivaronix receipt show <id>
```

Replace `<id>` with the number from Command 2 (for example, `33` or `34`).

**What you should see**
- `type                 doc_ask`
- `agent                0xaa954c33…8677Ce`
- `tier                 tier-1-tee` ← the TIER 1 marker
- `verificationMethod   router_flag`
- `provider             0x4870CbC4…` (0G Compute provider address)
- `chainAnchor          ReceiptRegistryV3 · id=NN · block ...`
- `signature.signer     0xaa954c33…8677Ce`

**What to say**
> "Here is what the receipt actually contains. Skill, model, signer wallet, the keccak hash of the document, the chain anchor, and a TEE attestation. Everything a third party needs to check the AI's answer."

---

## Command 4 · The headline 5-check verifier (≈ 20 s)

```powershell
pnpm ivaronix receipt verify <id> --tee-independent
```

**What you should see**
```
schema                 PASS
hash                   PASS
signature              PASS
                    → CLAIMED
chain anchor          PASS  (id=NN · ReceiptRegistryV3)
                    → ANCHORED
initializing 0G Compute broker...
verifying 1 attestation via broker.processResponse...
tee:primary           PASS  (provider 0x4870CbC4…)
                    → FULLY VERIFIED ✓
```

**What to say (while it runs)**
> "And this is the part that matters most. Anyone can run this exact command on their own computer. No login. No shared secret. Five checks: schema, hash, signature, chain anchor, and a real call back to the 0G Compute provider to confirm the attestation. All five pass. Fully verified."

---

## Command 5 · Quick close (≈ 10 s)

```powershell
echo "Try it: www.ivaronix.xyz"
pnpm ivaronix --version
```

**What to say**
> "Everything you saw — the prompt, the AI inference, the receipt, the verification — is live on 0G Aristotle mainnet. The CLI ships with the repo. Try it yourself."

---

## Total runtime · ~90 seconds

| Step | Command | Duration |
|---|---|---|
| 1 | `pnpm ivaronix doctor` | ~10 s |
| 2 | `pnpm ivaronix doc ask demo/sample-vendor-agreement.md "..." --skill private-doc-review` | ~30 s |
| 3 | `pnpm ivaronix receipt show <id>` | ~15 s |
| 4 | `pnpm ivaronix receipt verify <id> --tee-independent` | ~20 s |
| 5 | `pnpm ivaronix --version` + sign-off | ~10 s |

---

## Recording tips

- **Type, do not paste.** Typing reads as real. Backspace and continue if you typo.
- **Pause 1-2 seconds after each command finishes.** Let the output sit before the next command. Silence is good.
- **One terminal window.** Do not switch apps mid-take.
- **Network resilience.** If a command times out (mainnet RPC blip), `cls` and re-run the same command — it is idempotent except Command 2 which anchors a new receipt.
- **TIER 2 protection.** All commands above are hard-pinned TIER 1 — confirmed by the 5-layer guard shipped in commits `8c21868`, `a6be308`, `f8f8fa9`. You cannot accidentally produce a TIER 2 receipt with these commands. Cost is ~0.0005 OG mainnet per take.
- **Single take.** If you want to retry Command 2's narration, no need to redo the rest — the receipt id just becomes a different number, the rest of the flow is identical.

---

## Alternative skills (if you want a different demo)

The sample doc works equally well with any of these first-party skills:

```powershell
# NDA-style triage (faster, classifies as mutual / one-way)
--skill nda-triage-reviewer

# Term-sheet risk scanner (Series A/B style)
--skill term-sheet-risk-scanner

# Contract auto-renewal detector
--skill contract-renewal-clause-detector

# Citation verifier for legal briefs
--skill legal-citation-verifier
```

All are first-party, all have `compute_tee_required: true`, all anchor TIER 1 on mainnet.
