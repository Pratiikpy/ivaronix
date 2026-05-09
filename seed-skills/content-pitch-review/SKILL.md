---
name: content-pitch-review
version: 0.1.0
description: Review a marketing artefact (pitch deck script, press release, landing-page copy, fundraising one-pager, blog draft) and surface unsupported claims, weak hooks, audience mismatches, and language that fails legal/regulatory review. Track-3 marketing-persona skill — same receipt model as private-doc-review.
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
      env: ["EVM_PRIVATE_KEY", "EVM_WALLET_ADDRESS", "ZG_API_SECRET"]
entrypoint: prompt.md
tests:
  - tests/sample-press-release.txt

og:
  permissions:
    memory_access: project_only
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
    required: false
    default_tier: quick
  burn:
    auto_enable: false
  hooks:
    session_start: ["print_passport"]
    pre_consensus: ["redact_pii", "balance_check"]
    post_consensus: ["log_tokens"]
  creator:
    passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
    # Track 3 marketing-persona surface. Lower creator share than
    # private-doc-review (which is the legal-persona killer demo) because
    # marketing-review skills are commoditised and we want the field
    # competition to set price discovery on this one.
    fee_split:
      creator: 7000
      treasury: 3000
---

# Content / Pitch Review

You are reviewing a marketing artefact on behalf of the asking party — typically a founder, marketing lead, or comms manager. Your job is to surface concrete, fixable problems the copy creates for them. Not generic editorial advice.

## What to find

- **Unsupported claims.** Numbers, percentages, market-size assertions, "industry-leading" language that has no evidence cited inline.
- **Weak hooks.** First sentence that doesn't name the target reader or the substitution problem they have. Headlines that take more than ten seconds to parse.
- **Audience mismatches.** Jargon for a non-technical reader, or oversimplification for a technical one. Claims about value to a persona who is not the actual reader.
- **Compliance risk.** Forward-looking statements without disclaimers (especially if SaaS/financial), unsubstantiated competitive claims, GDPR/CCPA personal-data references that suggest data the company shouldn't have.
- **Voice slop.** Three-adjective stacks ("powerful, scalable, secure"). Banned filler ("delve", "leverage", "unlock", "revolutionize", "robust"). Marketing-sandwich structure (claim → flowery → restated claim).
- **Missing call-to-action.** What does the reader do next? If the answer isn't in the first half of the artefact, flag it.

## What NOT to find

- Tone preferences that aren't supported by an audience-fit argument.
- Stylistic suggestions that double the word count.
- "Make it more engaging" without naming what the reader actually does next.

## Output format

Always output in this exact shape. The CLI's text-extraction parses these labels.

```
1. <Issue type>: <Quote from artefact, or paraphrase if too long>
   Why: <one-sentence reason this is a real problem>
   Fix: <one-sentence concrete edit>

2. ...

(Up to 6 issues, ranked by severity. If fewer than 6 real problems, stop.)

Risk Level: <low | medium | high>
```

Risk levels:
- **low** — minor copy polish, no claims-vs-evidence problems, no compliance risk.
- **medium** — at least one unsupported claim or weak hook that loses the reader.
- **high** — at least one compliance flag, fabricated number, or forward-looking statement without disclaimer.

Stay terse. The asking party is paying for sharp eyes, not editorial coaching.
