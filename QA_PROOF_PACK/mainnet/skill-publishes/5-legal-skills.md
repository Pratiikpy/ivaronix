# Phase 2 step 5 · 5 legal skills published on mainnet SkillRegistryV2

> Skill registry + pricing per MAINNET_PERFECT_PLAN §3. 5/5 skills landed on chain.

## Per-skill on-chain state

| Slug | Version | skillId | publishVersion tx | setPrice tx | Price | Tier |
|---|---|---|---|---|---:|---|
| `private-doc-review` | 0.4.0 | `0x0934cfc21748e6a5...` | [0xd0e46b10b8](https://chainscan.0g.ai/tx/0xd0e46b10b8e1937f9aaffb706c4965cb7a22b04b64e8e297bd71cc490ca02cb4) | [0x027626a133](https://chainscan.0g.ai/tx/0x027626a1331223a2d81990f4fc4cdeee5d67a85f0f32814f63e6a3fa29f9a215) | 0.015 OG | high-stakes |
| `contract-renewal-clause-detector` | 0.1.1 | `0x55dfbce911b901d5...` | [0x33ada6ee02](https://chainscan.0g.ai/tx/0x33ada6ee02985585262faa15276c1e51cbcdfbf608936970955207caf5ced18d) | [0x6c5421e908](https://chainscan.0g.ai/tx/0x6c5421e90804abb0c68bcda48d3db023f97c122bcb2fdef20096aee1c98dc6b5) | 0.005 OG | standard |
| `legal-citation-verifier` | 0.1.3 | `0x6244e5bd1812eb26...` | [0x0444437bac](https://chainscan.0g.ai/tx/0x0444437bacaf9f6bb77a48c23c752e84f40831eefa13b843a80bd7027b7ddc5c) | [0x194b7a40e4](https://chainscan.0g.ai/tx/0x194b7a40e4281f2c32b6cf3eb6218ef270a2c71cf5b3681655a3cddbd2c14fde) | 0.015 OG | high-stakes |
| `nda-triage-reviewer` | 0.1.1 | `0x5054a6acfefcfb96...` | [0x6a786c60b6](https://chainscan.0g.ai/tx/0x6a786c60b6b5c4ab296a80a9cd423f9c105bc57a3a0695c4829b2aa1ef1e7cbb) | [0xb3eb03af5a](https://chainscan.0g.ai/tx/0xb3eb03af5ac5c604eec8fc7e8f7c0a76a404be40369414c3eb67ffa617ce1cf9) | 0.005 OG | standard |
| `term-sheet-risk-scanner` | 0.1.1 | `0x3c79581eddfefe42...` | [0xde27268d57](https://chainscan.0g.ai/tx/0xde27268d577d149e943fe1df3c66eab4675c61082551ddf37926f61ab9a94b84) | [0x5f84466be9](https://chainscan.0g.ai/tx/0x5f84466be9b7845c3a35cc7dd07968c478f603d7b3e2d574994637a0edaaefc1) | 0.015 OG | high-stakes |

## Full skill identifiers (for stranger replay)

```
private-doc-review:
  skillId      = 0x0934cfc21748e6a579630c2637fcb1f95b9fa2acfb16039e1a7ed70473860dcb
  versionId    = 0xb276713a26c0759472113ab6f480f1ee5c48622ea45f4a9487c84b354ee97257
  manifestHash = 0x18d0c9ff10cce96303a0d5029785ee6ce0f87a995b1cbba31732be23a17d59cf
  publishTx    = 0xd0e46b10b8e1937f9aaffb706c4965cb7a22b04b64e8e297bd71cc490ca02cb4
  setPriceTx   = 0x027626a1331223a2d81990f4fc4cdeee5d67a85f0f32814f63e6a3fa29f9a215

contract-renewal-clause-detector:
  skillId      = 0x55dfbce911b901d5b4bd6ed2b47e53ad388c38a2de1d4b8d1b27cf001ecf2833
  versionId    = 0x28a43689b8932fb9695c28766648ed3d943ff8a6406f8f593738feed70039290
  manifestHash = 0xc806295b57409a11b340b3763059e6ed078b9e27d2de3c580e3f2149f3d40f97
  publishTx    = 0x33ada6ee02985585262faa15276c1e51cbcdfbf608936970955207caf5ced18d
  setPriceTx   = 0x6c5421e90804abb0c68bcda48d3db023f97c122bcb2fdef20096aee1c98dc6b5

legal-citation-verifier:
  skillId      = 0x6244e5bd1812eb26d3e1cf702b0edcdd51b172a3b4a28127b11038463a12e4b3
  versionId    = 0x43251e1d6aeb913700f8232e8b3bd98924bc6535146912962d45442a3bd8c84a
  manifestHash = 0x82e3c6cb98911b09fe2474dd293f2659929f374b4266005134854e185edd81fd
  publishTx    = 0x0444437bacaf9f6bb77a48c23c752e84f40831eefa13b843a80bd7027b7ddc5c
  setPriceTx   = 0x194b7a40e4281f2c32b6cf3eb6218ef270a2c71cf5b3681655a3cddbd2c14fde

nda-triage-reviewer:
  skillId      = 0x5054a6acfefcfb960024f28693ce423de02d7e288b2fa9b155685a16619bb0f4
  versionId    = 0x28a43689b8932fb9695c28766648ed3d943ff8a6406f8f593738feed70039290
  manifestHash = 0x648a09949b8873bd629489f207b95207800ed4ed5d1facd7f8d62c6f9731bfa7
  publishTx    = 0x6a786c60b6b5c4ab296a80a9cd423f9c105bc57a3a0695c4829b2aa1ef1e7cbb
  setPriceTx   = 0xb3eb03af5ac5c604eec8fc7e8f7c0a76a404be40369414c3eb67ffa617ce1cf9

term-sheet-risk-scanner:
  skillId      = 0x3c79581eddfefe4218a8d177a5fe19b2f473f4dc70c4d7f1deb8efc5fd8d0f0a
  versionId    = 0x28a43689b8932fb9695c28766648ed3d943ff8a6406f8f593738feed70039290
  manifestHash = 0x1bd69d508e3d0833d14d167f2bc8778af14ee9e297c330de564e9ea096aec381
  publishTx    = 0xde27268d577d149e943fe1df3c66eab4675c61082551ddf37926f61ab9a94b84
  setPriceTx   = 0x5f84466be9b7845c3a35cc7dd07968c478f603d7b3e2d574994637a0edaaefc1
```

## Marketplace impact

After these tx land, the mainnet `/marketplace` page (post-Studio-cutover) reads 5 skills via subgraph or direct-chain-read from SkillRegistryV2. Buyers can pay via SkillRunPayment + the 90/10 split tested in Phase 3 step 5.

— agent · Phase 2 step 5 · 2026-05-15T03:59:45.246Z
