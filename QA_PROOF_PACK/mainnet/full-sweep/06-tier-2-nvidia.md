# TIER 2 NVIDIA NIM fallback on mainnet · PASS

| Field | Value |
|---|---|
| NVIDIA endpoint | https://integrate.api.nvidia.com/v1 |
| Model | meta/llama-3.1-8b-instruct (requested: meta/llama-3.1-8b-instruct) |
| Completion id | chatcmpl-ab206875-7c20-4025-aed4-05278e998111 |
| Tokens | 139 |
| AI content (396c) | (see receipt body json) |
| Receipt id (V3) | 11 |
| Anchor tx | [0xc0de95fba10217bd9bbafb3b5aa3c6ebef16187ed9a9fb285b4f1e9be24553e8](https://chainscan.0g.ai/tx/0xc0de95fba10217bd9bbafb3b5aa3c6ebef16187ed9a9fb285b4f1e9be24553e8) |
| **verificationMethod** | external-signed |
| **tier1Verified** | false (TIER 2 · UI renders amber) |
| Cost | 0.000561 OG |

## What this proves

The TIER 2 fallback path lives end-to-end on mainnet: receipt produced via NVIDIA NIM (external provider, no TEE) · still chain-anchored + cryptographically replayable · receipt's verificationMethod is 'external-signed' (NOT compute_sdk_process_response) so the UI renders amber per CLAUDE.md §6.
