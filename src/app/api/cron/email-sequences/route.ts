import { NextRequest, NextResponse } from 'next/server';
import { tickSequences } from '@/utils/email/sequences/engine';

export const dynamic = 'force-dynamic';

/**
 * Email sequence runner. Wired in `vercel.json` (hourly). Sends every due step
 * for active re-engagement / coaching-extension enrollments and advances each
 * one. Authenticates via `CRON_SECRET` exactly like the receipt-log purge job:
 * Vercel sends it as the bearer token; a `?secret=` query param is accepted for
 * manual verification.
 *
 * Returns a structured JSON summary (processed / sent / converted / completed /
 * failed) so the operator can read the result from the Vercel cron logs.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET is not configured' },
      { status: 503 }
    );
  }
  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : null;
  const provided = bearer ?? request.nextUrl.searchParams.get('secret');
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const result = await tickSequences();
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.skipped ? 422 : 502,
  });
}
