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

    const completion = await this.client.chat.completions.create({
      model: opts.model ?? 'qwen/qwen-2.5-7b-instruct',
      messages,
      stream: false,
      // verify_tee may not be a standard OpenAI field; included if Router accepts it
      ...(opts.verifyTee !== undefined ? { verify_tee: opts.verifyTee } : {}),
    } as Parameters<typeof this.client.chat.completions.create>[0]);

    // Narrow: stream:false guarantees a ChatCompletion (not a Stream<>)
    const result = completion as unknown as {
      choices: { message: { content: string | null } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      ZG_Res_Key?: string;
      x_0g_trace?: { provider?: `0x${string}`; tee_verified?: boolean } & Record<string, unknown>;
    };
    const content = result.choices[0]?.message?.content ?? '';

    return {
      content,
      rawResponse: completion,
      // ZG-specific fields land in x_0g_trace; capture defensively
      zgResKey: result.ZG_Res_Key,
      x0gTrace: result.x_0g_trace,
      providerAddress: result.x_0g_trace?.provider,
      routerVerified: Boolean(result.x_0g_trace?.tee_verified),
      inputTokens: result.usage?.prompt_tokens,
      outputTokens: result.usage?.completion_tokens,
    };
  }

  async listModels(): Promise<{ id: string; created?: number }[]> {
    const models = await this.client.models.list();
    return models.data.map((m) => ({ id: m.id, created: m.created }));
  }
}

export { Keyring } from './keyring.js';
