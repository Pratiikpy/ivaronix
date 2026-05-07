/**
 * @ivaronix/og-toolkit
 *
 * Receipt-aware-by-default DX wrappers around 0G's official SDKs.
 *
 * Differentiation vs `0g-kit` (community ultra-minimal wrappers):
 * Every operation through this toolkit AUTOMATICALLY produces a verifiable Action Receipt
 * via the daemon, anchored on 0G Chain. 0g-kit is bare wrappers; we add the receipt spine.
 *
 * Usage:
 *   import { createOg } from '@ivaronix/og-toolkit';
 *   const og = createOg({ network: 'testnet' });
 *   await og.storage.upload(buffer);          // produces a storage receipt
 *   await og.compute.chat(...);               // produces an inference receipt
 *   await og.chain.deploy(contract);          // produces a deploy receipt
 *
 * Phase A status: skeleton + composition. Receipt-aware path activates Day 2 once
 * `@ivaronix/receipts` is wired.
 */

import { createChainClient, type ChainClient } from '@ivaronix/og-chain';
import { createStorageClient, type StorageClient } from '@ivaronix/og-storage';
import { Keyring, RouterClient, type RouterCredential } from '@ivaronix/og-router';
import { createKvClient, type KvClient } from '@ivaronix/og-kv';
import type { Network } from '@ivaronix/core';

export interface OgToolkitOptions {
  network: Network;
  privateKey?: string;
  routerCredentials?: RouterCredential[];
}

export class OgToolkit {
  readonly network: Network;
  readonly chain: ChainClient;
  readonly storage: StorageClient;
  readonly compute: Keyring | RouterClient | null;
  readonly kv: KvClient;

  constructor(opts: OgToolkitOptions) {
    this.network = opts.network;

    if (!opts.privateKey) {
      throw new Error(
        '@ivaronix/og-toolkit requires a private key. Set OG_PRIVATE_KEY in your environment.',
      );
    }

    this.chain = createChainClient({ network: opts.network, privateKey: opts.privateKey });
    this.storage = createStorageClient({ network: opts.network, privateKey: opts.privateKey });
    this.kv = createKvClient();

    if (opts.routerCredentials && opts.routerCredentials.length > 0) {
      this.compute = new Keyring(opts.routerCredentials);
    } else {
      this.compute = null;
    }
  }
}

/** One-import surface — the recommended entry point. */
export function createOg(opts: OgToolkitOptions): OgToolkit {
  return new OgToolkit(opts);
}
