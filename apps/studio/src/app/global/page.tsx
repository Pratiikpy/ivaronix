import { Section } from '@/components/Section';
import { getReceiptRegistry, getPassportClient } from '@/lib/chain';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Day-13: every 60s; Day-17 wires WebSocket subscription

async function loadStats() {
  const reg = getReceiptRegistry();
  const passport = getPassportClient();
  const [totalReceipts, nextPassport] = await Promise.all([
    reg ? reg.nextId().catch(() => null) : null,
    passport ? passport.nextTokenId().catch(() => null) : null,
  ]);
  return {
    totalReceipts: totalReceipts !== null ? Number(totalReceipts) : null,
    totalPassports: nextPassport !== null ? Math.max(0, Number(nextPassport) - 1) : null,
  };
}

export default async function GlobalPage() {
  const stats = await loadStats();

  return (
    <Section
      label="§ 01 · GLOBAL"
      title="Live testnet stats"
      description={`Reads from ReceiptRegistry + AgentPassportINFT on ${process.env.NEXT_PUBLIC_OG_NETWORK ?? 'testnet'}. Cached 60s.`}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 24,
        }}
      >
        <Stat label="receipts anchored" value={stats.totalReceipts} />
        <Stat label="passports minted" value={stats.totalPassports} />
        <Stat label="first-party skills" value={5} />
      </div>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="card">
      <div className="section-label">{label}</div>
      <div className="italic-display" style={{ fontSize: 64, lineHeight: 1, marginTop: 12 }}>
        {value === null ? '—' : value.toLocaleString()}
      </div>
    </div>
  );
}
