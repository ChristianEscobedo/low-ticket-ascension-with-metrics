import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET ?course_id=... — return the signed-in user's progress rows for every
 * lesson in the given course. Returns [] for anonymous users so the player
 * still renders.
 */
export async function GET(request: NextRequest) {
  try {
    const authed = createClient();
    const user = await getUser(authed);
    if (!user) return NextResponse.json({ success: true, progress: [] });

    const courseId = new URL(request.url).searchParams.get('course_id');
    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'course_id required' },
        { status: 400 }
      );
    }

    const { data: lessons } = await (supabase as any)
      .from('lessons')
      .select('id')
      .eq('course_id', courseId);
    const lessonIds = ((lessons as { id: string }[] | null) ?? []).map((l) => l.id);
    if (lessonIds.length === 0) {
      return NextResponse.json({ success: true, progress: [] });
    }

    const { data: progress } = await (supabase as any)
      .from('user_lesson_progress')
      .select('lesson_id, progress_seconds, is_completed, completed_at, last_watched_at')
      .eq('user_id', user.id)
      .in('lesson_id', lessonIds);

    return NextResponse.json({ success: true, progress: progress ?? [] });
  } catch (error) {
    console.error('[lessons/progress] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}

/**
 * POST { lesson_id, progress_seconds?, is_completed? } — upsert progress for
 * the signed-in user. Silently no-ops for anonymous users so the client can
 * fire-and-forget without branching.
 */
export async function POST(request: NextRequest) {
  try {
    const authed = createClient();
    const user = await getUser(authed);
    if (!user) return NextResponse.json({ success: true, skipped: true });

    const body = await request.json().catch(() => null);
    const lessonId = body?.lesson_id as string | undefined;
    if (!lessonId) {
      return NextResponse.json(
        { success: false, error: 'lesson_id required' },
        { status: 400 }
      );
    }

    const progressSeconds =
      typeof body?.progress_seconds === 'number'
        ? Math.max(0, Math.floor(body.progress_seconds))
        : undefined;
    const isCompleted =
      typeof body?.is_completed === 'boolean' ? body.is_completed : undefined;

    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = {
      user_id: user.id,
      lesson_id: lessonId,
      last_watched_at: nowIso
    };
    if (progressSeconds !== undefined) update.progress_seconds = progressSeconds;
    if (isCompleted !== undefined) {
      update.is_completed = isCompleted;
      update.completed_at = isCompleted ? nowIso : null;
    }

    const { error } = await (supabase as any)
      .from('user_lesson_progress')
      .upsert(update, { onConflict: 'user_id,lesson_id' });

    if (error) {
      console.error('[lessons/progress] Upsert error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[lessons/progress] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save progress' },
      { status: 500 }
    );
  }
}
