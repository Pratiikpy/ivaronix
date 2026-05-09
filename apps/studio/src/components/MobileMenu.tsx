'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { WalletConnect } from './WalletConnect';

/**
 * Hamburger nav for <=480px. The desktop <nav> hides its links at that
 * width via globals.css; this component lights up in their place and
 * opens a full-height drawer with the same destinations + connect chip.
 *
 * Closes on: link click, ESC, backdrop click. Restores body scroll on
 * unmount so a route change while the drawer is open doesn't leak the
 * `overflow: hidden` lock.
 */

const LINKS: { href: string; label: string }[] = [
  { href: '/onboard', label: 'Onboard' },
  { href: '/skills', label: 'Skills' },
  { href: '/global', label: 'Global' },
  { href: '/brand', label: 'Brand' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/memory', label: 'Memory' },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setMounted(true); }, []);

  // Close on route change. Don't call setOpen() inside the link's onClick —
  // that would unmount the <Link> mid-click and cancel the navigation.
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="mobile-menu-trigger"
        style={{
          display: 'none',
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: '1px solid var(--color-hairline)',
          borderRadius: 10,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
          {open ? (
            <>
              <line x1="2" y1="2" x2="16" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="2" y1="12" x2="16" y2="2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </>
          ) : (
            <>
              <line x1="2" y1="3" x2="16" y2="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="2" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="2" y1="11" x2="16" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>

      {open && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            top: 64,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 60,
            backgroundColor: 'rgba(10, 10, 10, 0.32)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(380px, 100%)',
              height: '100%',
              backgroundColor: '#FAFAF7',
              borderLeft: '1px solid var(--color-hairline)',
              padding: '32px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              animation: 'mm-slide-in 200ms ease-out',
              boxShadow: '-12px 0 32px rgba(10, 10, 10, 0.06)',
            }}
          >
            <div className="section-label">Navigate</div>
            <nav aria-label="Mobile primary" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  style={{
                    fontSize: 18,
                    padding: '12px 4px',
                    color: 'var(--color-ink)',
                    textDecoration: 'none',
                    borderBottom: '1px solid var(--color-hairline)',
                  }}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div style={{ marginTop: 'auto' }}>
              <WalletConnect />
            </div>
          </div>
          <style>{`@keyframes mm-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        </div>,
        document.body,
      )}
    </>
  );
}
