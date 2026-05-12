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
    // If we got here, the ImageResponse constructor returned. The actual
    // rendering happens when the consumer awaits the body. Force that here.
    await img.clone().arrayBuffer();
    ok('step 5 · ImageResponse construct + render OK');
    return new Response(log.join('\n'), {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) { return fail('step 5 · ImageResponse construct/render threw', err); }
}
