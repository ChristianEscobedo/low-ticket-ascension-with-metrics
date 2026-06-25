import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET: List the course assignments for a Stripe product.
 * Query: ?product_id=prod_xxx
 * Returns the assignment rows plus inline course summaries for the UI.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id');
    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'product_id is required' },
        { status: 400 }
      );
    }

    const { data: assignments, error } = await (supabase as any)
      .from('product_course_assignments')
      .select('id, product_id, course_id, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[product-courses] GET error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const courseIds = ((assignments as any[]) || []).map((a) => a.course_id);
    let courses: Record<string, unknown>[] = [];
    if (courseIds.length > 0) {
      const { data: courseData } = await (supabase as any)
        .from('courses')
        .select(
          'id, title, description, short_description, thumbnail_url, lesson_count, total_duration_minutes, is_published'
        )
        .in('id', courseIds);
      courses = (courseData as any[]) || [];
    }

    return NextResponse.json({
      success: true,
      assignments: assignments || [],
      courses
    });
  } catch (error) {
    console.error('[product-courses] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}

/**
 * POST: Replace a product's course assignments.
 * Body: { product_id: string, course_ids: string[] }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const body = await request.json();
    const { product_id, course_ids } = body;

    if (!product_id || !Array.isArray(course_ids)) {
      return NextResponse.json(
        {
          success: false,
          error: 'product_id and course_ids[] are required'
        },
        { status: 400 }
      );
    }

    await (supabase as any)
      .from('product_course_assignments')
      .delete()
      .eq('product_id', product_id);

    if (course_ids.length > 0) {
      const rows = course_ids.map((courseId: string) => ({
        product_id,
        course_id: courseId
      }));
      const { error } = await (supabase as any)
        .from('product_course_assignments')
        .insert(rows);

      if (error) {
        console.error('[product-courses] POST insert error:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, count: course_ids.length });
  } catch (error) {
    console.error('[product-courses] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save assignments' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Remove a single assignment by ?id=<uuid>.
 */
export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { error } = await (supabase as any)
      .from('product_course_assignments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[product-courses] DELETE error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[product-courses] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete assignment' },
      { status: 500 }
    );
  }
}
