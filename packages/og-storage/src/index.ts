/**
 * 0G Storage SDK wrapper.
 *
 * NOTE: the official `@0gfoundation/0g-storage-ts-sdk` will be added as a runtime dep
 * during install. Until then, this module exports a typed stub that throws on use,
 * with a clear error pointing the user to install the SDK.
 *
 * Usage in code:
 *   import { createStorageClient } from '@ivaronix/og-storage';
 *   const storage = createStorageClient({ network: 'testnet', privateKey: ... });
 *   const { rootHash, txHash } = await storage.uploadEncrypted(buffer, 'aes-256-gcm', sessionKey);
 */

import { JsonRpcProvider, Wallet } from 'ethers';
import { NETWORKS, type Network } from '@ivaronix/core';

export interface StorageUploadResult {
  rootHash: `0x${string}`;
  txHash: `0x${string}`;
  size: number;
}

export interface EncryptionMetadata {
  type: 'aes-256-gcm' | 'wallet' | 'none';
  keyFingerprint?: `sha256:${string}`;
  destroyedAt?: number;
}

export interface StorageClientOptions {
  network: Network;
  privateKey: string;
}

/**
 * Storage client. Wraps 0G Storage SDK with reachability checks + receipt-aware metadata.
 * Real implementation arrives in Day 2 + Day 4 (Burn Mode).
 */
export class StorageClient {
  readonly network: Network;
  private provider: JsonRpcProvider;
  private signer: Wallet;
  readonly indexerUrl: string;

  constructor(opts: StorageClientOptions) {
    const cfg = NETWORKS[opts.network];
    this.network = opts.network;
    this.provider = new JsonRpcProvider(cfg.rpcUrl);
    this.signer = new Wallet(opts.privateKey, this.provider);
    this.indexerUrl = cfg.storageIndexer;
  }

  /** Reachability check for `ivaronix doctor --storage`. */
  async ping(): Promise<{ ok: true; status: number } | { ok: false; reason: string }> {
    try {
      // 0G Storage indexer responds 404 on root (no listing endpoint), 200 on probe paths.
      // Any HTTP response means DNS+TCP work and the service is alive.
      const res = await fetch(this.indexerUrl, { method: 'GET' });
      return { ok: true, status: res.status };
    } catch (err) {
      return { ok: false, reason: `Indexer unreachable: ${(err as Error).message}` };
    }
  }

  /**
   * Upload arbitrary bytes to 0G Storage.
   * STUB: real implementation lands in Day 2 once `@0gfoundation/0g-storage-ts-sdk` is installed.
   */
  async upload(_data: Uint8Array): Promise<StorageUploadResult> {
    throw new Error(
      '@ivaronix/og-storage upload not yet implemented. Install @0gfoundation/0g-storage-ts-sdk and complete in Day 2.',
    );
  }

  /**
   * Upload encrypted bytes with Burn Mode metadata captured.
   * STUB.
   */
  async uploadEncrypted(
    _data: Uint8Array,
    _encryptionType: 'aes-256-gcm',
    _sessionKey: Uint8Array,
  ): Promise<StorageUploadResult & { encryption: EncryptionMetadata }> {
    throw new Error(
      '@ivaronix/og-storage uploadEncrypted not yet implemented. Burn Mode lands in Day 4.',
    );
  }

  /**
   * Download bytes by root hash, optionally with Merkle proof verification.
   * STUB.
   */
  async download(_rootHash: `0x${string}`, _withProof = true): Promise<Uint8Array> {
    throw new Error('@ivaronix/og-storage download not yet implemented.');
  }

  /** Detect encryption mode from header without downloading the full blob. STUB. */
  async peekHeader(_rootHash: `0x${string}`): Promise<{ encrypted: boolean; type?: string }> {
    throw new Error('@ivaronix/og-storage peekHeader not yet implemented.');
  }
}

export function createStorageClient(opts: StorageClientOptions): StorageClient {
  return new StorageClient(opts);
}
