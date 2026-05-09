import Link from 'next/link';
import { Logo } from './Logo';
import { WalletConnect } from './WalletConnect';
import { MobileMenu } from './MobileMenu';

/**
 * Sticky 64px-height header per UI_UX_GUIDE §12.
 * Left: logo. Right: nav links + wallet. Spacing is editorial-generous.
 */
export function Header() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(250, 250, 247, 0.92)',
        backdropFilter: 'saturate(150%) blur(20px)',
        WebkitBackdropFilter: 'saturate(150%) blur(20px)',
        borderBottom: '1px solid var(--color-hairline)',
        height: 64,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          height: '100%',
          margin: '0 auto',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 32,
        }}
      >
        <Link href="/" style={{ display: 'inline-flex' }} aria-label="Ivaronix home">
          <Logo />
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 14 }} aria-label="Primary">
          <Link href="/skills" className="btn-ghost">
            Skills
          </Link>
          <Link href="/global" className="btn-ghost">
            Global
          </Link>
          <Link href="/brand" className="btn-ghost">
            Brand
          </Link>
          <Link href="/dashboard" className="btn-ghost">
            Dashboard
          </Link>
          <WalletConnect />
          <MobileMenu />
        </nav>
      </div>
    </header>
  );
}
