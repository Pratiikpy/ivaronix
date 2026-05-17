/**
 * FINAL_BUILD_PLAN.md Block E · zero-friction demo panel.
 *
 * Renders when `?demo=true` is set on the home page and the demo wallet
 * has funds. One-button flow:
 *   1. Click "Run review →"
 *   2. POST /api/run/demo (operator-subsidised; no wallet connect needed)
 *   3. Receipt anchored with payment.subsidised=true
 *   4. Banner appears: "Demo run · operator-subsidised. Connect your wallet
 *      to run on your own document."
 *
 * Falls back honestly when the demo wallet is out of funds — the user
 * sees a "demo paused" message + a CTA to connect their own wallet.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type DemoState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'success'; receiptId: string; txHash?: string; subsidised: boolean }
  | { kind: 'paused'; reason: string }
  | { kind: 'error'; message: string };

export function DemoPanel() {
  const router = useRouter();
  const [state, setState] = useState<DemoState>({ kind: 'idle' });

  const runDemo = async () => {
    setState({ kind: 'running' });
    try {
      const r = await fetch('/api/run/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (r.status === 503 && data.code === 'DEMO_OUT_OF_FUNDS') {
        setState({ kind: 'paused', reason: data.error });
        return;
      }
      if (!r.ok || !data.ok) {
        setState({ kind: 'error', message: data.error ?? 'Demo run failed' });
        return;
      }
      setState({
        kind: 'success',
        receiptId: data.receiptOnchainId ?? data.receiptId,
        txHash: data.payment?.txHash,
        subsidised: data.subsidised,
      });
      // Redirect to /r/<id> after a brief moment
      setTimeout(() => router.push(`/r/${data.receiptOnchainId ?? data.receiptId}`), 2000);
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message });
    }
  };

  return (
    <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Eyebrow + title */}
      <div>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.6, marginBottom: 8 }}>
          § DEMO · GAS ON US
        </div>
        <h2 style={{ margin: '0 0 12px 0', fontSize: 24 }}>Try it · 30 seconds · no wallet</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, opacity: 0.8 }}>
          A pre-loaded acquisition term sheet runs through <code>private-doc-review</code> on 0G Compute TEE. A real receipt anchors on chain. You can verify it on your own machine.
        </p>
      </div>

      {/* Pre-loaded document preview */}
      <div style={{ padding: 16, background: 'var(--color-page-bg)', border: '1px solid var(--color-rule)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-mono, monospace)' }}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontFamily: 'inherit' }}>📄 sample-acquisition-term-sheet.txt</div>
        <div style={{ opacity: 0.7, lineHeight: 1.5 }}>
          The Acquirer agrees to purchase 100% of the Target's equity for $2,000,000…
          <br />
          Non-Compete: 5-year non-compete in any related field, globally…
          <br />
          Indemnification: Founder indemnifies for all known and unknown liabilities, with no cap…
        </div>
      </div>

      {/* CTA */}
      {state.kind === 'idle' && (
        <button
          onClick={runDemo}
          style={{
            padding: '14px 28px',
            fontSize: 16,
            fontWeight: 700,
            background: 'var(--color-ink, #0A0A0A)',
            color: 'var(--color-paper, #FAFAF7)',
            border: '1px solid var(--color-rule)',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Run review →
        </button>
      )}

      {state.kind === 'running' && (
        <div style={{ padding: 16, background: 'var(--color-pending-bg)', border: '1px solid var(--color-pending)', borderRadius: 6 }}>
          <strong>Running…</strong>
          <p style={{ fontSize: 13, marginTop: 8, opacity: 0.8 }}>
            Storage upload → 0G Compute TEE inference → chain anchor. ~10-30 seconds.
          </p>
        </div>
      )}

      {state.kind === 'success' && (
        <div style={{ padding: 16, background: 'var(--color-verified-bg)', border: '1px solid var(--color-verified)', borderRadius: 6 }}>
          <strong style={{ color: '#166534' }}>✓ Receipt anchored · #{state.receiptId}</strong>
          <p style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
            Opening proof page… {state.subsidised && <span style={{ opacity: 0.7 }}>(Ivaronix covered the gas — see banner)</span>}
          </p>
        </div>
      )}

      {state.kind === 'paused' && (
        <div style={{ padding: 16, background: 'var(--color-pending-bg)', border: '1px solid var(--color-pending)', borderRadius: 6 }}>
          <strong>Demo paused</strong>
          <p style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
            {state.reason} <a href="/" style={{ textDecoration: 'underline' }}>Connect your wallet</a> to run on your own document.
          </p>
        </div>
      )}

      {state.kind === 'error' && (
        <div style={{ padding: 16, background: 'var(--color-pending-bg)', border: '1px solid var(--color-pending)', borderRadius: 6 }}>
          <strong>Demo failed</strong>
          <p style={{ fontSize: 13, marginTop: 8 }}>
            {state.message}
          </p>
          <button onClick={runDemo} style={{ marginTop: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      )}

      {/* Honest disclosure */}
      <p style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.5, marginTop: 8 }}>
        <strong>What you're seeing:</strong> a real 0G testnet receipt anchored end-to-end. Ivaronix covers the demo gas so you don't need to fund a wallet. The receipt's <code>billing.payment.subsidised</code> field is set to <code>true</code> so the proof page is up-front about it.
      </p>
    </div>
  );
}
