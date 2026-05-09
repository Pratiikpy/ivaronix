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

## B · Phase-B production hardening (post-grant lift, do whenever)

### B-1 · Deploy IvaronixReceiptGuard.sol to chain
- **Source:** `contracts/src/IvaronixReceiptGuard.sol` — 5/5 Foundry tests green (full suite 90/90).
- **Why it matters:** turns Ivaronix from a *log* into a *gate*. Any external Safe / x402 contract / vendor approval flow can require a verifiable Ivaronix receipt before executing a tx.
- **Action:**
  - Once A-1 / A-2 funding is in: `cd contracts && forge script script/DeployReceiptGuard.s.sol --rpc-url <galileo-or-mainnet> --broadcast --private-key <deployer>` (script needs writing — straightforward template from existing deploy scripts).
  - Add the deployed address to `deployments/<network>.json` under `IvaronixReceiptGuard`.
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

### C-1 · Telegram bot live
- Documented as Phase B in earlier QA passes. Needs a BotFather token. Strictly external to the codebase.

### C-2 · ChainGPT audit booking
- The mainnet-readiness checklist mentions a ChainGPT audit. Requires booking + payment.

### C-3 · Domain config (ivaronix.studio)
- The widget defaults to `https://ivaronix.studio`. The actual production domain needs DNS + HTTPS provisioning.

### C-4 · Demo Day prep
- The Hong Kong Web3 Festival Mini Demo Day is referenced in the judging criteria. Live performance is "a key reference."

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
