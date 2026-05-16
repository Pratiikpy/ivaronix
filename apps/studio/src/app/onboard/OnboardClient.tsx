'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useBalance,
  useConnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { injected } from 'wagmi/connectors';
import { parseAbi } from 'viem';
import Link from 'next/link';
import { ShareButton } from '@/components/ShareButton';
import { GALILEO_GAS_PARAMS } from '@/lib/client-abis';
import { NETWORKS, type Network } from '@ivaronix/core';

/**
 * /onboard — 5 visible rows that flip grey → spinner → green-check.
 * Implements COMPONENTS.md §1 spec end-to-end:
 *   1. Connect wallet
 *   2. Faucet check (auto-pass when balance ≥ 0.05 OG; show faucet link otherwise)
 *   3. Pick handle (2–32 chars, basic sanity; uniqueness is enforced socially —
 *      contract stores metadataRoot, not handle)
 *   4. Upload metadata to 0G Storage + mint AgentPassport (real testnet tx)
 *   5. Run first action (sample doc + private-doc-review) → ends on the
 *      shareable Public Proof URL `/r/<id>`.
 */

const SAMPLE_DOC = `Lease Agreement v1 · 2026-05-08

1. Tenant agrees to maintain renter's insurance with $300,000 minimum coverage.
2. Landlord may enter the unit at any time without prior notice for any maintenance or inspection deemed necessary.
3. Late fees: 10% of monthly rent per day after the 5th of the month, compounding.
4. Subletting requires Landlord's written approval; unauthorized sublets are grounds for immediate termination and forfeiture of deposit.
5. Termination notice: 90 days written notice required from Tenant; Landlord may terminate with 30 days notice for any reason.
6. Tenant agrees to indemnify Landlord against any and all claims arising from Tenant's occupancy.
7. Disputes resolved exclusively through binding arbitration in Landlord's choice of jurisdiction.
8. Security deposit (2 months rent) is non-refundable.`;

const PASSPORT_ABI = parseAbi([
  'function mint(bytes32 metadataRoot) external returns (uint256)',
  'function passportOf(address) external view returns (uint256)',
]);

// Faucet is testnet-only. On mainnet (Aristotle) users source OG from a CEX
// or the 0G bridge — there is no public faucet. Per-network gating below.
const FAUCET_URL = 'https://faucet.0g.ai';
const MIN_BALANCE_WEI = BigInt('50000000000000000'); // 0.05 OG

type RowState = 'idle' | 'spinning' | 'done' | 'error';

interface Row {
  num: number;
  title: string;
  state: RowState;
  detail?: string;
  hint?: string;
}

interface RunResponse {
  ok: boolean;
  receiptId?: string | null;
  receiptOnchainId?: string | null;
  receiptTxHash?: string | null;
  finalText?: string;
  error?: string;
}

function StateChip({ state }: { state: RowState }) {
  const colors: Record<RowState, { bg: string; fg: string; label: string }> = {
    idle:     { bg: 'transparent', fg: 'var(--color-muted)', label: '○' },
    spinning: { bg: 'transparent', fg: 'var(--color-compute)', label: '◐' },
    done:     { bg: 'transparent', fg: 'var(--color-verified)', label: '●' },
    error:    { bg: 'transparent', fg: 'var(--color-mismatch)', label: '✕' },
  };
  const c = colors[state];
  const animate = state === 'spinning'
    ? { animation: 'spin 1.2s linear infinite' as const }
    : {};
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 999,
        border: `1px solid ${c.fg}`,
        color: c.fg,
        background: c.bg,
        fontFamily: 'monospace',
        fontSize: 14,
        flexShrink: 0,
        ...animate,
      }}
    >
      {c.label}
    </span>
  );
}

