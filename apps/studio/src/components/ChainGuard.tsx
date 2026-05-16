'use client';

/**
 * ChainGuard — proactive network mismatch handler.
 *
 * When the connected wallet is on a chain different from the active
 * deployment (mainnet build = chainId 16661, testnet build = 16602),
 * render a sticky banner with a "Switch network" button that calls
 * wagmi's switchChainAsync. If MM doesn't know the chain it auto-adds
 * it via the standard EIP-3085 wallet_addEthereumChain dance.
 *
 * This is BEFORE the user clicks Run/Mint/Withdraw — so they never
 * see an Ethereum-mainnet popup asking them to send 0.015 ETH to a
 * 0G contract address that doesn't exist on Ethereum.
 *
 * Belt-and-braces with the `chainId` enforcement on every
 * writeContract call: this banner prevents the wrong popup from
 * being requested, the writeContract chainId rejects it if it
 * still slips through.
 */

import { useState } from 'react';
import { useChainId, useSwitchChain, useAccount } from 'wagmi';
// Import via /types subpath — the barrel pulls hash.ts (node:crypto) which
// webpack rejects in client bundles. /types is constants + types only.
import { NETWORKS } from '@ivaronix/core/types';
import { getChainId, getNetwork } from '@/lib/network';
import { friendlyTxError } from '@/lib/friendly-tx-error';

export function ChainGuard() {
  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync, isPending } = useSwitchChain();
  const network = getNetwork();
  const expected = NETWORKS[network];
  // Bug-28 (2026-05-16): the prior bare catch swallowed every failure
  // silently — a judge clicking "Switch network" with MM blocking the
  // popup (or rejecting it, or not having OG mainnet added) saw the
  // banner stay open with no explanation. Surface the error in-place
  // and give a manual fallback link. Per CLAUDE.md §1 (no silent
  // failures) + the goal-file Priority #2 (wallet/network switch).
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isConnected) return null;
  if (currentChainId === expected.chainId) return null;

  const onSwitch = async () => {
    setErrorMsg(null);
    try {
      await switchChainAsync({ chainId: getChainId() });
    } catch (err) {
      setErrorMsg(friendlyTxError(err, { network }));
    }
  };

  return (
    <div
      role="alert"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--color-pending-bg, #fef3c7)',
        borderBottom: '1px solid var(--color-pending, #d97706)',
        color: '#92400e',
        padding: '10px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span>
          <strong>Wrong network.</strong>{' '}
          Wallet is on chainId <code>{currentChainId}</code> · Ivaronix runs on{' '}
          <strong>{expected.name}</strong> (chainId <code>{expected.chainId}</code>).
          Payment popups would show the wrong currency until you switch.
        </span>
        <button
          onClick={onSwitch}
          disabled={isPending}
          style={{
            padding: '6px 14px',
            background: 'var(--color-ink, #0A0A0A)',
            color: 'var(--color-paper, #FAFAF7)',
            border: '1px solid var(--color-rule)',
            borderRadius: 6,
            cursor: isPending ? 'wait' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {isPending ? 'Switching… open MetaMask' : `Switch to ${expected.name} →`}
        </button>
      </div>
      {errorMsg && (
        <div style={{
          fontSize: 12,
          padding: '8px 10px',
          background: 'rgba(217, 119, 6, 0.08)',
          borderRadius: 4,
          border: '1px solid rgba(217, 119, 6, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <strong>Switch failed:</strong> {errorMsg}
          <span style={{ opacity: 0.85 }}>
            If MetaMask didn&apos;t open a popup, open the extension manually,
            click the network selector, and add <strong>OG {expected.name}</strong>{' '}
            (chainId {expected.chainId}, RPC <code>{expected.rpcUrl}</code>).
          </span>
        </div>
      )}
    </div>
  );
}
