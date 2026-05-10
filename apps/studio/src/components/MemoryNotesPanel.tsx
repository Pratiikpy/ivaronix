'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';

interface StudioNote {
  id: string;
  ts: number;
  scope: string;
  text: string;
}

const SCOPES = ['project', 'work', 'legal', 'deals', 'personal'] as const;
type Scope = (typeof SCOPES)[number];

/**
 * Studio per-wallet memory quick-capture (planning-003 §A.4.8).
 *
 * The encrypted MemoryEngine ships in `packages/memory/` (used by
 * the CLI's `ivaronix memory remember`). Studio's surface is the
 * lightweight quick-capture: type a note, hit ⌘+Enter to save, hit
 * a query to recall. Stored as plaintext per-wallet — see the
 * disclosure rendered in the panel header.
 */
export function MemoryNotesPanel() {
  const { isConnected } = useAccount();
  const [notes, setNotes] = useState<StudioNote[]>([]);
  const [draft, setDraft] = useState('');
  const [scope, setScope] = useState<Scope>('project');
  const [recallQuery, setRecallQuery] = useState('');
  const [recallHits, setRecallHits] = useState<StudioNote[] | null>(null);
  const [busy, setBusy] = useState<'idle' | 'saving' | 'recalling' | 'forgetting'>('idle');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    try {
      const r = await fetch('/api/memory/list', { credentials: 'include' });
      if (r.status === 401) {
        setNotes([]);
        setError('SIWE session not found — sign in to read your notes.');
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as { notes: StudioNote[] };
      setNotes(json.notes);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [isConnected]);

  useEffect(() => { refresh(); }, [refresh]);

  const onRemember = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy('saving');
    setError(null);
    try {
      const r = await fetch('/api/memory/remember', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, scope }),
      });
      if (r.status === 401) throw new Error('SIWE session required');
      if (r.status === 429) throw new Error('rate-limited (60 writes/hr)');
      if (!r.ok) {
        const json = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? `HTTP ${r.status}`);
      }
      setDraft('');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('idle');
    }
  };

  const onRecall = async () => {
    if (!recallQuery.trim()) {
      setRecallHits(null);
      return;
    }
    setBusy('recalling');
    setError(null);
    try {
      const r = await fetch('/api/memory/recall', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: recallQuery }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as { hits: StudioNote[] };
      setRecallHits(json.hits);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('idle');
    }
  };

  const onForget = async (id: string) => {
    setBusy('forgetting');
    setError(null);
    try {
      const r = await fetch('/api/memory/forget', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
      // If we're currently looking at a recall set, drop the deleted note from it too.
      if (recallHits) setRecallHits(recallHits.filter((n) => n.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('idle');
    }
  };

  const onKeyDownDraft = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onRemember();
    }
  };

  const fmtTs = (ts: number) => new Date(ts).toISOString().slice(0, 16).replace('T', ' ');

  if (!isConnected) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>
          Connect a wallet to use Studio memory. The encrypted MemoryEngine is
          available via <code className="mono">ivaronix memory remember</code> on the CLI today.
        </p>
      </div>
    );
  }

  const visible = recallHits ?? notes;
  const heading = recallHits ? `Recall hits (${visible.length})` : `Recent notes (${visible.length})`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 24 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>§ Quick capture</div>
        <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 0, marginBottom: 12 }}>
          Plaintext, per-wallet sandbox. The operator process can read these. For end-to-end
          encrypted memory use <code className="mono">ivaronix memory remember</code> (CLI).
          See <a href="/docs/PRIVACY_NOTES.md" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>privacy notes</a>.
        </p>

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDownDraft}
          placeholder="Drop a note. ⌘+Enter to save."
          rows={3}
          maxLength={4000}
          style={{
            width: '100%',
            padding: 12,
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-sm, 8px)',
            background: 'var(--color-bg)',
            color: 'var(--color-fg)',
            fontFamily: 'inherit',
            fontSize: 14,
            resize: 'vertical',
          }}
          disabled={busy !== 'idle'}
        />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            scope&nbsp;
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              style={{
                padding: '4px 8px',
                border: '1px solid var(--color-hairline)',
                background: 'var(--color-bg)',
                fontSize: 12,
                fontFamily: 'inherit',
              }}
              disabled={busy !== 'idle'}
            >
              {SCOPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onRemember}
            className="btn-secondary"
            disabled={busy !== 'idle' || draft.trim().length === 0}
            style={{ fontSize: 13, padding: '6px 14px' }}
          >
            {busy === 'saving' ? 'saving…' : 'Remember →'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
            {draft.length}/4000 bytes
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>§ Recall</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={recallQuery}
            onChange={(e) => setRecallQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onRecall()}
            placeholder="lease clauses, vendor renewal, …"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-sm, 8px)',
              background: 'var(--color-bg)',
              color: 'var(--color-fg)',
              fontFamily: 'inherit',
              fontSize: 14,
            }}
            disabled={busy !== 'idle'}
          />
          <button
            type="button"
            onClick={onRecall}
            className="btn-secondary"
            disabled={busy !== 'idle' || recallQuery.trim().length === 0}
            style={{ fontSize: 13, padding: '6px 14px' }}
          >
            {busy === 'recalling' ? 'recalling…' : 'Recall →'}
          </button>
          {recallHits && (
            <button
              type="button"
              onClick={() => { setRecallHits(null); setRecallQuery(''); }}
              className="btn-ghost"
              style={{ fontSize: 13, padding: '6px 14px' }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="section-label" style={{ marginBottom: 8 }}>{heading}</div>

        {error && (
          <p style={{ fontSize: 12, color: 'var(--color-mismatch)', marginBottom: 12 }}>
            Error: {error}
          </p>
        )}

        {visible.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            {recallHits ? 'No matches.' : 'No notes yet.'}
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visible.map((n) => (
              <li
                key={n.id}
                style={{
                  borderBottom: '1px solid var(--color-hairline)',
                  paddingBottom: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                    {fmtTs(n.ts)} · {n.scope}
                  </span>
                  <button
                    type="button"
                    onClick={() => onForget(n.id)}
                    className="btn-ghost"
                    disabled={busy !== 'idle'}
                    style={{ fontSize: 11, padding: '2px 6px' }}
                  >
                    forget
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                  {n.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
