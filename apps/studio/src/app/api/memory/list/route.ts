import { NextResponse } from 'next/server';
import { listNotes } from '@/lib/studio-memory';
import { readSession, SESSION_COOKIE_NAME } from '@/lib/siwe-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/memory/list
 *
 * Returns up to 100 most-recent notes for the connected wallet, newest
 * first. SIWE-gated — same per-wallet sandbox pattern as the rest of
 * the memory endpoints.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const sessionCookie = req.headers
    .get('cookie')
    ?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
  const session = readSession(sessionCookie);
  if (!session) {
    return NextResponse.json(
      { error: 'authentication required — POST /api/auth/siwe/verify first' },
      { status: 401 },
    );
  }

  const notes = listNotes(session.wallet);
  return NextResponse.json({ notes });
}
