/**
 * Phase B' Ink TUI — iteration 2.
 *
 * What's added since iteration 1:
 *   - streaming token render (assistant text fills in as it arrives)
 *   - tool-call dispatch with framed-box panels (read_file / grep /
 *     run_bash / list_files / write_file / web_fetch)
 *   - slash command handler with live palette popup as the user types `/`
 *   - cost meter increments live during streaming
 *
 * Still deferred to iteration 3:
 *   - syntax-highlighted code blocks (cli-highlight integration)
 *   - multi-line input editor (shift-enter newline; current single-line
 *     TextInput is fine for the demo)
 *   - tab completion for non-slash inputs (file paths, skill ids)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { highlight } from 'cli-highlight';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Keyring, ChatRichMessage } from '@ivaronix/og-router';
import type { Address } from '@ivaronix/core';
import { TOOL_DEFS, dispatchTool } from '../lib/chat-tools.js';
import {
  newConversation,
  saveConversation,
  loadConversation,
  listConversations,
  type ConversationFile,
} from '../lib/conversation.js';
import { MultiLineInput } from './MultiLineInput.js';

interface FooterState {
  network: 'testnet' | 'mainnet';
  model: string;
  skill: string | null;
  passport: { tokenId: string; trust: string; receipts: string } | null;
  totalReceipts: bigint | null;
  cost: { inputTokens: number; outputTokens: number; og: number };
}

type ToolCallView = {
  id: string;
  name: string;
  args: string;
  result: string | null;
  ok: boolean | null; // null = running, true/false = done
};

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCallView[];
  ts: number;
}

const SLASH_COMMANDS: { name: string; help: string }[] = [
  { name: '/help', help: 'show this list' },
  { name: '/cost', help: 'tokens · OG · message count' },
  { name: '/passport', help: 'live passport state from chain' },
  { name: '/skill', help: 'set active skill (`/skill private-doc-review`, `/skill off`)' },
  { name: '/model', help: 'switch model (`/model qwen/qwen-2.5-7b-instruct`)' },
  { name: '/memory', help: 'search the local memory engine (`/memory <query>`)' },
  { name: '/history', help: 'list saved conversations' },
  { name: '/resume', help: 'load a saved conversation by id (`/resume <prefix>`)' },
  { name: '/save', help: 'save the conversation; `/save md` exports markdown' },
  { name: '/clear', help: 'start a new conversation in this session' },
  { name: '/retry', help: 're-run the last assistant turn' },
  { name: '/undo', help: 'remove the last user+assistant pair' },
  { name: '/usage', help: 'detailed token + OG breakdown for this session' },
  { name: '/skills', help: 'list installed first-party skills' },
  { name: '/exit', help: 'quit' },
];

const SUPPORTED_MODELS = [
  'qwen/qwen-2.5-7b-instruct',
  'qwen/qwen-2.5-14b-instruct',
  'meta/llama-3-8b-instruct',
];

interface Props {
  keyring: Keyring;
  initialModel: string;
  initialSkillId: string | null;
  network: 'testnet' | 'mainnet';
  walletAddress: Address | null;
  fetchPassport: () => Promise<{ tokenId: string; trust: string; receipts: string } | null>;
  fetchTotalReceipts: () => Promise<bigint | null>;
  cwd: string;
  priorConv?: ConversationFile | null;
}

export function ChatScreen(props: Props): React.ReactElement {
  const { exit } = useApp();
  // Hydrate from prior conversation if --resume / auto-resume picked one.
  const initialMessages: Message[] = (props.priorConv?.messages ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m, i) => ({
      id: `prior_${i}`,
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : '',
      ts: props.priorConv!.updatedAt,
    }));
  const [conv, setConv] = useState<ConversationFile>(() =>
    props.priorConv ??
    newConversation({
      network: props.network,
      model: props.initialModel,
      skill: props.initialSkillId,
      messages: [],
      tokens: { input: 0, output: 0 },
      costOg: 0,
      receipts: [],
    }),
  );
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [footer, setFooter] = useState<FooterState>({
    network: props.network,
    model: props.initialModel,
    skill: props.initialSkillId,
    passport: null,
    totalReceipts: null,
    cost: { inputTokens: 0, outputTokens: 0, og: 0 },
  });

  const hydrate = async () => {
    try {
      const [passport, totalReceipts] = await Promise.all([
        props.fetchPassport(),
        props.fetchTotalReceipts(),
      ]);
      setFooter((f) => ({ ...f, passport, totalReceipts }));
    } catch { /* best-effort */ }
  };
  useEffect(() => {
    hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInput((_, key) => {
    if (key.escape) exit();
  });

  const handleSlash = (line: string): boolean => {
    const parts = line.slice(1).trim().split(/\s+/);
    const cmd = parts[0];
    const arg = parts.slice(1).join(' ');
    switch (cmd) {
      case 'exit':
      case 'quit':
        // Auto-save before exit so the conversation is recoverable.
        try { saveConversation({ ...conv, messages: convMessages(messages) }); } catch { /* ignore */ }
        exit();
        return true;
      case 'help': {
        const m: Message = {
          id: `m_${Date.now()}_h`,
          role: 'system',
          content: SLASH_COMMANDS.map((s) => `${s.name.padEnd(12)} ${s.help}`).join('\n'),
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, m]);
        return true;
      }
      case 'cost': {
        const m: Message = {
          id: `m_${Date.now()}_c`,
          role: 'system',
          content: `tokens: ${footer.cost.inputTokens}+${footer.cost.outputTokens} · cost: ${footer.cost.og.toFixed(10)} OG · messages: ${messages.length}`,
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, m]);
        return true;
      }
      case 'passport': {
        const p = footer.passport;
        const m: Message = {
          id: `m_${Date.now()}_p`,
          role: 'system',
          content: p ? `tokenId=${p.tokenId} · trust=${p.trust} · receipts=${p.receipts}` : '(no passport for the configured wallet)',
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, m]);
        return true;
      }
      case 'save': {
        const updated: ConversationFile = { ...conv, messages: convMessages(messages) };
        const jsonPath = saveConversation(updated);
        let extra = '';
        if (arg === 'md') {
          // Export markdown beside the JSON file.
          const mdPath = jsonPath.replace(/\.json$/, '.md');
          mkdirSync(dirname(mdPath), { recursive: true });
          const md = renderMarkdown(updated, messages);
          writeFileSync(mdPath, md, 'utf8');
          extra = ` · markdown → ${mdPath}`;
        }
        const m: Message = {
          id: `m_${Date.now()}_s`,
          role: 'system',
          content: `saved → ${jsonPath}${extra}`,
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, m]);
        return true;
      }
      case 'clear':
        setMessages([]);
        setConv(newConversation({
          network: props.network,
          model: footer.model,
          skill: footer.skill,
          messages: [],
          tokens: { input: 0, output: 0 },
          costOg: 0,
          receipts: [],
        }));
        return true;
      case 'skill': {
        if (!arg || arg === 'off') {
          setFooter((f) => ({ ...f, skill: null }));
          setMessages((prev) => [...prev, { id: `m_${Date.now()}_skill`, role: 'system', content: 'skill cleared', ts: Date.now() }]);
        } else {
          setFooter((f) => ({ ...f, skill: arg }));
          setMessages((prev) => [...prev, { id: `m_${Date.now()}_skill`, role: 'system', content: `active skill: ${arg}`, ts: Date.now() }]);
        }
        return true;
      }
      case 'model': {
        if (!arg) {
          const lines = [`current: ${footer.model}`, ...SUPPORTED_MODELS.map((m) => `${m === footer.model ? '●' : '○'} ${m}`)];
          setMessages((prev) => [...prev, { id: `m_${Date.now()}_model`, role: 'system', content: lines.join('\n'), ts: Date.now() }]);
        } else {
          setFooter((f) => ({ ...f, model: arg }));
          setMessages((prev) => [...prev, { id: `m_${Date.now()}_model`, role: 'system', content: `model: ${arg}`, ts: Date.now() }]);
        }
        return true;
      }
      case 'memory': {
        if (!arg) {
          setMessages((prev) => [...prev, { id: `m_${Date.now()}_memhelp`, role: 'system', content: 'usage: /memory <query>', ts: Date.now() }]);
          return true;
        }
        // Defer the recall — memory engine is heavyweight; render a placeholder
        // and run async, then patch the system message.
        const id = `m_${Date.now()}_mem`;
        setMessages((prev) => [...prev, { id, role: 'system', content: `searching memory for "${arg}"…`, ts: Date.now() }]);
        void runMemoryRecall(arg, id, setMessages);
        return true;
      }
      case 'history': {
        try {
          const rows = listConversations(8);
          if (rows.length === 0) {
            setMessages((prev) => [...prev, { id: `m_${Date.now()}_h`, role: 'system', content: '(no saved conversations)', ts: Date.now() }]);
          } else {
            const lines = ['recent conversations:', ...rows.map((r) => `${new Date(r.updatedAt).toISOString().slice(0, 16).replace('T', ' ')}  ${r.id}  ${r.messages} msgs · ${r.model}`)];
            setMessages((prev) => [...prev, { id: `m_${Date.now()}_h`, role: 'system', content: lines.join('\n'), ts: Date.now() }]);
          }
        } catch (err) {
          setMessages((prev) => [...prev, { id: `m_${Date.now()}_he`, role: 'system', content: `history error: ${(err as Error).message}`, ts: Date.now() }]);
        }
        return true;
      }
      case 'retry': {
        // Re-run the last user message. Find the most recent user msg, drop
        // anything after it (the previous assistant reply + system noise),
        // then submit it through the normal chat path.
        let lastUserIdx = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i]!.role === 'user') { lastUserIdx = i; break; }
        }
        if (lastUserIdx < 0) {
          setMessages((prev) => [...prev, { id: `m_${Date.now()}_re`, role: 'system', content: 'no prior user message to retry', ts: Date.now() }]);
          return true;
        }
        const lastUser = messages[lastUserIdx]!.content;
        // Trim the conversation back to just before that last user msg
        setMessages((prev) => prev.slice(0, lastUserIdx));
        // Defer to next tick so the state update settles, then re-submit
        setTimeout(() => { void handleSubmit(lastUser); }, 0);
        return true;
      }
      case 'undo': {
        // Remove the last user+assistant pair (Hermes-style undo).
        let lastUserIdx = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i]!.role === 'user') { lastUserIdx = i; break; }
        }
        if (lastUserIdx < 0) {
          setMessages((prev) => [...prev, { id: `m_${Date.now()}_u`, role: 'system', content: 'nothing to undo', ts: Date.now() }]);
          return true;
        }
        setMessages((prev) => prev.slice(0, lastUserIdx));
        return true;
      }
      case 'usage': {
        // Detailed breakdown vs /cost which is just a one-liner.
        const lines = [
          `── usage for this session ──`,
          `model        ${footer.model}`,
          `network      ${footer.network}`,
          `messages     ${messages.length}`,
          `input tokens  ${footer.cost.inputTokens}`,
          `output tokens ${footer.cost.outputTokens}`,
          `total tokens  ${footer.cost.inputTokens + footer.cost.outputTokens}`,
          `cost (OG)     ${footer.cost.og.toFixed(10)}`,
          footer.passport ? `passport      tokenId ${footer.passport.tokenId} · trust ${footer.passport.trust} · receipts ${footer.passport.receipts}` : `passport      not connected`,
        ];
        setMessages((prev) => [...prev, { id: `m_${Date.now()}_us`, role: 'system', content: lines.join('\n'), ts: Date.now() }]);
        return true;
      }
      case 'skills': {
        // Lazy-load to avoid pulling skill loader into the cold-start path.
        void (async () => {
          try {
            const { findSkill } = await import('@ivaronix/skills');
            const { resolve } = await import('node:path');
            const candidates = ['private-doc-review', 'github-audit', '0g-integration-auditor', 'plan-step', 'code-edit'];
            const dirs = [resolve(props.cwd, 'seed-skills'), resolve(props.cwd, '.ivaronix/skills')];
            const found: string[] = [];
            for (const id of candidates) {
              const sk = findSkill(id, dirs);
              if (sk) found.push(`${id.padEnd(28)} v${sk.manifest.version} · tier=${sk.manifest.og.consensus.default_tier}`);
            }
            const text = found.length > 0 ? ['installed first-party skills:', ...found].join('\n') : '(no skills found in seed-skills or .ivaronix/skills)';
            setMessages((prev) => [...prev, { id: `m_${Date.now()}_sk`, role: 'system', content: text, ts: Date.now() }]);
          } catch (err) {
            setMessages((prev) => [...prev, { id: `m_${Date.now()}_sk`, role: 'system', content: `skills error: ${(err as Error).message}`, ts: Date.now() }]);
          }
        })();
        return true;
      }
      case 'resume': {
        if (!arg) {
          setMessages((prev) => [...prev, { id: `m_${Date.now()}_rh`, role: 'system', content: 'usage: /resume <id|prefix>', ts: Date.now() }]);
          return true;
        }
        try {
          const loaded = loadConversation(arg);
          setConv(loaded);
          const restored: Message[] = loaded.messages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m, i) => ({
              id: `prior_${i}_${Date.now()}`,
              role: m.role as 'user' | 'assistant',
              content: typeof m.content === 'string' ? m.content : '',
              ts: loaded.updatedAt,
            }));
          setMessages([...restored, { id: `m_${Date.now()}_resumed`, role: 'system', content: `resumed ${loaded.id} · ${restored.length} prior messages`, ts: Date.now() }]);
          if (loaded.model) setFooter((f) => ({ ...f, model: loaded.model }));
          if (loaded.skill !== undefined) setFooter((f) => ({ ...f, skill: loaded.skill }));
        } catch (err) {
          setMessages((prev) => [...prev, { id: `m_${Date.now()}_re`, role: 'system', content: `resume error: ${(err as Error).message}`, ts: Date.now() }]);
        }
        return true;
      }
      default:
        return false;
    }
  };

  const handleSubmit = async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || busy) return;
    setInput('');
    if (trimmed.startsWith('/')) {
      if (handleSlash(trimmed)) return;
      const m: Message = {
        id: `m_${Date.now()}_u`,
        role: 'system',
        content: `unknown command: ${trimmed}. /help for available commands.`,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, m]);
      return;
    }

    const userMsg: Message = {
      id: `m_${Date.now()}_u`,
      role: 'user',
      content: trimmed,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);

    const conversation: ChatRichMessage[] = [
      { role: 'system', content: `You are Ivaronix's CLI assistant. Network: ${footer.network}. Model: ${footer.model}.${footer.skill ? ` Active skill: ${footer.skill}.` : ''}` },
      ...messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: trimmed },
    ];

    try {
      // Tool-loop: up to 4 iterations of tool-use → final answer
      for (let iter = 0; iter < 4; iter++) {
        const assistantId = `m_${Date.now()}_a${iter}`;
        const initial: Message = {
          id: assistantId,
          role: 'assistant',
          content: '',
          toolCalls: [],
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, initial]);
        setStreamingId(assistantId);

        const res = await props.keyring.chatRich({
          model: footer.model,
          messages: conversation,
          tools: TOOL_DEFS,
          stream: true,
          onToken: (delta) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)),
            );
          },
        });
        setStreamingId(null);

        // If model didn't stream content but has it in res.content, fold it in
        if (res.content && !messages.find((m) => m.id === assistantId)?.content) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: res.content || '' } : m)),
          );
        }

        const assistantMsg: ChatRichMessage = {
          role: 'assistant',
          content: res.content || null,
          tool_calls: res.toolCalls.length > 0 ? res.toolCalls : undefined,
        };
        conversation.push(assistantMsg);

        setFooter((f) => ({
          ...f,
          cost: {
            inputTokens: f.cost.inputTokens + (res.inputTokens ?? 0),
            outputTokens: f.cost.outputTokens + (res.outputTokens ?? 0),
            og: f.cost.og + ((res.inputTokens ?? 0) * 5e-8) + ((res.outputTokens ?? 0) * 1e-7),
          },
        }));

        if (res.toolCalls.length === 0) break;

        // Render each tool call as a panel + dispatch in sequence
        for (const tc of res.toolCalls) {
          const tcView: ToolCallView = {
            id: tc.id,
            name: tc.function.name,
            args: tc.function.arguments,
            result: null,
            ok: null,
          };
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, toolCalls: [...(m.toolCalls ?? []), tcView] } : m)),
          );
          const r = await dispatchTool(props.cwd, tc.function.name, tc.function.arguments, new Map());
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    toolCalls: (m.toolCalls ?? []).map((t) =>
                      t.id === tc.id ? { ...t, result: r.output.slice(0, 800), ok: r.ok } : t,
                    ),
                  }
                : m,
            ),
          );
          conversation.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: r.output.slice(0, 8 * 1024),
          });
        }
      }
      hydrate();
      // Persist after every turn so an unexpected exit (Ctrl-C) is recoverable.
      setMessages((prev) => {
        try { saveConversation({ ...conv, messages: convMessages(prev) }); } catch { /* best-effort */ }
        return prev;
      });
    } catch (err) {
      const errMsg: Message = {
        id: `m_${Date.now()}_e`,
        role: 'system',
        content: `error: ${(err as Error).message}`,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setBusy(false);
      setStreamingId(null);
    }
  };

  // Slash palette: when input starts with /, show the matching commands
  const palette = useMemo(() => {
    if (!input.startsWith('/')) return [];
    return SLASH_COMMANDS.filter((s) => s.name.startsWith(input));
  }, [input]);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Banner network={footer.network} />
      <Box flexDirection="column" marginY={1}>
        {messages.length === 0 ? (
          <Text dimColor>type a message · /help for commands · esc to quit</Text>
        ) : (
          messages.map((m: Message) => <MessageBubble key={m.id} message={m} streaming={streamingId === m.id} />)
        )}
        {busy && !streamingId && (
          <Box marginTop={1}>
            <Text color="cyan"><Spinner type="dots" /></Text>
            <Text dimColor>  thinking…</Text>
          </Box>
        )}
      </Box>

      {palette.length > 0 && (
        <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
          {palette.map((s) => (
            <Box key={s.name}>
              <Text color="green">{s.name.padEnd(12)}</Text>
              <Text dimColor>  {s.help}</Text>
            </Box>
          ))}
        </Box>
      )}

      <MultiLineInput
        value={input}
        onChange={setInput}
        onSubmit={(v) => { handleSubmit(v); }}
        placeholder="…  shift+enter for newline · backslash-enter to continue"
        disabled={busy}
      />
      {input.length === 0 && !busy && (
        <Box marginTop={0}>
          <Text dimColor>shift+enter newline · enter submit · esc quit · ctrl+a/e line-edges</Text>
        </Box>
      )}
      <Footer state={footer} />
    </Box>
  );
}

