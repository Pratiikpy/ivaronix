/**
 * B-V2-2 diagnostic · minimal isolation route.
 *
 * The /opengraph-image and /r/[id]/opengraph-image routes return 500
 * from Next's _error fallback on Vercel, bypassing the try/catch
 * wrapper inside the handler. That means the throw happens at
 * module-load time (before the handler is even invoked).
 *
 * This route exercises each suspected layer one by one and reports
 * back as plain text:
 *
 *   step 1: can we return a plain text response at all?
 *   step 2: can we import { ImageResponse } from 'next/og'?
 *   step 3: can we import the b64 font string?
 *   step 4: can we decode b64 → ArrayBuffer?
 *   step 5: can we construct an ImageResponse with our font?
 *
 * Hit /og-minimal on Vercel; the failing step's line is the
 * culprit. Delete this route once B-V2-2 is verified live.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const log: string[] = [];
  const ok = (msg: string): void => { log.push(`✓ ${msg}`); };
  const fail = (msg: string, err: unknown): Response => {
    const name = err instanceof Error ? err.name : 'unknown';
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 8).join('\n') : '';
    log.push(`✗ ${msg}`);
    log.push(`  ${name}: ${message}`);
    if (stack) log.push(stack);
    return new Response(log.join('\n'), {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  };

  ok('step 1 · returning plain text from a Node-runtime route');

  let ImageResponse: typeof import('next/og').ImageResponse;
  try {
    const og = await import('next/og');
    ImageResponse = og.ImageResponse;
    ok(`step 2 · imported next/og · ImageResponse=${typeof ImageResponse}`);
  } catch (err) { return fail('step 2 · import("next/og") threw', err); }

  let b64: string;
  try {
    const mod = await import('@/lib/fonts/Outfit-SemiBold.b64');
    b64 = mod.OUTFIT_SEMIBOLD_B64;
    ok(`step 3 · imported font b64 · length=${b64?.length}`);
  } catch (err) { return fail('step 3 · import font b64 threw', err); }

  let data: ArrayBuffer;
  try {
    const buf = Buffer.from(b64, 'base64');
    const ab = new ArrayBuffer(buf.byteLength);
    new Uint8Array(ab).set(buf);
    data = ab;
    const magic = Array.from(new Uint8Array(data).slice(0, 4)).map((b) => b.toString(16).padStart(2, '0')).join(' ');
    ok(`step 4 · decoded ArrayBuffer · bytes=${data.byteLength} · magic=${magic}`);
  } catch (err) { return fail('step 4 · b64 decode threw', err); }

  try {
    const img = new ImageResponse(
      ('<div style="width:100%;height:100%;background:#fafaf7;color:#0a0a0a;font-size:60px;display:flex;align-items:center;justify-content:center">og-minimal · step 5 reached</div>') as unknown as React.ReactElement,
      {
        width: 1200,
        height: 630,
        fonts: [{ name: 'Outfit', data, style: 'normal', weight: 600 }],
      },
    );
    await img.clone().arrayBuffer();
    ok('step 5 · ImageResponse construct + render OK');
  } catch (err) { return fail('step 5 · ImageResponse construct/render threw', err); }

  // Step 6: replicate the exact pattern /opengraph-image uses — import
  // chain helper, call getNetwork(), render the full SVG-and-flex JSX.
  // If step 5 passed (above) but step 6 fails, the bug is in chain.ts
  // module-init or in the multi-element JSX, not the font path.
  let getNetwork: () => string;
  try {
    const mod = await import('@/lib/chain');
    getNetwork = mod.getNetwork;
    ok(`step 6a · imported @/lib/chain · getNetwork=${typeof getNetwork}`);
  } catch (err) { return fail('step 6a · import("@/lib/chain") threw', err); }

  let network: string;
  try {
    network = getNetwork();
    ok(`step 6b · getNetwork() returned: ${network}`);
  } catch (err) { return fail('step 6b · getNetwork() threw', err); }

  // Step 7: render the full /opengraph-image JSX (SVG-with-text +
  // four-light row + multi-flex layout) to surface any layout-engine
  // failures (e.g. satori choking on the SVG <text> element).
  try {
    const React = await import('react');
    const node = React.createElement(
      'div',
      { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#fafaf7', color: '#0a0a0a', padding: '64px 80px', fontFamily: 'system-ui, sans-serif' } },
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 16 } },
        React.createElement(
          'svg',
          { width: 48, height: 32, viewBox: '0 0 32 20', fill: 'none' },
          React.createElement('path', { d: 'M5 2 L1 2 L1 18 L5 18', stroke: '#0a0a0a', strokeWidth: 2.4, strokeLinejoin: 'miter', fill: 'none' }),
          React.createElement('text', { x: 16, y: 16, textAnchor: 'middle', fontFamily: "'Instrument Serif', 'Times New Roman', serif", fontStyle: 'italic', fontSize: 20, fill: '#0a0a0a' }, 'i'),
          React.createElement('circle', { cx: 16.6, cy: 4.6, r: 1.6, fill: '#16a34a' }),
          React.createElement('path', { d: 'M27 2 L31 2 L31 18 L27 18', stroke: '#0a0a0a', strokeWidth: 2.4, strokeLinejoin: 'miter', fill: 'none' }),
        ),
        React.createElement('span', { style: { fontSize: 28, letterSpacing: 6, fontWeight: 600 } }, 'IVARONIX'),
      ),
      React.createElement('span', { style: { fontSize: 76, fontWeight: 600 } }, `network=${network}`),
    );
    const img = new ImageResponse(node, {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Outfit', data, style: 'normal', weight: 600 }],
    });
    await img.clone().arrayBuffer();
    ok('step 7 · full-JSX ImageResponse (SVG + flex + network label) rendered OK');
  } catch (err) { return fail('step 7 · full-JSX ImageResponse threw', err); }

  return new Response(log.join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
