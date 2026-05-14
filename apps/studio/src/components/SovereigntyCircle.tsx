/**
 * Sovereignty Circle — the canonical Ivaronix data-flow diagram.
 *
 * Communicates the trust loop a stranger reading a receipt needs to
 * understand:
 *
 *   1. Private input enters from the left (user-controlled)
 *   2. Crosses the TEE trust boundary (operator-blind region)
 *   3. Produces a signed inference + canonical receipt
 *   4. Receipt anchors on 0G Chain (publicly verifiable)
 *   5. Proof URL flows out — anyone can re-verify
 *
 * Visual contract: CLAUDE.md §10 + brand/tokens.css.
 * Threat model context: docs/PRIVACY_NOTES.md §1 (operator-as-proxy) and
 * docs/CRYPTO_NOTES.md §1 (memory-at-rest) are the source-of-truth for
 * the boundary copy below.
 *
 * Self-contained server component. Pure SVG + inline styles. No client
 * JS. Respects prefers-reduced-motion via the keyframe guard in
 * globals.css:386. The `variant` prop reserves a hook for the
 * Day-10-12 /learn page interactive version (final-plan.md §1.6).
 */

import type { ReactElement } from 'react';

type Variant = 'home' | 'learn';

interface Step {
  id: string;
  index: string;
  title: string;
  body: string;
  zone: 'user' | 'tee' | 'chain' | 'public';
  iconColor: string;
}

const STEPS: readonly Step[] = [
  {
    id: 'input',
    index: '01',
    title: 'Private input',
    body: 'Document, prompt, or memory leaves your machine encrypted in transit.',
    zone: 'user',
    iconColor: 'var(--color-fg)',
  },
  {
    id: 'tee',
    index: '02',
    title: '0G Compute · TEE',
    body: 'Inference runs inside an attested enclave. Operator cannot read the plaintext.',
    zone: 'tee',
    iconColor: 'var(--color-tee)',
  },
  {
    id: 'receipt',
    index: '03',
    title: 'Signed receipt',
    body: 'Canonical JSON hashed with RFC-8785, signed by an AgentPassport wallet.',
    zone: 'tee',
    iconColor: 'var(--color-compute)',
  },
  {
    id: 'anchor',
    index: '04',
    title: '0G Chain anchor',
    body: 'Receipt root + signature recorded on ReceiptRegistry. Immutable, timestamped.',
    zone: 'chain',
    iconColor: 'var(--color-chain)',
  },
  {
    id: 'proof',
    index: '05',
    title: 'Public proof URL',
    body: 'Anyone re-verifies the chain anchor and re-runs broker.processResponse.',
    zone: 'public',
    iconColor: 'var(--color-verified)',
  },
];

const ZONE_LABEL: Record<Step['zone'], string> = {
  user: 'Your device',
  tee: 'Operator-blind region',
  chain: 'Public ledger',
  public: 'Stranger replays',
};

