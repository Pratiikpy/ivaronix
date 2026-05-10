/**
 * Pre-flight 7-gate fail-fast (MUSASHI pattern, REFERENCE_PATTERNS.md §6.2).
 *
 * Run BEFORE launching the expensive 3-role / 5-role consensus. If any gate fails,
 * abort immediately with a clear error so the user doesn't burn OG on a doomed call.
 */

export interface GateInput {
  /** Doc bytes after any encryption (i.e., what would be sent to the model). */
  context: string;
  /** Raw doc bytes (for sensitive-content scan; pre-encryption). */
  rawBytes: Buffer | Uint8Array;
  /** Total token budget for the run (inferred from context length). */
  estimatedInputTokens: number;
  /** Model the user requested. */
  model: string;
  /** Optional: list of model capabilities (`tool_calling`, `json_mode`, `tee_verified`) — used by gate 4. */
  modelCapabilities?: { teeVerified: boolean; contextLength: number };
  /** Optional: live Router balance in OG. Gate 6 fails if balance is too low. */
  routerBalanceOg?: number;
  /** Optional: live ReceiptRegistry paused state. Gate 7 fails if paused. */
  registryPaused?: boolean;
  /**
   * Optional: the operator's actual signer private key (hex string with or
   * without `0x` prefix). When provided, gate 2 does an exact-match scan for
   * this byte string in `context` — zero false positives + perfect detection
   * of an accidental paste. Closes planning-003 §A.5.15: the broad
   * `eth-private-key` heuristic regex used to false-positive on every
   * receipt id, tx hash, content root, and signature half referenced in the
   * doc. The exact-match path is the only one that can definitively call a
   * 64-hex string a private key.
   */
  signerPrivateKey?: string;
}

export interface GateResult {
  pass: boolean;
  failedGate?: string;
  reason?: string;
  warnings: string[];
}

const SECRETS_REGEX_LIST: { name: string; pattern: RegExp }[] = [
  { name: 'private-key', pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g },
  { name: 'aws-key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'mnemonic-12', pattern: /\b(?:[a-z]{3,12}\s+){11}[a-z]{3,12}\b/i }, // 12-word phrase candidate
  { name: 'github-token', pattern: /ghp_[A-Za-z0-9]{36}/g },
  { name: 'openai-key', pattern: /sk-[A-Za-z0-9]{20,}/g },
];

/**
 * Receipt-context label words that immediately precede a 64-hex token in
 * Ivaronix's own audit output. When any of these appears within
 * `RECEIPT_CONTEXT_LOOKBACK_CHARS` of a candidate hex string, the heuristic
 * suppresses the warning.
 *
 * Per planning-003 §A.5.15: a doc-review run that quotes a prior receipt
 * (e.g. "verified against receipt 0xabc123…") used to trip the broad
 * heuristic on every id, content hash, tx hash, signature half, and storage
 * root. The label list is the negative-lookbehind set in plain English.
 */
const RECEIPT_CONTEXT_LABELS = [
  'tx',
  'hash',
  'root',
  'receipt',
  'receipts',
  'anchor',
  'anchored',
  'id',
  'block',
  'commit',
  'storage',
  'attestation',
  'signature',
  'sig',
  'r:', // ECDSA signature halves
  's:',
  'evidence',
];

const RECEIPT_CONTEXT_LOOKBACK_CHARS = 32;

/**
 * Heuristic 64-hex match. Used only when {@link GateInput.signerPrivateKey}
 * is NOT supplied — in that case there's no way to definitively identify a
 * private key, so the warning falls back to "this looks 64-hex, please
 * confirm." The look-behind into `RECEIPT_CONTEXT_LABELS` keeps the warning
 * silent when the hex string is plainly a receipt artefact.
 */
const HEX64_PATTERN = /\b(0x)?[a-fA-F0-9]{64}\b/g;

function isLikelyReceiptArtefact(haystack: string, matchIndex: number): boolean {
  const start = Math.max(0, matchIndex - RECEIPT_CONTEXT_LOOKBACK_CHARS);
  const lookback = haystack.slice(start, matchIndex).toLowerCase();
  for (const label of RECEIPT_CONTEXT_LABELS) {
    // Match the label as a whole word followed by `:`, ` `, or `=` so we
    // don't suppress on `idiom 0x...` while we do suppress on `id: 0x...`.
    const re = new RegExp(`(^|[^a-z])${label.replace(/[:.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\s*[:=]?\\s*[#]?\\s*$`, 'i');
    if (re.test(lookback)) return true;
  }
  return false;
}

function normalizeHex(value: string): string {
  return value.toLowerCase().replace(/^0x/, '');
}

function scanForExactKey(haystack: string, key: string): boolean {
  const normalized = normalizeHex(key);
  if (normalized.length !== 64) return false; // not a 32-byte secp256k1 key
  // Case-insensitive substring scan — covers `abcd…`, `0xABCD…`, `ABCD…`.
  return haystack.toLowerCase().includes(normalized);
}

const SENSITIVE_PII_REGEX = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN-like
  /\b\d{16}\b/, // credit card-like
];

