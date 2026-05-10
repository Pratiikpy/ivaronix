'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Client island for /dashboard. Per planning-003 §A.5.16:
 *
 * The page itself is a server component that renders by `?address=`
 * search-param when set. When the param is absent, this island reads
 * the connected wallet via wagmi and pushes `?address=<addr>` into
 * the URL — which causes the server component to re-render with full
 * dashboard data.
 *
 * This pattern keeps SSR-clean first paint for shareable dashboard
 * URLs (`/dashboard?address=0x…` resolves with real content on the
 * first request) while still letting connected users land on
 * `/dashboard` and have it auto-redirect to their own data.
 */
export function DashboardClient(): null {
  const { isConnected, address } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (!isConnected || !address) return;
    if (typeof window === 'undefined') return;
    const current = new URL(window.location.href);
    if (current.searchParams.get('address')) return;
    current.searchParams.set('address', address);
    router.replace(`${current.pathname}${current.search}`);
  }, [isConnected, address, router]);

  return null;
}
