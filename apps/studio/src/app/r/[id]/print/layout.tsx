import type { ReactNode } from 'react';
import type { Metadata } from 'next';

/**
 * Print-only layout: hide the studio header + footer + main padding so
 * the /r/[id]/print surface renders as a clean letterhead, suitable for
 * save-as-PDF (Ctrl+P). Same scoped-CSS pattern as /embed/* — App Router
 * root layouts always wrap every route, so the smallest portable way to
 * drop chrome on a per-route basis is a scoped style override.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  // Bug-53: include the receipt id in the page title so save-as-PDF
  // produces a filename like "Receipt #107 · printable · Ivaronix.pdf"
  // not the generic "Receipt · printable.pdf" that hid which receipt
  // it was. (Same params shape as ./page.tsx — Next.js 15 awaits these.)
  const { id } = await params;
  const safeId = /^\d+$/.test(id) ? `#${id}` : id.length > 0 ? id : '';
  const headline = safeId ? `Receipt ${safeId} · printable` : 'Receipt · printable';
  return {
    title: `${headline} · Ivaronix`,
    description: 'Printable Ivaronix receipt — anchored on 0G Chain.',
  };
}

export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        header, footer { display: none !important; }
        body > main, main { padding: 0 !important; margin: 0 !important; }
        body { background: white !important; }
        html { background: white !important; }
        @page {
          size: A4 portrait;
          margin: 18mm 15mm;
        }
        @media print {
          .print-hide { display: none !important; }
          .print-page { box-shadow: none !important; padding: 0 !important; }
        }
      `}</style>
      {children}
    </>
  );
}

