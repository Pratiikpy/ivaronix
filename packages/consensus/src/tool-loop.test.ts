/**
 * Tool-loop runner tests · offline · uses a stub keyring that returns
 * pre-programmed responses with tool_calls. Verifies the loop:
 *   1. Stops when the model returns toolCalls=[]
 *   2. Dispatches each tool_call in order
 *   3. Feeds the tool_result back as a 'tool' role message
 *   4. Records argumentsHash / responseHash / durationMs in the trace
 *   5. Respects maxIterations as a safety net
 *   6. Handles dispatchTool throws by feeding error message back
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { runWithTools } from './tool-loop.js';
import type {
  ChatRichInput,
  ChatRichMessage,
  ChatRichResult,
  Keyring,
  ToolDef,
} from '@ivaronix/og-router';

/**
 * A keyring stub that returns a queue of pre-programmed ChatRichResults.
 * Each call shifts the next result off the queue. Records the messages it
 * was given so tests can assert the loop fed `tool` role messages back
 * correctly.
 */
function makeStubKeyring(responses: ChatRichResult[]): {
  keyring: Keyring;
  calls: ChatRichMessage[][];
} {
  const calls: ChatRichMessage[][] = [];
  const stub = {
    async chatRich(input: ChatRichInput): Promise<ChatRichResult> {
      calls.push(JSON.parse(JSON.stringify(input.messages)) as ChatRichMessage[]);
      if (responses.length === 0) {
        throw new Error('stub keyring: response queue exhausted');
      }
      return responses.shift()!;
    },
  };
  // Cast through unknown — the stub satisfies the chatRich contract, which is
  // the only method tool-loop touches. Other Keyring methods (chat, drainRotations)
  // are not called by runWithTools.
  return { keyring: stub as unknown as Keyring, calls };
}

const FAKE_TOOL: ToolDef = {
  type: 'function',
  function: {
    name: 'web_fetch',
    description: 'Fetch text from a URL.',
    parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
  },
};

test('runWithTools · zero tool_calls completes in 1 iteration', async () => {
  const { keyring, calls } = makeStubKeyring([
    {
      content: 'Final answer · no tools needed.',
      toolCalls: [],
      finishReason: 'stop',
    },
  ]);
  const dispatchCalls: { name: string; args: string }[] = [];
  const result = await runWithTools({
    keyring,
    systemPrompt: 'sys',
    userPrompt: 'user',
    tools: [FAKE_TOOL],
    dispatchTool: async (name, args) => {
      dispatchCalls.push({ name, args });
      return { ok: true, output: 'never called' };
    },
  });
  assert.equal(result.iterations, 1);
  assert.equal(result.completed, true);
  assert.equal(result.toolCallTrace.length, 0);
  assert.equal(result.content, 'Final answer · no tools needed.');
  assert.equal(dispatchCalls.length, 0);
  // Initial call had only system + user — confirms loop primed the conversation right
  const first = calls[0];
  assert.ok(first, 'expected an initial chatRich invocation');
  assert.equal(first.length, 2);
  assert.equal(first[0]?.role, 'system');
  assert.equal(first[1]?.role, 'user');
});

test('runWithTools · one tool_call · 2 iterations · trace records the call', async () => {
  const { keyring, calls } = makeStubKeyring([
    {
      content: '',
      toolCalls: [
        {
          id: 'tc_1',
          type: 'function',
          function: { name: 'web_fetch', arguments: JSON.stringify({ url: 'https://example.com' }) },
        },
      ],
      finishReason: 'tool_calls',
    },
    {
      content: 'Got the page. Done.',
      toolCalls: [],
      finishReason: 'stop',
    },
  ]);
  const result = await runWithTools({
    keyring,
    systemPrompt: 'sys',
    userPrompt: 'user',
    tools: [FAKE_TOOL],
    dispatchTool: async () => ({ ok: true, output: '<html>example</html>' }),
  });
  assert.equal(result.iterations, 2);
  assert.equal(result.completed, true);
  assert.equal(result.toolCallTrace.length, 1);
  const t = result.toolCallTrace[0];
  assert.ok(t, 'expected at least one trace entry');
  assert.equal(t.tool, 'web_fetch');
  assert.equal(t.ok, true);
  assert.ok(t.argumentsHash.startsWith('sha256:'));
  assert.ok(t.responseHash.startsWith('sha256:'));
  assert.equal(t.responseSize, '<html>example</html>'.length);
  // Second chatRich call should have system+user+assistant(with tool_calls)+tool
  const secondCall = calls[1];
  assert.ok(secondCall, 'expected a second chatRich invocation');
  assert.equal(secondCall.length, 4);
  assert.equal(secondCall[2]?.role, 'assistant');
  assert.equal(secondCall[3]?.role, 'tool');
  assert.equal(secondCall[3]?.tool_call_id, 'tc_1');
});

