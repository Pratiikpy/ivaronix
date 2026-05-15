# Burn Mode end-to-end on mainnet · PASS

| Field | Value |
|---|---|
| Plaintext size | 85B |
| Ciphertext size | 113B |
| Encryption | aes-256-gcm |
| keyFingerprint | sha256:733e6223f73d921e3290b77b2c2c6ca8d8b2369bfea8d53ed36b069fa274af9b |
| Ciphertext storageRoot | 0x720ff2dc41dfac955e6f07bce957bfec5d441306ad8a702f2e58e56e59d85703 |
| Ciphertext upload tx | 0xc26d8efdefb22d39e4f1f5420ca555e20b95013c48e6d2406577a9fa146f7603 |
| Receipt id (V3) | 7 |
| Receipt anchor tx | [0x88722fa09af495c774fc4015485bf62b268e4bedd524262b2e7524b62d2a7518](https://chainscan.0g.ai/tx/0x88722fa09af495c774fc4015485bf62b268e4bedd524262b2e7524b62d2a7518) |
| receiptType | 3 (burn) |
| Cost | 0.000561 OG |

**Invariant**: session key was destroyed after burnEncrypt() · only the keyFingerprint (sha256 of the destroyed key) is on the receipt. A stranger reading the receipt can confirm the ciphertext is on 0G Storage but cannot decrypt without the destroyed key.
