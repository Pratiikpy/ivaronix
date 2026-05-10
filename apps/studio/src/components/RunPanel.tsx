'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAccount } from 'wagmi';
import { FourLightRow } from './FourLightRow';

type Tier = 'quick' | 'standard' | 'high-stakes' | 'audit';
/**
 * Aggregation policy override per planning-003 §A.4.4 (zer0Gig
 * Efficiency Game). User-facing labels:
 *   STRICT   = unanimous       (every reviewer must approve)
 *   BALANCED = majority        (skill default for most flows)
 *   LENIENT  = first-objection (any hard reject blocks; risks alone don't)
 *   AUTO     = use the skill's manifest-declared default
 */
type PolicyOverride = 'AUTO' | 'STRICT' | 'BALANCED' | 'LENIENT';

const SKILLS: { id: string; label: string; defaultTier: Tier }[] = [
  { id: 'private-doc-review', label: 'private-doc-review', defaultTier: 'standard' },
  { id: 'content-pitch-review', label: 'content-pitch-review', defaultTier: 'quick' },
  { id: 'github-audit', label: 'github-audit', defaultTier: 'standard' },
  { id: '0g-integration-auditor', label: '0g-integration-auditor', defaultTier: 'quick' },
  { id: 'plan-step', label: 'plan-step', defaultTier: 'quick' },
  { id: 'code-edit', label: 'code-edit', defaultTier: 'standard' },
];

// One-click demo doc for W1 — judges browsing without a wallet can hit
// "Use sample contract" → Run and produce a real anchored receipt in
// ~30 seconds. Shorter than a real lease, surfaces enough red flags
// for the model to find a clear "worst clause" answer.
const SAMPLE_DOC = `RESIDENTIAL LEASE — SUMMARY (sample, for demo use only)

1. Tenant agrees to a non-refundable security deposit of $4,800, payable in
   stablecoin within 24 hours of signing.
2. Tenant is responsible for all repairs regardless of cause, including those
   resulting from Landlord negligence.
3. This lease auto-renews for 24-month terms unless Tenant provides written
   notice 120 days before the renewal date.
4. Tenant waives the right to a jury trial and agrees to binding arbitration
   in a jurisdiction of Landlord's choosing.
5. Landlord may enter the premises at any time, with or without notice, for
   inspection or maintenance.
6. Pets, overnight guests, and use of common areas after 9pm are prohibited;
   violations may result in immediate eviction without cure period.
`;

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
  // Storage evidence — populated when /api/run uploads to 0G Storage. Until
  // HALF_BAKED H-3 ships real Studio-side upload, evidenceRoot is null and
  // the Storage light stays pending honestly.
  storage?: { evidenceRoot?: string | null } | null;
  logs?: { level: 'info' | 'pass' | 'fail'; label: string; detail: string | null }[];
}

const EXPLORER_TX = (h: string) => `https://chainscan-galileo.0g.ai/tx/${h}`;

/** UI label → policy name on the wire (planning-003 §A.4.4). */
const POLICY_LABEL_TO_NAME: Record<Exclude<PolicyOverride, 'AUTO'>, 'unanimous' | 'majority' | 'first-objection'> = {
  STRICT: 'unanimous',
  BALANCED: 'majority',
  LENIENT: 'first-objection',
};

