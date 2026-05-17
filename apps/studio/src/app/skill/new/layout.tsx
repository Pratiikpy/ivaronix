import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Bug-63: /skill/new is a client component ('use client') so it can't
// export `metadata` directly. A server-component layout.tsx is the
// canonical Next.js pattern for attaching metadata to client routes.
// (Matches the pattern used for /r/[id]/print/layout.tsx in Bug-53.)
export const metadata: Metadata = {
  title: 'Publish a skill · Ivaronix',
  description: 'Author a skill manifest — permissions, hooks, fee split — and save it to your per-wallet sandbox.',
};

export default function SkillNewLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
