import type { ReactNode } from 'react';

/**
 * Print-only layout: hide the studio header + footer + main padding so
 * the /r/[id]/print surface renders as a clean letterhead, suitable for
 * save-as-PDF (Ctrl+P). Same scoped-CSS pattern as /embed/* — App Router
 * root layouts always wrap every route, so the smallest portable way to
 * drop chrome on a per-route basis is a scoped style override.
 */
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

export const metadata = {
  title: 'Receipt · printable',
  description: 'Printable Ivaronix receipt — anchored on 0G Chain.',
};
