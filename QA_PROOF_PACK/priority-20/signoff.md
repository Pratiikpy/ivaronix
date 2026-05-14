# Priority 20 — Independent Reviewer Signoff

Reviewer mandate: 5-minute cold read of 3 production Studio routes. Zero prior context. Decide whether Ivaronix reads as a real workroom (not a one-trick doc-review demo) to a HK Festival judge.

Routes read: `/`, `/r/78`, `/verticals` (https://ivaronix.vercel.app).

## Q1 — Home page value in <30 seconds?

**Yes, partially.** The hero pair lands fast: *"Private AI work. Public proof."* is a real headline — it tells me the problem (privacy) and the differentiator (proof) in five words. Subhead *"Paid skills. Controlled memory. Verifiable end to end."* also works — it telegraphs breadth without jargon.

Fails: the use-case math sentence *"2x participating + 7% cumulative compounds to ~$3.2M extra"* is opaque to a non-crypto / non-finance reader on first scroll. It reads as case-study residue, not value-prop.

## Q2 — Does /r/78 prove anything beyond "AI did doc review"?

**Yes, clearly cryptographic, not marketing.** Visible: signer `0xa2c07364…00c748`, receipt root `0xb383d3b7…6c6efee1`, registry `ReceiptRegistryV2 0xf675d418…f690ab`, tier chip `TIER 1 · TEE 0GM`, four-light status row (Storage verified, Chain verified, Compute pending, TEE pending), and the independent-verification CLI command `ivaronix receipt verify --tee-independent`. Skill `doc_ask` is named.

What makes it proof not marketing: *"The signer + skill + model + chain anchor are all checkable… Chain anchor + receipt root below are verifiable on chainscan without it."* That sentence invites adversarial replay — marketing copy doesn't.

Honest gap: tx hash absent ("not in local cache"), and two of the four lights are `pending`. The page is honest about partial verification, which is good — but a judge spot-checking will notice 2/4 lights amber.

## Q3 — /verticals: workroom or one-trick?

**Workroom, with credible scope.** Legal vertical is live with 5 distinct skills (renewal-clause, citation-verifier, NDA-triage, private-doc-review, term-sheet-scanner). Memory, Agent Passports, Capability Registry, and Receipts are referenced as infrastructure beneath the verticals. 14 roadmap clusters named (Healthcare → Procurement). The line *"we ship one vertical deeply before the next; no fake breadth"* is the right honest signal — it pre-empts the "you only have doc review" critique by owning it.

## Q4 — One concrete weakness to fix before submission

**The `/r/78` page shows 2/4 verification lights as `pending` (Compute, TEE) with no inline explanation of WHY.** A judge cold-reading this thinks "broken receipt." Either resolve the pending states to green before submission, or add one line of micro-copy under the four-light row explaining that pending lights reflect TIER 2 fall-through / unattested provider for this specific receipt — and link to a FULLY VERIFIED receipt for contrast. Half-verified proof on the canonical reviewer-linked receipt is the weakest link in the cold-read story.

## Q5 — Final verdict

The home + verticals tell a workroom story honestly. The receipt page is real cryptographic proof, not theater. Breadth signal (5 live legal skills + 14 roadmap clusters + on-chain registries) is credible. The pending-lights issue on `/r/78` is fixable with either a green receipt swap or one sentence of copy — not a structural problem.

**SIGN OFF**