/** Convert in-memory Message[] to ChatRichMessage[] for persistence. */
function convMessages(msgs: Message[]): ChatRichMessage[] {
  return msgs
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

/**
 * Recall from the local memory engine, then patch the placeholder system
 * message. Heavyweight (loads sqlite + embedding model); fire-and-forget.
 */
async function runMemoryRecall(
  query: string,
  placeholderId: string,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
): Promise<void> {
  try {
    const { MemoryEngine } = await import('@ivaronix/memory');
    const { resolve, dirname } = await import('node:path');
    const { existsSync, mkdirSync } = await import('node:fs');
    const { loadEnv } = await import('../lib/env.js');
    const { getDeployedAddress } = await import('@ivaronix/og-chain');
    const env = loadEnv();
    if (!env.privateKey || !env.walletAddress) {
      setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, content: 'memory: requires EVM_PRIVATE_KEY + EVM_WALLET_ADDRESS in .env' } : m));
      return;
    }
    let dir = process.cwd();
    let workspaceRoot: string | null = null;
    for (let i = 0; i < 8; i++) {
      if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) { workspaceRoot = dir; break; }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    const dbPath = workspaceRoot
      ? resolve(workspaceRoot, '.ivaronix', 'memory', 'ivaronix.db')
      : resolve(process.cwd(), '.ivaronix', 'memory', 'ivaronix.db');
    mkdirSync(dirname(dbPath), { recursive: true });
    const capAddr = getDeployedAddress(env.network, 'CapabilityRegistry');
    const logAddr = getDeployedAddress(env.network, 'MemoryAccessLog');
    const engine = MemoryEngine.create({
      ownerWallet: env.walletAddress as `0x${string}`,
      ownerPrivateKey: env.privateKey,
      dbPath,
      enableOnChainPermissions: Boolean(capAddr && logAddr),
      capabilityRegistryAddress: capAddr ?? undefined,
      memoryAccessLogAddress: logAddr ?? undefined,
      rpcUrl: env.rpcUrl,
      chainId: env.chainId,
    });
    const { hits, logTxHash } = await engine.recall({ text: query, topK: 5 });
    if (hits.length === 0) {
      setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, content: `(no matches for "${query}")` + (logTxHash ? `\naccess log tx ${logTxHash}` : '') } : m));
      return;
    }
    const lines = hits.map((h, i) =>
      `#${i + 1} score ${h.score.toFixed(3)} [${h.tags.join(', ')}]\n    ${h.text}`,
    );
    if (logTxHash) lines.push(`\naccess log tx ${logTxHash}`);
    setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, content: lines.join('\n') } : m));
  } catch (err) {
    setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, content: `memory error: ${(err as Error).message}` } : m));
  }
}

