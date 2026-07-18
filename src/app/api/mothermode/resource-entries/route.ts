import { NextRequest, NextResponse } from 'next/server';
import {
  listResourceEntries,
  upsertResourceEntry,
} from '@/lib/mothermode/resourceEntries';

/**
 * Public (no-auth) read/write for buyer-entered data on interactive resource
 * documents. There is no login in this funnel, so a self-reported email
 * scopes each buyer's data; this is the same trust model the rest of the
 * funnel uses (localStorage-cached purchase state, no server session).
 *
 * GET  ?slug=&key=&email=            -> { entries: ResourceEntry[] }
 * POST { slug, key, email, periodKey, periodLabel, data } -> upsert one period
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  const key = request.nextUrl.searchParams.get('key');
  const email = request.nextUrl.searchParams.get('email');
  if (!slug || !key || !email) {
    return NextResponse.json(
      { success: false, error: 'slug, key, and email are required' },
      { status: 400 },
    );
  }
  const entries = await listResourceEntries(slug, key, email);
  return NextResponse.json({ success: true, entries });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, key, email, periodKey, periodLabel, data } = body ?? {};
    if (!slug || !key || !email || !periodKey) {
      return NextResponse.json(
        { success: false, error: 'slug, key, email, and periodKey are required' },
        { status: 400 },
      );
    }
    await upsertResourceEntry({
      slug,
      key,
      email,
      periodKey,
      periodLabel: periodLabel || periodKey,
      data: data && typeof data === 'object' ? data : {},
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
