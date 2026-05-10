import Link from 'next/link';
import { Section } from '@/components/Section';
import { PermissionPills } from '@/components/PermissionPills';
import { loadAllSkills } from '@/lib/skills';
import { getSkillRegistry } from '@/lib/chain';
import { skillIdFromName, versionIdFromSemver } from '@ivaronix/og-chain';
import type { ConsensusTier } from '@ivaronix/core';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface SkillCard {
  id: string;
  version: string;
  description: string;
  defaultTier: ConsensusTier;
  burnAuto: boolean;
  permissions: ReturnType<typeof permissionsView>;
  registryStatus: 'match' | 'mismatch' | 'unregistered' | 'unknown';
}

function permissionsView(p: import('@ivaronix/skills').SkillManifest['og']['permissions']) {
  return p;
}

async function loadCards(): Promise<SkillCard[]> {
  const skills = loadAllSkills();
  const reg = getSkillRegistry();

  // Query all skills' on-chain status in parallel — 80 sequential RPCs would
  // make /skills load in 15+ seconds, parallel collapses to ~1 RPC roundtrip.
  const cards = await Promise.all(
    skills.map(async (s): Promise<SkillCard> => {
      let registryStatus: SkillCard['registryStatus'] = 'unknown';
      if (reg) {
        try {
          const skillId = skillIdFromName(s.id);
          const versionId = versionIdFromSemver(s.manifest.version);
          const v = await reg.getVersion(skillId, versionId);
          if (!v) registryStatus = 'unregistered';
          else if (v.revoked) registryStatus = 'mismatch';
          else {
            const localBytes32 = '0x' + s.manifestHash.replace(/^sha256:/, '').toLowerCase();
            registryStatus = v.manifestHash.toLowerCase() === localBytes32 ? 'match' : 'mismatch';
          }
        } catch { /* keep 'unknown' */ }
      }
      return {
        id: s.id,
        version: s.manifest.version,
        description: s.manifest.description,
        defaultTier: s.manifest.og.consensus.default_tier,
        burnAuto: s.manifest.og.burn.auto_enable,
        permissions: permissionsView(s.manifest.og.permissions),
        registryStatus,
      };
    }),
  );
  return cards;
}

export default async function SkillsPage() {
  const cards = await loadCards();
  // Sort: registry-MATCH first, then by id alphabetically
  cards.sort((a, b) => {
    const order = { match: 0, unregistered: 1, unknown: 2, mismatch: 3 } as const;
    const da = order[a.registryStatus];
    const db = order[b.registryStatus];
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });

  // HALF_BAKED §I-9 closure (sweep 163): pre-sweep the header said
  // "First-party skills" but loadAllSkills() returns every entry under
  // seed-skills/, including the 150 imported skills from `imports/`.
  // Most imports are not anchored on the SkillRegistry contract. Renaming
  // to "Skill catalog" with a count breakdown is the honest framing.
  const firstPartyCount = cards.filter((c) => c.registryStatus === 'match' || c.registryStatus === 'mismatch').length;
  const importsCount = cards.length - firstPartyCount;
  return (
    <Section
      label="§ 01 · SKILL CATALOG"
      title="Skill catalog"
      description={`${cards.length} skills total · ~${firstPartyCount} anchored on the SkillRegistry contract · ~${importsCount} imported from upstream sources (not yet anchored). Sorted by registry verification — MATCH first.`}
      cta={
        <Link href="/skill/new" className="btn-primary" style={{ textDecoration: 'none' }}>
          + Compose a new skill
        </Link>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 24,
        }}
      >
        {cards.map((c) => (
          <Link key={c.id} href={`/skill/${c.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <h3 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>{c.id}</h3>
              <span className="mono" style={{ color: 'var(--color-muted)' }}>v{c.version}</span>
            </div>
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.5 }}>
              {c.description}
            </p>
            <div style={{ marginTop: 16, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <RegistryBadge status={c.registryStatus} />
              <Pill tone="green">tier: {c.defaultTier}</Pill>
              {c.burnAuto && <Pill tone="amber">🔒 burn auto</Pill>}
            </div>
            <div style={{ marginTop: 12 }}>
              <PermissionPills permissions={c.permissions} />
            </div>
          </Link>
        ))}
      </div>
      <p style={{ marginTop: 32, fontSize: 12, color: 'var(--color-muted)' }}>
        {cards.length} skill{cards.length === 1 ? '' : 's'} loaded · network {process.env.NEXT_PUBLIC_OG_NETWORK ?? 'testnet'}
      </p>
    </Section>
  );
}

function RegistryBadge({ status }: { status: SkillCard['registryStatus'] }) {
  if (status === 'match') return <span className="chip-verified">REGISTRY MATCH</span>;
  if (status === 'mismatch') return <span className="chip-mismatch">MISMATCH</span>;
  if (status === 'unregistered') return <span className="chip-pending">LOCAL ONLY</span>;
  return null;
}

function Pill({ tone, children }: { tone: 'green' | 'amber' | 'red'; children: React.ReactNode }) {
  const palette = {
    green: { bg: 'var(--color-verified-bg)', fg: '#166534', border: 'var(--color-verified)' },
    amber: { bg: 'var(--color-pending-bg)', fg: '#92400e', border: 'var(--color-pending)' },
    red:   { bg: 'var(--color-mismatch-bg)', fg: '#991b1b', border: 'var(--color-mismatch)' },
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
