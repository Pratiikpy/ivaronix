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

import { useChainId, useSwitchChain, useAccount } from 'wagmi';
import { NETWORKS } from '@ivaronix/core';
import { getChainId, getNetwork } from '@/lib/chain';

export function ChainGuard() {
  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync, isPending } = useSwitchChain();
  const network = getNetwork();
  const expected = NETWORKS[network];

  if (!isConnected) return null;
  if (currentChainId === expected.chainId) return null;

  const onSwitch = async () => {
    try {
      await switchChainAsync({ chainId: getChainId() });
    } catch {
      // User rejected or MM doesn't support — banner stays visible
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
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 13,
      }}
    >
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
        {isPending ? 'Switching…' : `Switch to ${expected.name} →`}
      </button>
    </div>
  );
}
