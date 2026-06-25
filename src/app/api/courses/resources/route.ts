import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET: Fetch generated resources for a lesson or course.
 * The `generated_resources` table is part of the lead-magnet subsystem
 * (not shipped here). When absent we return an empty list so callers
 * don't have to special-case it.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');
    const courseId = searchParams.get('courseId');

    if (!lessonId && !courseId) {
      return NextResponse.json({ success: true, resources: [] });
    }

    let query = (supabase as any)
      .from('generated_resources')
      .select(
        'id, title, resource_type, slug, is_published, view_count, download_count, created_at'
      )
      .order('created_at', { ascending: false });

    if (lessonId) query = query.eq('lesson_id', lessonId);
    else if (courseId) query = query.eq('course_id', courseId);

    const { data, error } = await query;
    if (error) {
      if (
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        error.message?.includes('does not exist')
      ) {
        return NextResponse.json({
          success: true,
          resources: [],
          source: 'table_not_found'
        });
      }
      console.error('[courses/resources] Query error:', error);
      return NextResponse.json({
        success: true,
        resources: [],
        source: 'error'
      });
    }

    return NextResponse.json({ success: true, resources: data ?? [] });
  } catch (error) {
    console.error('[courses/resources] Error:', error);
    return NextResponse.json({
      success: true,
      resources: [],
      source: 'exception'
    });
  }
}