const MAX_FILE_SIZE_MB = 10; // doc-ask hard limit; documents above this size belong in doc-bulk pipeline
const MIN_INPUT_TOKENS = 5;
const MIN_BALANCE_OG = 0.001; // ~1 mOG should be enough for any single audit + anchor

export function runGates(input: GateInput): GateResult {
  const warnings: string[] = [];

  // GATE 1 — file type / size sanity
  if (input.rawBytes.length === 0) {
    return fail('1-file-sanity', 'File is empty', warnings);
  }
  if (input.rawBytes.length > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return fail('1-file-sanity', `File exceeds ${MAX_FILE_SIZE_MB}MB limit (got ${(input.rawBytes.length / 1024 / 1024).toFixed(1)}MB)`, warnings);
  }
  // Binary heuristic
  const sample = input.context.slice(0, 256);
  if (/[\x00-\x08\x0E-\x1F]/.test(sample)) {
    return fail('1-file-sanity', 'File appears to be binary; doc-ask requires text-like content', warnings);
  }

  // GATE 2 — sensitive content scan (warn, don't block — recommend Burn Mode)
  //
  // Two paths for 64-hex private-key detection per planning-003 §A.5.15:
  //   a) Exact-match against the operator's loaded signer key when
  //      `signerPrivateKey` is supplied. Zero false positives, perfect
  //      detection. This is the production path.
  //   b) Heuristic 64-hex scan with receipt-context suppression when
  //      `signerPrivateKey` is unavailable (e.g. read-only flows). The
  //      heuristic skips matches preceded by `RECEIPT_CONTEXT_LABELS` so
  //      that doc-review of past receipts does not warn on every quoted
  //      hash.
  if (input.signerPrivateKey && scanForExactKey(input.context, input.signerPrivateKey)) {
    warnings.push(
      'CRITICAL: your signer private key appears verbatim in the document; aborting recommended (use --burn at minimum)',
    );
  } else if (!input.signerPrivateKey) {
    HEX64_PATTERN.lastIndex = 0;
    let suspicious = false;
    let match: RegExpMatchArray | null;
    while ((match = HEX64_PATTERN.exec(input.context)) !== null) {
      if (!isLikelyReceiptArtefact(input.context, match.index ?? 0)) {
        suspicious = true;
        break;
      }
    }
    if (suspicious) {
      warnings.push(
        '64-hex token detected in context; if this is an EVM private key, recommend --burn (set signer key in env to enable exact-match detection)',
      );
    }
  }
  for (const { name, pattern } of SECRETS_REGEX_LIST) {
    pattern.lastIndex = 0;
    if (pattern.test(input.context)) {
      warnings.push(`Potential secret detected (${name}); recommend --burn`);
      break;
    }
  }
  for (const pii of SENSITIVE_PII_REGEX) {
    if (pii.test(input.context)) {
      warnings.push('Potential PII detected (SSN/CC-like); recommend --burn');
      break;
    }
  }

  // GATE 3 — token budget vs. context window
  if (input.estimatedInputTokens < MIN_INPUT_TOKENS) {
    return fail('3-token-budget', `Input too short to be meaningful (${input.estimatedInputTokens} tokens)`, warnings);
  }
  if (input.modelCapabilities?.contextLength) {
    const headroom = input.modelCapabilities.contextLength - input.estimatedInputTokens;
    if (headroom < 1024) {
      return fail('3-token-budget', `Insufficient context headroom: ${headroom} tokens left, need ≥1024 for response`, warnings);
    }
  }

  // GATE 4 — model capability match (TEE-verifiable required for consensus)
  if (input.modelCapabilities && !input.modelCapabilities.teeVerified) {
    warnings.push(`Model ${input.model} is not TEE-verifiable; consensus attestations will be Router-flag only`);
  }

  // GATE 5 — provider availability (caller checks; we just record)
  // Skipped at the gate layer — Router routes to whichever provider is up.

  // GATE 6 — wallet/Router balance sufficient
  if (input.routerBalanceOg !== undefined && input.routerBalanceOg < MIN_BALANCE_OG) {
    return fail('6-balance', `Router balance ${input.routerBalanceOg} OG is below ${MIN_BALANCE_OG} OG floor`, warnings);
  }

  // GATE 7 — receipt registry not paused
  if (input.registryPaused) {
    return fail('7-registry-paused', 'ReceiptRegistry is paused; receipts cannot be anchored', warnings);
  }

  return { pass: true, warnings };
}

function fail(gate: string, reason: string, warnings: string[]): GateResult {
  return { pass: false, failedGate: gate, reason, warnings };
}
