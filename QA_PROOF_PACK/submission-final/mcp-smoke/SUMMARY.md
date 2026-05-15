# MCP server stdio smoke · 2026-05-15T08:28:34.218Z

## Tools listed (5)

- `ivaronix_ask` — Run an Ivaronix skill against text input. Optionally anchors a verifiable Action Receipt on 0G Chain. Use when the user 
- `ivaronix_verify_receipt` — Resolve a receipt by on-chain numeric id or 0x bytes32 receiptRoot and report its state.
- `ivaronix_search_memory` — Search the local Ivaronix memory engine (4-way hybrid: vector + FTS + temporal + KV).
- `ivaronix_install_skill` — List available Ivaronix skills, optionally filtered by substring of the skill id.
- `ivaronix_passport_show` — Read the on-chain AgentPassport profile for a wallet address.

## Receipt verify (ivaronix_verify_receipt)

```json
{
  "content": [
    {
      "type": "text",
      "text": "id              4\nreceiptRoot     0x6ed8933010d19228588e941d43e82fb062337d5ce5199559436fbe5f7e554092\nagent           0xaa954c33810029a3eFb0bf755FEF17863E8677Ce\ntype            code 0\nanchored        block 1778822526\nregistry        V3\nstate           ANCHORED"
    }
  ]
}
```

## Passport show (ivaronix_passport_show)

```json
{
  "content": [
    {
      "type": "text",
      "text": "tokenId        2\nwallet         0xaa954c33810029a3eFb0bf755FEF17863E8677Ce\ntrustScore     10\nreceiptCount   2\nviolations     0\ncontract       V2\nnetwork        mainnet"
    }
  ]
}
```

## stderr (last 2KB)

```
[ivaronix-mcp] connected over stdio
[ivaronix env] 6 legacy aliases in use: EVM_PRIVATE_KEY → IVARONIX_SIGNER_KEY, EVM_WALLET_ADDRESS → IVARONIX_WALLET_ADDRESS, ZG_API_SECRET → IVARONIX_ROUTER_KEY, ZG_SERVICE_URL → IVARONIX_ROUTER_URL, OG_COMPUTE_PROVIDER → IVARONIX_ROUTER_PROVIDER, OG_DEFAULT_MODEL → IVARONIX_DEFAULT_MODEL (planning-003 §A.3.4 · set IVARONIX_QUIET_ALIAS_WARNINGS=1 to silence)

```
