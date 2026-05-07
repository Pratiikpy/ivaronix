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
}

export { Keyring } from './keyring.js';
