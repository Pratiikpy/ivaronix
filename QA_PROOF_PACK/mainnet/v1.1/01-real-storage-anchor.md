# v1.1-1 · Real 0G Storage upload integration on mainnet · DONE

> First mainnet receipt anchored with REAL storageRoot from 0G Storage (not placeholder).
> Replaces the storageRoot placeholder pattern used in receipts 0/1/2 (anchored 2026-05-15T02:50Z).

## Proof

| Field | Value |
|---|---|
| Receipt off-chain id | `rcpt_013VQZLEA5L4Z` |
| On-chain V3 id | 3 |
| receiptRoot (keccak256 canonical JSON) | `0x8d9874354cfee5097fe55e03e5866f4def73ee6b6ce509e8a12855ea1f7091dd` |
| **storageRoot (REAL · 0G Storage mainnet)** | `0x6506d1918012823583a00b34de6a79794a855556fc5cb7f1cbd46d3e00c2375d` |
| Storage upload tx | `0x0c6a4cf0e257de6abf2e6681e38816172ad428c3dc3a990797a1dfc8a2f80550` |
| Storage indexer | `https://indexer-storage-turbo.0g.ai` |
| attestationHash (placeholder · v1.1-2 queued) | `0xaa280a3481edf3a2b1808feb86940005f89fc21d58147fefcacf5beea833032b` |
| Anchor tx | [0x58cb61191a9a07886a19f4c42e85a01166a3df4119ddc22acf50b2c57563ca00](https://chainscan.0g.ai/tx/0x58cb61191a9a07886a19f4c42e85a01166a3df4119ddc22acf50b2c57563ca00) |
| Registry | [`0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297`](https://chainscan.0g.ai/address/0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297) |
| Wallet | `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` |
| Storage upload latency | 12781ms |
| Anchor block | 33292998 |
| Total cost | 0.000561 OG |

## AI output (with max_tokens=1500 bump · v1.1 thinking-mode fix attempt)

content (415c):
```
The $5 million liquidated damages provision is the most concerning because courts typically invalidate such sums as unenforceable penalties when they bear no reasonable relationship to actual anticipated harm. This clause creates severe, disproportionate liability exposure for both parties and should be replaced with a genuine pre-estimate of damages or a standard indemnification framework tied to proven losses.
```

reasoning (3371c · thinking-mode):

```
Here's a thinking process:

1.  **Analyze User Input:**
   - Document type: NDA (Non-Disclosure Agreement)
   - Key features mentioned: Mutual NDA, perpetual confidentiality, $5M liquidated damages, exclusive Cayman Islands jurisdiction
   - Task: Identify the single most concerning provision in exactly 2 sentences
   - Constraint: Respond in 2 sentences identifying the single most concerning provision and why

2.  **Evaluate Provisions for Concern:**
   - *Mutual NDA*: Standard, not inherently concerning
   - *Perpetual confidentiality*: Common for trade secrets, but can be problematic if overbroad (applies to all info, not just trade secrets)
   - *$5M liquidated damages*: Very high, potentially unenforceable as a penalty, creates disproportionate liability risk
   - *Exclusive Cayman Is
[truncated]
```


## What this proves

1. **0G Storage mainnet indexer is reachable** · upload succeeded · returned real rootHash + tx hash
2. **storageRoot is now real** · NOT a keccak256 placeholder · a stranger can fetch the receipt body from 0G Storage by rootHash and verify it byte-equals the canonical JSON whose hash is anchored on chain
3. **max_tokens=1500 bump** produced final-answer content (415c) · v1.1 thinking-mode fix CONFIRMED
4. **Full sovereignty circle**: inference on 0G Compute · receipt body on 0G Storage · canonical hash anchored on 0G Chain · signature recovers to AgentPassport-resolvable wallet

## v1.1 remaining gaps

- **`broker.processResponse` TEE attestation** · attestationHash is still a derived hash (model + provider + completion-id + timestamp). Wiring the @0gfoundation/0g-compute-ts-sdk broker for real TEE-attested signature is v1.1-2.
- **legal-citation-verifier web_fetch** · v1.1-3.

## Verification

A stranger can verify this receipt cold from a fresh machine:

```bash
# 1. Read receipt from chain
cast call 0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297 "receipts(uint256)(bytes32,bytes32,bytes32,address,uint64,uint8)" 3 --rpc-url https://evmrpc.0g.ai

# 2. Fetch receipt body from 0G Storage (with the rootHash returned by upload)
# (CLI download path: ivaronix receipt body-fetch <rootHash> --network mainnet)
# rootHash to fetch: 0x6506d1918012823583a00b34de6a79794a855556fc5cb7f1cbd46d3e00c2375d

# 3. Compute keccak256 of received bytes · MUST equal receiptRoot above
```

— agent · v1.1-1 · 2026-05-15T05:15:39.909Z
