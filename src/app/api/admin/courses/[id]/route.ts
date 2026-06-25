import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET: Fetch a single course by id (admin — includes unpublished).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id: courseId } = await params;
    const { data: course, error } = await (supabase as any)
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (error) {
      console.error('[admin/courses/[id]] GET error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, course });
  } catch (error) {
    console.error('[admin/courses/[id]] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch course' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Quick toggle update on safe fields (publish/feature/badge/sort).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id: courseId } = await params;
    const body = await request.json();

    const allowedFields = [
      'is_published',
      'is_featured',
      'is_free',
      'badge_text',
      'sort_order'
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

    const { data: course, error } = await (supabase as any)
      .from('courses')
      .update(updates)
      .eq('id', courseId)
      .select()
      .single();

    if (error) {
      console.error('[admin/courses/[id]] PATCH error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, course });
  } catch (error) {
    console.error('[admin/courses/[id]] PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update course' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete a course (lessons cascade via FK).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id: courseId } = await params;
    const { error } = await (supabase as any)
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (error) {
      console.error('[admin/courses/[id]] DELETE error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/courses/[id]] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete course' },
      { status: 500 }
    );
  }
}
