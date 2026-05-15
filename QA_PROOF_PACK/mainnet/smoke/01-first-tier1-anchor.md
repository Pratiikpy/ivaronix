# Phase 3 step 1 · First TIER 1 mainnet receipt anchored

> Direct ethers script bypasses CLI env-precedence bug · runs against 0GM-1.0 via Direct credential · anchors on ReceiptRegistryV3 mainnet (chainId 16661).

## On-chain proof

| Field | Value |
|---|---|
| Receipt ID (off-chain ULID) | `rcpt_01R0516ZLA8D` |
| On-chain ID (V3 register) | 0 |
| receiptRoot | `0xb5438f458e290b10866ab0594fd3ac8d6a33f03822231dce83d0ee4a1efab1aa` |
| attestationHash | `0x89ca7a88d068075b87f3f899e98827afe63b74a8a400ba07217d6676fe7ddb39` |
| Anchor tx | [0xd9a48dedd80b88f166da56988c6b3923925476491eb6805dd6e87e0d351d4482](https://chainscan.0g.ai/tx/0xd9a48dedd80b88f166da56988c6b3923925476491eb6805dd6e87e0d351d4482) |
| Status | ✓ status=1 |
| Block | 33286212 |
| Gas used | 191489 |
| Cost | 0.000766 OG |
| Wallet | `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` |
| Registry | [`0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297`](https://chainscan.0g.ai/address/0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297) |

## Inference (TIER 1 via Direct credential)

| Field | Value |
|---|---|
| Endpoint | `https://compute-network-20.integratenetwork.work/v1/proxy` |
| Provider | [`0x4870CbC4D07d6Ac2EE5aA865588e5985FE77a4E9`](https://chainscan.0g.ai/address/0x4870CbC4D07d6Ac2EE5aA865588e5985FE77a4E9) |
| Target model | `0GM-1.0-35B-A3B` |
| Actual model returned | `0GM-1.0-35B-A3B-0427` |
| Completion ID | `4b49ad733991477ca7ef8c9ea4c4e79a` |
| Tokens (prompt + completion + total) | 116 + 600 = 716 |
| Reasoning tokens | n/a |
| Latency | 3542ms |

## AI output

> 

### Reasoning (thinking-mode)

> Here's a thinking process:
> 
> 1.  **Analyze User Input:**
>    - **Role:** Legal contract reviewer
>    - **Task:** Identify the single most concerning provision from the given Vendor MSA clauses
>    - **Constraint:** Respond in exactly 2 sentences
>    - **Input Provisions:**
>      - Section 3.2: 180 days notice for Tenant cancellation vs. 30 days for Landlord (asymmetric notice period)
>      - Section 3.3: Annual 7% price uplift
>      - Section 5.1: Auto-renewal clause buried
>    - **Goal:** Pick the *single most concerning* one and explain *why* in 2 sentences.
> 
> 2.  **Evaluate Provisions for Risk/Concern:**
>    - *Section 3.2 (Asymmetric notice):* Creates an imbalance, but asymmetrical notice periods are common in commercial leases/MSAs. Not necessarily the *most* concerning.
>    - *Section 3.3 (7% annual price uplift):* Significant cost escalation over time, but often negotiable and somewhat standard in long-term contracts.
>    - *Section 5.1 (Auto-renewal buried):* "Buries" implies it's hidden or not prominently disclosed. Auto-renewal clauses that aren't conspicuous can trap vendors/tenants into unintended long-term obligations, creating severe financial and operational lock-in risks. The lack of transparency combined with the binding nature makes it highly problematic.
> 
>    Actually, let's reconsider. In a Vendor MSA (Master Service Agreement), auto-renewal that isn't clearly disclosed is a major compliance and financial risk. But the prompt says "Vendor MSA" and mentions "Tenant/Landlord" in Section 3.2, which suggests it might be a lease or a facility/contractor agreement labeled oddly. Regardless, the auto-renewal being "buried" is a classic red flag for lack of informed consent and potential financial trap.
>    Alternatively, the 7% annual price uplift over a multi-year term can cause exponential cost increases, but auto-renewal without clear notice is generally considered more legally risky due to disclosure requirements and unconscionability concerns.
>    Let's stick with the auto-renewal clause as the most concerning due to its non-transparent nature and potential for unintended, binding long-term financial exposure.
> 
> 3.  **Draft Response (2 sentences max):**
>    The most concerning provision is the buried auto-renewal clause in Section 5.1, as its lack of conspicuous disclosure risks binding the vendor to unintended long-term obligations without clear, informed consent. This opacity creates significant compliance exposure and potential financial lock-in that could severely disrupt budgeting and operational planning.
> 
> 4.  **Check Constraints:**
>    - Role: Legal contract reviewer (tone matches)
>    - Task: Identify single most


## Honest disclosures (per MAINNET_PERFECT_PLAN §2.5)

- **TIER 1 attestation**: this v1 anchor records the provider address + completion ID + endpoint · the full `broker.processResponse` TEE-attested signature integration is queued. Receipt's `verification.verificationMethod` is `'router_flag'` (honest mid-state · NOT `'compute_sdk_process_response'` until broker integration ships).
- **storageRoot = ZeroHash**: receipt body lives in-process for this first anchor · 0G Storage upload integration was proven separately in the earlier TIER 2 demo (storage root `0x5a217520...` · tx `0x66e24c9b...`). Combining them is the next iteration.
- **Model substitution**: requested `0GM-1.0-35B-A3B` · provider returned `0GM-1.0-35B-A3B-0427` · § 2.5 honesty rule means we record actual not target. Provider-side snapshot routing applied.

## Verification path for a stranger

```bash
# Step 1 · read the receipt from chain (any RPC client)
cast call 0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297 \
  "receipts(uint256)(bytes32,bytes32,bytes32,address,uint64,uint8)" \
  0 \
  --rpc-url https://evmrpc.0g.ai

# Step 2 · open the anchor tx on chainscan
open https://chainscan.0g.ai/tx/0xd9a48dedd80b88f166da56988c6b3923925476491eb6805dd6e87e0d351d4482

# Step 3 · re-run the same prompt against the same provider endpoint
curl -H "Authorization: Bearer <your-app-sk>" \
  https://compute-network-20.integratenetwork.work/v1/proxy/chat/completions \
  -d '{"model":"0GM-1.0-35B-A3B","messages":[...]}'
```

— agent · Phase 3 step 1 · 2026-05-15T03:35:15.644Z
