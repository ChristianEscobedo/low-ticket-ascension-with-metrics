import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import { isAdminEmail } from '@/utils/courses/access';

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET: course details + lessons. Admins see unpublished courses and
 * draft lessons; everyone else only sees published.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    let isAdmin = false;
    try {
      const authed = createClient();
      const user = await getUser(authed);
      isAdmin = isAdminEmail(user?.email);
    } catch {
      // anonymous viewer
    }

    let courseQuery = (supabase as any).from('courses').select('*').eq('id', id);
    if (!isAdmin) courseQuery = courseQuery.eq('is_published', true);
    const { data: course, error: courseError } = await courseQuery.single();

    if (courseError || !course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    let lessonQuery = (supabase as any)
      .from('lessons')
      .select('*')
      .eq('course_id', id)
      .order('chapter_number', { ascending: true })
      .order('lesson_number', { ascending: true });
    if (!isAdmin) lessonQuery = lessonQuery.eq('status', 'published');

    const { data: lessons, error: lessonsError } = await lessonQuery;
    if (lessonsError) {
      console.error('[courses/id] Lessons query error:', lessonsError);
    }

    return NextResponse.json({
      success: true,
      course: { ...course, lessons: lessons ?? [] },
      isAdmin
    });
  } catch (error) {
    console.error('[courses/id] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch course' },
      { status: 500 }
    );
  }
}
