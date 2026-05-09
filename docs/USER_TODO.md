# Ivaronix · Operator Action List

> Single page of every action that needs **a real human (the operator)** to do something off-keyboard. Anything I (the agent) can do automatically is shipped or queued elsewhere — this list is the cleanup of items that depend on you.
>
> Updated 2026-05-09 · ordered by submission risk.

## A · Submission-blocking (do these before submitting)

### A-1 · Galileo testnet wallet · already funded (no action right now)
- **Status as of 2026-05-09:** balance ≈ **69 OG** on `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`. Each demo run costs ~0.0001 OG, so the current balance covers thousands of judge runs.
- **Top up only if needed:** the public faucet at `https://faucet.0g.ai` issues free testnet OG to any address. You do not pay anything; the faucet hands out tokens. Hit it again only if `ivaronix doctor balance` ever shows < 1 OG.
- **Verify any time:** `pnpm --filter @ivaronix/cli exec ivaronix doctor balance` — checks the live chain.

### A-2 · Fund the mainnet deployer wallet on Aristotle (chainId 16661)
- **Why it matters:** mainnet promotion is the only real difference between "demo on testnet" and a production-grade artefact. CLAUDE.md §1: "the only blocker is money." All six contracts compile + deploy + mainnet-readiness checklist is already 13/13 green.
- **Action:** send ~0.1 OG to the deployer wallet on chainId 16661 (Aristotle mainnet, `https://evmrpc.0g.ai`).
- **Verify:** `pnpm --filter @ivaronix/cli exec ivaronix doctor balance --network mainnet` should show > 0.1 OG.
- **Then run:** `pnpm --filter @ivaronix/cli exec ivaronix deploy --network mainnet` (script exists; will refuse if balance is short).

### A-3 · Submit the README + repo URL to the OG APAC submission portal
- **Why it matters:** documentation is a judging input.
- **Action:** copy `https://github.com/Pratiikpy/ivaronix` (or whatever the production repo URL is) into the submission form. Paste the README's "How it works" + "Built on 0G" + "Network reference" blocks as the project description.
- **Sanity check:** the README answers all six points the submission asks (project overview, architecture, modules used, how modules support the product, repro steps, test account / faucet / reviewer notes) without using a "compliance checklist" voice.

---

## A-V2 · HALF_BAKED Section N · contract V2 redeploys (operator-action gates)

These are code-complete in the repo. The chain deploy itself needs operator-side OG. Each block lists exactly one command sequence.

### A-V2-K1 · Deploy `AgentPassportINFTV2` to Galileo
- **Why:** closes K-1 (Critical) — the V1 `recordReceipt` accepts unbounded self-claimed trustScore from token owners. V2 requires `authorizedRecorders` only, cross-checks the receipt id on `ReceiptRegistry`, caps `trustScoreDelta` to `[-100, +100]`. Bundles K-4 (executor authorizations cleared on transfer via per-token version counter) and K-6 (mint reentrancy fix) into the same redeploy.
- **Status:** `contracts/src/AgentPassportINFTV2.sol` shipped; 16/16 Foundry tests pass; deploy script `contracts/script/DeployPassportV2.s.sol` ready.
- **Cost:** ~0.05 OG on Galileo (already funded, see A-1). No new funding required.
- **Run:**

  ```bash
  cd contracts
  export OG_PRIVATE_KEY=<your-deployer-key>           # already in your .env
  export PASSPORT_VERIFIER_ADDR=0x...                 # current Erc7857Verifier address
  export RECEIPT_REGISTRY_ADDR=0x...                  # current ReceiptRegistry address
  forge script script/DeployPassportV2.s.sol:DeployPassportV2 \
    --rpc-url https://evmrpc-testnet.0g.ai \
    --broadcast --legacy
  ```

  Both addresses are in `contracts/deployments/testnet.json` under `Erc7857Verifier` and `ReceiptRegistry`.

- **Post-deploy:**
  1. Add the new `AgentPassportINFTV2` address to `contracts/deployments/testnet.json` under a new `AgentPassportINFTV2` key. Leave the V1 `AgentPassportINFT` entry untouched — the four existing minted passports stay readable on V1.
  2. Authorize the operator wallet as a recorder (so future receipt anchors can write reputation):
     `cast send <V2-addr> "addAuthorizedRecorder(address)" <operator-wallet> --rpc-url https://evmrpc-testnet.0g.ai --private-key $OG_PRIVATE_KEY --legacy`
  3. Studio `/agents` will need a follow-up to read V2 first and fall back to V1 with a `LEGACY-PASSPORT` chip — already documented in HALF_BAKED.md K-1; agent picks it up post-deploy.

