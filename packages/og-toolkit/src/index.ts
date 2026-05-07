/**
 * @ivaronix/og-toolkit
 *
 * Receipt-aware-by-default DX wrappers around 0G's official SDKs. The quiet
 * long-term moat: every operation that goes through this toolkit can produce
 * a verifiable Action Receipt anchored on 0G Chain. Bare 0G SDKs give you
 * an output; this gives you an output + a receipt.
 *
 * Usage:
 *   import { createOg } from '@ivaronix/og-toolkit';
 *   const og = createOg({ network: 'testnet' });
 *   await og.storage.upload(buffer);                    // raw 0G storage call
 *   await og.compute?.chat({ userPrompt, model });      // raw 0G router call
 *   await og.runSkill({ skillId: 'github-audit', ...});// receipt-aware
 *
 * Phase A status: composition is live. `runSkill` (the receipt-aware helper)
 * delegates to `@ivaronix/runtime` which owns the canonical pipeline that
 * Studio and the CLI also use, so DX and behaviour stay aligned.
 */

import { createChainClient, type ChainClient } from '@ivaronix/og-chain';
import { createStorageClient, type StorageClient } from '@ivaronix/og-storage';
import { Keyring, RouterClient, type RouterCredential } from '@ivaronix/og-router';
import { createKvClient, type KvClient } from '@ivaronix/og-kv';
import {
  runPipeline as runPipelineCore,
  type PipelineInput,
  type PipelineOutput,
  type PipelineLogger,
} from '@ivaronix/runtime';
import type { Network } from '@ivaronix/core';

export interface OgToolkitOptions {
  network: Network;
  privateKey?: string;
  routerCredentials?: RouterCredential[];
  /** Optional logger for `runSkill`; defaults silent. */
  logger?: PipelineLogger;
}

export class OgToolkit {
  readonly network: Network;
  readonly chain: ChainClient;
  readonly storage: StorageClient;
  readonly compute: Keyring | RouterClient | null;
  readonly kv: KvClient;
  private readonly logger?: PipelineLogger;

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
    this.logger = opts.logger;

    if (opts.routerCredentials && opts.routerCredentials.length > 0) {
      this.compute = new Keyring(opts.routerCredentials);
    } else {
      this.compute = null;
    }
  }

  /**
   * Receipt-aware skill execution. Delegates to the canonical pipeline that
   * Ivaronix CLI / Studio / MCP server also use, so anyone consuming this
   * toolkit gets the same scanner + sandbox + hooks + consensus + on-chain
   * anchor flow as the first-party surfaces.
   *
   * @example
   * const og = createOg({ network: 'testnet' });
   * const r = await og.runSkill({
   *   skillId: 'github-audit',
   *   userPrompt: 'audit this contract',
   *   context: solidityCode,
   *   tier: 'standard',
   *   receipt: true,
   * });
   * console.log(r.finalText, r.receiptTxHash);
   */
  async runSkill(input: Omit<PipelineInput, 'logger'>): Promise<PipelineOutput> {
    return runPipelineCore({ ...input, logger: this.logger });
  }
}

/** One-import surface — the recommended entry point for new 0G builders. */
export function createOg(opts: OgToolkitOptions): OgToolkit {
  return new OgToolkit(opts);
}

// Re-export types so consumers don't need to depend on @ivaronix/runtime directly
export type { PipelineInput, PipelineOutput, PipelineLogger } from '@ivaronix/runtime';
export type { Network } from '@ivaronix/core';
