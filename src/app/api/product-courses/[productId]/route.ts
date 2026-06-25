import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET: Public — list courses assigned to a Stripe product.
 * Used by the post-purchase success page so buyers see what they unlocked.
 * Returns only published courses to avoid leaking drafts.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      );
    }

    const { data: assignments, error } = await (supabase as any)
      .from('product_course_assignments')
      .select('course_id')
      .eq('product_id', productId);

    if (error) {
      console.error('[product-courses/[productId]] error:', error);
      return NextResponse.json({ success: true, courses: [] });
    }

    const courseIds = ((assignments as { course_id: string }[]) || []).map(
      (a) => a.course_id
    );
    if (courseIds.length === 0) {
      return NextResponse.json({ success: true, courses: [] });
    }

    const { data: courses } = await (supabase as any)
      .from('courses')
      .select(
        'id, title, description, short_description, thumbnail_url, lesson_count, total_duration_minutes, is_published'
      )
      .in('id', courseIds)
      .eq('is_published', true);

    return NextResponse.json({
      success: true,
      courses: (courses as any[]) || []
    });
  } catch (error) {
    console.error('[product-courses/[productId]] Error:', error);
    return NextResponse.json({ success: true, courses: [] });
  }
}
