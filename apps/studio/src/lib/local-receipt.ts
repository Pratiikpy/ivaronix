import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { z } from 'zod';

/**
 * Server-side helper: locate a locally-saved receipt JSON whose
 * `storage.receiptRoot` matches the provided bytes32 root. Walks parent
 * directories from the studio cwd looking for `.ivaronix/receipts/anchored/`.
 *
 * Returns the parsed JSON or `null` when no matching receipt exists locally.
 * (Future: fall back to 0G Storage download via the receipt's storageRoot —
 * gated on the storage upload path landing for Studio runs.)
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
    /**
     * True only if a fresh re-download from 0G Storage succeeded for the
     * evidenceRoot. Used by /r/[id] to gate the storage caption between
     * "re-download verified" (proof of upload) and "Merkle root for the
     * run's evidence blob" (no claim about retrievability). HALF_BAKED
     * §I-17 closure · sweep 168.
     */
    proofDownloadVerified?: boolean;
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
  let studioRoot: string | null = null;
  for (let i = 0; i < 12; i++) {
    const candidate = resolve(dir, '.ivaronix', 'receipts', 'anchored');
    if (existsSync(candidate) && !seen.has(candidate)) { out.push(candidate); seen.add(candidate); }
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) workspaceRoot = dir;
    if (existsSync(resolve(dir, 'next.config.ts')) || existsSync(resolve(dir, 'next.config.js'))) {
      studioRoot = dir;
    }
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
  // Bundled receipts · ships with the Vercel deploy so prod /r/<id>
  // can render the structured findings card for hand-picked receipts
  // (the legal cluster proof set + future demo path receipts).
  // Operator-local .ivaronix/ is still preferred when present; this
  // path is the fallback for environments where the receipt cache
  // wasn't synced. The directory is tracked in git (no gitignore rule)
  // unlike the operator-local .ivaronix/.
  if (studioRoot) {
    const bundled = resolve(studioRoot, 'src', 'data', 'receipts', 'anchored');
    if (existsSync(bundled) && !seen.has(bundled)) { out.push(bundled); seen.add(bundled); }
  }
  if (workspaceRoot) {
    const bundled = resolve(workspaceRoot, 'apps', 'studio', 'src', 'data', 'receipts', 'anchored');
    if (existsSync(bundled) && !seen.has(bundled)) { out.push(bundled); seen.add(bundled); }
  }
  return out;
}

/**
 * Minimum-shape validator for local-disk receipt JSON. HALF_BAKED §J-3
 * closure (sweep 205): the pre-fix code cast `JSON.parse(...)` straight
 * to ReceiptBody, so a migration-stale file (missing `id`, mistyped
 * `type`, corrupted top-level) crashed `/r/[id]` first paint with
 * `Cannot read 'X' of undefined`.
 *
 * The schema is intentionally narrow — it only requires the fields
 * every consumer actually reads (`id`, `type`) and uses `.passthrough()`
 * for everything else, so the existing loose `ReceiptBody` TS interface
 * still applies via upcast. Stricter validation lives in
 * `@ivaronix/receipts` `ReceiptV1Schema`; this shape exists for the
 * Studio's permissive disk-read path where adding fields shouldn't
 * break callers.
 */
const LocalReceiptShape = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
}).passthrough();

/**
 * Read a local receipt JSON and return it as a ReceiptBody if the
 * minimum shape parses, else null. Logs a one-line warning on parse
 * failure when IVARONIX_DEBUG is set so operators see what got
 * rejected; in normal mode the failure is silent (matches the
 * existing `skip malformed` pattern).
 */
function safeReadReceiptBody(file: string): ReceiptBody | null {
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(file, 'utf8')); }
  catch { return null; }
  const parsed = LocalReceiptShape.safeParse(raw);
  if (!parsed.success) {
    if (process.env.IVARONIX_DEBUG) {
      console.warn(`[local-receipt] skipped ${file}: ${parsed.error.issues[0]?.message ?? 'shape mismatch'}`);
    }
    return null;
  }
  // Upcast: the schema enforces id+type, the TS interface declares the
  // broader (permissive) shape via `[key: string]: unknown` so the rest
  // of the access paths are already optional-chained.
  return parsed.data as unknown as ReceiptBody;
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
      } catch { continue; }
      const body = safeReadReceiptBody(file);
      if (!body) continue;
      const root = body.storage?.receiptRoot?.toLowerCase();
      if (root && root === target) {
        return { root, path: file, body };
      }
    }
  }
  return null;
}

export { safeReadReceiptBody };
