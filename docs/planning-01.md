# Ivaronix · Planning 01 — Parked Decisions

> Status: **PARKED**, not built.
> Both items below are decisions we agreed on the strategy for. Full implementation plan, scope, and sequencing TBD next session. Captured here so we don't lose them.

---

## 1. TEE-Bound Delegated AI Agent

**On TEE_HEE specifically:** it is performance art. "AI that owns its own Twitter" wins press, not OG showcase. OG showcase rewards depth on 0G primitives + a real user pull — that's why Aishi ranks #1 (full-stack 0G companion architecture), not "first autonomous AI." Don't fork it.

**One idea worth stealing from that whole list:** TEE-bound identity for the agent itself. Not "user signs from their wallet, runs an AI, gets a receipt." Instead: the AI has its own AgentPassportINFT, its own signing key that never leaves 0G Compute TEE, and the user grants/revokes capabilities via CapabilityRegistry. Every action the AI takes is signed by a key only the TEE controls — re-verifiable via `broker.processResponse`.

**That maps Ivaronix to:** *"I want an AI specialist to handle my contract reviews / data room access / repo audits. The AI has its own identity. Every action it takes is signed by the TEE, not by me or the operator. I can revoke at any time."*

**This uses every primitive we have at depth:** AgentPassportINFT (AI identity), CapabilityRegistry (user grants/revokes), 0G Compute (TEE-bound key + inference), ReceiptRegistry (signed actions), Burn Mode (confidential I/O), MemoryAccessLog (audit trail). Closes Criterion 2.1 hard. No competitor in 24 entries combines all six on one product.

**Phase positioning:** Phase B headline feature. Not before the data room ships — without the data room as a user pull, this becomes a tech feature with no story.

---

## 2. Confidential Data Room — The Marketplace We're Building

**The pick:** F (Confidential Data Room with Burn-Mode-receipt-gated multi-party access). Beat all other marketplace shapes (skill marketplace, skill-bounty board, audited-doc one-shot, compute-attested data, receipt-as-proof) after factoring in `entries/` + `og-projects-showcase/` + `new-entries/`. Three new-entries (Agentra, Trapezohe Ghast Skills Store, zer0Gig) already crowd skill marketplace — that lane is saturated.

**Persona:** deal lawyer / corporate finance associate / due-diligence partner sharing a confidential information memo or term sheet across two-or-three counterparties under NDA. Each counterparty's wallet is a named party in the room manifest.

**Pain:** existing VDRs (Datasite, Intralinks, Dropbox) produce vendor-controlled access logs; any AI summary leaks the document to a third-party server. One breach or one discovery subpoena and the privilege defense collapses.

**Counterparty:** the buy-side firm pays per data room or per GB-month. Seller's counsel is the deployer; buyer's counsel is the reader.

**Why F beats the field:** 10x more receipt volume per session than B (one-shot review) — every read is a receipt, every AI summary is a receipt, every grant change is a receipt. Uses **Chain + Storage + Compute + DA** in one user action, closes the 0G DA gap CLAUDE.md §2.1 flagged. Pulls **Track 5 (Privacy & Sovereign Infrastructure)** alongside locked Track 1 + Track 3 — none of the 24 competitors claim Track 5 with this product depth.

**Rough dev scope (TBD):**
- One Studio page (`/data-room/[id]`)
- One CLI command (`ivaronix room create --doc <file> --parties <addr,addr>`)
- One new receipt type (`doc-room-read`)
- No new contracts (capability grants reuse existing `CapabilityRegistry`)

**Fallback if multi-party UI runs long:** ship B (one-shot Burn Mode review) — same receipts, single doc, single buyer, ships in a day.

---

## Build order (decided, not yet planned)

1. **Privileged-document hero copy** on home page — pick a headline from the 5 sent, wire it, screenshot side-by-side against `brand/Ivaronix.html`. Estimated 15 min.
2. **Confidential Data Room** (item 2 above) — full implementation pass.
3. **TEE-Bound Delegated AI Agent** (item 1 above) — Phase B headline, after #2 ships.

---

## Open questions for next session

- Final hero headline (5 candidates, all editorial-voice compatible).
- Data room: B-fallback now, or commit to F directly?
- TEE-bound delegated agent: do we redeploy `AgentPassportINFT` with TEE-attestation on mint, or layer an `AgentTeeBinding` contract on top?
- Named reviewer personas (Adam the term-sheet hawk, Rhea the privacy-paranoid counsel) — wire as part of #2 default selector, or separate Phase B item?
