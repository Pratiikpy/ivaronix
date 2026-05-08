# Ivaronix Engineering Debug Log

> Provus-pattern playbook: every non-trivial incident gets a public-facing entry
> with **Symptom · Triage · Root cause · Fix · Time lost**. Future builders shipping
> on 0G read this BEFORE wiring the same primitive — the goal is for every entry
> to save someone else hours.

---

## I-1 · Solidity 0.8.19 vs OpenZeppelin v5 — pragma collision (Day 2-3, ~2h lost)

**Symptom.** `forge build` fails with errors like

```
Error (4292): Source "@openzeppelin/contracts/access/Ownable2Step.sol" requires
a different compiler version (current compiler is 0.8.19; want ^0.8.20).
```

even though every Ivaronix contract had `pragma solidity 0.8.19;` written explicitly.

**Triage.** Tried bumping just the `Ownable2Step` import to a v4 path — broke storage layout. Tried pinning OZ to v4 — the ERC-7857 verifier I needed is only in v5. Tried a `>=0.8.19 <0.9.0` ranged pragma in our contracts — OZ contracts still pinned `^0.8.20`, so resolution still fails.

**Root cause.** OpenZeppelin v5 made a hard pragma break: every `*.sol` ships with `^0.8.20`. There is no opt-out flag in `foundry.toml`. The toolchain treats them as a *minimum* requirement, not a hint.

**Fix.** Bump every Ivaronix contract pragma to `0.8.20` and set `evm_version = "cancun"` in `foundry.toml`. Both Provus and MUSASHI prod contracts use this combination — verified by reading their published verified-source pages on Etherscan. Foundry 1.5.1 supports cancun cleanly.

```toml
# foundry.toml
[profile.default]
solc_version = "0.8.20"
evm_version  = "cancun"
```

**Lesson.** When a peer dep does a major version bump, search "verified source" of a contract that's already deployed in prod with that combo — the chain has its own ground truth and saves you arguing with the toolchain.

---

## I-2 · `HASH_EXCLUDE` drift broke receipt re-verification (Day 4, ~3h lost)

**Symptom.** `ivaronix receipt verify` failed with "hash mismatch" on receipts the CLI itself had just written 30 seconds earlier. The signed JSON, signed body, and explorer-reported root all looked identical.

**Triage.** First instinct was a serialization bug — pretty-printed `JSON.stringify` putting different whitespace through different code paths. Verified with `diff -w` — bodies were byte-identical to canonical-form except for one set of fields that changed *after* signing.

**Root cause.** The receipt schema's "post-claim mutations" — fields populated AFTER the signature is computed (`anchorTxHash`, `anchorBlockNumber`, `anchorTimestamp`, the `receiptTxHash` echo, and `signature` itself) — must be excluded from canonical-hash computation. We had `HASH_EXCLUDE = {signature}` only. After the chainAnchor write-back step, the canonical form silently changed and verify always failed.

The first fix over-corrected: I added build-time fields like `proofDownloadVerified` to the exclude set. That's wrong — those fields are *part* of the claim and must be hashed. Re-verification would silently pass even when storage proof was tampered with.

**Fix.** Lock `HASH_EXCLUDE` to *exactly* the fields that are post-claim mutations of the receipt envelope:

```ts
const HASH_EXCLUDE = new Set([
  'signature',
  'anchorTxHash',
  'anchorBlockNumber',
  'anchorTimestamp',
  'receiptTxHash',
] as const);
```

Anything else stays in the canonical form and gets hashed.

**Lesson.** Canonical-JSON hashing requires a sharp distinction between *claim* fields (signed) and *envelope* fields (added by the chain after the fact). Get the boundary wrong in either direction and your receipt is either un-verifiable or accepts mutations. Document the intent next to the constant.

---

## I-3 · 0G Storage `FixedPriceFlow.submit()` reverts on testnet (Day 4, ~6h lost — STILL OPEN as B-1)

**Symptom.** Every upload via `@0glabs/0g-ts-sdk@0.3.3` to indexer `https://indexer-storage-testnet-turbo.0g.ai` reverts on the on-chain `submit()` call to `FixedPriceFlow` at `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296`. Tx is broadcast (block visible in explorer) but `status=0`.

**Triage.**

- Tried auto fee (`30733644962n` ≈ 3.07e-8 OG) → revert
- Tried manual fee `1e15n` (0.001 OG) → revert
- Tried explicit `gasLimit: 2_000_000` → tx broadcast (block 32092800, tx `0xcc06718c…`) with `status=0`
- Decoded tx data — confirmed `submit()` selector + correct submission struct
- Direct contract reads (`marketAddress()`, `MAX_DEPTH()`) also revert — public surface unknown
- Alternative `indexer-storage-testnet-standard.0g.ai` returns 503

**Root cause.** Unknown — the storage contract on this specific testnet revision either has paused state, an undocumented gating, or a deployment pinned to a different ABI than the one the SDK ships. Could not reproduce from documentation alone.

