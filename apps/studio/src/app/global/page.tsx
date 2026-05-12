import Link from 'next/link';
import { Section } from '@/components/Section';
import { unifiedNextId, livePassportCount, getProvider, getNetwork } from '@/lib/chain';
import { loadAllLocalReceipts, totalOgSpent, topSkillsByUsage } from '@/lib/local-receipts';
import { loadAllSkills } from '@/lib/skills';
import { MemoryAccessLogClient } from '@ivaronix/og-chain';
import { getStudioDeployedAddress as getDeployedAddress } from '@/lib/deployments-bundle';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const MEM_ACCESS_LABELS = ['read', 'write', 'delete', 'grant_used'];

interface GlobalSnapshot {
  totalReceipts: number | null;
  totalPassports: number | null;
  totalOg: number;
  firstPartySkillCount: number;
  topSkills: { skillId: string; count: number; totalCostOg: number }[];
  recentMemoryEvents: {
    agent: string;
    accessType: string;
    timestamp: number;
    txHash: string;
    blockNumber: number;
  }[];
}

async function loadSnapshot(): Promise<GlobalSnapshot> {
  const localReceipts = loadAllLocalReceipts(50);
  const memoryAddr = getDeployedAddress(getNetwork(), 'MemoryAccessLog');

  // V2-first cross-registry sum so /global counts post-K-2 anchors too.
  // Sweep 187: passport count via the shared livePassportCount helper.
  const [unifiedIds, passportCount, memEvents] = await Promise.all([
    unifiedNextId().catch(() => null),
    livePassportCount().catch(() => null),
    memoryAddr
      ? new MemoryAccessLogClient(memoryAddr, getProvider())
          .listGlobal(200_000)
          .then((events) => events.slice(-5).reverse())
          .catch(() => [])
      : [],
  ]);

  const recentMemoryEvents = memEvents.map((ev) => ({
    agent: ev.agent,
    accessType: MEM_ACCESS_LABELS[ev.accessType] ?? `code ${ev.accessType}`,
    timestamp: Number(ev.timestamp),
    txHash: ev.txHash,
    blockNumber: ev.blockNumber,
  }));

  return {
    totalReceipts: unifiedIds ? Number(unifiedIds.total) : null,
    totalPassports: passportCount !== null ? Number(passportCount) : null,
    totalOg: totalOgSpent(localReceipts),
    firstPartySkillCount: loadAllSkills().length,
    topSkills: topSkillsByUsage(localReceipts, 5),
    recentMemoryEvents,
  };
}

export default async function GlobalPage() {
  const snap = await loadSnapshot();

  return (
    <Section
      label="§ 01 · GLOBAL"
      title="Live testnet stats"
      description={`Reads from ReceiptRegistry, AgentPassportINFT, and MemoryAccessLog on ${getNetwork()}. Cached 60s.`}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 24,
          marginBottom: 48,
        }}
      >
        <Stat label="receipts anchored" value={snap.totalReceipts?.toLocaleString() ?? '—'} />
        <Stat label="passports minted" value={snap.totalPassports?.toLocaleString() ?? '—'} />
        <Stat label="og spent (locally tracked)" value={snap.totalOg.toFixed(6)} suffix=" OG" />
        <Stat label="first-party skills" value={String(snap.firstPartySkillCount ?? '—')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
        <div className="card">
          <div className="section-label">top skills (last 50 receipts)</div>
          {snap.topSkills.length === 0 ? (
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)' }}>
              <span className="italic-display">No receipts indexed locally yet.</span>
            </p>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {snap.topSkills.map((s, i) => (
                <li key={s.skillId} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'baseline' }}>
                  <span className="mono" style={{ color: 'var(--color-muted)' }}>#{i + 1}</span>
                  <Link href={`/skill/${s.skillId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {s.skillId}
                  </Link>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                    {s.count} run{s.count === 1 ? '' : 's'} · {s.totalCostOg.toFixed(6)} OG
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="card">
          <div className="section-label">recent memory access (chain log)</div>
          {snap.recentMemoryEvents.length === 0 ? (
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)' }}>
              <span className="italic-display">No MemoryAccessLog events in the last 200k blocks.</span>
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {snap.recentMemoryEvents.map((e) => (
                <li key={e.txHash} style={{ borderBottom: '1px solid var(--color-hairline)', paddingBottom: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span className="mono">{e.agent.slice(0, 10)}…{e.agent.slice(-4)}</span>
                    <span style={{ color: 'var(--color-muted)' }}>{e.accessType.toUpperCase()}</span>
                  </div>
                  <div style={{ marginTop: 2, color: 'var(--color-muted)' }}>
                    block {e.blockNumber} · {new Date(e.timestamp * 1000).toISOString().slice(0, 16).replace('T', ' ')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="card">
      <div className="section-label">{label}</div>
      <div className="italic-display" style={{ fontSize: 56, lineHeight: 1, marginTop: 12 }}>
        {value}
        {suffix && <span style={{ fontSize: 16, fontStyle: 'normal', fontFamily: 'var(--font-sans)', color: 'var(--color-muted)' }}>{suffix}</span>}
      </div>
    </div>
  );
}
