import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * Server-side helper: locate a locally-saved receipt JSON whose
 * `storage.receiptRoot` matches the provided bytes32 root. Walks parent
 * directories from the studio cwd looking for `.ivaronix/receipts/anchored/`.
 *
 * Returns the parsed JSON or `null` when no matching receipt exists locally.
 * (Day 22 will fall back to 0G Storage download once B-1 is unblocked.)
 */
export interface LocalReceiptLookup {
  root: string;             // 0x… 64-hex
  path: string;             // absolute file path
  body: ReceiptBody;        // parsed JSON
}

export interface ReceiptBody {
  id: string;
  type: string;
  signature?: string;
  storage?: { receiptRoot: string };
  outputs?: {
    outputHash?: string;
    citations?: string[];
    riskLevel?: 'low' | 'medium' | 'high';
    wording?: { headline?: string; doNotSay?: string[] };
  };
  request?: { skillId?: string; skillVersion?: string; skillManifestHash?: string };
  agent?: { ownerWallet?: string; passportId?: string };
  chainAnchor?: { anchorTxHash?: string; anchorBlockNumber?: number; anchorTimestamp?: number };
  teeVerification?: {
    requested?: boolean;
    routerVerified?: boolean;
    independentVerified?: boolean | null;
    providerAddress?: string;
  };
  billing?: { totalCostOg?: string; inputTokens?: number; outputTokens?: number };
  execution?: { burnMode?: boolean; consensusMode?: boolean; mode?: string };
  // …rest of fields are in the file but we don't need them on the public page
  [key: string]: unknown;
}

function findReceiptsDir(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, '.ivaronix', 'receipts', 'anchored');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function findLocalReceiptByRoot(receiptRoot: string): LocalReceiptLookup | null {
  const dir = findReceiptsDir();
  if (!dir) return null;
  const target = receiptRoot.toLowerCase();
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const file = resolve(dir, entry);
    try {
      if (!statSync(file).isFile()) continue;
      const body = JSON.parse(readFileSync(file, 'utf8')) as ReceiptBody;
      const root = body.storage?.receiptRoot?.toLowerCase();
      if (root && root === target) {
        return { root, path: file, body };
      }
    } catch {
      /* skip unreadable / malformed */
    }
  }
  return null;
}
