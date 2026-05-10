import type { SkillManifest } from '@ivaronix/skills';

/**
 * The 3-slot Permission Pills row — memory access · shell access ·
 * receipt-required. Each pill is green when safe, amber when scoped,
 * red when dangerous. Visual contract: CLAUDE.md §10 +
 * `brand/tokens.css`. Enum values come from `@ivaronix/skills`
 * (MemoryAccessEnum, ShellAccessEnum) per planning-003 §A.1.1's
 * schema-as-source-of-truth rule.
 */
export function PermissionPills({ permissions }: { permissions: SkillManifest['og']['permissions'] }) {
  const networkTone =
    permissions.network_access.length === 0 ? 'green'
    : permissions.network_access.some((d) => d === '*' || d === '**') ? 'red'
    : 'amber';

  const networkLabel =
    permissions.network_access.length === 0
      ? 'no network'
      : permissions.network_access.length === 1
      ? `net: ${permissions.network_access[0]}`
      : `net: ${permissions.network_access.length} hosts`;

  const filesTone = permissions.writes_files ? 'red' : 'green';
  const filesLabel = permissions.writes_files ? 'files: write' : 'files: read-only';

  const computeTone =
    permissions.compute_tee_required ? 'green'
    : 'amber';
  const computeLabel = permissions.compute_tee_required ? 'compute: tee' : 'compute: any';

  const walletTone = permissions.wallet_access ? 'red' : 'green';
  const walletLabel = permissions.wallet_access ? 'wallet: write' : 'wallet: read-only';

  const shellTone =
    permissions.shell_access === 'none' ? 'green'
    : permissions.shell_access === 'sandbox-only' ? 'amber'
    : 'red';
  const shellLabel = `shell: ${permissions.shell_access}`;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      <Pill tone={networkTone}>{networkLabel}</Pill>
      <Pill tone={filesTone}>{filesLabel}</Pill>
      <Pill tone={computeTone}>{computeLabel}</Pill>
      <Pill tone={walletTone}>{walletLabel}</Pill>
      <Pill tone={shellTone}>{shellLabel}</Pill>
    </div>
  );
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
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
