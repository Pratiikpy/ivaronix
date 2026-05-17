import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getStudioDeployedAddress as getDeployedAddress,
  getStudioDeployments as loadDeployments,
} from '@/lib/deployments-bundle';
import { getNetwork } from '@/lib/chain';
import { getSampleReceiptHref, getSampleReceiptId } from '@/lib/sample-receipt';
import { NETWORKS } from '@ivaronix/core';
import { CopyLinkButton } from './CopyLinkButton';

export const metadata: Metadata = {
  title: '0G integration · Ivaronix',
  description: 'How Ivaronix uses each 0G primitive — Chain (anchor), Compute (TEE), Storage (body), Router (inference), Agent ID (ERC-7857).',
};

export const dynamic = 'force-dynamic';

interface ModuleCard {
  name: string;
  status: 'live' | 'partial' | 'roadmap';
  what: string; // one sentence on the user-visible value
  endpoint: { label: string; href?: string } | null;
  addresses: Array<{ label: string; address: string; explorer: string }>;
  seeItLive: { label: string; href: string };
}

function buildCards(network: ReturnType<typeof getNetwork>): ModuleCard[] {
  const cfg = NETWORKS[network];
  const explorer = cfg.chainExplorer;
  const linkOf = (a: string): string => `${explorer}/address/${a}`;
  // Used by single-contract callouts further down (Agent ID card, etc.).
  const addr = (key: string): string => getDeployedAddress(network, key) ?? '';

  // Auto-derive the contract list from the deployments file. Sweeps 56 +
  // 59 caught the same V2-blindness in CLI commands; this page (the
  // judge-facing 0G integration showcase) had the same drift. Iterating
  // Object.keys() means future contract deploys surface here without
  // hand-editing.
  const deployments = loadDeployments(network);
  const chainAddresses: Array<{ label: string; address: string; explorer: string }> =
    deployments
      ? Object.keys(deployments.contracts)
          .sort()
          .map((label) => {
            const a = getDeployedAddress(network, label) ?? '';
            return { label, address: a, explorer: linkOf(a) };
          })
      : [];

  return [
    {
      name: '0G Chain',
      status: 'live',
      what: 'Every receipt anchors here. The chain is what makes a verification two years from now produce the same answer as the verification ten seconds after the run.',
      endpoint: { label: cfg.rpcUrl, href: cfg.rpcUrl },
      addresses: chainAddresses,
      seeItLive: { label: 'Open the dashboard', href: '/dashboard' },
    },
    {
      name: '0G Compute',
      status: 'live',
      what: 'The specialist runs inside a TEE so the plaintext is invisible outside the run. The TEE attestation is what makes verificationMethod: router_flag and compute_sdk_process_response honest claims; --tee-independent re-runs the broker check on a separate machine.',
      endpoint: { label: '@0gfoundation/0g-compute-ts-sdk v0.8.x' },
      addresses: [],
      seeItLive: { label: `See receipt #${getSampleReceiptId()} (FULLY VERIFIED)`, href: getSampleReceiptHref() },
    },
    {
      name: '0G Storage',
      status: 'live',
      what: 'The encrypted blob and the signed receipt JSON live here. The blob storage root is recorded inside the receipt; anyone can fetch the ciphertext later and confirm it matches.',
      endpoint: { label: '@0gfoundation/0g-storage-ts-sdk v0.4.x' },
      addresses: [],
      // Bug-19 closure · point at the mainnet room manifest bundled in
      // apps/studio/src/data/rooms/ (the testnet room id `01KR66C1GJVR57…`
      // was the previous CTA but its manifest is gitignored, so production
      // /data-room/<that-id> rendered "Room not found"). The mainnet room
      // 01KRP4EZ54Y611S7YZ0CGRK6VG ships with the Vercel deploy and
      // renders the full manifest card with on-chain anchor + storage root.
      seeItLive: { label: 'Confidential data room', href: getNetwork() === 'mainnet' ? '/data-room/01KRP4EZ54Y611S7YZ0CGRK6VG' : '/data-room/01KR66C1GJVR57MHQPJCW1HQQY' },
    },
    {
      name: '0G Router',
      status: 'live',
      what: 'Carries the inference traffic and supplies the per-provider rate-limit and cost telemetry the receipt records. A reviewer can read the receipt and see how the work was billed.',
      endpoint: { label: 'IVARONIX_ROUTER_URL (legacy: ZG_SERVICE_URL) — surfaced as routerTrace.x0gTrace inside every receipt' },
      addresses: [],
      seeItLive: { label: `See receipt #${getSampleReceiptId()}`, href: getSampleReceiptHref() },
    },
    {
      name: 'Agent ID · ERC-7857',
      status: 'live',
      what: 'Every receipt is bound to a passport tokenId. A delegated agent gets its own passport so the trustScore accrues to the agent itself, not the operator. The receipt is signed by an AgentPassport-resolvable wallet — the chain confirms the signer matches.',
      endpoint: { label: 'AgentPassportINFT — custom ERC-7857 implementation (V1 legacy + V2 active)' },
      addresses: [
        ...(addr('AgentPassportINFTV2') ? [{ label: 'AgentPassportINFTV2', address: addr('AgentPassportINFTV2'), explorer: linkOf(addr('AgentPassportINFTV2')) }] : []),
        { label: 'AgentPassportINFT', address: addr('AgentPassportINFT'), explorer: linkOf(addr('AgentPassportINFT')) },
      ],
      seeItLive: { label: 'See a delegated agent', href: '/delegate/01KR67PT76V9AQTHN413PYWB1J' },
    },
    {
      name: '0G DA',
      status: 'roadmap',
      what: 'On the integration roadmap. We do not claim integration we have not shipped. The path — receipt batching and evidence sharding via 0G DA — is documented in docs/PHASE_B_DISCLOSURES.md, and we will wire it when a public testnet endpoint is available.',
      endpoint: null,
      addresses: [],
      seeItLive: { label: 'Roadmap disclosures (docs)', href: 'https://github.com/Pratiikpy/ivaronix/blob/main/docs/PHASE_B_DISCLOSURES.md' },
    },
  ];
}

