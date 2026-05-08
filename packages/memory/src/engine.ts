import { keccak256, toUtf8Bytes, Wallet, JsonRpcProvider } from 'ethers';
import { newId, type Address, type Hash } from '@ivaronix/core';
import {
  CapabilityRegistryClient,
  MemoryAccessLogClient,
  MEMORY_ACCESS,
} from '@ivaronix/og-chain';
import type {
  Observation,
  ObservationMeta,
  RecallHit,
  RecallQuery,
  MemoryEngineOptions,
  MemoryManifest,
} from './types.js';
import { deriveMemoryKey, encryptObservation, decryptObservation } from './encryption.js';
import { embedAsync, EMBEDDING_DIM, EMBEDDING_METHOD, FlatVectorIndex } from './vector.js';
import { MemoryStore } from './fts.js';

function scopeHash(tag: string): Hash {
  return keccak256(toUtf8Bytes(`namespace:${tag}`)) as Hash;
}

export class MemoryEngine {
  private store: MemoryStore;
  private vector: FlatVectorIndex;
  private key: Buffer;
  readonly owner: Address;
  private opts: MemoryEngineOptions;
  private capability: CapabilityRegistryClient | null = null;
  private accessLog: MemoryAccessLogClient | null = null;

  private constructor(opts: MemoryEngineOptions) {
    this.opts = opts;
    this.owner = opts.ownerWallet;
    this.store = new MemoryStore(opts.dbPath);
    this.vector = new FlatVectorIndex();
    this.key = deriveMemoryKey(opts.ownerPrivateKey);

    // Restore vector index from disk
    const observations = this.store.listAll();
    this.vector.replaceAll(
      observations.map((o) => ({ id: o.id, vector: o.vec })),
    );
  }

  static create(opts: MemoryEngineOptions): MemoryEngine {
    const engine = new MemoryEngine(opts);
    if (opts.enableOnChainPermissions && opts.capabilityRegistryAddress && opts.memoryAccessLogAddress && opts.rpcUrl) {
      const provider = new JsonRpcProvider(opts.rpcUrl, opts.chainId ? { chainId: opts.chainId, name: 'og-chain' } : undefined);
      const wallet = new Wallet(opts.ownerPrivateKey, provider);
      engine.capability = new CapabilityRegistryClient(opts.capabilityRegistryAddress, wallet);
      engine.accessLog = new MemoryAccessLogClient(opts.memoryAccessLogAddress, wallet);
    }
    return engine;
  }

  /** Remember an observation. Encrypts at rest and indexes via vector + FTS. */
  async remember(input: Omit<Observation, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): Promise<{ id: string; manifest: MemoryManifest; logTxHash?: Hash }> {
    const id = input.id ?? newId('obs');
    const createdAt = input.createdAt ?? Date.now();

    const ciphertext = encryptObservation(input.text, this.key);
    const { vec } = await embedAsync(input.text);

    const meta: ObservationMeta = {
      id,
      ciphertext,
      embeddingVector: vec,
      ftsContent: input.text, // plaintext stored in FTS for query (local-only file)
      tags: input.tags,
      source: input.source,
      createdAt,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      authorWallet: input.authorWallet ?? this.owner,
      parentReceiptId: input.parentReceiptId,
    };

    this.store.insertObservation(meta, input.text);
    this.vector.add(id, vec);

    const manifest = this.computeManifest();

    // Log a WRITE event on chain (best-effort; don't fail remember if logging fails)
    let logTxHash: Hash | undefined;
    if (this.accessLog) {
      try {
        // For owner self-write, grantId is zero
        const tx = await this.accessLog.logAccess(
          this.owner,
          ('0x' + '0'.repeat(64)) as Hash,
          manifest.rootHash,
          MEMORY_ACCESS.WRITE,
          input.tags.length > 0 ? scopeHash(input.tags[0]!) : (('0x' + '0'.repeat(64)) as Hash),
        );
        logTxHash = tx.hash as Hash;
        // Don't await receipt — write completed regardless
      } catch {
        // Local memory is the source of truth; on-chain log is best-effort
      }
    }

    return { id, manifest, logTxHash };
  }

