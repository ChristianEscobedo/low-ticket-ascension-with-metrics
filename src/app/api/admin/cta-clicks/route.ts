import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET ?lesson_id=... — return per-CTA click counts for a lesson.
 * Aggregated server-side. Admin-only. Returns { counts: { [cta_id]: n } }.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const lessonId = new URL(request.url).searchParams.get('lesson_id');
  if (!lessonId) {
    return NextResponse.json(
      { success: false, error: 'lesson_id required' },
      { status: 400 }
    );
  }

  const { data, error } = await (supabase as any)
    .from('cta_click_events')
    .select('cta_id')
    .eq('lesson_id', lessonId);

  if (error) {
    console.error('[admin/cta-clicks] Query error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const counts: Record<string, number> = {};
  for (const row of (data as { cta_id: string }[] | null) ?? []) {
    counts[row.cta_id] = (counts[row.cta_id] ?? 0) + 1;
  }

  return NextResponse.json({ success: true, counts });
}
