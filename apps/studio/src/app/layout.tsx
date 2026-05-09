import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Outfit, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/lib/providers';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import './globals.css';

// Brand typography per CLAUDE.md §10. The HTML reference at
// brand/Ivaronix.html uses these three families verbatim.
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Ivaronix — AI review for the documents you can't paste into ChatGPT.",
  description: 'Burn Mode encrypts it. The audit ships a receipt anyone can verify from any machine — even after the document is gone.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3300'),
  openGraph: {
    title: "Ivaronix — AI review for the documents you can't paste into ChatGPT.",
    description: 'Burn Mode encrypts it. The audit ships a receipt anyone can verify from any machine — even after the document is gone.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
