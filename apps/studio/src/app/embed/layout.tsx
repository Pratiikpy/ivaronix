import type { ReactNode } from 'react';

/**
 * Embed-only layout: hide the studio header + footer + main padding so
 * the /embed/r/[id] surface fits cleanly inside a third-party iframe.
 * The root layout always wraps every route in App Router, so the only
 * portable way to drop chrome on a per-route basis is a scoped CSS
 * override. This stays small (5 selectors) and is local to /embed/*.
 */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        header, footer { display: none !important; }
        body > main, main { padding: 0 !important; margin: 0 !important; }
        body { background: transparent !important; }
        html { background: transparent !important; }
      `}</style>
      {children}
    </>
  );
}

export const metadata = {
  title: 'Ivaronix Receipt',
  description: 'Embeddable receipt verifier — anchored on 0G Chain.',
};
