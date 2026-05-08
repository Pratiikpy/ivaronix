/**
 * Phase B' — Ink TUI scaffold for the premium CLI rewrite.
 *
 * Goal (per BUILD_PROGRESS Phase B'): replace the readline REPL with an
 * OpenCode + Claude Code grade interactive surface. This file is the
 * minimum viable scaffold:
 *
 *   - banner header with the brackets-with-i mark
 *   - scrollable message list (assistant / user / tool-result rendered
 *     as distinct bubbles)
 *   - persistent footer with live network + passport + receipts state
 *   - bottom-anchored text input (multi-line via paste; shift-enter
 *     newline support added in the next iteration)
 *
 * Wired behind the new `ivaronix chat-v2` subcommand. The legacy
 * readline `ivaronix chat` stays put for SSH / piped workflows. When
 * the TUI reaches feature parity with the readline version, we'll
 * switch the bare-name `ivaronix` invocation to chat-v2 and rename
 * the legacy command to `chat-classic`.
 *
 * What ships in this scaffold:
 *   - banner, footer, message list, input field, send-on-enter
 *   - one round-trip to the router for assistant replies (no tools
 *     yet — tool dispatch comes in iteration 2)
 *   - cost meter increments live as tokens flow through
 *
 * What's deferred to later iterations:
 *   - streaming token render (need a controlled reducer)
 *   - syntax-highlighted code blocks
 *   - slash command palette
 *   - tab completion
 *   - tool-call panels
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { Keyring, ChatRichMessage } from '@ivaronix/og-router';
import type { Address } from '@ivaronix/core';

interface FooterState {
  network: 'testnet' | 'mainnet';
  model: string;
  skill: string | null;
  passport: { tokenId: string; trust: string; receipts: string } | null;
  totalReceipts: bigint | null;
  cost: { inputTokens: number; outputTokens: number; og: number };
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: number;
}

interface Props {
  keyring: Keyring;
  initialModel: string;
  initialSkillId: string | null;
  network: 'testnet' | 'mainnet';
  walletAddress: Address | null;
  fetchPassport: () => Promise<{ tokenId: string; trust: string; receipts: string } | null>;
  fetchTotalReceipts: () => Promise<bigint | null>;
}

export function ChatScreen(props: Props): React.ReactElement {
  const { exit } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [footer, setFooter] = useState<FooterState>({
    network: props.network,
    model: props.initialModel,
    skill: props.initialSkillId,
    passport: null,
    totalReceipts: null,
    cost: { inputTokens: 0, outputTokens: 0, og: 0 },
  });

  // Hydrate the footer with chain state once at startup. Refreshed every
  // time the user submits a message so the receipts/trust counters track
  // the receipts the agent itself anchors during the session.
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

  // Ctrl+C / Esc → exit cleanly. /exit slash command also exits.
  useInput((_, key) => {
    if (key.escape) exit();
  });

  const handleSubmit = async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || busy) return;
    setInput('');
    if (trimmed === '/exit' || trimmed === '/quit') {
      exit();
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
    try {
      const history: ChatRichMessage[] = [
        { role: 'system', content: `You are Ivaronix's CLI assistant. Network: ${footer.network}. Model: ${footer.model}.` },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: trimmed },
      ];
      const res = await props.keyring.chatRich({ model: footer.model, messages: history, stream: false });
      const assistantMsg: Message = {
        id: `m_${Date.now()}_a`,
        role: 'assistant',
        content: res.content || '(empty response)',
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setFooter((f) => ({
        ...f,
        cost: {
          inputTokens: f.cost.inputTokens + (res.inputTokens ?? 0),
          outputTokens: f.cost.outputTokens + (res.outputTokens ?? 0),
          og: f.cost.og + ((res.inputTokens ?? 0) * 5e-8) + ((res.outputTokens ?? 0) * 1e-7),
        },
      }));
      // refresh passport + receipts after every turn (cheap chain reads)
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
    }
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      <Banner network={footer.network} />
      <Box flexDirection="column" marginY={1}>
        {messages.length === 0 ? (
          <Text dimColor>type a message and press enter · /exit to quit</Text>
        ) : (
          messages.map((m: Message) => <MessageBubble key={m.id} message={m} />)
        )}
        {busy && (
          <Box marginTop={1}>
            <Text color="cyan"><Spinner type="dots" /></Text>
            <Text dimColor>  querying router…</Text>
          </Box>
        )}
      </Box>
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
      <Text dimColor>{'  · type your message · /exit to quit'}</Text>
    </Box>
  );
}

function MessageBubble({ message }: { message: Message }): React.ReactElement {
  const role = message.role;
  const tag = role === 'user' ? 'you' : role === 'assistant' ? 'ai' : 'sys';
  const color = role === 'user' ? 'green' : role === 'assistant' ? 'white' : 'red';
  return (
    <Box marginTop={1} flexDirection="column">
      <Text color={color} bold>{tag}</Text>
      <Box paddingLeft={2}>
        <Text>{message.content}</Text>
      </Box>
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
