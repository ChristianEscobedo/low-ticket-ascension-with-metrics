import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * POST: Clone a lesson within the same course or to a different course.
 * Body: { targetCourseId?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id: courseId, lessonId } = await params;
    const body = await request.json().catch(() => ({}));
    const { targetCourseId } = body as { targetCourseId?: string };

    const { data: sourceLesson, error: fetchError } = await (supabase as any)
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single();

    if (fetchError || !sourceLesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      );
    }

    const targetCourse = targetCourseId || courseId;

    const { data: maxLessonData } = await (supabase as any)
      .from('lessons')
      .select('lesson_number')
      .eq('course_id', targetCourse)
      .eq('chapter_number', sourceLesson.chapter_number)
      .order('lesson_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextLessonNumber = (maxLessonData?.lesson_number || 0) + 1;

    const { data: clonedLesson, error: insertError } = await (supabase as any)
      .from('lessons')
      .insert({
        course_id: targetCourse,
        title: `${sourceLesson.title} (Copy)`,
        description: sourceLesson.description,
        video_url: sourceLesson.video_url,
        video_duration_seconds: sourceLesson.video_duration_seconds,
        content_markdown: sourceLesson.content_markdown,
        resources: sourceLesson.resources,
        chapter_number: sourceLesson.chapter_number,
        lesson_number: nextLessonNumber,
        is_preview: false,
        thumbnail_url: sourceLesson.thumbnail_url,
        status: 'draft'
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[admin/lessons/clone] Insert error:', insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    const { data: lessonCount } = await (supabase as any)
      .from('lessons')
      .select('id', { count: 'exact' })
      .eq('course_id', targetCourse);

    if (lessonCount) {
      await (supabase as any)
        .from('courses')
        .update({
          lesson_count: (lessonCount as { id: string }[]).length,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetCourse);
    }

    return NextResponse.json({
      success: true,
      clonedLessonId: clonedLesson?.id
    });
  } catch (error) {
    console.error('[admin/lessons/clone] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clone lesson' },
      { status: 500 }
    );
  }
}
