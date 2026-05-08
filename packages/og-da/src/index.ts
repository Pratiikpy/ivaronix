import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Minimal TypeScript client for 0G DA's Disperser gRPC service.
 *
 * The 0G DA stack has no public testnet HTTP endpoint — operators run a
 * `0g-da-client` Docker container that exposes a gRPC port (51001 by
 * convention). This module wraps the three public methods documented in
 * `disperser.proto` (DisperseBlob / GetBlobStatus / RetrieveBlob) with
 * Promise-based ergonomics and BigInt-safe types.
 *
 * Verification path: run `ivaronix doctor --da` for a real disperse +
 * retrieve roundtrip against a local DA client. If the client isn't
 * reachable, the doctor reports "endpoint unreachable" with the exact
 * docker-run command to set it up.
 */

export const DEFAULT_DA_ENDPOINT = 'localhost:51001';
/** From disperser.proto §DisperseBlobRequest: data ≤ 31744 KiB */
export const MAX_BLOB_SIZE = 31_744 * 1024;

export type BlobStatus =
  | 'UNKNOWN'
  | 'PROCESSING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'FINALIZED'
  | 'INSUFFICIENT_SIGNATURES';

export interface DisperseResult {
  status: BlobStatus;
  requestId: Uint8Array;
}

export interface BlobInfo {
  /** Hex-encoded storage root (0x-prefixed) — the canonical handle for retrieve. */
  storageRoot: `0x${string}`;
  epoch: bigint;
  quorumId: bigint;
}

export interface BlobStatusResult {
  status: BlobStatus;
  info?: BlobInfo;
}

interface DisperseBlobReply {
  result: number;
  request_id: Buffer;
}

interface BlobStatusReply {
  status: number;
  info?: { blob_header?: { storage_root: Buffer; epoch: bigint | string; quorum_id: bigint | string } };
}

interface RetrieveBlobReply {
  data: Buffer;
}

const STATUS_NAMES: BlobStatus[] = [
  'UNKNOWN',
  'PROCESSING',
  'CONFIRMED',
  'FAILED',
  'FINALIZED',
  'INSUFFICIENT_SIGNATURES',
];

function statusName(n: number): BlobStatus {
  return STATUS_NAMES[n] ?? 'UNKNOWN';
}

function bytesToHex(bytes: Buffer): `0x${string}` {
  return ('0x' + bytes.toString('hex')) as `0x${string}`;
}

function loadDisperserDef() {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/index.ts → ../proto/disperser.proto. Works for both src and dist.
  const protoPath = resolve(here, '..', 'proto', 'disperser.proto');
  const def = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: Number,
    defaults: true,
    oneofs: true,
  });
  const pkg = grpc.loadPackageDefinition(def) as unknown as {
    disperser: { Disperser: grpc.ServiceClientConstructor };
  };
  return pkg.disperser.Disperser;
}

export interface DaClientOptions {
  /** gRPC endpoint, e.g. `localhost:51001`. */
  endpoint?: string;
  /** Per-RPC deadline in ms. */
  timeoutMs?: number;
}

export class DaClient {
  readonly endpoint: string;
  readonly timeoutMs: number;
  private client: grpc.Client;

  constructor(opts: DaClientOptions = {}) {
    this.endpoint = opts.endpoint ?? DEFAULT_DA_ENDPOINT;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    const Disperser = loadDisperserDef();
    this.client = new Disperser(this.endpoint, grpc.credentials.createInsecure());
  }

  close(): void {
    this.client.close();
  }

  private deadline(): grpc.Deadline {
    return new Date(Date.now() + this.timeoutMs);
  }

  /** Reachability probe — invokes a no-op via gRPC channelz-style check. */
  async ping(): Promise<{ ok: true } | { ok: false; reason: string }> {
    return new Promise((resolveFn) => {
      this.client.waitForReady(Date.now() + 3_000, (err) => {
        if (err) resolveFn({ ok: false, reason: err.message });
        else resolveFn({ ok: true });
      });
    });
  }

