# Ivaronix · Privacy notes

> Closes planning-003 §A.5.3 (WT 46). The product is built around honest receipts; this doc names the specific privacy boundaries the receipt model does NOT cover, so a reviewer or operator can act with their eyes open.

## 1. Operator-as-proxy

The 0G Storage indexer requires a signer for every fetch — uploads AND reads. By default the same operator wallet that signs receipts also signs every public-manifest fetch. That means:

- The operator wallet's address shows up in indexer logs for every blob the operator's machine reads, including blobs the operator is not a party to.
- For data-room flows, the operator signing public-manifest reads on behalf of an arbitrary user is **leaky by default**: the operator sees that "user X (or someone the operator served) read room Y."

The receipt model does NOT defend against this — receipts attest to inference output, not to read patterns at the storage layer.

### Mitigation: the read-proxy key — **PENDING (declared, no runtime consumer)**

> **Honest status (cron iter-170, 2026-05-13):** the env field is declared and the alias chain is locked by 3 source-file regressions, but **no runtime path actually reads `env.readProxyPrivateKey`** today. Setting `IVARONIX_READ_PROXY_KEY` in `.env` has no effect at all in this commit. The operator wallet still signs every indexer call. Tracked in `docs/USER_TODO.md` for closure.

The runtime accepts an optional separate signing key for read-only indexer auth, surfaced as either env var:

- `IVARONIX_READ_PROXY_KEY` (canonical)
- `READ_PROXY_PRIVATE_KEY` (legacy alias)

Wire-up plan: `packages/runtime/src/env.ts` parses the value into `readProxyPrivateKey` on `Env`. When the consumer ships, public-fetch paths (`packages/og-storage/src/indexer.ts` + Studio `/r/[id]` data fetches) will sign with this key instead of the operator's `IVARONIX_SIGNER_KEY`. Recommended setup once the consumer lands:

1. Generate a fresh wallet: `node -e 'const{Wallet}=require("ethers");const w=Wallet.createRandom();console.log(w.address);console.log(w.privateKey);'`
2. **Do NOT fund it.** It needs zero balance — indexer auth doesn't pay gas, only signs the request.
3. Set `IVARONIX_READ_PROXY_KEY=<the-private-key>` alongside `IVARONIX_SIGNER_KEY` in `.env`.
4. The operator wallet's address now only appears in indexer logs for actual writes (uploads, anchors). Reads sign with the read-proxy.

The read-proxy address is still public — anyone watching the indexer sees that "this proxy fetched blob X" — but it can't be linked back to the operator unless the operator publishes the binding. Treat the read-proxy as a unique-per-operator-deployment pseudonym.

### Mitigation: edge-cache public manifests — **PENDING (recommendation, not configured)**

> **Honest status (cron iter-170, 2026-05-13):** `apps/studio/next.config.ts:headers()` ships 4 defensive security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS) but **no `cache-control` directives at all**. The recommendation below is correct in principle and worth implementing; it is not currently in effect.

Public manifests are deterministic by `rootHash`. The Vercel edge cache should hold them aggressively so the indexer is hit at most once per (rootHash, cache-window) pair:

```ts
// In a Studio route handler that fetches a public manifest:
return new Response(body, {
  headers: {
    'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  },
});
```

When wired, the cache plus the read-proxy key together would mean a typical reviewer hitting `/r/<id>` triggers zero indexer reads from the operator wallet on the warm-cache path.

### Threat model

Defends against: passive operator-side disclosure via indexer log correlation. The operator wallet address no longer appears in indexer logs for arbitrary user reads.

Does NOT defend against:
- An active operator who logs read patterns inside their own infrastructure (the Studio process itself sees the cache miss).
- An indexer operator (0G Storage's infrastructure) deciding to log the read-proxy address. That's a 0G Foundation policy question, not an Ivaronix one.
- Side-channels (timing, traffic volume) that could re-identify a read pattern even when the signer is anonymized.

## 2. Burn Mode does NOT defend against local-machine compromise

`packages/og-storage/src/burn.ts:13-14` is canonical. Burn Mode encrypts blobs with a one-shot AES-256-GCM session key that's destroyed right after `uploadEncryptedBurn()` returns. The ciphertext on 0G Storage is unreadable by the operator after that.

Defends against: operator-side disclosure of the plaintext after the run.

Does NOT defend against:
- Plaintext extraction from a compromised local Node process during the run window (the key is in memory until destroyed).
- The model output itself leaking sensitive content into the receipt's `outputs` block (the receipt body is signed and chain-anchored; redact at hook-stage if this matters).
- Side-channels (request size, timing) that reveal "something was processed" even when the content is sealed.

## 3. TIER 1 vs TIER 2 — the privacy line

TIER 1 receipts run inference inside a 0G Compute TEE. The plaintext is invisible outside the TEE; the Router sees the request body, but the actual model never has its outputs exfiltrated unencrypted. The TEE attestation is what makes `verificationMethod: 'router_flag'` and `'compute_sdk_process_response'` honest.

TIER 2 receipts run inference on NVIDIA NIM, OpenAI, or Ollama. The plaintext is visible to that provider; the receipt is still signed and chain-anchored, but the privacy story is "you trust the provider's privacy policy." We render TIER 2 in amber and tag `verificationMethod: 'external-signed'` so a reviewer can tell at a glance which path ran.

If your data is sensitive enough that you wouldn't paste it into an OpenAI prompt, do not use TIER 2. The receipt itself can't fix that.

## 4. Receipt body content is public

A receipt's `body.outputs` is part of the canonical hash and lives in 0G Storage as a signed JSON blob. Anyone who fetches the receipt can read the outputs.

If the model summarizes a private contract into the `wording.headline` field, that headline is public. Burn Mode + the read-proxy key keep the **input** private; they don't redact the **output** unless a `pre_consensus` or `post_consensus` hook strips sensitive content before it lands on the receipt.

For sensitive flows, write a redaction hook at `seed-skills/<skill>/SKILL.md` referencing `redact_pii` or a custom hook in `packages/skills/src/hooks/`. The receipt then anchors the redacted output, not the raw one.

## 5. What to tell users

When users connect a wallet to Ivaronix, they should know:

- Their wallet address is on every receipt they sign — that's intentional, that's the proof model.
- Their wallet address is NOT on receipts other people sign, even when they read those receipts (with the read-proxy key set per §1).
- If they paste sensitive content into a TIER 2 flow, the model provider sees it in the clear.
- If they paste sensitive content into a TIER 1 flow, the TEE protects it — the Router sees the request, but the inference output never leaves the TEE unencrypted.

## See also

- `docs/CRYPTO_NOTES.md` — the broader cryptographic primitive choices.
- `packages/og-storage/src/burn.ts` — Burn Mode threat-model JSDoc.
- `packages/og-router/src/keyring.ts` — Router credential rotation transparency (planning-003 §A.5.14).
- CLAUDE.md §6 (TIER 1 vs TIER 2 honesty rule).
