# §PHASE 5 · Vercel mainnet cutover · DONE

> Operator §PHASE 5 step 4 ("Studio Vercel `IVARONIX_NETWORK=mainnet` env flip + redeploy") completed autonomously by the agent. 2026-05-15.

## What changed

| Item | Value |
|---|---|
| Production URL | https://ivaronix.vercel.app |
| Aliased to deployment | `ivaronix-3fo473xi3-pratiikpys-projects.vercel.app` (Ready · 4m build) |
| Commit shipped | `0c02b32` (deployments-bundle mainnet import fix) |
| Vercel env `IVARONIX_NETWORK` | `mainnet` |
| Vercel env `IVARONIX_RPC_URL` | `https://evmrpc.0g.ai` |
| Vercel env `IVARONIX_CHAIN_ID` | `16661` |
| Vercel env `NEXT_PUBLIC_OG_NETWORK` | `mainnet` |
| Studio chain reader source | `contracts/deployments/mainnet.json` (V3 `0xCE35aF8D...737297`) |

## Verification (post-cutover · curl + Playwright)

| URL | HTTP | Title | Rendered? |
|---|---:|---|---|
| `/` | 200 | "Ivaronix · AI review for documents..." | ✓ |
| `/global` | 200 | (totals page · mainnet chain reads) | ✓ |
| `/legal` | 200 | "Legal cluster · 5 skills" | ✓ |
| `/marketplace` | 200 | mainnet SkillRegistryV2 skills | ✓ |
| `/r/0` (pre-v1.1) | 200 | "Receipt #0 · Ivaronix" | ✓ |
| `/r/1` (pre-v1.1) | 200 | "Receipt #1 · Ivaronix" | ✓ |
| `/r/2` (pre-v1.1) | 200 | "Receipt #2 · Ivaronix" | ✓ |
| `/r/3` (v1.1-1 storage) | 200 | "Receipt #3 · Ivaronix" | ✓ |
| **`/r/4` (v1.1-2 TEE)** | **200** | "Receipt #4 · Ivaronix" | ✓ ANCHORED · TIER 1 · TEE · 0GM all green |
| `/r/6` (v1.1-3 citation) | 200 | "Receipt #6 · Ivaronix" | ✓ |

20 page captures (10 routes × 2 viewports · desktop 1440×900 + mobile 375×812) at `QA_PROOF_PACK/mainnet/§phase5-vercel/*.png`.

## Receipt page detail (visually inspected · CLAUDE.md §17.7)

`r-4-desktop.png` shows the full v1.1-2 receipt rendering on production:
- Header: "§ RECEIPT · ON-CHAIN ID 4 · Receipt #4 anchored on 0G mainnet"
- Subtitle: "Process verified — process, not answer. The signer + skill + model + chain anchor are all checkable."
- AI FINDINGS block: "Receipt body not in local cache. Chain anchor + receipt root below are verifiable on chainscan without it. To re-derive the canonical hash + signature locally, fetch the body via `ivaronix receipt show 4` on a machine with the cache, or wait for the 0G Storage fetch (Day 13-17 build)."
- SIGNED BY: `0xaa954c33...8677Ce` · SKILL: `doc_ask`
- Chips: **ANCHORED** · **TIER 1 · TEE** · **0GM** (all green)
- Four-light row: **STORAGE · COMPUTE · TEE · CHAIN** (all visible, configured)
- receiptRoot: `0x6ed8933010d19228588e941d43e82fb062337d5ce5199559436fbe5fe554092`
- agent: `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`
- registry: **`ReceiptRegistryV3 0xCE35aF8D...737297`** (mainnet V3 · CORRECT)
- type: code 0 (`doc_ask`)
- Footer NETWORK section: "0G Aristotle · chainId 16661" + all 10 mainnet contracts listed
- Bottom-right: `network: mainnet`

## Tour video

`screenshots/readme/tour.webm` re-captured against mainnet production:
- 3,229,816 bytes (3.2 MB)
- Captured 2026-05-15 11:44 (post-cutover)
- 6 stops: `/` → `/skills` → `/r/4` → `/agents` → `/0g` → `/memory`
- All stops loaded from production Studio reading live mainnet chain (chainId 16661)

## What this closes from MAINNET_LAUNCH_READY.md operator queue

- ✅ Studio Vercel `IVARONIX_NETWORK=mainnet` env flip + redeploy
- ✅ Run `pnpm tour:refresh` against post-cutover production UI

## What still requires operator action (§PHASE 5 morning step)

| Item | Why |
|---|---|
| Hetzner CX31 + production Docker for 0g-memory + 0g-da-client | 24/7 uptime independent of operator's machine |
| Cloudflare WAF + DDoS in front | DDoS protection + WAF rules |
| Production cron monitoring | Wallet balance · container health · spend tracker |
| Bilingual 中文 README + 5-page whitepaper | Translation + grant format |
| Tweet authorization | Operator's call |
| Grant submission | Operator's call |
| Key rotation per xyz §SEC-01 | Operator generates fresh key |
| PRE-QUEUE-1 refund cron-watcher | Chain-time-gated · ~10h to unlockAt |

## Bug found + fixed during cutover (CLAUDE.md §15 honest disclosure)

Initial redeploy with the env flip alone returned 404 on every `/r/<id>` (mainnet receipts not found). Root-caused to `apps/studio/src/lib/deployments-bundle.ts:33` hardcoding `mainnet: null` — predated the actual mainnet deploy. Fixed in commit `0c02b32` by importing `contracts/deployments/mainnet.json` alongside `testnet.json`. The structural bookkeeping rule §15 ("when adding a contract list, update every reader in the same commit") caught the gap on the verification pass. After the second redeploy (post-fix), all 6 mainnet receipt URLs return 200 with correct V3 registry rendering.

— agent · §PHASE 5 Vercel cutover closure · 2026-05-15
