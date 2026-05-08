import OpenAI from 'openai';
import type {
  ChatRichInput,
  ChatRichResult,
  ToolCall,
  RouterCallOptions,
  RouterCallResult,
} from './index.js';

/**
 * NVIDIA NIM provider (TIER 2 — external-signed).
 *
 * Same OpenAI-compatible HTTP shape as the 0G Router, but runs on
 * `https://integrate.api.nvidia.com/v1` with frontier models from the
 * NVIDIA Build catalog. Receipts produced through this client are
 * still signed + chain-anchored, but tagged with
 * `routerTrace.providerKind = 'nvidia-nim'` and
 * `teeVerification.kind = 'external-signed'` so the public Proof URL
 * shows the correct trust tier.
 *
 * See `docs/NVIDIA_NIM.md` for the full integration spec.
 */

export interface NvidiaCredential {
  label: string;
  apiKey: string;             // nvapi-...
  baseUrl?: string;           // default https://integrate.api.nvidia.com/v1
  defaultModel?: string;      // default qwen/qwen3.5-397b-a17b
}

export class NvidiaNimClient {
  readonly credential: NvidiaCredential;
  private client: OpenAI;

  constructor(credential: NvidiaCredential) {
    this.credential = credential;
    this.client = new OpenAI({
      baseURL: credential.baseUrl ?? 'https://integrate.api.nvidia.com/v1',
      apiKey: credential.apiKey,
    });
  }

  /** Single-shot chat (parity with 0G `RouterClient.chat()`). */
  async chat(opts: RouterCallOptions): Promise<RouterCallResult> {
    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
    messages.push({ role: 'user', content: opts.userPrompt });

    const completion = await this.client.chat.completions.create({
      model: opts.model ?? this.credential.defaultModel ?? 'qwen/qwen3.5-397b-a17b',
      messages,
      stream: false,
    });
    const c = completion as unknown as {
      choices: { message: { content: string | null } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      content: c.choices[0]?.message?.content ?? '',
      rawResponse: c,
      providerAddress: undefined,
      x0gTrace: undefined,
      // External provider — no TEE attestation. Surface honestly.
      routerVerified: false,
      inputTokens: c.usage?.prompt_tokens,
      outputTokens: c.usage?.completion_tokens,
    };
  }

  /** Multi-message chat with tool-use + streaming, matching `RouterClient.chatRich()`. */
  async chatRich(input: ChatRichInput): Promise<ChatRichResult> {
    const params: Record<string, unknown> = {
      model: input.model ?? this.credential.defaultModel ?? 'qwen/qwen3.5-397b-a17b',
      messages: input.messages,
      stream: false,
    };
    if (input.tools && input.tools.length > 0) params.tools = input.tools;
    if (input.toolChoice) params.tool_choice = input.toolChoice;

    if (input.stream && input.onToken) {
      params.stream = true;
      const stream = (await this.client.chat.completions.create(
        params as unknown as Parameters<typeof this.client.chat.completions.create>[0],
      )) as AsyncIterable<{
        choices: { delta: { content?: string; tool_calls?: ToolCall[] }; finish_reason?: string }[];
      }>;
      let content = '';
      const collected: ToolCall[] = [];
      let finishReason: string | undefined;
      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        const piece = choice.delta?.content ?? '';
        if (piece) {
          content += piece;
          input.onToken(piece);
        }
        if (choice.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const idx = (tc as ToolCall & { index?: number }).index ?? collected.length;
            const cur = collected[idx] ?? { id: '', type: 'function', function: { name: '', arguments: '' } };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.function.name = (cur.function.name ?? '') + tc.function.name;
            if (tc.function?.arguments) cur.function.arguments = (cur.function.arguments ?? '') + tc.function.arguments;
            collected[idx] = cur;
          }
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
      }
      return {
        content,
        toolCalls: collected.filter((c) => c.function.name),
        finishReason,
        inputTokens: undefined,
        outputTokens: undefined,
        routerVerified: false,
        rawResponse: undefined,
      };
    }

    const completion = await this.client.chat.completions.create(
      params as unknown as Parameters<typeof this.client.chat.completions.create>[0],
    );
    const c = completion as unknown as {
      choices: { message: { content: string | null; tool_calls?: ToolCall[] }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = c.choices[0];
    return {
      content: choice?.message?.content ?? '',
      toolCalls: choice?.message?.tool_calls ?? [],
      finishReason: choice?.finish_reason,
      inputTokens: c.usage?.prompt_tokens,
      outputTokens: c.usage?.completion_tokens,
      routerVerified: false,
      rawResponse: c,
    };
  }
}

/** Build a NIM client from environment variables. Returns null when not configured. */
export function nvidiaFromEnv(env: NodeJS.ProcessEnv = process.env): NvidiaNimClient | null {
  const apiKey = env.NVIDIA_API_KEY;
  if (!apiKey || !apiKey.startsWith('nvapi-')) return null;
  return new NvidiaNimClient({
    label: 'nvidia-primary',
    apiKey,
    baseUrl: env.NVIDIA_BASE_URL,
    defaultModel: env.NVIDIA_DEFAULT_MODEL,
  });
}

/** Provider kinds Ivaronix receipts can record. */
export type ProviderKind = '0g-router' | 'nvidia-nim';

/**
 * Provider tier — determines which trust chip the public Proof URL renders.
 * - tier-1-tee:   0G Router + TEE attestation in the receipt
 * - tier-2-external-signed:  signed + chain-anchored, but no TEE attestation
 */
export type ProviderTier = 'tier-1-tee' | 'tier-2-external-signed';

export function tierFor(kind: ProviderKind): ProviderTier {
  return kind === '0g-router' ? 'tier-1-tee' : 'tier-2-external-signed';
}
