# P11 · Touch-target audit · 2026-05-13T17:17:37.289Z

Audit at mobile viewport 375×812. Two thresholds:

- **WCAG 2.2 AA** (SC 2.5.8 Target Size Minimum): ≥ 24×24 px — the launch gate.
- **WCAG 2.2 AAA** (SC 2.5.5 Target Size Enhanced): ≥ 44×44 px — the "comfort target" the test plan §P11 cites.

**Summary**: 655 visible interactive elements across 12 pages.

- Under WCAG AA (< 24px on at least one axis): **379** (57.9%).
- 24-43px on at least one axis (passes AA, fails AAA): **84** (12.8%).

Pass criteria for v1 mainnet promotion: **zero AA violations** on every primary CTA + form control + nav element. AAA gaps tolerated for inline text links (footer, address lists, dense paragraph copy).

## /

Total interactive: **51** · visible: **49** · under AA: **34** · AAA-only (passes AA): **9**

### AA violations (< 24px on at least one axis)

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | iIvaronix | 137 px | 22 px |
| `input` | (no text) | 1 px | 1 px |
| `input` | (no text) | 13 px | 13 px |
| `input` | (no text) | 13 px | 13 px |
| `a` | Onboard | 53 px | 16 px |
| `a` | Skills | 28 px | 16 px |
| `a` | Global | 38 px | 16 px |
| `a` | Dashboard | 65 px | 16 px |
| `a` | Memory | 48 px | 16 px |
| `a` | Brand kit | 52 px | 16 px |
| `a` | 0G platform docs ↗ | 114 px | 16 px |
| `a` | 0G ecosystem ↗ | 94 px | 16 px |
| `a` | Sample receipt | 86 px | 16 px |
| `a` | Privacy | 43 px | 16 px |
| `a` | Terms | 35 px | 16 px |
| `a` | AgentPassportINFT 0x08d2…563E | 191 px | 14 px |
| `a` | AgentPassportINFTV2 0x85e9…494d | 205 px | 14 px |
| `a` | CapabilityRegistry 0x3783…6a8D | 198 px | 14 px |
| `a` | CapabilityRegistryV2 0x1351…F3E1 | 211 px | 14 px |
| `a` | Erc7857Verifier 0xEAd6…d938 | 178 px | 14 px |
| `a` | MemoryAccessLog 0xEe1a…2119 | 178 px | 14 px |
| `a` | MemoryAccessLogV2 0xCbfE…F96d | 191 px | 14 px |
| `a` | ReceiptRegistry 0x9737…743c | 178 px | 14 px |
| `a` | ReceiptRegistryV2 0xf675…90ab | 191 px | 14 px |
| `a` | ReceiptRegistryV3 0x7396…6257 | 191 px | 14 px |
| `a` | SkillPricing 0xc336…718F | 158 px | 14 px |
| `a` | SkillRegistry 0xf889…20a1 | 165 px | 14 px |
| `a` | SkillRegistryV2 0xF051…2193 | 178 px | 14 px |
| `a` | SkillRunPayment 0x9eA5…0A5C | 178 px | 14 px |
| `a` | SubscriptionEscrowV2 0x7423…B7F5 | 211 px | 14 px |
| `a` | GitHub repository ↗ | 115 px | 16 px |
| `a` | Issues ↗ | 46 px | 16 px |
| `a` | Block explorer ↗ | 95 px | 16 px |
| `a` | Galileo faucet ↗ | 92 px | 16 px |

