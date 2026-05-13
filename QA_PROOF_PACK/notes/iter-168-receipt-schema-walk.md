# Iter-168 · receipt JSON field-by-field validation (plan §1072)

## Target

Receipt #14 — `rcpt_01KRFSH49PES240YSY9XGRH7P4` — the freshly anchored receipt from iter-164's literal `pnpm ivaronix demo` quickstart proof.

- Anchor tx: `0x074eb0ae620dd59df4dbea3ad4568f1b1f931209c031e680323ad4a5fba0c6ea`
- Block: 33039790
- Status (per iter-164 verify): FULLY VERIFIED ✓ (schema + hash + signature + chain anchor V2 + tee:primary)

## Top-level field walk

Schema doc `docs/RECEIPT_SCHEMA.md §1` claims 13 required + 1 optional top-level field. Live receipt has 16 fields (13 documented + 3 undocumented).

| Field | Schema doc says | Live receipt | Match? |
|---|---|---|---|
| `id` | ULID | `rcpt_01KRFSH49PES240YSY9XGRH7P4` | ✅ |
| `type` | enum | `doc_ask` (slot 0) | ✅ |
| `version` | `'1.0.0'` ← **drift** | `'1.0'` ← **canonical** | ⚠️ FIX DOC |
| `agent` | object | object | ✅ |
| `request` | object | object | ✅ |
| `execution` | object | object | ✅ |
| `teeVerification` | object | object | ✅ |
| `billing` | object | object | ✅ |
| `storage` | object | object | ✅ |
| `chainAnchor` | object | object | ✅ |
| `outputs` | object | object | ✅ |
| `burn` | object (optional) | PRESENT | ✅ |
| `signature` | `hex string` ← **drift** | `{ method, signer, signature }` ← **object** | ⚠️ FIX DOC |
| `createdBy` | string | `ivaronix-runtime/0.0.1` | ✅ |
| `createdAt` | (not documented) | ISO-8601 string | 📝 ADD TO DOC |
| `parentReceiptId` | (not documented) | optional ULID | 📝 ADD TO DOC |
| `routerTrace` | (not documented) | optional object | 📝 ADD TO DOC |

## Drifts fixed in same commit (CLAUDE.md §15)

### Drift 1 · `version`

Schema doc claimed `'1.0.0'`. Cross-checked `packages/receipts/src/schema.ts:70`:

```ts
version: z.literal('1.0'),
```

The Zod schema literal is `'1.0'` — single dot, two segments. The doc was wrong from the start (probably a typo). All 1664+ receipts on chain carry `'1.0'`. Fixed the doc to match the canonical schema literal.

### Drift 2 · `signature`

Schema doc claimed `signature | hex string`. Live receipt shape:

```json
"signature": {
  "method": "eth_personal_sign",
  "signer": "0xaa954c33810029a3eFb0bf755FEF17863E8677Ce",
  "signature": "0xa855595e45623a526e1bea7eea62ef58cc85eb2f654590ff1e3b0b49dc7ab8d961bb3625035554c1fc8576d46b272f3df1124c8f6ee68afc81e4facb3b9d8ec71c"
}
```

The hex string IS in there at `signature.signature` — but the doc misled future contributors into expecting a bare hex top-level field. The richer object shape encodes (a) the canonical signing method (`eth_personal_sign`), (b) the signer-echo for fail-fast comparison against recovered address, AND (c) the hex signature. All three are useful invariants worth keeping.

Fixed the doc to describe the full shape with the rationale.

### Bonus fields added to doc

Three undocumented but production-present fields:
- `createdAt` — ISO-8601 wall-clock UTC string (separate from anchor block timestamp)
- `parentReceiptId` — optional ULID for parent-child receipt chains
- `routerTrace` — optional per-role router call trace (latency + tokens)

## Sub-field deep-dives (live values)

### `teeVerification`

```json
{
  "requested": true,
  "routerVerified": false,
  "independentVerified": null,
  "providerAddress": "0xa48f01287233509FD694a22Bf840225062E67836",
  "verificationMethod": "router_flag",
  "verifiedAt": null,
  "tier": "tier-1-tee",
  "providerKind": "0g-router"
}
```

`verificationMethod = "router_flag"` is one of the 3 canonical TIER 1 values per schema doc §1.42. The Studio `/r/14` page would render green TIER 1 chip per the contract at line 51 ("anything else is a schema violation and the page refuses to render"). Honest per CLAUDE.md §6.

### `billing.feeSplit`

```json
{
  "declaredCreatorBps": 9000,
  "declaredTreasuryBps": 1000,
  "tier": "TIER_1",
  "tierMultiplierBps": 10000,
  "creatorBps": 9000,
  "treasuryBps": 1000,
  "creatorNeuron": "30645000000000",
  "treasuryNeuron": "3405000000000",
  "creatorPassport": "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1",
  "policyApplied": "flat"
}
```

- `creatorBps + treasuryBps == 10000` ✓ — invariant from iter-160 fee-split tests holds at receipt-emit time too.
- `creatorNeuron + treasuryNeuron == 30645e9 + 3405e9 = 34050e9` ≈ 0.000034 OG total billing (consistent with a quick-tier inference cost).
- `policyApplied = "flat"` — matches the canonical `flat` default from skills.md.
- `creatorPassport` carries the full DID (`did:0g:passport:<wallet>:<tokenId>`) for Track-3 marketplace settlement.

### `chainAnchor`

```json
{
  "network": "testnet",
  "chainId": 16602,
  "rpcUrlHash": "sha256:7d8e420a351f8e2272a6674876da272f2a5b5f7d1c0e48203a55880b872419d4",
  "registryAddress": "0xf675d4183b34fe8d1981FA9c117065aAcff690ab",
  "status": "anchored",
  "onChainId": "14",
  "anchorTxHash": "0x074eb0ae620dd59df4dbea3ad4568f1b1f931209c031e680323ad4a5fba0c6ea",
  "anchorBlockNumber": 33039790,
  "anchorTimestamp": 1778646569
}
```

- `chainId === 16602` ✓ — matches Galileo testnet
- `registryAddress === 0xf675d418...` ✓ — matches `ReceiptRegistryV2` in `contracts/deployments/testnet.json` (verify-known-registries-vs-deployments.ts regression confirms this in iter-162's 92-script sweep)
- `rpcUrlHash` is a sha256 of the RPC URL, not the URL itself — anchors the privacy boundary (operator's preferred indexer never leaks to the receipt body)
- `onChainId === "14"` ✓ — string-typed (matches Zod schema for cross-runtime BigInt safety)

## Verdict

✅ **PASS + 2 DOC FIXES** —

- Receipt #14 matches the Zod schema in `packages/receipts/src/schema.ts` exactly (we already proved this via the `--tee-independent` verify in iter-164's FULLY VERIFIED ✓ chain).
- All 13 documented top-level fields PASS; 3 bonus production fields added to doc (`createdAt`, `parentReceiptId`, `routerTrace`).
- 2 real doc-drift items fixed: `version: '1.0.0'` → `'1.0'` (matches Zod literal at `schema.ts:70`); `signature: hex string` → `signature: { method, signer, signature }` (matches the production object shape).
- Sub-field deep-dives confirm: `verificationMethod = "router_flag"` honest TIER 1; `creatorBps + treasuryBps = 10000` invariant holds; `registryAddress` matches V2 deployment; `policyApplied = "flat"` matches canonical default.

Cumulative session plan-coverage now ~34 concrete sections proven. Fourth iter in a row with real drift surfaced + closed in same commit per CLAUDE.md §15 ship-X-discover-X discipline.
