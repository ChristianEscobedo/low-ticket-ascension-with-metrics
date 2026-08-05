import { NextRequest, NextResponse } from 'next/server';
import { getSharedRunRecap } from '@/lib/mothermode/research/recipes/shareRead';

// Reads the database on every hit (revocation must be immediate) and must
// never be cached at any layer — a cached recap would outlive its token.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  // A capability URL spreads by being pasted, never by being indexed.
  'X-Robots-Tag': 'noindex, nofollow',
};

/**
 * GET /api/share/run/<token> — the ONLY unauthenticated read surface
 * against admin-guarded run data (roadmap Phase 3, "Share Run recap").
 *
 * The token is a revocable capability (mothermode_recipe_run_shares). It
 * buys EXACTLY ONE payload shape: the composed run recap (transcript +
 * funnel map + money map), sanitized at composition time by recap.ts —
 * no internal ids, no admin links, no scraped-card payloads, secrets
 * redacted. Unknown, malformed, or revoked tokens get the same plain 404
 * (no oracle: you cannot tell "never existed" from "revoked").
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  const recap = await getSharedRunRecap(params.token || '');
  if (!recap) {
    return new NextResponse('This shared run is unavailable.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...HEADERS },
    });
  }
  return NextResponse.json({ ok: true, recap }, { headers: HEADERS });
}
