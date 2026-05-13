/**
 * FINAL_BUILD_PLAN.md Block H · IETF Agent Audit Trail (AAT) export.
 *
 * Spec: draft-rosenberg-aat-01 (pinned per D-8).
 *
 * Converts an Ivaronix receipt to AAT format using the mapping table
 * from `aat-mapping.ts`. The output is a JSON document a third-party
 * enterprise auditor can consume directly — every required AAT field
 * has a documented source on the receipt.
 *
 * Honesty rules:
 *   - Required AAT fields that don't have a source on the receipt are
 *     emitted with explicit `null` (the spec allows it as "unavailable").
 *   - Optional AAT fields with no source are omitted (not null'd) so
 *     downstream validators don't trip on absent-vs-missing semantics.
 *   - Receipt fields without an AAT counterpart ARE exported under an
 *     `ivaronix-ext` namespace (e.g., consensus details, polyglot hash
 *     vectors) — AAT explicitly supports vendor extensions.
 *   - Values that AAT requires in a different shape are transformed
 *     (e.g., Unix seconds → ISO-8601 strings) per the mapping table's
 *     `transform` callbacks.
 */
import type { ReceiptV1 } from './schema.js';
import { AAT_MAPPING_DRAFT_01, getReceiptValue, type AatFieldMapping } from './aat-mapping.js';

export interface AatExport {
  /** Spec version pinned at export time. */
  aat_spec: 'draft-rosenberg-aat-01';
  /** Map of AAT field name → projected receipt value. Required fields
   *  with missing sources land here as `null`. */
  required: Record<string, unknown>;
  /** Optional AAT fields that had a source on the receipt. Missing
   *  fields are not emitted. */
  optional: Record<string, unknown>;
  /** Ivaronix-specific receipt fields surfaced as the AAT vendor extension. */
  'ivaronix-ext': {
    /** Full unredacted receipt body for the auditor to cross-reference. */
    receipt: ReceiptV1;
    /** Spec sections this export claims to satisfy (for the auditor's
     *  compliance checklist). */
    sections_claimed: readonly string[];
  };
}

/**
 * Convert an Ivaronix receipt to AAT format.
 *
 * @param receipt The full receipt body (post-anchor, with signature).
 * @returns AatExport object — JSON-stringify for the final CLI output.
 */
export function exportReceiptAsAat(receipt: ReceiptV1): AatExport {
  const required: Record<string, unknown> = {};
  const optional: Record<string, unknown> = {};
  const sectionsClaimed = new Set<string>();

  for (const mapping of AAT_MAPPING_DRAFT_01) {
    if (mapping.aatField === null) continue; // no AAT counterpart; emitted as ivaronix-ext only

    const rawValue = getReceiptValue(receipt, mapping.ivaronixPath);
    const projected = mapping.transform ? mapping.transform(rawValue) : rawValue;

    if (mapping.required) {
      required[mapping.aatField] = projected ?? null;
      sectionsClaimed.add(mapping.aatSection);
    } else if (projected !== undefined && projected !== null) {
      optional[mapping.aatField] = projected;
      sectionsClaimed.add(mapping.aatSection);
    }
  }

  return {
    aat_spec: 'draft-rosenberg-aat-01',
    required,
    optional,
    'ivaronix-ext': {
      receipt,
      sections_claimed: [...sectionsClaimed].sort(),
    },
  };
}

/**
 * Count how many AAT required-fields have a non-null value in the export.
 * Used by tests to assert export coverage doesn't regress.
 */
export function countNonNullRequired(exp: AatExport): number {
  return Object.values(exp.required).filter((v) => v !== null && v !== undefined).length;
}

/**
 * Validate that every REQUIRED AAT field has a non-null projection from
 * the receipt. Returns a list of missing field names (empty array means
 * fully-covered export). Useful in tests + CLI to surface drift.
 */
export function missingRequiredAatFields(receipt: ReceiptV1): string[] {
  const missing: string[] = [];
  for (const m of AAT_MAPPING_DRAFT_01) {
    if (!m.required || m.aatField === null) continue;
    const raw = getReceiptValue(receipt, m.ivaronixPath);
    if (raw === undefined || raw === null) missing.push(m.aatField);
  }
  return missing;
}

// Convenience re-exports
export { AAT_MAPPING_DRAFT_01 } from './aat-mapping.js';
export type { AatFieldMapping };
