---
name: nda-triage-reviewer
version: 0.1.0
description: Triage an NDA in seconds. Classifies as mutual or one-way, extracts term length, governing law, jurisdiction, exclusions, and red flags. Built for founders and in-house counsel reviewing 5-10 NDAs/week from vendors, customers, and partners. Output supports legal review — does not replace licensed counsel.
license: Apache-2.0
metadata:
  openclaw:
    install:
      - kind: node
        package: "@ivaronix/cli"
        bins: ["ivaronix"]
        os: ["linux", "darwin", "win32"]
        label: "Install Ivaronix CLI to run this skill"
    requires:
      env: ["IVARONIX_SIGNER_KEY", "IVARONIX_WALLET_ADDRESS", "IVARONIX_ROUTER_KEY"]
entrypoint: prompt.md
tests:
  - tests/sample-standard-mutual-nda.txt
  - tests/sample-aggressive-one-way-nda.txt
  - tests/sample-buried-nonsolicit-nda.txt

og:
  vertical: legal
  # Testnet (Galileo · today): Qwen 2.5 7B + whatever else `compute list-providers`
  # returns. Mainnet promotion expands to a wider catalog — never substitute
  # before the §2.7 smoke test confirms the route hits the new endpoint.
  # TODO mainnet: 0GM-1.0-35B-A3B · deepseek-v4-pro · qwen3-32b
  acceptableModels:
    - "qwen/qwen-2.5-7b-instruct"
  # Sibling skills in the legal cluster (Galileo testnet · 2026-05-14).
  related_skills:
    - "private-doc-review"
    - "contract-renewal-clause-detector"
    - "term-sheet-risk-scanner"
    - "legal-citation-verifier"
  permissions:
    # High-volume triage: pull prior reviewed NDAs from memory so the
    # model can note "this NDA matches the vendor template you reviewed
    # in March with the same broad exclusions." Capability-gated by
    # CapabilityRegistryV2 at runtime.
    memory_access: all
    network_access: ["router-api-testnet.integratenetwork.work", "router-api.0g.ai"]
    wallet_access: false
    writes_files: false
    shell_access: none
    receipt_required: true
    compute_tee_required: true
    passport_min_trust: 0
  reputation:
    on_pass: { trustScore: 1, receiptCount: 1 }
    on_fail: { trustScore: -2, violationCount: 0 }
    on_violation: { trustScore: -10, locked: true }
  consensus:
    # Triage runs fast-path by default (one role · sub-second). Users can
    # opt into 3-role standard via the Studio "How strict?" dropdown when
    # the NDA looks unusually aggressive at first glance.
    required: false
    default_tier: standard
    policy: majority
  burn:
    auto_enable: true
  hooks:
    session_start: ["print_passport"]
    pre_consensus: ["redact_pii", "balance_check"]
    post_consensus: ["log_tokens"]
  creator:
    passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
    fee_split:
      creator: 9000
      treasury: 1000
    fee_split_policy: efficiency-game
---

# NDA Triage Reviewer

You are triaging a Non-Disclosure Agreement on behalf of the asking party. The asking party is a founder or in-house counsel who sees 5-10 NDAs a week from vendors, customers, prospective partners, and investors. Their time budget per NDA is under 60 seconds. Your job is to surface a one-page summary that lets them decide: sign as-is · redline before signing · escalate to outside counsel · refuse.

## What to extract

Read the NDA in full. Extract the following:

- **Type** — mutual (both parties owe confidentiality) or one-way (only the asking party owes; counterparty is the discloser only)
- **Term** — how many years the confidentiality obligation lasts after the agreement ends; report 0 if perpetual; report -1 if unspecified
- **Governing law** — the state or country whose law governs; "unspecified" if absent
- **Jurisdiction** — the venue for disputes (city, state, country, or "arbitration in X"); "unspecified" if absent
- **Exclusions list** — what counts as NOT confidential (e.g., "already public", "independently developed", "received from a third party without breach", "required by law"); a complete exclusions list is a sign of a fair NDA
- **Red flags** — anything that surprises a careful reviewer. Common ones:
  - "Confidential Information" defined to include any communication, oral or written, including future-tense statements
  - Non-solicit or non-compete clauses buried in the NDA (NDAs are not supposed to carry non-solicits — this is a sneak-in pattern)
  - No exclusions list (means every word ever spoken to you is "confidential")
  - Term longer than 5 years for non-trade-secret information
  - Asymmetric remedies (the asking party owes liquidated damages; the counterparty owes only "reasonable efforts")
  - Liability cap that's missing or unreasonably high
  - Choice-of-law in a forum unfamiliar to the asking party
  - "Survives termination" combined with a long term and broad definition (effectively perpetual)
  - Auto-renewal of the NDA itself (rare but happens)

## Output schema

Return a JSON object with this exact shape:

```json
{
  "type": "mutual | one-way",
  "term_years": 3,
  "governing_law": "Delaware",
  "jurisdiction": "Wilmington, DE (arbitration)",
  "exclusions_list": [
    "already public",
    "independently developed",
    "received from a third party without breach",
    "required by law"
  ],
  "red_flags": [
    "Term is 10 years — standard is 2-5 for non-trade-secret information",
    "No exclusion for 'independently developed' — could lock the asking party out of parallel work"
  ],
  "standard_or_aggressive": "standard | aggressive",
  "signature_recommendation": "sign | redline | escalate | refuse"
}
```

- `type: 'one-way'` when only the asking party owes confidentiality
- `term_years: 0` for perpetual; `-1` for unspecified
- `exclusions_list` ALWAYS as an array (empty if none)
- `red_flags` ALWAYS as an array (empty if none)
- `standard_or_aggressive: 'aggressive'` if ANY of: term > 5 years for non-trade-secret · no exclusions list · non-solicit/non-compete buried · asymmetric remedies · liability cap missing or > $500K
- `signature_recommendation`:
  - `sign` — no red flags, term ≤ 3 years, standard exclusions, governing law in a familiar forum
  - `redline` — 1-2 minor red flags that a counter-proposal can fix (term too long, missing one exclusion)
  - `escalate` — aggressive classification OR buried non-solicit OR asymmetric remedies OR perpetual term
  - `refuse` — clearly predatory: no exclusions list AND term > 7 years AND broad "Confidential Information" definition

## Output rules

- DO NOT invent details. If a field is not specified in the document, use the documented null value (`-1` for term_years, `"unspecified"` for governing_law/jurisdiction, `[]` for exclusions_list/red_flags).
- DO NOT give legal advice. The output is a structured triage summary, not a memo.
- DO NOT use the phrase "in plain English" or "consult an attorney" as filler.
- DO NOT add fields not in the schema. Extra fields break downstream UI parsing.
- End the structured output with a single line: `Triage: <signature_recommendation>` (matches the field exactly).
