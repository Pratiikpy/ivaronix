'use client';

/**
 * AnimatedFourLightHero — marketing-grade animated version of the
 * four-light row. Used on landing surfaces (home hero / explainer /
 * learn) to communicate the receipt-production sequence at a glance.
 *
 * Sequence (per final-plan.md §1.6 Day 5-9):
 *   t=0.0s  · all 4 lights pending (grey, dashed border)
 *   t=0.6s  · Storage flips green
 *   t=1.2s  · Compute flips green
 *   t=1.8s  · TEE flips green
 *   t=2.4s  · Chain flips green
 *   t=3.0s  · "FULLY VERIFIED ✓" caption fades in
 *   t=4.8s  · cycle resets, repeats
 *
 * Total period: 6s. Pure CSS animation — no rAF, no JS timers, no
 * state. Stagger via per-light `animation-delay`; the caption uses
 * a separate keyframe synced to the same period.
 *
 * Reduced-motion path (prefers-reduced-motion: reduce):
 *   - animations disabled by the existing globals.css rule (§globals
 *     line 388), so all elements settle at their final keyframe value.
 *   - We force the verified visual at rest via a media-query override
 *     in globals.css so users with reduced motion see the END state
 *     (all green + caption visible), not the START state (all grey).
 *
 * The static receipt-page primitive stays at FourLightRow.tsx; this
 * file is hero-only and renders no per-receipt data.
 */

const LAYERS = ['Storage', 'Compute', 'TEE', 'Chain'] as const;

type Variant = 'compact' | 'expanded';

export function AnimatedFourLightHero({ variant = 'expanded' }: { variant?: Variant }) {
  const isCompact = variant === 'compact';

  return (
    <div
      className="animated-four-light-hero"
      role="img"
      aria-label="Verification sequence: Storage, Compute, TEE, Chain — fully verified"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: isCompact ? 10 : 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {LAYERS.map((name, idx) => (
          <span
            key={name}
            className="afl-chip"
            data-layer={name.toLowerCase()}
            style={{
              ['--afl-delay' as string]: `${0.6 + idx * 0.6}s`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 11,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              fontWeight: 500,
              color: 'var(--color-fg)',
            }}
          >
            <span aria-hidden="true" className="afl-dot" />
            {name}
          </span>
        ))}
      </div>

      {!isCompact && (
        <div
          className="afl-caption"
          aria-hidden="true"
          style={{
            fontSize: 11,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontWeight: 500,
            color: 'var(--color-verified)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>Fully verified</span>
          <span aria-hidden="true">✓</span>
        </div>
      )}
    </div>
  );
}
