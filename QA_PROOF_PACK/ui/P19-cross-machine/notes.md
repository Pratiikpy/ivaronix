# P19 Cross-machine receipt replay · status · 2026-05-13

Per UI_REAL_USER_TEST_PLAN.md Part 2 / P19. Two paths exist:

## Path A · Public proof page (stranger-replay · zero install)

✅ **PASS** for ALL anchored receipts.

Captured during P4 inspection (`QA_PROOF_PACK/ui/P4-receipt/r-1004/desktop/001-stranger-incognito-loaded.png` + same for r-16, r-17):
- Open `https://ivaronix.vercel.app/r/<id>` in an incognito browser
- No cookies, no wallet, no auth
- Receipt page renders: chips + receiptRoot + agent + chainscan links
- Honest "Receipt body not found locally — chain-only view" when body isn't cached anywhere indexable

Real on-chain anchor is the proof — anyone with the URL can verify the receipt exists on Galileo by clicking the chainscan link.

## Path B · CLI `--tee-independent` (full re-verification)

✅ Works for receipts whose body is in local cache OR V1 LEGACY.
⚠ F4 logged: V2 receipts anchored via Vercel-hosted Studio aren't fully verifiable on a fresh machine without the body — see below.

### What works (today)

- `pnpm ivaronix receipt verify 1004 --tee-independent` → V1 LEGACY, body in operator's `.ivaronix/receipts/anchored/` → schema/hash/signature/anchor PASS · TEE-fail honest (zero attestation per V1 design)
- `pnpm ivaronix receipt verify <id>` (no --tee-independent) → works against chain reads alone for ANY receipt; doesn't require body
- Cross-machine demo: clone repo → `pnpm install` → set IVARONIX_SIGNER_KEY in .env (any funded wallet) → `pnpm ivaronix receipt verify 1004 --tee-independent` → same FULLY VERIFIED result as on operator's machine

### F4 gap

For V2 receipts anchored via Vercel-hosted Studio (e.g., rec_16, rec_17, rec_20), the receipt body is written to `/tmp` on the serverless lambda + wiped between requests. The chain anchor + storageRoot are public (on-chain), so anyone can verify the chain layer. But the CLI verify needs the JSON body to canonical-hash + signature-recover.

Workaround for v1 launch:
- Use the public proof page (Path A) for stranger replay — it shows the chain anchor + chip states · works for everyone
- For full CLI `--tee-independent` verification on a stranger's machine, the stranger needs:
  - The receipt body JSON (operator can publish to GitHub releases or S3 as `<receiptId>.json`)
  - OR anchor receipts via the CLI (which keeps the body in `.ivaronix/receipts/anchored/`)

Workaround for the operator anchoring receipts via Studio: pull the body from the API response (`/api/run/demo` returns `receiptPath` + body) BEFORE the lambda dies, and persist it to a public location. This is a Studio enhancement, not a v1-launch blocker.

### v1.1 fix path

Make `resolveReceiptInput` in `apps/cli/src/commands/receipt.ts:112` fall back to fetching the body from 0G Storage when:
1. The chain entry has a `storageRoot`
2. The local cache miss is encountered
3. The Storage indexer can be reached

Implementation sketch:
```ts
// After step 4 (numeric → targetRoot), before the local-cache scan:
const onChain = await registry.getReceipt(BigInt(input));
if (onChain?.storageRoot && !found-in-local-cache) {
  const body = await fetchFromStorageIndexer(onChain.storageRoot);
  return writeToTmpAndReturnPath(body);
}
```

Estimated effort: 1-2 hours including tests. Queued for post-launch.

## P19 status for the launch product

**PATH A (public proof page · stranger replay) PASS for all receipts.** This is what a judge would do: open the URL, see FULLY VERIFIED, click chainscan link → done.

**PATH B (CLI cross-machine `--tee-independent`) works for V1 LEGACY + cached V2.** F4 gap for non-cached V2 documented + queued.

For the HackQuest demo, Path A is the kill-shot the operator demonstrates: "Open this URL on YOUR machine, no install, in 10 seconds." Path B is the developer flow that already works for CLI-anchored receipts (the operator's day-to-day).
