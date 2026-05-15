/**
 * /admin/health · public system-status page.
 *
 * Fetches real on-chain values at request time so a judge can confirm
 * "is the system alive right now?" without setup. No SIWE gate, no wallet,
 * no auth — public health view per the brand contract.
 *
 * Live values: current block, ReceiptRegistryV3 next id, AgentPassport V2
 * next token id, RPC reachability, contract addresses. Each row carries
 * the data and a chainscan link the judge can verify independently.
 */
import { Section } from '@/components/Section';
import { getNetwork, getProvider, getReceiptRegistryV3, livePassportCount } from '@/lib/chain';
import { getStudioDeployedAddress as getDeployedAddress, getStudioDeployments } from '@/lib/deployments-bundle';
import { NETWORKS, type Network } from '@ivaronix/core';

export const dynamic = 'force-dynamic';

interface ContractRow {
  name: string;
  address: string | null;
  chainscanUrl: string | null;
}

interface HealthSnapshot {
  network: Network;
  chainId: number;
  rpcUrl: string;
  currentBlock: bigint | null;
  rpcReachable: boolean;
  rpcLatencyMs: number | null;
  receiptCountV3: bigint | null;
  passportCountTotal: bigint | null;
  contracts: ContractRow[];
  generatedAt: string;
}

async function fetchHealth(): Promise<HealthSnapshot> {
  const network = getNetwork();
  const cfg = NETWORKS[network];
  const rpcUrl = cfg.rpcUrl;
  const provider = getProvider();
  const scanBase = cfg.chainExplorer;

  // Auto-derive contract list from contracts/deployments/<network>.json
  // (single source of truth per CLAUDE.md §15). Future deploys surface
  // here without touching this file.
  const deployments = getStudioDeployments(network);
  const contractNames = deployments ? Object.keys(deployments.contracts).sort() : [];

  const contracts: ContractRow[] = contractNames.map((name) => {
    const address = getDeployedAddress(network, name);
    return {
      name,
      address,
      chainscanUrl: address && scanBase ? `${scanBase}/address/${address}` : null,
    };
  });

  let currentBlock: bigint | null = null;
  let rpcReachable = false;
  let rpcLatencyMs: number | null = null;
  const t0 = Date.now();
  try {
    const block = await provider.getBlockNumber();
    currentBlock = BigInt(block);
    rpcReachable = true;
    rpcLatencyMs = Date.now() - t0;
  } catch {
    rpcReachable = false;
  }

  let receiptCountV3: bigint | null = null;
  try {
    const v3 = getReceiptRegistryV3();
    if (v3) {
      const nextId = await v3.nextId();
      receiptCountV3 = nextId > 0n ? nextId - 1n : 0n;
    }
  } catch {
    receiptCountV3 = null;
  }

  // Canonical helper sums V1 + V2 with off-by-1 handling. Sweep 187 makes
  // this the single source of truth for passport counts across Studio.
  const passportCountTotal = await livePassportCount();

  return {
    network,
    chainId: cfg.chainId,
    rpcUrl,
    currentBlock,
    rpcReachable,
    rpcLatencyMs,
    receiptCountV3,
    passportCountTotal,
    contracts,
    generatedAt: new Date().toISOString(),
  };
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  // Brand palette state tokens: verifiedBgSofter / verified / mismatchBgSoft /
  // mismatchInk per brand/tokens.json. Mirrored in brand/tokens.css as
  // --color-state-verified-bg-softer / --color-state-verified etc.
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: 999,
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 11,
        letterSpacing: '0.05em',
        background: ok ? 'var(--color-verified-bg-softer)' : 'var(--color-mismatch-bg)',
        color: ok ? 'var(--color-verified)' : 'var(--color-mismatch-ink)',
        border: `1px solid ${ok ? 'var(--color-verified)' : 'var(--color-mismatch-ink)'}`,
      }}
    >
      {ok ? '✓ ' : '✗ '}{label}
    </span>
  );
}

export default async function AdminHealthPage() {
  const h = await fetchHealth();
  const deployedCount = h.contracts.filter((c) => c.address).length;
  const totalContracts = h.contracts.length;

  return (
    <Section
      label="§ ADMIN / HEALTH"
      title="System health"
      description="Live, public system status. Every value below is read from the chain at page-load time. No auth, no wallet, no cookie required."
    >
      <div style={{ display: 'grid', gap: 24 }}>
        {/* RPC + network card */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Network · {h.network}</h3>
            <StatusChip ok={h.rpcReachable} label={h.rpcReachable ? `RPC OK · ${h.rpcLatencyMs}ms` : 'RPC UNREACHABLE'} />
          </div>
          <dl style={{ display: 'grid', gap: 8, fontFamily: 'var(--font-mono, monospace)', fontSize: 13, margin: 0 }}>
            <Row k="chainId" v={String(h.chainId)} />
            <Row k="rpcUrl" v={h.rpcUrl} />
            <Row k="currentBlock" v={h.currentBlock !== null ? h.currentBlock.toString() : 'unreachable'} />
          </dl>
        </div>

        {/* Live counts card */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px' }}>Live counts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24 }}>
            <Stat label="Receipts (V3)" value={h.receiptCountV3 !== null ? h.receiptCountV3.toString() : 'n/a'} />
            <Stat label="Passports (V1 + V2)" value={h.passportCountTotal !== null ? h.passportCountTotal.toString() : 'n/a'} />
            <Stat label="Contracts deployed" value={`${deployedCount} / ${totalContracts}`} />
          </div>
        </div>

        {/* Contracts list */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px' }}>Deployed contracts · {h.network}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-hairline)', textAlign: 'left' }}>
                <th style={{ padding: '8px 0', fontWeight: 600 }}>Contract</th>
                <th style={{ padding: '8px 0', fontWeight: 600 }}>Address</th>
                <th style={{ padding: '8px 0', fontWeight: 600, textAlign: 'right' }}>Verify</th>
              </tr>
            </thead>
            <tbody>
              {h.contracts.map((c) => (
                <tr key={c.name} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                  <td style={{ padding: '10px 0' }}>{c.name}</td>
                  <td style={{ padding: '10px 0', color: c.address ? 'var(--color-ink)' : 'var(--color-muted)' }}>
                    {c.address ?? '— not deployed'}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    {c.chainscanUrl ? (
                      <a href={c.chainscanUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-ink)' }}>
                        chainscan ↗
                      </a>
                    ) : (
                      <span style={{ color: 'var(--color-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--color-muted)', margin: 0 }}>
          generated at {h.generatedAt} · refresh the page for a fresh snapshot
        </p>
      </div>
    </Section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <dt style={{ color: 'var(--color-muted)' }}>{k}</dt>
      <dd style={{ margin: 0, overflowWrap: 'anywhere', textAlign: 'right' }}>{v}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
