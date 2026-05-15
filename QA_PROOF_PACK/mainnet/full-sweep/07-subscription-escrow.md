# SubscriptionEscrowV2 lifecycle on mainnet · PASS

| Step | tx | Status |
|---|---|---|
| create (funded 0.005 OG) | [0x0878fafa5380c918e94ce20dec4fd7fa30c0ef780e0b276bb219bf0ac28437f8](https://chainscan.0g.ai/tx/0x0878fafa5380c918e94ce20dec4fd7fa30c0ef780e0b276bb219bf0ac28437f8) | ✓ status=1 |
| cancel | [0x99bfbb85a7ee840c55f74211a4fa75a2f3b7415e1f045637ccd80e15a4bc52cd](https://chainscan.0g.ai/tx/0x99bfbb85a7ee840c55f74211a4fa75a2f3b7415e1f045637ccd80e15a4bc52cd) | ✓ status=1 |
| withdrawRemaining | [0x342f15f0c1797e781f424d9c67fdaa1b0c665b43dc6de2a38d9ae36e734b4d4c](https://chainscan.0g.ai/tx/0x342f15f0c1797e781f424d9c67fdaa1b0c665b43dc6de2a38d9ae36e734b4d4c) | ✓ status=1 |

| Field | Value |
|---|---|
| Subscription id | 0 |
| skillId | 0x0934cfc21748e6a579630c2637fcb1f95b9fa2acfb16039e1a7ed70473860dcb (private-doc-review) |
| Net cost (funded 0.005 - refund + 3× gas) | 0.003600 OG |

**Proof**: full subscription lifecycle exercised on mainnet · client/agent self-test · 3 tx-status=1 · operator received refund of remaining budget via withdrawRemaining.