<details><summary>AAA-only gaps (9) — pass AA, fail AAA comfort target</summary>

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | Why | 61 px | 38 px |
| `a` | 0G | 52 px | 38 px |
| `a` | Agents | 76 px | 38 px |
| `button` | Open menu | 25 px | 36 px |
| `a` | Why Ivaronix → | 131 px | 38 px |
| `button` | Use sample contract → | 133 px | 26 px |
| `select` | 0g-integration-auditorcode-editcontent-pitch-revie | 177 px | 32 px |
| `select` | QuickStandardHigh-StakesAudit | 113 px | 32 px |
| `select` | Auto (skill default)Strict (unanimous)Balanced (ma | 191 px | 32 px |

</details>

## /?demo=true

Total interactive: **42** · visible: **40** · under AA: **31** · AAA-only (passes AA): **5**

### AA violations (< 24px on at least one axis)

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | iIvaronix | 137 px | 22 px |
| `a` | Onboard | 53 px | 16 px |
| `a` | Skills | 28 px | 16 px |
| `a` | Global | 38 px | 16 px |
| `a` | Dashboard | 65 px | 16 px |
| `a` | Memory | 48 px | 16 px |
| `a` | Brand kit | 52 px | 16 px |
| `a` | 0G platform docs ↗ | 114 px | 16 px |
| `a` | 0G ecosystem ↗ | 94 px | 16 px |
| `a` | Sample receipt | 86 px | 16 px |
| `a` | Privacy | 43 px | 16 px |
| `a` | Terms | 35 px | 16 px |
| `a` | AgentPassportINFT 0x08d2…563E | 191 px | 14 px |
| `a` | AgentPassportINFTV2 0x85e9…494d | 205 px | 14 px |
| `a` | CapabilityRegistry 0x3783…6a8D | 198 px | 14 px |
| `a` | CapabilityRegistryV2 0x1351…F3E1 | 211 px | 14 px |
| `a` | Erc7857Verifier 0xEAd6…d938 | 178 px | 14 px |
| `a` | MemoryAccessLog 0xEe1a…2119 | 178 px | 14 px |
| `a` | MemoryAccessLogV2 0xCbfE…F96d | 191 px | 14 px |
| `a` | ReceiptRegistry 0x9737…743c | 178 px | 14 px |
| `a` | ReceiptRegistryV2 0xf675…90ab | 191 px | 14 px |
| `a` | ReceiptRegistryV3 0x7396…6257 | 191 px | 14 px |
| `a` | SkillPricing 0xc336…718F | 158 px | 14 px |
| `a` | SkillRegistry 0xf889…20a1 | 165 px | 14 px |
| `a` | SkillRegistryV2 0xF051…2193 | 178 px | 14 px |
| `a` | SkillRunPayment 0x9eA5…0A5C | 178 px | 14 px |
| `a` | SubscriptionEscrowV2 0x7423…B7F5 | 211 px | 14 px |
| `a` | GitHub repository ↗ | 115 px | 16 px |
| `a` | Issues ↗ | 46 px | 16 px |
| `a` | Block explorer ↗ | 95 px | 16 px |
| `a` | Galileo faucet ↗ | 92 px | 16 px |

<details><summary>AAA-only gaps (5) — pass AA, fail AAA comfort target</summary>

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | Why | 61 px | 38 px |
| `a` | 0G | 52 px | 38 px |
| `a` | Agents | 76 px | 38 px |
| `button` | Open menu | 25 px | 36 px |
| `a` | Why Ivaronix → | 131 px | 38 px |

</details>

## /r/1004

Total interactive: **42** · visible: **40** · under AA: **31** · AAA-only (passes AA): **8**

### AA violations (< 24px on at least one axis)

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | iIvaronix | 137 px | 22 px |
| `a` | Onboard | 53 px | 16 px |
| `a` | Skills | 28 px | 16 px |
| `a` | Global | 38 px | 16 px |
| `a` | Dashboard | 65 px | 16 px |
| `a` | Memory | 48 px | 16 px |
| `a` | Brand kit | 52 px | 16 px |
| `a` | 0G platform docs ↗ | 114 px | 16 px |
| `a` | 0G ecosystem ↗ | 94 px | 16 px |
| `a` | Sample receipt | 86 px | 16 px |
| `a` | Privacy | 43 px | 16 px |
| `a` | Terms | 35 px | 16 px |
| `a` | AgentPassportINFT 0x08d2…563E | 191 px | 14 px |
| `a` | AgentPassportINFTV2 0x85e9…494d | 205 px | 14 px |
| `a` | CapabilityRegistry 0x3783…6a8D | 198 px | 14 px |
| `a` | CapabilityRegistryV2 0x1351…F3E1 | 211 px | 14 px |
| `a` | Erc7857Verifier 0xEAd6…d938 | 178 px | 14 px |
| `a` | MemoryAccessLog 0xEe1a…2119 | 178 px | 14 px |
| `a` | MemoryAccessLogV2 0xCbfE…F96d | 191 px | 14 px |
| `a` | ReceiptRegistry 0x9737…743c | 178 px | 14 px |
| `a` | ReceiptRegistryV2 0xf675…90ab | 191 px | 14 px |
| `a` | ReceiptRegistryV3 0x7396…6257 | 191 px | 14 px |
| `a` | SkillPricing 0xc336…718F | 158 px | 14 px |
| `a` | SkillRegistry 0xf889…20a1 | 165 px | 14 px |
| `a` | SkillRegistryV2 0xF051…2193 | 178 px | 14 px |
| `a` | SkillRunPayment 0x9eA5…0A5C | 178 px | 14 px |
| `a` | SubscriptionEscrowV2 0x7423…B7F5 | 211 px | 14 px |
| `a` | GitHub repository ↗ | 115 px | 16 px |
| `a` | Issues ↗ | 46 px | 16 px |
| `a` | Block explorer ↗ | 95 px | 16 px |
| `a` | Galileo faucet ↗ | 92 px | 16 px |

<details><summary>AAA-only gaps (8) — pass AA, fail AAA comfort target</summary>

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | Why | 61 px | 38 px |
| `a` | 0G | 52 px | 38 px |
| `a` | Agents | 76 px | 38 px |
| `button` | Open menu | 25 px | 36 px |
| `a` | Print / save as PDF → | 134 px | 27 px |
| `a` | 0xaa954c33810029a3eFb0bf755FEF17863E8677Ce | 202 px | 35 px |
| `button` | Copy URL | 93 px | 38 px |
| `a` | Share on X → | 116 px | 38 px |

</details>

## /marketplace

Total interactive: **40** · visible: **38** · under AA: **32** · AAA-only (passes AA): **4**

### AA violations (< 24px on at least one axis)

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | iIvaronix | 137 px | 22 px |
| `a` | Withdraw here | 86 px | 16 px |
| `a` | Onboard | 53 px | 16 px |
| `a` | Skills | 28 px | 16 px |
| `a` | Global | 38 px | 16 px |
| `a` | Dashboard | 65 px | 16 px |
| `a` | Memory | 48 px | 16 px |
| `a` | Brand kit | 52 px | 16 px |
| `a` | 0G platform docs ↗ | 114 px | 16 px |
| `a` | 0G ecosystem ↗ | 94 px | 16 px |
| `a` | Sample receipt | 86 px | 16 px |
| `a` | Privacy | 43 px | 16 px |
| `a` | Terms | 35 px | 16 px |
| `a` | AgentPassportINFT 0x08d2…563E | 191 px | 14 px |
| `a` | AgentPassportINFTV2 0x85e9…494d | 205 px | 14 px |
| `a` | CapabilityRegistry 0x3783…6a8D | 198 px | 14 px |
| `a` | CapabilityRegistryV2 0x1351…F3E1 | 211 px | 14 px |
| `a` | Erc7857Verifier 0xEAd6…d938 | 178 px | 14 px |
| `a` | MemoryAccessLog 0xEe1a…2119 | 178 px | 14 px |
| `a` | MemoryAccessLogV2 0xCbfE…F96d | 191 px | 14 px |
| `a` | ReceiptRegistry 0x9737…743c | 178 px | 14 px |
| `a` | ReceiptRegistryV2 0xf675…90ab | 191 px | 14 px |
| `a` | ReceiptRegistryV3 0x7396…6257 | 191 px | 14 px |
| `a` | SkillPricing 0xc336…718F | 158 px | 14 px |
| `a` | SkillRegistry 0xf889…20a1 | 165 px | 14 px |
| `a` | SkillRegistryV2 0xF051…2193 | 178 px | 14 px |
| `a` | SkillRunPayment 0x9eA5…0A5C | 178 px | 14 px |
| `a` | SubscriptionEscrowV2 0x7423…B7F5 | 211 px | 14 px |
| `a` | GitHub repository ↗ | 115 px | 16 px |
| `a` | Issues ↗ | 46 px | 16 px |
| `a` | Block explorer ↗ | 95 px | 16 px |
| `a` | Galileo faucet ↗ | 92 px | 16 px |

<details><summary>AAA-only gaps (4) — pass AA, fail AAA comfort target</summary>

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | Why | 61 px | 38 px |
| `a` | 0G | 52 px | 38 px |
| `a` | Agents | 76 px | 38 px |
| `button` | Open menu | 25 px | 36 px |

</details>

## /marketplace/0x0934cfc21748e6a579630c2637fcb1f95b9fa2acfb16039e1a7ed70473860dcb

Total interactive: **45** · visible: **43** · under AA: **34** · AAA-only (passes AA): **5**

### AA violations (< 24px on at least one axis)

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | iIvaronix | 137 px | 22 px |
| `input` | (no text) | 1 px | 1 px |
| `input` | (no text) | 13 px | 13 px |
| `a` | ← Back to marketplace | 134 px | 16 px |
| `a` | Onboard | 53 px | 16 px |
| `a` | Skills | 28 px | 16 px |
| `a` | Global | 38 px | 16 px |
| `a` | Dashboard | 65 px | 16 px |
| `a` | Memory | 48 px | 16 px |
| `a` | Brand kit | 52 px | 16 px |
| `a` | 0G platform docs ↗ | 114 px | 16 px |
| `a` | 0G ecosystem ↗ | 94 px | 16 px |
| `a` | Sample receipt | 86 px | 16 px |
| `a` | Privacy | 43 px | 16 px |
| `a` | Terms | 35 px | 16 px |
| `a` | AgentPassportINFT 0x08d2…563E | 191 px | 14 px |
| `a` | AgentPassportINFTV2 0x85e9…494d | 205 px | 14 px |
| `a` | CapabilityRegistry 0x3783…6a8D | 198 px | 14 px |
| `a` | CapabilityRegistryV2 0x1351…F3E1 | 211 px | 14 px |
| `a` | Erc7857Verifier 0xEAd6…d938 | 178 px | 14 px |
| `a` | MemoryAccessLog 0xEe1a…2119 | 178 px | 14 px |
| `a` | MemoryAccessLogV2 0xCbfE…F96d | 191 px | 14 px |
| `a` | ReceiptRegistry 0x9737…743c | 178 px | 14 px |
| `a` | ReceiptRegistryV2 0xf675…90ab | 191 px | 14 px |
| `a` | ReceiptRegistryV3 0x7396…6257 | 191 px | 14 px |
| `a` | SkillPricing 0xc336…718F | 158 px | 14 px |
| `a` | SkillRegistry 0xf889…20a1 | 165 px | 14 px |
| `a` | SkillRegistryV2 0xF051…2193 | 178 px | 14 px |
| `a` | SkillRunPayment 0x9eA5…0A5C | 178 px | 14 px |
| `a` | SubscriptionEscrowV2 0x7423…B7F5 | 211 px | 14 px |
| `a` | GitHub repository ↗ | 115 px | 16 px |
| `a` | Issues ↗ | 46 px | 16 px |
| `a` | Block explorer ↗ | 95 px | 16 px |
| `a` | Galileo faucet ↗ | 92 px | 16 px |

<details><summary>AAA-only gaps (5) — pass AA, fail AAA comfort target</summary>

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | Why | 61 px | 38 px |
| `a` | 0G | 52 px | 38 px |
| `a` | Agents | 76 px | 38 px |
| `button` | Open menu | 25 px | 36 px |
| `input` | (no text) | 301 px | 42 px |

</details>

## /skills

Total interactive: **195** · visible: **193** · under AA: **31** · AAA-only (passes AA): **4**

### AA violations (< 24px on at least one axis)

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | iIvaronix | 137 px | 22 px |
| `a` | Onboard | 53 px | 16 px |
| `a` | Skills | 28 px | 16 px |
| `a` | Global | 38 px | 16 px |
| `a` | Dashboard | 65 px | 16 px |
| `a` | Memory | 48 px | 16 px |
| `a` | Brand kit | 52 px | 16 px |
| `a` | 0G platform docs ↗ | 114 px | 16 px |
| `a` | 0G ecosystem ↗ | 94 px | 16 px |
| `a` | Sample receipt | 86 px | 16 px |
| `a` | Privacy | 43 px | 16 px |
| `a` | Terms | 35 px | 16 px |
| `a` | AgentPassportINFT 0x08d2…563E | 191 px | 14 px |
| `a` | AgentPassportINFTV2 0x85e9…494d | 205 px | 14 px |
| `a` | CapabilityRegistry 0x3783…6a8D | 198 px | 14 px |
| `a` | CapabilityRegistryV2 0x1351…F3E1 | 211 px | 14 px |
| `a` | Erc7857Verifier 0xEAd6…d938 | 178 px | 14 px |
| `a` | MemoryAccessLog 0xEe1a…2119 | 178 px | 14 px |
| `a` | MemoryAccessLogV2 0xCbfE…F96d | 191 px | 14 px |
| `a` | ReceiptRegistry 0x9737…743c | 178 px | 14 px |
| `a` | ReceiptRegistryV2 0xf675…90ab | 191 px | 14 px |
| `a` | ReceiptRegistryV3 0x7396…6257 | 191 px | 14 px |
| `a` | SkillPricing 0xc336…718F | 158 px | 14 px |
| `a` | SkillRegistry 0xf889…20a1 | 165 px | 14 px |
| `a` | SkillRegistryV2 0xF051…2193 | 178 px | 14 px |
| `a` | SkillRunPayment 0x9eA5…0A5C | 178 px | 14 px |
| `a` | SubscriptionEscrowV2 0x7423…B7F5 | 211 px | 14 px |
| `a` | GitHub repository ↗ | 115 px | 16 px |
| `a` | Issues ↗ | 46 px | 16 px |
| `a` | Block explorer ↗ | 95 px | 16 px |
| `a` | Galileo faucet ↗ | 92 px | 16 px |

<details><summary>AAA-only gaps (4) — pass AA, fail AAA comfort target</summary>

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | Why | 61 px | 38 px |
| `a` | 0G | 52 px | 38 px |
| `a` | Agents | 76 px | 38 px |
| `button` | Open menu | 25 px | 36 px |

</details>

## /onboard

Total interactive: **39** · visible: **37** · under AA: **31** · AAA-only (passes AA): **4**

### AA violations (< 24px on at least one axis)

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | iIvaronix | 137 px | 22 px |
| `a` | Onboard | 53 px | 16 px |
| `a` | Skills | 28 px | 16 px |
| `a` | Global | 38 px | 16 px |
| `a` | Dashboard | 65 px | 16 px |
| `a` | Memory | 48 px | 16 px |
| `a` | Brand kit | 52 px | 16 px |
| `a` | 0G platform docs ↗ | 114 px | 16 px |
| `a` | 0G ecosystem ↗ | 94 px | 16 px |
| `a` | Sample receipt | 86 px | 16 px |
| `a` | Privacy | 43 px | 16 px |
| `a` | Terms | 35 px | 16 px |
| `a` | AgentPassportINFT 0x08d2…563E | 191 px | 14 px |
| `a` | AgentPassportINFTV2 0x85e9…494d | 205 px | 14 px |
| `a` | CapabilityRegistry 0x3783…6a8D | 198 px | 14 px |
| `a` | CapabilityRegistryV2 0x1351…F3E1 | 211 px | 14 px |
| `a` | Erc7857Verifier 0xEAd6…d938 | 178 px | 14 px |
| `a` | MemoryAccessLog 0xEe1a…2119 | 178 px | 14 px |
| `a` | MemoryAccessLogV2 0xCbfE…F96d | 191 px | 14 px |
| `a` | ReceiptRegistry 0x9737…743c | 178 px | 14 px |
| `a` | ReceiptRegistryV2 0xf675…90ab | 191 px | 14 px |
| `a` | ReceiptRegistryV3 0x7396…6257 | 191 px | 14 px |
| `a` | SkillPricing 0xc336…718F | 158 px | 14 px |
| `a` | SkillRegistry 0xf889…20a1 | 165 px | 14 px |
| `a` | SkillRegistryV2 0xF051…2193 | 178 px | 14 px |
| `a` | SkillRunPayment 0x9eA5…0A5C | 178 px | 14 px |
| `a` | SubscriptionEscrowV2 0x7423…B7F5 | 211 px | 14 px |
| `a` | GitHub repository ↗ | 115 px | 16 px |
| `a` | Issues ↗ | 46 px | 16 px |
| `a` | Block explorer ↗ | 95 px | 16 px |
| `a` | Galileo faucet ↗ | 92 px | 16 px |

<details><summary>AAA-only gaps (4) — pass AA, fail AAA comfort target</summary>

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | Why | 61 px | 38 px |
| `a` | 0G | 52 px | 38 px |
| `a` | Agents | 76 px | 38 px |
| `button` | Open menu | 25 px | 36 px |

</details>

## /dashboard

Total interactive: **38** · visible: **36** · under AA: **31** · AAA-only (passes AA): **4**

### AA violations (< 24px on at least one axis)

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | iIvaronix | 137 px | 22 px |
| `a` | Onboard | 53 px | 16 px |
| `a` | Skills | 28 px | 16 px |
| `a` | Global | 38 px | 16 px |
| `a` | Dashboard | 65 px | 16 px |
| `a` | Memory | 48 px | 16 px |
| `a` | Brand kit | 52 px | 16 px |
| `a` | 0G platform docs ↗ | 114 px | 16 px |
| `a` | 0G ecosystem ↗ | 94 px | 16 px |
| `a` | Sample receipt | 86 px | 16 px |
| `a` | Privacy | 43 px | 16 px |
| `a` | Terms | 35 px | 16 px |
| `a` | AgentPassportINFT 0x08d2…563E | 191 px | 14 px |
| `a` | AgentPassportINFTV2 0x85e9…494d | 205 px | 14 px |
| `a` | CapabilityRegistry 0x3783…6a8D | 198 px | 14 px |
| `a` | CapabilityRegistryV2 0x1351…F3E1 | 211 px | 14 px |
| `a` | Erc7857Verifier 0xEAd6…d938 | 178 px | 14 px |
| `a` | MemoryAccessLog 0xEe1a…2119 | 178 px | 14 px |
| `a` | MemoryAccessLogV2 0xCbfE…F96d | 191 px | 14 px |
| `a` | ReceiptRegistry 0x9737…743c | 178 px | 14 px |
| `a` | ReceiptRegistryV2 0xf675…90ab | 191 px | 14 px |
| `a` | ReceiptRegistryV3 0x7396…6257 | 191 px | 14 px |
| `a` | SkillPricing 0xc336…718F | 158 px | 14 px |
| `a` | SkillRegistry 0xf889…20a1 | 165 px | 14 px |
| `a` | SkillRegistryV2 0xF051…2193 | 178 px | 14 px |
| `a` | SkillRunPayment 0x9eA5…0A5C | 178 px | 14 px |
| `a` | SubscriptionEscrowV2 0x7423…B7F5 | 211 px | 14 px |
| `a` | GitHub repository ↗ | 115 px | 16 px |
| `a` | Issues ↗ | 46 px | 16 px |
| `a` | Block explorer ↗ | 95 px | 16 px |
| `a` | Galileo faucet ↗ | 92 px | 16 px |

<details><summary>AAA-only gaps (4) — pass AA, fail AAA comfort target</summary>

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | Why | 61 px | 38 px |
| `a` | 0G | 52 px | 38 px |
| `a` | Agents | 76 px | 38 px |
| `button` | Open menu | 25 px | 36 px |

</details>

## /memory

Total interactive: **38** · visible: **36** · under AA: **31** · AAA-only (passes AA): **4**

### AA violations (< 24px on at least one axis)

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | iIvaronix | 137 px | 22 px |
| `a` | Onboard | 53 px | 16 px |
| `a` | Skills | 28 px | 16 px |
| `a` | Global | 38 px | 16 px |
| `a` | Dashboard | 65 px | 16 px |
| `a` | Memory | 48 px | 16 px |
| `a` | Brand kit | 52 px | 16 px |
| `a` | 0G platform docs ↗ | 114 px | 16 px |
| `a` | 0G ecosystem ↗ | 94 px | 16 px |
| `a` | Sample receipt | 86 px | 16 px |
| `a` | Privacy | 43 px | 16 px |
| `a` | Terms | 35 px | 16 px |
| `a` | AgentPassportINFT 0x08d2…563E | 191 px | 14 px |
| `a` | AgentPassportINFTV2 0x85e9…494d | 205 px | 14 px |
| `a` | CapabilityRegistry 0x3783…6a8D | 198 px | 14 px |
| `a` | CapabilityRegistryV2 0x1351…F3E1 | 211 px | 14 px |
| `a` | Erc7857Verifier 0xEAd6…d938 | 178 px | 14 px |
| `a` | MemoryAccessLog 0xEe1a…2119 | 178 px | 14 px |
| `a` | MemoryAccessLogV2 0xCbfE…F96d | 191 px | 14 px |
| `a` | ReceiptRegistry 0x9737…743c | 178 px | 14 px |
| `a` | ReceiptRegistryV2 0xf675…90ab | 191 px | 14 px |
| `a` | ReceiptRegistryV3 0x7396…6257 | 191 px | 14 px |
| `a` | SkillPricing 0xc336…718F | 158 px | 14 px |
| `a` | SkillRegistry 0xf889…20a1 | 165 px | 14 px |
| `a` | SkillRegistryV2 0xF051…2193 | 178 px | 14 px |
| `a` | SkillRunPayment 0x9eA5…0A5C | 178 px | 14 px |
| `a` | SubscriptionEscrowV2 0x7423…B7F5 | 211 px | 14 px |
| `a` | GitHub repository ↗ | 115 px | 16 px |
| `a` | Issues ↗ | 46 px | 16 px |
| `a` | Block explorer ↗ | 95 px | 16 px |
| `a` | Galileo faucet ↗ | 92 px | 16 px |

<details><summary>AAA-only gaps (4) — pass AA, fail AAA comfort target</summary>

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | Why | 61 px | 38 px |
| `a` | 0G | 52 px | 38 px |
| `a` | Agents | 76 px | 38 px |
| `button` | Open menu | 25 px | 36 px |

</details>

## /agents

Total interactive: **40** · visible: **38** · under AA: **31** · AAA-only (passes AA): **4**

### AA violations (< 24px on at least one axis)

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | iIvaronix | 137 px | 22 px |
| `a` | Onboard | 53 px | 16 px |
| `a` | Skills | 28 px | 16 px |
| `a` | Global | 38 px | 16 px |
| `a` | Dashboard | 65 px | 16 px |
| `a` | Memory | 48 px | 16 px |
| `a` | Brand kit | 52 px | 16 px |
| `a` | 0G platform docs ↗ | 114 px | 16 px |
| `a` | 0G ecosystem ↗ | 94 px | 16 px |
| `a` | Sample receipt | 86 px | 16 px |
| `a` | Privacy | 43 px | 16 px |
| `a` | Terms | 35 px | 16 px |
| `a` | AgentPassportINFT 0x08d2…563E | 191 px | 14 px |
| `a` | AgentPassportINFTV2 0x85e9…494d | 205 px | 14 px |
| `a` | CapabilityRegistry 0x3783…6a8D | 198 px | 14 px |
| `a` | CapabilityRegistryV2 0x1351…F3E1 | 211 px | 14 px |
| `a` | Erc7857Verifier 0xEAd6…d938 | 178 px | 14 px |
| `a` | MemoryAccessLog 0xEe1a…2119 | 178 px | 14 px |
| `a` | MemoryAccessLogV2 0xCbfE…F96d | 191 px | 14 px |
| `a` | ReceiptRegistry 0x9737…743c | 178 px | 14 px |
| `a` | ReceiptRegistryV2 0xf675…90ab | 191 px | 14 px |
| `a` | ReceiptRegistryV3 0x7396…6257 | 191 px | 14 px |
| `a` | SkillPricing 0xc336…718F | 158 px | 14 px |
| `a` | SkillRegistry 0xf889…20a1 | 165 px | 14 px |
| `a` | SkillRegistryV2 0xF051…2193 | 178 px | 14 px |
| `a` | SkillRunPayment 0x9eA5…0A5C | 178 px | 14 px |
| `a` | SubscriptionEscrowV2 0x7423…B7F5 | 211 px | 14 px |
| `a` | GitHub repository ↗ | 115 px | 16 px |
| `a` | Issues ↗ | 46 px | 16 px |
| `a` | Block explorer ↗ | 95 px | 16 px |
| `a` | Galileo faucet ↗ | 92 px | 16 px |

<details><summary>AAA-only gaps (4) — pass AA, fail AAA comfort target</summary>

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | Why | 61 px | 38 px |
| `a` | 0G | 52 px | 38 px |
| `a` | Agents | 76 px | 38 px |
| `button` | Open menu | 25 px | 36 px |

</details>

## /thesis

Total interactive: **46** · visible: **44** · under AA: **31** · AAA-only (passes AA): **4**

### AA violations (< 24px on at least one axis)

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | iIvaronix | 137 px | 22 px |
| `a` | Onboard | 53 px | 16 px |
| `a` | Skills | 28 px | 16 px |
| `a` | Global | 38 px | 16 px |
| `a` | Dashboard | 65 px | 16 px |
| `a` | Memory | 48 px | 16 px |
| `a` | Brand kit | 52 px | 16 px |
| `a` | 0G platform docs ↗ | 114 px | 16 px |
| `a` | 0G ecosystem ↗ | 94 px | 16 px |
| `a` | Sample receipt | 86 px | 16 px |
| `a` | Privacy | 43 px | 16 px |
| `a` | Terms | 35 px | 16 px |
| `a` | AgentPassportINFT 0x08d2…563E | 191 px | 14 px |
| `a` | AgentPassportINFTV2 0x85e9…494d | 205 px | 14 px |
| `a` | CapabilityRegistry 0x3783…6a8D | 198 px | 14 px |
| `a` | CapabilityRegistryV2 0x1351…F3E1 | 211 px | 14 px |
| `a` | Erc7857Verifier 0xEAd6…d938 | 178 px | 14 px |
| `a` | MemoryAccessLog 0xEe1a…2119 | 178 px | 14 px |
| `a` | MemoryAccessLogV2 0xCbfE…F96d | 191 px | 14 px |
| `a` | ReceiptRegistry 0x9737…743c | 178 px | 14 px |
| `a` | ReceiptRegistryV2 0xf675…90ab | 191 px | 14 px |
| `a` | ReceiptRegistryV3 0x7396…6257 | 191 px | 14 px |
| `a` | SkillPricing 0xc336…718F | 158 px | 14 px |
| `a` | SkillRegistry 0xf889…20a1 | 165 px | 14 px |
| `a` | SkillRegistryV2 0xF051…2193 | 178 px | 14 px |
| `a` | SkillRunPayment 0x9eA5…0A5C | 178 px | 14 px |
| `a` | SubscriptionEscrowV2 0x7423…B7F5 | 211 px | 14 px |
| `a` | GitHub repository ↗ | 115 px | 16 px |
| `a` | Issues ↗ | 46 px | 16 px |
| `a` | Block explorer ↗ | 95 px | 16 px |
| `a` | Galileo faucet ↗ | 92 px | 16 px |

<details><summary>AAA-only gaps (4) — pass AA, fail AAA comfort target</summary>

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | Why | 61 px | 38 px |
| `a` | 0G | 52 px | 38 px |
| `a` | Agents | 76 px | 38 px |
| `button` | Open menu | 25 px | 36 px |

</details>

## /0g

Total interactive: **63** · visible: **61** · under AA: **31** · AAA-only (passes AA): **29**

### AA violations (< 24px on at least one axis)

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | iIvaronix | 137 px | 22 px |
| `a` | Onboard | 53 px | 16 px |
| `a` | Skills | 28 px | 16 px |
| `a` | Global | 38 px | 16 px |
| `a` | Dashboard | 65 px | 16 px |
| `a` | Memory | 48 px | 16 px |
| `a` | Brand kit | 52 px | 16 px |
| `a` | 0G platform docs ↗ | 114 px | 16 px |
| `a` | 0G ecosystem ↗ | 94 px | 16 px |
| `a` | Sample receipt | 86 px | 16 px |
| `a` | Privacy | 43 px | 16 px |
| `a` | Terms | 35 px | 16 px |
| `a` | AgentPassportINFT 0x08d2…563E | 191 px | 14 px |
| `a` | AgentPassportINFTV2 0x85e9…494d | 205 px | 14 px |
| `a` | CapabilityRegistry 0x3783…6a8D | 198 px | 14 px |
| `a` | CapabilityRegistryV2 0x1351…F3E1 | 211 px | 14 px |
| `a` | Erc7857Verifier 0xEAd6…d938 | 178 px | 14 px |
| `a` | MemoryAccessLog 0xEe1a…2119 | 178 px | 14 px |
| `a` | MemoryAccessLogV2 0xCbfE…F96d | 191 px | 14 px |
| `a` | ReceiptRegistry 0x9737…743c | 178 px | 14 px |
| `a` | ReceiptRegistryV2 0xf675…90ab | 191 px | 14 px |
| `a` | ReceiptRegistryV3 0x7396…6257 | 191 px | 14 px |
| `a` | SkillPricing 0xc336…718F | 158 px | 14 px |
| `a` | SkillRegistry 0xf889…20a1 | 165 px | 14 px |
| `a` | SkillRegistryV2 0xF051…2193 | 178 px | 14 px |
| `a` | SkillRunPayment 0x9eA5…0A5C | 178 px | 14 px |
| `a` | SubscriptionEscrowV2 0x7423…B7F5 | 211 px | 14 px |
| `a` | GitHub repository ↗ | 115 px | 16 px |
| `a` | Issues ↗ | 46 px | 16 px |
| `a` | Block explorer ↗ | 95 px | 16 px |
| `a` | Galileo faucet ↗ | 92 px | 16 px |

<details><summary>AAA-only gaps (29) — pass AA, fail AAA comfort target</summary>

| Selector | Text/label | Width | Height |
|---|---|---:|---:|
| `a` | Why | 61 px | 38 px |
| `a` | 0G | 52 px | 38 px |
| `a` | Agents | 76 px | 38 px |
| `button` | Open menu | 25 px | 36 px |
| `button` | Copy link → | 92 px | 33 px |
| `a` | https://evmrpc-testnet.0g.ai ↗ | 267 px | 36 px |
| `a` | 0x08d2…563E ↗ | 174 px | 36 px |
| `a` | 0x85e9…494d ↗ | 174 px | 36 px |
| `a` | 0x3783…6a8D ↗ | 174 px | 36 px |
| `a` | 0x1351…F3E1 ↗ | 174 px | 36 px |
| `a` | 0xEAd6…d938 ↗ | 174 px | 36 px |
| `a` | 0xEe1a…2119 ↗ | 174 px | 36 px |
| `a` | 0xCbfE…F96d ↗ | 174 px | 36 px |
| `a` | 0x9737…743c ↗ | 174 px | 36 px |
| `a` | 0xf675…90ab ↗ | 174 px | 36 px |
| `a` | 0x7396…6257 ↗ | 174 px | 36 px |
| `a` | 0xc336…718F ↗ | 174 px | 36 px |
| `a` | 0xf889…20a1 ↗ | 174 px | 36 px |
| `a` | 0xF051…2193 ↗ | 174 px | 36 px |
| `a` | 0x9eA5…0A5C ↗ | 174 px | 36 px |
| `a` | 0x7423…B7F5 ↗ | 174 px | 36 px |
| `a` | Open the dashboard → | 165 px | 30 px |
| `a` | See receipt #1004 (FULLY VERIFIED) → | 260 px | 30 px |
| `a` | Confidential data room → | 181 px | 30 px |
| `a` | See receipt #1004 → | 150 px | 30 px |
| `a` | 0x85e9…494d ↗ | 174 px | 36 px |
| `a` | 0x08d2…563E ↗ | 174 px | 36 px |
| `a` | See a delegated agent → | 175 px | 30 px |
| `a` | Roadmap disclosures (docs) ↗ | 203 px | 30 px |

</details>
