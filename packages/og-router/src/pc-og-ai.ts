/**
 * pc.0g.ai adapter — 0G sovereign Compute endpoint (OpenAI-compatible).
 *
 * Final-plan.md §1.6 Day 18 + §2.3 + §2.4. Adapter prepped on testnet;
 * the live path goes through this file once mainnet routes `pc.0g.ai`
 * end-to-end (gate is §2.7 smoke test, not code).
 *
 * Request shape: POST {baseUrl}/chat/completions
 *   Authorization: Bearer <credential.apiKey>          // app-sk-<SECRET>
 *   Content-Type:  application/json
 *   Body:          { model, messages, temperature?, max_tokens?, stream:false }
 *
 * Default model is `0GM-1.0-35B-A3B` — 0G's mainnet sovereign MoE checkpoint
 * (per final-plan.md §2.4). Caller may override via `options.model`. The
 * receipt's `execution.model.source` field is set to `'0G'` by the pipeline
 * when this adapter handles the call (Block G enum); the receipt's
 * `execution.model.final` records the model string actually used.
 *
 * Threat model (`.claude/rules/og-router.md` pattern · WT 66 family):
 *   - Defends against: silent fallthrough when pc.0g.ai is unreachable or
 *     returns a non-200. Every error path throws a labelled `Error` so the
 *     caller can choose between cascade-to-fallback and fail-closed. Defends
 *     against malformed JSON bodies from the upstream (try/catch around
 *     every `JSON.parse`).
 *   - Does NOT defend against: a compromised pc.0g.ai endpoint serving a
 *     different model than the one we asked for. The receipt records the
 *     model name we requested AND the `usage` block the endpoint reports;
 *     stronger integrity guarantee comes from broker.processResponse, not
 *     from this adapter. Does NOT defend against the operator's apiKey
 *     being leaked from `.env`.
 *   - Assumed attacker capabilities: cannot forge a TLS cert for
 *     `pc.0g.ai`. Holds zero valid `app-sk-*` keys. Cannot inject one
 *     into the credential object passed to `chatPcOgAi`.
 */
import type { RouterCredential } from './index.js';

/** Default base URL when caller omits one on the credential's serviceUrl. */
export const PC_OG_AI_DEFAULT_BASE_URL = 'https://pc.0g.ai/v1';

/** Canonical mainnet model name per final-plan.md §2.4. */
export const PC_OG_AI_DEFAULT_MODEL = '0GM-1.0-35B-A3B';

export interface PcOgAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PcOgAiChatOptions {
  /** Model name; defaults to `PC_OG_AI_DEFAULT_MODEL` (`0GM-1.0-35B-A3B`). */
  model?: string;
  /** Sampling temperature; passed through when defined. */
  temperature?: number;
  /** Cap on response tokens; passed through when defined. */
  maxTokens?: number;
  /**
   * Inject a custom fetch (unit tests use this to mock the upstream).
   * Defaults to globalThis.fetch when omitted.
   */
  fetchImpl?: typeof fetch;
  /** Per-call timeout in ms; default 60_000. */
  timeoutMs?: number;
}

export interface PcOgAiChatResult {
  /** Assistant message text content. */
  output: string;
  /** Token accounting from the upstream `usage` block; absent fields stay undefined. */
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** Model the upstream reports having served (echo of `body.model` when set). */
  model: string;
  /**
   * Provider address recorded on the receipt. For pc.0g.ai this is the
   * credential's `providerAddress` since the endpoint does not surface a
   * per-call provider id today.
   */
  providerAddress: `0x${string}`;
  /** Raw upstream response body (parsed JSON) for debugging + receipt capture. */
  rawResponse: unknown;
}

/**
 * Call pc.0g.ai's chat-completions endpoint with the given credential.
 *
 * Throws labelled errors on:
 *   - missing/invalid apiKey  (`PcOgAiCredentialError`)
 *   - wrong credential kind   (`PcOgAiCredentialError`)
 *   - non-200 upstream        (`PcOgAiHttpError`)
 *   - malformed JSON body     (`PcOgAiResponseError`)
 *   - missing choice content  (`PcOgAiResponseError`)
 */
export async function chatPcOgAi(
  credential: RouterCredential,
  messages: PcOgAiChatMessage[],
  options: PcOgAiChatOptions = {},
): Promise<PcOgAiChatResult> {
  validateCredential(credential);

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new PcOgAiCredentialError('chatPcOgAi: messages must be a non-empty array.');
  }

  const baseUrl = stripTrailingSlash(credential.serviceUrl) || PC_OG_AI_DEFAULT_BASE_URL;
  const url = `${baseUrl}/chat/completions`;
  const model = options.model ?? PC_OG_AI_DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const fetchImpl: typeof fetch = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new PcOgAiCredentialError(
      'chatPcOgAi: no fetch implementation available (Node 18+ or pass options.fetchImpl).',
    );
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
  };
  if (typeof options.temperature === 'number') body.temperature = options.temperature;
  if (typeof options.maxTokens === 'number') body.max_tokens = options.maxTokens;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await safeReadText(response);
    throw new PcOgAiHttpError(
      `pc.0g.ai returned ${response.status} ${response.statusText}: ${text.slice(0, 512)}`,
      response.status,
    );
  }

  const rawText = await safeReadText(response);
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new PcOgAiResponseError(
      `pc.0g.ai returned malformed JSON body (${(err as Error).message}): ${rawText.slice(0, 256)}`,
    );
  }

  const shaped = parsed as {
    choices?: { message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    model?: string;
  };
  const content = shaped.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new PcOgAiResponseError(
      'pc.0g.ai returned a 200 with no assistant content; refusing to fabricate output.',
    );
  }

  return {
    output: content,
    usage: {
      promptTokens: shaped.usage?.prompt_tokens,
      completionTokens: shaped.usage?.completion_tokens,
      totalTokens: shaped.usage?.total_tokens,
    },
    model: shaped.model ?? model,
    providerAddress: credential.providerAddress,
    rawResponse: parsed,
  };
}

function validateCredential(credential: RouterCredential): void {
  if (!credential || typeof credential !== 'object') {
    throw new PcOgAiCredentialError('chatPcOgAi: credential is required.');
  }
  if (typeof credential.apiKey !== 'string' || credential.apiKey.length === 0) {
    throw new PcOgAiCredentialError('chatPcOgAi: credential.apiKey (secretKey) is required.');
  }
  if (credential.kind !== undefined && credential.kind !== 'pc.0g.ai') {
    throw new PcOgAiCredentialError(
      `chatPcOgAi: credential.kind must be 'pc.0g.ai' (got '${credential.kind}').`,
    );
  }
  if (typeof credential.providerAddress !== 'string' || !credential.providerAddress.startsWith('0x')) {
    throw new PcOgAiCredentialError(
      'chatPcOgAi: credential.providerAddress (0x-prefixed) is required for receipt capture.',
    );
  }
}

function stripTrailingSlash(s: string | undefined): string {
  if (!s) return '';
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export class PcOgAiCredentialError extends Error {
  override readonly name = 'PcOgAiCredentialError';
}

export class PcOgAiHttpError extends Error {
  override readonly name = 'PcOgAiHttpError';
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export class PcOgAiResponseError extends Error {
  override readonly name = 'PcOgAiResponseError';
}