/**
 * Run cli-highlight on every fenced code block in the content. Returns the
 * original text for the prose between fences and ANSI-highlighted text for
 * the code spans. Ink's <Text> component honors ANSI escape codes, so the
 * highlight renders inline when used as <Text>{highlightContent(c)}</Text>.
 */
function highlightContent(content: string): string {
  if (!content.includes('```')) return content;
  return content.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, body) => {
    try {
      const language = (lang as string | undefined) || 'plaintext';
      const colored = highlight(body as string, { language, ignoreIllegals: true });
      return '```' + (lang ?? '') + '\n' + colored + '```';
    } catch {
      return '```' + (lang ?? '') + '\n' + body + '```';
    }
  });
}

/** Markdown export for `/save md`. Includes role headers, content, and the cost footer. */
function renderMarkdown(c: ConversationFile, msgs: Message[]): string {
  const lines: string[] = [];
  lines.push(`# Ivaronix conversation ${c.id}`);
  lines.push('');
  lines.push(`- network: \`${c.network}\``);
  lines.push(`- model: \`${c.model}\``);
  if (c.skill) lines.push(`- skill: \`${c.skill}\``);
  lines.push(`- created: ${new Date(c.createdAt).toISOString()}`);
  lines.push(`- updated: ${new Date(Date.now()).toISOString()}`);
  lines.push('');
  lines.push('---');
  for (const m of msgs) {
    lines.push('');
    if (m.role === 'user') lines.push('## you');
    else if (m.role === 'assistant') lines.push('## assistant');
    else lines.push('## system');
    lines.push('');
    lines.push(m.content);
    if (m.toolCalls && m.toolCalls.length > 0) {
      for (const tc of m.toolCalls) {
        lines.push('');
        lines.push(`### tool: ${tc.name} · ${tc.ok === true ? 'ok' : tc.ok === false ? 'failed' : 'running'}`);
        lines.push('');
        lines.push('```json');
        lines.push(tc.args);
        lines.push('```');
        if (tc.result) {
          lines.push('');
          lines.push('```');
          lines.push(tc.result);
          lines.push('```');
        }
      }
    }
  }
  return lines.join('\n');
}

