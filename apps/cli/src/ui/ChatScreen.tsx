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
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { Keyring, ChatRichMessage } from '@ivaronix/og-router';
import type { Address } from '@ivaronix/core';
import { TOOL_DEFS, dispatchTool } from '../lib/chat-tools.js';

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
  { name: '/clear', help: 'start a new conversation in this session' },
  { name: '/exit', help: 'quit' },
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
}

export function ChatScreen(props: Props): React.ReactElement {
  const { exit } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
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
    const [cmd] = line.slice(1).trim().split(/\s+/);
    switch (cmd) {
      case 'exit':
      case 'quit':
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
      case 'clear':
        setMessages([]);
        return true;
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

      <Box>
        <Text color="green">{'› '}</Text>
        <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} placeholder="…" />
      </Box>
      <Footer state={footer} />
    </Box>
  );
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
          <Text>{message.content}</Text>
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
