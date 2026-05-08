import OpenAI from 'openai';
import type { Address } from '@ivaronix/core';

export interface RouterCredential {
  label: string;
  wallet: Address;
  apiKey: string; // app-sk-...
  serviceUrl: string; // https://compute-network-X.integratenetwork.work/v1/proxy
  providerAddress: Address;
}

export interface RouterCallOptions {
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  verifyTee?: boolean;
}

export interface RouterCallResult {
  content: string;
  /** Raw response for debugging + receipt capture (provider, x_0g_trace, ZG-Res-Key). */
  rawResponse: unknown;
  zgResKey?: string;
  providerAddress?: Address;
  x0gTrace?: Record<string, unknown>;
  attestationHash?: string;
  routerVerified?: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Single Router client tied to one credential.
 * For multi-key rotation, use {@link Keyring} from `./keyring.ts`.
 */
export class RouterClient {
  private client: OpenAI;
  readonly credential: RouterCredential;

  constructor(credential: RouterCredential) {
    this.credential = credential;
    this.client = new OpenAI({
      baseURL: credential.serviceUrl,
      apiKey: credential.apiKey,
    });
  }

  async chat(opts: RouterCallOptions): Promise<RouterCallResult> {
    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
    messages.push({ role: 'user', content: opts.userPrompt });

    // .withResponse() returns both the parsed body AND the raw fetch Response,
    // so we can read 0G-specific HTTP headers (ZG-Res-Key) that aren't part of
    // the OpenAI body.
    const result = await this.client.chat.completions
      .create({
        model: opts.model ?? 'qwen/qwen-2.5-7b-instruct',
        messages,
        stream: false,
        ...(opts.verifyTee !== undefined ? { verify_tee: opts.verifyTee } : {}),
      } as Parameters<typeof this.client.chat.completions.create>[0])
      .withResponse();

    const completion = result.data as unknown as {
      choices: { message: { content: string | null } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      x_0g_trace?: { provider?: `0x${string}`; tee_verified?: boolean } & Record<string, unknown>;
    };
    const headers = result.response.headers;
    const content = completion.choices[0]?.message?.content ?? '';

    // Capture ZG-Res-Key (case-insensitive)
    const zgResKey =
      headers.get('zg-res-key') ??
      headers.get('ZG-Res-Key') ??
      headers.get('Zg-Res-Key') ??
      undefined;

    // x_0g_trace lives in the body (Router-specific extension)
    const x0gTrace = completion.x_0g_trace;

    // Provider is sometimes in body's x_0g_trace, but the testnet proxy currently
    // omits it; fall back to the credential's providerAddress (always known since
    // we generated the API key for that provider).
    const providerAddress = x0gTrace?.provider ?? this.credential.providerAddress;

    return {
      content,
      rawResponse: completion,
      zgResKey: zgResKey ?? undefined,
      x0gTrace,
      providerAddress,
      // routerVerified reflects whether the body explicitly confirms TEE.
      // When the trace is absent we set it false; the user can still trigger the
      // independent broker.processResponse path which is the stronger check.
      routerVerified: Boolean(x0gTrace?.tee_verified),
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
    };
  }

  async listModels(): Promise<{ id: string; created?: number }[]> {
    const models = await this.client.models.list();
    return models.data.map((m) => ({ id: m.id, created: m.created }));
  }

  /**
   * Multi-message chat with optional tool-use and streaming. Used by the REPL
   * (`ivaronix chat`) so the model can call read_file / run_bash / etc. and the
   * caller can re-enter the loop with the tool result. Single-shot `chat()`
   * stays unchanged for backwards compat with the consensus runner.
   */
  async chatRich(input: ChatRichInput): Promise<ChatRichResult> {
    const params: Record<string, unknown> = {
      model: input.model ?? 'qwen/qwen-2.5-7b-instruct',
      messages: input.messages,
      stream: false,
    };
    if (input.tools && input.tools.length > 0) params.tools = input.tools;
    if (input.toolChoice) params.tool_choice = input.toolChoice;
    if (input.verifyTee !== undefined) params.verify_tee = input.verifyTee;

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
          // Streaming tool-call deltas: append by index
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
        inputTokens: undefined, // streaming responses omit usage on testnet
        outputTokens: undefined,
        routerVerified: false,
        rawResponse: undefined,
      };
    }

    const result = await this.client.chat.completions
      .create(params as unknown as Parameters<typeof this.client.chat.completions.create>[0])
      .withResponse();
    const completion = result.data as unknown as {
      choices: { message: { content: string | null; tool_calls?: ToolCall[] }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      x_0g_trace?: { tee_verified?: boolean } & Record<string, unknown>;
    };
    const choice = completion.choices[0];
    return {
      content: choice?.message?.content ?? '',
      toolCalls: choice?.message?.tool_calls ?? [],
      finishReason: choice?.finish_reason,
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
      routerVerified: Boolean(completion.x_0g_trace?.tee_verified),
      rawResponse: completion,
    };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ChatRichMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatRichInput {
  model?: string;
  messages: ChatRichMessage[];
  tools?: ToolDef[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  verifyTee?: boolean;
  stream?: boolean;
  onToken?: (delta: string) => void;
}

export interface ChatRichResult {
  content: string;
  toolCalls: ToolCall[];
  finishReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  routerVerified?: boolean;
  rawResponse?: unknown;
}

export { Keyring } from './keyring.js';
export {
  NvidiaNimClient,
  nvidiaFromEnv,
  tierFor,
  type NvidiaCredential,
  type ProviderKind,
  type ProviderTier,
} from './nvidia.js';
