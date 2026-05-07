import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import type { ReceiptBody } from './local-receipt';

/**
 * Server-side helper: load all locally-saved anchored receipts from
 * `.ivaronix/receipts/anchored/` (walks parent dirs from cwd to find it).
 * Used by /global to compute aggregate stats — total OG spent, top skills.
 *
 * Bounded: returns the most recent N entries (newest mtime first).
 */
export interface ReceiptSummary {
  id: string;
  receiptRoot: string;
  skillId: string | null;
  skillVersion: string | null;
  totalCostOg: number;
  inputTokens: number;
  outputTokens: number;
  riskLevel: 'low' | 'medium' | 'high' | null;
  anchorTimestamp: number | null;
  anchorTxHash: string | null;
  ownerWallet: string | null;
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

export function loadAllLocalReceipts(maxEntries = 50): ReceiptSummary[] {
  const dir = findReceiptsDir();
  if (!dir) return [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files = entries
    .filter((e) => e.endsWith('.json'))
    .map((e) => {
      const file = join(dir, e);
      try {
        const stat = statSync(file);
        if (!stat.isFile()) return null;
        return { file, mtimeMs: stat.mtimeMs };
      } catch {
        return null;
      }
    })
    .filter((x): x is { file: string; mtimeMs: number } => x !== null)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, maxEntries);

  const out: ReceiptSummary[] = [];
  for (const { file } of files) {
    try {
      const body = JSON.parse(readFileSync(file, 'utf8')) as ReceiptBody & {
        billing?: { totalCostOg?: string; inputTokens?: number; outputTokens?: number };
      };
      const og = body.billing?.totalCostOg ? Number(body.billing.totalCostOg) : 0;
      out.push({
        id: body.id,
        receiptRoot: body.storage?.receiptRoot ?? '',
        skillId: body.request?.skillId ?? null,
        skillVersion: body.request?.skillVersion ?? null,
        totalCostOg: Number.isFinite(og) ? og : 0,
        inputTokens: body.billing?.inputTokens ?? 0,
        outputTokens: body.billing?.outputTokens ?? 0,
        riskLevel: body.outputs?.riskLevel ?? null,
        anchorTimestamp: body.chainAnchor?.anchorTimestamp ?? null,
        anchorTxHash: body.chainAnchor?.anchorTxHash ?? null,
        ownerWallet: body.agent?.ownerWallet ?? null,
      });
    } catch { /* skip unreadable / malformed */ }
  }
  return out;
}

export interface SkillUsageRow {
  skillId: string;
  count: number;
  totalCostOg: number;
}

export function topSkillsByUsage(receipts: ReceiptSummary[], limit = 5): SkillUsageRow[] {
  const map = new Map<string, SkillUsageRow>();
  for (const r of receipts) {
    if (!r.skillId) continue;
    const row = map.get(r.skillId) ?? { skillId: r.skillId, count: 0, totalCostOg: 0 };
    row.count += 1;
    row.totalCostOg += r.totalCostOg;
    map.set(r.skillId, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function totalOgSpent(receipts: ReceiptSummary[]): number {
  return receipts.reduce((sum, r) => sum + r.totalCostOg, 0);
}