function shortAddr(a: string): string {
  if (!a) return '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function StatusChip({ status }: { status: ModuleCard['status'] }) {
  const palette = status === 'live'
    ? { bg: '#e6f9ec', border: '#26c050', color: '#0e6428', label: 'INTEGRATED' }
    : status === 'partial'
    ? { bg: '#fff7d6', border: '#e8c800', color: '#7a5d00', label: 'PARTIAL' }
    : { bg: 'var(--color-tonal)', border: 'var(--color-hairline)', color: 'var(--color-muted)', label: 'ROADMAP' };
  return (
    <span
      className="mono"
      style={{
        padding: '2px 8px',
        fontSize: 10,
        borderRadius: 4,
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        color: palette.color,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {palette.label}
    </span>
  );
}

export default function DocsPage() {
  const network = getNetwork();
  const cards = buildCards(network);
  const liveCount = cards.filter((c) => c.status === 'live').length;
  const roadmapCount = cards.filter((c) => c.status === 'roadmap').length;

  return (
    <article style={{ maxWidth: 960, margin: '0 auto', padding: '64px 32px 96px' }}>
      <div className="section-label" style={{ marginBottom: 16 }}>
        Built on 0G
      </div>
      <h1
        style={{
          fontSize: 56,
          lineHeight: 1.05,
          letterSpacing: '-1.5px',
          fontWeight: 700,
          margin: 0,
          marginBottom: 24,
        }}
      >
        The 0G modules <span className="italic-display" style={{ fontWeight: 400 }}>we use,</span> and what each one carries.
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--color-muted)', margin: 0 }}>
        Each card states what the module does for the product, the address or endpoint where it lives, and a Studio
        surface that exercises it live. <strong style={{ color: 'var(--color-fg)' }}>{liveCount} integrated</strong>,{' '}
        {roadmapCount > 0 && <><strong style={{ color: 'var(--color-fg)' }}>{roadmapCount} on the roadmap</strong>. </>}
        We do not claim integration we have not shipped.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, fontSize: 13, color: 'var(--color-muted)' }}>
        <span>Share this URL:</span>
        <CopyLinkButton />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 48 }}>
        {cards.map((c) => (
          <div className="card" key={c.name} style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.5px', margin: 0 }}>
                {c.name}
              </h2>
              <StatusChip status={c.status} />
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--color-fg)', margin: '0 0 16px' }}>
              {c.what}
            </p>

            {c.endpoint && (
              <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '4px 0 12px' }}>
                <span style={{ display: 'inline-block', width: 80, fontWeight: 500 }}>endpoint</span>
                {c.endpoint.href ? (
                  <a href={c.endpoint.href} target="_blank" rel="noopener noreferrer" className="mono" style={{ color: 'inherit' }}>
                    {c.endpoint.label} ↗
                  </a>
                ) : (
                  <code className="mono">{c.endpoint.label}</code>
                )}
              </p>
            )}

            {c.addresses.length > 0 && (
              <div style={{ marginTop: 4, marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '4px 0 6px' }}>
                  <span style={{ display: 'inline-block', width: 80, fontWeight: 500 }}>contracts</span>
                </p>
                <ul style={{ margin: '0 0 0 88px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {c.addresses.map((a) => (
                    <li key={a.label} style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                      <code className="mono" style={{ display: 'inline-block', width: 160, color: 'var(--color-fg)' }}>{a.label}</code>
                      <a href={a.explorer} target="_blank" rel="noopener noreferrer" className="mono" style={{ color: 'inherit' }}>
                        {shortAddr(a.address)} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              {c.seeItLive.href.startsWith('http') ? (
                <a
                  href={c.seeItLive.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ fontSize: 13, padding: '6px 12px', textDecoration: 'none' }}
                >
                  {c.seeItLive.label} ↗
                </a>
              ) : (
                <Link
                  href={c.seeItLive.href}
                  className="btn-secondary"
                  style={{ fontSize: 13, padding: '6px 12px', textDecoration: 'none' }}
                >
                  {c.seeItLive.label} →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 48,
          padding: 24,
          background: 'var(--color-tonal)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div className="section-label" style={{ marginBottom: 12 }}>One toolkit, every module</div>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0, lineHeight: 1.55 }}>
          The toolkit at <code className="mono">@ivaronix/og-toolkit</code> wraps the official SDKs (
          <code className="mono">@0gfoundation/0g-storage-ts-sdk</code>,{' '}
          <code className="mono">@0gfoundation/0g-compute-ts-sdk</code>,{' '}
          <code className="mono">@0glabs/0g-serving-broker</code>) with receipt-defaulting helpers. Easier than the
          raw SDKs, and every helper produces a receipt by default rather than as an opt-in.
        </p>
      </div>
    </article>
  );
}
