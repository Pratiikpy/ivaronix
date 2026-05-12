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

/**
 * Resolve the canonical base URL for absolute meta-tag URLs (og:image,
 * twitter:image, etc.). Resolution chain:
 *
 *   1. NEXT_PUBLIC_BASE_URL          operator override (custom domain)
 *   2. VERCEL_PROJECT_PRODUCTION_URL canonical production (e.g. ivaronix.vercel.app)
 *   3. VERCEL_URL                    current deploy preview URL
 *   4. http://localhost:3300         local dev fallback
 *
 * Pre-fix the fallback chain was JUST step 1 → step 4, so Vercel
 * production landed on localhost:3300 in social-card meta tags
 * (Vercel doesn't set NEXT_PUBLIC_BASE_URL by default). Twitter +
 * Slack + Telegram unfurls then tried to fetch og:image from
 * localhost — broken for everyone but the operator. Steps 2 + 3
 * detect Vercel automatically and prepend the https:// scheme that
 * Vercel's env vars omit.
 */
function resolveMetadataBase(): URL {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit) return new URL(explicit);
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return new URL(`https://${prod}`);
  const preview = process.env.VERCEL_URL;
  if (preview) return new URL(`https://${preview}`);
  return new URL('http://localhost:3300');
}

export const metadata: Metadata = {
  title: "Ivaronix — AI review for the documents you can't paste into ChatGPT.",
  description: 'Burn Mode encrypts it. The audit ships a receipt anyone can verify from any machine — even after the document is gone.',
  metadataBase: resolveMetadataBase(),
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
