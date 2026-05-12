# Judge guide · five minutes, three commands, three URLs

> One-page demo path for OG APAC Hackathon judges. Built for a reviewer who has a clean machine, a browser, and five minutes. No wallet required for the first three steps. Every receipt id and URL below is real testnet state at the time of submission.

---

## Step 1 · verify a receipt with no setup (60 seconds)

The single command no other 0G project ships. Open a terminal, paste this, hit enter:

```bash
git clone https://github.com/Pratiikpy/ivaronix.git oglabs
cd oglabs
pnpm install
pnpm --filter @ivaronix/cli exec ivaronix receipt verify 1304 --tee-independent
```

Expected output, when the live 0G Compute provider's TEE channel is reachable:

```
schema PASS
hash PASS
signature PASS                → CLAIMED
chain anchor PASS (id=1304)   → ANCHORED
tee:primary PASS              → via broker.processResponse
Status: → FULLY VERIFIED ✓
```

When the provider's TEE channel is temporarily unreachable (Router rate limit, provider session rotation, or transient network), the last two lines look like this:

```
tee:primary error             getting signature error
Status: → ANCHORED (some TEE checks failed)
```

The first four checks — `schema · hash · signature · chain anchor` — are the load-bearing authenticity proof. They confirm the receipt body is untampered, the canonical hash recovers, the signature recovers the agent address recorded on the `AgentPassportINFT`, and `ReceiptRegistry` holds the anchor at the given id. The `tee:primary` re-verify is the additional check that calls back to the live 0G Compute provider — it proves the inference itself ran inside the attested TEE when reachable, and it degrades honestly (not silently) when the channel is unreachable. Either output is real testnet state; the difference is which independent checks the live network supports at the moment the judge runs the command.

You just verified — on your machine, against the public 0G chain, with no account — that an AI inference happened on a 0G Compute provider, signed by a wallet that owns an AgentPassportINFT, and anchored on `ReceiptRegistry`. The independent re-verify is a CLI command, not a screenshot.

Receipt 1304 is a contract-review run on a sample lease. The headline output, model used, attestation hash, anchor block, and storage root are all in the receipt body at `apps/cli/.ivaronix/receipts/anchored/rcpt_*.json` after the verify step downloads it.

---

## Step 2 · land on three Studio surfaces (90 seconds)

Open the live testnet artifacts in three tabs:

1. **`/r/1304`** — the receipt you just verified, rendered with the four-light row, TIER 1 chip, anchor tx link, key fingerprint, and a "Print / save as PDF" button (Tier 4 · 4A — the deal-lawyer paper artifact).
2. **`/agents`** — leaderboard of all minted AgentPassports (live read of `AgentPassportINFT.nextTokenId()`), sorted by trust score. The operator's passport at trust 1421+ is the top row; the delegated agent (`0x4B21…24e0`, planning-01 §2A) is the second mint.
3. **`/data-room/01KR66C1GJVR57MHQPJCW1HQQY?storage=<rootHash>`** — Confidential Data Room (planning-01 §1B). Per-party CapabilityRegistry grants, Burn-Mode-encrypted blob, every read = a verifiable receipt. The `?storage=` query falls back to 0G Storage when local FS misses, so this URL works on any machine (planning-002 W6 · the cross-machine fix).

If `localhost:3300` isn't running, start it: `pnpm --filter @ivaronix/studio dev`. Brand contract per `brand/Ivaronix.html` — cream `#FAFAF7` paper, Outfit + Instrument Serif italic + JetBrains Mono.

---

## Step 3 · run a fresh receipt of your own (90 seconds)

Two paths. CLI is fastest:

```bash
pnpm --filter @ivaronix/cli exec ivaronix demo
```

`ivaronix demo` anchors one real receipt on Galileo testnet (~0.0001 OG, ~3 seconds) and prints three independent proof URLs. Faucet at `https://faucet.0g.ai` if `IVARONIX_SIGNER_KEY` (legacy alias: `EVM_PRIVATE_KEY`) in `.env` needs OG.

Or **drop a contract → see the receipt** in the Studio:
- Open `http://localhost:3300/`
- Click **"Use sample contract →"** on the RunPanel (planning-002 W1 · single-click demo)
- Hit **Run**
- Watch the four-light row turn green; click "Public proof URL" on the result card

Either path produces a receipt that re-verifies with the Step 1 command.

---

## Step 4 · the receipt that says what it actually did (60 seconds)

Open any receipt's JSON body. Three fields are load-bearing for honest grading:

