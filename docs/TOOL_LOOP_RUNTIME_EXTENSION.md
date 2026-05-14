# Runtime tool-loop extension · proper-fix plan

> Closes the Mata v. Avianca runtime gap surfaced in `QA_PROOF_PACK/legal-cluster/citation-verifier-audit.md`. The legal-citation-verifier skill declares `og.tools.builtins: ['web_fetch']` but the `doc ask` consensus pipeline currently makes single-pass chat-completion calls per role with no tool execution. This document is the architectural blueprint for closing the gap; each section is a concrete code change a future cron fire can execute and verify.

## Status

| Layer | Tool-loop support today | After this plan |
|---|---|---|
| `apps/cli/src/lib/chat-tools.ts` `dispatchTool` | ✅ exists, works | reused |
| `apps/cli/src/ui/ChatScreen.tsx` (interactive REPL) | ✅ runs tool-loop end-to-end | reused as the reference impl |
| `packages/og-router/src/index.ts` `chatRich` | ✅ already accepts `tools` + returns `toolCalls` | no change |
| `packages/og-router/src/keyring.ts` `chatRich` | ✅ delegates to client.chatRich | no change |
| `packages/consensus/src/index.ts` `runConsensus` | ❌ uses `keyring.chat()` (no tools), single-pass | NEW: optional tool-loop via `keyring.chatRich` |
| `apps/cli/src/commands/doc.ts` receipt-assembly | ❌ no toolCallTrace field | NEW: capture toolCalls per role |
| `packages/receipts/src/types.ts` schema | ❌ no toolCallTrace field | NEW: optional `execution.toolCallTrace` |

## The minimal change set (4 files, ~150 lines)

### 1. `packages/consensus/src/index.ts` — accept `tools` + tool-loop runner

Add optional `tools?: ToolDef[]` and `dispatchTool?: (name: string, args: string) => Promise<{ok: boolean; output: string}>` to `RunConsensusInput`. When both are provided, `runReviewer` and the judge call route through `keyring.chatRich` instead of `keyring.chat`, and run the canonical loop:

```ts
async function runWithTools(opts: {
  keyring: Keyring;
  systemPrompt: string;
  userPrompt: string;
  model: string;
  tools: ToolDef[];
  dispatchTool: (name: string, args: string) => Promise<{ok: boolean; output: string}>;
  maxIterations?: number;  // default 8
}): Promise<{ content: string; toolCalls: ToolCallTrace[]; raw: RouterCallResult }> {
  const conversation: ChatRichMessage[] = [
    { role: 'system', content: opts.systemPrompt },
    { role: 'user', content: opts.userPrompt },
  ];
  const collected: ToolCallTrace[] = [];
  let raw: ChatRichResult | null = null;
  for (let i = 0; i < (opts.maxIterations ?? 8); i++) {
    raw = await opts.keyring.chatRich({ model: opts.model, messages: conversation, tools: opts.tools });
    conversation.push({ role: 'assistant', content: raw.content, tool_calls: raw.toolCalls.length > 0 ? raw.toolCalls : undefined });
    if (raw.toolCalls.length === 0) break;
    for (const tc of raw.toolCalls) {
      const started = Date.now();
      const r = await opts.dispatchTool(tc.function.name, tc.function.arguments);
      collected.push({
        tool: tc.function.name,
        argumentsHash: sha256HexAsync(tc.function.arguments),
        ok: r.ok,
        durationMs: Date.now() - started,
        responseHash: sha256HexAsync(r.output),
        responseSize: r.output.length,
      });
      conversation.push({ role: 'tool', tool_call_id: tc.id, content: r.output.slice(0, 8 * 1024) });
    }
  }
  return { content: raw?.content ?? '', toolCalls: collected, raw: raw! };
}
```

Wire it into `runReviewer` + the judge call: branch on `input.tools && input.dispatchTool`.

### 2. `apps/cli/src/lib/chat-tools.ts` — export the dispatcher + tools-builder for non-REPL consumers

The existing `buildSkillToolCatalog` function already returns the `defs` + `customByName` map. Export `dispatchTool` so the consensus runner can call it directly. The signature `dispatchTool(cwd, name, args, customByName)` is the dispatcher; this is already exported.

Add a small helper:

```ts
export function builtinsTools(allowed: string[]): ToolDef[] {
  return TOOL_DEFS.filter((d) => allowed.includes(d.function.name));
}
```

so `doc ask` can build the tools array from `skill.og.tools.builtins`.

### 3. `apps/cli/src/commands/doc.ts` — pass tools to consensus runner

In the `runConsensus` call:

