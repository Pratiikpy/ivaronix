import { JsonRpcProvider, Wallet } from 'ethers';
import { Indexer, MemData } from '@0gfoundation/0g-ts-sdk';
import { NETWORKS, type Network } from '@ivaronix/core';
import { burnEncrypt, type BurnEncryptResult } from './burn.js';

export type Hex = `0x${string}`;

export interface StorageUploadResult {
  rootHash: Hex;
  txHash: Hex;
  size: number;
}

export interface BurnUploadResult extends StorageUploadResult {
  burn: {
    keyFingerprint: `sha256:${string}`;
    encryptionType: 'aes-256-gcm';
    destroyedAt: number;
  };
}

export interface StorageClientOptions {
  network: Network;
  privateKey: string;
}

export class StorageClient {
  readonly network: Network;
  readonly rpcUrl: string;
  readonly indexerUrl: string;
  private indexer: Indexer;
  private signer: Wallet;
  private provider: JsonRpcProvider;

  constructor(opts: StorageClientOptions) {
    const cfg = NETWORKS[opts.network];
    this.network = opts.network;
    this.rpcUrl = cfg.rpcUrl;
    this.indexerUrl = cfg.storageIndexer;
    this.provider = new JsonRpcProvider(cfg.rpcUrl);
    this.signer = new Wallet(opts.privateKey, this.provider);
    this.indexer = new Indexer(cfg.storageIndexer);
  }

  /** Reachability check for `ivaronix doctor --storage`. */
  async ping(): Promise<{ ok: true; status: number } | { ok: false; reason: string }> {
    try {
      const res = await fetch(this.indexerUrl, { method: 'GET' });
      return { ok: true, status: res.status };
    } catch (err) {
      return { ok: false, reason: `Indexer unreachable: ${(err as Error).message}` };
    }
  }

  /** Upload arbitrary bytes to 0G Storage. Returns root hash + tx hash. */
  async upload(data: Uint8Array, opts?: { fee?: bigint; expectedReplica?: number; finalityRequired?: boolean }): Promise<StorageUploadResult> {
    const file = new MemData(data);
    const uploadOpts = {
      tags: '0x',
      finalityRequired: opts?.finalityRequired ?? true,
      taskSize: 1,
      expectedReplica: opts?.expectedReplica ?? 1,
      skipTx: false,
      // Pass a healthy fee floor (~0.001 OG); SDK's auto-calculated fee can underestimate
      fee: opts?.fee ?? BigInt('1000000000000000'),
    };
    // Skip auto gas estimation by passing a fixed gasLimit — the FixedPriceFlow's
    // estimateGas reverts on Galileo testnet (likely a node-side simulation issue
    // or known testnet limitation; real submission may still succeed).
    const txOpts = { gasLimit: BigInt(2_000_000) };
    // The 0G SDK's bundled ethers uses CJS types; our package uses ESM types.
    // Same package & version, but TypeScript sees nominal type differences from `#private`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result, err] = await this.indexer.upload(file, this.rpcUrl, this.signer as any, uploadOpts, undefined, txOpts);
    if (err) {
      // Distinguish "already uploaded" (data exists) from real errors
      const msg = err.message ?? String(err);
      if (msg.includes('already') || msg.toLowerCase().includes('exists')) {
        // Upload succeeded earlier; try to retrieve the root hash by re-running merkle
        // Dedupe handling is queued; for now surface a hint in the error
        // so callers can recognize an "already uploaded" path and recover.
        throw new Error(`0G Storage upload error (likely dedupe): ${msg}`);
      }
      throw new Error(`0G Storage upload failed: ${msg}`);
    }
    // SDK 1.x returns a union: single (rootHash/txHash) or fragmented
    // (rootHashes[]/txHashes[]) — for our blob sizes we always get single,
    // but typecheck demands we handle both.
    const rootHash = ('rootHash' in result ? result.rootHash : result.rootHashes[0]) as Hex;
    const txHash = ('txHash' in result ? result.txHash : result.txHashes[0]) as Hex;
    return { rootHash, txHash, size: data.length };
  }

  /**
   * Burn Mode upload: encrypt with AES-256-GCM session key, destroy the key,
   * upload the ciphertext to 0G Storage. Returns root hash + burn metadata.
   */
  async uploadEncryptedBurn(plaintext: Uint8Array): Promise<BurnUploadResult> {
    const encrypted: BurnEncryptResult = burnEncrypt(plaintext);
    const result = await this.upload(encrypted.ciphertext);
    return {
      ...result,
      burn: {
        keyFingerprint: encrypted.keyFingerprint,
        encryptionType: encrypted.encryptionType,
        destroyedAt: encrypted.destroyedAt,
      },
    };
  }

  /** Download bytes by root hash to a local file path. Optionally verify Merkle proof. */
  async download(rootHash: Hex, outputPath: string, withProof = true): Promise<void> {
    const err = await this.indexer.download(rootHash, outputPath, withProof);
    if (err) throw new Error(`0G Storage download failed: ${err.message ?? String(err)}`);
  }

  /** Inspect storage node locations for a root (used by doctor + verify). */
  async getFileLocations(rootHash: Hex): Promise<unknown[]> {
    return this.indexer.getFileLocations(rootHash) as unknown as Promise<unknown[]>;
  }
}

export function createStorageClient(opts: StorageClientOptions): StorageClient {
  return new StorageClient(opts);
}

export { burnEncrypt, decryptWithKey } from './burn.js';
export type { BurnEncryptResult } from './burn.js';

export { memoryStreamId, MEMORY_STREAM_NAMESPACE } from './streamId.js';
