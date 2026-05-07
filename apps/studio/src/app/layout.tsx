import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/lib/providers';
import { Header } from '@/components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ivaronix — Catch the risks. Keep the receipts.',
  description: 'AI agents that double-check themselves on 0G.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3300'),
  openGraph: {
    title: 'Ivaronix',
    description: 'AI agents that double-check themselves on 0G.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <main>{children}</main>
          <footer
            style={{
              borderTop: '1px solid var(--color-hairline)',
              padding: '48px 32px',
              marginTop: 96,
              maxWidth: 1200,
              marginLeft: 'auto',
              marginRight: 'auto',
              fontSize: 13,
              color: 'var(--color-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <span>
              <span className="italic-display">Catch the risks.</span> Keep the receipts.
            </span>
            <span className="mono">network: {process.env.NEXT_PUBLIC_OG_NETWORK ?? 'testnet'}</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
