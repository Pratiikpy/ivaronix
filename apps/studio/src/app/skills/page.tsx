import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/Section';
import { PermissionPills } from '@/components/PermissionPills';
import { loadAllSkills } from '@/lib/skills';
import { FIRST_PARTY_SLUGS } from '@/lib/first-party-skills';
import { getSkillRegistry } from '@/lib/chain';
import { skillIdFromName, versionIdFromSemver } from '@ivaronix/og-chain';
import type { ConsensusTier } from '@ivaronix/core';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// Bug-66: /skills was missed in the Bug-56 metadata sweep — it inherited
// the generic homepage title. Caught by a final whole-sitemap title
// audit after Bug-65 deployed.
export const metadata: Metadata = {
  title: 'Skills · Ivaronix',
  description: 'Browse every published Ivaronix skill — manifest, fee split, REGISTRY MATCH chip, permissions.',
};

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

  // 156 parallel getVersion calls overwhelmed the Galileo RPC: ~56 of
  // them dropped, leaving the cards in 'unknown' state (no chip rendered)
  // — including some first-party skills like plan-step that ARE on chain.
  // Chunked + retried serial-per-chunk fixes the silent drops without
  // making /skills wait 30+ seconds for 156 sequential calls.
  const CHUNK = 12;       // 12 parallel RPCs is well under Galileo throughput
  const MAX_RETRY = 2;    // first call + 2 retries = 3 attempts per skill

  // Bug-67: pre-fix, this page made 161 getVersion calls — one per skill —
  // including 151 third-party imports that we KNOW are not on chain. Skip
  // the RPC entirely for non-first-party slugs (~16x reduction in chain
  // load + ~5s TTFB cut). Same registry-MATCH semantics for the 10
  // first-party skills the user actually cares about.
  const firstPartySet = new Set<string>(FIRST_PARTY_SLUGS as readonly string[]);

  async function resolveStatus(s: ReturnType<typeof loadAllSkills>[number]): Promise<SkillCard['registryStatus']> {
    if (!reg) return 'unknown';
    // Imports are deterministically 'unregistered' (never published on chain).
    // Skipping the RPC is the legitimate optimization — they would ALL
    // return null after a wasted round trip.
    if (!firstPartySet.has(s.id)) return 'unregistered';
    const skillId = skillIdFromName(s.id);
    const versionId = versionIdFromSemver(s.manifest.version);
    for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
      try {
        const v = await reg.getVersion(skillId, versionId);
        if (!v) return 'unregistered';
        if (v.revoked) return 'mismatch';
        const localBytes32 = '0x' + s.manifestHash.replace(/^sha256:/, '').toLowerCase();
        return v.manifestHash.toLowerCase() === localBytes32 ? 'match' : 'mismatch';
      } catch {
        if (attempt === MAX_RETRY) return 'unknown';
        // Brief backoff before retry — 100ms + jitter spreads the burst
        await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 150));
      }
    }
    return 'unknown';
  }

  const cards: SkillCard[] = [];
  for (let i = 0; i < skills.length; i += CHUNK) {
    const batch = skills.slice(i, i + CHUNK);
    const batchCards = await Promise.all(
      batch.map(async (s): Promise<SkillCard> => ({
        id: s.id,
        version: s.manifest.version,
        description: s.manifest.description,
        defaultTier: s.manifest.og.consensus.default_tier,
        burnAuto: s.manifest.og.burn.auto_enable,
        permissions: permissionsView(s.manifest.og.permissions),
        registryStatus: await resolveStatus(s),
      })),
    );
    cards.push(...batchCards);
  }
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
      description={`${cards.length} skills total · ~${firstPartyCount} anchored on the SkillRegistry contract · ~${importsCount} imported from upstream sources (no on-chain anchor). Sorted by registry verification — MATCH first.`}
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
