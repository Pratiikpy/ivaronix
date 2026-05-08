'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <span
          className="mono"
          style={{ color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {shortAddr(address)}
        </span>
        <button onClick={() => disconnect()} className="btn-ghost" aria-label="Disconnect wallet" style={{ whiteSpace: 'nowrap' }}>
          Disconnect
        </button>
      </div>
    );
  }

  const injectedConnector = connectors.find((c) => c.id === 'injected');
  return (
    <button
      onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      disabled={isPending || !injectedConnector}
      className="btn-secondary"
      aria-label="Connect wallet"
    >
      {isPending ? 'Connecting…' : 'Connect wallet'}
    </button>
  );
}
