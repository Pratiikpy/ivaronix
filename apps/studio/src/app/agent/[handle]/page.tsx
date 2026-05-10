import Link from 'next/link';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Section } from '@/components/Section';
import {
  getPassportClient,
  unifiedFindByAgent,
  explorerAddrUrl,
  receiptTypeLabel,
} from '@/lib/chain';

export const dynamic = 'force-dynamic';

function isAddress(input: string): input is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(input);
}

interface ConsolidationReceipt {
  id: string;
  onChainId: string | null;
  window: string;
  consolidatedAt: number;
  sourceCount: number;
  summary: string;
  method: 'tee-attested' | 'local-synthesis' | 'unknown';
}

/** Scan local `.ivaronix/receipts/anchored/*.json` for memory_consolidation
 * receipts owned by `agent`. Returns newest-first, max 5. */
function loadLocalConsolidations(agent: string): ConsolidationReceipt[] {
  const out: ConsolidationReceipt[] = [];
  const norm = agent.toLowerCase();

  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      const candidates = [
        resolve(dir, '.ivaronix', 'receipts', 'anchored'),
        resolve(dir, 'apps', 'cli', '.ivaronix', 'receipts', 'anchored'),
      ];
      for (const ds of candidates) {
        if (!existsSync(ds)) continue;
        for (const fname of readdirSync(ds)) {
          if (!fname.endsWith('.json')) continue;
          try {
            const raw = readFileSync(resolve(ds, fname), 'utf8');
            const r = JSON.parse(raw) as Record<string, unknown>;
            if (r.type !== 'memory_consolidation') continue;
            const a = (r.agent as Record<string, unknown> | undefined)?.ownerWallet as string | undefined;
            if (!a || a.toLowerCase() !== norm) continue;
            const req = r.request as Record<string, unknown> | undefined;
            const exec = r.execution as Record<string, unknown> | undefined;
            const tee = r.teeVerification as Record<string, unknown> | undefined;
            const outputs = r.outputs as Record<string, unknown> | undefined;
            const wording = outputs?.wording as Record<string, unknown> | undefined;
            const chainAnchor = r.chainAnchor as Record<string, unknown> | undefined;
            const reqId = (r.routerTrace as Record<string, unknown> | undefined)?.requestId as string | undefined;
            const windowMatch = reqId?.match(/memory\.consolidate:(day|month|year):/);
            const window = windowMatch?.[1] ?? 'unknown';
            out.push({
              id: r.id as string,
              onChainId: (chainAnchor?.onChainId as string | undefined) ?? null,
              window,
              consolidatedAt: Number(r.createdAt ?? 0),
              sourceCount: Array.isArray(req?.priorReceiptIds) ? (req!.priorReceiptIds as string[]).length : 0,
              summary: (wording?.headline as string | undefined) ?? '(no summary)',
              method: (tee?.verificationMethod as string | undefined) === 'router_flag' ? 'tee-attested'
                : (tee?.verificationMethod as string | undefined) === 'external-signed' ? 'local-synthesis'
                : 'unknown',
            });
          } catch { /* skip */ }
        }
      }
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return out.sort((a, b) => b.consolidatedAt - a.consolidatedAt).slice(0, 5);
}

function isoFromMs(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
}

interface BadgeTier {
  label: string;
  threshold: number;
}
const TIERS: BadgeTier[] = [
  { label: 'Newcomer', threshold: 0 },
  { label: 'Verified', threshold: 5 },
  { label: 'Trusted', threshold: 20 },
  { label: 'Veteran', threshold: 50 },
  { label: 'Council', threshold: 200 },
];

function tierFor(trustScore: number): BadgeTier {
  let pick = TIERS[0]!;
  for (const t of TIERS) if (trustScore >= t.threshold) pick = t;
  return pick;
}

