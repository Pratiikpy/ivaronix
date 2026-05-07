import { NextResponse, type NextRequest } from 'next/server';

/**
 * Vanity-URL rewrite: /@<handle> → /agent/<handle>
 * Per HLD §6 the canonical agent URL is /@username, but Next.js does not
 * accept '@' as a literal in route segments. The middleware rewrites at the
 * edge so /@0xabcd... renders the same content as /agent/0xabcd... .
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith('/@')) {
    const handle = path.slice(2);
    const url = req.nextUrl.clone();
    url.pathname = `/agent/${handle}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/@:path*'],
};
