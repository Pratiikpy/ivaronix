import type { BuiltinHook, HookEvent_PreConsensus } from '../types.js';

/**
 * redact-pii — replace common PII patterns in `context` before it reaches the router.
 *
 * Patterns handled (US-centric; intended as defense in depth, NOT as a substitute
 * for caller-side scrubbing):
 *   - SSN: 9 digits, optionally with dashes (123-45-6789)
 *   - Email: RFC-ish, conservative
 *   - Phone: NANP-style 10-digit (+optional country code & separators)
 *   - Credit-card-like: 13–19 digit runs that pass a Luhn check
 *
 * Each match is replaced with a typed token (e.g. `<REDACTED:SSN>`). The hook
 * emits a log line with the count of redactions so the receipt can include it
 * as audit metadata.
 */

const RX_SSN = /\b\d{3}-?\d{2}-?\d{4}\b/g;
const RX_EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const RX_PHONE = /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
/** Match runs of 13–19 digits, optionally separated by single spaces or dashes (e.g. "4111 1111 1111 1111"). */
const RX_CARD_CANDIDATE = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;

function luhnOk(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export const redactPii: BuiltinHook = {
  name: 'redact_pii',
  subscribes: ['consensus.pre'],
  run(event) {
    if (event.kind !== 'consensus.pre') return { allow: true };
    const e = event as HookEvent_PreConsensus;

    let text = e.context;
    let counts = { ssn: 0, email: 0, phone: 0, card: 0 };

    text = text.replace(RX_SSN, () => {
      counts.ssn++;
      return '<REDACTED:SSN>';
    });
    text = text.replace(RX_EMAIL, () => {
      counts.email++;
      return '<REDACTED:EMAIL>';
    });
    text = text.replace(RX_PHONE, () => {
      counts.phone++;
      return '<REDACTED:PHONE>';
    });
    text = text.replace(RX_CARD_CANDIDATE, (raw) => {
      const digits = raw.replace(/[ -]/g, '');
      if (digits.length < 13 || digits.length > 19) return raw;
      if (!luhnOk(digits)) return raw;
      counts.card++;
      return '<REDACTED:CARD>';
    });

    const total = counts.ssn + counts.email + counts.phone + counts.card;
    return {
      allow: true,
      patch: total > 0 ? { context: text } : undefined,
      logs: total > 0
        ? [
            `redact_pii: scrubbed ${total} match${total === 1 ? '' : 'es'} (` +
              `ssn=${counts.ssn} email=${counts.email} phone=${counts.phone} card=${counts.card})`,
          ]
        : [],
    };
  },
};
