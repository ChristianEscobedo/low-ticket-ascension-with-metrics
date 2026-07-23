import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { readSequenceStats, upsertSequenceStats } from '@/lib/mothermode/email/statsStore';
import { normalizeStat, type EmailStat } from '@/lib/mothermode/email/analytics';

/**
 * Email sequence analytics (Phase 4) — read + ingestion stub.
 *
 * GET  ?kitId=…[&period=all] → the stored SequenceStats for a kit (empty when
 *   no rows exist; the flow-canvas overlay renders that as a "connect your ESP"
 *   empty state).
 * POST { kitId, period?, stats: EmailStat[] } → idempotent upsert. This is the
 *   seam a real ESP webhook (SendGrid/Postmark/Resend/GHL) will normalize into;
 *   provider-specific payload mapping is intentionally out of scope until a
 *   provider is chosen.
 */

/** GET: fetch stored stats for a kit. */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const kitId = request.nextUrl.searchParams.get('kitId');
  if (!kitId) {
    return NextResponse.json(
      { success: false, error: 'kitId is required' },
      { status: 400 },
    );
  }
  const period = request.nextUrl.searchParams.get('period') || 'all';
  const stats = await readSequenceStats(kitId, period);
  return NextResponse.json({ success: true, stats });
}

/** POST: upsert per-email counters (ingestion stub). */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const body = await request.json();
    const kitId = typeof body?.kitId === 'string' ? body.kitId : '';
    if (!kitId) {
      return NextResponse.json(
        { success: false, error: 'kitId is required' },
        { status: 400 },
      );
    }
    const period = typeof body?.period === 'string' && body.period ? body.period : 'all';
    const rawStats: unknown[] = Array.isArray(body?.stats) ? body.stats : [];
    const stats: EmailStat[] = rawStats.map((s) => normalizeStat(s));

    const written = await upsertSequenceStats(kitId, stats, period);
    const next = await readSequenceStats(kitId, period);
    return NextResponse.json({ success: true, written, stats: next });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingest failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