export default async function AgentProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const decoded = decodeURIComponent(handle);

  if (!isAddress(decoded)) {
    return (
      <Section
        label={`§ AGENT · ${decoded}`}
        title="Pass a wallet address to view this agent."
        description="Agent profiles are addressed by the agent's wallet (0x…). Vanity handles are not yet anchored on the AgentPassport contract — when they are, they will resolve here automatically."
      />
    );
  }

  const passport = getPassportClient();
  const profile = passport ? await passport.getPassportByWallet(decoded) : null;
  // V2-first union of recent receipts so the agent profile shows post-K-2
  // anchors alongside legacy V1 ones, sorted by timestamp.
  const recent = await unifiedFindByAgent(decoded, 25).catch(() => []);
  const consolidations = loadLocalConsolidations(decoded);

  if (!profile) {
    return (
      <Section
        label={`§ AGENT · ${decoded}`}
        title="No passport for that wallet yet."
        description="The wallet has no AgentPassport on this network. Use 'ivaronix passport mint' to create one."
      />
    );
  }

  const tier = tierFor(Number(profile.trustScore));

  return (
    <Section
      label={`§ AGENT · #${profile.tokenId}`}
      title={`Trust score ${profile.trustScore}`}
      description={`${profile.receiptCount} receipt${profile.receiptCount === 1n ? '' : 's'} anchored. Owner ${decoded.slice(0, 10)}…${decoded.slice(-4)}.`}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32, alignItems: 'start' }}>
        <div className="card">
          <div className="section-label" style={{ marginBottom: 16 }}>recent activity ({recent.length})</div>
          {recent.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
              <span className="italic-display">No on-chain receipts found in the last 100k blocks.</span>
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {recent.map((r) => (
                <li key={r.id.toString()} style={{ borderBottom: '1px solid var(--color-hairline)', paddingBottom: 12 }}>
                  <Link href={`/r/${r.id.toString()}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', textDecoration: 'none', color: 'inherit', gap: 12 }}>
                    <span style={{ fontWeight: 500 }}>Receipt #{r.id.toString()}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                      {new Date(Number(r.timestamp) * 1000).toISOString().slice(0, 16).replace('T', ' ')}
                    </span>
                  </Link>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                    <span className="mono">{receiptTypeLabel(r.receiptType)}</span> ·{' '}
                    <span className="mono">{r.receiptRoot.slice(0, 12)}…{r.receiptRoot.slice(-8)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="card">
          <div className="section-label">tier</div>
          <p style={{ fontSize: 32, lineHeight: 1.1, marginTop: 12, marginBottom: 4 }} className="italic-display">
            {tier.label}
          </p>
          <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            ≥ {tier.threshold} trust
          </p>

          <div style={{ marginTop: 24 }}>
            <div className="section-label">profile</div>
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '4px 12px', fontSize: 12, marginTop: 8 }}>
              <dt style={{ color: 'var(--color-muted)' }}>tokenId</dt>
              <dd style={{ margin: 0 }}>{profile.tokenId.toString()}</dd>
              <dt style={{ color: 'var(--color-muted)' }}>trust</dt>
              <dd style={{ margin: 0 }}>{profile.trustScore.toString()}</dd>
              <dt style={{ color: 'var(--color-muted)' }}>receipts</dt>
              <dd style={{ margin: 0 }}>{profile.receiptCount.toString()}</dd>
              <dt style={{ color: 'var(--color-muted)' }}>violations</dt>
              <dd style={{ margin: 0 }}>{profile.violationCount.toString()}</dd>
            </dl>
          </div>

          <a
            href={explorerAddrUrl(decoded)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            style={{ marginTop: 16, paddingLeft: 0, display: 'inline-block', textDecoration: 'underline' }}
          >
            On chainscan →
          </a>
        </aside>
      </div>

      {/* Memory consolidations — planning-01 §2B */}
      <div className="card" style={{ marginTop: 32 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>
          memory consolidations ({consolidations.length})
        </div>
        {consolidations.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>
            <span className="italic-display">No consolidations yet for this agent.</span>{' '}
            From the operator&apos;s terminal:{' '}
            <code className="mono">ivaronix passport consolidate --day</code>
            {' '}runs a TEE-attested rollup over the agent&apos;s recent receipts and anchors a{' '}
            <code className="mono">memory_consolidation</code> receipt that points back at the source ids.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {consolidations.map((c) => (
              <li key={c.id} style={{ borderBottom: '1px solid var(--color-hairline)', paddingBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    {c.window === 'day' ? 'Daily' : c.window === 'month' ? 'Monthly' : c.window === 'year' ? 'Yearly' : 'Window'} rollup ·{' '}
                    <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>{c.sourceCount} source receipts</span>
                  </span>
                  <span
                    className="mono"
                    style={{
                      padding: '2px 8px',
                      fontSize: 10,
                      borderRadius: 4,
                      border: '1px solid var(--color-hairline)',
                      background: c.method === 'tee-attested' ? 'var(--color-verified-bg, #e6f9ec)' : 'var(--color-tonal)',
                      color: c.method === 'tee-attested' ? '#0e6428' : 'var(--color-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {c.method === 'tee-attested' ? 'TEE · TIER 1' : c.method === 'local-synthesis' ? 'LOCAL · TIER 2' : 'unknown'}
                  </span>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-fg)', margin: '4px 0 8px' }}>
                  {c.summary}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, color: 'var(--color-muted)' }}>
                  <span className="mono">{isoFromMs(c.consolidatedAt)}Z</span>
                  {c.onChainId ? (
                    <Link href={`/r/${c.onChainId}`} className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }}>
                      receipt #{c.onChainId} ↗
                    </Link>
                  ) : (
                    <span className="italic-display">claimed locally · not anchored yet</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
