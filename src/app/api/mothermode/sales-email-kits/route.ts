import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { getFunnelById } from '@/lib/mothermode/sales/store';
import { autobuildSalesEmailKits } from '@/lib/mothermode/sales/emailAutobuild';
import { buildSalesEmailPlan } from '@/lib/mothermode/sales/emailPlan';
import { SALES_EMAIL_EVENTS, type SalesEmailEvent } from '@/lib/mothermode/sales/types';

/**
 * Admin-only Sales Funnel -> Email Marketing Kit autobuild.
 *
 *   POST { action: 'plan', funnelId, events?, onlyMissing? }
 *     → { success, plans }   // no tokens spent; powers the editor preview
 *
 *   POST { action: 'generate', funnelId, events?, onlyMissing? }
 *     → { success, built, failed, results, item }
 *
 * This lives apart from /api/mothermode/sales-ai because that endpoint is
 * intake-driven (it validates niche/audience before writing pages), while this
 * one works off a saved funnel record and returns per-event results.
 */

// Generating a full sequence is many model calls per event, and a bulk run
// covers up to thirteen events, so the default serverless timeout is not enough.
export const maxDuration = 300;

/** Read + validate the requested events, dropping anything unknown. */
function readEvents(value: unknown): SalesEmailEvent[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const known = new Set<string>(SALES_EMAIL_EVENTS);
  const events = value
    .map((v) => String(v))
    .filter((v) => known.has(v)) as SalesEmailEvent[];
  return events.length ? events : undefined;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = String(body.action ?? 'generate');
  const funnelId = String(body.funnelId ?? body.id ?? '').trim();
  if (!funnelId) {
    return NextResponse.json(
      { success: false, error: 'funnelId is required. Save the funnel before generating sequences.' },
      { status: 400 },
    );
  }

  const funnel = await getFunnelById(funnelId);
  if (!funnel) {
    return NextResponse.json({ success: false, error: 'Funnel not found' }, { status: 404 });
  }

  const events = readEvents(body.events);
  const onlyMissing = body.onlyMissing === true;

  // The plan is pure, so the editor can show exactly what would be generated
  // (campaign, kit name, seeded audience/goal) before anyone spends tokens.
  if (action === 'plan') {
    const plans = buildSalesEmailPlan(funnel, { events, onlyMissing });
    return NextResponse.json({ success: true, plans });
  }

  if (action !== 'generate') {
    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 },
    );
  }

  const plannedCount = buildSalesEmailPlan(funnel, { events, onlyMissing }).length;
  if (plannedCount === 0) {
    return NextResponse.json({
      success: true,
      built: 0,
      failed: 0,
      results: [],
      item: funnel,
      message: onlyMissing
        ? 'Every selected event already has an email kit bound.'
        : 'No matching funnel events.',
    });
  }

  const output = await autobuildSalesEmailKits(funnel, {
    events,
    onlyMissing,
    updatedBy: guard.email ?? null,
  });

  // Partial success is the normal case worth surfacing: report both sides and
  // still hand back the funnel with whatever bindings did land.
  return NextResponse.json({
    success: output.built > 0,
    built: output.built,
    failed: output.failed,
    results: output.results,
    item: output.funnel,
    error:
      output.built === 0
        ? output.results.find((r) => r.error)?.error ?? 'Generation failed'
        : undefined,
  });
}
