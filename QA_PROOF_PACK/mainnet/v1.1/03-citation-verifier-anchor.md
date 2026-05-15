# v1.1-3 · legal-citation-verifier web_fetch enforcement · DONE

> First mainnet receipt for `legal-citation-verifier` with REAL external HTTP enforcement · runtime called Cornell LII + CourtListener v4 · receipt records every URL + status + response sha256 · AI never determined "exists or not".
>
> Closes the only PARTIAL label on `/legal` (cluster is now 5/5 mainnet-confirmed · was 4/5 + 1 PARTIAL).

## Brief verdict: **do-not-file**

| Metric | Count |
|---|---:|
| Citations parsed from brief | 3 |
| External HTTP calls (real) | 3 |
| Verified (matched real source) | 2 |
| Not found (hallucinated · do-not-file) | 1 |
| Partial match (redline-required) | 0 |
| Unverified (source unreachable / auth-gated) | 0 |

## Per-citation verdicts

### 1. 28 U.S.C. § 1331

| Field | Value |
|---|---|
| URL called (real) | `https://www.law.cornell.edu/uscode/text/28/1331` |
| HTTP status | 200 |
| Response bytes | 33535 |
| Response sha256 | `7399b9b877268295b5365a5866a87ddf...` |
| Duration | 1371ms |
| hallucination_signal | `verified` |
| recommended_correction | Citation verified — no correction needed. |

### 2. Citizens United v. Federal Election Commission, 558 U.S. 310 (2010)

| Field | Value |
|---|---|
| URL called (real) | `https://www.courtlistener.com/api/rest/v4/search/?type=o&q=Citizens%20United%20v.%20Federal%20Election%20Commission&format=json` |
| HTTP status | 200 |
| Response bytes | 65142 |
| Response sha256 | `b8620e0923cff584e4289b4a113c0973...` |
| Duration | 1581ms |
| hallucination_signal | `verified` |
| recommended_correction | Citation verified (matched: Citizens United v. Federal Election Commission · reporter 175 L. Ed. 2d 753 / 130 S. Ct. 876 / 558 U.S. 310 / 2010 U.S. LEXIS 766 / 22 Fla. L. Weekly Fed. S 73 / 78 U.S.L.W. 4078 / 187 L.R.R.M. (BNA) 2961 / 159 Lab. Cas. (CCH) 10,166). |

### 3. Varghese v. China Southern Airlines, 925 F.3d 1339 (11th Cir. 2019)

| Field | Value |
|---|---|
| URL called (real) | `https://www.courtlistener.com/api/rest/v4/search/?type=o&q=Varghese%20v.%20China%20Southern%20Airlines&format=json` |
| HTTP status | 200 |
| Response bytes | 1975 |
| Response sha256 | `0de711c2df905dd82de02e1229f6e3ec...` |
| Duration | 439ms |
| hallucination_signal | `not_found` |
| recommended_correction | CourtListener returned count=1 results but none matched the cited name (closest: Fletcher v. Experian Info Solutions). Likely hallucinated. Either find a real source or remove the dependent argument. |

## Receipt on chain

| Field | Value |
|---|---|
| Receipt off-chain id | `rcpt_01XYUG5RTWQ5` |
| On-chain V3 id | 6 |
| receiptRoot | `0x2aeb38e57a6a2f21a3530cb9717d3e8e96c37af86fe8c1963e3dcb40ffa84783` |
| storageRoot (0G Storage) | `0x5b1aeba181304468006ed0e11a708fc548eb4749be6dbaea965beaba5d86f6b3` |
| Storage upload tx | `0x864b0e18f6b4c27f79ac68e2884726a0027d9513f0cddfadb5ad85cf6d2f40d5` |
| attestationHash (external-sources binding) | `0x309d30731eab389bd7e34208bbdf58a92d02e6cd5300c92e7191b66be21d782b` |
| Anchor tx | [0x6ee53f567647fa4cc7693cb6699abf60cdb0073268a67b98857962d588ae27bc](https://chainscan.0g.ai/tx/0x6ee53f567647fa4cc7693cb6699abf60cdb0073268a67b98857962d588ae27bc) |
| Block | 33294138 |
| Wallet | `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` |
| Total cost | 0.000561 OG |

## Architecture honored (per MAINNET_PERFECT_PLAN §3)

> "evidence-checker role calls external APIs · `0GM-1.0` is used only to parse citations from text and normalize matched results · **the AI never determines 'exists or not'** · external database is ground truth · this design survives every model upgrade and prevents any model from hallucinating citations through us"

This receipt embodies that contract structurally:
- **Parsing**: regex-based (no AI)
- **Verification**: 3 real HTTP calls captured under `verification.externalSources[]` with URL + status + response sha256 + duration · a stranger can curl each URL and confirm the recorded sha256 matches
- **Decision**: `hallucination_signal` derived from API response (count=0 → not_found · count>0 → verified · HTTP 4xx → unverified)
- **No model fabrication possible**: the receipt's verdict for each citation is bound to a specific external URL response sha256

## External-API failure-mode contract (locked · per MAINNET_PERFECT_PLAN §3)

CourtListener API v3 now requires auth (HTTP 403 anonymous · changed 2026-Q1).
v4 endpoint works anonymously (count + results[] shape unchanged).
Cornell LII remains free + public (HTTP 200 for all valid USC/CFR paths).

When an external source is unreachable, this runtime sets
`hallucination_signal: 'unverified'` (NOT `verified` and NOT `not_found`)
and the recommended_correction surfaces the HTTP status. The receipt remains
chain-anchored + cryptographically replayable; only the per-citation
verification status degrades honestly.

## Verification path for a stranger

```bash
# 1. Read receipt chain anchor
cast call 0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297 "receipts(uint256)(bytes32,bytes32,bytes32,address,uint64,uint8)" 6 --rpc-url https://evmrpc.0g.ai

# 2. Fetch receipt body from 0G Storage by storageRoot
# storageRoot: 0x5b1aeba181304468006ed0e11a708fc548eb4749be6dbaea965beaba5d86f6b3

# 3. For each citation in receipt's verification.externalSources[]:
#    a. curl the URL
#    b. compute sha256 of response body
#    c. compare to recorded responseSha256
# Stable byte-equality across runs proves the receipt's verdict was bound
# to the real external response at the recorded timestamp.

curl -sS "https://www.law.cornell.edu/uscode/text/28/1331" | shasum -a 256
# expected: 7399b9b877268295b5365a5866a87ddf...

curl -sS "https://www.courtlistener.com/api/rest/v4/search/?type=o&q=Citizens%20United%20v.%20Federal%20Election%20Commission&format=json" | shasum -a 256
# expected: b8620e0923cff584e4289b4a113c0973...

curl -sS "https://www.courtlistener.com/api/rest/v4/search/?type=o&q=Varghese%20v.%20China%20Southern%20Airlines&format=json" | shasum -a 256
# expected: 0de711c2df905dd82de02e1229f6e3ec...
```

— agent · v1.1-3 · 2026-05-15T05:32:38.898Z
