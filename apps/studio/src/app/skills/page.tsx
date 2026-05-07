import Link from 'next/link';
import { Section } from '@/components/Section';

const STATIC_SKILLS = [
  {
    id: 'private-doc-review',
    version: '0.2.0',
    description: 'Review contracts, leases, NDAs. Burn-mode + redact-PII hooks.',
    permissions: { network: 'amber', files: 'green', compute: 'green' },
    tier: 'standard',
  },
  {
    id: 'github-audit',
    version: '0.1.0',
    description: 'Code & security audit. Reentrancy, access control, secret scanning.',
    permissions: { network: 'amber', files: 'green', compute: 'green' },
    tier: 'standard',
  },
  {
    id: '0g-integration-auditor',
    version: '0.1.0',
    description: 'Audit a 0G integration: chain ID, encryption, TEE verify, receipts.',
    permissions: { network: 'amber', files: 'green', compute: 'green' },
    tier: 'quick',
  },
  {
    id: 'plan-step',
    version: '0.1.0',
    description: 'Read-only planning skill — produces a numbered, executable plan.',
    permissions: { network: 'amber', files: 'green', compute: 'green' },
    tier: 'quick',
  },
  {
    id: 'code-edit',
    version: '0.1.0',
    description: 'Propose minimal code changes — emits a unified diff.',
    permissions: { network: 'amber', files: 'green', compute: 'green' },
    tier: 'standard',
  },
];

export default function SkillsPage() {
  return (
    <Section
      label="§ 01 · SKILL CATALOG"
      title="First-party skills"
      description="Each skill ships with a manifest hash anchored on the SkillRegistry contract. Run them from the CLI today; Day 14+ wires the in-Studio drop-zone."
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
        }}
      >
        {STATIC_SKILLS.map((s) => (
          <Link key={s.id} href={`/skill/${s.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <h3 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>{s.id}</h3>
              <span className="mono" style={{ color: 'var(--color-muted)' }}>v{s.version}</span>
            </div>
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.5 }}>{s.description}</p>
            <div style={{ marginTop: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Pill tone="amber">net: router-only</Pill>
              <Pill tone="green">files: read-only</Pill>
              <Pill tone="green">compute: tee</Pill>
              <Pill tone="green">tier: {s.tier}</Pill>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function Pill({ tone, children }: { tone: 'green' | 'amber' | 'red'; children: React.ReactNode }) {
  const palette = {
    green: { bg: 'var(--color-verified-bg)', fg: '#166534', border: 'var(--color-verified)' },
    amber: { bg: 'var(--color-pending-bg)', fg: '#92400e', border: 'var(--color-pending)' },
    red: { bg: 'var(--color-mismatch-bg)', fg: '#991b1b', border: 'var(--color-mismatch)' },
  }[tone];
  return (
    <span
      style={{
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        letterSpacing: '0.5px',
      }}
    >
      {children}
    </span>
  );
}
