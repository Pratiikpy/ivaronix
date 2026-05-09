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
  // storage is fully declared below with all sub-fields.
  outputs?: {
    outputHash?: string;
    citations?: string[];
    riskLevel?: 'low' | 'medium' | 'high';
    wording?: { headline?: string; doNotSay?: string[] };
  };
  request?: { skillId?: string; skillVersion?: string; skillManifestHash?: string; priorReceiptIds?: string[] };
  agent?: { ownerWallet?: string; passportId?: string; signedBy?: 'operator' | 'operator-on-behalf-of-user' | 'user-direct' };
  chainAnchor?: { anchorTxHash?: string; anchorBlockNumber?: number; anchorTimestamp?: number };
  teeVerification?: {
    requested?: boolean;
    routerVerified?: boolean;
    independentVerified?: boolean | null;
    providerAddress?: string;
    verificationMethod?: 'router_flag' | 'compute_sdk_process_response' | 'external-signed';
  };
  billing?: {
    totalCostOg?: string;
    inputTokens?: number;
    outputTokens?: number;
    feeSplit?: {
      creatorBps: number;
      treasuryBps: number;
      creatorNeuron: string;
      treasuryNeuron: string;
      creatorPassport?: string;
      tier?: 'TIER_1' | 'TIER_2';
      tierMultiplierBps?: number;
      declaredCreatorBps?: number;
      declaredTreasuryBps?: number;
    };
  };
  storage?: {
    receiptRoot?: string;
    evidenceRoot?: string;
    encryption?: {
      enabled?: boolean;
      type?: 'aes-256-gcm' | 'wallet' | 'none';
      headerDetected?: boolean;
      keyFingerprint?: string;
    };
    daBlobRef?: {
      endpoint?: string;
      requestIdHex?: string;
      status?: string;
      blobBytes?: number;
      dispersedAt?: number;
    };
  };
  burn?: {
    sessionKeyDestroyedAt?: number;
    localCleanupStatus?: 'completed' | 'partial' | 'failed';
    tempPathsZeroed?: string[];
    wording?: string;
  };
  execution?: {
    burnMode?: boolean;
    consensusMode?: boolean;
    mode?: string;
    modelSelection?: { requested?: string; final?: string };
    providerRouting?: { finalProvider?: string };
    consensus?: {
      roles?: string[];
      convergenceScore?: number;
      agreementSummary?: string;
      disagreementSummary?: string;
      individualAttestations?: Array<{
        role: string;
        providerAddress?: string;
        attestationHash?: string;
        chatId?: string;
        independentVerified?: boolean | null;
      }>;
    };
  };
  // …rest of fields are in the file but we don't need them on the public page
  [key: string]: unknown;
}

/**
 * Returns ALL `.ivaronix/receipts/anchored` directories found while walking
 * ancestors of cwd, plus the canonical sibling locations under the
 * workspace root (apps/cli, apps/mcp-server, etc.). The CLI typically
 * writes receipts to apps/cli/.ivaronix/, which is a sibling of
 * apps/studio/ — a pure ancestor walk would never find it.
 */
function findReceiptsDirs(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let dir = process.cwd();
  let workspaceRoot: string | null = null;
  for (let i = 0; i < 12; i++) {
    const candidate = resolve(dir, '.ivaronix', 'receipts', 'anchored');
    if (existsSync(candidate) && !seen.has(candidate)) { out.push(candidate); seen.add(candidate); }
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) workspaceRoot = dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (workspaceRoot) {
    for (const sib of ['apps/cli', 'apps/mcp-server']) {
      const candidate = resolve(workspaceRoot, sib, '.ivaronix', 'receipts', 'anchored');
      if (existsSync(candidate) && !seen.has(candidate)) { out.push(candidate); seen.add(candidate); }
    }
  }
  return out;
}

export function findLocalReceiptByRoot(receiptRoot: string): LocalReceiptLookup | null {
  const dirs = findReceiptsDirs();
  const target = receiptRoot.toLowerCase();
  for (const dir of dirs) {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { continue; }
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
  }
  return null;
}