export function SovereigntyCircle({ variant = 'home' }: { variant?: Variant } = {}): ReactElement {
  // Variant currently used only to add an a11y test hook; the /learn
  // page will swap in an interactive variant later.
  const wrapperLabel = variant === 'learn' ? 'sovereignty-circle-learn' : 'sovereignty-circle-home';

  return (
    <div
      data-component={wrapperLabel}
      style={{
        background: 'var(--color-tonal)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 20,
        padding: '40px 24px',
      }}
      aria-label="Ivaronix data-flow diagram. Private input enters the TEE, becomes a signed receipt, anchors on 0G Chain, and produces a public proof URL."
      role="img"
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="section-label" style={{ marginBottom: 8 }}>
          The loop
        </div>
        <p
          style={{
            fontSize: 15,
            color: 'var(--color-muted)',
            margin: '0 0 28px',
            maxWidth: 640,
            lineHeight: 1.55,
          }}
        >
          Your input stays private until it crosses into a TEE. What comes back is a signed
          receipt anyone in the world can re-verify, without seeing the input.
        </p>

        {/* Desktop / tablet flow */}
        <div className="sovereignty-flow-desktop">
          <FlowSvg />
          <ol
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '28px 0 0',
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 16,
            }}
          >
            {STEPS.map((step) => (
              <li key={step.id}>
                <StepCard step={step} />
              </li>
            ))}
          </ol>
        </div>

        {/* Mobile stack — vertical, no SVG */}
        <ol
          className="sovereignty-flow-mobile"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'none',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {STEPS.map((step, i) => (
            <li key={step.id} style={{ position: 'relative' }}>
              <StepCard step={step} />
              {i < STEPS.length - 1 && <MobileConnector />}
            </li>
          ))}
        </ol>

        <div
          style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: '1px solid var(--color-hairline)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <span className="section-label" style={{ fontSize: 11 }}>
            What this defends
          </span>
          <span style={{ color: 'var(--color-muted)', fontSize: 13, lineHeight: 1.6 }}>
            Operator-side disclosure of your input. Tampering with the receipt body or hash.
            False claims that an AI produced an answer it did not.
          </span>
        </div>
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <span className="section-label" style={{ fontSize: 11 }}>
            What it does not
          </span>
          <span style={{ color: 'var(--color-muted)', fontSize: 13, lineHeight: 1.6 }}>
            Compromise of your own device. The answer being correct. Receipts attest to the
            process, not the verdict.
          </span>
        </div>
      </div>

      <style>{`
        .sovereignty-flow-desktop {
          display: block;
        }
        .sovereignty-flow-mobile {
          display: none !important;
        }
        @media (max-width: 760px) {
          .sovereignty-flow-desktop {
            display: none !important;
          }
          .sovereignty-flow-mobile {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}

function StepCard({ step }: { step: Step }): ReactElement {
  return (
    <div
      className="module-card"
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 14,
        padding: '16px 16px 18px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'transform 160ms ease, border-color 160ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: step.iconColor,
            flexShrink: 0,
          }}
        />
        <span
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: '1.5px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
          }}
        >
          {step.index} · {ZONE_LABEL[step.zone]}
        </span>
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--color-fg)',
          lineHeight: 1.3,
        }}
      >
        {step.title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--color-muted)',
          lineHeight: 1.5,
        }}
      >
        {step.body}
      </div>
    </div>
  );
}

function MobileConnector(): ReactElement {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 16,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <svg width="2" height="16" viewBox="0 0 2 16" fill="none" aria-hidden="true">
        <line
          x1="1"
          y1="0"
          x2="1"
          y2="16"
          stroke="var(--color-hairline)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      </svg>
    </div>
  );
}

/**
 * The flow ribbon. 1100 wide viewBox, 5 evenly-spaced nodes, a tinted
 * trust-boundary band over steps 2-3, and arrows linking each node to
 * the next. No animation — read-only, reduced-motion-safe by default.
 */
function FlowSvg(): ReactElement {
  const W = 1100;
  const H = 120;
  const nodeY = H / 2;
  const xs: number[] = STEPS.map((_, i) => Math.round((W / (STEPS.length + 1)) * (i + 1)));
  const firstX = xs[0] ?? 0;
  const lastX = xs[xs.length - 1] ?? W;

  // Trust boundary band brackets steps 2 and 3 (the TEE region).
  const teeStartX = (xs[1] ?? 0) - 70;
  const teeEndX = (xs[2] ?? 0) + 70;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="presentation"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <defs>
        <marker
          id="sov-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-muted)" />
        </marker>
      </defs>

      {/* TEE boundary band */}
      <rect
        x={teeStartX}
        y={20}
        width={teeEndX - teeStartX}
        height={H - 40}
        rx={14}
        ry={14}
        fill="rgba(147, 51, 234, 0.06)"
        stroke="var(--color-tee)"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <text
        x={(teeStartX + teeEndX) / 2}
        y={16}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={10}
        letterSpacing="1.5"
        fill="var(--color-tee)"
        style={{ textTransform: 'uppercase' }}
      >
        TRUST BOUNDARY — OPERATOR-BLIND
      </text>

      {/* Connecting arrows between nodes */}
      {xs.slice(0, -1).map((x, i) => {
        const nextX = xs[i + 1] ?? x;
        return (
          <line
            key={`arr-${i}`}
            x1={x + 22}
            y1={nodeY}
            x2={nextX - 24}
            y2={nodeY}
            stroke="var(--color-muted)"
            strokeWidth={1.2}
            markerEnd="url(#sov-arrow)"
          />
        );
      })}

      {/* Nodes */}
      {STEPS.map((step, i) => {
        const cx = xs[i] ?? 0;
        return (
          <g key={step.id}>
            <circle cx={cx} cy={nodeY} r={20} fill="var(--color-bg)" stroke={step.iconColor} strokeWidth={1.5} />
            <text
              x={cx}
              y={nodeY + 4}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={12}
              fontWeight={600}
              fill={step.iconColor}
            >
              {step.index}
            </text>
          </g>
        );
      })}

      {/* Edge labels — "your device" left bracket, "public ledger" right bracket */}
      <text
        x={firstX - 28}
        y={nodeY + 4}
        textAnchor="end"
        fontFamily="var(--font-mono)"
        fontSize={10}
        letterSpacing="1.2"
        fill="var(--color-muted)"
        style={{ textTransform: 'uppercase' }}
      >
        YOU
      </text>
      <text
        x={lastX + 28}
        y={nodeY + 4}
        textAnchor="start"
        fontFamily="var(--font-mono)"
        fontSize={10}
        letterSpacing="1.2"
        fill="var(--color-verified)"
        style={{ textTransform: 'uppercase' }}
      >
        ANYONE
      </text>
    </svg>
  );
}
