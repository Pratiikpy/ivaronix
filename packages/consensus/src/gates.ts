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
}

export interface GateResult {
  pass: boolean;
  failedGate?: string;
  reason?: string;
  warnings: string[];
}

const SECRETS_REGEX_LIST: { name: string; pattern: RegExp }[] = [
  { name: 'private-key', pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g },
  { name: 'eth-private-key', pattern: /\b(?:0x)?[a-fA-F0-9]{64}\b/g }, // 64-hex; could be a key
  { name: 'aws-key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'mnemonic-12', pattern: /\b(?:[a-z]{3,12}\s+){11}[a-z]{3,12}\b/i }, // 12-word phrase candidate
  { name: 'github-token', pattern: /ghp_[A-Za-z0-9]{36}/g },
  { name: 'openai-key', pattern: /sk-[A-Za-z0-9]{20,}/g },
];

const SENSITIVE_PII_REGEX = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN-like
  /\b\d{16}\b/, // credit card-like
];

const MAX_FILE_SIZE_MB = 10; // per Day 4 doc-ask scope
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
  for (const { name, pattern } of SECRETS_REGEX_LIST) {
    if (pattern.test(input.context)) {
      warnings.push(`Potential secret detected (${name}); recommend --burn`);
      break; // one warning is enough
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
