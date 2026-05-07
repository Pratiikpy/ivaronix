/**
 * Four-Light Row — the cross-cutting visual primitive per UI_UX_GUIDE §5.
 * [●─Storage─][●─Compute─][●─TEE─][●─Chain─]
 *
 * Day-13 scaffold renders the Verified path. Day-14 wires per-layer state
 * to live inference progress.
 */

type LayerState = 'pending' | 'active' | 'verified' | 'mismatch';
interface Layer {
  name: 'Storage' | 'Compute' | 'TEE' | 'Chain';
  state: LayerState;
}

const ACTIVE_COLOR: Record<Layer['name'], string> = {
  Storage: 'var(--color-storage)',
  Compute: 'var(--color-compute)',
  TEE: 'var(--color-tee)',
  Chain: 'var(--color-chain)',
};

function dotColor(layer: Layer): string {
  if (layer.state === 'pending') return 'var(--color-pending)';
  if (layer.state === 'mismatch') return 'var(--color-mismatch)';
  if (layer.state === 'verified') return 'var(--color-verified)';
  return ACTIVE_COLOR[layer.name];
}

function chipBorder(layer: Layer): string {
  if (layer.state === 'pending') return '1px dashed var(--color-pending)';
  if (layer.state === 'mismatch') return '1px solid var(--color-mismatch)';
  if (layer.state === 'verified') return '1px solid var(--color-verified)';
  return '1px solid transparent';
}

export function FourLightRow({ layers }: { layers?: Partial<Record<Layer['name'], LayerState>> }) {
  const ls: Layer[] = (['Storage', 'Compute', 'TEE', 'Chain'] as const).map((n) => ({
    name: n,
    state: layers?.[n] ?? 'pending',
  }));

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="status" aria-label="Verification layers">
      {ls.map((layer) => (
        <span
          key={layer.name}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            border: chipBorder(layer),
            borderRadius: 999,
            fontSize: 11,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            fontWeight: 500,
            color: layer.state === 'mismatch' ? 'var(--color-mismatch)' : 'var(--color-fg)',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: dotColor(layer),
            }}
          />
          {layer.name}
          <span className="sr-only">— {layer.state}</span>
        </span>
      ))}
    </div>
  );
}
