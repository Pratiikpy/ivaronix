/**
 * Receipt indexer worker (PASS 76 S-5).
 *
 * Sweeps `ReceiptAnchored` logs from a 0G chain RPC and writes them to the
 * IndexerDb. Two modes:
 *   - backfill(fromBlock, toBlock) — one-shot range sweep, useful for catch-up
 *   - tail(opts)                   — open-ended poll loop until stop()
 *
 * On chain is the source of truth. The DB is a queryable replica. If the
 * file is wiped, a fresh backfill from the contract's deploy block reproduces
 * the same state byte-for-byte.
 */

import { JsonRpcProvider, Contract } from 'ethers';
import {
  RECEIPT_REGISTRY_ABI,
} from '@ivaronix/og-chain';
import type { Address, Hash } from '@ivaronix/core';
import { IndexerDb, type IndexedReceipt } from './db.js';

export interface WorkerOptions {
  rpcUrl: string;
  chainId: number;
  contractAddress: Address;
  /** V1 = legacy ReceiptRegistry, V2 = ReceiptRegistryV2 with EIP-712,
   *  V3 = ReceiptRegistryV3 with canonical slot 10/11/12 admission.
   *  V2 + V3 share the same `ReceiptAnchored(id, root, agent, type, store, attest, relayer, nonce)`
   *  event signature so the worker handles both with one ABI; only the
   *  registryVersion tag differs in the indexed row. */
  registryVersion?: 1 | 2 | 3;
  /** Max blocks per RPC call. Galileo public RPC caps around 10k; default 5k for safety. */
  blockChunkSize?: number;
}

export interface BackfillResult {
  fromBlock: number;
  toBlock: number;
  insertedRows: number;
  scannedBlocks: number;
}

export class IndexerWorker {
  readonly db: IndexerDb;
  readonly opts: Required<Pick<WorkerOptions, 'rpcUrl' | 'chainId' | 'contractAddress' | 'registryVersion' | 'blockChunkSize'>>;
  private provider: JsonRpcProvider;
  private contract: Contract;
  private stopFlag = false;

  constructor(db: IndexerDb, opts: WorkerOptions) {
    this.db = db;
    this.opts = {
      rpcUrl: opts.rpcUrl,
      chainId: opts.chainId,
      contractAddress: opts.contractAddress,
      registryVersion: opts.registryVersion ?? 1,
      blockChunkSize: opts.blockChunkSize ?? 5000,
    };
    this.provider = new JsonRpcProvider(this.opts.rpcUrl, { chainId: this.opts.chainId, name: 'og' });
    this.contract = new Contract(this.opts.contractAddress, RECEIPT_REGISTRY_ABI, this.provider);
  }

  async backfill(fromBlock: number, toBlockMaybe?: number): Promise<BackfillResult> {
    const head = await this.provider.getBlockNumber();
    const toBlock = Math.min(toBlockMaybe ?? head, head);
    if (fromBlock > toBlock) {
      return { fromBlock, toBlock, insertedRows: 0, scannedBlocks: 0 };
    }

    const filter = this.contract.filters.ReceiptAnchored!();
    let inserted = 0;
    let scanned = 0;

    for (let cursor = fromBlock; cursor <= toBlock; cursor += this.opts.blockChunkSize) {
      const chunkEnd = Math.min(cursor + this.opts.blockChunkSize - 1, toBlock);
      const logs = await this.contract.queryFilter(filter, cursor, chunkEnd);

      const rows: IndexedReceipt[] = [];
      // Cache block timestamps to avoid N round-trips.
      const blockTsCache = new Map<number, number>();
      for (const log of logs) {
        let ts = blockTsCache.get(log.blockNumber);
        if (ts === undefined) {
          const blk = await this.provider.getBlock(log.blockNumber);
          ts = blk?.timestamp ?? 0;
          blockTsCache.set(log.blockNumber, ts);
        }
        // ethers v6 EventLog has args by name when ABI is supplied; fall back to indexes.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as
          | { id?: bigint; receiptRoot?: string; agent?: string; receiptType?: bigint; storageRoot?: string; attestationHash?: string }
          | undefined;
        if (!args) continue;
        rows.push({
          id: Number(args.id ?? 0n),
          registryVersion: this.opts.registryVersion,
          receiptRoot: (args.receiptRoot ?? '0x') as Hash,
          storageRoot: (args.storageRoot ?? '0x') as Hash,
          attestationHash: (args.attestationHash ?? '0x') as Hash,
          agent: ((args.agent ?? '0x0').toLowerCase()) as Address,
          receiptType: Number(args.receiptType ?? 0n),
          blockNumber: log.blockNumber,
          blockTimestamp: ts,
          txHash: log.transactionHash as Hash,
          logIndex: log.index,
        });
      }

      if (rows.length > 0) inserted += this.db.upsertMany(rows);
      scanned += chunkEnd - cursor + 1;
      this.db.setCursor(this.opts.contractAddress, chunkEnd);
    }

    return { fromBlock, toBlock, insertedRows: inserted, scannedBlocks: scanned };
  }

  /**
   * Tail loop. Resumes from the cursor (or fromBlock if no cursor exists),
   * sleeping `pollIntervalMs` between polls. Stops cleanly on stop().
   */
  async tail(args: { fromBlock?: number; pollIntervalMs?: number; onTick?: (r: BackfillResult) => void }): Promise<void> {
    this.stopFlag = false;
    const cursor = this.db.getCursor(this.opts.contractAddress);
    let from = cursor ? cursor.lastBlock + 1 : args.fromBlock ?? 0;
    const interval = args.pollIntervalMs ?? 6000;

    while (!this.stopFlag) {
      const head = await this.provider.getBlockNumber();
      if (head >= from) {
        const r = await this.backfill(from, head);
        from = r.toBlock + 1;
        args.onTick?.(r);
      }
      await new Promise((res) => setTimeout(res, interval));
    }
  }

  stop(): void {
    this.stopFlag = true;
  }
}