**Workaround applied.** Day-4 Burn Mode + receipt-anchor pipeline proceeds **without** 0G Storage upload. `storage.evidenceRoot` is populated with the local sha256 digest of the ciphertext (so it's still content-addressable) instead of the storage Merkle root. Receipt is still chain-anchored on `ReceiptRegistry`. The receipt's `burn` block correctly captures key fingerprint + destroyedAt locally. End-to-end verification path — schema → hash → signature → chain anchor → independent TEE — works fully.

**Plan to unblock.**

- Investigate by running a local 0G storage node and uploading via that.
- Open issue with 0G team on Discord with the full revert logs.
- Try newer SDK version (e.g. `@0glabs/0g-ts-sdk@0.4.x` if released).
- Use the `0g-storage-cli` Rust CLI directly as a fallback (per `0G_RESOURCES.md §3`).

**Impact.** Phase A demos work end-to-end except `evidenceRoot` is local-only; mainnet promotion (Phase B Day 23) likely uses different Storage infrastructure where this may not occur.

**Lesson.** When a primitive has an opaque revert and the docs match what your code does, walk the contract address up to the first thing whose source is verified on the explorer. If even that reverts on a public read, you're hitting deployment-specific state, not API misuse — open a real-time channel (Discord) and capture the full revert traceback in the issue.

---

## I-4 · Manifest schema change silently broke published skills (Day 12, ~30m lost)

**Symptom.** After adding the `og.hooks` block to the skill manifest schema in Day 11, every previously-published skill failed `ivaronix skill verify` with `MISMATCH` even though no SKILL.md content had changed. The Day-11 work itself published `private-doc-review@0.2.0` correctly; only Day-9/10 publications drifted.

**Triage.** Compared local `manifestHash` vs the on-chain hash for `github-audit@0.1.0`:

```
local manifestHash:    sha256:758f866a307abd…
onchain manifestHash:  0x2c23673945e0df…
```

Different. But the SKILL.md hadn't been touched.

**Root cause.** The Day-11 schema change added `hooks: Hooks.default({})` to the Zod schema. `.default({})` means: when a SKILL.md has *no* `og.hooks:` block, Zod synthesizes one. The synthetic `{}` is now part of the parsed manifest's canonical-JSON, so the sha256 changed for every old skill.

**Fix.** Switch to `.optional()` — the field stays absent in the parsed object when absent in the source YAML, and the canonical hash matches the original.

```ts
// before — every old skill's hash changed
hooks: Hooks.default({} as z.infer<typeof Hooks>),

// after — old skills' hash unchanged; new skills with hooks: declared still hash correctly
hooks: Hooks.optional(),
```

**Lesson.** Any change to a content-addressable schema is a versioning event. Either bump every consumer to a new version *and* re-publish the on-chain anchor, or make the new field optional so backwards-compat hashes hold. Test by hashing one canonical artifact before and after the change — if the hash moves, the change is breaking.

---

## I-5 · Next.js 15.0.3 + `@vercel/og` font path mangling on Windows (Day 15, ~45m lost)

**Symptom.** `/r/<id>/opengraph-image` returns `ERR_EMPTY_RESPONSE`. Server log:

```
ERR_INVALID_URL
input: '.\\file:\\C:\\Users\\prate\\Downloads\\oglabs\\node_modules\\
        .pnpm\\next@15.0.3_react-dom@19.0.0_react@19.0.0__react@19.0.0\\
        node_modules\\next\\dist\\compiled\\@vercel\\og\\
        noto-sans-v27-latin-regular.ttf'
```

**Triage.** The path is *real* (the .ttf exists at that location). The error is in URL parsing — Next is wrapping the absolute Windows path with `.\\file:\\` prefix instead of producing a clean `file:///C:/...` URL.

**Root cause.** Next 15.0.3 ships a Windows-incompatible bundled-font loader for `@vercel/og`. The path concatenation that produces a `file://` URL hits the wrong code branch on `win32`. Setting `fonts: []` on the `ImageResponse` constructor doesn't help — Next still preloads the font during `unstable_preloadEntries`, before the route handler runs.

**Fix.** Documented as a known-windows caveat. The `opengraph-image.tsx` route file is in place and metadata auto-includes the OG image URL. **On Vercel/Linux production, the same path resolves correctly and the OG card renders.** Local Windows preview falls back to the page's `<title>` metadata, which is sufficient for dev workflow. Reproducing on Linux (WSL or Vercel preview) confirms the fix path.

**Lesson.** A Windows-specific Node bug in a vendored bundle is rarely worth fighting; verify the Linux/Vercel path produces correct output and document the caveat. Don't ship a workaround that distorts the prod codepath.

---

## Indexing notes

- Open / unresolved: **B-1 (I-3)** above.
- Documented playbooks for incidents that no longer recur: **I-1, I-2, I-4, I-5**.
- Append future incidents below this line. Keep entries dated. Keep the structure: Symptom → Triage → Root cause → Fix → Lesson.
