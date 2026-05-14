/**
 * Tool-loop runner · the runtime extension that closes the Mata v. Avianca
 * gap identified in `QA_PROOF_PACK/legal-cluster/citation-verifier-audit.md`.
 *
 * The og-router's `chatRich` already supports passing `tools` and returns
 * `toolCalls` in the response (see packages/og-router/src/index.ts:183-200).
 * The interactive `chat` REPL in ChatScreen.tsx wires this into a real loop
 * (ChatScreen.tsx:425-510). But the consensus runner's `runReviewer` uses
 * `keyring.chat()` (single-pass, no tools).
 *
 * This module exposes the canonical loop as a standalone helper that any
 * consumer can reuse — consensus runner, doc-ask CLI command, future
 * marketplace runner. The signature is intentionally narrow:
 *
 *   - opts.keyring          — for credential rotation + chatRich
 *   - opts.systemPrompt     — first system message
 *   - opts.userPrompt       — first user message
 *   - opts.tools            — tool definitions the model can call
 *   - opts.dispatchTool     — caller-provided executor (HTTP, shell, etc.)
 *   - opts.maxIterations    — safety net against runaway loops (default 8)
 *
 * Returns the final assistant content plus a `toolCallTrace` array recording
 * every tool invocation (name, args hash, ok, duration, response hash, size).
 * The trace is what receipt-assembly stores in `execution.toolCallTrace`
 * for downstream verification.
 *
 * Failure modes:
 *   - opts.keyring.chatRich throws ⇒ rethrown to caller (handles its own
 *     retry / fallback policy)
 *   - opts.dispatchTool throws ⇒ caught; the tool_result content becomes
 *     an error message so the model can recover gracefully in the next loop
 *     iteration
 *   - maxIterations reached without a tool-call-free response ⇒ returns
 *     the last assistant content + the collected trace; the caller decides
 *     whether to treat as failure (e.g., the runtime gate)
 */
import type {
  ChatRichMessage,
  ChatRichResult,
  Keyring,
  ToolCall,
  ToolDef,
} from '@ivaronix/og-router';
import { createHash } from 'node:crypto';

export interface ToolCallTrace {
  /** Tool name as declared in ToolDef.function.name (e.g. "web_fetch") */
  tool: string;
  /** sha256 of the tool_call.function.arguments JSON string */
  argumentsHash: string;
  /** Did dispatchTool return ok: true? */
  ok: boolean;
  /** Wall time the dispatchTool call took, milliseconds. */
  durationMs: number;
  /** sha256 of the dispatchTool response text */
  responseHash: string;
  /** Response text byte length BEFORE the 8KB truncation that goes back to the model */
  responseSize: number;
}

export interface RunWithToolsInput {
  keyring: Keyring;
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  tools: ToolDef[];
  /**
   * Caller-provided dispatcher. Receives the tool name + the raw arguments
   * JSON string emitted by the model. Returns { ok, output } where output
   * is the text fed back to the model as the tool_result.
   *
   * Implementations should NOT throw on tool-internal failures (e.g., HTTP
   * 404, command exit non-zero). Return `{ ok: false, output: "<message>" }`
   * so the model can see the error and recover. Throws should be reserved
   * for unrecoverable infrastructure errors (network down, dispatcher
   * misconfiguration).
   */
  dispatchTool: (name: string, args: string) => Promise<{ ok: boolean; output: string }>;
  /** Default 8. Set lower if cost-sensitive, higher for complex tool flows. */
  maxIterations?: number;
  /** Forwarded to chatRich. Default true. */
  verifyTee?: boolean;
}

export interface RunWithToolsResult {
  /** Final assistant message content (the response after the last tool round). */
  content: string;
  /** Every tool invocation in order. Empty array if the model never called a tool. */
  toolCallTrace: ToolCallTrace[];
  /** Did the loop terminate naturally (model emitted no more tool_calls)? */
  completed: boolean;
  /** Number of chatRich iterations actually run. */
  iterations: number;
  /** The raw final ChatRichResult — useful for billing + attestation. */
  finalRaw: ChatRichResult | null;
}

function sha256Hex(input: string): string {
  return 'sha256:' + createHash('sha256').update(input, 'utf8').digest('hex');
}

const MAX_TOOL_RESPONSE_FED_BACK = 8 * 1024;

export async function runWithTools(opts: RunWithToolsInput): Promise<RunWithToolsResult> {
  const max = opts.maxIterations ?? 8;
  const conversation: ChatRichMessage[] = [
    { role: 'system', content: opts.systemPrompt },
    { role: 'user', content: opts.userPrompt },
  ];
  const trace: ToolCallTrace[] = [];
  let raw: ChatRichResult | null = null;
  let iter = 0;
  let completed = false;

  while (iter < max) {
    iter += 1;
    raw = await opts.keyring.chatRich({
      model: opts.model,
      messages: conversation,
      tools: opts.tools,
      toolChoice: 'auto',
      verifyTee: opts.verifyTee ?? true,
      stream: false,
    });

    conversation.push({
      role: 'assistant',
      content: raw.content || null,
      tool_calls: raw.toolCalls.length > 0 ? raw.toolCalls : undefined,
    });

    if (raw.toolCalls.length === 0) {
      completed = true;
      break;
    }

    for (const tc of raw.toolCalls) {
      const started = Date.now();
      let dispatched: { ok: boolean; output: string };
      try {
        dispatched = await opts.dispatchTool(tc.function.name, tc.function.arguments);
      } catch (err) {
        // Surface infrastructure errors back to the model rather than aborting —
        // the model can re-plan if a tool genuinely failed. The caller should
        // see the trace + completed=false to decide whether to retry.
        dispatched = { ok: false, output: `dispatch error: ${(err as Error).message}` };
      }
      trace.push({
        tool: tc.function.name,
        argumentsHash: sha256Hex(tc.function.arguments ?? ''),
        ok: dispatched.ok,
        durationMs: Date.now() - started,
        responseHash: sha256Hex(dispatched.output),
        responseSize: dispatched.output.length,
      });
      conversation.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: dispatched.output.slice(0, MAX_TOOL_RESPONSE_FED_BACK),
      });
    }
  }

  return {
    content: raw?.content ?? '',
    toolCallTrace: trace,
    completed,
    iterations: iter,
    finalRaw: raw,
  };
}

// Re-export the types callers commonly need so they don't have to grab
// ToolDef/ToolCall from og-router separately.
export type { ToolCall, ToolDef } from '@ivaronix/og-router';
