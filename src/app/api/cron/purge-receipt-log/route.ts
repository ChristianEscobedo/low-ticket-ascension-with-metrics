import { NextRequest, NextResponse } from 'next/server';
import {
  getReceiptLogRetentionDays,
  purgeReceiptLog
} from '@/utils/email/receipt-log';

export const dynamic = 'force-dynamic';

/**
 * Nightly receipt-log retention job. Wired in `vercel.json` (daily at 03:17
 * UTC). Authenticates via `CRON_SECRET` — Vercel sends it as the bearer in
 * the Authorization header. Falls back to a `?secret=` query param so it
 * can be triggered manually for verification.
 *
 * Returns a structured JSON body so the operator can confirm cutoff +
 * deleted-count from the Vercel cron dashboard logs.
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

  const overrideRaw = request.nextUrl.searchParams.get('days');
  const override = overrideRaw ? Number.parseInt(overrideRaw, 10) : null;
  const retentionDays =
    override && Number.isFinite(override) && override > 0
      ? override
      : getReceiptLogRetentionDays();

  const result = await purgeReceiptLog(retentionDays);
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.skipped ? 422 : 502
  });
}