### A-V2-K2 · Deploy `ReceiptRegistryV2` to Galileo (after K-2 lands)
- **Why:** closes K-2 (Critical) — V1's `anchor()` writes `agentAddress = msg.sender` with no signature recovery, so anyone can anchor any receiptRoot claiming any agent identity. V2 recovers `agentAddress` from an EIP-712 typed-data signature with replay-protected nonces.
- **Status:** code work in flight (next item the cron picks up). Same shape as A-V2-K1 once shipped.



> **Network targeting note:** B-1 through B-7 are **application-layer** items — they all apply to both testnet AND mainnet equally. B-1 can ship on testnet today (A-1 wallet is already funded); the mainnet deploy waits on A-2. B-2 → B-7 are network-agnostic code/UX changes — a single PR ships them everywhere at once.

### B-1 · Deploy IvaronixReceiptGuard.sol to chain (testnet first, then mainnet)
- **Source:** `contracts/src/IvaronixReceiptGuard.sol` — 5/5 Foundry tests green (full suite 90/90).
- **Why it matters:** turns Ivaronix from a *log* into a *gate*. Any external Safe / x402 contract / vendor approval flow can require a verifiable Ivaronix receipt before executing a tx.
- **Network targeting:** ship on **testnet first** (A-1 wallet is funded today, no funding wait), then **mainnet after A-2** funding. Two-step rollout = lower risk; same script, different `--rpc-url`.
- **Action:**
  - Step 1 (testnet, do whenever): `cd contracts && forge script script/DeployReceiptGuard.s.sol --rpc-url https://evmrpc-testnet.0g.ai --broadcast --private-key <deployer>` (script needs writing — straightforward template from existing deploy scripts).
  - Step 2 (mainnet, after A-2): same command with `--rpc-url https://evmrpc.0g.ai`.
  - After each: add the deployed address to `deployments/<testnet|mainnet>.json` under `IvaronixReceiptGuard`.
  - Update `apps/studio/src/app/docs/page.tsx` to link the new contract address from the 0G Chain card.

### B-2 · Wire SIWE (sign-in-with-ethereum) for Studio user-side anchoring
- **Why it matters:** today every Studio-anchored receipt is signed by the operator's `EVM_PRIVATE_KEY`, not the connected browser wallet. The receipt page is honest about this (the agent address is shown), but the model would be cleaner if the user's connected wallet signed.
- **Source:** `apps/studio/src/app/api/run/route.ts:24-25` flagged in `docs/PHASE_B_DISCLOSURES.md` item 1.
- **Action:** add SIWE middleware (Vercel guide: `https://docs.vercel.com/integrations/siwe`), expose a client-side wagmi sign-and-anchor path, tag every Studio-anchored receipt with `signedBy: 'user' | 'operator'`.

### B-3 · npm-publish `@ivaronix/widget`
- **Source:** `packages/widget/` — code-complete, README written, 0 deps beyond peer React.
- **Action:** `cd packages/widget && pnpm publish --access public`.
- **Verify:** `npm view @ivaronix/widget` returns the package metadata.
- **Effect:** any third-party React app can `import { ReceiptVerifier }` and surface our brand on their pages.

### B-3a · Spin up the 0G Persistent Memory sidecar (one-time per machine)
- **What it is:** the `0g-memory` sidecar service runs locally as a Docker-composed stack of MongoDB + Elasticsearch + Milvus + Redis + the `zgs_kv` 0G chain-sync binary. Adds the 6th 0G primitive to Ivaronix's claim — matches AIsphere's "all 6 primitives."
- **Source:** `oglabs resources/0g-memory/README.md` + `oglabs resources/0g-memory/docs/api_docs/memory_api.md`.
- **Action:**
  - `cd oglabs\ resources/0g-memory && bash install.sh` (one-time setup)
  - `bash start_service.sh` — sidecar listens on `http://localhost:1995`
  - Add to `.env`: `ZG_MEMORY_URL=http://localhost:1995`
  - That's it — the runtime auto-detects via `MemoryClient.fromEnv()` and starts populating `request.memoryQuery` on every receipt.
