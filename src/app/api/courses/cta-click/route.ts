import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST { lesson_id, cta_id } — record a CTA button click. Accepts both
 * authenticated and anonymous callers (user_id is null for anon). Silently
 * skips the author-time preview lesson id so editor clicks don't pollute
 * metrics.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const lessonId = body?.lesson_id as string | undefined;
    const ctaId = body?.cta_id as string | undefined;

    if (!lessonId || !ctaId) {
      return NextResponse.json(
        { success: false, error: 'lesson_id and cta_id required' },
        { status: 400 }
      );
    }

    if (lessonId === '__preview__') {
      return NextResponse.json({ success: true, skipped: true });
    }

    if (!UUID_RE.test(lessonId)) {
      return NextResponse.json(
        { success: false, error: 'lesson_id must be a UUID' },
        { status: 400 }
      );
    }

    const authed = createClient();
    const user = await getUser(authed).catch(() => null);

    const { error } = await (supabase as any)
      .from('cta_click_events')
      .insert({
        lesson_id: lessonId,
        cta_id: ctaId,
        user_id: user?.id ?? null
      });

    if (error) {
      console.error('[cta-click] Insert error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[cta-click] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record click' },
      { status: 500 }
    );
  }
}
