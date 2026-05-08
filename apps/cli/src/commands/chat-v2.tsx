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

/**
 * `ivaronix chat-v2` — opt-in Ink TUI (Phase B' scaffold).
 *
 * Lives next to the readline-based `ivaronix chat` so users can A/B
 * compare. When TUI reaches feature parity with the readline version,
 * we'll alias `chat` → chat-v2 and rename the legacy command to
 * `chat-classic`.
 */
export const chatV2Command = new Command('chat-v2')
  .description('[Phase B\'] Ink-based interactive TUI — premium CLI surface (opt-in)')
  .option('--model <id>', 'model id', 'qwen/qwen-2.5-7b-instruct')
  .option('--skill <id>', 'active skill id')
  .action(async (opts: { model: string; skill?: string }) => {
    const env = loadEnv();
    const keyring = keyringFromEnv();
    if (!keyring) {
      ui.fail('Router not configured', 'Set ZG_API_SECRET / ZG_SERVICE_URL / OG_COMPUTE_PROVIDER / EVM_WALLET_ADDRESS in .env');
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

    const { waitUntilExit } = render(
      <ChatScreen
        keyring={keyring}
        initialModel={opts.model}
        initialSkillId={opts.skill ?? null}
        network={env.network}
        walletAddress={(env.walletAddress as Address | undefined) ?? null}
        fetchPassport={fetchPassport}
        fetchTotalReceipts={fetchTotalReceipts}
      />,
    );
    await waitUntilExit();
  });