- **Verify:** run `ivaronix doc ask sample.txt "..." --skill private-doc-review` twice; the second receipt's `request.memoryQuery.retrievedCount` should be > 0 (the second run reads the first run's anchored memory back as context).
- **No mainnet equivalent yet.** The sidecar is wallet-keyed (encrypted with a key derived from `EVM_PRIVATE_KEY`) so it works against either testnet or mainnet receipts depending on which network the receipts were anchored on.

### B-4 · Anchor data-room manifests on 0G Storage (not just local)
- **Why it matters:** today `apps/studio/src/app/data-room/[id]/page.tsx` reads only the local FS. A judge browsing the deployed Studio on a different host sees "Room not found" because the manifest was created on the operator's machine.
- **Action:** at room-creation time, also upload the manifest JSON to 0G Storage and store the storage root in the on-chain receipt's `storage.evidenceRoot`. Then make the page fetch by storage root, with local FS as fallback.

### B-5 · Wire on-chain payout for fee_split
- **Why it matters:** every receipt records `billing.feeSplit` (creatorBps + treasuryBps + creatorPassport). The bps values are accurate to what we agreed. The actual OG transfer to the creator's wallet is not yet executed — `packages/runtime/src/pipeline.ts:590` `post_anchor` hook is a documented TODO.
- **Action:** add an OG transfer in the post-anchor hook that splits `billing.estimatedCostOg` between creator and treasury wallets after the chain anchor confirms.

### B-6 · /global "OG spent" → wire to indexer
- **Source:** `apps/studio/src/app/global/page.tsx:90` — currently reads only `.ivaronix/receipts/anchored/` on the Studio process's disk. On a fresh deploy the stat shows 0.000000 OG.
- **Action:** point at `ivaronix indexer` SQLite (already exists, ships with the CLI).

### B-7 · SubscriptionEscrow CLI surface
- **Source:** `contracts/src/SubscriptionEscrow.sol` — deployed, but no CLI / Studio entry.
- **Action:** `ivaronix subscription create / checkin / status` + a `/subscriptions` Studio page. Track 3 follow-up.

---

## C · Distribution + outreach (operator-only by nature)

> **Network targeting note:** C-1, C-3, C-4 are **network-agnostic** (they apply whether the user is on testnet or mainnet). C-2 (ChainGPT audit) is **mainnet-only** — you audit *before* mainnet, not before testnet.

### C-1 · Telegram bot live · network-agnostic
- Documented as Phase B in earlier QA passes. Needs a BotFather token. Strictly external to the codebase. The bot would expose receipt verification + skill discovery commands; same surface on testnet and mainnet.

### C-2 · ChainGPT audit booking · mainnet-only
- The mainnet-readiness checklist mentions a ChainGPT audit. Requires booking + payment. **Schedule before mainnet promotion (A-2)**, not before testnet — testnet contracts have already been live and exercised by 1300+ receipts without incident, which is its own kind of soak-testing.

### C-3 · Domain config (ivaronix.studio) · network-agnostic
- The widget defaults to `https://ivaronix.studio`. The actual production domain needs DNS + HTTPS provisioning. One config covers both networks (the network is a runtime variable, not a deploy-time one).

### C-4 · Demo Day prep · network-agnostic
- The Hong Kong Web3 Festival Mini Demo Day is referenced in the judging criteria. Live performance is "a key reference." Demo on whichever network is current at the time (testnet today, mainnet if A-2 lands first).

---

## D · Reference (not actions, just reminders)

- **Faucet:** `https://faucet.0g.ai` (Galileo only; mainnet has no faucet).
- **Network params:** chainId 16602 (Galileo) / 16661 (Aristotle mainnet) · RPC `evmrpc-testnet.0g.ai` / `evmrpc.0g.ai` · explorer `chainscan-galileo.0g.ai` / `chainscan.0g.ai`.
- **Operator wallet:** `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` (current testnet deployer).
- **Half-baked items list** (auto-tracked): `docs/PHASE_B_DISCLOSURES.md`. Anything in there that I (the agent) cannot ship is also listed in section B above.

---

## E · Things I will NOT bother you about

- Bug fixes, typecheck failures, test regressions — I handle these myself per CLAUDE.md §11.
- Adding new features that pass the PMF filter and don't need money — I ship them and tick `docs/planning-01.md`.
- Documentation updates — I append to the right `docs/*.md` file as I go.
- Receipt verification, voice checks, brand-HTML diffs — pre-flight every time.
- Anything in `og-projects-showcase` / `entries` / `new-entries` that closes a judging-criterion gap and that I can build without funding — I build.