export function RunPanel() {
  // W9 — capture connected wallet to send with /api/run so the receipt's
  // agent.ownerWallet records the user, not the operator.
  const { address: connectedAddress } = useAccount();
  const [skillId, setSkillId] = useState<string>('private-doc-review');

  // If the page arrived with ?skill=<id>, pre-select it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('skill');
    if (requested && SKILLS.some((s) => s.id === requested)) {
      setSkillId(requested);
    }
  }, []);
  const [tier, setTier] = useState<Tier>('quick');
  const [policyOverride, setPolicyOverride] = useState<PolicyOverride>('AUTO');
  const [receipt, setReceipt] = useState<boolean>(true);
  const [burn, setBurn] = useState<boolean>(false);
  const [contentText, setContentText] = useState<string>('');
  const [question, setQuestion] = useState<string>('What is the worst clause?');
  const [running, setRunning] = useState<boolean>(false);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [layers, setLayers] = useState<Partial<Record<'Storage' | 'Compute' | 'TEE' | 'Chain', 'pending' | 'active' | 'verified' | 'mismatch'>>>({});

  // Tier metadata for the role-preview row.
  const TIER_META: Record<Tier, { roles: number; roleNames: string[]; cost: string; warn?: string }> = {
    'quick': { roles: 1, roleNames: ['analyst'], cost: '~0.00003 OG' },
    'standard': { roles: 3, roleNames: ['analyst', 'critic', 'judge'], cost: '~0.0001 OG' },
    'high-stakes': {
      roles: 5,
      roleNames: ['analyst', 'critic', 'risk-reviewer', 'evidence-checker', 'judge'],
      cost: '~0.0003 OG',
      warn: '5 roles fire sequentially — public testnet quota is 10 RPM, may rate-limit.',
    },
    'audit': {
      roles: 6,
      roleNames: ['analyst', 'critic', 'risk-reviewer', 'evidence-checker', 'red-team-critic', 'judge'],
      cost: '~0.0007 OG',
      warn: '6 roles fire sequentially — premium adversarial-audit tier.',
    },
  };
  const tierMeta = TIER_META[tier];

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
    // S-3: every light starts pending. The previous code lit Storage green
    // BEFORE any upload happened, then stayed green even on error. Honest
    // tier marking per CLAUDE.md §6: each light reflects real evidence.
    setLayers({ Storage: 'pending', Compute: 'active', TEE: 'pending', Chain: 'pending' });
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId,
          tier,
          // Policy override per planning-003 §A.4.4. AUTO = use the
          // skill's manifest-declared default; STRICT/BALANCED/LENIENT
          // map to unanimous/majority/first-objection respectively.
          ...(policyOverride !== 'AUTO' ? { policy: POLICY_LABEL_TO_NAME[policyOverride] } : {}),
          receipt,
          burn,
          contentText,
          question,
          // W9 — pass connected wallet (if any) so the receipt is
          // attributed to the user, not the operator.
          ...(connectedAddress ? { userWallet: connectedAddress } : {}),
        }),
      });
      const data = (await res.json()) as RunResponse;
      setResult(data);
      if (data.ok) {
        setLayers({
          // Storage gates on real evidenceRoot from the response. Until
          // HALF_BAKED H-3 ships real Studio-side 0G Storage upload, the
          // response carries `storage.evidenceRoot: null` and this stays
          // pending — honest about what actually happened.
          Storage: data.storage?.evidenceRoot ? 'verified' : 'pending',
          Compute: 'verified',
          TEE: data.scan?.matches ? 'verified' : 'pending',
          Chain: data.receiptTxHash ? 'verified' : 'pending',
        });
      } else {
        // On error nothing was anchored — every light stays pending or
        // reports mismatch on Compute. No false-claim of Storage verified.
        setLayers({ Storage: 'pending', Compute: 'mismatch', TEE: 'pending', Chain: 'pending' });
      }
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
      setLayers({ Storage: 'pending', Compute: 'mismatch', TEE: 'pending', Chain: 'pending' });
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <p className="section-label" style={{ margin: 0 }}>§ 01 · DROP A FILE OR PASTE TEXT</p>
        <button
          type="button"
          onClick={() => {
            setContentText(SAMPLE_DOC);
            setQuestion('What is the worst clause for the tenant?');
          }}
          className="btn-ghost"
          style={{ fontSize: 11, padding: '4px 10px', textDecoration: 'underline' }}
        >
          Use sample contract →
        </button>
      </div>

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
            <option value="audit">Audit</option>
          </select>
        </label>

        {/* "How strict?" override per planning-003 §A.4.4 (zer0Gig Efficiency
            Game). AUTO honours the skill manifest's `og.consensus.policy`.
            STRICT/BALANCED/LENIENT map to unanimous/majority/first-objection.
            Disabled for `quick` tier where there's only one reviewer (the
            policy layer is meaningless on a single-reviewer run). */}
        <label
          title="Pick the aggregation policy for the reviewer outputs. AUTO uses the skill's declared default. STRICT = every reviewer must approve. BALANCED = majority. LENIENT = pass unless someone hard-rejects."
          style={{ fontSize: 13, color: 'var(--color-muted)' }}
        >
          how strict?{' '}
          <select
            value={policyOverride}
            onChange={(e) => setPolicyOverride(e.target.value as PolicyOverride)}
            disabled={tier === 'quick'}
            style={{ marginLeft: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-hairline)', fontSize: 13, opacity: tier === 'quick' ? 0.5 : 1 }}
          >
            <option value="AUTO">Auto (skill default)</option>
            <option value="STRICT">Strict (unanimous)</option>
            <option value="BALANCED">Balanced (majority)</option>
            <option value="LENIENT">Lenient (any reject blocks)</option>
          </select>
        </label>

        <label style={{ fontSize: 13, color: 'var(--color-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={receipt} onChange={(e) => setReceipt(e.target.checked)} />
          anchor receipt
        </label>

        <label
          title="Encrypts the input with an ephemeral AES-256-GCM session key, records the key fingerprint in the receipt, and destroys the key after the run."
          style={{ fontSize: 13, color: 'var(--color-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <input type="checkbox" checked={burn} onChange={(e) => setBurn(e.target.checked)} />
          burn mode
        </label>
      </div>

      {/* Role-preview / tier-explanation row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 12,
          color: 'var(--color-muted)',
          padding: '8px 12px',
          background: 'var(--color-card)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 6,
        }}
      >
        <span className="mono" style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
          {tier} · {tierMeta.roles} role{tierMeta.roles > 1 ? 's' : ''}
        </span>
        <span style={{ opacity: 0.7 }}>{tierMeta.roleNames.join(' · ')}</span>
        <span className="mono" style={{ marginLeft: 'auto' }}>{tierMeta.cost}</span>
      </div>
      {tierMeta.warn && (
        <div
          role="note"
          style={{
            fontSize: 12,
            color: '#92400e',
            background: 'var(--color-pending-bg)',
            border: '1px solid var(--color-pending)',
            padding: '6px 10px',
            borderRadius: 6,
          }}
        >
          ⚠ {tierMeta.warn}
        </div>
      )}
      {burn && (
        <div
          role="note"
          style={{
            fontSize: 12,
            color: 'var(--color-muted)',
            background: 'var(--color-card)',
            border: '1px dashed var(--color-burn, #7C3AED)',
            padding: '6px 10px',
            borderRadius: 6,
          }}
        >
          🔒 Burn Mode: session key destroyed after the run; encrypted evidence remains on 0G Storage. The receipt records the key fingerprint + destroyed timestamp.
        </div>
      )}

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
          {running
            ? 'Querying 0G Router…'
            : connectedAddress
              ? `Receipt agent: ${connectedAddress.slice(0, 6)}…${connectedAddress.slice(-4)} · operator anchors on your behalf.`
              : 'Server anchors the receipt; receipt owner = operator wallet (connect a wallet to attribute receipts to you).'}
        </span>
      </div>

      <FourLightRow layers={layers} />

      {result && <ResultCard result={result} />}
    </div>
  );
}

/** Parse the finalText for severity counts so we can render a counter row. */
function severityCounts(text: string): { critical: number; high: number; medium: number; low: number; informational: number } {
  const lower = text.toLowerCase();
  const count = (re: RegExp) => (lower.match(re) ?? []).length;
  return {
    critical: count(/severity:\s*critical|\bcritical\b/g),
    high: count(/severity:\s*high|\bhigh\b/g),
    medium: count(/severity:\s*medium|\bmedium\b/g),
    low: count(/severity:\s*low|\blow\b/g),
    informational: count(/severity:\s*informational|\binformational\b/g),
  };
}

/** Try to pull a `Findings: N · Critical: X · …` summary line if the skill emitted one. */
function findingsSummary(text: string): string | null {
  const m = text.match(/Findings:\s*\d+(?:\s*·\s*\w+:\s*\d+)+/i);
  return m ? m[0] : null;
}

function CountChip({ label, count, tone }: { label: string; count: number; tone: 'red' | 'amber' | 'green' | 'gray' }) {
  if (count === 0) return null;
  const palette = {
    red:   { bg: 'var(--color-mismatch-bg)', fg: '#991b1b', border: 'var(--color-mismatch)' },
    amber: { bg: 'var(--color-pending-bg)', fg: '#92400e', border: 'var(--color-pending)' },
    green: { bg: 'var(--color-verified-bg)', fg: '#166534', border: 'var(--color-verified)' },
    gray:  { bg: 'var(--color-tonal)', fg: 'var(--color-muted)', border: 'var(--color-hairline)' },
  }[tone];
  return (
    <span style={{
      background: palette.bg,
      color: palette.fg,
      border: `1px solid ${palette.border}`,
      padding: '4px 10px',
      borderRadius: 4,
      fontSize: 11,
      letterSpacing: '1px',
      textTransform: 'uppercase',
      fontWeight: 600,
    }}>
      {label}: {count}
    </span>
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

  const counts = severityCounts(result.finalText ?? '');
  const summary = findingsSummary(result.finalText ?? '');

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
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="section-label" style={{ marginRight: 8 }}>§ AUDIT REPORT</div>
        {result.scan?.matches && <span className="chip-verified">REGISTRY MATCH</span>}
        {result.scan?.registered === false && <span className="chip-pending">LOCAL ONLY</span>}
      </div>

      {/* Severity counter row — only renders chips with count > 0 */}
      {(counts.critical + counts.high + counts.medium + counts.low + counts.informational) > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <CountChip label="Critical" count={counts.critical} tone="red" />
          <CountChip label="High" count={counts.high} tone="red" />
          <CountChip label="Medium" count={counts.medium} tone="amber" />
          <CountChip label="Low" count={counts.low} tone="green" />
          <CountChip label="Info" count={counts.informational} tone="gray" />
        </div>
      )}

      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}>
        {result.finalText}
      </pre>

      {summary && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--color-muted)', borderTop: '1px solid var(--color-hairline)', paddingTop: 8 }}>
          {summary}
        </div>
      )}

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
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            <a
              href={`/r/${result.receiptOnchainId}`}
              className="btn-ghost"
              style={{ textDecoration: 'underline' }}
            >
              Public proof URL →
            </a>
            <a
              href={EXPLORER_TX(result.receiptTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
              style={{ textDecoration: 'underline' }}
            >
              Verify on chain →
            </a>
          </span>
        </div>
      )}
    </div>
  );
}
