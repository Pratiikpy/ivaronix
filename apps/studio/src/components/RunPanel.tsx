'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FourLightRow } from './FourLightRow';

type Tier = 'quick' | 'standard' | 'high-stakes';

const SKILLS: { id: string; label: string; defaultTier: Tier }[] = [
  { id: 'private-doc-review', label: 'private-doc-review', defaultTier: 'standard' },
  { id: 'github-audit', label: 'github-audit', defaultTier: 'standard' },
  { id: '0g-integration-auditor', label: '0g-integration-auditor', defaultTier: 'quick' },
  { id: 'plan-step', label: 'plan-step', defaultTier: 'quick' },
  { id: 'code-edit', label: 'code-edit', defaultTier: 'standard' },
];

interface RunResponse {
  ok: boolean;
  error?: string;
  finalText?: string;
  consensusMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  costOg?: number;
  convergenceScore?: number | null;
  receiptId?: string | null;
  receiptTxHash?: string | null;
  receiptOnchainId?: string | null;
  scan?: { matches: boolean; registered: boolean; revoked: boolean; creator: string | null; onchainManifestHash: string | null } | null;
  skill?: { id: string; version: string };
  logs?: { level: 'info' | 'pass' | 'fail'; label: string; detail: string | null }[];
}

const EXPLORER_TX = (h: string) => `https://chainscan-galileo.0g.ai/tx/${h}`;

export function RunPanel() {
  const [skillId, setSkillId] = useState<string>('private-doc-review');
  const [tier, setTier] = useState<Tier>('quick');
  const [receipt, setReceipt] = useState<boolean>(true);
  const [contentText, setContentText] = useState<string>('');
  const [question, setQuestion] = useState<string>('What is the worst clause?');
  const [running, setRunning] = useState<boolean>(false);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [layers, setLayers] = useState<Partial<Record<'Storage' | 'Compute' | 'TEE' | 'Chain', 'pending' | 'active' | 'verified' | 'mismatch'>>>({});

  const onDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const text = await f.text();
    setContentText(text.slice(0, 64_000)); // cap input to 64k chars
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/*': [], 'application/json': [], 'application/octet-stream': [] },
    maxFiles: 1,
    multiple: false,
  });

  const onRun = async () => {
    if (!contentText.trim()) return;
    setRunning(true);
    setResult(null);
    setLayers({ Storage: 'verified', Compute: 'active', TEE: 'pending', Chain: 'pending' });
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, tier, receipt, contentText, question }),
      });
      const data = (await res.json()) as RunResponse;
      setResult(data);
      if (data.ok) {
        setLayers({
          Storage: 'verified',
          Compute: 'verified',
          TEE: data.scan?.matches ? 'verified' : 'pending',
          Chain: data.receiptTxHash ? 'verified' : 'pending',
        });
      } else {
        setLayers({ Storage: 'verified', Compute: 'mismatch', TEE: 'pending', Chain: 'pending' });
      }
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
      setLayers({ Storage: 'verified', Compute: 'mismatch', TEE: 'pending', Chain: 'pending' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--color-tonal)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-lg)',
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxWidth: 720,
      }}
    >
      <p className="section-label">§ 01 · DROP A FILE OR PASTE TEXT</p>

      <div
        {...getRootProps()}
        role="button"
        aria-label="Drop a file"
        tabIndex={0}
        style={{
          padding: 24,
          border: `2px dashed ${isDragActive ? 'var(--color-accent)' : 'var(--color-hairline)'}`,
          borderRadius: 'var(--radius-md)',
          background: isDragActive ? 'var(--color-accent-soft)' : 'var(--color-card)',
          cursor: 'pointer',
          transition: 'all 200ms ease',
          textAlign: 'center',
        }}
      >
        <input {...getInputProps()} />
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-muted)' }}>
          {isDragActive ? (
            <span className="italic-display">Drop it.</span>
          ) : (
            <>
              Drop a text/markdown/code/json file, or <span style={{ textDecoration: 'underline' }}>click to browse</span>.
            </>
          )}
        </p>
        {contentText && (
          <p className="mono" style={{ marginTop: 8, fontSize: 11, color: 'var(--color-muted)' }}>
            staged · {contentText.length.toLocaleString()} chars
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          skill{' '}
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            style={{ marginLeft: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-hairline)', fontSize: 13 }}
          >
            {SKILLS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          tier{' '}
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier)}
            style={{ marginLeft: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-hairline)', fontSize: 13 }}
          >
            <option value="quick">Quick</option>
            <option value="standard">Standard</option>
            <option value="high-stakes">High-Stakes</option>
          </select>
        </label>

        <label style={{ fontSize: 13, color: 'var(--color-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={receipt} onChange={(e) => setReceipt(e.target.checked)} />
          anchor receipt
        </label>
      </div>

      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask a question about the file…"
        style={{
          padding: '10px 14px',
          fontSize: 14,
          border: '1px solid var(--color-hairline)',
          borderRadius: 6,
          background: 'var(--color-card)',
          fontFamily: 'inherit',
        }}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={onRun} disabled={running || !contentText.trim()} className="btn-primary">
          {running ? 'Running…' : 'Run'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          {running ? 'Querying 0G Router…' : 'Server signs the receipt with the testnet wallet.'}
        </span>
      </div>

      <FourLightRow layers={layers} />

      {result && <ResultCard result={result} />}
    </div>
  );
}

function ResultCard({ result }: { result: RunResponse }) {
  if (!result.ok) {
    return (
      <div
        role="alert"
        style={{
          padding: '12px 16px',
          background: 'var(--color-mismatch-bg)',
          border: '1px solid var(--color-mismatch)',
          color: '#991b1b',
          borderRadius: 6,
          fontSize: 13,
        }}
      >
        <strong>Error:</strong> {result.error}
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-md)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div className="section-label">§ AUDIT REPORT</div>

      {result.scan?.matches && (
        <span className="chip-verified">REGISTRY MATCH</span>
      )}

      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}>
        {result.finalText}
      </pre>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '6px 16px',
          fontSize: 12,
          color: 'var(--color-muted)',
          borderTop: '1px solid var(--color-hairline)',
          paddingTop: 12,
        }}
      >
        <dt>tokens</dt>
        <dd className="mono" style={{ margin: 0 }}>{result.inputTokens}+{result.outputTokens}</dd>
        <dt>elapsed</dt>
        <dd className="mono" style={{ margin: 0 }}>{result.consensusMs}ms</dd>
        <dt>cost</dt>
        <dd className="mono" style={{ margin: 0 }}>{result.costOg?.toFixed(8)} OG</dd>
        {result.convergenceScore !== undefined && result.convergenceScore !== null && (
          <>
            <dt>convergence</dt>
            <dd className="mono" style={{ margin: 0 }}>{result.convergenceScore}</dd>
          </>
        )}
      </dl>

      {result.receiptTxHash && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--color-hairline)', paddingTop: 16 }}>
          <span className="chip-verified">ANCHORED</span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            on-chain id {result.receiptOnchainId} · {result.receiptId}
          </span>
          <a
            href={EXPLORER_TX(result.receiptTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            style={{ marginLeft: 'auto', textDecoration: 'underline' }}
          >
            Verify on chain →
          </a>
        </div>
      )}
    </div>
  );
}