function RowCard({ row, children, isCurrent }: { row: Row; children?: React.ReactNode; isCurrent: boolean }) {
  return (
    <div
      className="card"
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        opacity: row.state === 'idle' && !isCurrent ? 0.5 : 1,
        borderLeft: isCurrent ? '2px solid var(--color-compute)' : '2px solid transparent',
        transition: 'opacity 200ms, border-color 200ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <StateChip state={row.state} />
        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 17, fontWeight: 500 }}>
            {row.num}. {row.title}
          </span>
          {row.detail && (
            <span className="mono" style={{ fontSize: 13, color: 'var(--color-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {row.detail}
            </span>
          )}
        </div>
      </div>
      {row.hint && (
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginLeft: 40 }}>
          {row.hint}
        </div>
      )}
      {(isCurrent || row.state === 'spinning' || row.state === 'error') && children && (
        <div style={{ marginLeft: 40 }}>{children}</div>
      )}
    </div>
  );
}

export function OnboardClient({
  passportAddr,
  network,
}: {
  passportAddr: `0x${string}` | null;
  network: Network;
}) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connectPending } = useConnect();
  const balanceQuery = useBalance({ address, chainId: network === 'testnet' ? 16602 : 16661 });
  const { writeContract, data: mintTxHash, isPending: mintPending, error: mintError, reset: resetMint } = useWriteContract();
  const mintReceipt = useWaitForTransactionReceipt({ hash: mintTxHash });

  // After mint confirms, query passportOf(address) for the new tokenId.
  const passportOfQuery = useReadContract({
    abi: PASSPORT_ABI,
    address: passportAddr ?? undefined,
    functionName: 'passportOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!passportAddr && !!mintReceipt.data },
  });

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [handle, setHandle] = useState<string>('');
  const [handleError, setHandleError] = useState<string | null>(null);
  const [metadataRoot, setMetadataRoot] = useState<`0x${string}` | null>(null);
  const [storageTxHash, setStorageTxHash] = useState<string | null>(null);
  const [storageMethod, setStorageMethod] = useState<'0g-storage' | 'local-sha256' | null>(null);
  const [metadataPending, setMetadataPending] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<bigint | null>(null);

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Derived row states
  const balance = balanceQuery.data?.value ?? null;
  const balanceOk = balance !== null && balance >= MIN_BALANCE_WEI;

  // Auto-advance step 1 → 2 when wallet connects
  useEffect(() => {
    if (step === 1 && isConnected) setStep(2);
  }, [step, isConnected]);

  // Auto-advance step 2 → 3 when balance is sufficient
  useEffect(() => {
    if (step === 2 && balanceOk) setStep(3);
  }, [step, balanceOk]);

  // After mint confirms + passportOf returns, lock tokenId and advance.
  useEffect(() => {
    if (step === 4 && passportOfQuery.data && tokenId === null) {
      setTokenId(passportOfQuery.data as bigint);
      setStep(5);
    }
  }, [step, passportOfQuery.data, tokenId]);

  const rows: Row[] = useMemo(() => [
    {
      num: 1,
      title: 'Connect your wallet',
      state: isConnected ? 'done' : (step === 1 ? 'idle' : 'idle'),
      detail: address ? `${address.slice(0, 6)}…${address.slice(-4)}` : undefined,
    },
    {
      num: 2,
      title: 'Check balance',
      state: !isConnected ? 'idle' : balanceOk ? 'done' : (step === 2 ? 'spinning' : 'idle'),
      detail: balance !== null ? `${(Number(balance) / 1e18).toFixed(4)} OG` : undefined,
      hint: !isConnected ? undefined : (balanceOk ? undefined : (network === 'mainnet'
        ? 'Need ≥ 0.05 OG to mint a passport. Source from a CEX or the 0G mainnet bridge.'
        : 'Need ≥ 0.05 OG to mint a passport. Faucet below.')),
    },
    {
      num: 3,
      title: 'Pick a handle',
      state: tokenId !== null ? 'done' : (handle.length >= 2 && step >= 3 ? (step === 3 ? 'spinning' : 'done') : (step === 3 ? 'idle' : 'idle')),
      detail: handle ? `@${handle}` : undefined,
    },
    {
      num: 4,
      title: 'Mint your Agent Passport',
      state: tokenId !== null ? 'done'
        : mintReceipt.isLoading || mintPending || metadataPending ? 'spinning'
        : (mintError || metadataError) ? 'error'
        : (step === 4 ? 'idle' : 'idle'),
      detail: tokenId !== null ? `tokenId #${tokenId.toString()}` : (mintTxHash ? `${mintTxHash.slice(0, 10)}…` : undefined),
    },
    {
      num: 5,
      title: 'Run your first action',
      state: runResult?.receiptOnchainId ? 'done'
        : running ? 'spinning'
        : runError ? 'error'
        : (step === 5 ? 'idle' : 'idle'),
      detail: runResult?.receiptOnchainId ? `receipt #${runResult.receiptOnchainId}` : undefined,
    },
  ], [
    address, balance, balanceOk, handle, isConnected, metadataError, metadataPending,
    mintError, mintPending, mintReceipt.isLoading, mintTxHash, runError, runResult,
    running, step, tokenId,
  ]);

  // ── Step 1: connect ────────────────────────────────────────────────────────
  const onConnect = () => {
    const c = connectors.find((x) => x.id === 'injected') ?? injected();
    connect({ connector: c });
  };

  // ── Step 3 → 4: validate handle, upload metadata, kick mint ────────────────
  const onMintPassport = async () => {
    setHandleError(null);
    setMetadataError(null);
    if (!isConnected || !address) {
      setHandleError('connect a wallet first');
      return;
    }
    if (!passportAddr) {
      setMetadataError('AgentPassport not deployed on this network');
      return;
    }
    if (!/^[a-zA-Z0-9_-]{2,32}$/.test(handle)) {
      setHandleError('handle must be 2–32 chars (a-z, 0-9, _, -)');
      return;
    }
    setStep(4);
    setMetadataPending(true);
    try {
      const res = await fetch('/api/onboard/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, ownerWallet: address }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMetadataError(json.error ?? 'metadata upload failed');
        setMetadataPending(false);
        return;
      }
      setMetadataRoot(json.metadataRoot);
      setStorageTxHash(json.storageTxHash);
      setStorageMethod(json.method);
      setMetadataPending(false);

      // Real testnet tx — wallet popup opens here.
      // Galileo's 2 Gwei priority-fee floor would render MM as
      // "Network fee: Unavailable" without explicit EIP-1559 fields;
      // GALILEO_GAS_PARAMS pins them. See lib/client-abis.ts doc.
      writeContract({
        abi: PASSPORT_ABI,
        address: passportAddr,
        functionName: 'mint',
        args: [json.metadataRoot as `0x${string}`],
        ...GALILEO_GAS_PARAMS,
      });
    } catch (err) {
      setMetadataError((err as Error).message);
      setMetadataPending(false);
    }
  };

  // ── Step 5: run private-doc-review on the sample lease ─────────────────────
  const onRunFirstAction = async () => {
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId: 'private-doc-review',
          question: 'What is the worst clause for the tenant?',
          contentText: SAMPLE_DOC,
          tier: 'quick',
          receipt: true,
        }),
      });
      const json = (await res.json()) as RunResponse;
      if (!res.ok || !json.ok) {
        setRunError(json.error ?? 'run failed');
        setRunning(false);
        return;
      }
      setRunResult(json);
      setRunning(false);
    } catch (err) {
      setRunError((err as Error).message);
      setRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <RowCard row={rows[0]!} isCurrent={step === 1}>
        {!isConnected && (
          <button onClick={onConnect} disabled={connectPending} className="btn-primary">
            {connectPending ? 'Connecting…' : 'Connect injected wallet'}
          </button>
        )}
      </RowCard>

      <RowCard row={rows[1]!} isCurrent={step === 2}>
        {isConnected && !balanceOk && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 14 }}>
              {balance === null
                ? 'Loading balance…'
                : network === 'mainnet'
                  ? 'Source OG from a CEX or the 0G mainnet bridge, then re-check.'
                  : 'Get testnet OG from the faucet, then refresh.'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {network === 'testnet' && (
                <a href={FAUCET_URL} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                  Open faucet ↗
                </a>
              )}
              {network === 'mainnet' && (
                <a href="https://docs.0g.ai/" target="_blank" rel="noopener noreferrer" className="btn-secondary">
                  Bridge / CEX docs ↗
                </a>
              )}
              <button onClick={() => balanceQuery.refetch()} className="btn-ghost">
                I funded — re-check
              </button>
            </div>
          </div>
        )}
      </RowCard>

      <RowCard row={rows[2]!} isCurrent={step === 3}>
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              placeholder="your-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              maxLength={32}
              className="input"
              style={{ fontSize: 16, padding: '10px 14px' }}
            />
            {handleError && <div style={{ color: 'var(--color-mismatch)', fontSize: 13 }}>{handleError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onMintPassport}
                disabled={!handle || handle.length < 2}
                className="btn-primary"
              >
                Continue → mint
              </button>
            </div>
          </div>
        )}
      </RowCard>

      <RowCard row={rows[3]!} isCurrent={step === 4}>
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            {metadataPending && <div style={{ color: 'var(--color-muted)' }}>Uploading metadata to 0G Storage…</div>}
            {metadataRoot && (
              <div className="mono" style={{ color: 'var(--color-muted)', wordBreak: 'break-all' }}>
                metadataRoot {metadataRoot.slice(0, 18)}…  · via {storageMethod}
              </div>
            )}
            {storageTxHash && (
              <a
                className="mono"
                href={`${NETWORKS[network].chainExplorer}/tx/${storageTxHash}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--color-storage)' }}
              >
                Storage tx → {storageTxHash.slice(0, 18)}…
              </a>
            )}
            {mintPending && <div style={{ color: 'var(--color-muted)' }}>Confirm in wallet…</div>}
            {mintTxHash && (
              <a
                className="mono"
                href={`${NETWORKS[network].chainExplorer}/tx/${mintTxHash}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--color-chain)' }}
              >
                Mint tx → {mintTxHash.slice(0, 18)}… {mintReceipt.isLoading ? '(confirming…)' : ''}
              </a>
            )}
            {(mintError || metadataError) && (
              <div style={{ color: 'var(--color-mismatch)' }}>
                {mintError?.message ?? metadataError ?? 'mint failed'}
                <button onClick={() => { resetMint(); setMetadataError(null); setStep(3); }} className="btn-ghost" style={{ marginLeft: 8 }}>
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
      </RowCard>

      <RowCard row={rows[4]!} isCurrent={step === 5}>
        {step === 5 && !runResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
              We'll run <span className="mono">private-doc-review</span> against a sample lease and produce a signed receipt.
            </div>
            <button onClick={onRunFirstAction} disabled={running} className="btn-primary">
              {running ? 'Running…' : 'Run sample audit'}
            </button>
            {runError && <div style={{ color: 'var(--color-mismatch)', fontSize: 13 }}>{runError}</div>}
          </div>
        )}
        {runResult?.receiptOnchainId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14 }}>
              Your first receipt is anchored on chain.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={`/r/${runResult.receiptOnchainId}`} className="btn-primary">
                Open Public Proof URL →
              </Link>
              <ShareButton
                url={`${typeof window !== 'undefined' ? window.location.origin : ''}/r/${runResult.receiptOnchainId}`}
                text={`My first AI receipt on 0G — verified on chain. /r/${runResult.receiptOnchainId}`}
              />
            </div>
            {runResult.finalText && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--color-muted)' }}>
                  Show audit findings
                </summary>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 8, padding: 12, background: 'var(--color-card-bg)' }}>
                  {runResult.finalText}
                </pre>
              </details>
            )}
          </div>
        )}
      </RowCard>
    </div>
  );
}

