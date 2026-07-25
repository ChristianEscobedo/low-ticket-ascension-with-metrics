import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { readSequenceStats, upsertSequenceStats } from '@/lib/mothermode/email/statsStore';
import { normalizeStat, type EmailStat } from '@/lib/mothermode/email/analytics';
import {
  readEnrollmentData,
  upsertEnrollments,
  insertEvents,
} from '@/lib/mothermode/email/enrollmentStore';
import {
  normalizeEnrollment,
  normalizeEvent,
  type Enrollment,
  type EmailEvent,
} from '@/lib/mothermode/email/enrollment';

/**
 * Email sequence analytics (Phase 4 + Phase 5) — read + ingestion stub.
 *
 * GET  ?kitId=…[&period=all] → the stored SequenceStats + EnrollmentData for a
 *   kit (both empty when no rows exist; the flow-canvas overlay renders that
 *   as a "connect your ESP" empty state).
 * POST { kitId, period?, stats: EmailStat[] } → idempotent upsert for stats.
 * POST { kitId, enrollments: Enrollment[] } → idempotent upsert for enrollments.
 * POST { kitId, events: EmailEvent[] } → append events to the event stream.
 *
 * This is the seam a real ESP webhook (SendGrid/Postmark/Resend/GHL) will
 * normalize into; provider-specific payload mapping is intentionally out of
 * scope until a provider is chosen.
 */

/** GET: fetch stored stats + enrollment data for a kit. */
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
  const enrollment = await readEnrollmentData(kitId);
  return NextResponse.json({ success: true, stats, enrollment });
}

/** POST: upsert per-email counters, enrollments, or events (ingestion stub). */
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

    // Stats upsert (Phase 4).
    if (Array.isArray(body?.stats)) {
      const period = typeof body?.period === 'string' && body.period ? body.period : 'all';
      const rawStats: unknown[] = body.stats;
      const stats: EmailStat[] = rawStats.map((s) => normalizeStat(s));
      const written = await upsertSequenceStats(kitId, stats, period);
      const next = await readSequenceStats(kitId, period);
      const enrollment = await readEnrollmentData(kitId);
      return NextResponse.json({ success: true, written, stats: next, enrollment });
    }

    // Enrollment upsert (Phase 5).
    if (Array.isArray(body?.enrollments)) {
      const rawEnrollments: unknown[] = body.enrollments;
      const enrollments: Enrollment[] = rawEnrollments.map((e) => normalizeEnrollment(e));
      const written = await upsertEnrollments(kitId, enrollments);
      const enrollment = await readEnrollmentData(kitId);
      return NextResponse.json({ success: true, written, enrollment });
    }

    // Event insertion (Phase 5).
    if (Array.isArray(body?.events)) {
      const rawEvents: unknown[] = body.events;
      const events: EmailEvent[] = rawEvents.map((e) => normalizeEvent(e));
      const written = await insertEvents(kitId, events);
      return NextResponse.json({ success: true, written });
    }

    return NextResponse.json(
      { success: false, error: 'No stats, enrollments, or events in body' },
      { status: 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingest failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}