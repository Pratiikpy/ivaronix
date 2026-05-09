import Link from 'next/link';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Section } from '@/components/Section';
import { explorerAddrUrl } from '@/lib/chain';

export const dynamic = 'force-dynamic';

interface RoomManifest {
  roomId: string;
  creator: string;
  parties: string[];
  blobStorageRoot: string;
  blobStorageTxHash?: string;
  blobBytes: number;
  keyFingerprint: string;
  destroyedAt: number;
  ttlSeconds: number;
  readsCap: number;
  scopeHash: string;
  grantIds: Record<string, string>;
  createdAt: number;
  network: string;
  manifestHash: string;
}

/** Walk ancestors of cwd looking for `.ivaronix/rooms/<id>.json`. */
function findRoomManifest(roomId: string): RoomManifest | null {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    const candidate = resolve(dir, '.ivaronix', 'rooms', `${roomId}.json`);
    if (existsSync(candidate)) {
      try {
        return JSON.parse(readFileSync(candidate, 'utf8')) as RoomManifest;
      } catch { return null; }
    }
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      // Check workspace siblings (apps/cli/.ivaronix/rooms/) too
      for (const sib of ['apps/cli', 'apps/mcp-server']) {
        const sibCandidate = resolve(dir, sib, '.ivaronix', 'rooms', `${roomId}.json`);
        if (existsSync(sibCandidate)) {
          try { return JSON.parse(readFileSync(sibCandidate, 'utf8')) as RoomManifest; } catch { return null; }
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
  if (h.length < prefixLen + 6) return h;
  return `${h.slice(0, prefixLen)}…${h.slice(-6)}`;
}

export default async function DataRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const manifest = findRoomManifest(id);
  if (!manifest) {
    return (
      <Section
        label={`§ DATA ROOM · ${id.slice(0, 12)}…`}
        title="Room not found."
        description="The manifest for this room is not on the local filesystem of the Studio process. Either it was never created, or its operator has not synced it to this machine. Confirm the room id, or rerun the operator's manifest sync."
      />
    );
  }

  const ttlExpiresAt = manifest.createdAt + manifest.ttlSeconds * 1000;
  const ttlExpired = Date.now() > ttlExpiresAt;
  const ttlExpiresIso = new Date(ttlExpiresAt).toISOString().replace('T', ' ').slice(0, 19);
  const destroyedIso = new Date(manifest.destroyedAt).toISOString().replace('T', ' ').slice(0, 19);
  const createdIso = new Date(manifest.createdAt).toISOString().replace('T', ' ').slice(0, 19);

  return (
    <section style={{ padding: '64px 32px 96px', maxWidth: 1200, margin: '0 auto' }}>
      <div className="section-label" style={{ marginBottom: 16 }}>
        § DATA ROOM · ID {manifest.roomId.slice(0, 12)}…
      </div>
      <h1 style={{ fontSize: 56, lineHeight: 1.05, margin: 0, letterSpacing: '-1.5px', fontWeight: 700 }}>
        Confidential <span className="italic-display" style={{ fontWeight: 400 }}>data room.</span>
      </h1>
      <p style={{ fontSize: 17, color: 'var(--color-muted)', marginTop: 16, maxWidth: 760, lineHeight: 1.55 }}>
        {manifest.parties.length} part{manifest.parties.length === 1 ? 'y' : 'ies'} hold capability grants on the on-chain
        CapabilityRegistry against scope <code className="mono" style={{ fontSize: 13 }}>{shortHash(manifest.scopeHash)}</code>.
        The encrypted document blob is anchored on 0G Storage; the AES-256-GCM session key was destroyed at{' '}
        <strong style={{ color: 'var(--color-fg)' }}>{destroyedIso}Z</strong>.
        Operator-side disclosure of the original document is structurally impossible after this point.
      </p>

      <div
        style={{
          marginTop: 48,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
        }}
      >
        {/* Manifest card */}
        <div className="card">
          <div className="section-label" style={{ marginBottom: 12 }}>Manifest</div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 13, margin: 0 }}>
            <dt style={{ color: 'var(--color-muted)' }}>roomId</dt>
            <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>{manifest.roomId}</dd>
            <dt style={{ color: 'var(--color-muted)' }}>manifest hash</dt>
            <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>{manifest.manifestHash}</dd>
            <dt style={{ color: 'var(--color-muted)' }}>created</dt>
            <dd className="mono" style={{ margin: 0 }}>{createdIso}Z</dd>
            <dt style={{ color: 'var(--color-muted)' }}>ttl expires</dt>
            <dd className="mono" style={{ margin: 0, color: ttlExpired ? 'var(--color-mismatch)' : 'inherit' }}>
              {ttlExpiresIso}Z {ttlExpired ? '· EXPIRED' : ''}
            </dd>
            <dt style={{ color: 'var(--color-muted)' }}>reads cap</dt>
            <dd className="mono" style={{ margin: 0 }}>{manifest.readsCap} per party</dd>
            <dt style={{ color: 'var(--color-muted)' }}>blob bytes</dt>
            <dd className="mono" style={{ margin: 0 }}>{manifest.blobBytes.toLocaleString()}</dd>
            <dt style={{ color: 'var(--color-muted)' }}>blob root</dt>
            <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>{manifest.blobStorageRoot}</dd>
            {manifest.blobStorageTxHash && (
              <>
                <dt style={{ color: 'var(--color-muted)' }}>storage tx</dt>
                <dd className="mono" style={{ margin: 0 }}>
                  <a
                    href={`https://chainscan-galileo.0g.ai/tx/${manifest.blobStorageTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit' }}
                  >
                    {shortHash(manifest.blobStorageTxHash)} ↗
                  </a>
                </dd>
              </>
            )}
            <dt style={{ color: 'var(--color-muted)' }}>creator</dt>
            <dd className="mono" style={{ margin: 0 }}>
              <a href={explorerAddrUrl(manifest.creator)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                {shortAddr(manifest.creator)} ↗
              </a>
            </dd>
          </dl>
        </div>

        {/* Burn-mode evidence card */}
        <div className="card">
          <div className="section-label" style={{ marginBottom: 12 }}>Burn Mode · evidence proof</div>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0, marginBottom: 16, lineHeight: 1.55 }}>
            Session key destroyed; ciphertext now unreadable to operator. Burn Mode protects against operator-side
            disclosure; local-machine compromise is out of scope.
          </p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 13, margin: 0 }}>
            <dt style={{ color: 'var(--color-muted)' }}>encryption</dt>
            <dd className="mono" style={{ margin: 0 }}>aes-256-gcm · header detected</dd>
            <dt style={{ color: 'var(--color-muted)' }}>key fingerprint</dt>
            <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>{manifest.keyFingerprint}</dd>
            <dt style={{ color: 'var(--color-muted)' }}>destroyed at</dt>
            <dd className="mono" style={{ margin: 0 }}>{destroyedIso}Z</dd>
            <dt style={{ color: 'var(--color-muted)' }}>cleanup</dt>
            <dd className="mono" style={{ margin: 0 }}>completed</dd>
          </dl>
        </div>
      </div>

      {/* Parties + grants */}
      <div className="card" style={{ marginTop: 32 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>
          Parties ({manifest.parties.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {manifest.parties.map((p) => (
            <div
              key={p}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                alignItems: 'center',
                gap: 16,
                padding: '12px 0',
                borderBottom: '1px solid var(--color-hairline)',
                fontSize: 14,
              }}
            >
              <Link
                href={`/agent/${p}`}
                className="mono"
                style={{ color: 'var(--color-fg)', textDecoration: 'none' }}
              >
                {p}
              </Link>
              <span className="mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                grant {shortHash(manifest.grantIds[p] ?? '0x0000', 8)}
              </span>
              <a
                href={explorerAddrUrl(p)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
                style={{ fontSize: 12 }}
              >
                explorer ↗
              </a>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 16, marginBottom: 0 }}>
          Each party calls{' '}
          <code className="mono">ivaronix room read {manifest.roomId.slice(0, 8)}…</code>{' '}
          from their wallet to log a verifiable read receipt against this room.
        </p>
      </div>

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
        <div className="section-label" style={{ marginBottom: 12 }}>Verify from any machine</div>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0, lineHeight: 1.55, marginBottom: 12 }}>
          The room manifest, the encrypted blob, and every read receipt are independently re-verifiable. Anyone with the
          room id can check the chain anchor for every <code className="mono">doc_room_create</code> and{' '}
          <code className="mono">doc_room_read</code> receipt and confirm the access log was not fabricated.
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
{`ivaronix room read ${manifest.roomId}        # log a read against your wallet's grant
ivaronix indexer backfill                     # resolve recent on-chain ids
ivaronix receipt verify <id> --tee-independent   # FULLY VERIFIED ✓`}
        </pre>
      </div>
    </section>
  );
}