function Banner({ network }: { network: 'testnet' | 'mainnet' }): React.ReactElement {
  return (
    <Box>
      <Text bold>{'[ | ] IVARONIX'}</Text>
      <Text dimColor>{'  · '}</Text>
      <Text color={network === 'testnet' ? 'yellow' : 'green'}>{network}</Text>
      <Text dimColor>{'  · streaming · tools · /help'}</Text>
    </Box>
  );
}

function MessageBubble({ message, streaming }: { message: Message; streaming: boolean }): React.ReactElement {
  const role = message.role;
  const tag = role === 'user' ? 'you' : role === 'assistant' ? 'ai' : 'sys';
  const color = role === 'user' ? 'green' : role === 'assistant' ? 'white' : 'red';
  return (
    <Box marginTop={1} flexDirection="column">
      <Box>
        <Text color={color} bold>{tag}</Text>
        {streaming && <Text dimColor>{'  · streaming'}</Text>}
      </Box>
      {message.content && (
        <Box paddingLeft={2}>
          <Text>{role === 'assistant' ? highlightContent(message.content) : message.content}</Text>
        </Box>
      )}
      {message.toolCalls?.map((tc) => <ToolPanel key={tc.id} tool={tc} />)}
    </Box>
  );
}

function ToolPanel({ tool }: { tool: ToolCallView }): React.ReactElement {
  const status = tool.ok === null ? 'running' : tool.ok ? 'ok' : 'failed';
  const color = tool.ok === null ? 'cyan' : tool.ok ? 'green' : 'red';
  const argsPreview = tool.args.length > 80 ? tool.args.slice(0, 77) + '…' : tool.args;
  return (
    <Box marginTop={1} marginLeft={2} flexDirection="column" borderStyle="single" borderColor={color} paddingX={1}>
      <Box>
        <Text color={color} bold>⚙ {tool.name}</Text>
        <Text dimColor>  · </Text>
        <Text color={color}>{status}</Text>
      </Box>
      <Box>
        <Text dimColor>{argsPreview}</Text>
      </Box>
      {tool.result && (
        <Box marginTop={1}>
          <Text dimColor>{tool.result}</Text>
        </Box>
      )}
    </Box>
  );
}

function Footer({ state }: { state: FooterState }): React.ReactElement {
  const passportTxt = state.passport
    ? `passport #${state.passport.tokenId} trust ${state.passport.trust} · receipts ${state.passport.receipts}`
    : 'passport: …';
  const totalTxt = state.totalReceipts !== null ? ` · chain ${state.totalReceipts.toString()}` : '';
  const costTxt = state.cost.inputTokens || state.cost.outputTokens
    ? ` · ${state.cost.inputTokens}+${state.cost.outputTokens} tok · ${state.cost.og.toFixed(8)} OG`
    : '';
  return (
    <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
      <Text dimColor>
        {state.network} · {state.model}{state.skill ? ` · skill ${state.skill}` : ''} · {passportTxt}{totalTxt}{costTxt}
      </Text>
    </Box>
  );
}
