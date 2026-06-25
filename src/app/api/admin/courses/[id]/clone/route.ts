import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * POST: Clone a course with all its lessons. Cloned course starts as draft.
 * Body: { newTitle?: string, newId?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id: courseId } = await params;
    const body = await request.json().catch(() => ({}));
    const { newTitle, newId } = body as { newTitle?: string; newId?: string };

    const { data: sourceCourse, error: fetchError } = await (supabase as any)
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (fetchError || !sourceCourse) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    const clonedCourseId = newId || `${courseId}-copy-${Date.now()}`;
    const clonedTitle = newTitle || `${sourceCourse.title} (Copy)`;

    const { error: insertError } = await (supabase as any)
      .from('courses')
      .insert({
        id: clonedCourseId,
        title: clonedTitle,
        description: sourceCourse.description,
        short_description: sourceCourse.short_description,
        thumbnail_url: sourceCourse.thumbnail_url,
        preview_video_url: sourceCourse.preview_video_url,
        instructor_name: sourceCourse.instructor_name,
        instructor_avatar: sourceCourse.instructor_avatar,
        lesson_count: sourceCourse.lesson_count,
        total_duration_minutes: sourceCourse.total_duration_minutes,
        price_cents: sourceCourse.price_cents,
        is_free: sourceCourse.is_free,
        requires_subscription: sourceCourse.requires_subscription,
        sort_order: (sourceCourse.sort_order || 0) + 1,
        is_published: false,
        is_featured: false,
        badge_text: sourceCourse.badge_text,
        tags: sourceCourse.tags
      });

    if (insertError) {
      console.error('[admin/courses/clone] Insert error:', insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    const { data: sourceLessons } = await (supabase as any)
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('chapter_number', { ascending: true })
      .order('lesson_number', { ascending: true });

    if (sourceLessons && sourceLessons.length > 0) {
      const clonedLessons = (sourceLessons as any[]).map((lesson) => ({
        course_id: clonedCourseId,
        title: lesson.title,
        description: lesson.description,
        video_url: lesson.video_url,
        video_duration_seconds: lesson.video_duration_seconds,
        content_markdown: lesson.content_markdown,
        resources: lesson.resources,
        chapter_number: lesson.chapter_number,
        lesson_number: lesson.lesson_number,
        is_preview: lesson.is_preview,
        thumbnail_url: lesson.thumbnail_url,
        status: 'draft'
      }));

      const { error: lessonsError } = await (supabase as any)
        .from('lessons')
        .insert(clonedLessons);

      if (lessonsError) {
        console.error(
          '[admin/courses/clone] Lessons insert error:',
          lessonsError
        );
        return NextResponse.json({
          success: true,
          clonedCourseId,
          warning: 'Course cloned but some lessons may have failed to copy'
        });
      }
    }

    return NextResponse.json({ success: true, clonedCourseId });
  } catch (error) {
    console.error('[admin/courses/clone] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clone course' },
      { status: 500 }
    );
  }
}
