// v3-lookup-allow: chat-v2 writer emits slots 0-9 only (chat receipt types); slot 10+ types must add V3 address lookup + anchor branch per packages/runtime/src/pipeline.ts SLOTS_REQUIRING_V3. Tracked in USER_TODO §B-V2-37.
// Passport trust-score read now V2-first via getActivePassportClient. Closes the V1-only waiver from USER_TODO §B-V2-38 (✅ shipped).
import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { JsonRpcProvider } from 'ethers';
import { keyringFromEnv } from '@ivaronix/og-router/keyring';
import { ReceiptRegistryClient, ReceiptRegistryV2Client, getDeployedAddress } from '@ivaronix/og-chain';
import { getActivePassportClient } from '../lib/passport.js';
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
        if (!env.walletAddress) return null;
        const handle = getActivePassportClient(env.network, provider);
        if (!handle) return null;
        const data = await handle.client.getPassportByWallet(env.walletAddress as Address);
        if (!data) return null;
        return {
          tokenId: data.tokenId.toString(),
          trust: data.trustScore.toString(),
          receipts: data.receiptCount.toString(),
          contract: handle.version.toUpperCase() as 'V1' | 'V2',
        };
      } catch {
        return null;
      }
    };
    const fetchTotalReceipts = async () => {
      // Sweep 179: unified V1 + V2 sum so the TUI header counts post-K-2
      // anchors too. Pre-sweep this read V1's nextId alone and the
      // displayed count under-counted by every V2 anchor since sweep 222.
      try {
        const v2Addr = getDeployedAddress(env.network, 'ReceiptRegistryV2');
        const v1Addr = getDeployedAddress(env.network, 'ReceiptRegistry');
        if (!v2Addr && !v1Addr) return null;
        let total = 0n;
        if (v2Addr) {
          const next = await new ReceiptRegistryV2Client(v2Addr, provider).nextId();
          if (next > 0n) total += next - 1n;
        }
        if (v1Addr) {
          const next = await new ReceiptRegistryClient(v1Addr, provider).nextId();
          if (next > 0n) total += next - 1n;
        }
        return total;
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
