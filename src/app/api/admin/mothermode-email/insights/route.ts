import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { readSequenceStats } from '@/lib/mothermode/email/statsStore';
import { readEnrollmentData } from '@/lib/mothermode/email/enrollmentStore';
import { aiGenerateInsights } from '@/utils/integrations/openai-email-insights';
import { normalizeSequence } from '@/lib/mothermode/email/types';

/**
 * AI insights for an email sequence (Phase 4).
 *
 * POST { kitId, sequence } → generates AI insights for the sequence + its
 * analytics. The sequence is passed in the body (not read from the DB) so the
 * insights reflect the CURRENT editor state, not the last saved state.
 *
 * GET ?kitId=… → reads stats + enrollment data for the kit (used by the
 * insights panel to show the current data before generating insights).
 */

/** GET: read stats + enrollment data for a kit. */
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
  const stats = await readSequenceStats(kitId, 'all');
  const enrollment = await readEnrollmentData(kitId);
  return NextResponse.json({ success: true, stats, enrollment });
}

/** POST: generate AI insights for a sequence + its analytics. */
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

    // Read stats + enrollment data for the kit.
    const stats = await readSequenceStats(kitId, 'all');
    const enrollment = await readEnrollmentData(kitId);

    // Use the sequence from the body (current editor state) or fall back to a
    // minimal sequence with just the name/goal/trigger from the body.
    const sequence = normalizeSequence(
      body?.sequence ?? {
        name: body?.name ?? '',
        goal: body?.goal ?? '',
        trigger: body?.trigger ?? 'optin',
        emails: body?.emails ?? [],
      },
    );

    const result = await aiGenerateInsights(sequence, stats, enrollment);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, report: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Insight generation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}