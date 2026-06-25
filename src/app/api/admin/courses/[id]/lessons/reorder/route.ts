import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * POST: Batch update lesson chapter_number/lesson_number values.
 * Body: { orders: [{ id, chapter_number, lesson_number }] }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id: courseId } = await params;
    const body = await request.json();
    const { orders } = body as {
      orders: { id: string; chapter_number: number; lesson_number: number }[];
    };

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { success: false, error: 'orders array is required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const updates = orders.map((o) =>
      (supabase as any)
        .from('lessons')
        .update({
          chapter_number: o.chapter_number,
          lesson_number: o.lesson_number,
          updated_at: now
        })
        .eq('id', o.id)
        .eq('course_id', courseId)
    );

    const results = await Promise.all(updates);
    const errors = results.filter((r: any) => r.error);

    if (errors.length > 0) {
      console.error(
        '[admin/lessons/reorder] Errors:',
        errors.map((e: any) => e.error?.message)
      );
      return NextResponse.json(
        { success: false, error: 'Some updates failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/lessons/reorder] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reorder lessons' },
      { status: 500 }
    );
  }
}
