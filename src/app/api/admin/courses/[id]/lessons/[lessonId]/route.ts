import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET: Fetch a single lesson by id.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { lessonId } = await params;
    const { data: lesson, error } = await (supabase as any)
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single();

    if (error) {
      console.error('[admin/lessons/[lessonId]] GET error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, lesson });
  } catch (error) {
    console.error('[admin/lessons/[lessonId]] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lesson' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Toggle update on safe lesson fields.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { lessonId } = await params;
    const body = await request.json();

    const allowedFields = [
      'status',
      'is_preview',
      'chapter_number',
      'lesson_number'
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }
    updates.updated_at = new Date().toISOString();

    const { data: lesson, error } = await (supabase as any)
      .from('lessons')
      .update(updates)
      .eq('id', lessonId)
      .select()
      .single();

    if (error) {
      console.error('[admin/lessons/[lessonId]] PATCH error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, lesson });
  } catch (error) {
    console.error('[admin/lessons/[lessonId]] PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update lesson' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Remove a lesson and refresh course lesson_count.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id: courseId, lessonId } = await params;
    const { error } = await (supabase as any)
      .from('lessons')
      .delete()
      .eq('id', lessonId);

    if (error) {
      console.error('[admin/lessons/[lessonId]] DELETE error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const { data: remaining } = await (supabase as any)
      .from('lessons')
      .select('id', { count: 'exact' })
      .eq('course_id', courseId);

    if (remaining) {
      await (supabase as any)
        .from('courses')
        .update({
          lesson_count: (remaining as { id: string }[]).length,
          updated_at: new Date().toISOString()
        })
        .eq('id', courseId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/lessons/[lessonId]] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete lesson' },
      { status: 500 }
    );
  }
}
