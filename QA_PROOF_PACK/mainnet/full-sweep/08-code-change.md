# code_change (V3 slot 6) on mainnet · PASS

| Field | Value |
|---|---|
| Receipt id (V3) | 12 |
| Anchor tx | [0x48871d7c19b0b6fe1191b6d4fedf24eb71f58d54065548b6f7e53285e87cc4ef](https://chainscan.0g.ai/tx/0x48871d7c19b0b6fe1191b6d4fedf24eb71f58d54065548b6f7e53285e87cc4ef) |
| receiptType | 6 (code_change) |
| storageRoot | 0x5f3b38cecf1a58b6ccfce051ffba6aeae56e1080274bb69cbe99dd1e5b2d843b |
| Git sha attested | `0a7bf93af894a8646b5af85ae8214859e58e671c` |
| Commit message | feat(mainnet): full product sweep · 7/7 pass · 12/13 receipt slots exercised |
| Files changed | 17 |
| Change summary |  17 files changed, 1071 insertions(+) |
| Cost | 0.000561 OG |

**Architecture**: the code_change receipt-type slot is exercised end-to-end on mainnet by anchoring a real git commit sha. CLI command `ivaronix code` (or future Studio surface) reads this slot to surface "this code was reviewed before merge · here's the receipt".