  /** Recall top-K observations matching query. Permission-gated when caller != owner. */
  async recall(q: RecallQuery): Promise<{ hits: RecallHit[]; logTxHash?: Hash }> {
    const topK = q.topK ?? 5;

    // Permission check: if caller is not owner, require a valid grant
    if (q.caller && q.caller.toLowerCase() !== this.owner.toLowerCase()) {
      if (!this.capability || !q.grantId) {
        throw new Error('memory.recall: caller != owner and no grantId or capability registry available');
      }
      // Pick first tag for scope check (or zero scope if no tag filter)
      const sh = q.tags && q.tags.length > 0 ? scopeHash(q.tags[0]!) : (('0x' + '0'.repeat(64)) as Hash);
      const valid = await this.capability.isValid(q.grantId, q.caller, sh);
      if (!valid) {
        throw new Error('memory.recall: grant invalid (revoked/expired/wrong-scope/wrong-grantee)');
      }
      // Consume one read from the grant
      const tx = await this.capability.consumeRead(q.grantId);
      await tx.wait();
    }

    // Vector search
    const { vec: queryVec } = await embedAsync(q.text);
    const vectorHits = this.vector.search(queryVec, topK * 4); // overshoot, then refine

    // FTS search
    const ftsHits = this.store.ftsSearch(q.text, topK * 4, q.tags);

    // Fuse scores: 60% vector + 40% FTS
    const scoreById = new Map<string, { vec: number; fts: number }>();
    for (const v of vectorHits) {
      scoreById.set(v.id, { vec: v.score, fts: 0 });
    }
    for (const f of ftsHits) {
      const e = scoreById.get(f.id);
      if (e) e.fts = f.score;
      else scoreById.set(f.id, { vec: 0, fts: f.score });
    }

    const fused = Array.from(scoreById.entries())
      .map(([id, s]) => ({ id, score: 0.6 * s.vec + 0.4 * s.fts, vec: s.vec, fts: s.fts }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    // Hydrate hits with plaintext
    const hits: RecallHit[] = [];
    for (const f of fused) {
      const row = this.store.getById(f.id);
      if (!row) continue;
      // Tag filter post-fetch (in case vector index returned across-scope hits)
      if (q.tags && q.tags.length > 0) {
        const overlaps = row.tags.some((t) => q.tags!.includes(t));
        if (!overlaps) continue;
      }
      // Temporal filter
      if (q.fromTime && row.createdAt < q.fromTime) continue;
      if (q.toTime && row.createdAt > q.toTime) continue;

      const text = decryptObservation(row.ciphertext, this.key);
      hits.push({
        id: row.id,
        text,
        score: f.score,
        vectorScore: f.vec,
        ftsScore: f.fts,
        tags: row.tags,
        source: row.source ?? undefined,
        createdAt: row.createdAt,
        authorWallet: (row.authorWallet ?? undefined) as Address | undefined,
        parentReceiptId: row.parentReceiptId ?? undefined,
      });
    }

    // Log READ event on chain
    let logTxHash: Hash | undefined;
    if (this.accessLog && hits.length > 0) {
      try {
        const manifest = this.computeManifest();
        const sh = q.tags && q.tags.length > 0 ? scopeHash(q.tags[0]!) : (('0x' + '0'.repeat(64)) as Hash);
        const tx = await this.accessLog.logAccess(
          q.caller ?? this.owner,
          q.grantId ?? (('0x' + '0'.repeat(64)) as Hash),
          manifest.rootHash,
          MEMORY_ACCESS.READ,
          sh,
        );
        logTxHash = tx.hash as Hash;
      } catch {
        // Best-effort log; don't fail recall
      }
    }

    return { hits, logTxHash };
  }

  /** Delete by id. Emits DELETE access log. */
  async forget(id: string): Promise<{ logTxHash?: Hash }> {
    const row = this.store.getById(id);
    if (!row) throw new Error(`forget: no observation ${id}`);
    this.store.deleteObservation(id);
    this.vector.remove(id);

    let logTxHash: Hash | undefined;
    if (this.accessLog) {
      try {
        const manifest = this.computeManifest();
        const sh = row.tags.length > 0 ? scopeHash(row.tags[0]!) : (('0x' + '0'.repeat(64)) as Hash);
        const tx = await this.accessLog.logAccess(
          this.owner,
          ('0x' + '0'.repeat(64)) as Hash,
          manifest.rootHash,
          MEMORY_ACCESS.DELETE,
          sh,
        );
        logTxHash = tx.hash as Hash;
      } catch {
        // best-effort
      }
    }
    return { logTxHash };
  }

  /** Compute a manifest snapshot (would be uploaded to 0G Storage when B-1 is fixed). */
  computeManifest(): MemoryManifest {
    const observations = this.store.listAll();
    // Sort by createdAt for deterministic hash
    const sorted = observations.sort((a, b) => a.createdAt - b.createdAt);
    const concat = sorted.map((o) => `${o.id}:${o.createdAt}`).join('|');
    const rootHash = keccak256(toUtf8Bytes(concat)) as Hash;
    return {
      ownerWallet: this.owner,
      observationCount: sorted.length,
      rootHash,
      lastWriteAt: sorted.length > 0 ? sorted[sorted.length - 1]!.createdAt : 0,
      embedding: { dim: EMBEDDING_DIM, method: EMBEDDING_METHOD },
    };
  }

  count(): number {
    return this.store.observationCount();
  }

  close(): void {
    this.store.close();
  }
}
