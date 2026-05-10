import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { JsonRpcProvider } from 'ethers';
import { keyringFromEnv } from '@ivaronix/og-router/keyring';
import { AgentPassportClient, ReceiptRegistryClient, getDeployedAddress } from '@ivaronix/og-chain';
import type { Address } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';
import { ChatScreen } from '../ui/ChatScreen.js';
import { listConversations, loadConversation, type ConversationFile } from '../lib/conversation.js';

/**
 * `ivaronix chat-v2` — opt-in Ink TUI scaffold (companion to the
 * readline-based `ivaronix chat`).
 *
 * Lives next to the readline-based `ivaronix chat` so users can A/B
 * compare. When TUI reaches feature parity with the readline version,
 * we'll alias `chat` → chat-v2 and rename the legacy command to
 * `chat-classic`.
 */
export const chatV2Command = new Command('chat-v2')
  .alias('chat')
  .description('Interactive Ink TUI (default) — streaming, tool panels, slash palette, multi-line input, syntax highlighting, auto-resume')
  .option('--model <id>', 'model id', 'qwen/qwen-2.5-7b-instruct')
  .option('--skill <id>', 'active skill id')
  .option('--resume <id>', 'resume a saved conversation by id (or short prefix)')
  .option('--new', 'force a new conversation, even if a recent one is auto-resumable')
  .action(async (opts: { model: string; skill?: string; resume?: string; new?: boolean }) => {
    const env = loadEnv();
    const keyring = keyringFromEnv();
    if (!keyring) {
      ui.fail('Router not configured', 'Set IVARONIX_ROUTER_KEY / IVARONIX_ROUTER_URL / IVARONIX_ROUTER_PROVIDER / IVARONIX_WALLET_ADDRESS (legacy: ZG_API_SECRET / ZG_SERVICE_URL / OG_COMPUTE_PROVIDER / EVM_WALLET_ADDRESS) in .env');
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });

    const fetchPassport = async () => {
      try {
        const addr = getDeployedAddress(env.network, 'AgentPassportINFT');
        if (!addr || !env.walletAddress) return null;
        const client = new AgentPassportClient(addr, provider);
        const data = await client.getPassportByWallet(env.walletAddress as Address);
        if (!data) return null;
        return {
          tokenId: data.tokenId.toString(),
          trust: data.trustScore.toString(),
          receipts: data.receiptCount.toString(),
        };
      } catch {
        return null;
      }
    };
    const fetchTotalReceipts = async () => {
      try {
        const addr = getDeployedAddress(env.network, 'ReceiptRegistry');
        if (!addr) return null;
        const client = new ReceiptRegistryClient(addr, provider);
        // The contract exposes a monotonically-increasing nextId; the
        // anchored count is nextId - 1 (id 0 is reserved as "unset").
        const next = await client.nextId();
        return next > 0n ? next - 1n : 0n;
      } catch {
        return null;
      }
    };

    // Resume logic: explicit --resume wins; else auto-pick the most recent
    // conversation if its updatedAt is within 24h (Claude Code pattern). --new
    // overrides everything and starts fresh.
    let priorConv: ConversationFile | null = null;
    if (!opts.new) {
      if (opts.resume) {
        try {
          priorConv = loadConversation(opts.resume);
        } catch (err) {
          ui.fail((err as Error).message);
          process.exitCode = 1;
          return;
        }
      } else {
        const recent = listConversations(1)[0];
        if (recent && Date.now() - recent.updatedAt < 24 * 3600_000) {
          try { priorConv = loadConversation(recent.id); } catch { /* ignore, fall through */ }
        }
      }
    }

    const { waitUntilExit } = render(
      <ChatScreen
        keyring={keyring}
        initialModel={priorConv?.model ?? opts.model}
        initialSkillId={priorConv?.skill ?? opts.skill ?? null}
        network={env.network}
        walletAddress={(env.walletAddress as Address | undefined) ?? null}
        fetchPassport={fetchPassport}
        fetchTotalReceipts={fetchTotalReceipts}
        cwd={process.cwd()}
        priorConv={priorConv}
      />,
    );
    await waitUntilExit();
  });