```json
{
  "billing": {
    "feeSplit": {
      "declaredCreatorBps": 7000,         // skill manifest declaration
      "tier": "TIER_2",                   // what actually ran
      "tierMultiplierBps": 8500,          // 85% multiplier applied
      "creatorBps": 5950,                 // effective payout share
      "creatorNeuron": "51408000000000",  // BigInt-precise
      "treasuryNeuron": "34992000000000"
    }
  },
  "agent": {
    "ownerWallet": "0x...",
    "signedBy": "operator-on-behalf-of-user"  // or 'operator' (legacy) or 'user-direct' (SIWE end-state · opt-in today)
  },
  "request": {
    "priorReceiptIds": ["rcpt_..."]       // memory DAG · planning-01 §3A
    // memoryQuery: { method, k, retrievedCount } populated when ZG_MEMORY_URL set
  },
  "storage": {
    "evidenceRoot": "0x...",              // 0G Storage blob root
    // daBlobRef: { endpoint, requestIdHex, status, ... } populated when ZG_DA_URL set
    "encryption": { "type": "aes-256-gcm", "keyFingerprint": "sha256:..." }
  }
}
```

Every field is **honest by absence**: when the operator hasn't configured a primitive (DA disperser node, Persistent Memory sidecar, SIWE flow), the corresponding field is **omitted from the receipt body**. No fabricated claims. Receipt #1441 proves it — `daBlobRef`, `memoryQuery`, `signedBy` all absent because nothing was set.

---

## What you've now seen

Five judging criteria, two minutes each:

1. **0G Tech Depth.** Six primitives — 0G Chain, 0G Compute, 0G Storage, 0G Router, Agent ID (ERC-7857), 0G DA — each with a code path you can read in `packages/og-{chain,compute,storage,router,da}` and `contracts/src/AgentPassportINFT.sol`. 0G Persistent Memory wired in `packages/runtime/src/memory-client.ts`. Honest stance on which require operator action vs auto-flow.
2. **Implementation Completeness.** <!-- numbers:auto:contracts.foundryTests -->173<!-- /numbers:auto:contracts.foundryTests -->/<!-- numbers:auto:contracts.foundryTests -->173<!-- /numbers:auto:contracts.foundryTests --> Foundry tests · <!-- numbers:auto:packages.typecheckClean -->21<!-- /numbers:auto:packages.typecheckClean --> packages typecheck-clean · <!-- numbers:auto:receipts.total -->1651<!-- /numbers:auto:receipts.total -->+ receipts on testnet · <!-- numbers:auto:contracts.deployed -->8<!-- /numbers:auto:contracts.deployed --> contracts deployed · mainnet-readiness 13/13 green. Mainnet promotion blocked on operator funding (documented in `docs/USER_TODO.md`).
3. **Product Value.** Two locked personas: deal lawyer (single-doc review · `/r/1304/print`) and DD analyst (bulk audit · `ivaronix doc bulk <dir>`). Marketing-persona skill `content-pitch-review` with TIER 1 receipt fixture. <!-- numbers:auto:skills.catalogTotal -->156<!-- /numbers:auto:skills.catalogTotal -->-skill public registry at `skills/registry.json`. Track-3 economic teeth: TIER-1 receipts release 100% of declared creator bps; TIER-2 release 85% (the zer0Gig "Efficiency Game" pattern, in code).
4. **UX & Demo Quality.** "Use sample contract" → receipt anchored in 30 seconds with no wallet. Live receipt counter on the home hero (server-rendered from `ReceiptRegistry.nextId()`). Editorial cream-on-black brand, mobile-clean, brand-HTML side-by-side verified.
5. **Team & Documentation.** This guide. Plus `PITCH.md` (3 pages · non-technical), `RECEIPT_SCHEMA.md` (technical depth · sequence diagrams), `MAINNET_READINESS.md` (13/13 ops checklist), `PHASE_B_DISCLOSURES.md` (every half-baked surface named honestly), `USER_TODO.md` (operator-action items), `planning-01.md` + `planning-002.md` (every shipped feature with on-chain artefact reference).

If you want depth, every commit message in `git log --oneline` cites the planning-doc item it shipped. If you want a faster pitch, `docs/PITCH.md` is three pages. If you want the architecture, `README.md` "How it works" + "Built on 0G". For the live 0G primitive depth proof — six-module grid with live `getDeployedAddress` lookups + chainscan links — open **[ivaronix.app/0g](https://ivaronix.vercel.app/0g)** (planning-003 §A.5.17).

---

## What's NOT here, honestly

Per `CLAUDE.md §1` brutal honesty:
- Mainnet not deployed — funding-gated. All 6 contracts are mainnet-deploy-ready (same Foundry tests pass).
- 0G DA not anchored to live blobs — code path landed; activation needs a self-hosted DA Client Docker node (per `oglabs resources/0g-da-rust-sdk/README.md`). Operator action documented in `USER_TODO.md` B-1.
- 0G Persistent Memory not actively populated — same opt-in pattern; `install.sh` documented in `USER_TODO.md` B-3a.
- npm package `@ivaronix/widget` not yet published — code complete in `packages/widget/`, publish gate documented in `USER_TODO.md` B-3.
- Telegram bot not live — needs a BotFather token (operator action only).

Every one of these has an unblock action recorded in `USER_TODO.md`. Per `CLAUDE.md §12.1`, that satisfies the stop-condition without overclaiming.
