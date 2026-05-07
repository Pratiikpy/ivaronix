import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section } from '@/components/Section';
import { getSkillRegistry, explorerAddrUrl } from '@/lib/chain';
import { skillIdFromName, versionIdFromSemver } from '@ivaronix/og-chain';

export const dynamic = 'force-dynamic';

const KNOWN_SKILLS: Record<string, { description: string; defaultTier: string; latestVersion: string }> = {
  'private-doc-review': {
    description: 'Review contracts, leases, NDAs. Burn-mode + redact-PII hooks.',
    defaultTier: 'standard',
    latestVersion: '0.2.0',
  },
  'github-audit': {
    description: 'Code & security audit. Reentrancy, access control, secret scanning.',
    defaultTier: 'standard',
    latestVersion: '0.1.0',
  },
  '0g-integration-auditor': {
    description: 'Audit a 0G integration repository.',
    defaultTier: 'quick',
    latestVersion: '0.1.0',
  },
  'plan-step': {
    description: 'Produces a numbered, executable plan for a goal.',
    defaultTier: 'quick',
    latestVersion: '0.1.0',
  },
  'code-edit': {
    description: 'Proposes a unified diff for a code task.',
    defaultTier: 'standard',
    latestVersion: '0.1.0',
  },
};

export default async function SkillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const known = KNOWN_SKILLS[id];
  if (!known) notFound();

  const reg = getSkillRegistry();
  let onchainHash: string | null = null;
  let publishedAt: number | null = null;
  let creator: string | null = null;
  if (reg) {
    try {
      const skillId = skillIdFromName(id);
      const versionId = versionIdFromSemver(known.latestVersion);
      const v = await reg.getVersion(skillId, versionId);
      if (v) {
        onchainHash = v.manifestHash;
        publishedAt = Number(v.publishedAt);
        creator = v.creator;
      }
    } catch {
      /* not registered */
    }
  }

  return (
    <Section
      label={`§ SKILL · ${id}`}
      title={`${id} v${known.latestVersion}`}
      description={known.description}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 32,
          alignItems: 'start',
        }}
      >
        <div className="card">
          <div className="section-label">CLI</div>
          <pre
            className="mono"
            style={{
              background: 'var(--color-fg)',
              color: 'var(--color-bg)',
              padding: 16,
              borderRadius: 6,
              overflowX: 'auto',
              fontSize: 13,
              marginTop: 12,
            }}
          >
            ivaronix skill inspect {id}
            {'\n'}ivaronix doc ask &lt;file&gt; "&lt;question&gt;" --skill {id}
          </pre>

          <div className="section-label" style={{ marginTop: 32 }}>
            on-chain anchor
          </div>
          {onchainHash ? (
            <dl style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13 }}>
              <dt style={{ color: 'var(--color-muted)' }}>manifestHash</dt>
              <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>{onchainHash}</dd>
              <dt style={{ color: 'var(--color-muted)' }}>creator</dt>
              <dd className="mono" style={{ margin: 0 }}>
                <a href={creator ? explorerAddrUrl(creator) : '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                  {creator}
                </a>
              </dd>
              <dt style={{ color: 'var(--color-muted)' }}>publishedAt</dt>
              <dd style={{ margin: 0 }}>
                {publishedAt ? new Date(publishedAt * 1000).toISOString() : '—'}
              </dd>
            </dl>
          ) : (
            <p style={{ marginTop: 12, color: 'var(--color-muted)', fontSize: 13 }}>
              Not registered on the SkillRegistry yet.
            </p>
          )}
        </div>

        <aside className="card">
          <div className="section-label">tier</div>
          <p style={{ fontSize: 18, marginTop: 8 }}>{known.defaultTier}</p>
          <Link href="/skills" className="btn-ghost" style={{ paddingLeft: 0, marginTop: 24, display: 'inline-block' }}>
            ← All skills
          </Link>
        </aside>
      </div>
    </Section>
  );
}
