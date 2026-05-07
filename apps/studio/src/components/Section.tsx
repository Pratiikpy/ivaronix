import type { ReactNode } from 'react';

/**
 * The §-numbered section pattern from UI_UX_GUIDE §13.
 * Provides consistent vertical rhythm across pages.
 */
export function Section({
  label,
  title,
  description,
  cta,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  cta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section style={{ padding: '96px 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
        <div className="section-label" style={{ marginBottom: 16 }}>
          {label}
        </div>
        <h2 style={{ fontSize: 32, lineHeight: 1.2, fontWeight: 600, margin: 0 }}>{title}</h2>
        {description && (
          <p style={{ fontSize: 16, color: 'var(--color-muted)', margin: '12px 0 0', maxWidth: 720 }}>
            {description}
          </p>
        )}
        {children && <div style={{ marginTop: 48 }}>{children}</div>}
        {cta && <div style={{ marginTop: 32 }}>{cta}</div>}
      </div>
    </section>
  );
}
