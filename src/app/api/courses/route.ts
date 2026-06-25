import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET: List published courses. Optional filters:
 *   ?featured=true  – only featured
 *   ?tag=foo        – tag contains 'foo'
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const featured = searchParams.get('featured') === 'true';
    const tag = searchParams.get('tag');

    let query = (supabase as any)
      .from('courses')
      .select(
        'id, title, description, short_description, thumbnail_url, preview_video_url, instructor_name, instructor_avatar, lesson_count, total_duration_minutes, price_cents, is_free, requires_subscription, required_plan_id, is_featured, badge_text, tags'
      )
      .eq('is_published', true)
      .order('sort_order', { ascending: true });

    if (featured) query = query.eq('is_featured', true);
    if (tag) query = query.contains('tags', [tag]);

    const { data, error } = await query;
    if (error) {
      console.error('[courses] Query error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, courses: data ?? [] });
  } catch (error) {
    console.error('[courses] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}
