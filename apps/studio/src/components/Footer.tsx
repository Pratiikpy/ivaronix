import Link from 'next/link';
import { loadDeployments } from '@ivaronix/og-chain';
import { getNetwork } from '@/lib/chain';

/**
 * Editorial multi-column footer per CLAUDE.md §10.
 * Columns: Product / Docs / Network / Open Source.
 * Below the grid: brand baseline strip with the canonical tagline + network chip.
 *
 * Network column links resolve to the 0G Galileo Testnet block explorer
 * for real on-chain verification (judging criterion: "Explorer link /
 * contract address must be provided for verification").
 *
 * Pre-sweep-117 the contract addresses were hardcoded constants — same
 * footer would render stale addresses post-mainnet-redeploy or on V2
 * additions to contracts/deployments/<network>.json. Sweep 117 reads
 * each address fresh via getDeployedAddress() so the footer always
 * reflects what's actually in the deployment manifest.
 */

const EXPLORER = 'https://chainscan-galileo.0g.ai';
const REPO = 'https://github.com/Pratiikpy/ivaronix';
const OG_DOCS = 'https://docs.0g.ai';
const OG_HOME = 'https://0g.ai';

function ext(label: string, href: string) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
      {label}
    </a>
  );
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function Footer() {
  const network = getNetwork();
  // Read the entire contracts manifest from contracts/deployments/<network>
  // .json and iterate every entry. Future V2/V3 deploys appear in the
  // footer automatically without code changes.
  const manifest = loadDeployments(network);
  const liveRegistry: Array<{ name: string; addr: `0x${string}` }> = manifest
    ? Object.entries(manifest.contracts)
        .map(([name, entry]) => ({ name, addr: entry.address as `0x${string}` }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  return (
    <footer
      style={{
        borderTop: '1px solid var(--color-hairline)',
        marginTop: 96,
        padding: '48px 32px',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 48,
          fontSize: 13,
          color: 'var(--color-muted)',
        }}
      >
        <section>
          <div className="section-label" style={{ marginBottom: 16 }}>Product</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li><Link href="/onboard" style={{ color: 'inherit', textDecoration: 'none' }}>Onboard</Link></li>
            <li><Link href="/skills" style={{ color: 'inherit', textDecoration: 'none' }}>Skills</Link></li>
            <li><Link href="/global" style={{ color: 'inherit', textDecoration: 'none' }}>Global</Link></li>
            <li><Link href="/dashboard" style={{ color: 'inherit', textDecoration: 'none' }}>Dashboard</Link></li>
            <li><Link href="/memory" style={{ color: 'inherit', textDecoration: 'none' }}>Memory</Link></li>
            <li><Link href="/brand" style={{ color: 'inherit', textDecoration: 'none' }}>Brand kit</Link></li>
          </ul>
        </section>

        <section>
          <div className="section-label" style={{ marginBottom: 16 }}>Docs</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li>{ext('0G platform docs ↗', OG_DOCS)}</li>
            <li>{ext('0G ecosystem ↗', OG_HOME)}</li>
            <li><Link href="/r/1004" style={{ color: 'inherit', textDecoration: 'none' }}>Sample receipt</Link></li>
            <li><Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</Link></li>
            <li><Link href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms</Link></li>
            <li><span className="mono" style={{ fontSize: 11 }}>ivaronix receipt verify --tee-independent</span></li>
          </ul>
        </section>

        <section>
          <div className="section-label" style={{ marginBottom: 16 }}>Network</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li className="mono" style={{ fontSize: 11 }}>0G {network === 'mainnet' ? 'Aristotle · chainId 16661' : 'Galileo · chainId 16602'}</li>
            {liveRegistry.map(({ name, addr }) => (
              <li key={name} className="mono" style={{ fontSize: 11 }}>
                <a
                  href={`${EXPLORER}/address/${addr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                  title={`${name} ${addr}`}
                >
                  {name} {shortAddr(addr)}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="section-label" style={{ marginBottom: 16 }}>Open Source</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li>{ext('GitHub repository ↗', REPO)}</li>
            <li>{ext('Issues ↗', `${REPO.replace(/\.git$/, '')}/issues`)}</li>
            <li>{ext('Block explorer ↗', EXPLORER)}</li>
            <li>{ext('Galileo faucet ↗', 'https://faucet.0g.ai')}</li>
          </ul>
        </section>
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: '32px auto 0',
          paddingTop: 24,
          borderTop: '1px solid var(--color-hairline)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          fontSize: 13,
          color: 'var(--color-muted)',
        }}
      >
        <span>
          <span className="italic-display">Catch the risks.</span> Keep the receipts.
        </span>
        <span className="mono">network: {network}</span>
      </div>
    </footer>
  );
}
