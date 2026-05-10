import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section } from '@/components/Section';
import { PermissionPills } from '@/components/PermissionPills';
import { findSkillByIdServer, loadSampleFiles } from '@/lib/skills';
import { getSkillRegistry, explorerAddrUrl } from '@/lib/chain';
import { skillIdFromName, versionIdFromSemver } from '@ivaronix/og-chain';

export const dynamic = 'force-dynamic';

export default async function SkillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const skill = findSkillByIdServer(id);
  if (!skill) notFound();

  const reg = getSkillRegistry();
  let onchainHash: string | null = null;
  let creator: string | null = null;
  let publishedAt: number | null = null;
  let revoked = false;
  let versionCount = 0;
  let allVersions: { id: string; manifestHash: string; publishedAt: number; revoked: boolean }[] = [];

  if (reg) {
    const skillId = skillIdFromName(id);
    try {
      const versionId = versionIdFromSemver(skill.manifest.version);
      const v = await reg.getVersion(skillId, versionId);
      if (v) {
        onchainHash = v.manifestHash;
        creator = v.creator;
        publishedAt = Number(v.publishedAt);
        revoked = v.revoked;
      }
    } catch { /* not registered */ }
    try {
      const count = await reg.versionCount(skillId);
      versionCount = Number(count);
      // No `versionAt(skillId, idx)` exposed in current client — version history
      // for the current version only is sufficient until the wrapper grows it.
      if (onchainHash) {
        allVersions.push({
          id: skill.manifest.version,
          manifestHash: onchainHash,
          publishedAt: publishedAt ?? 0,
          revoked,
        });
      }
    } catch { /* ignore */ }
  }

  const samples = loadSampleFiles(skill);
  const localBytes32 = '0x' + skill.manifestHash.replace(/^sha256:/, '').toLowerCase();
  const matches = onchainHash !== null && !revoked && onchainHash.toLowerCase() === localBytes32;

  const reputation = skill.manifest.og.reputation;

  return (
    <Section
      label={`§ SKILL · ${id.toUpperCase()}`}
      title={`${id} v${skill.manifest.version}`}
      description={skill.manifest.description}
    >
      <div
        className="skill-detail-grid"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 32, alignItems: 'start' }}
      >
        {/* Left: details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Status + permissions */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="section-label">status</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {matches && <span className="chip-verified">REGISTRY MATCH</span>}
              {!matches && onchainHash && <span className="chip-mismatch">MISMATCH</span>}
              {!onchainHash && <span className="chip-pending">LOCAL ONLY</span>}
              {revoked && <span className="chip-mismatch">REVOKED</span>}
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                tier <strong style={{ color: 'var(--color-fg)' }}>{skill.manifest.og.consensus.default_tier}</strong>
                {' · '}license <strong style={{ color: 'var(--color-fg)' }}>{skill.manifest.license}</strong>
              </span>
            </div>
            <div className="section-label" style={{ marginTop: 8 }}>permissions</div>
            <PermissionPills permissions={skill.manifest.og.permissions} />
          </div>

          {/* Sample input(s) */}
          {samples.length > 0 && (
            <div className="card">
              <div className="section-label">sample input ({samples.length})</div>
              {samples.slice(0, 2).map((s) => (
                <div key={s.filename} style={{ marginTop: 16 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-muted)' }}>
                    <span className="mono">{s.filename}</span> · {s.byteSize.toLocaleString()} bytes
                  </p>
                  <pre
                    className="mono"
                    style={{
                      background: 'var(--color-tonal)',
                      padding: 16,
                      borderRadius: 6,
                      fontSize: 12,
                      lineHeight: 1.5,
                      overflowX: 'auto',
                      margin: 0,
                      maxHeight: 320,
                    }}
                  >
                    {s.contentExcerpt}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* Prompt body */}
          <div className="card">
            <div className="section-label">system prompt</div>
            <pre
              style={{
                marginTop: 12,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: 14,
                lineHeight: 1.6,
                background: 'var(--color-tonal)',
                padding: 16,
                borderRadius: 6,
                maxHeight: 480,
                overflowY: 'auto',
              }}
            >
              {skill.systemPromptBody}
            </pre>
          </div>

          {/* Version history */}
          {versionCount > 0 && (
            <div className="card">
              <div className="section-label">version history</div>
              <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-muted)' }}>
                {versionCount} version{versionCount === 1 ? '' : 's'} anchored on chain.
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allVersions.map((v) => (
                  <li key={v.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>v{v.id}</span>
                    <span className="mono" style={{ color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.manifestHash.slice(0, 12)}…{v.manifestHash.slice(-8)}
                    </span>
                    <span style={{ color: v.revoked ? 'var(--color-mismatch)' : 'var(--color-muted)' }}>
                      {v.revoked ? 'REVOKED' : new Date(v.publishedAt * 1000).toISOString().slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: aside */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card">
            <div className="section-label">try it</div>
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
              Drop a file on the homepage and pick this skill from the dropdown — Run from the browser.
            </p>
            <Link href={`/?skill=${encodeURIComponent(id)}`} className="btn-primary" style={{ marginTop: 16, display: 'inline-block', textDecoration: 'none' }}>
              Open Studio →
            </Link>
            <p style={{ marginTop: 16, fontSize: 11, color: 'var(--color-muted)' }}>or from the CLI:</p>
            <pre className="mono" style={{ marginTop: 8, fontSize: 11, background: 'var(--color-fg)', color: 'var(--color-bg)', padding: 12, borderRadius: 4, overflowX: 'auto' }}>
              ivaronix doc ask &lt;file&gt; &quot;…&quot; --skill {id}
            </pre>
          </div>

          {onchainHash && (
            <div className="card">
              <div className="section-label">on-chain anchor</div>
              <dl style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '6px 12px', fontSize: 11 }}>
                <dt style={{ color: 'var(--color-muted)' }}>hash</dt>
                <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>{onchainHash}</dd>
                <dt style={{ color: 'var(--color-muted)' }}>creator</dt>
                <dd className="mono" style={{ margin: 0 }}>
                  <a href={creator ? explorerAddrUrl(creator) : '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                    {creator}
                  </a>
                </dd>
                <dt style={{ color: 'var(--color-muted)' }}>published</dt>
                <dd style={{ margin: 0 }}>
                  {publishedAt ? new Date(publishedAt * 1000).toISOString().slice(0, 16).replace('T', ' ') : '—'}
                </dd>
              </dl>
            </div>
          )}

          {skill.manifest.og.creator?.fee_split && (
            <div className="card">
              <div className="section-label">fee split (track 3)</div>
              <dl style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '6px 12px', fontSize: 12 }}>
                <dt style={{ color: 'var(--color-muted)' }}>creator</dt>
                <dd style={{ margin: 0 }}>
                  {(skill.manifest.og.creator.fee_split.creator / 100).toFixed(2)}%
                  <span style={{ color: 'var(--color-muted)', fontSize: 11, marginLeft: 8 }}>
                    ({skill.manifest.og.creator.fee_split.creator} bps)
                  </span>
                </dd>
                <dt style={{ color: 'var(--color-muted)' }}>treasury</dt>
                <dd style={{ margin: 0 }}>
                  {(skill.manifest.og.creator.fee_split.treasury / 100).toFixed(2)}%
                  <span style={{ color: 'var(--color-muted)', fontSize: 11, marginLeft: 8 }}>
                    ({skill.manifest.og.creator.fee_split.treasury} bps)
                  </span>
                </dd>
              </dl>
              <p style={{ marginTop: 8, fontSize: 11, color: 'var(--color-muted)' }}>
                Recorded as <span className="mono">billing.feeSplit</span> on every <span className="mono">skill_exec</span> receipt.
              </p>
            </div>
          )}

          <div className="card">
            <div className="section-label">reputation</div>
            <dl style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '6px 12px', fontSize: 12 }}>
              <dt style={{ color: 'var(--color-muted)' }}>on pass</dt>
              <dd style={{ margin: 0 }}>+{reputation.on_pass.trustScore} trust · +{reputation.on_pass.receiptCount} receipts</dd>
              <dt style={{ color: 'var(--color-muted)' }}>on fail</dt>
              <dd style={{ margin: 0 }}>{reputation.on_fail.trustScore} trust</dd>
              <dt style={{ color: 'var(--color-muted)' }}>on violation</dt>
              <dd style={{ margin: 0 }}>{reputation.on_violation.trustScore} trust {reputation.on_violation.locked ? ' · LOCKED' : ''}</dd>
            </dl>
          </div>

          <Link href="/skills" className="btn-ghost" style={{ paddingLeft: 0, textDecoration: 'underline' }}>
            ← All skills
          </Link>
        </aside>
      </div>
    </Section>
  );
}
