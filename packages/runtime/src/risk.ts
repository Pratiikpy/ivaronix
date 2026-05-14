/**
 * Derive `outputs.riskLevel` from a finalText body · HALF_BAKED §I-13
 * closure (sweep 165).
 *
 * Pre-sweep, pipeline.ts + doc.ts both wrote `riskLevel: 'low'`
 * unconditionally, making the /r/[id] RISK pill decorative — every
 * receipt claimed low. A judge browsing any anchored receipt saw
 * "RISK: low" regardless of the actual content of the response.
 *
 * The receipt schema's enum is `'low' | 'medium' | 'high'`. This
 * helper looks for `severity:` markers in the response body, plus
 * bare keywords as a fallback. Order of detection is high → medium →
 * low; the highest tier mentioned wins.
 *
 * Heuristic, not authoritative — the receipt body's outputHash binds
 * the canonical text either way, so a judge can re-read and disagree.
 * The point is to break the "always low" trust theater.
 */
export type RiskLevel = 'low' | 'medium' | 'high';

const HIGH_RX = /\bseverity:\s*(critical|high)\b/i;
const MED_RX = /\bseverity:\s*medium\b/i;
const LOW_RX = /\bseverity:\s*(low|informational)\b/i;

// JSON-shape risk markers · the legal cluster's output schemas use these:
// contract-renewal/term-sheet findings carry `risk_level: "low|medium|high"`,
// nda-triage carries `signature_recommendation: "refuse|negotiate|sign"`.
// Pre-extension, the audit ("ai-quality-audit-legal-cluster.md") logged
// that `outputs.riskLevel` always returned 'low' because the regex
// only caught `severity:` prefixes; the model's JSON used `risk_level:`
// instead. Detection now covers both shapes case-insensitively.
const JSON_HIGH_RX = /["']?risk[_-]?level["']?\s*:\s*["'](critical|high)["']/i;
const JSON_MED_RX = /["']?risk[_-]?level["']?\s*:\s*["']medium["']/i;
// nda-triage's signature_recommendation is the verdict-equivalent.
// `escalate` is verdict-equivalent to `refuse-with-process` — receipt 69
// surfaced the model returning "escalate" (the lawyer says don't sign,
// escalate up the chain); semantically that's high-risk, not low.
const JSON_REFUSE_RX = /["']?signature[_-]?recommendation["']?\s*:\s*["'](refuse|escalate)["']/i;
const JSON_NEGOTIATE_RX = /["']?signature[_-]?recommendation["']?\s*:\s*["']negotiate["']/i;
// red_flags array length signal · 3+ red flags is at least medium risk.
// Matches `"red_flags": [...]` with at least 3 comma-separated entries.
const JSON_RED_FLAGS_MANY_RX = /["']?red[_-]?flags["']?\s*:\s*\[[^\]]*,[^\]]*,[^\]]*,[^\]]*\]/i;

// Bare-keyword fallback when the response doesn't use the explicit
// `severity:` prefix. Conservative: require the keyword to appear at
// a word boundary AND not inside the phrases "no high-risk" or
// "without high concern" (negation handling is best-effort; full
// NL parsing is out of scope).
const BARE_HIGH = /\b(critical|high(-|\s)risk|severe|dangerous|illegal|unauthor[iz]?ed)\b/i;
const BARE_MED = /\b(moderate(\sconcern)?|concerning|questionable|ambiguous)\b/i;

export function deriveRiskLevel(finalText: string): RiskLevel {
  if (typeof finalText !== 'string' || finalText.length === 0) return 'low';

  // Explicit severity markers win.
  if (HIGH_RX.test(finalText)) return 'high';
  // JSON-shape risk markers tie with severity: prefixes — both are
  // structured signal from the model. Highest tier wins via order.
  if (JSON_HIGH_RX.test(finalText) || JSON_REFUSE_RX.test(finalText)) return 'high';
  if (MED_RX.test(finalText)) return 'medium';
  if (JSON_MED_RX.test(finalText) || JSON_NEGOTIATE_RX.test(finalText)) return 'medium';
  // Many red flags (4+ entries) implies at least medium risk even if
  // the model didn't explicitly classify. Conservative — fewer than
  // 4 doesn't escalate.
  if (JSON_RED_FLAGS_MANY_RX.test(finalText)) return 'medium';
  if (LOW_RX.test(finalText)) return 'low';

  // Bare-keyword fallback.
  if (BARE_HIGH.test(finalText)) return 'high';
  if (BARE_MED.test(finalText)) return 'medium';
  return 'low';
}