test('runWithTools · multiple tool_calls in one iteration · dispatches all + feeds each back', async () => {
  const { keyring } = makeStubKeyring([
    {
      content: '',
      toolCalls: [
        { id: 'a', type: 'function', function: { name: 'web_fetch', arguments: '{"url":"u1"}' } },
        { id: 'b', type: 'function', function: { name: 'web_fetch', arguments: '{"url":"u2"}' } },
        { id: 'c', type: 'function', function: { name: 'web_fetch', arguments: '{"url":"u3"}' } },
      ],
      finishReason: 'tool_calls',
    },
    { content: 'All fetched.', toolCalls: [], finishReason: 'stop' },
  ]);
  const calls: string[] = [];
  const result = await runWithTools({
    keyring,
    systemPrompt: 'sys',
    userPrompt: 'user',
    tools: [FAKE_TOOL],
    dispatchTool: async (_name, args) => {
      const parsed = JSON.parse(args) as { url: string };
      calls.push(parsed.url);
      return { ok: true, output: `body-of-${parsed.url}` };
    },
  });
  assert.equal(result.iterations, 2);
  assert.equal(result.toolCallTrace.length, 3);
  assert.deepEqual(calls, ['u1', 'u2', 'u3']);
});

test('runWithTools · dispatchTool throws · feeds error message back · run continues', async () => {
  const { keyring } = makeStubKeyring([
    {
      content: '',
      toolCalls: [
        { id: 'fail', type: 'function', function: { name: 'web_fetch', arguments: '{}' } },
      ],
      finishReason: 'tool_calls',
    },
    { content: 'Recovered.', toolCalls: [], finishReason: 'stop' },
  ]);
  const result = await runWithTools({
    keyring,
    systemPrompt: 'sys',
    userPrompt: 'user',
    tools: [FAKE_TOOL],
    dispatchTool: async () => {
      throw new Error('network down');
    },
  });
  assert.equal(result.iterations, 2);
  assert.equal(result.completed, true);
  assert.equal(result.toolCallTrace.length, 1);
  const errTrace = result.toolCallTrace[0];
  assert.ok(errTrace, 'expected a trace entry for the failed dispatch');
  assert.equal(errTrace.ok, false);
  assert.ok(errTrace.responseSize > 0, 'error message has length');
});

test('runWithTools · maxIterations halts runaway loops · returns completed=false', async () => {
  // Keep returning tool_calls forever — would otherwise loop infinitely.
  // Stub returns a fresh response each call by closure.
  const callsRemaining = { n: 10 };
  const stub: Keyring = {
    async chatRich(): Promise<ChatRichResult> {
      callsRemaining.n -= 1;
      return {
        content: '',
        toolCalls: [
          { id: `t${callsRemaining.n}`, type: 'function', function: { name: 'web_fetch', arguments: '{}' } },
        ],
        finishReason: 'tool_calls',
      };
    },
  } as unknown as Keyring;
  const result = await runWithTools({
    keyring: stub,
    systemPrompt: 'sys',
    userPrompt: 'user',
    tools: [FAKE_TOOL],
    dispatchTool: async () => ({ ok: true, output: 'ok' }),
    maxIterations: 3,
  });
  assert.equal(result.iterations, 3);
  assert.equal(result.completed, false);
  assert.equal(result.toolCallTrace.length, 3); // 3 iterations × 1 tool_call each
});