  /** Submit bytes for dispersal. Returns request_id used to poll status. */
  disperseBlob(data: Uint8Array): Promise<DisperseResult> {
    if (data.length > MAX_BLOB_SIZE) {
      throw new Error(`blob size ${data.length} exceeds MAX_BLOB_SIZE (${MAX_BLOB_SIZE})`);
    }
    return new Promise((resolveFn, rejectFn) => {
      (this.client as unknown as {
        DisperseBlob: (
          req: { data: Uint8Array },
          options: { deadline: grpc.Deadline },
          cb: (err: Error | null, reply: DisperseBlobReply) => void,
        ) => void;
      }).DisperseBlob({ data }, { deadline: this.deadline() }, (err, reply) => {
        if (err) return rejectFn(err);
        resolveFn({
          status: statusName(reply.result),
          requestId: new Uint8Array(reply.request_id),
        });
      });
    });
  }

  /** Poll blob status by request_id. */
  getBlobStatus(requestId: Uint8Array): Promise<BlobStatusResult> {
    return new Promise((resolveFn, rejectFn) => {
      (this.client as unknown as {
        GetBlobStatus: (
          req: { request_id: Uint8Array },
          options: { deadline: grpc.Deadline },
          cb: (err: Error | null, reply: BlobStatusReply) => void,
        ) => void;
      }).GetBlobStatus({ request_id: requestId }, { deadline: this.deadline() }, (err, reply) => {
        if (err) return rejectFn(err);
        const result: BlobStatusResult = { status: statusName(reply.status) };
        const bh = reply.info?.blob_header;
        if (bh?.storage_root) {
          result.info = {
            storageRoot: bytesToHex(bh.storage_root),
            epoch: BigInt(bh.epoch ?? 0),
            quorumId: BigInt(bh.quorum_id ?? 0),
          };
        }
        return resolveFn(result);
      });
    });
  }

  /** Retrieve a previously-dispersed blob by its (storage_root, epoch, quorum_id) tuple. */
  retrieveBlob(storageRoot: `0x${string}`, epoch: bigint, quorumId: bigint): Promise<Uint8Array> {
    const root = Buffer.from(storageRoot.replace(/^0x/, ''), 'hex');
    return new Promise((resolveFn, rejectFn) => {
      (this.client as unknown as {
        RetrieveBlob: (
          req: { storage_root: Buffer; epoch: bigint; quorum_id: bigint },
          options: { deadline: grpc.Deadline },
          cb: (err: Error | null, reply: RetrieveBlobReply) => void,
        ) => void;
      }).RetrieveBlob(
        { storage_root: root, epoch, quorum_id: quorumId },
        { deadline: this.deadline() },
        (err, reply) => {
          if (err) return rejectFn(err);
          resolveFn(new Uint8Array(reply.data));
        },
      );
    });
  }

  /** Convenience: disperse + poll until finalized + retrieve. */
  async disperseAndFinalize(
    data: Uint8Array,
    opts: { pollIntervalMs?: number; pollTimeoutMs?: number } = {},
  ): Promise<{ requestId: Uint8Array; info: BlobInfo }> {
    const interval = opts.pollIntervalMs ?? 2_000;
    const timeout = opts.pollTimeoutMs ?? 5 * 60_000;
    const dispersed = await this.disperseBlob(data);
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const s = await this.getBlobStatus(dispersed.requestId);
      if (s.status === 'FINALIZED' && s.info) {
        return { requestId: dispersed.requestId, info: s.info };
      }
      if (s.status === 'FAILED' || s.status === 'INSUFFICIENT_SIGNATURES') {
        throw new Error(`blob dispersal failed: ${s.status}`);
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error(`blob did not finalize within ${timeout} ms`);
  }
}

export function createDaClient(opts: DaClientOptions = {}): DaClient {
  return new DaClient(opts);
}
