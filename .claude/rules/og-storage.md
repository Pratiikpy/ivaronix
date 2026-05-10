# 0G Storage rules

> Auto-loads when working on `packages/og-storage/**`. Path-scoped guidance per planning-003 §A.4.2.

## Stack

- 0G Storage TS SDK: `@0gfoundation/0g-ts-sdk` (NOT `@0glabs`). Pin version.
- Indexer URL: `https://indexer-storage-testnet-turbo.0g.ai` (testnet) · prod URL once 0G mainnet Storage indexer is public.
- Auth: every indexer call requires a signer. The operator wallet signs by default. Per planning-003 §A.5.4 (operator-as-proxy privacy), use a separate `READ_PROXY_PRIVATE_KEY` for public read paths so operator wallet doesn't appear in indexer logs for unrelated reads.

## Hard rules

- **Content-addressed.** Storage roots are `keccak256(blob_chunks)`. NEVER mutate a blob in place — re-upload as a new root.
- **`signer as any`** is the ONLY permitted `any` cast in this package. Reason: 0G Storage SDK uses ethers v5 internals while the rest of the codebase is ethers v6. The SDK doesn't ship updated types yet; the runtime path works.
- **Burn Mode invariants** per `packages/og-storage/src/burn.ts`:
  - 256-bit AES-GCM session key, freshly generated via `randomBytes(32)`.
  - 96-bit GCM nonce via `randomBytes(12)` (K-20 fix · NEVER derive nonce from `Date.now()` or plaintext hash).
  - Layout: `nonce (12) || ciphertext || auth-tag (16)`. Self-contained blob.
  - Capture `keyFingerprint = sha256(key)` BEFORE zeroing the key buffer.
  - Threat model JSDoc in `burn.ts:13-14` is canonical: protects operator-side disclosure, does NOT protect against local-machine compromise.

## Common gotchas

- Indexer rate limit ~10 req/sec. Batch uploads.
- Chunked uploads: blobs > 8MB split. Track each chunk's hash; the final root is the Merkle root.
- Retrieval needs the same indexer URL. Cross-indexer retrieval doesn't work.

## Tests

No unit tests yet. `pnpm --filter @ivaronix/og-storage test` is `echo skip` today; queued in `docs/USER_TODO.md §B-V2-OG-STORAGE-TESTS`. When tests land, follow the convention: Node's built-in `node:test` runner via `tsx --test src/**/*.test.ts` (matches `packages/{core,consensus,skills,memory,receipts,og-chain}`). High-value targets: Burn Mode AES-GCM round-trip (encrypt → decrypt → original plaintext), nonce uniqueness across 10k randomBytes(12) draws (K-20 regression coverage), keyFingerprint capture happens BEFORE buffer zeroing.

## File location reference

- Main client: `packages/og-storage/src/index.ts`
- Burn Mode: `packages/og-storage/src/burn.ts`
- Indexer adapter: `packages/og-storage/src/indexer.ts`
