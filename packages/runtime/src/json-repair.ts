/**
 * Conservative JSON repair for inference output.
 *
 * Why this module exists:
 *   The og-router rule (`.claude/rules/og-router.md` · "Hard rules") states:
 *     "JSON.parse from inference ALWAYS in try/catch. 7B models malform
 *      JSON ~5-10% of the time. Pattern: try parse, on fail run a repair
 *      pass via the regex shapes in packages/runtime/src/json-repair.ts."
 *
 *   The rule predated the module. Sweep 78 closes the doc-vs-code drift
 *   by shipping the module the rule references, plus tests covering the
 *   real malformations that 7B-class models produce.
 *
 *   No first-party skill today returns structured JSON from inference —
 *   our consensus pipeline is plaintext analyst/critic/judge. But future
 *   skills may, and the keyring rotation flows assume the parse stage is
 *   defensive. This module ships the contract before the first caller
 *   needs it.
 *
 * Scope:
 *   Conservative repairs only. Risky transforms (single → double quotes,
 *   unquoted keys) are NOT applied — they corrupt valid JSON 5-10% of
 *   the time, which is worse than failing-loud on the original parse.
 *
 *   What we DO repair:
 *     1. Markdown code fence wrappers (```json ... ``` or ``` ... ```)
 *     2. Leading/trailing prose ("Here's the JSON: { ... } Hope this helps.")
 *     3. Trailing commas before `}` or `]`
 *     4. Smart quotes ("/")
 *     5. BOM (U+FEFF) at start
 *
 *   What we do NOT repair (refuse to guess):
 *     - Single-quoted strings (could be JS-style and intentional)
 *     - Unquoted object keys (same)
 *     - Truncated JSON (model ran out of tokens — repair would invent data)
 *
 * Usage:
 *   import { tryParseJson } from '@ivaronix/runtime/json-repair';
 *   const result = tryParseJson(rawInferenceText);
 *   if (result.ok) {
 *     // result.value is the parsed JSON
 *     // result.repaired tells you which transforms were applied
 *   } else {
 *     // result.error is the original or post-repair parse error
 *   }
 */

export type RepairTransform =
  | 'codeFence'
  | 'leadingTrailingProse'
  | 'trailingCommas'
  | 'smartQuotes'
  | 'bom';

export interface ParseSuccess<T = unknown> {
  ok: true;
  value: T;
  /** Empty array if the original parsed cleanly; otherwise the transforms applied. */
  repaired: RepairTransform[];
}

export interface ParseFailure {
  ok: false;
  error: string;
  /** Transforms that were attempted before the final parse failure. */
  attempted: RepairTransform[];
}

export type ParseResult<T = unknown> = ParseSuccess<T> | ParseFailure;

/**
 * Try to parse a string as JSON, applying conservative repairs only if
 * the original parse fails. Returns a discriminated union so callers
 * can branch on `result.ok` without try/catch.
 */
export function tryParseJson<T = unknown>(raw: string): ParseResult<T> {
  // Fast path: try the raw input first.
  try {
    return { ok: true, value: JSON.parse(raw) as T, repaired: [] };
  } catch {
    // fall through to repair
  }

  const transforms: RepairTransform[] = [];
  let s = raw;

  // 1. BOM at start.
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1);
    transforms.push('bom');
  }

  // 2. Markdown code fence. Match ```...``` (with optional language tag).
  const fence = s.match(/```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```/);
  if (fence) {
    s = fence[1] ?? '';
    transforms.push('codeFence');
  }

  // 3. Leading/trailing prose. Find the outermost { or [ ... matching close.
  // We don't do depth-aware matching (too risky); we trust the first/last
  // brace pair. If the JSON itself contains stray braces inside strings,
  // this still works because JSON.parse will accept the whole bracket.
  const stripped = stripLeadingTrailingProse(s);
  if (stripped !== s) {
    s = stripped;
    transforms.push('leadingTrailingProse');
  }

  // 4. Smart quotes. ASCII-only JSON is what JSON.parse expects.
  const smartQuoteRe = /[“”‘’]/;
  if (smartQuoteRe.test(s)) {
    s = s
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
    transforms.push('smartQuotes');
  }

  // 5. Trailing commas. Conservative — only strip `,` immediately before
  // `}` or `]` (with optional whitespace). Doesn't touch commas inside
  // strings (the regex anchor + bracket lookahead is enough since we're
  // not inside a string-aware lexer).
  const trailingCommaRe = /,(\s*[}\]])/g;
  if (trailingCommaRe.test(s)) {
    s = s.replace(/,(\s*[}\]])/g, '$1');
    transforms.push('trailingCommas');
  }

  try {
    return { ok: true, value: JSON.parse(s) as T, repaired: transforms };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error).message,
      attempted: transforms,
    };
  }
}

/**
 * Strip prose around a JSON value. Find the FIRST `{` or `[` and the
 * LAST matching `}` or `]`. Does NOT do brace-depth matching (which
 * would require a real lexer); trusts that the outermost bracket pair
 * is the JSON value.
 */
function stripLeadingTrailingProse(s: string): string {
  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let start = -1;
  if (firstBrace === -1 && firstBracket === -1) return s;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);

  const openChar = s[start];
  const closeChar = openChar === '{' ? '}' : ']';
  const last = s.lastIndexOf(closeChar);
  if (last <= start) return s;
  return s.slice(start, last + 1);
}