```ts
const customByName = new Map<string, CustomTool>();
const skillTools = skill.manifest.og.tools;
const tools = skillTools
  ? [
      ...builtinsTools(skillTools.builtins ?? []),
      // custom tools build skipped for testnet · queued
    ]
  : undefined;

const consensusResult = await runConsensus({
  ...existing params,
  tools,
  dispatchTool: tools ? (name, args) => dispatchTool(process.cwd(), name, args, customByName) : undefined,
});
```

### 4. `packages/receipts/src/types.ts` + `packages/receipts/src/build.ts` — schema field

Add `execution.toolCallTrace?: ToolCallTrace[]` to the Zod schema. ToolCallTrace shape:

```ts
{
  tool: string;          // e.g. "web_fetch"
  argumentsHash: string; // sha256 of tool_call.function.arguments JSON
  ok: boolean;
  durationMs: number;
  responseHash: string;
  responseSize: number;  // bytes
}
```

Optional + defaulted-undefined so existing receipt manifests' canonical hash stays byte-stable. Aggregate across all roles in `doc.ts` receipt-assembly: union `consensusResult.toolCalls` from every reviewer + the judge.

### 5. The runtime enforcement gate (the architectural win)

In `apps/cli/src/commands/doc.ts` immediately before `signReceipt`:

```ts
const skillTools = skill.manifest.og.tools;
if (skillTools?.builtins?.includes('web_fetch')) {
  // The skill declares it needs HTTP verification. If no web_fetch tool_call
  // happened, fail closed — anchoring a receipt that claims verification
  // without HTTP traffic is the Mata v. Avianca attack surface.
  const fetchCallCount = (toolCallTrace ?? []).filter((t) => t.tool === 'web_fetch').length;
  if (fetchCallCount === 0) {
    ui.fail(`Skill ${skill.id} declares web_fetch but the run produced 0 web_fetch tool_calls.`);
    ui.hint(`Re-run, or upgrade to a model that reliably emits tool_calls (mainnet promotion).`);
    process.exitCode = 1;
    return; // do NOT sign or anchor
  }
}
```

This is the FAIL-CLOSED gate the locked memory mandates.

## Test plan

After implementation:

1. `pnpm --filter @ivaronix/consensus test` — existing 21 tests still pass
2. `pnpm --filter @ivaronix/cli typecheck` — clean
3. Re-run `pnpm ivaronix doc ask seed-skills/legal-citation-verifier/tests/sample-two-hallucinated-cases.txt ... --skill legal-citation-verifier`
4. Either: anchor succeeds with `execution.toolCallTrace.length > 0` AND `outputs.citations` populated — architecture closed
5. Or: CLI exits 1 with the fail-closed error — Mata v. Avianca attack surface closed at runtime
6. Both outcomes are correct per the architectural contract

## Out of scope (queued for later)

- Custom tool shell-runners through this path (testnet: builtins only)
- Streaming tool_calls (use non-streaming chatRich for now)
- Tool-call rate limiting (the Router's 30 req/min cap applies naturally)
- Receipt page rendering of toolCallTrace (Studio /r/[id] page enhancement)

## Why this lands across multiple fires

The 4-file change set above touches the load-bearing inference pipeline that the 4 working legal skills depend on. Shipping it half-built risks breaking those skills. Each cron fire ships one of the file changes with verification:

- Fire 10A: `packages/og-router` — confirm `chatRich` is exported correctly; type tests
- Fire 10B: `packages/consensus` — add `tools?` + `dispatchTool?` + tool-loop runner; update tests
- Fire 10C: `apps/cli/src/commands/doc.ts` — pass tools + dispatchTool; capture toolCallTrace
- Fire 10D: `packages/receipts` — schema field for toolCallTrace
- Fire 10E: runtime gate in doc.ts + integration test (re-run Mata probe)

After Fire 10E, the citation-verifier closure is complete: either the 7B emits real tool_calls and the receipt records them, or the run fails-closed before chain anchor. Both outcomes uphold the Mata v. Avianca architectural contract.

## Sources

- `packages/og-router/src/index.ts:183-200` — `chatRich` already returns `toolCalls`
- `apps/cli/src/ui/ChatScreen.tsx:425-510` — canonical tool-loop reference impl
- `apps/cli/src/lib/chat-tools.ts:238-251` + `:270-340` — `webFetchTool` + `buildSkillToolCatalog`
- `packages/consensus/src/index.ts:135-180` — current `runReviewer` + judge call (single-pass)
- `QA_PROOF_PACK/legal-cluster/citation-verifier-audit.md` — the audit that surfaced this gap

## Date

2026-05-14 · written during Fire 10 of the LEGAL VERTICAL HARD-LAUNCH PIVOT directive · the proper-fix arc per the locked feedback_make_everything_work_end_to_end.md memory.
