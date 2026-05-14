/**
 * Unit tests for the pc.0g.ai adapter (`packages/og-router/src/pc-og-ai.ts`).
 *
 * Locks the contract called out in final-plan.md §1.6 Day 18:
 *   - credential validation (rejects missing/empty apiKey, wrong kind)
 *   - request body shape (Bearer auth · model defaults to 0GM-1.0-35B-A3B)
 *   - error handling (non-200 → PcOgAiHttpError, malformed JSON →
 *     PcOgAiResponseError, empty content → PcOgAiResponseError)
 *
 * The live pc.0g.ai endpoint is mocked via `options.fetchImpl`; tests
 * never hit the network. Run via `pnpm --filter @ivaronix/og-router test`
 * (Node's built-in `node:test` runner under tsx · matches keyring.test.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chatPcOgAi,
  PC_OG_AI_DEFAULT_MODEL,
  PcOgAiCredentialError,
  PcOgAiHttpError,
  PcOgAiResponseError,
} from './pc-og-ai.js';
import type { RouterCredential } from './index.js';

function makeCred(overrides: Partial<RouterCredential> = {}): RouterCredential {
  return {
    label: 'pc-primary',
    wallet: '0x0000000000000000000000000000000000000001' as `0x${string}`,
    apiKey: 'app-sk-test-pc-og-ai',
    serviceUrl: 'https://pc.0g.ai/v1',
    providerAddress: '0x0000000000000000000000000000000000000002' as `0x${string}`,
    kind: 'pc.0g.ai',
    ...overrides,
  };
}

interface FetchCall {
  url: string;
  init: RequestInit;
}

function makeFetch(
  responder: (call: FetchCall) => { status?: number; statusText?: string; body: string },
): { fetchImpl: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const call: FetchCall = { url, init: init ?? {} };
    calls.push(call);
    const r = responder(call);
    return new Response(r.body, {
      status: r.status ?? 200,
      statusText: r.statusText ?? 'OK',
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const happyBody = JSON.stringify({
  id: 'chatcmpl-mock',
  model: '0GM-1.0-35B-A3B',
  choices: [{ message: { role: 'assistant', content: 'pong' } }],
  usage: { prompt_tokens: 7, completion_tokens: 1, total_tokens: 8 },
});

test('rejects when apiKey (secretKey) is missing', async () => {
  const cred = makeCred({ apiKey: '' });
  const { fetchImpl } = makeFetch(() => ({ body: happyBody }));
  await assert.rejects(
    () => chatPcOgAi(cred, [{ role: 'user', content: 'hi' }], { fetchImpl }),
    (err: Error) => err instanceof PcOgAiCredentialError && /apiKey/.test(err.message),
  );
});

test("rejects when credential.kind is set but is not 'pc.0g.ai'", async () => {
  // 'compute-network' is the legacy default — calling chatPcOgAi with it
  // is almost certainly a routing bug, not a typo we should silently fix.
  const cred = makeCred({ kind: 'compute-network' });
  const { fetchImpl } = makeFetch(() => ({ body: happyBody }));
  await assert.rejects(
    () => chatPcOgAi(cred, [{ role: 'user', content: 'hi' }], { fetchImpl }),
    (err: Error) => err instanceof PcOgAiCredentialError && /pc\.0g\.ai/.test(err.message),
  );
});

test('rejects when messages array is empty', async () => {
  const cred = makeCred();
  const { fetchImpl } = makeFetch(() => ({ body: happyBody }));
  await assert.rejects(
    () => chatPcOgAi(cred, [], { fetchImpl }),
    (err: Error) => err instanceof PcOgAiCredentialError && /messages/.test(err.message),
  );
});

test('sends Bearer auth + correct body shape (model defaults to 0GM-1.0-35B-A3B)', async () => {
  const cred = makeCred();
  const { fetchImpl, calls } = makeFetch(() => ({ body: happyBody }));
  await chatPcOgAi(cred, [{ role: 'user', content: 'hello' }], { fetchImpl });

  assert.equal(calls.length, 1);
  const call = calls[0]!;
  assert.equal(call.url, 'https://pc.0g.ai/v1/chat/completions');
  assert.equal(call.init.method, 'POST');

  const headers = call.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer app-sk-test-pc-og-ai');
  assert.equal(headers['Content-Type'], 'application/json');

  const body = JSON.parse(call.init.body as string) as {
    model: string;
    messages: { role: string; content: string }[];
    stream: boolean;
    temperature?: number;
  };
  assert.equal(body.model, PC_OG_AI_DEFAULT_MODEL);
  assert.equal(body.model, '0GM-1.0-35B-A3B');
  assert.equal(body.stream, false);
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0]?.content, 'hello');
  // temperature is not sent when caller did not specify it
  assert.equal(body.temperature, undefined);
});

test('forwards temperature + maxTokens when caller specifies them', async () => {
  const cred = makeCred();
  const { fetchImpl, calls } = makeFetch(() => ({ body: happyBody }));
  await chatPcOgAi(
    cred,
    [{ role: 'user', content: 'hi' }],
    { fetchImpl, model: 'deepseek-v4-pro', temperature: 0.2, maxTokens: 1024 },
  );
  const body = JSON.parse(calls[0]!.init.body as string) as {
    model: string;
    temperature: number;
    max_tokens: number;
  };
  assert.equal(body.model, 'deepseek-v4-pro');
  assert.equal(body.temperature, 0.2);
  assert.equal(body.max_tokens, 1024);
});

test('parses a happy 200 response into PcOgAiChatResult', async () => {
  const cred = makeCred();
  const { fetchImpl } = makeFetch(() => ({ body: happyBody }));
  const result = await chatPcOgAi(cred, [{ role: 'user', content: 'ping' }], { fetchImpl });
  assert.equal(result.output, 'pong');
  assert.equal(result.model, '0GM-1.0-35B-A3B');
  assert.equal(result.providerAddress, cred.providerAddress);
  assert.equal(result.usage.promptTokens, 7);
  assert.equal(result.usage.completionTokens, 1);
  assert.equal(result.usage.totalTokens, 8);
});

test('throws PcOgAiHttpError on non-200 (does not silently fall back)', async () => {
  const cred = makeCred();
  const { fetchImpl } = makeFetch(() => ({
    status: 503,
    statusText: 'Service Unavailable',
    body: '{"error":"upstream busy"}',
  }));
  await assert.rejects(
    () => chatPcOgAi(cred, [{ role: 'user', content: 'hi' }], { fetchImpl }),
    (err: Error) =>
      err instanceof PcOgAiHttpError &&
      (err as PcOgAiHttpError).status === 503 &&
      /upstream busy/.test(err.message),
  );
});

test('throws PcOgAiHttpError on 401 auth failure', async () => {
  const cred = makeCred();
  const { fetchImpl } = makeFetch(() => ({
    status: 401,
    statusText: 'Unauthorized',
    body: '{"error":"bad key"}',
  }));
  await assert.rejects(
    () => chatPcOgAi(cred, [{ role: 'user', content: 'hi' }], { fetchImpl }),
    (err: Error) =>
      err instanceof PcOgAiHttpError && (err as PcOgAiHttpError).status === 401,
  );
});

test('throws PcOgAiResponseError on malformed JSON body', async () => {
  const cred = makeCred();
  const { fetchImpl } = makeFetch(() => ({ body: 'not-json-at-all' }));
  await assert.rejects(
    () => chatPcOgAi(cred, [{ role: 'user', content: 'hi' }], { fetchImpl }),
    (err: Error) =>
      err instanceof PcOgAiResponseError && /malformed JSON/.test(err.message),
  );
});

test('throws PcOgAiResponseError when the 200 has no assistant content', async () => {
  // Refusing to fabricate output is the §1 brutal-honesty path: empty
  // content from upstream means we cannot anchor a receipt — surface it.
  const cred = makeCred();
  const { fetchImpl } = makeFetch(() => ({
    body: JSON.stringify({ choices: [{ message: { content: '' } }] }),
  }));
  await assert.rejects(
    () => chatPcOgAi(cred, [{ role: 'user', content: 'hi' }], { fetchImpl }),
    (err: Error) =>
      err instanceof PcOgAiResponseError && /no assistant content/.test(err.message),
  );
});

test('strips trailing slash on baseUrl when assembling /chat/completions', async () => {
  const cred = makeCred({ serviceUrl: 'https://pc.0g.ai/v1/' });
  const { fetchImpl, calls } = makeFetch(() => ({ body: happyBody }));
  await chatPcOgAi(cred, [{ role: 'user', content: 'hi' }], { fetchImpl });
  assert.equal(calls[0]!.url, 'https://pc.0g.ai/v1/chat/completions');
});
