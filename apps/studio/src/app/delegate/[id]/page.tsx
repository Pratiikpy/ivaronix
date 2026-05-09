import Link from 'next/link';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Section } from '@/components/Section';
import { explorerAddrUrl, explorerTxUrl } from '@/lib/chain';

export const dynamic = 'force-dynamic';

interface DelegateGrant {
  skillId: string;
  grantId: string;
  grantTx: string;
  scopeHash: string;
  issuedAt: number;
  revokedAt?: number;
  revokeTx?: string;
}

interface DelegateManifest {
  delegateId: string;
  name: string;
  description: string;
  ownerUserWallet: string;
  delegateAddress: string;
  skillsAuthorized: string[];
  passportTokenId: string | null;
  passportMintTx: string | null;
  fundingTx: string | null;
  capabilityGrants: DelegateGrant[];
  createdAt: number;
  network: string;
}

/** Walk ancestors of cwd looking for a delegate manifest. Accepts full id or unique prefix. */
function findDelegateManifest(idOrPrefix: string): DelegateManifest | null {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    const delegatesDir = resolve(dir, '.ivaronix', 'delegates');
    if (existsSync(delegatesDir)) {
      try {
        const entries = readdirSync(delegatesDir);
        for (const e of entries) {
          if (e === idOrPrefix || e.startsWith(idOrPrefix)) {
            const manifestPath = resolve(delegatesDir, e, 'manifest.json');
            if (existsSync(manifestPath)) {
              try {
                return JSON.parse(readFileSync(manifestPath, 'utf8')) as DelegateManifest;
              } catch { /* continue */ }
            }
          }
        }
      } catch { /* continue */ }
    }
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      // Workspace siblings (apps/cli/.ivaronix/delegates/) too
      for (const sib of ['apps/cli', 'apps/mcp-server']) {
        const sibDir = resolve(dir, sib, '.ivaronix', 'delegates');
        if (existsSync(sibDir)) {
          try {
            const entries = readdirSync(sibDir);
            for (const e of entries) {
              if (e === idOrPrefix || e.startsWith(idOrPrefix)) {
                const manifestPath = resolve(sibDir, e, 'manifest.json');
                if (existsSync(manifestPath)) {
                  try {
                    return JSON.parse(readFileSync(manifestPath, 'utf8')) as DelegateManifest;
                  } catch { /* continue */ }
                }
              }
            }
          } catch { /* continue */ }
        }
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function shortHash(h: string, prefixLen = 10): string {
  if (!h) return '—';
  if (h.length < prefixLen + 6) return h;
  return `${h.slice(0, prefixLen)}…${h.slice(-6)}`;
}

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

export default async function DelegatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manifest = findDelegateManifest(id);

  if (!manifest) {
    return (
      <Section
        label={`§ DELEGATE · ${id.slice(0, 12)}…`}
        title="Delegate not found."
        description="No manifest for this delegate id is on the local filesystem of the Studio process. Either it was never created, or the operator who created it has not synced its manifest to this machine. Confirm the delegate id, or rerun the operator's manifest sync. The on-chain identity (passport tokenId + capability grants) remains valid regardless of whether the local manifest is present."
      />
    );
  }

  const activeGrants = manifest.capabilityGrants.filter((g) => !g.revokedAt);
  const revokedGrants = manifest.capabilityGrants.filter((g) => g.revokedAt);
  const createdIso = isoFromMs(manifest.createdAt);

  return (
    <section style={{ padding: '64px 32px 96px', maxWidth: 1200, margin: '0 auto' }}>
      <div className="section-label" style={{ marginBottom: 16 }}>
        § DELEGATE · ID {manifest.delegateId.slice(0, 12)}…
      </div>
      <h1 style={{ fontSize: 56, lineHeight: 1.05, margin: 0, letterSpacing: '-1.5px', fontWeight: 700 }}>
        {manifest.name.split(/\s*·\s*/)[0]}{' '}
        {manifest.name.includes('·') && (
          <span className="italic-display" style={{ fontWeight: 400 }}>
            {manifest.name.split(/\s*·\s*/).slice(1).join(' · ').toLowerCase()}.
          </span>
        )}
      </h1>
      <p style={{ fontSize: 17, color: 'var(--color-muted)', marginTop: 16, maxWidth: 760, lineHeight: 1.55 }}>
        {manifest.description || 'A delegated AI specialist with its own on-chain identity.'} Every action signed
        by the delegate's wallet, not by{' '}
        <Link href={explorerAddrUrl(manifest.ownerUserWallet)} style={{ color: 'inherit' }}>
          {shortAddr(manifest.ownerUserWallet)}
        </Link>
        . Capability grants live on the on-chain CapabilityRegistry —{' '}
        <strong style={{ color: 'var(--color-fg)' }}>revocable at any time</strong>, no operator cooperation needed.
      </p>

      {/* Identity + custody side-by-side */}
      <div
        style={{
          marginTop: 48,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
        }}
      >
        {/* Identity card */}
        <div className="card">
          <div className="section-label" style={{ marginBottom: 12 }}>Identity</div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 13, margin: 0 }}>
            <dt style={{ color: 'var(--color-muted)' }}>delegate id</dt>
            <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>{manifest.delegateId}</dd>
            <dt style={{ color: 'var(--color-muted)' }}>name</dt>
            <dd style={{ margin: 0 }}>{manifest.name}</dd>
            <dt style={{ color: 'var(--color-muted)' }}>created</dt>
            <dd className="mono" style={{ margin: 0 }}>{createdIso}Z</dd>
            <dt style={{ color: 'var(--color-muted)' }}>delegate wallet</dt>
            <dd className="mono" style={{ margin: 0 }}>
              <a href={explorerAddrUrl(manifest.delegateAddress)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                {manifest.delegateAddress} ↗
              </a>
            </dd>
            <dt style={{ color: 'var(--color-muted)' }}>passport tokenId</dt>
            <dd className="mono" style={{ margin: 0 }}>{manifest.passportTokenId ?? '— (mint pending)'}</dd>
            {manifest.passportMintTx && (
              <>
                <dt style={{ color: 'var(--color-muted)' }}>passport mint</dt>
                <dd className="mono" style={{ margin: 0 }}>
                  <a href={explorerTxUrl(manifest.passportMintTx)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                    {shortHash(manifest.passportMintTx)} ↗
                  </a>
                </dd>
              </>
            )}
            {manifest.fundingTx && (
              <>
                <dt style={{ color: 'var(--color-muted)' }}>funding tx</dt>
                <dd className="mono" style={{ margin: 0 }}>
                  <a href={explorerTxUrl(manifest.fundingTx)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                    {shortHash(manifest.fundingTx)} ↗
                  </a>
                </dd>
              </>
            )}
            <dt style={{ color: 'var(--color-muted)' }}>owner (user)</dt>
            <dd className="mono" style={{ margin: 0 }}>
              <a href={explorerAddrUrl(manifest.ownerUserWallet)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                {shortAddr(manifest.ownerUserWallet)} ↗
              </a>
            </dd>
            <dt style={{ color: 'var(--color-muted)' }}>network</dt>
            <dd className="mono" style={{ margin: 0 }}>{manifest.network}</dd>
          </dl>
        </div>

        {/* Custody card — Phase A vs Phase B disclosure */}
        <div className="card">
          <div className="section-label" style={{ marginBottom: 12 }}>Key custody · disclosure</div>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0, marginBottom: 12, lineHeight: 1.55 }}>
            The delegate has its own private key. The user's signing key is <strong>never invoked</strong> when the
            delegate runs a skill — every receipt from this agent is signed by{' '}
            <code className="mono">{shortAddr(manifest.delegateAddress)}</code>, not{' '}
            <code className="mono">{shortAddr(manifest.ownerUserWallet)}</code>.
          </p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 13, margin: 0 }}>
            <dt style={{ color: 'var(--color-muted)' }}>phase</dt>
            <dd style={{ margin: 0 }}>
              <span className="badge" style={{ background: '#fff7d6', borderColor: '#e8c800', color: '#7a5d00' }}>
                A · operator-side custody
              </span>
            </dd>
            <dt style={{ color: 'var(--color-muted)' }}>storage</dt>
            <dd className="mono" style={{ margin: 0 }}>local filesystem · mode 0600</dd>
            <dt style={{ color: 'var(--color-muted)' }}>trust boundary</dt>
            <dd style={{ margin: 0, fontSize: 12, lineHeight: 1.55 }}>
              Operator does not export the key from <code className="mono">.ivaronix/delegates/</code>. The user is
              still protected against operator-side <em>misuse</em> by capability scoping + on-chain revocation: a
              compromised key can only do what the active grants allow, and the user can kill it instantly.
            </dd>
            <dt style={{ color: 'var(--color-muted)' }}>phase B target</dt>
            <dd style={{ margin: 0, fontSize: 12, lineHeight: 1.55 }}>
              Key generated <strong>inside</strong> a 0G Compute TEE on first mint, never extracted. On-chain identity
              model is unchanged — all that changes is where the private key sits. See{' '}
              <code className="mono">docs/planning-01.md</code> §3.
            </dd>
          </dl>
        </div>
      </div>

      {/* Active grants */}
      <div className="card" style={{ marginTop: 32 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>
          Active capabilities ({activeGrants.length})
        </div>
        {activeGrants.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>
            No active grants. The delegate cannot run any skill on behalf of {shortAddr(manifest.ownerUserWallet)}{' '}
            until an authorized capability is issued. From the operator's terminal:{' '}
            <code className="mono">
              ivaronix delegate grant {manifest.delegateId.slice(0, 12)} --skill {manifest.skillsAuthorized[0] ?? 'private-doc-review'}
            </code>
            .
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeGrants.map((g) => (
              <div
                key={g.grantId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto',
                  alignItems: 'center',
                  gap: 16,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--color-hairline)',
                  fontSize: 14,
                }}
              >
                <span>
                  <code className="mono" style={{ fontSize: 13 }}>{g.skillId}</code>
                  <span style={{ color: 'var(--color-muted)', marginLeft: 12, fontSize: 12 }}>
                    issued {isoFromMs(g.issuedAt)}Z
                  </span>
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  grant {shortHash(g.grantId, 8)}
                </span>
                <a
                  href={explorerTxUrl(g.grantTx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost"
                  style={{ fontSize: 12 }}
                >
                  grant tx ↗
                </a>
                <span className="badge" style={{ background: '#e6f9ec', borderColor: '#26c050', color: '#0e6428' }}>
                  active
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked grants */}
      {revokedGrants.length > 0 && (
        <div className="card" style={{ marginTop: 32 }}>
          <div className="section-label" style={{ marginBottom: 16 }}>
            Revoked capabilities ({revokedGrants.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {revokedGrants.map((g) => (
              <div
                key={g.grantId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto',
                  alignItems: 'center',
                  gap: 16,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--color-hairline)',
                  fontSize: 14,
                  opacity: 0.65,
                }}
              >
                <span>
                  <code className="mono" style={{ fontSize: 13 }}>{g.skillId}</code>
                  <span style={{ color: 'var(--color-muted)', marginLeft: 12, fontSize: 12 }}>
                    revoked {g.revokedAt ? isoFromMs(g.revokedAt) : 'unknown'}Z
                  </span>
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  grant {shortHash(g.grantId, 8)}
                </span>
                {g.revokeTx ? (
                  <a
                    href={explorerTxUrl(g.revokeTx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost"
                    style={{ fontSize: 12 }}
                  >
                    revoke tx ↗
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>—</span>
                )}
                <span className="badge" style={{ background: '#f3eaea', borderColor: '#b94a4a', color: '#5d1a1a' }}>
                  revoked
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verify-from-CLI hint */}
      <div
        style={{
          marginTop: 32,
          padding: 24,
          background: 'var(--color-tonal)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div className="section-label" style={{ marginBottom: 12 }}>Verify the delegation pattern</div>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0, lineHeight: 1.55, marginBottom: 12 }}>
          Pull any receipt this delegate has signed and confirm the signer is the delegate's wallet, not the user's.
          The receipt's <code className="mono">agent.ownerWallet</code> field is{' '}
          <code className="mono">{manifest.delegateAddress}</code> on every action.
        </p>
        <pre
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            margin: 0,
            overflowX: 'auto',
          }}
        >
{`ivaronix delegate run ${manifest.delegateId.slice(0, 12)} <doc> --question "..."  # delegate signs the receipt
ivaronix indexer backfill                                              # resolve recent on-chain ids
ivaronix receipt verify <id> --tee-independent                         # signer = delegate, not user
ivaronix delegate revoke ${manifest.delegateId.slice(0, 12)}                          # revoke instantly`}
        </pre>
      </div>
    </section>
  );
}
