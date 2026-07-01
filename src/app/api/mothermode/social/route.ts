import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { listSocialAccounts, createSocialPost } from '@/utils/integrations/social';

export const dynamic = 'force-dynamic';

/**
 * Content hub Schedule tab backend. Admin-only, proxying the GoHighLevel Social
 * Planner with the credentials stored on the admin Integrations page.
 *
 *   GET  -> the social accounts connected to the GHL location
 *   POST -> publish now or schedule a post across the chosen accounts
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const result = await listSocialAccounts();
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }
  return NextResponse.json({ ok: true, accounts: result.data });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: {
    accountIds?: unknown;
    summary?: unknown;
    scheduleDate?: unknown;
    type?: unknown;
    mediaUrls?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid JSON body' },
      { status: 400 }
    );
  }

  const accountIds = Array.isArray(body.accountIds)
    ? body.accountIds.map((v) => String(v)).filter(Boolean)
    : [];
  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  const type =
    body.type === 'story' || body.type === 'reel' ? body.type : 'post';
  const mediaUrls = Array.isArray(body.mediaUrls)
    ? body.mediaUrls.map((v) => String(v))
    : undefined;

  if (accountIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'select at least one account' },
      { status: 400 }
    );
  }
  if (!summary) {
    return NextResponse.json(
      { ok: false, error: 'post content is required' },
      { status: 400 }
    );
  }

  // Validate an optional schedule time and require it to be in the future.
  let scheduleDate: string | undefined;
  if (typeof body.scheduleDate === 'string' && body.scheduleDate.trim()) {
    const when = new Date(body.scheduleDate);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json(
        { ok: false, error: 'invalid schedule date' },
        { status: 400 }
      );
    }
    if (when.getTime() <= Date.now()) {
      return NextResponse.json(
        { ok: false, error: 'schedule a time in the future' },
        { status: 400 }
      );
    }
    scheduleDate = when.toISOString();
  }

  const result = await createSocialPost({
    accountIds,
    summary,
    type,
    mediaUrls,
    scheduleDate,
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }
  return NextResponse.json({
    ok: true,
    id: result.data.id ?? null,
    scheduled: result.data.scheduled,
  });
}
